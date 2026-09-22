-- ============================================================================
-- user_public_profiles — 쓰기 권한 회수 (2026-09-22 · 20260922000001 의 보완)
--
-- 왜 필요한가
--   20260922000001 이 view 를 만들 때 이 DB 의 default privileges(postgres · anon/authenticated/
--   service_role 에 ALL) 가 authenticated 에 INSERT · UPDATE · DELETE · TRUNCATE · REFERENCES ·
--   TRIGGER 까지 자동으로 붙였다. 그 파일은 anon · public 만 회수하고 authenticated 에는
--   select 를 "추가" 했을 뿐이라 쓰기 권한이 남았다.
--   view 는 소유자(postgres · bypassrls) 권한으로 실행되는 단순 view 라 자동 갱신(auto-updatable)
--   된다. 즉 authenticated 가 view 를 통해 **다른 사용자의 name · profile_image_url 을 고칠 수 있었다.**
--   (적용 직후 롤백 트랜잭션 검증에서 발견 · 실제 데이터 변경 없음)
--
-- 고치는 것
--   authenticated · anon · public 의 쓰기 계열 권한을 전부 회수하고 select 만 남긴다.
--   ⚠️ 앞으로 public 스키마에 view 를 만들 때는 반드시 revoke 부터 한다.
--
-- 되돌리기 (권장하지 않음)
--   grant insert, update, delete on public.user_public_profiles to authenticated;
-- ============================================================================
revoke insert, update, delete, truncate, references, trigger
  on public.user_public_profiles
  from public, anon, authenticated;
revoke all on public.user_public_profiles from anon;
grant select on public.user_public_profiles to authenticated;
