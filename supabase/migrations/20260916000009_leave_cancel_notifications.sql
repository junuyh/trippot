-- ============================================================================
-- 나가기 · 위임 · 취소에 인앱 알림을 붙인다
--
-- 2026-09-16 · 알림 센터(20260916000001)의 create_notification 을 그대로 쓴다.
--
-- ⚠️ 푸시가 아니라 **인앱 알림**이다. notifications 표에 행을 남기고,
--    마이페이지 알림 목록이 읽는다. (2026-09-16 다빈 결정)
--
-- ⚠️ 알림은 **행동과 같은 트랜잭션**에서 만든다. 되돌렸는데 알림만 빠지는
--    경우가 없다. create_notification 이 실패해도 warning 으로 넘어가므로
--    알림 때문에 나가기·취소가 실패하지는 않는다.
--
-- ── 받는 사람 규칙 (2026-09-16 다빈 확정) ───────────────────────────────────
--
--   · 행동한 본인은 제외한다. 방금 자기가 한 일을 다시 알리지 않는다
--   · ACTIVE 가입 멤버만 받는다. 나간 사람(LEFT)·미가입 동행자는 받지 않는다
--   · 예외 — CANCEL_EXPIRED 는 제외할 '본인' 이 없다. 시간이 지나서 일어난
--     일이고 화면을 연 사람은 아무것도 하지 않았다. 전원이 받는다
--
-- ── 문구 (이슈 #73 확정본 · 2026-09-16 일부 갱신) ───────────────────────────
--
--   앱 쪽 기준은 lib/notifications/messages.ts 다. **양쪽이 같아야 한다.**
--   받는 사람에 따라 갈리는 두 갈래(OWNER_DELEGATED · CANCEL_WITHDRAWN)와
--   숫자가 들어가는 CANCEL_VOTE_AGREED 는 여기에만 있고, messages.ts 에는
--   주석으로 전문을 적어 두었다.
--
-- ⚠️ 기존 마이그레이션을 고치지 않는다. create or replace 로 덮는다. (§18)
-- ============================================================================


-- ============================================================================
-- ① 내부 helper — 여행 멤버에게 같은 알림을 돌린다
--
-- 받는 사람 규칙을 **한 곳**에 둔다. 아홉 군데에 같은 판정을 흩으면
-- 한쪽만 고쳐진다. (leaveTrip 이 둘로 갈렸던 것과 같은 일이다)
--
-- ⚠️ distinct 로 돈다. trip_members 에 unique (trip_id, user_id) 가 없어
--    같은 사람 행이 여러 개면 알림도 여러 번 간다.
-- ============================================================================
create or replace function public._notify_trip_members(
  p_trip_id    uuid,
  p_exclude    uuid,      -- 행동한 본인. 없으면 null
  p_type       text,
  p_title      text,
  p_body       text,
  p_data       jsonb default '{}'::jsonb,
  p_exclude2   uuid default null   -- 전용 문구를 이미 받은 사람 (위임 대상)
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid;
begin
  for v_uid in
    select distinct tm.user_id
    from public.trip_members tm
    where tm.trip_id = p_trip_id
      and tm.status = 'ACTIVE'
      and tm.user_id is not null
      and (p_exclude  is null or tm.user_id <> p_exclude)
      and (p_exclude2 is null or tm.user_id <> p_exclude2)
  loop
    perform public.create_notification(v_uid, p_type, p_title, p_body, p_trip_id, p_data);
  end loop;
end;
$$;


-- ============================================================================
-- ② 나가기 — MEMBER_LEFT
--
-- ⚠️ 나간 사람은 이 시점에 이미 LEFT 라 ACTIVE 필터에서 저절로 빠진다.
--    그래도 p_exclude 를 넘긴다. 순서가 바뀌어도 본인에게 가지 않게.
--
-- ⚠️ 모임에서도 나갔는지는 담지 않는다. (POL-MEM-007)
-- ============================================================================
create or replace function public._trip_leave_core(
  p_trip_id          uuid,
  p_user_id          uuid,
  p_also_leave_group boolean
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_group_id uuid;
  v_trip     public.trips%rowtype;
begin
  update public.trip_members tm
     set status = 'LEFT', left_at = now(), updated_at = now()
   where tm.trip_id = p_trip_id
     and tm.user_id = p_user_id
     and tm.status = 'ACTIVE';

  if p_also_leave_group then
    select t.group_id into v_group_id from public.trips t where t.id = p_trip_id;

    if v_group_id is not null then
      update public.group_members gm
         set status = 'LEFT', updated_at = now()
       where gm.group_id = v_group_id
         and gm.user_id = p_user_id
         and gm.status = 'ACTIVE';
    end if;
  end if;

  select * into v_trip from public.trips t where t.id = p_trip_id;

  perform public._notify_trip_members(
    p_trip_id, p_user_id, 'MEMBER_LEFT',
    '멤버가 여행에서 나갔어요',
    public.notification_trip_label(v_trip.destination) || '의 멤버 한 명이 나갔어요.'
  );

  return public._trip_cancel_recheck_after_leave(p_trip_id, p_user_id);
end;
$$;


-- ============================================================================
-- ③ 위임 — OWNER_DELEGATED 2갈래
--
--   새 여행장     "여행장이 되었어요"    / "{여행}의 여행장을 맡게 됐어요."
--   나머지 전원   "여행장이 바뀌었어요"  / "이제 ○○님이 {여행}의 여행장이에요."
--
-- ⚠️ 여행장이 바뀌면 **전원에게 영향**이다. 참여 요청을 수락할 사람이 달라진다.
--    그래서 새 여행장에게만 알리지 않는다. (2026-09-16 다빈 결정)
-- ============================================================================
create or replace function public.delegate_trip_leader(
  p_trip_id    uuid,
  p_to_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid       uuid := auth.uid();
  v_trip      public.trips%rowtype;
  v_trip_name text;
  v_new_name  text;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;

  select * into v_trip from public.trips t where t.id = p_trip_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;

  if v_trip.leader_user_id is null or v_trip.leader_user_id <> v_uid then
    raise exception using errcode = '42501', message = 'NOT_LEADER';
  end if;

  if v_trip.leader_user_id = p_to_user_id then
    return;
  end if;

  if p_to_user_id is null or p_to_user_id = v_uid then
    raise exception using errcode = '22023', message = 'INVALID_TARGET';
  end if;

  if not exists (
    select 1 from public.trip_members tm
    where tm.trip_id = p_trip_id and tm.user_id = p_to_user_id and tm.status = 'ACTIVE'
  ) then
    raise exception using errcode = '22023', message = 'INVALID_TARGET';
  end if;

  update public.trips t
     set leader_user_id = p_to_user_id
   where t.id = p_trip_id;

  v_trip_name := public.notification_trip_label(v_trip.destination);
  select public.notification_person_label(u.name) into v_new_name
  from public.users u where u.id = p_to_user_id;

  -- 새 여행장에게
  perform public.create_notification(
    p_to_user_id, 'OWNER_DELEGATED',
    '여행장이 되었어요',
    v_trip_name || '의 여행장을 맡게 됐어요.',
    p_trip_id, '{}'::jsonb
  );

  -- 나머지 멤버에게 — 넘긴 사람(v_uid)과 새 여행장(p_to_user_id)을 뺀다.
  -- 새 여행장은 바로 위에서 전용 문구를 이미 받았다.
  perform public._notify_trip_members(
    p_trip_id, v_uid, 'OWNER_DELEGATED',
    '여행장이 바뀌었어요',
    '이제 ' || v_new_name || '님이 ' || v_trip_name || '의 여행장이에요.',
    '{}'::jsonb, p_to_user_id
  );
end;
$$;


-- ============================================================================
-- ④ 취소 요청 — CANCEL_REQUESTED
--
-- ⚠️ 사유(reason)는 본문에 넣지 않는다. 목록에 그대로 노출된다.
-- ⚠️ 동의 대상이 0명(개인 여행)이면 그 자리에서 확정되므로 이 알림은 안 간다.
-- ============================================================================
create or replace function public.request_trip_cancel(
  p_trip_id uuid,
  p_reason  text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid      uuid := auth.uid();
  v_trip     public.trips%rowtype;
  v_existing public.trip_cancel_requests%rowtype;
  v_targets  integer;
  v_new_id   uuid;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;

  select * into v_trip from public.trips t where t.id = p_trip_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;

  if not exists (
    select 1 from public.trip_members tm
    where tm.trip_id = p_trip_id and tm.user_id = v_uid and tm.status = 'ACTIVE'
  ) then
    raise exception using errcode = '42501', message = 'NOT_MEMBER';
  end if;

  select * into v_existing
  from public.trip_cancel_requests r
  where r.trip_id = p_trip_id and r.status = 'PENDING'
  limit 1;

  if found then
    return jsonb_build_object('outcome', 'PENDING', 'request_id', v_existing.id);
  end if;

  if v_trip.status <> 'PLANNING' then
    raise exception using errcode = '22023', message = 'NOT_CANCELABLE';
  end if;

  insert into public.trip_cancel_requests (trip_id, requested_by, reason, expires_at)
  values (p_trip_id, v_uid, p_reason, now() + interval '7 days')
  returning id into v_new_id;

  select count(distinct tm.user_id)::integer into v_targets
  from public.trip_members tm
  where tm.trip_id = p_trip_id
    and tm.status = 'ACTIVE'
    and tm.user_id is not null
    and tm.user_id <> v_uid;

  if v_targets = 0 then
    perform public._trip_cancel_confirm(p_trip_id, v_new_id);
    return jsonb_build_object('outcome', 'CANCELED', 'request_id', v_new_id);
  end if;

  update public.trips t set status = 'CANCEL_PENDING' where t.id = p_trip_id;

  perform public._notify_trip_members(
    p_trip_id, v_uid, 'CANCEL_REQUESTED',
    '여행 취소 요청이 왔어요',
    public.notification_trip_label(v_trip.destination) || '을 취소할지 정해 주세요.',
    jsonb_build_object('requestId', v_new_id)
  );

  return jsonb_build_object('outcome', 'PENDING', 'request_id', v_new_id);
end;
$$;


-- ============================================================================
-- ⑤ 투표 — CANCEL_VOTE_AGREED (요청자에게만 · 숫자 포함)
--
-- 확정·폐기 알림은 _trip_cancel_confirm · _trip_cancel_close 가 보낸다.
-- 여기서는 "아직 모자란" 경우만 알린다.
-- ============================================================================
create or replace function public.cast_trip_cancel_vote(
  p_request_id uuid,
  p_vote       text
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_req   public.trip_cancel_requests%rowtype;
  v_trip  public.trips%rowtype;
  v_tally record;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;

  if p_vote not in ('AGREE', 'DISAGREE') then
    raise exception using errcode = '22023', message = 'INVALID_TARGET';
  end if;

  select * into v_req from public.trip_cancel_requests r where r.id = p_request_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;

  if v_req.status <> 'PENDING' then
    raise exception using errcode = '22023', message = 'REQUEST_NOT_PENDING';
  end if;

  select * into v_trip from public.trips t where t.id = v_req.trip_id;

  -- ⚠️ 여기서 요청을 닫지 않는다. 바로 아래 raise 가 트랜잭션을 되돌려서
  --    닫은 것도 같이 사라진다. 20260916000004 가 그렇게 돼 있었다 —
  --    닫는 시늉만 하고 실제로는 아무 일도 일어나지 않았다. (2026-09-16 발견)
  --    실제로 닫는 일은 조회 시점의 expire_trip_cancel_request 가 한다.
  if now() >= v_req.expires_at
     or (v_trip.start_date is not null and (now() at time zone 'utc')::date >= v_trip.start_date)
  then
    raise exception using errcode = '22023', message = 'REQUEST_EXPIRED';
  end if;

  if not exists (
    select 1 from public.trip_members tm
    where tm.trip_id = v_req.trip_id and tm.user_id = v_uid and tm.status = 'ACTIVE'
  ) then
    raise exception using errcode = '42501', message = 'NOT_MEMBER';
  end if;

  if v_uid = v_req.requested_by then
    raise exception using errcode = '42501', message = 'REQUESTER_CANNOT_VOTE';
  end if;

  begin
    insert into public.trip_cancel_votes (request_id, user_id, vote)
    values (p_request_id, v_uid, p_vote);
  exception when unique_violation then
    raise exception using errcode = '23505', message = 'ALREADY_VOTED';
  end;

  if p_vote = 'DISAGREE' then
    perform public._trip_cancel_close(v_req.id, v_req.trip_id, 'REJECTED', 'DISAGREED');
    return 'REJECTED';
  end if;

  select * into v_tally from public._trip_cancel_tally(p_request_id);

  if v_tally.agreed_count >= v_tally.target_count then
    perform public._trip_cancel_confirm(v_req.trip_id, v_req.id);
    return 'APPROVED';
  end if;

  -- 아직 모자라다. 요청자에게만 진행 상황을 알린다.
  perform public.create_notification(
    v_req.requested_by, 'CANCEL_VOTE_AGREED',
    '취소에 동의한 사람이 있어요',
    public.notification_trip_label(v_trip.destination) || ' 취소에 '
      || v_tally.target_count || '명 중 ' || v_tally.agreed_count || '명이 동의했어요.',
    v_req.trip_id,
    jsonb_build_object('requestId', v_req.id)
  );

  return 'PENDING';
end;
$$;


-- ============================================================================
-- ⑥ 폐기 — CANCEL_REJECTED · CANCEL_EXPIRED · CANCEL_WITHDRAWN(2갈래)
--
-- 반대·만료·철회가 모두 이 함수를 지난다. p_note 로 갈래를 정한다.
--
--   DISAGREED       "여행 취소가 없던 일이 됐어요"  / "{여행}은 그대로 진행돼요."
--   EXPIRED*        "취소 요청 기한이 지났어요"     / "... 여행은 그대로예요."
--   WITHDRAWN       "취소 요청이 철회됐어요"        / "... 요청한 사람이 거뒀어요."
--   REQUESTER_LEFT  "취소 요청이 사라졌어요"        / "... 나가서 요청이 사라졌어요."
--
-- ⚠️ 반대한 사람의 **이름을 넣지 않는다.** 반대한 사람을 압박하는 구조를
--    만들지 않는다는 원칙이 문구에도 걸린다. (그래서 반대 즉시 폐기한다)
--
-- ⚠️ 만료는 제외할 '본인' 이 없다. 시간이 지나서 일어난 일이고, 화면을 연
--    사람은 아무것도 하지 않았다. 전원이 받는다. (2026-09-16 다빈 결정)
-- ============================================================================
create or replace function public._trip_cancel_close(
  p_request_id uuid,
  p_trip_id    uuid,
  p_status     text,
  p_note       text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_closed    boolean := false;
  v_trip      public.trips%rowtype;
  v_name      text;
  v_actor     uuid;
  v_type      text;
  v_title     text;
  v_body      text;
begin
  update public.trip_cancel_requests r
     set status        = p_status,
         resolved_at   = now(),
         resolved_note = p_note
   where r.id = p_request_id
     and r.status = 'PENDING';
  v_closed := found;

  update public.trips t
     set status = 'PLANNING'
   where t.id = p_trip_id
     and t.status = 'CANCEL_PENDING';

  -- ⚠️ 이미 닫힌 요청을 또 닫으려 한 경우엔 알림을 보내지 않는다.
  --    만료는 화면을 열 때마다 불려서, 막지 않으면 같은 알림이 쌓인다.
  if not v_closed then
    return;
  end if;

  select * into v_trip from public.trips t where t.id = p_trip_id;
  v_name := public.notification_trip_label(v_trip.destination);

  if p_note = 'DISAGREED' then
    v_type  := 'CANCEL_REJECTED';
    v_title := '여행 취소가 없던 일이 됐어요';
    v_body  := v_name || '은 그대로 진행돼요.';
    v_actor := auth.uid();              -- 반대한 사람 제외
  elsif p_status = 'EXPIRED' then
    v_type  := 'CANCEL_EXPIRED';
    v_title := '취소 요청 기한이 지났어요';
    v_body  := v_name || ' 취소 요청이 사라졌어요. 여행은 그대로예요.';
    v_actor := null;                    -- 제외할 본인이 없다
  elsif p_note = 'REQUESTER_LEFT' then
    v_type  := 'CANCEL_WITHDRAWN';
    v_title := '취소 요청이 사라졌어요';
    v_body  := v_name || ' 취소를 요청한 사람이 나가서 요청이 사라졌어요.';
    v_actor := auth.uid();              -- 나간 사람 제외 (이미 LEFT 라 중복 방어)
  else
    v_type  := 'CANCEL_WITHDRAWN';
    v_title := '취소 요청이 철회됐어요';
    v_body  := v_name || ' 취소 요청을 요청한 사람이 거뒀어요.';
    v_actor := auth.uid();              -- 철회한 요청자 제외
  end if;

  perform public._notify_trip_members(p_trip_id, v_actor, v_type, v_title, v_body);
end;
$$;


-- ============================================================================
-- ⑦ 확정 — CANCEL_CONFIRMED
--
-- ⚠️ 마지막으로 동의한 사람은 화면에서 결과를 바로 본다. 제외한다.
-- ⚠️ 개인 여행(동의 대상 0명)은 요청자 본인만 있으므로 받는 사람이 0명이다.
--    맞는 동작이다 — 본인이 방금 취소했다.
-- ============================================================================
create or replace function public._trip_cancel_confirm(
  p_trip_id    uuid,
  p_request_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_req  public.trip_cancel_requests%rowtype;
  v_trip public.trips%rowtype;
begin
  if exists (select 1 from public.trips t where t.id = p_trip_id and t.status = 'CANCELED') then
    return;
  end if;

  select * into v_req from public.trip_cancel_requests r where r.id = p_request_id;

  update public.trips t
     set status                      = 'CANCELED',
         canceled_at                 = now(),
         canceled_by                 = v_req.requested_by,
         cancel_reason               = v_req.reason,
         canceled_fund_snapshot_json = public._trip_cancel_fund_snapshot(p_trip_id)
   where t.id = p_trip_id;

  update public.trip_cancel_requests r
     set status        = 'APPROVED',
         resolved_at   = now(),
         resolved_note = 'ALL_AGREED'
   where r.id = p_request_id
     and r.status = 'PENDING';

  select * into v_trip from public.trips t where t.id = p_trip_id;

  perform public._notify_trip_members(
    p_trip_id, auth.uid(), 'CANCEL_CONFIRMED',
    '여행이 취소됐어요',
    public.notification_trip_label(v_trip.destination)
      || '이 모두의 동의로 취소됐어요. 72시간 안에는 되돌릴 수 있어요.'
  );
end;
$$;


-- ============================================================================
-- ⑧ 되돌리기 — CANCEL_RESTORED
-- ============================================================================
create or replace function public.restore_canceled_trip(p_trip_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid  uuid := auth.uid();
  v_trip public.trips%rowtype;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;

  select * into v_trip from public.trips t where t.id = p_trip_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;

  if not exists (
    select 1 from public.trip_members tm
    where tm.trip_id = p_trip_id and tm.user_id = v_uid and tm.status = 'ACTIVE'
  ) then
    raise exception using errcode = '42501', message = 'NOT_MEMBER';
  end if;

  if v_trip.status <> 'CANCELED' then
    raise exception using errcode = '22023', message = 'NOT_CANCELED';
  end if;

  if v_trip.canceled_at is null or now() >= v_trip.canceled_at + interval '72 hours' then
    raise exception using errcode = '22023', message = 'RESTORE_WINDOW_CLOSED';
  end if;

  update public.trips t
     set status                      = 'PLANNING',
         canceled_at                 = null,
         canceled_by                 = null,
         cancel_reason               = null,
         canceled_fund_snapshot_json = null
   where t.id = p_trip_id
     and t.status = 'CANCELED';

  perform public._notify_trip_members(
    p_trip_id, v_uid, 'CANCEL_RESTORED',
    '여행을 다시 준비해요',
    public.notification_trip_label(v_trip.destination) || ' 취소를 되돌렸어요.'
  );
end;
$$;


revoke all on function public._notify_trip_members(uuid, uuid, text, text, text, jsonb, uuid)
  from public, anon, authenticated;

comment on function public._notify_trip_members(uuid, uuid, text, text, text, jsonb, uuid) is
  '여행의 ACTIVE 가입 멤버에게 같은 인앱 알림을 돌린다. p_exclude 는 행동한 본인';
