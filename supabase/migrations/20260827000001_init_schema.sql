-- ============================================================================
-- TripPot 초기 스키마 v1
-- 기준 문서: docs/05_ERD_v1.md, CLAUDE.md 4장
-- 작성일: 2026-08-27
--
-- 규칙
--   - 금액은 전부 bigint (원 단위 정수). numeric / float 사용 금지.
--   - 여행 시작일·종료일은 date. 그 외 모든 시각은 timestamptz (UTC 저장).
--   - PK는 uuid.
--   - 상태값은 enum 타입 대신 text + CHECK 로 둔다. MVP 기간에 값 추가가
--     잦을 것으로 보고, ALTER TYPE 없이 마이그레이션할 수 있게 한 선택이다.
--
-- ⚠️ ERD와 어긋나 조정한 지점은 budget_categories 정의 위 주석 참조.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ── updated_at 자동 갱신 ────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ============================================================================
-- 1. users
-- ============================================================================
-- id는 Supabase auth.users를 그대로 참조한다.
-- 이렇게 두면 RLS 정책에서 auth.uid() = users.id 로 바로 비교할 수 있다.
-- ERD의 auth_provider / auth_provider_user_id는 조회용으로 유지한다.
create table public.users (
  id                          uuid primary key references auth.users (id) on delete cascade,
  name                        text not null,
  profile_image_url           text,
  auth_provider               text,
  auth_provider_user_id       text,
  notification_settings_json  jsonb not null default '{}'::jsonb,
  deleted_at                  timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();


-- ============================================================================
-- 2. groups / group_members
-- ============================================================================
create table public.groups (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  owner_user_id  uuid not null references public.users (id) on delete cascade,
  status         text not null default 'ACTIVE'
                   check (status in ('ACTIVE', 'ARCHIVED', 'DELETED')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index idx_groups_owner_user_id on public.groups (owner_user_id);

create trigger groups_set_updated_at
  before update on public.groups
  for each row execute function public.set_updated_at();

create table public.group_members (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups (id) on delete cascade,
  user_id    uuid not null references public.users (id) on delete cascade,
  role       text not null default 'MEMBER' check (role in ('OWNER', 'MEMBER')),
  status     text not null default 'ACTIVE'
               check (status in ('ACTIVE', 'INVITED', 'LEFT')),
  joined_at  timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, user_id)
);

create index idx_group_members_group_id on public.group_members (group_id);
create index idx_group_members_user_id  on public.group_members (user_id);

create trigger group_members_set_updated_at
  before update on public.group_members
  for each row execute function public.set_updated_at();


-- ============================================================================
-- 3. trips / trip_members
-- ============================================================================
create table public.trips (
  id                 uuid primary key default gen_random_uuid(),
  owner_type         text not null check (owner_type in ('PERSONAL', 'GROUP')),
  owner_user_id      uuid references public.users (id) on delete cascade,
  group_id           uuid references public.groups (id) on delete cascade,
  destination        text,
  -- 시간 정보가 불필요하므로 date. timestamptz 아님. (CLAUDE.md 9장)
  start_date         date,
  end_date           date,
  headcount          integer not null default 1 check (headcount > 0),
  travel_style_json  jsonb not null default '{}'::jsonb,
  status             text not null default 'PLANNING'
                       check (status in ('PLANNING', 'TRAVELING', 'ENDED', 'SETTLED', 'DELETED')),
  currency           text not null default 'KRW',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  -- ERD 3장 제약: PERSONAL이면 owner_user_id 필수, GROUP이면 group_id 필수
  constraint trips_owner_shape check (
    (owner_type = 'PERSONAL' and owner_user_id is not null and group_id is null)
    or
    (owner_type = 'GROUP' and group_id is not null)
  ),
  constraint trips_date_order check (
    start_date is null or end_date is null or start_date <= end_date
  )
);

create index idx_trips_owner_user_id on public.trips (owner_user_id);
create index idx_trips_group_id      on public.trips (group_id);
create index idx_trips_status        on public.trips (status);

create trigger trips_set_updated_at
  before update on public.trips
  for each row execute function public.set_updated_at();

create table public.trip_members (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid not null references public.trips (id) on delete cascade,
  user_id      uuid references public.users (id) on delete cascade,
  display_name text,
  status       text not null default 'ACTIVE'
                 check (status in ('ACTIVE', 'INVITED', 'LEFT')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index idx_trip_members_trip_id on public.trip_members (trip_id);
create index idx_trip_members_user_id on public.trip_members (user_id);

create trigger trip_members_set_updated_at
  before update on public.trip_members
  for each row execute function public.set_updated_at();


-- ============================================================================
-- 4. trip_budgets / budget_categories / budget_plan_items
-- ============================================================================
-- trips ||--|| trip_budgets 이므로 trip_id에 unique를 건다.
create table public.trip_budgets (
  id                          uuid primary key default gen_random_uuid(),
  trip_id                     uuid not null unique references public.trips (id) on delete cascade,
  method                      text not null default 'RECOMMENDED'
                                check (method in ('RECOMMENDED', 'USER_DEFINED')),
  target_amount               bigint not null default 0 check (target_amount >= 0),
  recommended_amount          bigint not null default 0 check (recommended_amount >= 0),
  per_person_amount           bigint not null default 0 check (per_person_amount >= 0),
  recommendation_basis_json   jsonb not null default '{}'::jsonb,
  confirmed_at                timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create index idx_trip_budgets_trip_id on public.trip_budgets (trip_id);

create trigger trip_budgets_set_updated_at
  before update on public.trip_budgets
  for each row execute function public.set_updated_at();


-- ────────────────────────────────────────────────────────────────────────────
-- budget_categories
--
-- ⚠️ ERD v1과 CLAUDE.md 4장이 어긋나는 테이블이다. 임의로 합치지 않고 아래와
--    같이 정리했으니 검토 바란다.
--
--    docs/05_ERD_v1.md §3 : expected_amount / prepared_amount / actual_amount
--    CLAUDE.md      §4    : recommended_amount / personalized_amount / planned_amount
--                           + applied_source
--
--    판단 (CLAUDE.md 0장 우선순위에 따라 CLAUDE.md 4장을 상위로 둠):
--      - CLAUDE.md 3칼럼 + applied_source 를 모두 추가한다. (필수 규칙)
--      - ERD의 prepared_amount(가상 금고 배분액), actual_amount(거래 합계)는
--        역할이 달라 그대로 유지한다.
--      - ERD의 expected_amount는 CLAUDE.md의 planned_amount와 의미가 같아
--        중복이므로 만들지 않았다. → 이 판단이 맞는지 확인 필요.
--
-- 3칼럼 변경 규칙 (CLAUDE.md 4장)
--   recommended_amount  : 시스템 기본 추천 원본. 최초 생성 후 절대 덮어쓰지 않는다.
--   personalized_amount : 과거 소비 반영 개인화 추천. 개인화 재계산 시에만 변경.
--   planned_amount      : 사용자가 최종 확정한 값. 사용자 확정 행동으로만 변경.
--   AI는 planned_amount를 직접 수정하지 않는다.
-- ────────────────────────────────────────────────────────────────────────────
create table public.budget_categories (
  id                   uuid primary key default gen_random_uuid(),
  trip_budget_id       uuid not null references public.trip_budgets (id) on delete cascade,
  category_code        text not null
                         check (category_code in (
                           'AIRFARE', 'LODGING', 'FOOD', 'TRANSPORT',
                           'ACTIVITY', 'SHOPPING', 'INSURANCE', 'CONTINGENCY'
                         )),

  -- CLAUDE.md 4장 3칼럼 --------------------------------------------------
  recommended_amount   bigint not null default 0 check (recommended_amount  >= 0),
  personalized_amount  bigint                    check (personalized_amount >= 0),
  planned_amount       bigint not null default 0 check (planned_amount      >= 0),
  applied_source       text not null default 'default'
                         check (applied_source in ('default', 'personalized', 'user')),

  -- ERD 유지 칼럼 --------------------------------------------------------
  prepared_amount      bigint not null default 0 check (prepared_amount >= 0),
  actual_amount        bigint not null default 0 check (actual_amount   >= 0),

  sort_order           integer not null default 0,
  enabled              boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  unique (trip_budget_id, category_code)
);

create index idx_budget_categories_trip_budget_id on public.budget_categories (trip_budget_id);

create trigger budget_categories_set_updated_at
  before update on public.budget_categories
  for each row execute function public.set_updated_at();

comment on column public.budget_categories.recommended_amount  is '시스템 기본 추천 원본. 불변. 최초 생성 후 덮어쓰지 않는다.';
comment on column public.budget_categories.personalized_amount is '과거 소비 반영 개인화 추천. 개인화 재계산 시에만 변경.';
comment on column public.budget_categories.planned_amount      is '사용자가 최종 확정한 값. 사용자 확정 행동을 통해서만 변경.';
comment on column public.budget_categories.applied_source      is '현재 planned_amount가 어느 값에서 왔는지: default | personalized | user';
comment on column public.budget_categories.prepared_amount     is '가상 여행 금고에 논리적으로 배분된 준비 금액.';
comment on column public.budget_categories.actual_amount       is '연결된 출금 거래 합계. 거래 변경 시 재계산한다.';


create table public.budget_plan_items (
  id                  uuid primary key default gen_random_uuid(),
  budget_category_id  uuid not null references public.budget_categories (id) on delete cascade,
  name                text not null,
  expected_amount     bigint not null default 0 check (expected_amount >= 0),
  actual_amount       bigint not null default 0 check (actual_amount   >= 0),
  status              text not null default 'PLANNED'
                        check (status in ('PLANNED', 'DONE', 'CANCELED')),
  sort_order          integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_budget_plan_items_budget_category_id
  on public.budget_plan_items (budget_category_id);

create trigger budget_plan_items_set_updated_at
  before update on public.budget_plan_items
  for each row execute function public.set_updated_at();


-- ============================================================================
-- 5. financial_accounts / fund_sources
-- ============================================================================
create table public.financial_accounts (
  id                     uuid primary key default gen_random_uuid(),
  group_id               uuid references public.groups (id) on delete cascade,
  institution_code       text,
  masked_account_number  text,
  current_balance        bigint not null default 0,
  is_mock                boolean not null default true,
  connected_at           timestamptz,
  disconnected_at        timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index idx_financial_accounts_group_id on public.financial_accounts (group_id);

create trigger financial_accounts_set_updated_at
  before update on public.financial_accounts
  for each row execute function public.set_updated_at();

-- trips ||--|| fund_sources 이므로 trip_id에 unique.
-- 정책(CLAUDE.md 3장): 직접입력 금액과 계좌 잔액을 절대 합산하지 않는다.
-- current_amount는 항상 단일 소스(source_type) 기준의 값이다.
create table public.fund_sources (
  id                        uuid primary key default gen_random_uuid(),
  trip_id                   uuid not null unique references public.trips (id) on delete cascade,
  financial_account_id      uuid references public.financial_accounts (id) on delete set null,
  source_type               text not null default 'ZERO'
                              check (source_type in ('ACCOUNT', 'MANUAL', 'ZERO', 'MOCK')),
  current_amount            bigint not null default 0 check (current_amount >= 0),
  last_synced_at            timestamptz,
  switched_from_manual_at   timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index idx_fund_sources_trip_id on public.fund_sources (trip_id);

create trigger fund_sources_set_updated_at
  before update on public.fund_sources
  for each row execute function public.set_updated_at();

comment on column public.fund_sources.current_amount is
  '항상 단일 소스 기준 금액. 수기 금액과 계좌 잔액을 합산하지 않는다. (CLAUDE.md 3장)';


-- ============================================================================
-- 6. transactions / contributions
-- ============================================================================
-- 거래는 남기고 분류만 해제할 수 있어야 하므로 카테고리·계획항목 FK는 set null.
-- MVP는 1 거래 = 1 카테고리. 다만 향후 분할 매핑을 막는 구조로 두지 않는다.
create table public.transactions (
  id                    uuid primary key default gen_random_uuid(),
  trip_id               uuid not null references public.trips (id) on delete cascade,
  financial_account_id  uuid references public.financial_accounts (id) on delete set null,
  budget_category_id    uuid references public.budget_categories (id) on delete set null,
  budget_plan_item_id   uuid references public.budget_plan_items (id) on delete set null,
  source_type           text not null default 'MANUAL'
                          check (source_type in ('ACCOUNT', 'MANUAL', 'MOCK')),
  transaction_type      text not null
                          check (transaction_type in ('DEPOSIT', 'WITHDRAWAL')),
  occurred_at           timestamptz not null,
  name                  text,
  amount                bigint not null check (amount >= 0),
  category_method       text not null default 'NONE'
                          check (category_method in ('AUTO', 'USER', 'NONE')),
  category_confidence   integer check (category_confidence between 0 and 100),
  raw_reference         jsonb,
  deleted_at            timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index idx_transactions_trip_id            on public.transactions (trip_id);
create index idx_transactions_budget_category_id on public.transactions (budget_category_id);
create index idx_transactions_budget_plan_item_id on public.transactions (budget_plan_item_id);
create index idx_transactions_occurred_at        on public.transactions (trip_id, occurred_at desc);

create trigger transactions_set_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

comment on table public.transactions is
  '입금(DEPOSIT)은 예산 실제 사용금액에 포함하지 않는다. 출금(WITHDRAWAL)만 actual_amount에 합산한다.';


create table public.contributions (
  id               uuid primary key default gen_random_uuid(),
  trip_id          uuid not null references public.trips (id) on delete cascade,
  user_id          uuid references public.users (id) on delete cascade,
  expected_amount  bigint not null default 0 check (expected_amount >= 0),
  paid_amount      bigint not null default 0 check (paid_amount     >= 0),
  status           text not null default 'UNPAID'
                     check (status in ('UNPAID', 'PARTIAL', 'PAID')),
  source_type      text not null default 'MANUAL'
                     check (source_type in ('ACCOUNT', 'MANUAL', 'MOCK')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index idx_contributions_trip_id on public.contributions (trip_id);
create index idx_contributions_user_id on public.contributions (user_id);

create trigger contributions_set_updated_at
  before update on public.contributions
  for each row execute function public.set_updated_at();


-- ============================================================================
-- 7. settlements
-- ============================================================================
-- difference_rate는 금액이 아니라 비율이므로 bigint 규칙 대상이 아니다.
-- 소수점 오차를 피하기 위해 실수 대신 basis point(만분율) 정수로 저장한다.
create table public.settlements (
  id                       uuid primary key default gen_random_uuid(),
  trip_id                  uuid not null unique references public.trips (id) on delete cascade,
  target_amount            bigint not null default 0 check (target_amount >= 0),
  actual_amount            bigint not null default 0 check (actual_amount >= 0),
  difference_amount        bigint not null default 0,
  difference_rate_bp       integer not null default 0,
  category_snapshot_json   jsonb not null default '{}'::jsonb,
  confirmed_at             timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index idx_settlements_trip_id on public.settlements (trip_id);

create trigger settlements_set_updated_at
  before update on public.settlements
  for each row execute function public.set_updated_at();

comment on column public.settlements.difference_rate_bp is
  '계획 대비 실제 차이 비율. basis point(만분율) 정수. 예: 1250 = 12.50%. 소수점 연산 회피용.';


-- ============================================================================
-- 8. travel_types / trip_type_results / trip_type_result_items
-- ============================================================================
create table public.travel_types (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,
  name         text not null,
  description  text,
  image_key    text,
  rule_version text not null default 'v1',
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger travel_types_set_updated_at
  before update on public.travel_types
  for each row execute function public.set_updated_at();

create table public.trip_type_results (
  id                 uuid primary key default gen_random_uuid(),
  trip_id            uuid not null unique references public.trips (id) on delete cascade,
  -- 유형 마스터가 지워져도 결과 이력은 남긴다.
  primary_type_id    uuid references public.travel_types (id) on delete set null,
  basis_summary_json jsonb not null default '{}'::jsonb,
  generated_at       timestamptz not null default now(),
  rule_version       text not null default 'v1',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index idx_trip_type_results_trip_id on public.trip_type_results (trip_id);

create trigger trip_type_results_set_updated_at
  before update on public.trip_type_results
  for each row execute function public.set_updated_at();

create table public.trip_type_result_items (
  id                    uuid primary key default gen_random_uuid(),
  trip_type_result_id   uuid not null references public.trip_type_results (id) on delete cascade,
  travel_type_id        uuid references public.travel_types (id) on delete set null,
  rank                  integer not null default 1 check (rank > 0),
  score                 integer not null default 0,
  evidence_json         jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now()
);

create index idx_trip_type_result_items_result_id
  on public.trip_type_result_items (trip_type_result_id);


-- ============================================================================
-- 9. community_posts / comments / reactions
-- ============================================================================
create table public.community_posts (
  id              uuid primary key default gen_random_uuid(),
  author_user_id  uuid references public.users (id) on delete cascade,
  -- 여행이 지워져도 글은 남긴다.
  trip_id         uuid references public.trips (id) on delete set null,
  post_type       text not null default 'POST'
                    check (post_type in ('POST', 'FREE_TIP', 'PAID_TIP', 'TYPE_SHARE')),
  title           text not null,
  content         text,
  status          text not null default 'DRAFT'
                    check (status in ('DRAFT', 'PUBLISHED', 'HIDDEN', 'DELETED')),
  published_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_community_posts_author_user_id on public.community_posts (author_user_id);
create index idx_community_posts_trip_id        on public.community_posts (trip_id);
create index idx_community_posts_status         on public.community_posts (status, published_at desc);

create trigger community_posts_set_updated_at
  before update on public.community_posts
  for each row execute function public.set_updated_at();

create table public.comments (
  id              uuid primary key default gen_random_uuid(),
  post_id         uuid not null references public.community_posts (id) on delete cascade,
  author_user_id  uuid references public.users (id) on delete cascade,
  content         text not null,
  status          text not null default 'PUBLISHED'
                    check (status in ('PUBLISHED', 'HIDDEN', 'DELETED')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_comments_post_id on public.comments (post_id);

create trigger comments_set_updated_at
  before update on public.comments
  for each row execute function public.set_updated_at();

create table public.reactions (
  post_id        uuid not null references public.community_posts (id) on delete cascade,
  user_id        uuid not null references public.users (id) on delete cascade,
  reaction_type  text not null default 'LIKE' check (reaction_type in ('LIKE')),
  created_at     timestamptz not null default now(),
  primary key (post_id, user_id, reaction_type)
);

create index idx_reactions_post_id on public.reactions (post_id);


-- ============================================================================
-- 10. tip_products / tip_purchases
-- ============================================================================
create table public.tip_products (
  id            uuid primary key default gen_random_uuid(),
  post_id       uuid not null unique references public.community_posts (id) on delete cascade,
  price_amount  bigint not null default 0 check (price_amount >= 0),
  currency      text not null default 'KRW',
  sales_status  text not null default 'ON_SALE'
                  check (sales_status in ('ON_SALE', 'PAUSED', 'ENDED')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger tip_products_set_updated_at
  before update on public.tip_products
  for each row execute function public.set_updated_at();

-- 구매 이력은 정산 근거이므로 상품 삭제로 사라지면 안 된다. → restrict
create table public.tip_purchases (
  id              uuid primary key default gen_random_uuid(),
  tip_product_id  uuid not null references public.tip_products (id) on delete restrict,
  buyer_user_id   uuid references public.users (id) on delete set null,
  amount          bigint not null default 0 check (amount >= 0),
  status          text not null default 'PENDING'
                    check (status in ('PENDING', 'COMPLETED', 'CANCELED', 'REFUNDED')),
  purchased_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_tip_purchases_tip_product_id on public.tip_purchases (tip_product_id);
create index idx_tip_purchases_buyer_user_id  on public.tip_purchases (buyer_user_id);

create trigger tip_purchases_set_updated_at
  before update on public.tip_purchases
  for each row execute function public.set_updated_at();


-- ============================================================================
-- 11. insurance_referrals
-- ============================================================================
create table public.insurance_referrals (
  id                  uuid primary key default gen_random_uuid(),
  trip_id             uuid references public.trips (id) on delete cascade,
  user_id             uuid references public.users (id) on delete set null,
  partner_code        text,
  status              text not null default 'CLICKED'
                        check (status in ('CLICKED', 'QUOTE_COMPLETED', 'PURCHASE_COMPLETED')),
  clicked_at          timestamptz not null default now(),
  conversion_at       timestamptz,
  external_reference  text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_insurance_referrals_trip_id on public.insurance_referrals (trip_id);
create index idx_insurance_referrals_user_id on public.insurance_referrals (user_id);

create trigger insurance_referrals_set_updated_at
  before update on public.insurance_referrals
  for each row execute function public.set_updated_at();


-- ============================================================================
-- 12. event_log
-- ============================================================================
-- ⚠️ docs/05_ERD_v1.md 에는 없는 테이블이다. CLAUDE.md 8장이 요구하므로 추가했다.
--    ERD 문서에 반영이 필요한지 확인 바란다.
--
-- 이 테이블에는 lib/analytics/track.ts 내부에서만 INSERT 한다. (CLAUDE.md 1장)
-- 로그는 분석 근거이므로 user/trip이 지워져도 남긴다. → 전부 set null.
-- 로그인 전 이벤트는 anon_id로 기록하고, 로그인 시 user_id와 매핑한다.
create table public.event_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.users (id) on delete set null,
  anon_id     text,
  trip_id     uuid references public.trips (id) on delete set null,
  event_name  text not null,
  params      jsonb not null default '{}'::jsonb,
  env         text not null default 'production' check (env in ('development', 'production')),
  created_at  timestamptz not null default now(),

  -- 로그인 전/후 어느 쪽으로도 식별되지 않는 로그는 분모를 계산할 수 없다.
  constraint event_log_identity check (user_id is not null or anon_id is not null)
);

create index idx_event_log_user_id    on public.event_log (user_id);
create index idx_event_log_anon_id    on public.event_log (anon_id);
create index idx_event_log_trip_id    on public.event_log (trip_id);
create index idx_event_log_event_name on public.event_log (event_name, created_at desc);
create index idx_event_log_created_at on public.event_log (created_at desc);

comment on table public.event_log is
  'track() 내부에서만 INSERT 한다. 화면·컴포넌트에서 직접 INSERT 금지. (CLAUDE.md 1장/8장)';


-- ============================================================================
-- 13. RLS
-- ============================================================================
-- ⚠️⚠️ 현재 정책은 MVP 개발 편의용으로 전부 개방되어 있다. ⚠️⚠️
--       anon key만 있으면 모든 행을 읽고 쓸 수 있다.
--       실서비스 배포 전에 반드시 아래 "실서비스 정책" 주석대로 교체할 것.
--
--       CLAUDE.md 1장: RLS를 임의로 Disable 하지 않는다.
--       → Disable이 아니라 Enable + 느슨한 정책으로 둔 이유가 이것이다.
-- ============================================================================

alter table public.users                  enable row level security;
alter table public.groups                 enable row level security;
alter table public.group_members          enable row level security;
alter table public.trips                  enable row level security;
alter table public.trip_members           enable row level security;
alter table public.trip_budgets           enable row level security;
alter table public.budget_categories      enable row level security;
alter table public.budget_plan_items      enable row level security;
alter table public.financial_accounts     enable row level security;
alter table public.fund_sources           enable row level security;
alter table public.transactions           enable row level security;
alter table public.contributions          enable row level security;
alter table public.settlements            enable row level security;
alter table public.travel_types           enable row level security;
alter table public.trip_type_results      enable row level security;
alter table public.trip_type_result_items enable row level security;
alter table public.community_posts        enable row level security;
alter table public.comments               enable row level security;
alter table public.reactions              enable row level security;
alter table public.tip_products           enable row level security;
alter table public.tip_purchases          enable row level security;
alter table public.insurance_referrals    enable row level security;
alter table public.event_log              enable row level security;

-- ── 개발용 전체 개방 정책 ───────────────────────────────────────────────────
do $$
declare
  t text;
begin
  foreach t in array array[
    'users', 'groups', 'group_members', 'trips', 'trip_members',
    'trip_budgets', 'budget_categories', 'budget_plan_items',
    'financial_accounts', 'fund_sources', 'transactions', 'contributions',
    'settlements', 'travel_types', 'trip_type_results', 'trip_type_result_items',
    'community_posts', 'comments', 'reactions',
    'tip_products', 'tip_purchases', 'insurance_referrals', 'event_log'
  ]
  loop
    execute format(
      'create policy "dev_open_all" on public.%I for all using (true) with check (true)',
      t
    );
  end loop;
end;
$$;


-- ============================================================================
-- 실서비스 정책 (배포 전 위 dev_open_all 을 drop 하고 아래로 교체)
-- ============================================================================
--
-- -- 공통: 개발 정책 제거
-- --   drop policy "dev_open_all" on public.<table>;
--
-- -- ── 헬퍼: 현재 사용자가 해당 여행에 접근 가능한가 ────────────────────────
-- create or replace function public.can_access_trip(p_trip_id uuid)
-- returns boolean
-- language sql
-- security definer
-- stable
-- set search_path = public
-- as $fn$
--   select exists (
--     select 1
--     from public.trips t
--     left join public.group_members gm
--       on gm.group_id = t.group_id and gm.status = 'ACTIVE'
--     left join public.trip_members tm
--       on tm.trip_id = t.id and tm.status = 'ACTIVE'
--     where t.id = p_trip_id
--       and (
--         t.owner_user_id = auth.uid()
--         or gm.user_id   = auth.uid()
--         or tm.user_id   = auth.uid()
--       )
--   );
-- $fn$;
--
-- -- ── users: 본인 행만 ────────────────────────────────────────────────────
-- create policy "users_self_select" on public.users
--   for select using (id = auth.uid());
-- create policy "users_self_update" on public.users
--   for update using (id = auth.uid()) with check (id = auth.uid());
--
-- -- ── groups: 소속 모임만 ─────────────────────────────────────────────────
-- create policy "groups_member_select" on public.groups
--   for select using (
--     owner_user_id = auth.uid()
--     or exists (
--       select 1 from public.group_members gm
--       where gm.group_id = groups.id
--         and gm.user_id = auth.uid()
--         and gm.status = 'ACTIVE'
--     )
--   );
-- create policy "groups_owner_write" on public.groups
--   for all using (owner_user_id = auth.uid())
--   with check (owner_user_id = auth.uid());
--
-- -- ── trips: 본인 여행 또는 소속 모임 여행 ────────────────────────────────
-- create policy "trips_access" on public.trips
--   for all using (public.can_access_trip(id))
--   with check (public.can_access_trip(id));
--
-- -- ── trip_id를 직접 가진 테이블 ──────────────────────────────────────────
-- --    trip_members, trip_budgets, fund_sources, transactions,
-- --    contributions, settlements, trip_type_results, insurance_referrals
-- -- create policy "<table>_by_trip" on public.<table>
-- --   for all using (public.can_access_trip(trip_id))
-- --   with check (public.can_access_trip(trip_id));
--
-- -- ── trip_id를 간접 참조하는 테이블 ──────────────────────────────────────
-- create policy "budget_categories_by_trip" on public.budget_categories
--   for all using (
--     exists (
--       select 1 from public.trip_budgets tb
--       where tb.id = budget_categories.trip_budget_id
--         and public.can_access_trip(tb.trip_id)
--     )
--   );
-- -- budget_plan_items는 budget_categories를 한 단계 더 타고 올라간다.
-- -- trip_type_result_items는 trip_type_results를 타고 올라간다.
--
-- -- ── financial_accounts: 소속 모임의 계좌만 ──────────────────────────────
-- create policy "financial_accounts_by_group" on public.financial_accounts
--   for all using (
--     exists (
--       select 1 from public.group_members gm
--       where gm.group_id = financial_accounts.group_id
--         and gm.user_id = auth.uid()
--         and gm.status = 'ACTIVE'
--     )
--   );
--
-- -- ── 커뮤니티: 공개글은 모두 읽기, 쓰기는 작성자만 ───────────────────────
-- create policy "community_posts_public_read" on public.community_posts
--   for select using (status = 'PUBLISHED' or author_user_id = auth.uid());
-- create policy "community_posts_author_write" on public.community_posts
--   for all using (author_user_id = auth.uid())
--   with check (author_user_id = auth.uid());
-- -- comments / reactions도 동일하게 작성자 기준으로 건다.
--
-- -- ── travel_types: 마스터 데이터. 읽기 전용 공개 ─────────────────────────
-- create policy "travel_types_read" on public.travel_types
--   for select using (active = true);
--
-- -- ── tip_purchases: 구매자 본인만 ────────────────────────────────────────
-- create policy "tip_purchases_buyer" on public.tip_purchases
--   for all using (buyer_user_id = auth.uid())
--   with check (buyer_user_id = auth.uid());
--
-- -- ── event_log: 앱은 INSERT만. 조회는 서버/대시보드에서만. ───────────────
-- create policy "event_log_insert_only" on public.event_log
--   for insert with check (
--     user_id is null or user_id = auth.uid()
--   );
-- -- SELECT 정책을 만들지 않으면 앱에서는 조회가 불가능하다. 의도된 것이다.
--
-- ============================================================================
