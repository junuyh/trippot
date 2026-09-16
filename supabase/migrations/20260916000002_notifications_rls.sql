-- ============================================================================
-- notifications RLS ② — 클라이언트 최소권한 (docs/13_알림센터_v1.md §10) · 2026-09-16
--
-- 대상: trippot-dev (pzwabphxitubsioyhgkk) · public.notifications 만
--
-- 끝난 뒤의 상태
--   authenticated : 본인 행 SELECT · 본인 행 DELETE · 본인 행 UPDATE(read_at 컬럼만) · INSERT 없음
--   anon          : 접근 없음
--   생성          : SECURITY DEFINER RPC(owner postgres — create_notification 등)만. 영향 없음.
--   service_role · postgres owner · 함수 권한은 건드리지 않는다.
--
-- Realtime: postgres_changes 는 구독자의 SELECT 정책으로 걸러지므로 본인 INSERT 만 받는다.
--
-- rollback (보고용 · 새 migration 으로만 적용)
--   drop policy if exists notifications_select_own / notifications_update_own /
--     notifications_delete_own / dev_open_all on public.notifications;
--   create policy dev_open_all on public.notifications for all to public using (true) with check (true);
--   revoke all on table public.notifications from anon;
--   revoke all on table public.notifications from authenticated;
--   grant select, insert, update, delete on table public.notifications to anon, authenticated;
-- ============================================================================

-- 개발용 전체 개방 제거
drop policy if exists dev_open_all
on public.notifications;

-- own SELECT
drop policy if exists notifications_select_own
on public.notifications;

create policy notifications_select_own
  on public.notifications
  for select
  to authenticated
  using (user_id = auth.uid());

-- own UPDATE (행 단위. 컬럼은 아래 GRANT 로 read_at 만)
drop policy if exists notifications_update_own
on public.notifications;

create policy notifications_update_own
  on public.notifications
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- own DELETE (A안 · 스와이프 삭제 UI 유지)
drop policy if exists notifications_delete_own
on public.notifications;

create policy notifications_delete_own
  on public.notifications
  for delete
  to authenticated
  using (user_id = auth.uid());

-- INSERT policy 없음

-- anon 완전 차단
revoke all
on table public.notifications
from anon;

-- authenticated 기존 table privilege 초기화
revoke all
on table public.notifications
from authenticated;

-- 필요한 권한만 재부여
grant select, delete
on table public.notifications
to authenticated;

grant update (read_at)
on table public.notifications
to authenticated;
