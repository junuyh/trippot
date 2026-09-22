-- ============================================================================
-- users 개인정보 노출 차단 — 타인은 공개 프로필 view 로만, users 는 본인 행만 (2026-09-22 · P1)
--
-- 문제 (2026-09-21 담당 범위 보안 감사)
--   users_select_authenticated 가 using (true) 였고 authenticated 에 전 컬럼 SELECT 가 있어,
--   로그인한 아무 사용자나 다른 사용자의 auth_provider_user_id(카카오 내부 id) · auth_provider ·
--   english_name(여권 영문 이름) · notification_settings_json · withdrawal_requested_at · deleted_at 을
--   읽을 수 있었다. 앱은 타인 행에서 id · name · profile_image_url 만 읽지만 DB 가 막지 않았다.
--
-- 고치는 방식 (최소 변경)
--   ① 공개 프로필 view  public.user_public_profiles (id · name · profile_image_url · 탈퇴 회원 제외)
--      - security_invoker 를 켜지 않는다(기본 false). 소유자 postgres 권한으로 읽어 users RLS 를 **일부러** 우회한다.
--        노출 컬럼이 이 셋뿐이라 그것이 곧 경계다. select * 를 쓰지 않는다.
--      - security_barrier: 사용자 정의 함수가 탈퇴 회원 행을 엿보지 못하게.
--      - authenticated 만 SELECT. anon 은 없음.
--      - 앱의 타인 조회 3곳(모임원 · 여행 멤버 · 취소 투표 이름)이 users 임베딩 대신 이 view 를 임베딩한다.
--        PostgREST 는 view 의 원본 FK(group_members.user_id → users.id 등)로 관계를 추론한다.
--   ② users SELECT 정책을 본인 행으로 좁힌다. users_select_authenticated → users_select_self (id = auth.uid()).
--      MY(프로필 · 계정 관리 · 알림 설정 · 탈퇴 상태)는 전부 본인 행이라 그대로 동작한다.
--
-- 바꾸지 않는 것
--   users_insert_self · users_update_self(is_account_active 포함) · 컬럼 GRANT · 다른 표의 정책.
--   SECURITY DEFINER 함수들(is_account_active · 초대 RPC 의 inviter_name 등)은 정의자 권한이라 영향 없음.
--   users 를 참조하는 다른 표의 RLS 정책 · non-definer 함수는 0개(2026-09-22 확인).
--
-- 되돌리기
--   drop policy if exists users_select_self on public.users;
--   create policy users_select_authenticated on public.users for select to authenticated using (true);
--   drop view if exists public.user_public_profiles;
-- ============================================================================

-- ── ① 공개 프로필 view ────────────────────────────────────────────────────────
create or replace view public.user_public_profiles
  with (security_barrier = true)
as
  select
    u.id,
    u.name,
    u.profile_image_url
  from public.users u
  where u.deleted_at is null;

alter view public.user_public_profiles owner to postgres;

comment on view public.user_public_profiles is
  '다른 사용자에게 보여도 되는 프로필 3컬럼(id · name · profile_image_url). 탈퇴 회원 제외. users 직접 조회는 본인 행뿐이다. (2026-09-22)';

revoke all on public.user_public_profiles from public, anon;
grant select on public.user_public_profiles to authenticated;

-- ── ② users SELECT = 본인 행만 ───────────────────────────────────────────────
drop policy if exists users_select_authenticated on public.users;
drop policy if exists users_select_self on public.users;
create policy users_select_self
  on public.users
  for select
  to authenticated
  using (id = auth.uid());
