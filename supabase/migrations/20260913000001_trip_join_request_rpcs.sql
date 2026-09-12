-- ============================================================================
-- 여행 초대 수신 · 참가 요청 · 승인/거절 — 서버 함수 6개 + 여행장 백필(PERSONAL)
--
-- 기준 문서: docs/12_여행초대_승인_RPC계약_v1.md (팀 확정 · 2026-09-13 · PR #92)
--            docs/10_여행초대정책_v2.md · docs/11_모임정책_v1.md
-- 작성일: 2026-09-13
--
-- ⚠️ 이 파일은 **DB 담당이 검토·적용**한다. 앱 담당이 계약대로 옮겨 적었다.
--    supabase db push 는 하지 않았다. 원격 적용 전에는 types/database.ts 도 재생성하지 않는다.
--
-- ── 이 파일이 더하는 것 ──────────────────────────────────────────────────────
--
--   resolve_trip_invite(p_token)                         수신자용 초대 확인 (최소 미리보기)
--   request_trip_join(p_token)                           참가 요청 (PENDING · 멱등)
--   cancel_trip_join_request(p_request_id)               본인 요청 취소
--   get_trip_join_requests(p_trip_id)                    여행장 대기 목록 (INV-04 안내용)
--   accept_trip_join_request(p_request_id, p_new_group_name)   승인 · 원자적 · CASE A/B/C/D
--   reject_trip_join_request(p_request_id)               거절
--
--   + trips.leader_user_id 가 NULL 인 PERSONAL 여행 백필 (owner_user_id = 주인 = 여행장)
--   + GROUP 여행 NULL precheck SQL (파일 하단 · 주석 · 실행하지 않는다)
--
-- ── 건드리지 않는 것 ──────────────────────────────────────────────────────────
--
--   trip_invites · trip_join_requests 스키마 (20260910000001)
--   get_or_create_trip_invite · trip_invites RLS/GRANT (20260911000001)
--   trip_join_requests 의 dev_open_all (배포 전 정책 교체는 별도)
--   trips.pending_group_name — 읽지도 쓰지도 않는다. 지우지도 않는다.
--
-- ── 공통 규칙 (docs/12 §2) ─────────────────────────────────────────────────────
--
--   · security definer · search_path = public, pg_temp · execute 는 authenticated 만
--   · 신원은 auth.uid() 하나. user id 를 인자로 받지 않는다
--   · 여행장 = trips.leader_user_id = auth.uid(). owner_user_id 는 판정에 쓰지 않는다
--     NULL 이면 LEADER_NOT_CONFIGURED — 대체 판정으로 여행장을 세우지 않는다
--   · 유효 여행 = status ∉ ('DELETED','CANCELED')  (앱 getTrips 와 같다)
--   · ACTIVE 멤버 수 = trip_members ACTIVE · user_id not null 의 distinct user_id
--   · outsider = target 모임의 ACTIVE group_members 가 아님 (행 없음 또는 LEFT)
--   · membership 복원: 기존 행이 있으면 INSERT 하지 않고 status=ACTIVE 로 되돌린다.
--     role · joined_at 유지. trip_members 는 unique 가 없어 그 사용자의 행 전부를 대상으로 한다
--
-- ── 오류 계약 ───────────────────────────────────────────────────────────────
--
--   raise exception 의 message 를 **그대로 코드**로 쓴다. 앱은 error.message 로 분기한다.
--   (문자열 파싱이 아니라 정확히 일치 비교. errcode 는 표준 SQLSTATE 를 곁들인다)
--
--     NOT_FOUND                 P0002   invite 없음 / request 없음
--     INVITE_NOT_VALID          22023   만료 또는 폐기
--     ALREADY_MEMBER            23505   이미 ACTIVE 참여자
--     REJECTED_FOR_INVITE       P0005   같은 invite 에서 이미 거절됨
--     REQUEST_NOT_PENDING       22023   PENDING 이 아님
--     TRIP_NOT_OPEN             22023   여행이 DELETED/CANCELED
--     HEADCOUNT_REACHED         P0003   예정 인원 도달 — 요청은 PENDING 유지
--     NEW_GROUP_NAME_REQUIRED   22023   CASE C/D 인데 이름 없음 — 아무것도 쓰지 않음
--     LEADER_NOT_CONFIGURED     P0004   trips.leader_user_id NULL
--     NOT_LEADER                42501   여행장 아님
--     FORBIDDEN                 42501   본인 요청 아님 등
--     AUTH_REQUIRED             42501   auth.uid() 없음
--
-- ⚠️ 두 번 실행해도 안전하게 썼다. create or replace · 백필은 where … is null.
-- ============================================================================


-- ============================================================================
-- ① 내부 helper — membership 복원 (외부에 열지 않는다)
--
-- security definer 함수 안에서만 부른다. 호출자(함수 소유자) 권한으로 실행되므로
-- authenticated 에게 execute 를 주지 않아도 된다. 전부 회수한다.
-- ============================================================================

-- trip_members: ACTIVE 행이 하나라도 있으면 아무것도 안 한다. LEFT/INVITED 행이 있으면
-- 그 사용자의 행 **전부**를 ACTIVE 로 되돌린다(unique 가 없어 여러 행일 수 있다).
-- 행이 없으면 하나 넣는다.
create or replace function public.activate_trip_member(
  p_trip_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (
    select 1 from public.trip_members tm
    where tm.trip_id = p_trip_id and tm.user_id = p_user_id and tm.status = 'ACTIVE'
  ) then
    return;
  end if;

  update public.trip_members
     set status = 'ACTIVE', left_at = null, updated_at = now()
   where trip_id = p_trip_id and user_id = p_user_id;

  if not found then
    insert into public.trip_members (trip_id, user_id, status)
    values (p_trip_id, p_user_id, 'ACTIVE');
  end if;
end;
$$;

-- group_members: unique(group_id, user_id) 가 있어 on conflict 로 복원한다.
-- 기존 행이면 status 만 ACTIVE 로 — role · joined_at 은 그대로 둔다 (docs/12 §2).
-- 새 행이면 role='MEMBER' · joined_at=now(). OWNER 를 주지 않는다 (모임장 개념 없음).
create or replace function public.activate_group_member(
  p_group_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.group_members (group_id, user_id, role, status, joined_at)
  values (p_group_id, p_user_id, 'MEMBER', 'ACTIVE', now())
  on conflict (group_id, user_id) do update
    set status = 'ACTIVE', updated_at = now();
end;
$$;

revoke all on function public.activate_trip_member(uuid, uuid)  from public, anon, authenticated;
revoke all on function public.activate_group_member(uuid, uuid) from public, anon, authenticated;


-- ============================================================================
-- ② resolve_trip_invite(p_token) — 수신자용 초대 확인 (docs/12 §3)
--
-- 수신자는 아직 멤버가 아니라 trip_invites 를 못 읽는다 (RLS). 이 함수가 대신 읽고
-- **최소 미리보기**만 돌려준다. 예산·계좌·거래·멤버 목록·invite 행은 절대 내보내지 않는다.
--
-- ⚠️ headcount 도달은 invite_state 가 아니다. active_member_count 와 headcount 를 따로
--    주고 앱이 "지금은 자리가 없어요" 로 안내한다. 요청은 허용한다.
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

comment on function public.resolve_trip_invite(text)
is '수신자용 초대 확인. invite_state(VALID/EXPIRED/REVOKED/NOT_FOUND) + 최소 미리보기 + 내 상태. 예산·계좌·멤버 목록은 돌려주지 않는다.';


-- ============================================================================
-- ③ request_trip_join(p_token) — 참가 요청 (docs/12 §4)
--
-- 검사 순서: token → 유효 → 이미 ACTIVE → 같은 invite 에서 REJECTED → PENDING 있으면 그 행
-- headcount 가 찼어도 요청은 받는다. LEFT 였던 사람도 요청할 수 있다.
-- 멱등: idx_join_req_unique_pending (trip_id, user_id) where status='PENDING'
-- ============================================================================
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
  exception when unique_violation then
    -- 같은 순간 두 번 눌렀다. unique partial index 가 막았다. 이미 들어간 행을 돌려준다.
    select * into v_req
    from public.trip_join_requests r
    where r.trip_id = v_inv.trip_id and r.user_id = v_uid and r.status = 'PENDING'
    limit 1;
  end;

  return query select v_req.id, v_req.trip_id, v_req.status;
end;
$$;

comment on function public.request_trip_join(text)
is '참가 요청. 유효한 invite 에 PENDING 한 행. 멱등. headcount 도달·LEFT 도 요청 가능. 같은 invite 에서 거절된 사람만 막는다.';


-- ============================================================================
-- ④ cancel_trip_join_request(p_request_id) — 본인 요청 취소 (docs/12 §5)
-- ============================================================================
create or replace function public.cancel_trip_join_request(
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
  v_uid uuid := auth.uid();
  v_req public.trip_join_requests%rowtype;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;

  select * into v_req from public.trip_join_requests r where r.id = p_request_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;
  if v_req.user_id <> v_uid then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if v_req.status <> 'PENDING' then
    raise exception using errcode = '22023', message = 'REQUEST_NOT_PENDING';
  end if;

  -- decided_by 는 null 그대로 — 여행장의 결정이 아니다. membership · token 은 건드리지 않는다.
  update public.trip_join_requests
     set status = 'CANCELED', decided_at = now()
   where id = p_request_id;

  return query select p_request_id, 'CANCELED'::text;
end;
$$;

comment on function public.cancel_trip_join_request(uuid)
is '본인의 PENDING 요청을 CANCELED 로. membership · token 변화 없음.';


-- ============================================================================
-- ⑤ get_trip_join_requests(p_trip_id) — 여행장의 대기 목록 (docs/12 §6)
--
-- needs_new_group 은 **UI 안내용**이다. 승인 함수가 락 안에서 다시 계산한다.
-- ============================================================================
create or replace function public.get_trip_join_requests(
  p_trip_id uuid
)
returns table (
  request_id        uuid,
  requester_user_id uuid,
  requester_name    text,
  requested_at      timestamptz,
  status            text,
  is_group_member   boolean,
  has_other_trips   boolean,
  needs_new_group   boolean,
  trip_owner_type   text
)
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
  if v_trip.leader_user_id is null then
    raise exception using errcode = 'P0004', message = 'LEADER_NOT_CONFIGURED';
  end if;
  if v_trip.leader_user_id <> v_uid then
    raise exception using errcode = '42501', message = 'NOT_LEADER';
  end if;

  return query
  with other_trips as (
    select count(*) > 0 as has_other
    from public.trips t2
    where v_trip.group_id is not null
      and t2.group_id = v_trip.group_id
      and t2.id <> v_trip.id
      and t2.status not in ('DELETED', 'CANCELED')
  )
  select
    r.id,
    r.user_id,
    u.name,
    r.requested_at,
    r.status,
    (v_trip.group_id is not null and exists (
       select 1 from public.group_members gm
       where gm.group_id = v_trip.group_id and gm.user_id = r.user_id and gm.status = 'ACTIVE'
    )) as is_group_member,
    coalesce((select has_other from other_trips), false) as has_other_trips,
    -- PERSONAL 이면 항상 새 모임. GROUP 이면 outsider 이고 다른 여행이 있을 때만.
    case
      when v_trip.owner_type = 'PERSONAL' then true
      else (
        not exists (
          select 1 from public.group_members gm
          where gm.group_id = v_trip.group_id and gm.user_id = r.user_id and gm.status = 'ACTIVE'
        )
        and coalesce((select has_other from other_trips), false)
      )
    end as needs_new_group,
    v_trip.owner_type
  from public.trip_join_requests r
  join public.users u on u.id = r.user_id
  where r.trip_id = p_trip_id
    and r.status = 'PENDING'
  order by r.requested_at asc;
end;
$$;

comment on function public.get_trip_join_requests(uuid)
is '여행장 전용 PENDING 목록. needs_new_group 은 안내용 — 승인 함수가 다시 계산한다.';


-- ============================================================================
-- ⑥ accept_trip_join_request(p_request_id, p_new_group_name) — 승인 (docs/12 §7)
--
-- 한 트랜잭션. 요청 행 → 여행 행 순으로 FOR UPDATE 잠근 뒤 **전부 다시 읽는다.**
-- 같은 여행의 승인이 직렬화되어 headcount 초과·새 모임 중복 생성이 일어나지 않는다.
--
-- CASE 판정 (락 안)
--   is_personal   trips.owner_type = 'PERSONAL'
--   in_group      group_id 있고 요청자가 그 group_members ACTIVE (LEFT 는 outsider)
--   other_trips   같은 group 의 다른 유효 여행 수 (target 제외 · DELETED/CANCELED 제외)
--                 ⚠️ PLANNING · TRAVELING · ENDED · SETTLED 전부. SETTLED 만 보던 기준은 폐기
--
--   A  !personal & in_group                     group_members 변화 없음
--   B  !personal & !in_group & other = 0        기존 모임에 합류
--   C  !personal & !in_group & other >= 1       새 모임 · target 여행만 이동       ← 이름 필수
--   D  personal                                 새 모임 · PERSONAL → GROUP 전환  ← 이름 필수
--
-- ⚠️⚠️ 새 모임(C · D)의 멤버 = **target 여행의 현재 ACTIVE trip_members + 요청자** 뿐이다.
--       기존 모임의 다른 멤버(이 여행에 참여하지 않는 사람)는 넣지 않는다. (docs/12 §0 · §7-2)
--       기존 모임의 멤버십과 다른 여행은 그대로 둔다.
-- ⚠️ 새 groups.owner_user_id = trips.leader_user_id. 모임장 권한이 아니다. role 은 전원 MEMBER.
-- ⚠️ CASE D 는 owner_type · owner_user_id · group_id 를 한 UPDATE 로 바꾼다 (trips_owner_shape).
-- ⚠️ 새 trips 행을 만들지 않는다. trip.id 유지. fund_sources · transactions · budgets 는 따라간다.
-- ⚠️ pending_group_name 을 읽지도 쓰지도 않는다.
-- ============================================================================
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

  return query select p_request_id, v_trip.id, v_final_group, v_case;
end;
$$;

comment on function public.accept_trip_join_request(uuid, text)
is '여행장 승인. 요청·여행 행을 잠근 뒤 headcount 재검사 → CASE A/B/C/D → membership → ACCEPTED. 새 모임 멤버는 target 여행 ACTIVE 참여자 + 요청자뿐.';


-- ============================================================================
-- ⑦ reject_trip_join_request(p_request_id) — 거절 (docs/12 §8)
-- ============================================================================
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

  return query select p_request_id, 'REJECTED'::text;
end;
$$;

comment on function public.reject_trip_join_request(uuid)
is '여행장 거절. (invite_id, user_id) 단위로만 재요청을 막는다. token 은 그대로.';


-- ============================================================================
-- ⑧ 실행 권한 — PR #86 과 같은 형태
--
-- 함수는 만들어지는 순간 PUBLIC 에 EXECUTE 가 붙는다. 먼저 걷어 낸다.
-- anon 은 호출 불가. authenticated 라도 각 함수 안의 검사(auth.uid · 여행장 · 본인)를 지난다.
-- ============================================================================
revoke all on function public.resolve_trip_invite(text)               from public, anon;
revoke all on function public.request_trip_join(text)                 from public, anon;
revoke all on function public.cancel_trip_join_request(uuid)          from public, anon;
revoke all on function public.get_trip_join_requests(uuid)            from public, anon;
revoke all on function public.accept_trip_join_request(uuid, text)    from public, anon;
revoke all on function public.reject_trip_join_request(uuid)          from public, anon;

grant execute on function public.resolve_trip_invite(text)            to authenticated;
grant execute on function public.request_trip_join(text)              to authenticated;
grant execute on function public.cancel_trip_join_request(uuid)       to authenticated;
grant execute on function public.get_trip_join_requests(uuid)         to authenticated;
grant execute on function public.accept_trip_join_request(uuid, text) to authenticated;
grant execute on function public.reject_trip_join_request(uuid)       to authenticated;


-- ============================================================================
-- ⑨ trips.leader_user_id 백필 — PERSONAL 만 (docs/12 §2-1)
--
-- 개인 여행의 주인(owner_user_id)이 곧 여행장이다. 추정이 아니라 정의다.
-- GROUP 여행은 owner_user_id 가 여행장을 뜻하지 않으므로 **여기서 채우지 않는다.**
-- ============================================================================
update public.trips
   set leader_user_id = owner_user_id
 where owner_type = 'PERSONAL'
   and leader_user_id is null
   and owner_user_id is not null;


-- ============================================================================
-- ⑩ GROUP 여행 leader_user_id NULL — precheck (실행하지 않는다 · DB 담당 조회용)
--
-- 아래를 원격에서 돌려 결과를 팀에 보고한 뒤, 여행장이 명백한 행만 명시적으로 채운다.
-- "첫 멤버" 같은 규칙으로 자동 추정하지 않는다.
--
-- select
--   t.id,
--   t.destination,
--   t.owner_type,
--   t.status,
--   t.group_id,
--   g.name              as group_name,
--   g.owner_user_id     as group_owner_user_id,   -- 모임을 만든 사람. 여행장과 같을 수도, 다를 수도
--   t.created_at,
--   (select string_agg(tm.user_id::text, ',')
--      from public.trip_members tm
--     where tm.trip_id = t.id and tm.status = 'ACTIVE' and tm.user_id is not null) as active_member_ids,
--   (select count(*) from public.trip_members tm
--     where tm.trip_id = t.id and tm.status = 'ACTIVE' and tm.user_id is not null) as active_member_count,
--   (t.id::text like 'b0000000-%')                as looks_like_seed
-- from public.trips t
-- left join public.groups g on g.id = t.group_id
-- where t.owner_type = 'GROUP'
--   and t.leader_user_id is null
-- order by t.created_at;
--
-- 확정 후 채우는 형태(예시 · 실행하지 않는다):
--   update public.trips set leader_user_id = '<확정된 user id>' where id = '<trip id>';
-- ============================================================================
