-- ============================================================================
-- accept_trip_join_request · delegate_trip_leader — 20260923000001 유실분 복구 · 2026-09-23
--
-- 증상: 여행장이 **새 모임 이름을 지어 수락**(CASE C · D)하면 앱에 "수락하지 못했어요".
--       서버는 42702 `column reference "group_id" is ambiguous` 로 트랜잭션 전체 롤백.
-- 원인: 20260923000001(회원탈퇴 v2)이 두 함수를 **20260916000001 본문 기준**으로 다시 써서
--       그 사이의 20260916000003(conflict target 수정)과 20260917000003(호출자 계정 guard)이
--       함께 지워졌다.
--
-- 이 파일은 **현재 배포 중인 본문(pg_get_functiondef)에 아래 최소 delta만** 적용한다.
--   ① accept_trip_join_request · delegate_trip_leader
--      AUTH_REQUIRED 직후 is_account_active() / ACCOUNT_NOT_ACTIVE guard 복구 (각 1곳)
--   ② accept_trip_join_request CASE C · D 의 group_members INSERT 2곳
--      `on conflict (group_id, user_id)` → `on conflict on constraint group_members_group_id_user_id_key`
--      (OUT 변수 group_id 와 표 컬럼이 충돌해 42702 가 난다. 20260916000003 과 같은 수정)
--
-- 유지: SECURITY DEFINER · search_path · 반환형 · auth.uid() 권한검사 · CASE A/B/C/D 분기 ·
--       v2 가드(REQUESTER_NOT_ACTIVE · TARGET_NOT_ACTIVE) · 알림 producer · 트랜잭션 원자성
-- 스키마 · 표 · 데이터 변경 없음. DELETE 없음.
--
-- rollback (보고용 · 새 migration 으로만): 20260923000001 의 두 함수 정의를 다시 실행한다.
--                                        (= 이 수정 이전 상태. 42702 가 다시 난다)
-- ============================================================================

-- ── accept_trip_join_request ──
CREATE OR REPLACE FUNCTION public.accept_trip_join_request(p_request_id uuid, p_new_group_name text DEFAULT NULL::text)
 RETURNS TABLE(request_id uuid, trip_id uuid, group_id uuid, resolved_case text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
  -- 탈퇴 대기(PENDING_WITHDRAWAL) · 탈퇴 완료 계정은 여행 권한 변경을 할 수 없다.
  -- (2026-09-17 · 20260917000003 정책 · 20260923000001 재작성 때 유실 → 복구)
  if not public.is_account_active() then
    raise exception using errcode = '42501', message = 'ACCOUNT_NOT_ACTIVE';
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
    on conflict on constraint group_members_group_id_user_id_key do nothing;

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
    on conflict on constraint group_members_group_id_user_id_key do nothing;

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
$function$
;

-- ── delegate_trip_leader ──
CREATE OR REPLACE FUNCTION public.delegate_trip_leader(p_trip_id uuid, p_to_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid       uuid := auth.uid();
  v_trip      public.trips%rowtype;
  v_trip_name text;
  v_new_name  text;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;
  -- 탈퇴 대기(PENDING_WITHDRAWAL) · 탈퇴 완료 계정은 여행 권한 변경을 할 수 없다.
  -- (2026-09-17 · 20260917000003 정책 · 20260923000001 재작성 때 유실 → 복구)
  if not public.is_account_active() then
    raise exception using errcode = '42501', message = 'ACCOUNT_NOT_ACTIVE';
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
$function$
;
