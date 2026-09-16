-- ============================================================================
-- 취소 요청 만료를 서버에서 닫는다 (보안 점검 필수 6 · 보완)
--
-- 2026-09-16 · 20260916000004 에서 빠진 것을 채운다.
--
-- ── 왜 빠졌었나 ─────────────────────────────────────────────────────────────
--
--   만료는 **조회 시점에 판정한다.** 크론을 만들지 않는다. (POL-CXL-063 · 064)
--   그래서 getActiveCancelRequest() 가 목록을 읽다가 만료된 요청을 발견하면
--   그 자리에서 닫고 trips.status 를 PLANNING 으로 되돌린다 — 즉 **읽기 도중에
--   쓰기가 일어난다.**
--
--   20260916000004 는 투표(cast_trip_cancel_vote) 안에서만 만료를 닫았다.
--   그대로 두면 필수 1 에서 trip_cancel_requests 쓰기를 막는 순간
--   조회 경로가 깨지고, 만료된 요청이 영원히 PENDING 으로 남아 여행이
--   CANCEL_PENDING 에 갇힌다. 아무도 투표하지 않으면 풀릴 길이 없다.
--
-- ⚠️ 기존 마이그레이션은 고치지 않는다. 새 파일로 더한다. (CLAUDE.md §18)
-- ============================================================================


-- ============================================================================
-- expire_trip_cancel_request — 만료됐으면 닫는다
--
-- 화면이 여행을 열 때마다 부른다. 만료가 아니면 아무 일도 하지 않는다.
--
-- ⚠️ 판정은 두 가지다. (앱의 cancelRequestExpiry 와 같은 식)
--      시간   요청 + 7일 경과
--      출발   출발일 당일부터 — start_date 가 date 라 시각이 없다
--
-- ⚠️ 멱등이다. 여러 화면이 동시에 불러도 첫 호출만 닫고 나머지는 'NONE' 이다.
--
-- ⚠️ 아무나 부르게 두지 않는다. 그 여행의 ACTIVE 가입 멤버만 부를 수 있다.
--    만료는 남의 여행 상태를 바꾸는 일이다.
-- ============================================================================
create or replace function public.expire_trip_cancel_request(p_trip_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid  uuid := auth.uid();
  v_req  public.trip_cancel_requests%rowtype;
  v_trip public.trips%rowtype;
  v_note text;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;

  if not exists (
    select 1 from public.trip_members tm
    where tm.trip_id = p_trip_id and tm.user_id = v_uid and tm.status = 'ACTIVE'
  ) then
    raise exception using errcode = '42501', message = 'NOT_MEMBER';
  end if;

  select * into v_req
  from public.trip_cancel_requests r
  where r.trip_id = p_trip_id and r.status = 'PENDING'
  limit 1;

  if not found then
    return 'NONE';
  end if;

  select * into v_trip from public.trips t where t.id = p_trip_id;

  if v_trip.start_date is not null
     and (now() at time zone 'utc')::date >= v_trip.start_date then
    v_note := 'DEPARTURE_REACHED';
  elsif now() >= v_req.expires_at then
    v_note := 'EXPIRED_TIME';
  else
    return 'NOT_EXPIRED';
  end if;

  perform public._trip_cancel_close(v_req.id, p_trip_id, 'EXPIRED', v_note);
  return 'EXPIRED';
end;
$$;

revoke all on function public.expire_trip_cancel_request(uuid) from public, anon, authenticated;
grant execute on function public.expire_trip_cancel_request(uuid) to authenticated;

comment on function public.expire_trip_cancel_request(uuid) is
  '취소 요청이 만료(7일 경과 또는 출발일 도달)됐으면 닫고 여행을 PLANNING 으로 되돌린다. 조회 시점에 부른다';
