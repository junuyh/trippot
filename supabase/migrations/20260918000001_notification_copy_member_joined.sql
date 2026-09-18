-- ============================================================================
-- 알림 문구 통일 + MEMBER_JOINED 생성 + MEMBER_LEFT 본문 (2026-09-18 · 알림 시스템 audit)
--
-- 무엇을 바꾸나 — 함수 본문의 **문자열과 알림 호출만**. 권한 판정 · 상태 전이 · 반환값은 그대로다.
--   ① resolve_trip_invite       INVITE_RECEIVED 제목  여행 초대를 받았어요 → 여행 초대가 도착했어요
--   ② request_trip_join         JOIN_REQUESTED        여행 참여 요청이 도착했어요 / 참여를 요청했어요.
--                                                      → 참여 의사가 도착했어요 / 참여 의사를 보냈어요.
--   ③ reject_trip_join_request  JOIN_REJECTED         여행 참여 요청이 거절됐어요 / 참여 요청이 거절됐어요.
--                                                      → 여행 참여가 거절됐어요 / 참여 의사가 거절됐어요.
--   ④ notify_join_accepted      JOIN_ACCEPTED         승인 → 수락
--                               + MEMBER_JOINED       기존 ACTIVE 멤버(새 멤버 제외)에게
--                                                      새 멤버가 참여했어요 / {이름}님이 {여행}에 함께하게 됐어요.
--   ⑤ _trip_leave_core          MEMBER_LEFT 본문      {여행}의 멤버 한 명이 나갔어요. → {이름}님이 {여행}에서 나갔어요.
--   ⑥ 기존 저장 행 backfill      알림 목록·상세·배너는 title/body 스냅샷을 그대로 보여주므로, 이미 쌓인
--                               초대·참여 4종만 새 문구로 바꾼다. type + **정확한 옛 제목**으로만 좁히고
--                               body 는 replace() 로 꼬리 문구만 바꾼다(이름·여행지 보존). 다른 type 은 손대지 않는다.
--                               (2026-09-18 trippot-dev 실측: INVITE_RECEIVED 9 · JOIN_REQUESTED 11 · JOIN_ACCEPTED 8 · JOIN_REJECTED 2)
--
-- 근거: 앱 쪽 문구 기준 lib/notifications/messages.ts 와 글자까지 같게 맞춘다.
--   MEMBER_JOINED 는 type CHECK(20260916000001 ②)에 이미 있으나 producer 가 없었다(팀원 문의).
--
-- 지키는 것
--   - 본문은 **현재 remote 정의(pg_get_functiondef)** 를 그대로 가져와 해당 문자열만 바꿨다.
--     20260917000003/000004 의 ACCOUNT_NOT_ACTIVE · TRIP_NOT_OPEN · TRIP_NOT_LEAVABLE 가드가 그대로 남는다.
--   - create or replace 라 SECURITY DEFINER · search_path · 소유자 · EXECUTE 권한이 유지된다. GRANT/REVOKE 없음.
--   - notifications RLS · GRANT · type CHECK 를 건드리지 않는다. dev_open_all 을 되살리지 않는다.
--   - 알림 생성 실패는 create_notification 이 warning 으로 삼킨다(기존 격리 정책). 전이 트랜잭션은 깨지지 않는다.
--   - 저장된 행은 ⑥ 의 네 종류만, 옛 제목이 정확히 일치하는 행만 바꾼다. read_at · created_at · data 는 그대로다.
--
-- rollback: 이 다섯 함수를 직전 정의(20260916000001 ④ · 20260916000009 · 20260917000003 · 20260917000004)로
--   다시 create or replace 한다. MEMBER_JOINED 행은 남겨도 무해하다(type CHECK 에 있음).
--   backfill 되돌리기: 아래 ⑥ 의 update 를 제목·꼬리 문구를 반대로 바꿔 같은 조건으로 실행한다.
-- ============================================================================

-- ── 1. resolve_trip_invite — INVITE_RECEIVED 제목 ──
CREATE OR REPLACE FUNCTION public.resolve_trip_invite(p_token text)
 RETURNS TABLE(invite_state text, trip_id uuid, destination text, start_date date, end_date date, headcount integer, active_member_count integer, inviter_name text, my_state text, my_request_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
  --   (user_id, data->>inviteId) partial unique index + on conflict 로 재열람해도 1행.
  --   실패해도 조회 결과에는 영향 없다 (create_notification 이 격리한다).
  if v_state = 'VALID' and v_my_state in ('NONE', 'LEFT') and v_uid <> v_inv.created_by then
    perform public.create_notification(
      v_uid,
      'INVITE_RECEIVED',
      '여행 초대가 도착했어요',
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
$function$;

-- ── 2. request_trip_join — JOIN_REQUESTED 제목·본문 (request_trip_join_by_invite 는 이 함수를 부른다 · 변경 없음) ──
CREATE OR REPLACE FUNCTION public.request_trip_join(p_token text)
 RETURNS TABLE(request_id uuid, trip_id uuid, status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
  -- 탈퇴 대기(PENDING_WITHDRAWAL) · 탈퇴 완료 계정은 여행 권한 변경을 할 수 없다. (2026-09-17 · migration 20260917000003)
  if not public.is_account_active() then
    raise exception using errcode = '42501', message = 'ACCOUNT_NOT_ACTIVE';
  end if;

  select * into v_inv from public.trip_invites ti where ti.token = p_token;
  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;

  if v_inv.revoked_at is not null or v_inv.expires_at <= now() then
    raise exception using errcode = '22023', message = 'INVITE_NOT_VALID';
  end if;

  -- 취소 · 삭제된 여행에는 참여 요청을 받지 않는다. (승인 단계의 TRIP_NOT_OPEN 을 요청 단계로 당긴다)
  if exists (
    select 1 from public.trips t
    where t.id = v_inv.trip_id and t.status in ('DELETED', 'CANCELED')
  ) then
    raise exception using errcode = '22023', message = 'TRIP_NOT_OPEN';
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
      '참여 의사가 도착했어요',
      public.notification_person_label(v_actor) || '님이 '
        || public.notification_trip_label(v_trip.destination) || ' 참여 의사를 보냈어요.',
      v_inv.trip_id,
      jsonb_build_object('requestId', v_req.id, 'inviteId', v_inv.id, 'actorUserId', v_uid)
    );
  end if;

  return query select v_req.id, v_req.trip_id, v_req.status;
end;
$function$;

-- ── 3. reject_trip_join_request — JOIN_REJECTED 제목·본문 ──
CREATE OR REPLACE FUNCTION public.reject_trip_join_request(p_request_id uuid)
 RETURNS TABLE(request_id uuid, status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid  uuid := auth.uid();
  v_req  public.trip_join_requests%rowtype;
  v_trip public.trips%rowtype;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;
  -- 탈퇴 대기(PENDING_WITHDRAWAL) · 탈퇴 완료 계정은 여행 권한 변경을 할 수 없다. (2026-09-17 · migration 20260917000003)
  if not public.is_account_active() then
    raise exception using errcode = '42501', message = 'ACCOUNT_NOT_ACTIVE';
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
    '여행 참여가 거절됐어요',
    public.notification_trip_label(v_trip.destination) || ' 참여 의사가 거절됐어요.',
    v_trip.id,
    jsonb_build_object('requestId', p_request_id)
  );

  return query select p_request_id, 'REJECTED'::text;
end;
$function$;

-- ── 4. notify_join_accepted — JOIN_ACCEPTED 문구 + MEMBER_JOINED 생성 ──
CREATE OR REPLACE FUNCTION public.notify_join_accepted(p_user_id uuid, p_request_id uuid, p_trip trips, p_group_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_actor text;
begin
  -- 요청자에게: JOIN_ACCEPTED (문구 2026-09-18 확정 · 승인 → 수락)
  perform public.create_notification(
    p_user_id,
    'JOIN_ACCEPTED',
    '여행 참여가 수락됐어요',
    public.notification_trip_label(p_trip.destination) || ' 참여가 수락됐어요.',
    p_trip.id,
    jsonb_build_object('requestId', p_request_id, 'groupId', p_group_id)
  );

  -- 기존 ACTIVE 멤버에게: MEMBER_JOINED (2026-09-18 신설 · 새 멤버 본인은 제외)
  -- 호출 시점은 accept_trip_join_request 가 trip_members ACTIVE 를 확정한 직후라
  -- _notify_trip_members 의 ACTIVE 목록에 새 멤버가 이미 들어 있다 → p_exclude 로 뺀다.
  select public.notification_person_label(u.name) into v_actor
  from public.users u where u.id = p_user_id;

  perform public._notify_trip_members(
    p_trip.id, p_user_id, 'MEMBER_JOINED',
    '새 멤버가 참여했어요',
    coalesce(v_actor, '사용자') || '님이 ' || public.notification_trip_label(p_trip.destination) || '에 함께하게 됐어요.',
    jsonb_build_object('requestId', p_request_id, 'actorUserId', p_user_id)
  );
end;
$function$;

-- ── 5. _trip_leave_core — MEMBER_LEFT 본문에 나간 사람 이름 ──
CREATE OR REPLACE FUNCTION public._trip_leave_core(p_trip_id uuid, p_user_id uuid, p_also_leave_group boolean)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_group_id uuid;
  v_trip     public.trips%rowtype;
  v_actor    text;
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

  -- MEMBER_LEFT 본문에 나간 사람 이름을 넣는다. (2026-09-18 확정 문구)
  select public.notification_person_label(u.name) into v_actor
  from public.users u where u.id = p_user_id;

  perform public._notify_trip_members(
    p_trip_id, p_user_id, 'MEMBER_LEFT',
    '멤버가 여행에서 나갔어요',
    coalesce(v_actor, '사용자') || '님이 ' || public.notification_trip_label(v_trip.destination) || '에서 나갔어요.',
    jsonb_build_object('actorUserId', p_user_id)
  );

  return public._trip_cancel_recheck_after_leave(p_trip_id, p_user_id);
end;
$function$;

-- ── 6. 기존 저장 행 backfill — type + 정확한 옛 제목으로만 ──
-- INVITE_RECEIVED: 제목만. 본문({이름}님이 {여행}에 초대했어요.)은 이미 확정 문구와 같다.
update public.notifications
   set title = '여행 초대가 도착했어요'
 where type = 'INVITE_RECEIVED'
   and title = '여행 초대를 받았어요';

-- JOIN_REQUESTED: 제목 + 본문 꼬리  참여를 요청했어요. →  참여 의사를 보냈어요.
update public.notifications
   set title = '참여 의사가 도착했어요',
       body  = replace(body, ' 참여를 요청했어요.', ' 참여 의사를 보냈어요.')
 where type = 'JOIN_REQUESTED'
   and title = '여행 참여 요청이 도착했어요';

-- JOIN_ACCEPTED: 제목 + 본문 꼬리  참여가 승인됐어요. →  참여가 수락됐어요.
update public.notifications
   set title = '여행 참여가 수락됐어요',
       body  = replace(body, ' 참여가 승인됐어요.', ' 참여가 수락됐어요.')
 where type = 'JOIN_ACCEPTED'
   and title = '여행 참여가 승인됐어요';

-- JOIN_REJECTED: 제목 + 본문 꼬리  참여 요청이 거절됐어요. →  참여 의사가 거절됐어요.
update public.notifications
   set title = '여행 참여가 거절됐어요',
       body  = replace(body, ' 참여 요청이 거절됐어요.', ' 참여 의사가 거절됐어요.')
 where type = 'JOIN_REJECTED'
   and title = '여행 참여 요청이 거절됐어요';
