-- ============================================================================
-- 취소된 여행의 초대 링크 — resolve 단계에서 끝낸다 (2026-09-22)
--
-- 문제 (2026-09-22 · 2계정 실기기)
--   취소된 여행의 초대 링크를 열면 invite_state = VALID 로 와서 초대 화면이 여행 정보와
--   [참여 의사 보내기] 를 그렸다. 누르면 그제서야 request_trip_join 이 TRIP_NOT_OPEN 으로
--   막는다. 사용자는 "일시적 실패" 로 읽고 다시 누르지만 영원히 같은 결과다.
--
-- 확정 정책
--   취소 · 삭제된 여행의 초대는 resolve 단계에서 'CANCELED' 로 판정하고, 여행 상세정보를
--   아무것도 내려보내지 않는다. 화면은 "취소된 여행이에요" 만 보여주고 CTA 를 그리지 않는다.
--
-- 바꾸지 않는 것
--   · request_trip_join 의 TRIP_NOT_OPEN guard — defense in depth 로 그대로 둔다.
--   · invite_state 의 기존 값(VALID · EXPIRED · REVOKED · NOT_FOUND) 과 반환 컬럼 모양.
--     'CANCELED' 는 **추가**다. 이 값을 모르는 예전 앱은 기존 default 갈래(NOT_FOUND)로 떨어져
--     "초대 정보를 찾을 수 없어요" 를 보여준다 — 여행 정보도 CTA 도 없다. 안전한 쪽으로 무너진다.
--   · trip_invites · trip_members · 정책 · RLS · GRANT (create or replace 는 권한을 유지한다)
--   · resolve_trip_invite_by_id 는 이 함수를 그대로 위임한다. 같이 고쳐진다.
--
-- 되돌리기
--   20260916000001_notification_center_foundation.sql 의 resolve_trip_invite 정의를 다시 실행한다.
-- ============================================================================

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

  -- ── 취소 · 삭제된 여행은 여기서 끝낸다. (2026-09-22)
  --    링크 자체는 살아 있어(폐기도 만료도 아니다) 지금까지 VALID 로 내려갔고, 화면이 여행 정보와
  --    [참여 의사 보내기] 를 그렸다. 누르면 request_trip_join 이 TRIP_NOT_OPEN 으로 막지만,
  --    그때는 이미 취소된 여행의 여행지 · 일정 · 인원 · 초대한 사람을 보여 준 뒤다.
  --    ⚠️ 여행 정보를 한 글자도 내려보내지 않는다. 화면에서 숨기는 것으로 갈음하지 않는다. (POL-INV-021)
  --    ⚠️ 기준은 request_trip_join · get_or_create_trip_invite 와 **같은 두 상태**다. CANCEL_PENDING 은
  --       아직 취소가 아니라서 포함하지 않는다 — 한쪽만 넓히면 두 층의 판정이 어긋난다.
  if v_trip.status in ('DELETED', 'CANCELED') then
    return query select 'CANCELED'::text, null::uuid, null::text, null::date, null::date,
                        null::integer, null::integer, null::text, 'NONE'::text, null::uuid;
    return;
  end if;

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
