-- ============================================================================
-- MY 범위 보안 정리 (2026-09-17 · MY Finalization)
--
-- 대상은 MY 화면과 MY 기능이 실제로 쓰는 객체뿐이다.
--   public.users            프로필 조회/수정 · ensureUserProfile · 탈퇴 상태
--   public.reactions        MY 좋아요 · 저장(BOOKMARK) 목록 · 저장/해제
--   storage profile-images  MY 프로필 사진 업로드/교체/삭제
--   finalize_withdrawals    Edge Function(withdrawal-cleanup · service_role) 이 파일 정리 뒤 호출
-- 다른 도메인(groups · trips · community_posts · comments · 초대 · 알림)의 정책은 손대지 않는다.
--
-- 왜 지금인가
--   users · reactions 에는 개발용 dev_open_all(USING true / WITH CHECK true · public) 과 anon 전권 GRANT 가
--   남아 있었다. 누구든 남의 프로필을 고치고, 남의 user_id 로 반응을 남기거나 지울 수 있는 상태였다(P0).
--   profile-images 는 bucket 만 보는 dev 정책이라 남의 폴더에 쓰고 지울 수 있었다(P0).
--
-- 탈퇴 대기(PENDING_WITHDRAWAL) 계정 — 앱 진입은 AuthGate 가 막고, 여기서는 MY 범위의 직접 mutation 도 막는다:
--   is_account_active() 가 false 면 프로필 수정 · 반응 · 프로필 사진 쓰기가 전부 거부된다.
--   (탈퇴 취소는 SECURITY DEFINER RPC 라 영향 없다)
--
-- rollback:
--   drop policy ... (아래 정책 이름들) ; create policy dev_open_all on public.users/reactions for all using (true) with check (true);
--   grant all on public.users, public.reactions to anon, authenticated;
--   storage: profile_images_dev_* 정책 복원 (20260902000003 참고)
--   revoke execute on function public.finalize_withdrawals() from service_role;
--   drop function if exists public.is_account_active();
-- ============================================================================

-- ① 계정이 정상(ACTIVE)인가. 탈퇴 대기 · 탈퇴 완료면 false. 정책 안에서 쓰는 작은 helper.
create or replace function public.is_account_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid()
      and u.deleted_at is null
      and u.withdrawal_requested_at is null
  );
$$;
revoke all on function public.is_account_active() from public, anon;
grant execute on function public.is_account_active() to authenticated;

-- ② users — 로그인 사용자는 다른 사람의 이름·사진을 읽을 수 있어야 한다(멤버 목록 · 글 작성자).
--    쓰기는 본인 행만. 삭제는 없다(탈퇴는 RPC).
drop policy if exists dev_open_all on public.users;
drop policy if exists users_select_authenticated on public.users;
drop policy if exists users_insert_self on public.users;
drop policy if exists users_update_self on public.users;

create policy users_select_authenticated on public.users
  for select to authenticated
  using (true);

-- ensureUserProfile: 첫 로그인 때 auth.uid() 와 같은 id 로만 만든다.
create policy users_insert_self on public.users
  for insert to authenticated
  with check (id = auth.uid());

-- 이름 · 영문 이름 · 사진 · 알림 설정: 본인 + 정상 계정만. id 는 바꿀 수 없다(with check 가 막는다).
create policy users_update_self on public.users
  for update to authenticated
  using (id = auth.uid() and public.is_account_active())
  with check (id = auth.uid());

revoke all on public.users from anon;
revoke delete, truncate, references, trigger on public.users from authenticated;

-- ③ reactions — 좋아요 · 싫어요 · 저장. 개수는 모두 읽되, 쓰기는 본인 user_id 로만.
--    upsert(ignoreDuplicates) 는 insert + select 만 쓴다. update 경로는 없다.
drop policy if exists dev_open_all on public.reactions;
drop policy if exists reactions_select_authenticated on public.reactions;
drop policy if exists reactions_insert_self on public.reactions;
drop policy if exists reactions_delete_self on public.reactions;

create policy reactions_select_authenticated on public.reactions
  for select to authenticated
  using (true);

create policy reactions_insert_self on public.reactions
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_account_active());

create policy reactions_delete_self on public.reactions
  for delete to authenticated
  using (user_id = auth.uid());

revoke all on public.reactions from anon;
revoke update, truncate, references, trigger on public.reactions from authenticated;

-- ④ storage profile-images — 첫 폴더가 본인 uid 인 경로만 쓰고 지운다. 읽기(공개 URL)는 그대로.
--    community-images 정책은 다른 도메인이라 손대지 않는다.
drop policy if exists "profile_images_dev_insert" on storage.objects;
drop policy if exists "profile_images_dev_update" on storage.objects;
drop policy if exists "profile_images_dev_delete" on storage.objects;
drop policy if exists "profile_images_insert_own" on storage.objects;
drop policy if exists "profile_images_update_own" on storage.objects;
drop policy if exists "profile_images_delete_own" on storage.objects;

create policy "profile_images_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_account_active()
  );

create policy "profile_images_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_account_active()
  )
  with check (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "profile_images_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ⑤ 최종 탈퇴 처리 — Edge Function(withdrawal-cleanup) 이 service_role 로 부른다. 앱 role 은 여전히 불가.
grant execute on function public.finalize_withdrawals() to service_role;
