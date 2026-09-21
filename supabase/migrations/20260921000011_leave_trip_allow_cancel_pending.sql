-- ============================================================================
-- 나가기 상태 조건에 CANCEL_PENDING 을 더한다 (2026-09-21)
--
-- 증상
--   취소 요청 중인 여행에서 '여행 나가기' 를 누르면 위임 대상까지 고른 뒤
--   마지막에 "나가지 못했어요" 만 뜬다. 여행장은 위임도 나가기도 못 해
--   교착에 빠진다.
--
-- 원인
--   20260917000004 가 `status = 'PLANNING'` 하나만 허용했다. 그 파일 헤더의
--   "일반 참여자는 준비 중(PLANNING) 여행에서만 나갈 수 있다" 를 글자 그대로
--   옮긴 것인데, 이 프로젝트에서 **'준비 중' 은 PLANNING + CANCEL_PENDING** 이다.
--
--     · POL-CXL-006 "취소 요청 중인 여행은 준비 중인 여행이다.
--       한 명이 취소를 요청했다고 여행이 멈추지 않는다"
--     · POL-CXL-001 (docs/03) 같은 취지
--     · lib/trip/tripStatus.ts isTripBeforeDeparture() 가 그 정의다
--
-- 왜 서버가 틀렸다고 보는가 — 취소 요청 중 나가기는 **설계된 동작**이다.
--   앱에 그 경우만을 위한 경로가 이미 다 있다.
--     · useLeaveTrip 의 leaveCancelsTrip (POL-MEM-015)
--     · MEM-04 '나가면 바로 취소됨' 경고 시트 · 이미 동의한 사람 이름
--     · _trip_leave_core 가 나가기와 한 트랜잭션에서 취소를 재판정하고
--       AfterLeaveOutcome = 'CANCELED' 를 돌려준다
--   취소 요청이 없으면 존재할 이유가 없는 것들이다. 막아 두면 이 경로 전체가
--   도달 불가능이 된다.
--
-- ⚠️ CLAUDE.md §7 이 경고한 그 버그의 세 번째다. 화면 여덟 곳은 2026-09-14 에
--    isTripBeforeDeparture() 로 모았는데, RPC 는 그 함수를 쓸 수 없어 조건을
--    따로 적었고 거기서 또 빠졌다. 그래서 이번에는 **SQL 쪽에도 판정 함수를
--    하나 두고** 두 RPC 가 그것만 부르게 한다. 다음에 상태가 늘어도 한 곳이다.
--
-- 바뀌는 것: leave_trip · delegate_and_leave 의 상태 조건.
-- 그대로인 것: 본인만 · NEEDS_DELEGATION · LAST_MEMBER · LEFT + left_at ·
--   모임 멤버 유지 · 기록 삭제 없음 · GRANT(create or replace 가 보존).
-- 데이터 변경 없음.
--
-- rollback:
--   두 함수를 20260917000004 의 정의로 되돌리고
--   drop function if exists public.is_trip_leavable_status(text);
-- ============================================================================

/**
 * 이 상태의 여행에서 나갈 수 있는가.
 *
 * lib/trip/tripStatus.ts isTripBeforeDeparture() 의 SQL 짝이다.
 * 둘이 어긋나면 화면은 열리는데 서버가 막는 상황이 다시 난다.
 */
create or replace function public.is_trip_leavable_status(p_status text)
returns boolean
language sql
immutable
set search_path to 'public', 'pg_temp'
as $function$
  select p_status in ('PLANNING', 'CANCEL_PENDING');
$function$;

comment on function public.is_trip_leavable_status(text) is
  '나갈 수 있는 여행 상태. PLANNING + CANCEL_PENDING (POL-CXL-006). lib/trip/tripStatus.ts isTripBeforeDeparture() 와 같은 기준. (2026-09-21)';

revoke all on function public.is_trip_leavable_status(text) from public, anon;
grant execute on function public.is_trip_leavable_status(text) to authenticated;


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

  -- 나가기는 준비 중(PLANNING · CANCEL_PENDING) 여행에서만. (migration 20260921000011)
  -- 여행 중 · 끝난 · 정산 · 취소된 여행의 참여 기록은 그대로 남아야 한다.
  if not public.is_trip_leavable_status(v_trip.status) then
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
$function$;


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

  -- 위임하고 나가기도 나가기다 — 같은 조건. (migration 20260921000011)
  if not exists (
    select 1 from public.trips t
    where t.id = p_trip_id and public.is_trip_leavable_status(t.status)
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
$function$;
