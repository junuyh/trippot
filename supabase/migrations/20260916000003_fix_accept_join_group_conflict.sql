-- ============================================================================
-- accept_trip_join_request — CASE C/D 의 ON CONFLICT 모호성 수정 · 2026-09-16
--
-- 증상: 여행장이 새 모임 이름으로 수락(CASE C/D)하면 42702
--       `column reference "group_id" is ambiguous` 로 트랜잭션 전체가 롤백된다.
-- 원인: 함수가 returns table(request_id, trip_id, group_id, resolved_case) 라 PL/pgSQL 에
--       OUT 변수 group_id 가 있고, 인라인 INSERT 의 `on conflict (group_id, user_id)` 컬럼
--       추론 목록이 변수 치환 대상이라 표 컬럼과 충돌한다. (20260913000001 원본부터 있던 결함 ·
--       CASE A/B 는 이 구문을 쓰지 않아 지금까지 드러나지 않았다)
-- 수정: CASE C · D 의 두 줄만 `on conflict on constraint group_members_group_id_user_id_key`
--       (public.group_members UNIQUE (group_id, user_id) 제약 · remote 에서 확인) 로 바꾼다.
--       그 밖의 본문 · signature · returns · SECURITY DEFINER · search_path · 알림 producer
--       (notify_join_accepted · 20260916000001) 는 **현재 remote 정의 그대로**다.
--
-- ⚠️ 본문은 20260916000001 적용 이후의 remote 정의(pg_get_functiondef)를 기준으로 했다.
--    20260913000001 원본을 복사하지 않았다.
--
-- rollback (보고용 · 새 migration 으로만): 이 파일과 같은 본문에서 두 줄을
--   `on conflict (group_id, user_id) do nothing;` 으로 되돌린 create or replace 를 적용한다
--   (= 20260916000001 적용 직후의 함수. 20260913000001 원본이 아니다).
-- ============================================================================

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
$function$;
