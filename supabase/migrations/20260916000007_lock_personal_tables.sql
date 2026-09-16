-- ============================================================================
-- 테스트 빌드 전 권한 전환 · 2단계 — 본인 것만 보는 표를 잠근다
-- 기준 문서: docs/05_ERD_v6.md §6-5 · 테스트 빌드 보안 점검 필수 1
-- 작성일: 2026-09-16
--
-- 1단계(20260915000002)는 앱이 쓰지 않는 기준 표 3개를 닫았다.
-- 이번에는 **다른 사람과 공유되지 않는 표**만 다룬다. 여행·모임·커뮤니티처럼
-- 여러 사람이 함께 보는 표는 뒤 단계에서 한다. 깨질 위험이 가장 낮은 것부터 간다.
--
-- ⚠️ 표 구조는 바꾸지 않는다. types/database.ts 재생성이 필요 없다.
-- ============================================================================


-- ── ① user_group_list_preferences — 모임 목록 표시 설정 ──────────────────────
--
-- 누가 어떤 모임을 숨겼는지·어떤 순서로 보는지다. 철저히 본인 것이다.
-- 앱은 늘 user_id = 본인으로 조회·저장한다. (groups.ts:302 · 388 · 479)
--
-- ⚠️ upsert 가 돌기 때문에 INSERT 와 UPDATE 정책이 **둘 다** 있어야 한다.
--    (PostgREST 의 upsert 는 INSERT ... ON CONFLICT DO UPDATE 한 문장이다)
drop policy if exists "dev_open_all" on public.user_group_list_preferences;

create policy "ugp_select_own" on public.user_group_list_preferences
  for select to authenticated
  using (user_id = auth.uid());

create policy "ugp_insert_own" on public.user_group_list_preferences
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "ugp_update_own" on public.user_group_list_preferences
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "ugp_delete_own" on public.user_group_list_preferences
  for delete to authenticated
  using (user_id = auth.uid());

revoke all on public.user_group_list_preferences from anon;
grant select, insert, update, delete on public.user_group_list_preferences to authenticated;


-- ── ② event_log — 분석 기록 ─────────────────────────────────────────────────
--
-- 앱은 이 표에 **쓰기만** 한다. (lib/analytics/track.ts:202) 읽는 곳이 없다.
-- 지금은 anon·authenticated 가 전부 읽고 고치고 지울 수 있어서, 공개 키만 있으면
-- 다른 사람이 무엇을 눌렀는지 전부 볼 수 있다.
--
-- ⚠️ anon 에게 INSERT 를 남긴다. (결정 4 · 2026-09-16)
--    CLAUDE.md 8장이 로그인 전 이벤트를 anon_id 로 남기라고 한다. 지금은 로그인
--    화면에서 track() 을 부르는 곳이 없어 실제로 들어오는 행이 없지만, 나중에
--    로그인 전 이벤트를 넣을 때 권한을 다시 열지 않으려고 남겨 둔다.
--    읽기는 anon·authenticated 모두 막힌다.
--
-- ⚠️ user_id 를 남의 것으로 적어 넣지 못하게 한다. 로그인 사용자는 본인 id 로만,
--    로그인 전에는 null 로만 쓸 수 있다. (분석 수치가 조작되는 것을 막는다)
drop policy if exists "dev_open_all" on public.event_log;

create policy "event_log_insert_self" on public.event_log
  for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

revoke all on public.event_log from anon, authenticated;
grant insert on public.event_log to anon, authenticated;


-- ── ③ notifications — 손대지 않는다 ────────────────────────────────────────
--
-- 알림함은 **이미 잠겨 있다.** 알림센터 작업(20260916000001 · 20260916000002)이
-- 오늘 원격에 적용되면서 본인 행만 보는 정책과 최소 권한이 함께 들어갔다.
--   authenticated : 본인 행 SELECT · DELETE · read_at 칼럼만 UPDATE
--   anon          : 없음
-- 결정 3(본인 알림 삭제 허용)도 그 정책으로 이미 충족된다.
--
-- ⚠️ 여기서 `grant update on public.notifications to authenticated` 를 넣지 않는다.
--    표 전체 UPDATE 를 주게 되어, 칼럼 단위로 좁혀 둔 것을 되돌린다.


-- ============================================================================
-- 되돌리기 (문제가 생기면 새 마이그레이션으로 아래를 적용한다)
--
-- drop policy if exists "ugp_select_own" on public.user_group_list_preferences;
-- drop policy if exists "ugp_insert_own" on public.user_group_list_preferences;
-- drop policy if exists "ugp_update_own" on public.user_group_list_preferences;
-- drop policy if exists "ugp_delete_own" on public.user_group_list_preferences;
-- create policy "dev_open_all" on public.user_group_list_preferences
--   for all using (true) with check (true);
-- grant select, insert, update, delete on public.user_group_list_preferences to anon, authenticated;
--
-- drop policy if exists "event_log_insert_self" on public.event_log;
-- create policy "dev_open_all" on public.event_log for all using (true) with check (true);
-- grant select, insert, update, delete on public.event_log to anon, authenticated;
--
-- ============================================================================
