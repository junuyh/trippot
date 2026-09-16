-- ============================================================================
-- 알림센터(Notification Center) 기반 · 1차 producer 4종 (INV) — 2026-09-16
--
-- 기준 문서: docs/13_알림센터_v1.md (§2 SoT · §3-1 1차 4종 · §4 문구 · §5 data · §9 Realtime)
-- 대상: trippot-dev (pzwabphxitubsioyhgkk)
--
-- 이 파일이 하는 일
--   ① notifications.data jsonb (이동 문맥 · uuid 만 · raw token 없음)
--   ② notifications_type_check 17 → 18 (INVITE_RECEIVED 추가 · 나머지 순서 그대로)
--   ③ INVITE_RECEIVED 멱등 partial unique index (user_id, data->>'inviteId')
--   ④ 내부 helper: notification_trip_label · notification_person_label ·
--      create_notification(예외 격리) · notify_join_accepted
--   ⑤ resolve_trip_invite         + INVITE_RECEIVED producer
--   ⑥ request_trip_join           + JOIN_REQUESTED producer (새 PENDING INSERT 분기에서만)
--   ⑦ accept_trip_join_request    + JOIN_ACCEPTED producer (PENDING→ACCEPTED 두 지점)
--   ⑧ reject_trip_join_request    + JOIN_REJECTED producer
--   ⑨ resolve_trip_invite_by_id · request_trip_join_by_invite (inviteId 재진입 · token 비노출)
--   ⑩ supabase_realtime publication 에 notifications 등록 (Banner 용 INSERT 이벤트)
--
-- ⚠️ ⑤~⑧ 은 20260913000001 의 함수 본문을 **그대로 복사**하고 알림 생성 줄만 끼웠다.
--    signature · returns · error code · CASE A/B/C/D · headcount · LEFT 재참여 · 모임 전환 ·
--    leader 정책은 바뀌지 않았다. 20260913000001 파일 자체는 수정하지 않는다.
-- ⚠️ 알림 생성 실패는 create_notification 안에서만 삼킨다 (raise warning). 그 밖의
--    domain 예외(NOT_LEADER · REQUEST_NOT_PENDING …)는 전과 똑같이 밖으로 나간다.
-- ⚠️ RLS(dev_open_all) · retention cron 은 여기 없다. 각각 별도 migration.
--
-- rollback (역순 · 새 migration 으로)
--   alter publication supabase_realtime drop table public.notifications;
--   drop function public.request_trip_join_by_invite(uuid), public.resolve_trip_invite_by_id(uuid);
--   -- ⑤~⑧: 20260913000001 의 원본 4개 함수 본문을 다시 create or replace
--   drop function public.notify_join_accepted(uuid, uuid, public.trips, uuid),
--                 public.create_notification(uuid, text, text, text, uuid, jsonb),
--                 public.notification_person_label(text), public.notification_trip_label(text);
--   drop index if exists public.notifications_invite_received_uniq;
--   -- ② : INVITE_RECEIVED 행을 지운 뒤 CHECK 를 17종으로 재생성
--   alter table public.notifications drop column if exists data;
-- ============================================================================

-- ── ① data jsonb ─────────────────────────────────────────────────────────────
alter table public.notifications add column if not exists data jsonb;

-- ── ② type CHECK 17 → 18 ─────────────────────────────────────────────────────
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'FUND_GOAL_REACHED', 'TRIP_D7', 'SETTLEMENT_READY',
    'INVITE_SENT', 'INVITE_RECEIVED',
    'JOIN_REQUESTED', 'JOIN_ACCEPTED', 'JOIN_REJECTED',
    'MEMBER_JOINED', 'MEMBER_LEFT', 'OWNER_DELEGATED',
    'CANCEL_REQUESTED', 'CANCEL_VOTE_AGREED', 'CANCEL_REJECTED', 'CANCEL_EXPIRED',
    'CANCEL_WITHDRAWN', 'CANCEL_CONFIRMED', 'CANCEL_RESTORED'
  ));

-- ── ③ INVITE_RECEIVED 멱등 ────────────────────────────────────────────────────
create unique index if not exists notifications_invite_received_uniq
  on public.notifications (user_id, (data->>'inviteId'))
  where type = 'INVITE_RECEIVED';

-- ── ④ 내부 helper (앱이 직접 부르지 않는다 · EXECUTE 회수) ─────────────────────

-- "{destination} 여행" · 없으면 "이 여행". 문구 쪽에서 '여행' 을 다시 붙이지 않는다.
create or replace function public.notification_trip_label(p_destination text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when nullif(btrim(coalesce(p_destination, '')), '') is null then '이 여행'
    else btrim(p_destination) || ' 여행'
  end;
$$;

-- users.name 그대로 · 없으면 "사용자". 새 이름 필드를 만들지 않는다.
create or replace function public.notification_person_label(p_name text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select coalesce(nullif(btrim(coalesce(p_name, '')), ''), '사용자');
$$;

-- 알림 한 행. **실패해도 호출한 트랜잭션을 깨지 않는다** — 안쪽 begin/exception 블록이
-- savepoint 역할을 해서 이 INSERT 만 되돌리고 warning 으로 남긴다. domain 오류는 여기 안 온다.
-- on conflict do nothing = ③ index 에 걸리는 INVITE_RECEIVED 재열람을 조용히 넘긴다.
-- p_user_id 가 null (leader 미지정 등) 이면 아무것도 하지 않는다.
create or replace function public.create_notification(
  p_user_id uuid,
  p_type    text,
  p_title   text,
  p_body    text,
  p_trip_id uuid,
  p_data    jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_user_id is null then
    return;
  end if;
  begin
    insert into public.notifications (user_id, type, title, body, trip_id, data)
    values (p_user_id, p_type, p_title, p_body, p_trip_id, p_data)
    on conflict do nothing;
  exception when others then
    raise warning 'create_notification(%) failed: % [%]', p_type, sqlerrm, sqlstate;
  end;
end;
$$;

-- JOIN_ACCEPTED 는 accept 안 두 지점에서 같은 문구로 만든다. 한 곳에 둔다.
create or replace function public.notify_join_accepted(
  p_user_id    uuid,
  p_request_id uuid,
  p_trip       public.trips,
  p_group_id   uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.create_notification(
    p_user_id,
    'JOIN_ACCEPTED',
    '여행 참여가 승인됐어요',
    public.notification_trip_label(p_trip.destination) || ' 참여가 승인됐어요.',
    p_trip.id,
    jsonb_build_object('requestId', p_request_id, 'groupId', p_group_id)
  );
end;
$$;

revoke all on function public.notification_trip_label(text)                         from public, anon, authenticated;
revoke all on function public.notification_person_label(text)                       from public, anon, authenticated;
revoke all on function public.create_notification(uuid, text, text, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.notify_join_accepted(uuid, uuid, public.trips, uuid)    from public, anon, authenticated;

-- ── ⑤ resolve_trip_invite + INVITE_RECEIVED ──────────────────────────────────
-- (20260913000001 본문 그대로 · 마지막 return 앞에 알림 블록 하나)
create or replace function public.resolve_trip_invite(
  p_token text
)
returns table (
  invite_state        text,
  trip_id             uuid,
  destination         text,
  start_date          date,
  end_date            date,
  headcount           integer,
  active_member_count integer,
  inviter_name        text,
  my_state            text,
  my_request_id       uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid       uuid := auth.uid();
  v_inv       public.trip_invites%rowtype;
  v_trip      public.trips%rowtype;
  v_state     text;
  v_my_state  text := 'NONE';
  v_my_req    uuid;
  v_active    integer;
  v_inviter   text;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;

  select * into v_inv from public.trip_invites ti where ti.token = p_token;

  if not found then
    return query select 'NOT_FOUND'::text, null::uuid, null::text, null::date, null::date,
                        null::integer, null::integer, null::text, 'NONE'::text, null::uuid;
    return;
  end if;

  select * into v_trip from public.trips t where t.id = v_inv.trip_id;

  if v_inv.revoked_at is not null then
    v_state := 'REVOKED';
  elsif v_inv.expires_at <= now() then
    v_state := 'EXPIRED';
  else
    v_state := 'VALID';
  end if;

  select count(distinct tm.user_id)::integer into v_active
  from public.trip_members tm
  where tm.trip_id = v_trip.id and tm.status = 'ACTIVE' and tm.user_id is not null;

  select u.name into v_inviter from public.users u where u.id = v_inv.created_by;

  -- my_state — 위에서부터 첫 일치 (docs/12 §3)
  if exists (
    select 1 from public.trip_members tm
    where tm.trip_id = v_trip.id and tm.user_id = v_uid and tm.status = 'ACTIVE'
  ) then
    v_my_state := 'ACTIVE';
  else
    select r.id into v_my_req
    from public.trip_join_requests r
    where r.trip_id = v_trip.id and r.user_id = v_uid and r.status = 'PENDING'
    limit 1;

    if v_my_req is not null then
      v_my_state := 'PENDING';
    elsif exists (
      select 1 from public.trip_join_requests r
      where r.invite_id = v_inv.id and r.user_id = v_uid and r.status = 'REJECTED'
    ) then
      v_my_state := 'REJECTED';
    elsif exists (
      select 1 from public.trip_members tm
      where tm.trip_id = v_trip.id and tm.user_id = v_uid and tm.status = 'LEFT'
    ) then
      v_my_state := 'LEFT';
    end if;
  end if;

  -- ── [13_알림센터 §3-1] INVITE_RECEIVED — 수신자로 식별된 첫 순간 1회 ─────────
  --   VALID 링크 · 아직 멤버/요청/거절 상태가 아닌 사람(NONE · LEFT) · 발급자 본인 제외.
  --   (user_id, data->>'inviteId') partial unique index + on conflict 로 재열람해도 1행.
  --   실패해도 조회 결과에는 영향 없다 (create_notification 이 격리한다).
  if v_state = 'VALID' and v_my_state in ('NONE', 'LEFT') and v_uid <> v_inv.created_by then
    perform public.create_notification(
      v_uid,
      'INVITE_RECEIVED',
      '여행 초대를 받았어요',
      public.notification_person_label(v_inviter) || '님이 '
        || public.notification_trip_label(v_trip.destination) || '에 초대했어요.',
      v_trip.id,
      jsonb_build_object('inviteId', v_inv.id, 'inviterUserId', v_inv.created_by)
    );
  end if;

  return query select
    v_state,
    v_trip.id,
    v_trip.destination,
    v_trip.start_date,
    v_trip.end_date,
    v_trip.headcount,
    v_active,
    v_inviter,
    v_my_state,
    v_my_req;
end;
$$;

-- ── ⑥ request_trip_join + JOIN_REQUESTED ─────────────────────────────────────
-- (본문 그대로 · v_inserted 플래그 · 새 INSERT 뒤에만 알림)
create or replace function public.request_trip_join(
  p_token text
)
returns table (
  request_id uuid,
  trip_id    uuid,
  status     text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid  uuid := auth.uid();
  v_inv  public.trip_invites%rowtype;
  v_req  public.trip_join_requests%rowtype;
  -- [13_알림센터] 새 PENDING 행을 실제로 넣었을 때만 true. 멱등 반환·unique_violation 분기는 false.
  v_inserted boolean := false;
  v_trip     public.trips%rowtype;
  v_actor    text;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;

  select * into v_inv from public.trip_invites ti where ti.token = p_token;
  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;

  if v_inv.revoked_at is not null or v_inv.expires_at <= now() then
    raise exception using errcode = '22023', message = 'INVITE_NOT_VALID';
  end if;

  if exists (
    select 1 from public.trip_members tm
    where tm.trip_id = v_inv.trip_id and tm.user_id = v_uid and tm.status = 'ACTIVE'
  ) then
    raise exception using errcode = '23505', message = 'ALREADY_MEMBER';
  end if;

  -- REJECTED 는 (invite_id, user_id) 단위다. 다른 사람·새 invite 에는 영향 없다.
  if exists (
    select 1 from public.trip_join_requests r
    where r.invite_id = v_inv.id and r.user_id = v_uid and r.status = 'REJECTED'
  ) then
    raise exception using errcode = 'P0005', message = 'REJECTED_FOR_INVITE';
  end if;

  -- 이미 PENDING 이면 그 행을 돌려준다 (멱등)
  select * into v_req
  from public.trip_join_requests r
  where r.trip_id = v_inv.trip_id and r.user_id = v_uid and r.status = 'PENDING'
  limit 1;

  if found then
    return query select v_req.id, v_req.trip_id, v_req.status;
    return;
  end if;

  begin
    insert into public.trip_join_requests (trip_id, invite_id, user_id, status)
    values (v_inv.trip_id, v_inv.id, v_uid, 'PENDING')
    returning * into v_req;
    v_inserted := true;
  exception when unique_violation then
    -- 같은 순간 두 번 눌렀다. unique partial index 가 막았다. 이미 들어간 행을 돌려준다.
    select * into v_req
    from public.trip_join_requests r
    where r.trip_id = v_inv.trip_id and r.user_id = v_uid and r.status = 'PENDING'
    limit 1;
  end;

  -- ── [13_알림센터 §3-1] JOIN_REQUESTED → 여행장. 새 행이 들어간 경우에만 1회 ──
  if v_inserted then
    select * into v_trip from public.trips t where t.id = v_inv.trip_id;
    select u.name into v_actor from public.users u where u.id = v_uid;
    perform public.create_notification(
      v_trip.leader_user_id,            -- null 이면 helper 가 아무것도 하지 않는다
      'JOIN_REQUESTED',
      '여행 참여 요청이 도착했어요',
      public.notification_person_label(v_actor) || '님이 '
        || public.notification_trip_label(v_trip.destination) || ' 참여를 요청했어요.',
      v_inv.trip_id,
      jsonb_build_object('requestId', v_req.id, 'inviteId', v_inv.id, 'actorUserId', v_uid)
    );
  end if;

  return query select v_req.id, v_req.trip_id, v_req.status;
end;
$$;

-- ── ⑦ accept_trip_join_request + JOIN_ACCEPTED ───────────────────────────────
-- (본문 그대로 · PENDING→ACCEPTED 로 바꾸는 두 지점 각각 뒤에 notify_join_accepted)
create or replace function public.accept_trip_join_request(
  p_request_id     uuid,
  p_new_group_name text default null
)
returns table (
  request_id    uuid,
  trip_id       uuid,
  group_id      uuid,
  resolved_case text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid         uuid := auth.uid();
  v_req         public.trip_join_requests%rowtype;
  v_trip        public.trips%rowtype;
  v_active      integer;
  v_in_group    boolean := false;
  v_other       integer := 0;
  v_case        text;
  v_name        text := nullif(btrim(coalesce(p_new_group_name, '')), '');
  v_new_group   uuid;
  v_final_group uuid;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;

  -- ── 락: 요청 → 여행 (항상 이 순서. 교착 방지) ─────────────────────────────
  select * into v_req from public.trip_join_requests r where r.id = p_request_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;

  select * into v_trip from public.trips t where t.id = v_req.trip_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;

  -- ── 락 안에서 전부 다시 검사 ────────────────────────────────────────────
  if v_trip.leader_user_id is null then
    raise exception using errcode = 'P0004', message = 'LEADER_NOT_CONFIGURED';
  end if;
  if v_trip.leader_user_id <> v_uid then
    raise exception using errcode = '42501', message = 'NOT_LEADER';
  end if;
  if v_req.status <> 'PENDING' then
    raise exception using errcode = '22023', message = 'REQUEST_NOT_PENDING';
  end if;
  if v_trip.status in ('DELETED', 'CANCELED') then
    raise exception using errcode = '22023', message = 'TRIP_NOT_OPEN';
  end if;

  -- 이미 ACTIVE 면 요청만 닫는다 (멱등)
  if exists (
    select 1 from public.trip_members tm
    where tm.trip_id = v_trip.id and tm.user_id = v_req.user_id and tm.status = 'ACTIVE'
  ) then
    update public.trip_join_requests
       set status = 'ACCEPTED', decided_at = now(), decided_by = v_uid
     where id = p_request_id;
    -- [13_알림센터 §3-1] JOIN_ACCEPTED → 요청자 (CASE A). REQUEST_NOT_PENDING 검사 뒤라 1회.
    perform public.notify_join_accepted(v_req.user_id, p_request_id, v_trip, v_trip.group_id);
    return query select p_request_id, v_trip.id, v_trip.group_id, 'A'::text;
    return;
  end if;

  -- headcount 재검사. 찼으면 실패하되 요청은 PENDING 그대로 (자동 거절 없음 · token 무변경)
  select count(distinct tm.user_id)::integer into v_active
  from public.trip_members tm
  where tm.trip_id = v_trip.id and tm.status = 'ACTIVE' and tm.user_id is not null;

  if v_active >= v_trip.headcount then
    raise exception using errcode = 'P0003', message = 'HEADCOUNT_REACHED';
  end if;

  -- ── CASE 판정 ─────────────────────────────────────────────────────────
  if v_trip.owner_type = 'PERSONAL' then
    v_case := 'D';
  else
    v_in_group := exists (
      select 1 from public.group_members gm
      where gm.group_id = v_trip.group_id and gm.user_id = v_req.user_id and gm.status = 'ACTIVE'
    );

    select count(*)::integer into v_other
    from public.trips t2
    where t2.group_id = v_trip.group_id
      and t2.id <> v_trip.id
      and t2.status not in ('DELETED', 'CANCELED');

    if v_in_group then
      v_case := 'A';
    elsif v_other = 0 then
      v_case := 'B';
    else
      v_case := 'C';
    end if;
  end if;

  -- C · D 는 이름이 필요하다. 없으면 **아무것도 쓰지 않고** 끝낸다.
  if v_case in ('C', 'D') and v_name is null then
    raise exception using errcode = '22023', message = 'NEW_GROUP_NAME_REQUIRED';
  end if;

  -- ── CASE 별 쓰기 ───────────────────────────────────────────────────────
  if v_case = 'A' then
    v_final_group := v_trip.group_id;

  elsif v_case = 'B' then
    perform public.activate_group_member(v_trip.group_id, v_req.user_id);
    v_final_group := v_trip.group_id;

  elsif v_case = 'C' then
    insert into public.groups (name, owner_user_id, status)
    values (v_name, v_trip.leader_user_id, 'ACTIVE')
    returning id into v_new_group;

    -- 새 모임 멤버 = target 여행의 현재 ACTIVE 참여자 (distinct · user_id not null)
    insert into public.group_members (group_id, user_id, role, status, joined_at)
    select v_new_group, tm.user_id, 'MEMBER', 'ACTIVE', now()
    from (
      select distinct tm.user_id
      from public.trip_members tm
      where tm.trip_id = v_trip.id and tm.status = 'ACTIVE' and tm.user_id is not null
    ) tm
    on conflict (group_id, user_id) do nothing;

    -- + 요청자
    perform public.activate_group_member(v_new_group, v_req.user_id);

    -- target 여행만 옮긴다. 기존 모임의 다른 여행·멤버는 그대로.
    update public.trips
       set group_id = v_new_group, updated_at = now()
     where id = v_trip.id;

    v_final_group := v_new_group;

  else -- 'D'
    insert into public.groups (name, owner_user_id, status)
    values (v_name, v_trip.leader_user_id, 'ACTIVE')
    returning id into v_new_group;

    insert into public.group_members (group_id, user_id, role, status, joined_at)
    select v_new_group, tm.user_id, 'MEMBER', 'ACTIVE', now()
    from (
      select distinct tm.user_id
      from public.trip_members tm
      where tm.trip_id = v_trip.id and tm.status = 'ACTIVE' and tm.user_id is not null
    ) tm
    on conflict (group_id, user_id) do nothing;

    perform public.activate_group_member(v_new_group, v_req.user_id);

    -- PERSONAL → GROUP. 세 칸을 한 번에 바꿔 trips_owner_shape 를 통과한다. 같은 행이다.
    update public.trips
       set owner_type = 'GROUP', owner_user_id = null, group_id = v_new_group, updated_at = now()
     where id = v_trip.id;

    v_final_group := v_new_group;
  end if;

  -- ── 공통 마무리 ────────────────────────────────────────────────────────
  perform public.activate_trip_member(v_trip.id, v_req.user_id);

  update public.trip_join_requests
     set status = 'ACCEPTED', decided_at = now(), decided_by = v_uid
   where id = p_request_id;

  -- [13_알림센터 §3-1] JOIN_ACCEPTED → 요청자 (CASE B/C/D 공통 마무리). 1회.
  perform public.notify_join_accepted(v_req.user_id, p_request_id, v_trip, v_final_group);

  return query select p_request_id, v_trip.id, v_final_group, v_case;
end;
$$;

-- ── ⑧ reject_trip_join_request + JOIN_REJECTED ───────────────────────────────
-- (본문 그대로 · UPDATE 뒤에 알림)
create or replace function public.reject_trip_join_request(
  p_request_id uuid
)
returns table (
  request_id uuid,
  status     text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid  uuid := auth.uid();
  v_req  public.trip_join_requests%rowtype;
  v_trip public.trips%rowtype;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;

  select * into v_req from public.trip_join_requests r where r.id = p_request_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;

  select * into v_trip from public.trips t where t.id = v_req.trip_id;
  if v_trip.leader_user_id is null then
    raise exception using errcode = 'P0004', message = 'LEADER_NOT_CONFIGURED';
  end if;
  if v_trip.leader_user_id <> v_uid then
    raise exception using errcode = '42501', message = 'NOT_LEADER';
  end if;
  if v_req.status <> 'PENDING' then
    raise exception using errcode = '22023', message = 'REQUEST_NOT_PENDING';
  end if;

  -- token · membership · 모임 · pending_group_name 은 건드리지 않는다. 사유도 받지 않는다.
  update public.trip_join_requests
     set status = 'REJECTED', decided_at = now(), decided_by = v_uid
   where id = p_request_id;

  -- ── [13_알림센터 §3-1] JOIN_REJECTED → 요청자. PENDING→REJECTED 전이 직후 1회 ──
  --   거절 사유는 받지도 싣지도 않는다. (POL-INV-051)
  perform public.create_notification(
    v_req.user_id,
    'JOIN_REJECTED',
    '여행 참여 요청이 거절됐어요',
    public.notification_trip_label(v_trip.destination) || ' 참여 요청이 거절됐어요.',
    v_trip.id,
    jsonb_build_object('requestId', p_request_id)
  );

  return query select p_request_id, 'REJECTED'::text;
end;
$$;
-- ── ⑨ inviteId 재진입 (docs/13 §5) ───────────────────────────────────────────
-- 알림 상세 → "여행 초대 확인하기". 클라이언트는 inviteId(uuid) 만 안다. token 은 여기 안에서만
-- 꺼내 기존 함수에 넘기고 **밖으로 내려가지 않는다.**
-- 응답 조건(하나라도): 그 invite 의 INVITE_RECEIVED 알림을 가진 사람 · 그 invite 로 요청한 적
-- 있는 사람 · 그 여행의 ACTIVE 멤버. 아니면 NOT_FOUND 행 / NOT_FOUND 예외 (token 을 모르는
-- 사람이 uuid 만으로 초대를 훔쳐볼 수 없다).
create or replace function public.notification_invite_access(p_invite_id uuid, p_uid uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.notifications n
    where n.user_id = p_uid and n.type = 'INVITE_RECEIVED' and n.data->>'inviteId' = p_invite_id::text
  ) or exists (
    select 1 from public.trip_join_requests r
    where r.user_id = p_uid and r.invite_id = p_invite_id
  ) or exists (
    select 1 from public.trip_invites ti
    join public.trip_members tm on tm.trip_id = ti.trip_id
    where ti.id = p_invite_id and tm.user_id = p_uid and tm.status = 'ACTIVE'
  );
$$;
revoke all on function public.notification_invite_access(uuid, uuid) from public, anon, authenticated;

create or replace function public.resolve_trip_invite_by_id(
  p_invite_id uuid
)
returns table (
  invite_state        text,
  trip_id             uuid,
  destination         text,
  start_date          date,
  end_date            date,
  headcount           integer,
  active_member_count integer,
  inviter_name        text,
  my_state            text,
  my_request_id       uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_token text;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;

  select ti.token into v_token from public.trip_invites ti where ti.id = p_invite_id;

  if v_token is null or not public.notification_invite_access(p_invite_id, v_uid) then
    return query select 'NOT_FOUND'::text, null::uuid, null::text, null::date, null::date,
                        null::integer, null::integer, null::text, 'NONE'::text, null::uuid;
    return;
  end if;

  return query select * from public.resolve_trip_invite(v_token);
end;
$$;

create or replace function public.request_trip_join_by_invite(
  p_invite_id uuid
)
returns table (
  request_id uuid,
  trip_id    uuid,
  status     text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_token text;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;

  select ti.token into v_token from public.trip_invites ti where ti.id = p_invite_id;

  if v_token is null or not public.notification_invite_access(p_invite_id, v_uid) then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;

  return query select * from public.request_trip_join(v_token);
end;
$$;

revoke all on function public.resolve_trip_invite_by_id(uuid)   from public, anon;
revoke all on function public.request_trip_join_by_invite(uuid) from public, anon;
grant execute on function public.resolve_trip_invite_by_id(uuid)   to authenticated;
grant execute on function public.request_trip_join_by_invite(uuid) to authenticated;

-- ── ⑩ Realtime publication (docs/13 §8) ─────────────────────────────────────
-- 현재 supabase_realtime 에 등록된 표가 없다. notifications INSERT 를 앱이 구독해 Banner 를
-- 띄운다. RLS 가 그대로 적용되므로 hardening 뒤에도 본인 행만 온다. 두 번 실행해도 안전.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;
