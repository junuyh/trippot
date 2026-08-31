-- ============================================================================
-- 모임 목록 표시 설정 (GROUP-01)
-- 기준 문서: docs/05_ERD_v3.md, CLAUDE.md 1장
-- 작성일: 2026-08-31
--
-- 사용자별로 모임을 목록에서 숨기고 순서를 바꾸는 기능을 위한 테이블이다.
--
-- ⚠️ **원본 데이터를 저장하지 않는다.**
--    모임명·인원수·여행은 groups / group_members / trips 가 계속 기준이고,
--    여기에는 "이 사용자가 그 모임을 어떻게 보고 싶은가" 만 담는다.
--    복제하면 원본이 바뀔 때 동기화 문제가 생기고 캐시 역할까지 떠안게 된다.
--
-- ⚠️ hidden = true 여도 group_members.status 는 바뀌지 않는다.
--    **목록에서 감추는 것은 모임 탈퇴가 아니다.**
--    사용자는 여전히 ACTIVE 멤버이고, 홈과 여행 생성 화면에서는 계속 보인다.
--    (숨김 필터를 공유 함수 getMyGroups() 에 넣으면 숨긴 모임으로 새 여행을
--     만들 수 없게 된다. GROUP-01 전용 조회 함수에서만 거른다)
--
-- 기존 테이블은 한 글자도 바꾸지 않는다.
-- ============================================================================

create table public.user_group_list_preferences (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users  (id) on delete cascade,
  group_id    uuid not null references public.groups (id) on delete cascade,

  -- 목록에서 감춤. 멤버십과 무관하다 (위 주석 참조)
  hidden      boolean not null default false,

  -- ⚠️ nullable 이다. 기존 sort_order 두 곳(budget_categories,
  --    budget_plan_items)은 not null default 0 이지만 성격이 다르다.
  --
  --    그쪽은 생성 시점에 시스템이 항상 값을 채운다.
  --    여기는 사용자가 순서를 지정할 수도, 안 할 수도 있다.
  --    default 0 으로 두면 0 이 '순서 미설정' 과 '첫 번째' 를 동시에 뜻하게 되어
  --    목록이 사용자 지정 순인지 기본 순인지 판별할 수 없다.
  --
  --    NULL = 사용자가 순서를 지정한 적 없음.
  --    정렬 모드는 이렇게 파생한다.
  --      해당 user_id 의 행 중 sort_order IS NOT NULL 인 행이 하나라도 있으면
  --        → 사용자 지정 순
  --      아니면
  --        → 모임 생성일 순 (groups.created_at DESC)
  --
  --    판정은 **숨긴 행까지 포함한** 그 사용자의 전체 행을 본다.
  --    보이는 행만 보면, 순서를 지정한 모임을 전부 숨겼을 때 모드가 임의로 돌아간다.
  sort_order  integer,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- 1인 1모임 1행. group_members 의 unique (group_id, user_id) 와 같은 의도다.
  unique (user_id, group_id)
);

-- GROUP-01 은 언제나 "내 설정 전체" 를 한 번에 읽는다. user_id 단일 인덱스면 된다.
create index idx_user_group_list_preferences_user_id
  on public.user_group_list_preferences (user_id);

create trigger user_group_list_preferences_set_updated_at
  before update on public.user_group_list_preferences
  for each row execute function public.set_updated_at();


-- ── RLS ─────────────────────────────────────────────────────────────────────
--
-- ⚠️ 20260827000001 의 dev_open_all 은 테이블 이름 23개를 배열에 하드코딩해
--    루프를 돈다. 이 테이블은 그 목록에 없으므로 정책이 자동으로 붙지 않는다.
--    RLS 만 켜고 정책을 안 만들면 모든 접근이 막힌다.
alter table public.user_group_list_preferences enable row level security;

create policy "dev_open_all" on public.user_group_list_preferences
  for all using (true) with check (true);


-- ── GRANT ───────────────────────────────────────────────────────────────────
--
-- ⚠️ 20260828000001 의 alter default privileges 에 기대지 않고 직접 부여한다.
--    그 설정은 **문장을 실행한 역할이 만든 객체에만** 적용된다.
--    다른 역할로 마이그레이션이 돌면 적용되지 않아 42501 로 막힌다.
--    이미 부여돼 있어도 다시 실행하는 것은 부작용이 없다.
--
--    RLS 는 행을 거르고 GRANT 는 테이블 접근을 허용한다. 둘 다 있어야 한다.
--    (docs/05_ERD_v3.md §6-0)
grant select, insert, update, delete
  on public.user_group_list_preferences
  to anon, authenticated;


-- ============================================================================
-- 실서비스 정책 (배포 전 dev_open_all 을 drop 하고 아래로 교체)
--
-- user_id 하나만 보면 되므로 이 프로젝트에서 가장 단순한 RLS 다.
-- groups 의 소유자·멤버 검사나 can_access_trip() 같은 조인이 필요 없다.
--
-- drop policy "dev_open_all" on public.user_group_list_preferences;
--
-- create policy "own_list_preferences" on public.user_group_list_preferences
--   for all
--   using      (auth.uid() = user_id)
--   with check (auth.uid() = user_id);
--
-- GRANT 범위도 함께 재검토한다. 로그인 후 동작이면 anon 을 빼고
-- authenticated 만 남기는 것이 맞다. (docs/05_ERD_v3.md §6-5)
-- ============================================================================
