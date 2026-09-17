-- ============================================================================
-- 여행 나가기 PLANNING guard (2026-09-17 · Travel Membership Security 잔여 1건)
--
-- 확정 정책(docs/11 · 16): 일반 참여자는 **준비 중(PLANNING)** 여행에서만 나갈 수 있다.
-- 지금까지는 화면(LeaveTripSheet · canLeave)만 이 조건을 봤고 RPC 는 status 를 검사하지 않아
-- API 로 직접 부르면 여행 중 · 끝난 · 정산된 여행에서도 LEFT 가 될 수 있었다. DB 에서 막는다.
--
-- 바뀌는 것: leave_trip · delegate_and_leave 에 status <> 'PLANNING' → TRIP_NOT_LEAVABLE(22023) 한 줄씩.
-- 그대로인 것: 본인만 · 여행장 NEEDS_DELEGATION · LAST_MEMBER · LEFT + left_at · 모임 멤버 유지
--   (p_also_leave_group 사용자 선택) · 기록 삭제 없음 · GRANT(create or replace 가 보존).
-- 데이터 변경 없음.
--
-- rollback: 두 함수의 직전 정의는 20260917000003 (guard 판) · 원본은 20260916000004.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.leave_trip(p_trip_id uuid, p_also_leave_group boolean DEFAULT false)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid    uuid := auth.uid();
  v_trip   public.trips%rowtype;
  v_others integer;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;
  -- 탈퇴 대기(PENDING_WITHDRAWAL) · 탈퇴 완료 계정은 여행 권한 변경을 할 수 없다. (2026-09-17 · migration 20260917000003)
  if not public.is_account_active() then
    raise exception using errcode = '42501', message = 'ACCOUNT_NOT_ACTIVE';
  end if;

  select * into v_trip from public.trips t where t.id = p_trip_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;

  -- 나가기는 PLANNING(준비 중) 여행에서만. (확정 정책 · docs/16 §1 · migration 20260917000004)
  -- 여행 중 · 끝난 · 정산 · 취소된 여행의 참여 기록은 그대로 남아야 한다.
  if v_trip.status <> 'PLANNING' then
    raise exception using errcode = '22023', message = 'TRIP_NOT_LEAVABLE';
  end if;

  if not exists (
    select 1 from public.trip_members tm
    where tm.trip_id = p_trip_id and tm.user_id = v_uid and tm.status = 'ACTIVE'
  ) then
    raise exception using errcode = '42501', message = 'NOT_MEMBER';
  end if;

  select count(distinct tm.user_id)::integer into v_others
  from public.trip_members tm
  where tm.trip_id = p_trip_id
    and tm.status = 'ACTIVE'
    and tm.user_id is not null
    and tm.user_id <> v_uid;

  if v_others <= 0 then
    raise exception using errcode = 'P0003', message = 'LAST_MEMBER';
  end if;

  -- 여행장은 그냥 못 나간다. 나가면 참여 요청을 수락할 사람이 없어져
  -- 초대가 영영 막힌다. delegate_and_leave 로만 나간다.
  if v_trip.leader_user_id is not null and v_trip.leader_user_id = v_uid then
    raise exception using errcode = 'P0003', message = 'NEEDS_DELEGATION';
  end if;

  return public._trip_leave_core(p_trip_id, v_uid, coalesce(p_also_leave_group, false));
end;
$function$
;

CREATE OR REPLACE FUNCTION public.delegate_and_leave(p_trip_id uuid, p_to_user_id uuid, p_also_leave_group boolean DEFAULT false)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid    uuid := auth.uid();
  v_others integer;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;
  -- 탈퇴 대기(PENDING_WITHDRAWAL) · 탈퇴 완료 계정은 여행 권한 변경을 할 수 없다. (2026-09-17 · migration 20260917000003)
  if not public.is_account_active() then
    raise exception using errcode = '42501', message = 'ACCOUNT_NOT_ACTIVE';
  end if;

  -- 위임하고 나가기도 나가기다 — 같은 PLANNING 조건. (migration 20260917000004)
  if not exists (
    select 1 from public.trips t where t.id = p_trip_id and t.status = 'PLANNING'
  ) then
    raise exception using errcode = '22023', message = 'TRIP_NOT_LEAVABLE';
  end if;

  select count(distinct tm.user_id)::integer into v_others
  from public.trip_members tm
  where tm.trip_id = p_trip_id
    and tm.status = 'ACTIVE'
    and tm.user_id is not null
    and tm.user_id <> v_uid;

  if v_others <= 0 then
    raise exception using errcode = 'P0003', message = 'LAST_MEMBER';
  end if;

  perform public.delegate_trip_leader(p_trip_id, p_to_user_id);

  return public._trip_leave_core(p_trip_id, v_uid, coalesce(p_also_leave_group, false));
end;
$function$
;
