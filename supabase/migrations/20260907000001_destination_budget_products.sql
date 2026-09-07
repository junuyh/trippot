-- ============================================================================
-- 목적지별 근거 상품 캐시 (TRIP-03)
-- 기준 문서: CLAUDE.md 4장 · 10장, lib/constants/destinations.ts 로드맵
-- 작성일: 2026-09-07
--
-- 예산 구성에서 카테고리를 펼치면 나오는 근거 상품을 AI 가 여행지에 맞게
-- 다시 쓴다('4성급 호텔' → '파리 시내 3성급 호텔'). 그 결과를 담는 자리다.
--
-- ⚠️ 이 표가 없으면 기능을 쓸 수 없다. 무료 등급 모델이 카테고리 1건에
--    13~15초 걸리고, 8개를 부르면 429 로 막힌다(실측). 여행 생성 마지막
--    단계에서 그만큼 기다리게 할 수 없다.
--    같은 목적지면 답이 같으므로 한 번 만들어 두고 계속 쓴다.
--
-- ============================================================================
-- 왜 금액이 아니라 비율(ratio)을 저장하는가 — 가장 중요한 결정
-- ============================================================================
--
--   금액은 인원·박수·일수에 따라 달라진다. 금액을 저장하면 캐시 열쇠에
--   (목적지 × 인원 × 박수 × 일수) 가 전부 들어가고, 사실상 캐시가 안 맞는다.
--
--   비율은 그 셋과 무관하다.
--
--     비율 = AI 가 준 금액 ÷ 그 카테고리 기준 금액
--     금액 = 기준 금액 × 비율          ← 쓸 때 다시 곱한다
--
--   그래서 열쇠는 (목적지, 상품 id) 하나면 된다. 목적지 12개 × 상품 23개.
--
-- ⚠️ 여기 ratio 는 lib/constants/budgetProducts.ts 의 ratio 와 같은 단위다.
--    이미 가드레일(카탈로그 비율 ±40%)을 통과한 값만 들어온다.
--    (lib/budget/productLocalization.ts)
--
-- ⚠️ **recommended_amount 를 여기서 만들지 않는다.** 이 표는 후보일 뿐이고,
--    추천 원본은 여행 생성 시점에 화면이 정해 trip 에 저장한다. (CLAUDE.md 4장)
--
-- ⚠️ 쓰는 쪽은 Edge Function(budget-products) 하나뿐이다. 앱은 이 표를
--    직접 읽지도 쓰지도 않는다. 앱에서 LLM 을 부르지 않는 것과 같은 이유로,
--    캐시를 채우는 책임도 한 곳에 둔다. (CLAUDE.md 1장 · 7장)
--
-- 기존 테이블은 한 글자도 바꾸지 않는다.
-- ============================================================================

create table if not exists public.destination_budget_products (
  -- lib/constants/destinations.ts 의 DestinationCode. 목록에 없는 목적지는
  -- 지역 평균을 쓰므로 'region:europe' 처럼 지역 열쇠가 들어올 수 있다.
  destination_key text not null,
  -- lib/constants/budgetProducts.ts 의 상품 id. 'stay-hotel4'
  product_id      text not null,

  name  text not null,
  note  text not null default '',
  emoji text not null default '',

  -- 카테고리 기준 금액에 대한 비율. 0 이면 금액을 못 낸다.
  ratio numeric not null check (ratio > 0),

  -- 언제 만든 값인가. 시세가 움직이면 오래된 것부터 다시 만든다.
  generated_at timestamptz not null default now(),

  primary key (destination_key, product_id)
);

comment on table public.destination_budget_products is
  'TRIP-03 근거 상품의 목적지 맞춤 캐시. Edge Function(budget-products)만 쓴다. 금액이 아니라 비율을 저장해 인원·일정과 무관하게 재사용한다.';
comment on column public.destination_budget_products.ratio is
  '카테고리 기준 금액에 대한 비율. 금액 = baseAmount × ratio. budgetProducts.ts 의 ratio 와 같은 단위.';


-- 조회는 언제나 "이 목적지의 상품 전부" 다. PK 의 첫 칼럼이 destination_key 라
-- 그 인덱스가 그대로 쓰인다. 따로 만들지 않는다.


-- ── RLS ─────────────────────────────────────────────────────────────────────
--
-- ⚠️ 20260827000001 의 dev_open_all 은 테이블 이름을 배열에 하드코딩해 루프를
--    돈다. 이 테이블은 그 목록에 없으므로 정책이 자동으로 붙지 않는다.
--    RLS 만 켜고 정책을 안 만들면 모든 접근이 막힌다.
alter table public.destination_budget_products enable row level security;

create policy "dev_open_all" on public.destination_budget_products
  for all using (true) with check (true);


-- ── GRANT ───────────────────────────────────────────────────────────────────
--
-- ⚠️ 20260828000001 의 alter default privileges 에 기대지 않고 직접 부여한다.
--    그 설정은 문장을 실행한 역할이 만든 객체에만 적용되어, 다른 역할로
--    마이그레이션이 돌면 42501 로 막힌다. 다시 실행해도 부작용은 없다.
grant select, insert, update, delete
  on public.destination_budget_products
  to anon, authenticated;


-- ============================================================================
-- 실서비스 정책 (배포 전 dev_open_all 을 drop 하고 아래로 교체)
--
-- ⚠️ 이 표는 **사용자 데이터가 아니다.** 목적지별 공용 참고값이라
--    읽기는 모두에게 열고, 쓰기는 Edge Function(service_role)만 갖는다.
--    anon 에 insert 를 열어 두면 누구나 남의 예산 추천 문구를 바꿀 수 있다.
--
-- drop policy "dev_open_all" on public.destination_budget_products;
--
-- create policy "read_all" on public.destination_budget_products
--   for select using (true);
--
-- revoke insert, update, delete
--   on public.destination_budget_products from anon, authenticated;
-- ============================================================================
