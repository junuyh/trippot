-- ============================================================================
-- 받은 알림 (MY-01 알림함)
-- 기준 문서: docs/05_ERD_v3.md, docs/09_IA_v2.md §5, CLAUDE.md 1장
-- 작성일: 2026-09-02
--
-- 사용자가 받은 알림 메시지를 저장한다.
--
-- ⚠️ users.notification_settings_json 과 역할이 다르다.
--    그쪽은 "어떤 알림을 받을지" 설정이고, 여기는 "실제로 받은 알림" 이다.
--    설정은 알림을 만들지 말지 판단할 때 읽고, 만들어진 알림만 여기 쌓인다.
--
-- ⚠️ 여행·모임·게시글 원본을 복제하지 않는다.
--    화면에 필요한 문구(title·body)만 담고 상세는 trip_id 로 따라간다.
--
-- 기존 테이블은 한 글자도 바꾸지 않는다.
-- ============================================================================

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),

  -- 알림을 받은 사람. 탈퇴하면 알림도 함께 사라진다.
  -- ⚠️ event_log 의 on delete set null 과 다르다. 그쪽은 분석용 로그라 사람이
  --    빠져도 집계가 남아야 하지만, 알림은 그 사람에게만 의미가 있다.
  --    comments · reactions 와 같은 cascade 로 맞춘다.
  user_id     uuid not null references public.users (id) on delete cascade,

  -- 실제로 발생한 이벤트 종류. 예: 'TRIP_D7', 'FUND_PROGRESS_80'
  --
  -- ⚠️ 사용자가 켜고 끄는 카테고리가 아니다.
  --    카테고리(trip_fund 등)는 users.notification_settings_json 이 갖고 있고,
  --    여기에는 그보다 잘게 나뉜 개별 사건이 들어간다.
  --
  -- ⚠️ check 제약을 일부러 걸지 않았다. 이벤트 목록이 아직 확정되지 않았다.
  --    확정되면 이 파일 맨 아래 주석의 alter 로 추가한다.
  type        text not null,

  -- 목록에 굵게 보이는 한 줄
  title       text not null,

  -- 보조 문구. 없을 수 있다
  body        text,

  -- 관련 여행. 알림을 눌렀을 때 갈 곳을 정하는 데 쓴다.
  -- ⚠️ 여행이 지워져도 알림 기록은 남긴다. community_posts.trip_id 와 같은 정책이다.
  trip_id     uuid references public.trips (id) on delete set null,

  -- 읽은 시각. NULL = 아직 안 읽음.
  --
  -- ⚠️ is_read boolean 을 쓰지 않는다. 이 스키마는 "사건이 일어난 시점" 을 전부
  --    nullable *_at 으로 적는다 (confirmed_at · joined_at · connected_at ·
  --    published_at · last_synced_at). boolean 은 설정 플래그에만 쓴다
  --    (enabled · is_mock · active · hidden). 읽음은 설정이 아니라 사건이다.
  read_at     timestamptz,

  created_at  timestamptz not null default now()
);

-- ⚠️ updated_at 과 set_updated_at 트리거를 두지 않는다.
--    이 테이블은 한 번 쓰고 read_at 만 한 번 바뀐다. updated_at 을 두면
--    read_at 과 같은 값을 중복 저장하게 된다.
--    쌓기만 하는 event_log · reactions 도 created_at 만 갖는다.

-- 알림함은 언제나 "내 알림을 최신순으로" 읽는다. 이 복합 인덱스 하나면 된다.
-- (안 읽은 개수도 이 인덱스로 user_id 를 좁힌 뒤 read_at 을 본다)
create index idx_notifications_user_created
  on public.notifications (user_id, created_at desc);


-- ── RLS ─────────────────────────────────────────────────────────────────────
--
-- ⚠️ 20260827000001 의 dev_open_all 은 테이블 이름 23개를 배열에 하드코딩해
--    루프를 돈다. 이 테이블은 그 목록에 없으므로 정책이 자동으로 붙지 않는다.
--    RLS 만 켜고 정책을 안 만들면 모든 접근이 막힌다.
--    (20260831000001 이 같은 이유로 정책을 직접 만들었다)
alter table public.notifications enable row level security;

create policy "dev_open_all" on public.notifications
  for all using (true) with check (true);


-- ── GRANT ───────────────────────────────────────────────────────────────────
--
-- ⚠️ 20260828000001 의 alter default privileges 에 기대지 않고 직접 부여한다.
--    그 설정은 문장을 실행한 역할이 만든 객체에만 적용되어,
--    다른 역할로 마이그레이션이 돌면 42501 로 막힌다.
--    이미 부여돼 있어도 다시 실행하는 것은 부작용이 없다.
grant select, insert, update, delete
  on public.notifications
  to anon, authenticated;


-- ============================================================================
-- 실서비스 정책 (배포 전 dev_open_all 을 drop 하고 아래로 교체)
--
-- ⚠️ 다른 테이블과 달리 **읽기/쓰기 주체가 다르다.**
--    사용자는 자기 알림을 읽고 읽음 처리만 한다. 알림을 만드는 것은 사용자가
--    아니라 알림 생성 주체(backend/service)다. 그래서 정책을 나눈다.
--
-- drop policy "dev_open_all" on public.notifications;
--
-- create policy "own_notifications_select" on public.notifications
--   for select using (auth.uid() = user_id);
--
-- create policy "own_notifications_update" on public.notifications
--   for update
--   using      (auth.uid() = user_id)
--   with check (auth.uid() = user_id);
--
-- -- insert 정책은 두지 않는다. 일반 사용자가 임의의 알림을 만들 수 없어야 한다.
-- -- 생성 주체가 service_role 이면 RLS 를 우회하므로 정책이 필요 없고,
-- -- Edge Function 이라면 그 역할에 맞는 정책을 따로 설계한다.
--
-- GRANT 범위도 함께 재검토한다. 로그인 후 동작이므로 anon 을 빼고
-- authenticated 에 select, update 만 남기는 것이 맞다.
-- ============================================================================


-- ============================================================================
-- [나중에] 이벤트 목록이 확정되면 실행할 것 — 지금은 실행하지 않는다
--
-- alter table public.notifications
--   add constraint notifications_type_check
--   check (type in (
--     'TRIP_D7', 'TRIP_D1',
--     'FUND_PROGRESS_80', 'FUND_PROGRESS_100', 'FUND_SHORTFALL',
--     'GROUP_CONTRIBUTION_RECEIVED', 'GROUP_CONTRIBUTION_DUE',
--     'SETTLEMENT_REMINDER'
--   ));
--
-- ⚠️ 위 값은 예시다. 실제 목록은 제품팀이 확정한 뒤 전달한다.
-- ============================================================================
