-- ============================================================================
-- 여행 멤버십 · 권한 보안 마무리 (2026-09-17 · docs/16_여행멤버십_보안_v1.md)
--
-- 범위: 여행 초대 → 참여 요청 → 승인 → 참여 → 나가기 / 취소 / 여행장 위임 의 권한 lifecycle.
--   groups · group_members · trip_members · trip_invites 의 RLS/GRANT 와 그 흐름의 RPC 14개.
--   화면 · community · notifications · budget 등 다른 도메인은 손대지 않는다.
--
-- 왜 지금인가 (audit 2026-09-17 · trippot-dev 실측)
--   P0  groups · group_members: dev_open_all(USING true / WITH CHECK true · public) + anon 전권 GRANT
--       → 누구나 남의 모임을 만들고 · 남을 멤버로 넣고 · 모임을 지울 수 있었다.
--   P0  trip_members INSERT 정책이 can_access_trip(trip_id) 뿐 → 참여자가 아무 user_id 나 ACTIVE 멤버로
--       직접 INSERT 해 여행장 승인을 우회할 수 있었다. 앱은 여행 생성 때 본인 행만 넣는다(budget-fund.tsx).
--   P1  trip_invites: anon SELECT/DELETE/TRUNCATE/REFERENCES/TRIGGER, authenticated DELETE GRANT 잔존
--       (정책은 ACTIVE 멤버 SELECT 뿐이라 실제 노출은 없었지만 GRANT 자체가 과함).
--   P1  탈퇴 대기(PENDING_WITHDRAWAL) 계정이 API 로 직접 초대 · 요청 · 승인 · 나가기 · 취소 · 위임 RPC 를
--       부를 수 있었다(AuthGate 는 앱만 막는다). 위임 대상이 탈퇴 대기 계정일 수도 있었다.
--   P1  취소 · 삭제된 여행에 새 초대 링크 생성 / 참여 요청이 가능했다(승인 단계에서만 막혔다).
--
-- 지키는 것
--   - 기존 확정 정책 그대로: ACTIVE 참여자만 초대 · 유효 링크 재사용(7일) · 승인 후 참여 · ACTIVE 참여자 = 모임 멤버 ·
--     PLANNING 에서 나가기 · 나가도 모임 멤버 유지(p_also_leave_group 은 사용자 선택) · 여행장은 위임 후 나가기 ·
--     취소는 전원 동의(CANCEL_PENDING) · 기록 삭제 없음.
--   - RPC 본문은 pg_get_functiondef 원문에 guard 만 끼워 넣었다(아래 각 함수의 '(2026-09-17 · migration
--     20260917000003)' 주석 줄). 권한(GRANT)은 create or replace 가 보존한다.
--   - 여기서 데이터를 바꾸는 문장은 없다(DDL · 정책 · GRANT 만).
--
-- rollback:
--   정책: 아래 create policy 들을 drop 하고 dev_open_all(groups · group_members) · trip_members_insert 를 되살린다.
--   GRANT: grant all on public.groups, public.group_members, public.trip_invites to anon, authenticated;
--   RPC: 각 함수의 직전 정의는 20260913000001 · 20260916000001/000003/000004/000005/000009 에 있다.
--   drop function if exists public.is_group_member(uuid);
-- ============================================================================

-- ① helper — 내가 이 모임의 ACTIVE 멤버인가. group_members 정책이 자기 표를 다시 보는 재귀를 피하려고 definer 로 둔다.
create or replace function public.is_group_member(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members gm
    where gm.group_id = p_group_id
      and gm.user_id = auth.uid()
      and gm.status = 'ACTIVE'
  );
$$;
revoke all on function public.is_group_member(uuid) from public, anon;
grant execute on function public.is_group_member(uuid) to authenticated;

-- ② groups — 멤버·owner 만 읽고, 만드는 사람이 owner, 이름 수정은 멤버, 삭제는 생성 직후 롤백(10분)만.
drop policy if exists dev_open_all on public.groups;
drop policy if exists groups_select_member on public.groups;
drop policy if exists groups_insert_owner on public.groups;
drop policy if exists groups_update_member on public.groups;
drop policy if exists groups_delete_owner_recent on public.groups;

create policy groups_select_member on public.groups
  for select to authenticated
  using (owner_user_id = auth.uid() or public.is_group_member(id));

create policy groups_insert_owner on public.groups
  for insert to authenticated
  with check (owner_user_id = auth.uid() and public.is_account_active());

create policy groups_update_member on public.groups
  for update to authenticated
  using (public.is_group_member(id) and public.is_account_active())
  with check (public.is_group_member(id));

-- 생성 직후 멤버 INSERT 가 실패했을 때의 롤백 경로(queries/groups.ts createGroup · app/groups/new.tsx)만 허용.
create policy groups_delete_owner_recent on public.groups
  for delete to authenticated
  using (owner_user_id = auth.uid() and created_at > now() - interval '10 minutes');

revoke all on public.groups from anon;
revoke truncate, references, trigger on public.groups from authenticated;

-- ③ group_members — 내 행과 내가 속한 모임의 멤버만 읽는다. INSERT 는 모임 owner 가 만들 때만
--    (본인 OWNER 행 · 모임 만들기에서 고른 사람). 그 뒤의 멤버 변화(승인 · 나가기 · 탈퇴)는 전부 definer RPC 다.
drop policy if exists dev_open_all on public.group_members;
drop policy if exists group_members_select_member on public.group_members;
drop policy if exists group_members_insert_owner on public.group_members;

create policy group_members_select_member on public.group_members
  for select to authenticated
  using (user_id = auth.uid() or public.is_group_member(group_id));

create policy group_members_insert_owner on public.group_members
  for insert to authenticated
  with check (
    public.is_account_active()
    and exists (
      select 1 from public.groups g
      where g.id = group_id and g.owner_user_id = auth.uid()
    )
  );

revoke all on public.group_members from anon;
revoke update, delete, truncate, references, trigger on public.group_members from authenticated;

-- ④ trip_members — 직접 INSERT 는 본인 행뿐(여행 생성 때 만드는 사람 자신). 남을 ACTIVE 로 넣는 길은 승인 RPC 뿐.
drop policy if exists trip_members_insert on public.trip_members;
drop policy if exists trip_members_insert_self on public.trip_members;

create policy trip_members_insert_self on public.trip_members
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.can_access_trip(trip_id)
    and public.is_account_active()
  );

revoke all on public.trip_members from anon;
revoke update, delete, truncate, references, trigger on public.trip_members from authenticated;

-- ⑤ trip_invites — token 표. 앱은 RPC 로만 쓴다. 남은 GRANT 를 거둔다(정책은 ACTIVE 멤버 SELECT 그대로).
revoke all on public.trip_invites from anon;
revoke insert, update, delete, truncate, references, trigger on public.trip_invites from authenticated;

-- ⑥ RPC 14개 — 원문 + guard.
--    · 모든 함수: AUTH_REQUIRED 다음에 is_account_active() 검사(ACCOUNT_NOT_ACTIVE)
--    · get_or_create_trip_invite: 취소·삭제 여행 TRIP_NOT_OPEN
--    · request_trip_join: 취소·삭제 여행 TRIP_NOT_OPEN
--    · delegate_trip_leader: 탈퇴 대기·완료 계정은 INVALID_TARGET

-- ── get_or_create_trip_invite ──
CREATE OR REPLACE FUNCTION public.get_or_create_trip_invite(p_trip_id uuid)
 RETURNS TABLE(invite_id uuid, token text, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_invite_id uuid;
  v_token text;
  v_expires_at timestamptz;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication required';
  end if;
  -- 탈퇴 대기(PENDING_WITHDRAWAL) · 탈퇴 완료 계정은 여행 권한 변경을 할 수 없다. (2026-09-17 · migration 20260917000003)
  if not public.is_account_active() then
    raise exception using errcode = '42501', message = 'ACCOUNT_NOT_ACTIVE';
  end if;

  -- 같은 여행의 초대 생성 요청 직렬화
  perform 1
  from public.trips t
  where t.id = p_trip_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Trip not found';
  end if;
  -- 취소 · 삭제된 여행에는 새 초대를 만들지 않는다. (accept_trip_join_request 의 TRIP_NOT_OPEN 과 같은 기준)
  if exists (
    select 1 from public.trips t
    where t.id = p_trip_id and t.status in ('DELETED', 'CANCELED')
  ) then
    raise exception using errcode = '22023', message = 'TRIP_NOT_OPEN';
  end if;

  -- 여행장이 아니라도 ACTIVE 여행 멤버면 초대 가능 (§2)
  if not exists (
    select 1
    from public.trip_members tm
    where tm.trip_id = p_trip_id
      and tm.user_id = v_user_id
      and tm.status = 'ACTIVE'
  ) then
    raise exception using
      errcode = '42501',
      message = 'Active trip member required';
  end if;

  -- 아직 유효한 링크가 있으면 재사용
  select
    ti.id,
    ti.token,
    ti.expires_at
  into
    v_invite_id,
    v_token,
    v_expires_at
  from public.trip_invites ti
  where ti.trip_id = p_trip_id
    and ti.revoked_at is null
    and ti.expires_at > now()
  order by ti.created_at desc
  limit 1;

  if found then
    return query
    select v_invite_id, v_token, v_expires_at;
    return;
  end if;

  -- 유효 링크가 없을 때만 신규 생성
  insert into public.trip_invites (
    trip_id,
    token,
    created_by,
    expires_at
  )
  values (
    p_trip_id,
    encode(extensions.gen_random_bytes(32), 'hex'),
    v_user_id,
    now() + interval '7 days'
  )
  returning
    id,
    trip_invites.token,
    trip_invites.expires_at
  into
    v_invite_id,
    v_token,
    v_expires_at;

  return query
  select v_invite_id, v_token, v_expires_at;
end;
$function$
;

-- ── request_trip_join ──
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
      '여행 참여 요청이 도착했어요',
      public.notification_person_label(v_actor) || '님이 '
        || public.notification_trip_label(v_trip.destination) || ' 참여를 요청했어요.',
      v_inv.trip_id,
      jsonb_build_object('requestId', v_req.id, 'inviteId', v_inv.id, 'actorUserId', v_uid)
    );
  end if;

  return query select v_req.id, v_req.trip_id, v_req.status;
end;
$function$
;

-- ── request_trip_join_by_invite ──
CREATE OR REPLACE FUNCTION public.request_trip_join_by_invite(p_invite_id uuid)
 RETURNS TABLE(request_id uuid, trip_id uuid, status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid   uuid := auth.uid();
  v_token text;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;
  -- 탈퇴 대기(PENDING_WITHDRAWAL) · 탈퇴 완료 계정은 여행 권한 변경을 할 수 없다. (2026-09-17 · migration 20260917000003)
  if not public.is_account_active() then
    raise exception using errcode = '42501', message = 'ACCOUNT_NOT_ACTIVE';
  end if;

  select ti.token into v_token from public.trip_invites ti where ti.id = p_invite_id;

  if v_token is null or not public.notification_invite_access(p_invite_id, v_uid) then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;

  return query select * from public.request_trip_join(v_token);
end;
$function$
;

-- ── cancel_trip_join_request ──
CREATE OR REPLACE FUNCTION public.cancel_trip_join_request(p_request_id uuid)
 RETURNS TABLE(request_id uuid, status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_req public.trip_join_requests%rowtype;
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
$function$
;

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
  -- 탈퇴 대기(PENDING_WITHDRAWAL) · 탈퇴 완료 계정은 여행 권한 변경을 할 수 없다. (2026-09-17 · migration 20260917000003)
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

-- ── reject_trip_join_request ──
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
    '여행 참여 요청이 거절됐어요',
    public.notification_trip_label(v_trip.destination) || ' 참여 요청이 거절됐어요.',
    v_trip.id,
    jsonb_build_object('requestId', p_request_id)
  );

  return query select p_request_id, 'REJECTED'::text;
end;
$function$
;

-- ── leave_trip ──
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
  -- 탈퇴 대기(PENDING_WITHDRAWAL) · 탈퇴 완료 계정은 여행 권한 변경을 할 수 없다. (2026-09-17 · migration 20260917000003)
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
  -- 탈퇴 대기 · 탈퇴 완료 계정은 새 여행장이 될 수 없다.
  if exists (
    select 1 from public.users u
    where u.id = p_to_user_id and (u.deleted_at is not null or u.withdrawal_requested_at is not null)
  ) then
    raise exception using errcode = '22023', message = 'INVALID_TARGET';
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

-- ── delegate_and_leave ──
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

-- ── request_trip_cancel ──
CREATE OR REPLACE FUNCTION public.request_trip_cancel(p_trip_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid      uuid := auth.uid();
  v_trip     public.trips%rowtype;
  v_existing public.trip_cancel_requests%rowtype;
  v_targets  integer;
  v_new_id   uuid;
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

  if not exists (
    select 1 from public.trip_members tm
    where tm.trip_id = p_trip_id and tm.user_id = v_uid and tm.status = 'ACTIVE'
  ) then
    raise exception using errcode = '42501', message = 'NOT_MEMBER';
  end if;

  select * into v_existing
  from public.trip_cancel_requests r
  where r.trip_id = p_trip_id and r.status = 'PENDING'
  limit 1;

  if found then
    return jsonb_build_object('outcome', 'PENDING', 'request_id', v_existing.id);
  end if;

  if v_trip.status <> 'PLANNING' then
    raise exception using errcode = '22023', message = 'NOT_CANCELABLE';
  end if;

  insert into public.trip_cancel_requests (trip_id, requested_by, reason, expires_at)
  values (p_trip_id, v_uid, p_reason, now() + interval '7 days')
  returning id into v_new_id;

  select count(distinct tm.user_id)::integer into v_targets
  from public.trip_members tm
  where tm.trip_id = p_trip_id
    and tm.status = 'ACTIVE'
    and tm.user_id is not null
    and tm.user_id <> v_uid;

  if v_targets = 0 then
    perform public._trip_cancel_confirm(p_trip_id, v_new_id);
    return jsonb_build_object('outcome', 'CANCELED', 'request_id', v_new_id);
  end if;

  update public.trips t set status = 'CANCEL_PENDING' where t.id = p_trip_id;

  perform public._notify_trip_members(
    p_trip_id, v_uid, 'CANCEL_REQUESTED',
    '여행 취소 요청이 왔어요',
    public.notification_trip_label(v_trip.destination) || '을 취소할지 정해 주세요.',
    jsonb_build_object('requestId', v_new_id)
  );

  return jsonb_build_object('outcome', 'PENDING', 'request_id', v_new_id);
end;
$function$
;

-- ── cast_trip_cancel_vote ──
CREATE OR REPLACE FUNCTION public.cast_trip_cancel_vote(p_request_id uuid, p_vote text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid   uuid := auth.uid();
  v_req   public.trip_cancel_requests%rowtype;
  v_trip  public.trips%rowtype;
  v_tally record;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;
  -- 탈퇴 대기(PENDING_WITHDRAWAL) · 탈퇴 완료 계정은 여행 권한 변경을 할 수 없다. (2026-09-17 · migration 20260917000003)
  if not public.is_account_active() then
    raise exception using errcode = '42501', message = 'ACCOUNT_NOT_ACTIVE';
  end if;

  if p_vote not in ('AGREE', 'DISAGREE') then
    raise exception using errcode = '22023', message = 'INVALID_TARGET';
  end if;

  select * into v_req from public.trip_cancel_requests r where r.id = p_request_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;

  if v_req.status <> 'PENDING' then
    raise exception using errcode = '22023', message = 'REQUEST_NOT_PENDING';
  end if;

  select * into v_trip from public.trips t where t.id = v_req.trip_id;

  -- ⚠️ 여기서 요청을 닫지 않는다. 바로 아래 raise 가 트랜잭션을 되돌려서
  --    닫은 것도 같이 사라진다. 20260916000004 가 그렇게 돼 있었다 —
  --    닫는 시늉만 하고 실제로는 아무 일도 일어나지 않았다. (2026-09-16 발견)
  --    실제로 닫는 일은 조회 시점의 expire_trip_cancel_request 가 한다.
  if now() >= v_req.expires_at
     or (v_trip.start_date is not null and (now() at time zone 'utc')::date >= v_trip.start_date)
  then
    raise exception using errcode = '22023', message = 'REQUEST_EXPIRED';
  end if;

  if not exists (
    select 1 from public.trip_members tm
    where tm.trip_id = v_req.trip_id and tm.user_id = v_uid and tm.status = 'ACTIVE'
  ) then
    raise exception using errcode = '42501', message = 'NOT_MEMBER';
  end if;

  if v_uid = v_req.requested_by then
    raise exception using errcode = '42501', message = 'REQUESTER_CANNOT_VOTE';
  end if;

  begin
    insert into public.trip_cancel_votes (request_id, user_id, vote)
    values (p_request_id, v_uid, p_vote);
  exception when unique_violation then
    raise exception using errcode = '23505', message = 'ALREADY_VOTED';
  end;

  if p_vote = 'DISAGREE' then
    perform public._trip_cancel_close(v_req.id, v_req.trip_id, 'REJECTED', 'DISAGREED');
    return 'REJECTED';
  end if;

  select * into v_tally from public._trip_cancel_tally(p_request_id);

  if v_tally.agreed_count >= v_tally.target_count then
    perform public._trip_cancel_confirm(v_req.trip_id, v_req.id);
    return 'APPROVED';
  end if;

  -- 아직 모자라다. 요청자에게만 진행 상황을 알린다.
  perform public.create_notification(
    v_req.requested_by, 'CANCEL_VOTE_AGREED',
    '취소에 동의한 사람이 있어요',
    public.notification_trip_label(v_trip.destination) || ' 취소에 '
      || v_tally.target_count || '명 중 ' || v_tally.agreed_count || '명이 동의했어요.',
    v_req.trip_id,
    jsonb_build_object('requestId', v_req.id)
  );

  return 'PENDING';
end;
$function$
;

-- ── withdraw_trip_cancel_request ──
CREATE OR REPLACE FUNCTION public.withdraw_trip_cancel_request(p_request_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_req public.trip_cancel_requests%rowtype;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;
  -- 탈퇴 대기(PENDING_WITHDRAWAL) · 탈퇴 완료 계정은 여행 권한 변경을 할 수 없다. (2026-09-17 · migration 20260917000003)
  if not public.is_account_active() then
    raise exception using errcode = '42501', message = 'ACCOUNT_NOT_ACTIVE';
  end if;

  select * into v_req from public.trip_cancel_requests r where r.id = p_request_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;

  if v_req.requested_by <> v_uid then
    raise exception using errcode = '42501', message = 'NOT_REQUESTER';
  end if;

  -- 이미 닫혔으면 아무 일도 하지 않는다 (멱등)
  if v_req.status <> 'PENDING' then
    return;
  end if;

  perform public._trip_cancel_close(v_req.id, v_req.trip_id, 'WITHDRAWN', 'WITHDRAWN');
end;
$function$
;

-- ── restore_canceled_trip ──
CREATE OR REPLACE FUNCTION public.restore_canceled_trip(p_trip_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid  uuid := auth.uid();
  v_trip public.trips%rowtype;
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

  if not exists (
    select 1 from public.trip_members tm
    where tm.trip_id = p_trip_id and tm.user_id = v_uid and tm.status = 'ACTIVE'
  ) then
    raise exception using errcode = '42501', message = 'NOT_MEMBER';
  end if;

  if v_trip.status <> 'CANCELED' then
    raise exception using errcode = '22023', message = 'NOT_CANCELED';
  end if;

  if v_trip.canceled_at is null or now() >= v_trip.canceled_at + interval '72 hours' then
    raise exception using errcode = '22023', message = 'RESTORE_WINDOW_CLOSED';
  end if;

  update public.trips t
     set status                      = 'PLANNING',
         canceled_at                 = null,
         canceled_by                 = null,
         cancel_reason               = null,
         canceled_fund_snapshot_json = null
   where t.id = p_trip_id
     and t.status = 'CANCELED';

  perform public._notify_trip_members(
    p_trip_id, v_uid, 'CANCEL_RESTORED',
    '여행을 다시 준비해요',
    public.notification_trip_label(v_trip.destination) || ' 취소를 되돌렸어요.'
  );
end;
$function$
;

-- ── expire_trip_cancel_request ──
CREATE OR REPLACE FUNCTION public.expire_trip_cancel_request(p_trip_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid  uuid := auth.uid();
  v_req  public.trip_cancel_requests%rowtype;
  v_trip public.trips%rowtype;
  v_note text;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;
  -- 탈퇴 대기(PENDING_WITHDRAWAL) · 탈퇴 완료 계정은 여행 권한 변경을 할 수 없다. (2026-09-17 · migration 20260917000003)
  if not public.is_account_active() then
    raise exception using errcode = '42501', message = 'ACCOUNT_NOT_ACTIVE';
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
$function$
;
