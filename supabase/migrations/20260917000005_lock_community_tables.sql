-- ============================================================================
-- 커뮤니티 · 팁 · 커뮤니티 사진 권한 전환 + 글에 여행지 저장 (2026-09-17 · 필수 1 마지막 묶음)
--
-- 왜 지금인가 (trippot-dev 실측 2026-09-17)
--   community_posts · comments · tip_products · tip_purchases 에 dev_open_all(USING true /
--   WITH CHECK true · public) + anon 전권 GRANT 가 남아 있다. 누구나 남의 글을 고치고 지울 수 있다.
--   storage community-images 는 bucket 만 보는 dev 정책이라 남의 사진을 지울 수 있다.
--
-- 결정 2 — 글에 여행지를 저장한다
--   글 목록·여행지 필터는 trips(destination) 조인으로 여행지를 읽었다. 20260916000008 로 trips 를
--   참여자만 읽게 잠근 뒤로는 남의 여행 글의 여행지가 null 이 되고, 여행지 필터(trips!inner)는 남의 글을
--   전부 떨어뜨린다. 그래서 글에 destination 을 복사해 둔다.
--   - 값은 트리거가 채운다. 앱이 보낸 destination 은 무시한다(여행과 다른 여행지를 적을 수 없게).
--   - trip_id 가 바뀔 때만 다시 채운다. 나중에 여행의 여행지를 바꿔도 이미 쓴 글은 그대로다(쓴 시점 기록).
--
-- 결정 4 — 로그인 전 사용자(anon)에게는 아무것도 주지 않는다.
--
-- 바뀌는 것
--   community_posts  읽기 = 로그인 사용자, 게시 중(PUBLISHED) 이거나 내 글
--                    쓰기 = 본인 글만 · 정상 계정만 · 붙인 여행은 내가 참여한 여행만
--                    지우기 = 없음(앱은 status = DELETED 로 숨긴다)
--   comments         읽기 = 로그인 사용자, 게시 중이거나 내 댓글
--                    쓰기 = 본인 댓글만 · 정상 계정만 · 게시 중인 글에만
--   tip_products     읽기만(로그인 사용자) — 앱에서 아직 안 쓴다(BM [Future])
--   tip_purchases    내 구매만 읽기 — 쓰기는 결제 연동 때 RPC 로 연다
--   community-images 첫 폴더가 본인 uid 인 경로만 올리고·바꾸고·지운다. 읽기(공개 URL)는 그대로
--   새 표 기본 권한 postgres 가 public 에 새로 만드는 표·시퀀스에 anon 권한을 주지 않는다
--
-- 그대로인 것: users · reactions · profile-images(20260917000002) · 모임·여행 표 · 데이터 삭제 없음
--
-- rollback
--   drop trigger if exists community_posts_set_destination on public.community_posts;
--   drop function if exists public.community_posts_set_destination();
--   alter table public.community_posts drop column if exists destination;
--   각 표: 아래 정책 drop → create policy dev_open_all ... for all using (true) with check (true);
--          grant all on <표> to anon, authenticated;
--   storage: community_images_dev_insert/update/delete 복원 (20260904000002 참고)
--   alter default privileges for role postgres in schema public grant all on tables to anon;
--   alter default privileges for role postgres in schema public grant usage, select on sequences to anon;
-- ============================================================================

-- ① 글에 여행지 칼럼 ───────────────────────────────────────────────────────
alter table public.community_posts
  add column if not exists destination text;

-- 기존 글 채우기. ⚠️ 트리거보다 먼저 한다 — 트리거는 trip_id 가 그대로인 UPDATE 에서
--    destination 을 옛값으로 되돌리므로, 트리거가 있으면 이 채우기가 무효가 된다.
drop trigger if exists community_posts_set_destination on public.community_posts;
update public.community_posts p
set destination = t.destination
from public.trips t
where t.id = p.trip_id
  and p.destination is distinct from t.destination;

create or replace function public.community_posts_set_destination()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.trip_id is not distinct from old.trip_id then
    new.destination := old.destination;
    return new;
  end if;

  if new.trip_id is null then
    new.destination := null;
  else
    select t.destination into new.destination
    from public.trips t
    where t.id = new.trip_id;
  end if;

  return new;
end;
$$;
revoke all on function public.community_posts_set_destination() from public, anon, authenticated;

drop trigger if exists community_posts_set_destination on public.community_posts;
create trigger community_posts_set_destination
  before insert or update on public.community_posts
  for each row execute function public.community_posts_set_destination();

-- ② community_posts ──────────────────────────────────────────────────────
drop policy if exists dev_open_all on public.community_posts;
drop policy if exists community_posts_select on public.community_posts;
drop policy if exists community_posts_insert_self on public.community_posts;
drop policy if exists community_posts_update_self on public.community_posts;

create policy community_posts_select on public.community_posts
  for select to authenticated
  using (status = 'PUBLISHED' or author_user_id = auth.uid());

create policy community_posts_insert_self on public.community_posts
  for insert to authenticated
  with check (
    author_user_id = auth.uid()
    and public.is_account_active()
    and (trip_id is null or public.can_access_trip(trip_id))
  );

create policy community_posts_update_self on public.community_posts
  for update to authenticated
  using (author_user_id = auth.uid() and public.is_account_active())
  with check (
    author_user_id = auth.uid()
    and (trip_id is null or public.can_access_trip(trip_id))
  );

revoke all on public.community_posts from anon, authenticated;
grant select, insert, update on public.community_posts to authenticated;

-- ③ comments ─────────────────────────────────────────────────────────────
drop policy if exists dev_open_all on public.comments;
drop policy if exists comments_select on public.comments;
drop policy if exists comments_insert_self on public.comments;
drop policy if exists comments_update_self on public.comments;

create policy comments_select on public.comments
  for select to authenticated
  using (status = 'PUBLISHED' or author_user_id = auth.uid());

-- ⚠️ 바깥 표 칼럼은 public.comments.post_id 로 적는다 (CLAUDE.md 18-7)
create policy comments_insert_self on public.comments
  for insert to authenticated
  with check (
    author_user_id = auth.uid()
    and public.is_account_active()
    and exists (
      select 1 from public.community_posts p
      where p.id = public.comments.post_id
        and p.status = 'PUBLISHED'
    )
  );

create policy comments_update_self on public.comments
  for update to authenticated
  using (author_user_id = auth.uid() and public.is_account_active())
  with check (author_user_id = auth.uid());

revoke all on public.comments from anon, authenticated;
grant select, insert, update on public.comments to authenticated;

-- ④ tip_products · tip_purchases ─────────────────────────────────────────
drop policy if exists dev_open_all on public.tip_products;
drop policy if exists tip_products_select on public.tip_products;

create policy tip_products_select on public.tip_products
  for select to authenticated
  using (true);

revoke all on public.tip_products from anon, authenticated;
grant select on public.tip_products to authenticated;

drop policy if exists dev_open_all on public.tip_purchases;
drop policy if exists tip_purchases_select_own on public.tip_purchases;

create policy tip_purchases_select_own on public.tip_purchases
  for select to authenticated
  using (buyer_user_id = auth.uid());

revoke all on public.tip_purchases from anon, authenticated;
grant select on public.tip_purchases to authenticated;

-- ⑤ storage community-images — 경로 {user_id}/{파일}.jpg (lib/supabase/storage/communityImage.ts)
drop policy if exists "community_images_dev_insert" on storage.objects;
drop policy if exists "community_images_dev_update" on storage.objects;
drop policy if exists "community_images_dev_delete" on storage.objects;
drop policy if exists "community_images_insert_own" on storage.objects;
drop policy if exists "community_images_update_own" on storage.objects;
drop policy if exists "community_images_delete_own" on storage.objects;

create policy "community_images_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'community-images'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_account_active()
  );

create policy "community_images_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'community-images'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_account_active()
  )
  with check (
    bucket_id = 'community-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "community_images_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'community-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ⑥ 새 표 기본 권한 — 앞으로 만드는 표·시퀀스에 anon 권한이 자동으로 붙지 않게 한다.
--    새 표를 anon 에 열어야 하면 그 마이그레이션에서 grant 를 직접 쓴다.
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
