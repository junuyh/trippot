-- ============================================================================
-- 여행 초대 링크 get-or-create RPC · trip_invites 권한 확정
--
-- 기준 문서: docs/10_여행초대정책_v1.md §2 · §4 · §5 · §6
-- 원안: 초대 기능 담당이 보낸 실행 요청 2건(RPC · 권한 재정의). DB 담당이 옮겨 적용한다.
-- 작성일: 2026-09-11
--
-- ── 이 파일이 끝낸 뒤의 권한 구조 ────────────────────────────────────────────
--
--   [발신자 · ACTIVE 여행 멤버]
--     SELECT trip_invites        가능 (RLS trip_invites_select_active_member)
--     새 링크 발급               get_or_create_trip_invite() RPC 한 경로
--     직접 INSERT / UPDATE       불가 (GRANT 회수)
--
--   [수신자 · 아직 멤버 아님]
--     trip_invites 직접 SELECT   불가
--     token 검증                 Edge Function → service_role
--
--   [service_role]
--     trip_invites 직접 접근     가능 (③ GRANT)
--
-- ── 요청 SQL 에서 더한 것 두 가지 ──────────────────────────────────────────
--
--   요청이 적은 "최종 권한 구조" 가 실제로 성립하도록 채운 것이다. 새 정책이 아니다.
--
--   ⑴ dev_open_all 을 이 표에서만 drop 한다.
--      요청은 "invites_owner 를 지우고 멤버 정책으로 교체" 였는데, invites_owner 는
--      20260910000001 하단의 **주석**이라 원격에 없다. 원격에서 실제로 걸려 있던 건
--      dev_open_all(using true · 대상 public) 하나다.
--      permissive 정책은 OR 로 합쳐지므로 이걸 두면 멤버 정책을 더해도 누구나
--      모든 token 을 읽는다. → "수신자 직접 SELECT 불가" 가 거짓이 된다.
--      다른 표의 dev_open_all 은 건드리지 않는다.
--
--   ⑵ service_role 에 GRANT 를 준다.
--      service_role 은 RLS 는 우회하지만 **테이블 GRANT 는 우회하지 않는다.**
--      지금 이 표의 service_role 권한은 REFERENCES · TRIGGER · TRUNCATE 뿐이라
--      수신자용 Edge Function 의 token 조회가 42501 로 막힌다.
--      20260907000002 가 같은 이유로 고친 것과 같은 판단이다.
--
-- ⚠️ 20260910000001 을 고치지 않는다. 그 파일 하단의 배포용 RLS 초안
--    (invites_owner · 여행장 전용)은 이 파일로 **대체됐다.** 주석은 이력으로 남긴다.
--
-- ⚠️ trip_join_requests 는 건드리지 않는다. dev_open_all 그대로이고,
--    수락 권한은 여행장으로 유지한다 (배포 전 join_req_self_or_owner 로 교체).
--
-- ⚠️ 두 번 실행해도 안전하게 썼다. create or replace · drop policy if exists.
-- ============================================================================


-- ============================================================================
-- ① get_or_create_trip_invite(p_trip_id) — 여행 초대 링크 발급의 유일한 통로
--
-- 정책 §4 (POL-INV-014) 를 그대로 옮긴다.
--   · 유효한 링크가 있으면 새로 만들지 않고 그대로 돌려준다
--   · 없을 때만 새 token 을 만들고, 그 시점부터 7일
--   · 누가 눌러도 같다. 처음 만든 사람이 아니어도 기존 링크를 받는다
--
-- ⚠️ token 을 앱이 만들지 않는다. 서버에서 gen_random_bytes(32) 로 만든다.
--    (20260910000001 의 "앱이 만들어 넣는다" 주석은 이 함수로 대체된다 · 문서 §8-2)
--
-- ⚠️ 동시성 — 두 멤버가 동시에 눌러도 링크가 두 개 생기면 안 된다 (§4-3 invariant).
--    SELECT 로 확인하고 INSERT 하는 사이에 끼어들 수 있으므로, 먼저 그 여행의
--    trips 행을 잠가 같은 여행의 요청을 한 줄로 세운다.
--    다른 여행끼리는 서로 막지 않는다.
--
-- ⚠️ security definer 다. RLS 를 우회하므로 권한 확인을 함수 안에서 직접 한다.
--    여행장 여부는 보지 않는다. ACTIVE 여행 멤버면 된다 (§2).
--
-- ⚠️ RETURNS TABLE 의 token · expires_at 은 plpgsql 안에서 변수 이름이 된다.
--    칼럼을 부를 때는 반드시 ti. / trip_invites. 를 붙인다. 안 붙이면
--    변수와 칼럼 중 무엇인지 모호하다는 오류가 난다.
--
-- ⚠️ gen_random_bytes 는 extensions. 를 붙여 부른다.
--    Supabase 는 pgcrypto 를 public 이 아니라 **extensions 스키마**에 둔다.
--    search_path 를 public, pg_temp 로 잠갔으므로 맨 이름으로 부르면
--    42883(function does not exist)이 난다. 원격 dry-run 에서 실제로 났다.
--    search_path 에 extensions 를 더하지 않고 이름을 붙이는 이유:
--    security definer 함수의 search_path 는 좁을수록 안전하다.
-- ============================================================================
create or replace function public.get_or_create_trip_invite(
  p_trip_id uuid
)
returns table (
  invite_id uuid,
  token text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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
$$;

comment on function public.get_or_create_trip_invite(uuid)
is 'ACTIVE 여행 멤버용 여행 초대 링크 get-or-create. 유효 링크는 7일간 재사용하고 만료 후에만 신규 생성한다.';

comment on column public.trip_invites.token
is '여행 초대 링크 식별용 랜덤 token. get_or_create_trip_invite()에서 생성한다.';

comment on column public.trip_invites.created_by
is '현재 초대 token을 최초 생성한 ACTIVE 여행 멤버';

comment on column public.trip_invites.expires_at
is '여행 초대 링크 만료 시각. 신규 발급 시 DB 서버 시각 기준 7일';

comment on column public.trip_invites.revoked_at
is '별도 폐기 시각. 정상적인 7일 만료 및 만료 후 재발급에서는 사용하지 않는다.';


-- ── ①-1 실행 권한 ───────────────────────────────────────────────────────────
--
-- 함수는 만들어지는 순간 PUBLIC 에 EXECUTE 가 붙는다. 먼저 걷어 낸다.
-- anon 은 호출 불가. authenticated 라도 ACTIVE 멤버가 아니면 함수 안에서 막힌다.
revoke all on function public.get_or_create_trip_invite(uuid) from public;
revoke all on function public.get_or_create_trip_invite(uuid) from anon;
grant execute on function public.get_or_create_trip_invite(uuid) to authenticated;


-- ============================================================================
-- ② trip_invites RLS — ACTIVE 여행 멤버 SELECT
--
-- ⚠️⚠️ tm.trip_id = trip_id 로 쓰지 않는다.
--       서브쿼리 안에서 맨 이름 trip_id 는 **안쪽 tm.trip_id** 로 묶여
--       tm.trip_id = tm.trip_id — 항상 참이 되고, 표가 통째로 열린다.
--       반드시 public.trip_invites.trip_id 로 바깥 행을 가리킨다.
--
-- INSERT · UPDATE · DELETE 정책은 두지 않는다. 정책이 없으면 RLS 가 막는다.
-- 발급은 ① RPC(security definer)가, 폐기는 service_role 이 맡는다.
-- ============================================================================
drop policy if exists "dev_open_all" on public.trip_invites;     -- ⑴ 파일 상단 참조
drop policy if exists "invites_owner" on public.trip_invites;    -- 원격에 없다. 요청대로 남긴다
drop policy if exists "trip_invites_select_active_member" on public.trip_invites;

create policy "trip_invites_select_active_member"
on public.trip_invites
for select
to authenticated
using (
  exists (
    select 1
    from public.trip_members tm
    where tm.trip_id = public.trip_invites.trip_id
      and tm.user_id = auth.uid()
      and tm.status = 'ACTIVE'
  )
);

grant select on public.trip_invites to authenticated;


-- ============================================================================
-- ③ trip_invites GRANT — 앱 쓰기 회수 · service_role 부여
--
-- 앱은 이 표에 직접 쓰지 않는다. (현재 앱에 trip_invites 쓰기 코드 없음)
--   INSERT → ① RPC 한 경로
--   UPDATE → revoked_at 은 MVP 정상 흐름에서 쓰지 않는다 (§5-1).
--            강제 폐기 기능이 생기면 service_role 경로에서만 수정
--
-- ⚠️ service_role 은 수신자용 Edge Function 의 token 검증 주체다.
--    GRANT 없이는 RLS 를 우회해도 42501 로 막힌다. (⑵ 파일 상단 참조)
-- ============================================================================
revoke insert on public.trip_invites from anon, authenticated;
revoke update on public.trip_invites from anon, authenticated;

grant select, insert, update, delete
  on public.trip_invites
  to service_role;
