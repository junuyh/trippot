-- ============================================================================
-- 회원탈퇴 정책 v2 — 유예 계정의 협업 정합성 (2026-09-23 · docs/15_회원탈퇴정책_v2.md)
--
-- ⚠️ 이 migration 은 **함수와 view 만 바꾼다. 데이터 DELETE 가 없다.**
--    최종 탈퇴 시 개인성 여행 정리(데이터 삭제)는 별도 migration 으로 분리했다.
--
-- 고치는 것
--   ① cancel_withdrawal        30일 경계를 **서버가** 판정 (WITHDRAWAL_WINDOW_CLOSED)
--   ② request_withdrawal       신청 순간 본인의 PENDING 참여 의사를 CANCELED
--   ③ _trip_cancel_tally       취소 투표 **분모**에서 행동 불가 계정 제외 (자리=headcount 는 유지)
--   ④ delegate_trip_leader     대상이 행동 불가면 위임 금지 (TARGET_NOT_ACTIVE)
--   ⑤ accept_trip_join_request 요청자가 행동 불가면 수락 금지 (REQUESTER_NOT_ACTIVE)
--   ⑥ add_group_members_to_trip 자동 합류 대상에서 탈퇴 유예 계정 제외
--   ⑦ user_public_profiles     최종 탈퇴자를 '탈퇴한 회원' tombstone 으로 포함 +
--                              is_collaboration_available(파생 boolean) 추가
--
-- 바꾸지 않는 것
--   · 여행 취소(72시간) 도메인 — 다른 담당자 영역. tally 의 분모 한 줄 외에는 손대지 않는다.
--   · headcount · active_member_count · 기존 금액 · 정산 · 커뮤니티 익명 정책
--   · withdrawal_requested_at 은 **어떤 view 에도 노출하지 않는다.** (파생 boolean 만)
--
-- 되돌리기
--   각 함수는 아래 원본 migration 을 다시 실행하면 복구된다.
--     cancel_withdrawal · request_withdrawal        20260917000001
--     _trip_cancel_tally                            20260916000004
--     delegate_trip_leader                          20260916000009
--     accept_trip_join_request                      20260916000001
--     add_group_members_to_trip                     20260921000013
--   view 는 20260922000001 의 정의를 다시 실행한다.
-- ============================================================================

create or replace function public.cancel_withdrawal()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_user public.users%rowtype;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;

  select * into v_user from public.users u where u.id = v_uid;
  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;
  if v_user.deleted_at is not null then
    raise exception using errcode = 'P0003', message = 'ALREADY_WITHDRAWN';
  end if;

  -- (v2) 신청이 없으면 할 일이 없다. 멱등.
  if v_user.withdrawal_requested_at is null then
    return;
  end if;

  -- (v2) 30일 경계는 **서버가 판정한다.** cron 이 아직 돌지 않았어도 30일에 도달하면 취소할 수 없다.
  --      now() < 신청 + 30일  → 취소 가능 / now() >= 신청 + 30일 → WITHDRAWAL_WINDOW_CLOSED
  if now() >= v_user.withdrawal_requested_at + interval '30 days' then
    raise exception using errcode = '22023', message = 'WITHDRAWAL_WINDOW_CLOSED';
  end if;

  update public.users set withdrawal_requested_at = null where id = v_uid;
end;
$$;


create or replace function public.request_withdrawal()
returns table (withdrawal_effective_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_user public.users%rowtype;
  v_now  timestamptz := now();
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;

  select * into v_user from public.users u where u.id = v_uid;
  if not found or v_user.deleted_at is not null then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;

  -- 여행장 방어: 다른 ACTIVE 멤버가 있는 진행 중(PLANNING · TRAVELING) 여행의 여행장이면 위임이 먼저다.
  -- 혼자뿐인 여행(개인 여행 · 남은 멤버 없음)과 끝난 여행은 막지 않는다.
  if exists (
    select 1
    from public.trips t
    where t.leader_user_id = v_uid
      and t.status in ('PLANNING', 'TRAVELING')
      and exists (
        select 1 from public.trip_members tm
        where tm.trip_id = t.id and tm.status = 'ACTIVE' and tm.user_id <> v_uid
      )
  ) then
    raise exception using errcode = 'P0003', message = 'LEADER_MUST_DELEGATE';
  end if;

  -- (v2) 아직 답을 받지 못한 내 참여 의사는 신청 순간 거둔다. 30일 동안 남겨 두면 여행장이
  --      "행동할 수 없는 사람" 을 수락하게 된다. 탈퇴를 취소하면 새 링크로 다시 보내면 된다.
  update public.trip_join_requests
     set status = 'CANCELED', decided_at = v_now
   where user_id = v_uid and status = 'PENDING';

  if v_user.withdrawal_requested_at is null then
    update public.users set withdrawal_requested_at = v_now where id = v_uid;
    return query select v_now + interval '30 days';
  else
    return query select v_user.withdrawal_requested_at + interval '30 days';
  end if;
end;
$$;


create or replace function public._trip_cancel_tally(
  p_request_id uuid,
  out target_count  integer,
  out agreed_count  integer,
  out has_disagree  boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_req public.trip_cancel_requests%rowtype;
begin
  select * into v_req from public.trip_cancel_requests r where r.id = p_request_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;

  -- (v2) 분모에서 **지금 행동할 수 없는 계정**(탈퇴 유예 · 탈퇴 완료)을 뺀다. 그 사람은 투표 RPC 가
  --      막혀 있어 영원히 동의할 수 없고, 분모에 남기면 전원 동의가 구조적으로 불가능해진다.
  --      ⚠️ 자리(headcount)는 빼지 않는다. 탈퇴를 취소하면 그대로 돌아오기 때문이다. 분모만이다.
  select count(distinct tm.user_id)::integer into target_count
  from public.trip_members tm
  join public.users u
    on u.id = tm.user_id
   and u.deleted_at is null
   and u.withdrawal_requested_at is null
  where tm.trip_id = v_req.trip_id
    and tm.status = 'ACTIVE'
    and tm.user_id is not null
    and tm.user_id <> v_req.requested_by;

  select
    (count(distinct v.user_id) filter (where v.vote = 'AGREE'))::integer,
    bool_or(v.vote = 'DISAGREE')
  into agreed_count, has_disagree
  from public.trip_cancel_votes v
  where v.request_id = p_request_id
    and v.user_id <> v_req.requested_by
    and exists (
      select 1 from public.trip_members tm
      where tm.trip_id = v_req.trip_id
        and tm.user_id = v.user_id
        and tm.status = 'ACTIVE'
    );

  agreed_count := coalesce(agreed_count, 0);
  has_disagree := coalesce(has_disagree, false);
end;
$$;


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

  -- (v2) 탈퇴 유예 · 탈퇴 완료 계정은 여행장이 될 수 없다. 행동할 수 없는 여행장이 생기면
  --      그 여행의 수락 · 취소 · 위임이 전부 멈춘다.
  if not exists (
    select 1 from public.users u
    where u.id = p_to_user_id and u.deleted_at is null and u.withdrawal_requested_at is null
  ) then
    raise exception using errcode = '22023', message = 'TARGET_NOT_ACTIVE';
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
  -- (v2) 요청자가 그 사이 탈퇴를 신청했거나 탈퇴했으면 새 멤버로 만들지 않는다.
  --      기존 관계는 그대로 두되 **새 공동 관계는 만들지 않는다** 가 정책이다.
  if not exists (
    select 1 from public.users u
    where u.id = v_req.user_id and u.deleted_at is null and u.withdrawal_requested_at is null
  ) then
    raise exception using errcode = '22023', message = 'REQUESTER_NOT_ACTIVE';
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


create or replace function public.add_group_members_to_trip(p_trip_id uuid)
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_user_id     uuid := auth.uid();
  v_trip        public.trips%rowtype;
  v_candidates  uuid[];
  v_uid         uuid;
  v_total       integer;
  v_group_label text;
  v_body        text;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  if not public.is_account_active() then
    raise exception using errcode = '42501', message = 'ACCOUNT_NOT_ACTIVE';
  end if;

  -- 같은 여행에 동시에 들어오는 것을 직렬화한다. headcount 를 읽고 고치기 때문이다.
  select * into v_trip from public.trips t where t.id = p_trip_id for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Trip not found';
  end if;

  if v_trip.status in ('DELETED', 'CANCELED') then
    raise exception using errcode = '22023', message = 'TRIP_NOT_OPEN';
  end if;

  -- 여행을 만든 사람만 부를 수 있다. 자동 합류는 생성 직후 1회를 위한 것이라
  -- 아무 멤버나 남을 끌어들이는 문이 되면 안 된다. (초대는 기존 경로가 있다)
  if v_trip.leader_user_id is distinct from v_user_id then
    raise exception using errcode = '42501', message = 'NOT_TRIP_LEADER';
  end if;

  -- 모임 여행이 아니면 할 일이 없다. 개인 여행에 남을 넣지 않는다.
  if v_trip.owner_type <> 'GROUP' or v_trip.group_id is null then
    return 0;
  end if;

  -- 부르는 사람이 그 모임 사람이어야 한다.
  -- 남의 모임 멤버를 자기 여행으로 끌어오는 것을 막는다.
  if not exists (
    select 1 from public.group_members gm
    where gm.group_id = v_trip.group_id
      and gm.user_id = v_user_id
      and gm.status = 'ACTIVE'
  ) then
    raise exception using errcode = '42501', message = 'NOT_GROUP_MEMBER';
  end if;

  -- 넣을 사람 = 모임의 ACTIVE 멤버 중 이 여행에 **행이 하나도 없는** 사람. 생성자 제외.
  -- 탈퇴 계정은 뺀다. (lib/supabase/queries/groups.ts getGroupMembers 와 같은 기준)
  -- ⚠️ ACTIVE · LEFT · INVITED 어느 행이든 있으면 후보가 아니다. 나간 사람을 자동 합류로
  --    되돌리지 않는다 — 재참여는 초대 → 참여 의사 → 수락 경로뿐이다. (2026-09-21 확정)
  select array_agg(distinct gm.user_id) into v_candidates
  from public.group_members gm
  join public.users u on u.id = gm.user_id and u.deleted_at is null
                                          and u.withdrawal_requested_at is null   -- (v2) 탈퇴 유예 계정은 새 여행에 넣지 않는다
  where gm.group_id = v_trip.group_id
    and gm.status = 'ACTIVE'
    and gm.user_id <> v_user_id
    and not exists (
      select 1 from public.trip_members tm
      where tm.trip_id = p_trip_id
        and tm.user_id = gm.user_id
    );

  if v_candidates is null or cardinality(v_candidates) = 0 then
    return 0;
  end if;

  -- 정원을 먼저 맞춘다. 넣고 나서 올리면 그 사이 들어온 수락 요청이
  -- HEADCOUNT_REACHED 로 튕긴다.
  select count(distinct tm.user_id) into v_total
  from public.trip_members tm
  where tm.trip_id = p_trip_id and tm.status = 'ACTIVE' and tm.user_id is not null;

  v_total := v_total + cardinality(v_candidates);

  if v_total > v_trip.headcount then
    update public.trips set headcount = v_total, updated_at = now()
     where id = p_trip_id;
  end if;

  -- 알림 문구는 루프 밖에서 한 번만 만든다. 모임명도 한 번만 읽는다. (N+1 금지)
  select coalesce(nullif(btrim(g.name), ''), '모임') into v_group_label
  from public.groups g where g.id = v_trip.group_id;
  v_group_label := coalesce(v_group_label, '모임');

  v_body := v_group_label || '의 ' || public.notification_trip_label(v_trip.destination)
            || '에 함께하게 됐어요.';
  if v_trip.start_date is not null and v_trip.end_date is not null then
    v_body := v_body || ' ' || to_char(v_trip.start_date, 'FMMM"월" FMDD"일"') || '부터 '
              || to_char(v_trip.end_date, 'FMMM"월" FMDD"일"') || '까지예요.';
  end if;

  -- 후보는 행이 없는 사람뿐이라 activate_trip_member 는 항상 새 행을 insert 한다.
  -- (되살리는 분기는 타지 않는다 · 20260913000001 ①)
  -- 넣은 직후 그 사람에게 알린다. create_notification 은 실패해도 이 트랜잭션을 깨지 않고,
  -- ② index 덕에 같은 여행 · 같은 사람에게는 한 번만 남는다.
  foreach v_uid in array v_candidates loop
    perform public.activate_trip_member(p_trip_id, v_uid);
    if v_uid <> v_user_id then   -- 생성자 이중 안전장치
      perform public.create_notification(
        v_uid,
        'TRIP_AUTO_JOINED',
        '새 여행에 함께하게 됐어요',
        v_body,
        p_trip_id,
        jsonb_build_object('groupId', v_trip.group_id, 'actorUserId', v_user_id)
      );
    end if;
  end loop;

  return cardinality(v_candidates);
end;
$function$;


-- ⑦ 공개 프로필 view — 최종 탈퇴자 tombstone + 협업 가능 여부(파생) -------------
--
-- 왜 바꾸나
--   지금은 deleted_at 인 행을 통째로 빼서, 과거 공동 기록의 이름이 '이름 없음' 으로 보이거나
--   (여행 멤버) 목록에서 행이 사라진다(모임 멤버). 확정 정책은 **'탈퇴한 회원'** 이다.
--
-- 무엇을 더 여나
--   · 탈퇴자: name = '탈퇴한 회원', profile_image_url = null 로만 보인다. 원래 이름 · 사진은
--     finalize 가 이미 지웠고, 여기서도 하드코딩 문구로 한 번 더 덮는다.
--   · is_collaboration_available: 지금 행동할 수 있는 계정인가(파생 boolean).
--     ⚠️ withdrawal_requested_at(시각) 은 내보내지 않는다. 탈퇴 사유 · 신청일 · 예정일은 본인만 안다.
create or replace view public.user_public_profiles
  with (security_barrier = true)
as
  select
    u.id,
    case when u.deleted_at is null then u.name else '탈퇴한 회원' end as name,
    case when u.deleted_at is null then u.profile_image_url else null end as profile_image_url,
    (u.deleted_at is null and u.withdrawal_requested_at is null) as is_collaboration_available
  from public.users u;

alter view public.user_public_profiles owner to postgres;

comment on view public.user_public_profiles is
  '다른 사용자에게 보여도 되는 최소 프로필. 최종 탈퇴자는 이름이 ''탈퇴한 회원'' 으로만 보이고 사진은 없다. is_collaboration_available 은 지금 협업할 수 있는지에 대한 파생값이며, 탈퇴 신청 시각은 어떤 경우에도 내보내지 않는다. (v2 · 2026-09-23)';

revoke all on public.user_public_profiles from public, anon;
grant select on public.user_public_profiles to authenticated;
