# TripPot ERD v5

| 항목 | 내용 |
|---|---|
| 문서 상태 | 확정 초안 |
| 작성일 | 2026-09-03 |
| 변경 사유 | `notifications_type_check` 적용 및 마이그레이션 반영에 따른 상태 동기화 |
| 이전 버전 | `05_ERD_v4.md` |

**이 문서와 마이그레이션이 어긋나면 마이그레이션이 맞다.** 문서를 고쳐서 맞춘다.
스키마를 바꿔야 하면 **작업을 멈추고 사람에게 요청한다.** (`CLAUDE.md` 1장 — DB 담당자만 새 Migration 추가)

---

## 0. v4 → v5 변경 요약

`notifications_type_check` 가 적용되어 v4 에서 사실이 아니게 된 부분만 고쳤다.
그 밖의 내용은 v4 그대로다. 본문에서 이번 판에 고친 부분은 **`[v5]`** 로 표시했다.

| # | 변경 | v4 | v5 |
|---|---|---|---|
| 1 | `notifications.type` CHECK | "현재 원격 DB 에는 없다 · 추가 예정" | **적용됨.** `20260903000001_notifications_type_check.sql` · 허용값 3종 (3장) |
| 2 | 적용된 마이그레이션 | 7개 | **9개** — CHECK 마이그레이션 추가 (7-1) |

---

## 0-2. v3 → v4 변경 요약

본문에서 v4 에 추가한 부분은 **`[v4]`** 로 표시했다.
기존 `[변경 N]` 태그는 v1→v2 · v2→v3 때 붙은 것이라 번호 체계가 다르다. 섞어 읽지 않는다.

이번 판은 **스키마를 바꾸지 않았다.** 이미 `develop` 에 들어와 있는 구조를 문서에 옮겨 적었을 뿐이다.
(`20260902000002_notifications.sql` · `20260902000003_profile_images_storage.sql`)

| # | 변경 | v3 | v4 |
|---|---|---|---|
| 1 | **`notifications` 테이블** | 없음 | 3장에 절 추가. 컬럼 8개 · FK 2개 · 인덱스 1개. 2장 ERD 에도 반영 |
| 2 | `notifications` FK · 인덱스 | — | 4장에 `user_id` CASCADE / `trip_id` SET NULL 추가. 5장에 `(user_id, created_at desc)` 추가 |
| 3 | `notifications` RLS · GRANT | — | 6-1 에 추가. **`dev_open_all` 루프가 아니라 마이그레이션이 직접 만든 정책**이라는 점을 함께 적었다 |
| 4 | **`profile-images` Storage** | **문서에 Storage 개념 자체가 없었다** | 6-6 절 신설. bucket 설정 · 현재 개발용 정책 · 실서비스 예정 정책 |
| 5 | `users.profile_image_url` 과 Storage 의 관계 | 컬럼 이름만 나열 | 3장 `users` 절에 **"파일은 Storage, 위치는 이 컬럼"** 역할 분리와 저장 형식(public URL 전체)을 명시 |
| 6 | **배포 전 Production RLS 전환** | 6-5 체크리스트에 `dev_open_all` · GRANT 만 | 6-5 에 **[Release Blocker]** 두 블록 추가. **P2 나 Future 가 아니다** |
| 7 | 적용된 마이그레이션 목록 | 2개 | 7-1 을 현재 `develop` 기준 7개로 맞췄다 |
| 8 | 인덱스 총수 | 36 | **39** (초기 36 + 모임 목록 설정 1 + 거래 환불 1 + 알림 1) |
| 9 | **MVP notification type** | — | 3장에 확정 3종(`FUND_GOAL_REACHED` · `TRIP_D7` · `SETTLEMENT_READY`) 기록. **DB 에는 아직 CHECK 가 없다는 점을 함께 적었다** |

⚠️ **6-5 의 Release Blocker 는 "나중에 하면 좋은 개선" 이 아니다.**
지금 상태로 외부 사용자에게 배포하면 **다른 사람의 알림을 읽고 지울 수 있고,
다른 사람의 프로필 이미지를 덮어쓰거나 지울 수 있다.**

---

## 0-3. v2 → v3 변경 요약

| # | 변경 | v2 | v3 |
|---|---|---|---|
| 1 | **테이블 접근 권한(GRANT)** | **언급 없음** | 6장에 절 추가. RLS 와 별개로 `anon`/`authenticated` GRANT 가 필요하다 |
| 2 | §6-1 서술 | "`anon` key만 있으면 모든 행을 읽고 쓸 수 있다" | **사실과 달랐다.** GRANT 가 없어 한 행도 읽지 못했다. 수정 |
| 3 | migrations 목록 | 초기 스키마 1개 | `20260828000001_grant_anon_access.sql` 추가 |

---

## 0-4. v1 → v2 변경 요약

| # | 변경 | v1 | v2 |
|---|---|---|---|
| 1 | `budget_categories` 금액 칼럼 | `expected_amount` / `prepared_amount` / `actual_amount` | `recommended_amount` / `personalized_amount` / `planned_amount` / `applied_source` / `prepared_amount` / `actual_amount` |
| 2 | `event_log` 테이블 | 없음 | 추가 (Analytics 3중 기록의 자체 저장소) |
| 3 | `settlements.difference_rate` | 비율 (타입 미지정) | `difference_rate_bp` — basis point 정수 |
| 4 | `users.id` | 독립 PK | `auth.users(id)` 참조 |
| 5 | 상태값 타입 | 미지정 | enum 타입이 아니라 `text` + `CHECK` |
| 6 | migrations 순서 | 11단계 | `event_log` 포함 12단계 |
| 7 | FK `ON DELETE` 정책 | 없음 | 전 외래키에 명시 |
| 8 | 인덱스 | 없음 | 36개 명시 |
| 9 | **RLS** | **한 줄도 없음** | 23개 테이블 전체 활성 + 정책 |
| 10 | `created_at`/`updated_at` | 원칙만 언급 | 트리거(`set_updated_at()`)로 자동 갱신 |
| 11 | PK/UNIQUE 제약 | 일부 누락 | `trip_budgets.trip_id` UNIQUE, `reactions` 복합 PK 등 명시 |

---

## 1. 모델링 원칙

- 모든 PK는 UUID다. `gen_random_uuid()` 로 생성한다.
- **금액은 전부 `bigint` 원 단위 정수다.** `numeric` / `float` 를 쓰지 않는다.
  비율도 소수점을 피해 basis point 정수로 저장한다. (3장 `settlements` 참조)
- **여행 시작일·종료일은 `date`** 다. 시간 정보가 불필요하기 때문이다.
  그 외 모든 시각은 `timestamptz` 이며 UTC로 저장하고 화면에서 KST로 변환한다.
- 핵심 엔티티는 `created_at`, `updated_at` 을 가진다. `updated_at` 은 트리거로 자동 갱신된다.
- 사용자 삭제가 필요한 데이터는 물리 삭제보다 상태값 또는 `deleted_at` 을 우선 검토한다.
- **거래 금액은 원화 기준이다.** `currency` 는 `'KRW'` 고정, 환율 변환은 `[Future]`. (`CLAUDE.md` 3장)

### 1-1. 상태값은 enum 타입이 아니라 text + CHECK — [변경 5]

```sql
status text not null default 'PLANNING'
  check (status in ('PLANNING','TRAVELING','ENDED','SETTLED','DELETED'))
```

**이유:** MVP 기간에 열거값 추가가 잦을 것으로 보고, `ALTER TYPE` 없이 마이그레이션할 수 있게 했다.

**대가:** Supabase 생성 타입에서 이 칼럼들이 전부 `string` 이 된다. `'PLANNIG'` 같은 오타를
TypeScript가 잡지 못하고 런타임 DB 에러로만 드러난다.
→ 그래서 **`lib/constants/status.ts` 의 상수만 쓴다. 문자열 리터럴 금지.** (`CLAUDE.md` 6장)

CHECK 제약이 걸린 칼럼은 13개다: `status`(10개 테이블), `source_type`(3개 테이블),
`owner_type`, `role`, `method`, `category_code`, `applied_source`, `transaction_type`,
`category_method`, `post_type`, `reaction_type`, `sales_status`, `env`.

### 1-2. updated_at 트리거 — [변경 10]

```sql
create function public.set_updated_at() returns trigger ...
create trigger <table>_set_updated_at before update on public.<table>
  for each row execute function public.set_updated_at();
```

`updated_at` 을 애플리케이션에서 직접 넣지 않는다. DB가 갱신한다.

---

## 2. ERD

```mermaid
erDiagram
  AUTH_USERS ||--|| USERS : authenticates
  USERS ||--o{ GROUP_MEMBERS : joins
  GROUPS ||--o{ GROUP_MEMBERS : has
  USERS ||--o{ TRIPS : owns_personal
  GROUPS ||--o{ TRIPS : owns_group
  TRIPS ||--o{ TRIP_MEMBERS : includes
  USERS ||--o{ TRIP_MEMBERS : participates
  TRIPS ||--|| TRIP_BUDGETS : has
  TRIP_BUDGETS ||--o{ BUDGET_CATEGORIES : contains
  BUDGET_CATEGORIES ||--o{ BUDGET_PLAN_ITEMS : contains
  TRIPS ||--|| FUND_SOURCES : uses
  FUND_SOURCES o|--o| FINANCIAL_ACCOUNTS : connects
  TRIPS ||--o{ TRANSACTIONS : records
  BUDGET_CATEGORIES ||--o{ TRANSACTIONS : classifies
  BUDGET_PLAN_ITEMS o|--o{ TRANSACTIONS : matches
  TRIPS ||--o{ CONTRIBUTIONS : tracks
  USERS ||--o{ CONTRIBUTIONS : pays
  TRIPS ||--o| SETTLEMENTS : settles
  TRIPS ||--o| TRIP_TYPE_RESULTS : produces
  TRAVEL_TYPES ||--o{ TRIP_TYPE_RESULT_ITEMS : defines
  TRIP_TYPE_RESULTS ||--o{ TRIP_TYPE_RESULT_ITEMS : contains
  USERS ||--o{ COMMUNITY_POSTS : writes
  TRIPS o|--o{ COMMUNITY_POSTS : sources
  COMMUNITY_POSTS ||--o{ COMMENTS : has
  USERS ||--o{ COMMENTS : writes
  COMMUNITY_POSTS ||--o{ REACTIONS : receives
  USERS ||--o{ REACTIONS : creates
  COMMUNITY_POSTS ||--o| TIP_PRODUCTS : sells
  TIP_PRODUCTS ||--o{ TIP_PURCHASES : purchased
  USERS ||--o{ TIP_PURCHASES : buys
  TRIPS ||--o{ INSURANCE_REFERRALS : creates
  USERS o|--o{ EVENT_LOG : logs
  TRIPS o|--o{ EVENT_LOG : contexts
  USERS ||--o{ NOTIFICATIONS : receives
  TRIPS o|--o{ NOTIFICATIONS : contexts
```

⚠️ **프로필 이미지 파일은 이 그림에 없다.** Supabase Storage 의 `profile-images` bucket 에 있고,
DB 에는 `users.profile_image_url` 이 그 위치만 들고 있다. (6-6)

---

## 3. 핵심 테이블

### users — [변경 4]

`id`, `name`, `profile_image_url`, `auth_provider`, `auth_provider_user_id`,
`notification_settings_json`, `deleted_at`, `created_at`, `updated_at`

```sql
id uuid primary key references auth.users (id) on delete cascade
```

**`id` 가 Supabase `auth.users(id)` 를 그대로 참조한다.**
이렇게 두면 RLS 정책에서 `auth.uid() = users.id` 로 바로 비교할 수 있다.
독립 PK로 두면 정책마다 매핑 테이블을 한 번 더 타야 한다.

→ **Seed 데이터를 넣으려면 `auth.users` 행이 먼저 있어야 한다.** (`supabase/seed.sql` 1절 참조)

**`profile_image_url` — 파일은 Storage, 위치는 이 컬럼 — [v4]**

이미지 바이너리를 이 테이블에 넣지 않는다. 파일은 `profile-images` bucket 에 있고
이 컬럼은 그 파일이 어디 있는지만 들고 있다. **이미지용 새 컬럼을 만들지 않는다.**

| | 담는 것 |
|---|---|
| Storage `profile-images` | 실제 이미지 파일 |
| `users.profile_image_url` | 그 파일의 **public URL 전체** |

⚠️ 이 컬럼에는 **object path 가 아니라 public URL 전체**를 넣는다.
컬럼 이름이 `_url` 이고 앱이 `Image` 의 `uri` 에 그대로 넣기 때문이다.
path 를 넣으면 이름과 내용이 어긋나고, 이 컬럼을 함께 읽는
`getGroupMembers()` 쪽에서 URL 로 오해할 수 있다.

⚠️ **다만 이 규약을 DB 가 강제하지 않는다.** `text` 컬럼일 뿐 CHECK 도 트리거도 없다.
앱 코드가 유일한 방어선이다. (`travel_style_json` 과 같은 성격이다)

bucket 설정과 정책은 6-6 을 본다.

### groups / group_members

- `groups`: `id`, `name`, `owner_user_id`, `status`, `created_at`, `updated_at`
- `group_members`: `id`, `group_id`, `user_id`, `role`, `status`, `joined_at`, `created_at`, `updated_at`
- `role`: `OWNER`, `MEMBER` / `status`: `ACTIVE`, `INVITED`, `LEFT`
- `groups.status`: `ACTIVE`, `ARCHIVED`, `DELETED`
- 제약: `unique (group_id, user_id)` — 한 사람이 같은 모임에 두 번 들어가지 않는다.

### trips / trip_members

- `trips`: `id`, `owner_type`, `owner_user_id`, `group_id`, `destination`, `start_date`, `end_date`,
  `headcount`, `travel_style_json`, `status`, `currency`, `created_at`, `updated_at`
- `owner_type`: `PERSONAL`, `GROUP`
- `status`: `PLANNING`, `TRAVELING`, `ENDED`, `SETTLED`, `DELETED`
- `trip_members`: `id`, `trip_id`, `user_id`(nullable), `display_name`, `status`

제약:

```sql
constraint trips_owner_shape check (
  (owner_type = 'PERSONAL' and owner_user_id is not null and group_id is null)
  or (owner_type = 'GROUP' and group_id is not null)
)
constraint trips_date_order check (start_date <= end_date)
```

`start_date` / `end_date` 는 `date` 다. `timestamptz` 가 아니다.

⚠️ `travel_style_json` 은 `jsonb` 라 **CHECK 제약이 없다.** 안의 `style` 값
(`budget`/`standard`/`comfort`/`luxury`)은 예산 추천 배수의 입력값인데 DB가 막아주지 않는다.
**`lib/constants/status.ts` 의 `TRAVEL_STYLE` 상수가 유일한 방어선이다.**

### trip_budgets / budget_categories / budget_plan_items — [변경 1]

- `trip_budgets`: `id`, `trip_id`(**UNIQUE**), `method`, `target_amount`, `recommended_amount`,
  `per_person_amount`, `recommendation_basis_json`, `confirmed_at`, `created_at`, `updated_at`
- `method`: `RECOMMENDED`, `USER_DEFINED`
- `confirmed_at` 이 `null` 이면 **예산 미확정** 상태다.
- `budget_categories`: `id`, `trip_budget_id`, `category_code`,
  **`recommended_amount`, `personalized_amount`, `planned_amount`, `applied_source`,**
  `prepared_amount`, `actual_amount`, `sort_order`, `enabled`, `created_at`, `updated_at`
- `category_code`: `AIRFARE`, `LODGING`, `FOOD`, `TRANSPORT`, `ACTIVITY`, `SHOPPING`, `INSURANCE`, `CONTINGENCY`
- 제약: `unique (trip_budget_id, category_code)`
- `budget_plan_items`: `id`, `budget_category_id`, `name`, `expected_amount`, `actual_amount`,
  `status`, `sort_order`, `created_at`, `updated_at` / `status`: `PLANNED`, `DONE`, `CANCELED`

#### 예산 금액 3칼럼 규칙 — 매우 중요

`CLAUDE.md` 4장과 동일하다. 하나로 합치지 않는다.

| Column | 의미 | 변경 규칙 | Null |
|---|---|---|---|
| `recommended_amount` | 시스템 기본 추천 원본 | **불변. 최초 생성 후 덮어쓰지 않는다** | NOT NULL |
| `personalized_amount` | 과거 소비 반영 개인화 추천 | 개인화 재계산 시에만 | **nullable** |
| `planned_amount` | 사용자가 최종 확정한 값 | **사용자 확정 행동을 통해서만** | NOT NULL |
| `applied_source` | `planned_amount` 의 출처 | `default` / `personalized` / `user` | NOT NULL |
| `prepared_amount` | 가상 여행 금고 배분액 | 자금 배분 시 | NOT NULL |
| `actual_amount` | 출금 거래 합계 | 거래 변경 시 재계산 | NOT NULL |

- **AI·추천 로직은 `personalized_amount` 생성까지만 한다.** `planned_amount` 를 직접 쓰지 않는다.
  추천 + 근거 제시 → 사용자 확인/수정 → 사용자 최종 확정 순서다.
- `personalized_amount` 만 nullable인 이유: 개인화 계산 **전**과 **0원 추천**을 구분해야 한다.
- 코드에서는 `BudgetCategoryUpdate` 타입이 `recommended_amount` 를 `Omit` 으로 제외해
  타입 레벨에서 덮어쓰기를 막는다. (`lib/supabase/queries/budgets.ts`)

**v1의 `expected_amount` 는 `planned_amount` 와 의미가 중복되어 제거했다.**
이름이 두 개면 어느 쪽이 진짜인지 팀이 헷갈린다.

**이유:** 추천 원본이 사라지면 기본 추천 정확도, 사용자가 자주 수정하는 카테고리,
개인화 추천 효과를 영원히 측정할 수 없다. 프로젝트의 핵심 가설 검증이 여기 걸려 있다.

### fund_sources / financial_accounts

- `fund_sources`: `id`, `trip_id`(**UNIQUE**), `financial_account_id`, `source_type`,
  `current_amount`, `last_synced_at`, `switched_from_manual_at`, `created_at`, `updated_at`
- `source_type`: `ACCOUNT`, `MANUAL`, `ZERO`, `MOCK`
- `financial_accounts`: `id`, `group_id`, `institution_code`, `masked_account_number`,
  `current_balance`, `is_mock`, `connected_at`, `disconnected_at`, `created_at`, `updated_at`

정책: `MANUAL/ZERO → ACCOUNT/MOCK` 전환 시 기존 금액과 계좌 잔액을 **더하지 않고**
`current_amount` 를 계좌 잔액으로 **대체**한다. `current_amount` 는 항상 단일 소스 기준이다.

### transactions

`id`, `trip_id`, `financial_account_id`, `budget_category_id`, `budget_plan_item_id`,
`source_type`, `transaction_type`, `occurred_at`, `name`, `amount`, `category_method`,
`category_confidence`, `raw_reference`(jsonb), `deleted_at`, `created_at`, `updated_at`

- `source_type`: `ACCOUNT`, `MANUAL`, `MOCK` (`ZERO` 없음)
- `transaction_type`: `DEPOSIT`, `WITHDRAWAL`
- `category_method`: `AUTO`, `USER`, `NONE`
- **입금(`DEPOSIT`)은 예산 실제 사용금액에 포함하지 않는다.**
- **출금(`WITHDRAWAL`)만** 카테고리/계획 항목의 `actual_amount` 에 합산한다.
- MVP는 1 거래 = 1 카테고리다. 다만 향후 분할 매핑을 막는 구조로 두지 않았다.

### contributions

`id`, `trip_id`, `user_id`, `expected_amount`, `paid_amount`, `status`, `source_type`,
`created_at`, `updated_at` / `status`: `UNPAID`, `PARTIAL`, `PAID`

선택 기능이 비활성화된 여행은 행을 만들지 않아도 된다.

### settlements — [변경 3]

`id`, `trip_id`(**UNIQUE**), `target_amount`, `actual_amount`, `difference_amount`,
**`difference_rate_bp`**, `category_snapshot_json`, `confirmed_at`, `created_at`, `updated_at`

**`difference_rate` → `difference_rate_bp` 로 이름과 단위를 바꿨다.**

```
difference_rate_bp  integer   basis point(만분율) 정수
                              1250 = 12.50%,  -200 = -2.00%
```

**이유:** 비율을 실수로 저장하면 "금액·비율에 소수점 연산을 하지 않는다"는 규칙과 충돌한다.
`0.1 + 0.2 != 0.3` 문제를 결산 숫자에서 만들지 않기 위해 정수로 저장한다.

결산 확정 시점의 카테고리별 값을 `category_snapshot_json` 에 스냅샷으로 보존한다.
이후 예산이 바뀌어도 결산 결과는 변하지 않는다.

### travel_types / trip_type_results / trip_type_result_items

- `travel_types`: `id`, `code`(UNIQUE), `name`, `description`, `image_key`, `rule_version`, `active`
- `trip_type_results`: `id`, `trip_id`(**UNIQUE**), `primary_type_id`, `basis_summary_json`,
  `generated_at`, `rule_version`
- `trip_type_result_items`: `id`, `trip_type_result_id`, `travel_type_id`, `rank`, `score`, `evidence_json`

⚠️ **여행 유형 목록은 아직 확정되지 않았다.** `travel_types.code` 에 들어갈 값
(현재 `lib/constants/status.ts` 의 `SPENDING_PROFILE_TYPE` 6개)은 임시값이고,
산출 방식(규칙 기반 / AI 활용)도 미정이다. TYPE-01 화면은 이 때문에 고도화로 미뤄졌다.
(`04_화면목록_v3.md` 참조)

### community_posts / comments / reactions

- `community_posts`: `id`, `author_user_id`, `trip_id`, `post_type`, `title`, `content`,
  `status`, `published_at` / `post_type`: `POST`, `FREE_TIP`, `PAID_TIP`, `TYPE_SHARE`
  / `status`: `DRAFT`, `PUBLISHED`, `HIDDEN`, `DELETED`
- `comments`: `id`, `post_id`, `author_user_id`, `content`, `status`
- `reactions`: `post_id`, `user_id`, `reaction_type` — **복합 PK `(post_id, user_id, reaction_type)`**
  / v1은 `LIKE` 하나뿐이다.

### tip_products / tip_purchases

- `tip_products`: `id`, `post_id`(**UNIQUE**), `price_amount`, `currency`, `sales_status`
- `tip_purchases`: `id`, `tip_product_id`, `buyer_user_id`, `amount`, `status`, `purchased_at`
- `sales_status`: `ON_SALE`, `PAUSED`, `ENDED` / `status`: `PENDING`, `COMPLETED`, `CANCELED`, `REFUNDED`
- 실제 결제·환불·정산 모델은 결제 사업자 선정 후 확장한다.

### insurance_referrals

`id`, `trip_id`, `user_id`, `partner_code`, `status`, `clicked_at`, `conversion_at`, `external_reference`
/ `status`: `CLICKED`, `QUOTE_COMPLETED`, `PURCHASE_COMPLETED`

외부 이동 후는 추적할 수 없다. 클릭이 관측 가능한 마지막 지점이다.

### notifications — [v4] v3에 없던 테이블

사용자가 **받은 알림 메시지**를 담는다. MY-01 헤더의 알림함이 읽는 유일한 테이블이다.

```sql
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users (id) on delete cascade,
  type        text not null,
  title       text not null,
  body        text,
  trip_id     uuid references public.trips (id) on delete set null,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
```

| 컬럼 | 담는 값 |
|---|---|
| `user_id` | 알림을 받은 사람 |
| `type` | **실제 발생한 이벤트 종류.** MVP 확정값 3개는 아래 참조 |
| `title` | 목록에 굵게 보이는 한 줄 |
| `body` | 보조 문구. nullable |
| `trip_id` | 관련 여행. nullable. 눌렀을 때 갈 곳을 정하는 데 쓴다 |
| `read_at` | 읽은 시각. `null` = 아직 안 읽음 |

**`users.notification_settings_json` 과 역할이 다르다.**

| | `notification_settings_json` | `notifications` |
|---|---|---|
| 담는 것 | 어떤 알림을 **받을지** 설정 | 실제로 **받은** 알림 메시지 |
| 행 수 | 사용자당 값 하나 | 사용자당 여러 건, 계속 쌓인다 |

**`type` 의 값 — 제품 정책은 확정, DB 제약은 아직 없다 — [v4]**

세 곳이 모두 갖춰졌고 목록이 같다. — [v5]

| | 상태 |
|---|---|
| **제품 정책** | MVP 알림 3종으로 **확정** (아래 표) |
| **현재 DB** | `type text not null` + **`notifications_type_check` 적용됨** |
| **앱 코드** | `lib/constants/status.ts` 의 `NOTIFICATION_TYPE` — **추가됨** |

**확정된 MVP notification type — 3개**

| type | 의미 |
|---|---|
| `FUND_GOAL_REACHED` | 전체 목표 여행비 100% 최초 달성 |
| `TRIP_D7` | 여행 시작 7일 전 |
| `SETTLEMENT_READY` | 여행 종료 후 정산 가능 |

⚠️ **MVP 는 이 3개뿐이다.** 검토 과정에서 나왔던 다른 값들은 확정값이 아니다.
문서·코드 어디에서도 이 3개 외의 값을 notification type 으로 쓰지 않는다.

**`notifications_type_check` 가 적용되어 있다 — [v5]**

`20260902000002_notifications.sql` 은 알림 종류가 확정되기 전이라 CHECK 없이
적용됐다. 종류가 하나 늘 때마다 DB 담당자를 거쳐야 하는 상황을 피하려던 것이었다.
3종이 확정되어 `20260903000001_notifications_type_check.sql` 로 제약을 걸었다.
허용값 밖의 값은 이제 INSERT 시점에 `23514` 로 거부된다.

**그래도 앱은 `type` 문자열을 화면·기능 코드에 직접 쓰지 않는다.**
`lib/constants/status.ts` 의 `NOTIFICATION_TYPE` 상수로 한 곳에 모은다.
`status.ts` 는 공유 파일이므로 PR 로 올린다. (`CLAUDE.md` 5장)
1-1 의 다른 상태값들과 같은 이유다 — CHECK 가 걸린 뒤에도 생성 타입은 `string` 이라
TypeScript 가 오타를 잡지 못한다.

⚠️ **세 곳의 목록이 정확히 같아야 한다.**

```
제품 정책 확정값 3개
        ≡
lib/constants/status.ts 의 NOTIFICATION_TYPE
        ≡
notifications_type_check 의 허용 목록
```

하나라도 다르면 **앱이 만든 알림이 DB 에서 거부된다.**
제약 이름은 `notifications_type_check` 로 하고 **DB 담당자가 적용한다.**
이미 들어가 있는 행 중 목록에 없는 값이 있으면 제약 추가 자체가 실패하므로,
적용 전에 위반 행을 먼저 확인한다.

⚠️ `type` 에 들어가는 값은 **사용자가 켜고 끄는 카테고리가 아니다.**
카테고리(`trip_fund` 등)는 `users.notification_settings_json` 이 갖고 있고,
여기에는 그보다 잘게 나뉜 개별 사건이 들어간다.

⚠️ **`updated_at` 과 `set_updated_at` 트리거가 없다.** 한 번 쓰고 `read_at` 만 한 번 바뀌므로
`updated_at` 을 두면 `read_at` 과 같은 값을 중복 저장하게 된다.
쌓기만 하는 `event_log` · `reactions` 도 `created_at` 만 갖는다. (1-2)

⚠️ **`dedupe_key` · `group_id` · `deleted_at` · `payload` 는 없다.** 필요성이 확인되기 전에는
두지 않기로 했다. 나중에 `alter table ... add column` 으로 붙일 수 있다.

**알림을 만드는 쪽은 아직 정해지지 않았다.** 이 테이블은 담아 두는 곳이고,
"언제 만들 것인가" 는 별개 문제다. DB trigger 는 만들지 않았다 —
여행 D-7 처럼 시간이 흘러서 발생하는 알림은 데이터 변경이 없어도 생겨야 하기 때문이다.

### event_log — [변경 2] v1에 없던 테이블

`id`, `user_id`, `anon_id`, `trip_id`, `event_name`, `params`(jsonb), `env`, `created_at`

Analytics 3중 기록(Amplitude / Firebase / event_log)의 **자체 저장소**다.
SQL 조인으로 분석 리포트의 실제 근거가 된다. (`06_이벤트로그정의서_v1.md` 2장)

```sql
env text not null default 'production' check (env in ('development','production'))
constraint event_log_identity check (user_id is not null or anon_id is not null)
```

- **`lib/analytics/track.ts` 내부에서만 INSERT 한다.** 화면·컴포넌트에서 직접 INSERT 금지. (`CLAUDE.md` 1장)
- 로그인 전 이벤트는 `anon_id` 로 기록하고 로그인 시 `user_id` 와 매핑한다.
  둘 다 없으면 전환율의 분모를 계산할 수 없으므로 CHECK로 막았다.
- `user_id` / `trip_id` 는 **`ON DELETE SET NULL`** 이다. 사용자나 여행이 지워져도 로그는 남는다.
  분석 근거가 사라지면 안 되기 때문이다.

---

## 4. FK ON DELETE 정책 — [변경 7]

v1에 없던 항목이다. 삭제 전파를 잘못 잡으면 분석 데이터가 통째로 사라진다.

| 정책 | 대상 | 이유 |
|---|---|---|
| **CASCADE** | `users`←`auth.users` / `groups.owner_user_id` / `group_members.*` / `trips.owner_user_id`·`group_id` / `trip_members.*` / `trip_budgets.trip_id` / `budget_categories.trip_budget_id` / `budget_plan_items.budget_category_id` / `financial_accounts.group_id` / `fund_sources.trip_id` / `transactions.trip_id` / `contributions.*` / `settlements.trip_id` / `trip_type_results.trip_id` / `trip_type_result_items.trip_type_result_id` / `community_posts.author_user_id` / `comments.*` / `reactions.*` / `tip_products.post_id` / `insurance_referrals.trip_id` | 상위가 사라지면 존재 의미가 없는 하위 데이터 |
| **SET NULL** | `fund_sources.financial_account_id` / `transactions.financial_account_id`·`budget_category_id`·`budget_plan_item_id` / `trip_type_results.primary_type_id` / `trip_type_result_items.travel_type_id` / `community_posts.trip_id` / `tip_purchases.buyer_user_id` / `insurance_referrals.user_id` / **`event_log.user_id`·`trip_id`** | 상위가 사라져도 **기록 자체는 남아야** 하는 것 |
| **RESTRICT** | `tip_purchases.tip_product_id` | 구매 이력은 정산 근거다. 상품 삭제로 사라지면 안 된다 |

**`notifications` 추가분 — [v4]**

| 컬럼 | 정책 | 이유 |
|---|---|---|
| `notifications.user_id` | **CASCADE** | 알림은 그 사람에게만 의미가 있다. 탈퇴하면 함께 사라진다. `comments` · `reactions` 와 같은 기준이다 |
| `notifications.trip_id` | **SET NULL** | 여행이 지워져도 알림 기록은 남긴다. `community_posts.trip_id` 와 같은 정책이다 |

⚠️ `event_log.user_id` 는 SET NULL 인데 `notifications.user_id` 는 CASCADE 다.
**성격이 다르다.** `event_log` 는 분석용이라 사람이 빠져도 집계가 남아야 하고,
알림은 받는 사람이 사라지면 존재 의미가 없다.

특히 **거래는 남기고 분류만 해제**할 수 있어야 하므로
`transactions.budget_category_id` 는 CASCADE가 아니라 SET NULL이다.

**Seed의 멱등성이 이 정책 위에 서 있다.** `delete from public.users where id in (...)` 한 줄로
모임·여행·예산·거래·결산이 전부 정리되고, `event_log` 만 남는다. (`supabase/seed.sql`)

---

## 5. 인덱스 — [변경 8]

**총 39개다.** 자주 조회하는 외래키와 정렬 칼럼에 건다.

| 출처 | 개수 |
|---|---|
| `20260827000001_init_schema.sql` | 36 |
| `20260831000001_add_user_group_list_preferences.sql` | 1 |
| `20260901000002_add_transaction_refund.sql` | 1 |
| `20260902000002_notifications.sql` — [v4] | 1 |

| 축 | 인덱스 |
|---|---|
| `trip_id` | `trip_members`, `trip_budgets`, `fund_sources`, `transactions`, `contributions`, `settlements`, `trip_type_results`, `insurance_referrals`, `community_posts`, `event_log` |
| `group_id` | `groups(owner_user_id)`, `group_members`, `trips`, `financial_accounts` |
| `budget_id` 계열 | `budget_categories(trip_budget_id)`, `budget_plan_items(budget_category_id)`, `transactions(budget_category_id)`, `transactions(budget_plan_item_id)` |
| `user_id` | `group_members`, `trip_members`, `trips`, `contributions`, `insurance_referrals`, `community_posts`, `tip_purchases`, `event_log` |
| 복합·정렬 | `transactions(trip_id, occurred_at desc)`, `community_posts(status, published_at desc)`, `event_log(event_name, created_at desc)`, `event_log(created_at desc)`, `trips(status)`, **`notifications(user_id, created_at desc)`** |

**`idx_notifications_user_created` — [v4]**

알림함은 언제나 "내 알림을 최신순으로" 읽는다. 이 복합 인덱스 하나면 된다.
안 읽은 개수도 이 인덱스로 `user_id` 를 좁힌 뒤 `read_at` 을 본다.

---

## 6. RLS — [변경 9] v1에 한 줄도 없던 항목

**23개 테이블 전부 `enable row level security` 가 걸려 있다.**

### 6-0. RLS 정책만으로는 접근되지 않는다 — GRANT 가 별도로 필요하다 — [변경 1·2]

**이 절을 먼저 읽는다. v2 에서 빠져 있어 실제로 구현이 막혔던 지점이다.**

RLS 정책과 GRANT 는 서로 다른 장치이고, **둘 다 있어야 접근된다.**

| | 무엇을 정하는가 | 없으면 |
|---|---|---|
| **GRANT** | 그 테이블에 **접근할 수 있는가** (권한 검사) | `42501 permission denied` — RLS 정책까지 가보지도 못한다 |
| **RLS 정책** | 그 테이블의 **어떤 행을** 볼 수 있는가 (행 필터) | 접근은 되지만 행이 0건이거나 전부 열린다 |

검사 순서상 **GRANT 가 먼저**다. `dev_open_all` 이 `using (true)` 로 모든 행을 열어두어도,
GRANT 가 없으면 아무것도 읽지 못한다.

초기 스키마(`20260827000001_init_schema.sql`)에는 GRANT 문이 한 줄도 없었다.
그래서 RLS 를 전부 개방해 두었는데도 앱의 모든 조회가 이렇게 실패했다.

```json
{"code": "42501",
 "message": "permission denied for table group_members",
 "hint": "Grant the required privileges to the current role with:
          GRANT SELECT ON public.group_members TO anon;"}
```

Supabase 대시보드로 만든 테이블에는 GRANT 가 자동으로 붙지만,
**마이그레이션 SQL 로 만든 테이블에는 붙지 않는다.** 이것이 원인이다.

해결은 `supabase/migrations/20260828000001_grant_anon_access.sql` 이다.

```sql
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables    in schema public to anon, authenticated;
grant usage, select                  on all sequences in schema public to anon, authenticated;

-- 앞으로 만들 테이블에도 적용되게
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated;
```

⚠️ `alter default privileges` 는 **그 문장을 실행한 역할이 만든 객체**에만 적용된다.
다른 역할로 테이블을 만들면 적용되지 않는다. 새 테이블이 또 `42501` 로 막히면
`all tables` GRANT 를 새 마이그레이션으로 다시 실행한다.

⚠️ 이 GRANT 는 **개발용이며 `dev_open_all` 정책과 짝이다.**
실서비스 배포 시 RLS 정책 교체와 **함께** 범위를 재검토한다. (6-2, 6-5)

**RLS 오류로 보이는 것이 사실 GRANT 문제인 경우가 있다.**
`permission denied for table` 이면 GRANT, 행이 0건이면 RLS 정책을 본다.
증상이 비슷해 헷갈리기 쉬우니 에러 코드로 구분한다.

### 6-1. 현재 상태 — 개발용 개방 정책은 임시다

```sql
create policy "dev_open_all" on public.<table> for all using (true) with check (true);
```

⚠️ **현재 정책은 MVP 개발 편의용으로 전부 개방되어 있다.**
`anon` key 와 위 GRANT 가 함께 있으면 모든 행을 읽고 쓸 수 있다.
**이 상태로 실서비스에 나가면 안 된다.**

> v2 는 이 자리에 "`anon` key만 있으면 모든 행을 읽고 쓸 수 있다" 고 적었다.
> **사실과 달랐다.** GRANT 가 없어 한 행도 읽지 못하는 상태였고,
> 이 서술 때문에 원인을 RLS 쪽에서 찾느라 시간을 썼다. (6-0)

**나중에 추가된 테이블은 정책을 자동으로 받지 못한다 — [v4]**

`20260827000001` 의 `dev_open_all` 은 **테이블 이름 23개를 배열에 하드코딩해 루프를 돈다.**
그 뒤에 만든 테이블은 이 목록에 없어 정책이 붙지 않는다.
RLS 만 켜고 정책을 안 만들면 **모든 접근이 막힌다.**

그래서 이후 마이그레이션은 정책과 GRANT 를 **직접** 만든다.

| 테이블 | 만든 마이그레이션 | 정책 | GRANT |
|---|---|---|---|
| `user_group_list_preferences` | `20260831000001` | `dev_open_all` 직접 생성 | `select, insert, update, delete` → `anon`, `authenticated` |
| **`notifications`** | `20260902000002` | `dev_open_all` 직접 생성<br>`for all using (true) with check (true)` | `select, insert, update, delete` → `anon`, `authenticated` |

⚠️ **`notifications` 의 현재 상태를 정확히 적으면 이렇다.**
정책이 `for all` 하나뿐이라 SELECT / INSERT / UPDATE / DELETE 가 구분되지 않는다.

- 누구나 **모든 사용자의 알림을 읽을 수 있다**
- 누구나 **아무 알림이나 만들 수 있다**
- 누구나 **남의 알림을 지울 수 있다**
- `anon` 도 열려 있다

로그인이 없어 `auth.uid()` 가 `null` 인 개발 단계의 불가피한 상태다.
**배포 전 전환은 6-5 의 Release Blocker 다.**

### 6-2. 실서비스 정책 — 배포 전 반드시 적용

**실서비스 정책은 마이그레이션 SQL 파일 하단에 주석으로 들어 있다.**
(`supabase/migrations/20260827000001_init_schema.sql` — "실서비스 정책" 절)

배포 전에 `dev_open_all` 을 `drop policy` 하고 주석의 정책으로 교체한다. 골자는 다음과 같다.

| 대상 | 정책 |
|---|---|
| `users` | 본인 행만 (`id = auth.uid()`) |
| `groups` | 소유자 또는 `ACTIVE` 멤버만 |
| `trips` 및 `trip_id` 보유 테이블 | `can_access_trip(trip_id)` — 본인 여행 또는 소속 모임 여행 |
| `budget_categories` / `budget_plan_items` / `trip_type_result_items` | 상위 테이블을 타고 올라가 `can_access_trip` |
| `financial_accounts` | 소속 모임의 계좌만 |
| `community_posts` / `comments` / `reactions` | 공개글은 모두 읽기, 쓰기는 작성자만 |
| `travel_types` | 마스터 데이터. `active = true` 읽기 전용 공개 |
| `tip_purchases` | 구매자 본인만 |
| `event_log` | 앱은 INSERT만. **SELECT 정책을 만들지 않는다** (조회는 서버·대시보드에서만) |
| **`notifications`** — [v4] | **읽기와 쓰기 주체가 다르다.** 아래 참조 |

**`notifications` 실서비스 정책 — [v4]**

다른 테이블과 달리 **읽는 사람과 만드는 사람이 다르다.**
사용자는 자기 알림을 읽고 읽음 처리만 한다. 알림을 만드는 것은 사용자가 아니라
알림 생성 주체(backend / service)다. 그래서 정책을 나눈다.

정책 원문은 `20260902000002_notifications.sql` 하단 주석에 있다. 골자는 이렇다.

```sql
drop policy "dev_open_all" on public.notifications;

create policy "own_notifications_select" on public.notifications
  for select using (auth.uid() = user_id);

create policy "own_notifications_update" on public.notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- INSERT 정책은 두지 않는다. 일반 사용자가 임의의 알림을 만들 수 없어야 한다.
-- 생성 주체가 service_role 이면 RLS 를 우회하므로 정책이 필요 없고,
-- Edge Function 이라면 그 역할에 맞는 정책을 따로 설계한다.
-- DELETE 정책도 두지 않는다. 알림 삭제 UX 가 아직 제품 요구사항에 없다. (3장)
```

GRANT 도 함께 좁힌다. 로그인 후 동작이므로 **`anon` 을 빼고
`authenticated` 에 `select`, `update` 만 남긴다.**

### 6-3. RLS 오류를 Disable로 해결하지 않는다

**`CLAUDE.md` 1장:** RLS 임의 Disable 금지. RLS 오류는 **정책을 고쳐서** 해결한다.
막히면 사람에게 알린다.

→ 현재 스키마가 RLS를 끄지 않고 **Enable + 느슨한 정책**으로 둔 이유가 이것이다.
끄면 나중에 켤 때 어느 테이블이 빠졌는지 알 수 없다.

### 6-4. service_role Key

앱은 `anon` key만 쓴다. `service_role` key를 앱에 두지 않는다.
관리자 권한 동작은 Edge Function을 경유한다. (`CLAUDE.md` 1장)

### 6-5. 배포 전 체크리스트 — [변경 1]

```
[ ] dev_open_all 정책 전부 drop
[ ] 20260827000001 하단 "실서비스 정책" 의 RLS 정책으로 교체
[ ] 20260828000001 의 GRANT 범위 재검토
    · anon 에게 INSERT/UPDATE/DELETE 가 필요한가
      (로그인 후 동작이면 authenticated 만으로 충분하다)
    · event_log 는 앱에서 INSERT 만 한다. SELECT 를 회수할지 검토 (6-2)
[ ] alter default privileges 도 같은 기준으로 다시 건다
```

**RLS 정책만 교체하고 GRANT 를 그대로 두면 권한이 넓은 채로 배포된다.**
두 가지는 항상 같이 검토한다.

### [Release Blocker] notifications — [v4]

```
[ ] 개발용 open RLS 제거
[ ] anon 접근 제거
[ ] authenticated 사용자의 본인 알림 SELECT 제한 검증
[ ] 본인 알림 read_at UPDATE 권한 검증
[ ] 클라이언트 임의 INSERT 차단
[ ] 클라이언트 DELETE 차단
[ ] RLS 와 GRANT 함께 재검토
[ ] 실제 앱 회귀 테스트
```

### [Release Blocker] profile-images — [v4]

```
[ ] 개발용 open write 정책 제거
[ ] 본인 user_id 경로 INSERT 제한 검증
[ ] 본인 이미지 UPDATE / DELETE 검증
[ ] 타 사용자 경로 INSERT 차단
[ ] 타 사용자 이미지 UPDATE / DELETE 차단
[ ] SELECT 정책을 최종 프로필 공개 정책과 함께 검토
[ ] 실제 앱 회귀 테스트
```

### 두 블록에 공통으로 해당하는 것 — [v4]

현재는 실제 Auth 가 없고 `DEV_USER_ID` 기반으로 개발 중이다.
`auth.uid()` 가 `null` 이라 본인 검사를 지금 켜면 **개발 기능이 막힌다.**
그래서 개발 중에는 개발용 개방 정책을 유지할 수 있다.

**그러나 실제 사용자 데이터가 들어가는 외부 배포 전에는
Production RLS 전환을 반드시 완료한다.**

⚠️ **이 항목은 P2 나 Future 가 아니라 Release Blocker 다.**
지금 상태로 배포하면 다른 사람의 알림을 읽고 지울 수 있고,
다른 사람의 프로필 이미지를 덮어쓰거나 지울 수 있다.

---

## 6-6. Storage — `profile-images` — [v4] v3에 없던 항목

**v3 까지 이 문서에는 Storage 개념이 아예 없었다.**
`20260902000003_profile_images_storage.sql` 로 bucket 하나가 생겼다.

### 6-6-1. bucket 설정

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-images', 'profile-images', true, 2097152,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
```

| 항목 | 값 |
|---|---|
| bucket id / name | `profile-images` |
| public | **`true`** |
| file_size_limit | `2097152` (2 MB) |
| allowed_mime_types | `image/jpeg`, `image/png`, `image/webp` |

⚠️ 여기서 `public = true` 는 **"로그인한 사용자에게만 공개" 가 아니다.**
object URL 을 아는 사람은 **앱 밖에서도 접근할 수 있다.**
프로필 사진을 공개 가능한 비민감 정보로 보는 제품 판단에 따른 것이고,
이 판단이 바뀌면 private bucket + signed URL 로 재설계해야 한다.

### 6-6-2. object path — 권장 규약이며 DB 강제가 아니다

```
{user_id}/{uuid}.jpg
```

⚠️ **이 형식을 DB 나 Storage 가 검사하지 않는다.** 앱이 지키는 규약일 뿐이다.
현재 정책은 `bucket_id` 만 보고 경로를 보지 않는다. (6-6-3)

파일명을 `profile.jpg` 로 고정하지 않는 이유는 캐시다.
경로가 그대로면 사진을 바꿔도 URL 이 같아 브라우저·CDN 캐시 때문에
예전 사진이 보일 수 있다. **이전 파일은 앱이 지운다.**

사용자 폴더를 `{user_id}` 로 두는 것은 실서비스 정책을 위해서다.
경로 첫 폴더가 본인 `uid` 인지만 보면 되기 때문이다. (6-6-4)

### 6-6-3. 현재 정책 — 개발용이다

`storage.objects` 는 Supabase 가 RLS 를 켠 채로 제공한다.
정책을 만들지 않으면 업로드도 조회도 전부 막힌다. 그래서 네 개를 만들었다.

| 정책 | 동작 | 조건 |
|---|---|---|
| `profile_images_read` | SELECT | `bucket_id = 'profile-images'` — **모두 허용** |
| `profile_images_dev_insert` | INSERT | `bucket_id = 'profile-images'` — **개발용 전체 개방** |
| `profile_images_dev_update` | UPDATE | 동일 |
| `profile_images_dev_delete` | DELETE | 동일 |

⚠️ **경로를 보지 않는다.** 지금은 **누구나 다른 사용자의 프로필 이미지를
덮어쓰거나 지울 수 있다.** `dev_open_all` 과 같은 성격의 임시 상태다.

읽기 정책은 다른 사용자의 프로필 사진을 보여줘야 해서 원래 열어 둔 것이고,
쓰기 세 개만 개발용이다.

> 마이그레이션이 `create policy` 앞에 `drop policy if exists` 를 둔 이유:
> `storage.objects` 에는 다른 bucket 의 정책이 함께 살고, `create policy` 에는
> `if not exists` 가 없어 재실행하면 `42710` 으로 실패한다.

### 6-6-4. 실서비스 정책 — 배포 전 적용

정책 원문은 `20260902000003_profile_images_storage.sql` 하단 주석에 있다.
쓰기 세 개를 지우고 경로 검사를 넣는다.

```sql
create policy "profile_images_own_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
-- update · delete 도 같은 조건으로 만든다
```

`storage.foldername('11111111-…/abc.jpg')[1]` 이 `'11111111-…'` 를 준다.
**경로 첫 폴더가 본인 uid 인지**만 보면 된다.

읽기 정책(`profile_images_read`)은 **그대로 둔다.**
다른 사용자의 사진을 보여주는 것이 서비스 요구사항이다.
단 프로필 공개 범위 정책이 바뀌면 함께 재검토한다. (6-5)

---

## 7. migrations 권장 순서 — [변경 6]

1. `users` (← `auth.users` 선행 필요)
2. `groups`, `group_members`
3. `trips`, `trip_members`
4. `trip_budgets`, `budget_categories`, `budget_plan_items`
5. `financial_accounts`, `fund_sources`
6. `transactions`, `contributions`
7. `settlements`
8. `travel_types`, `trip_type_results`, `trip_type_result_items`
9. `community_posts`, `comments`, `reactions`
10. `tip_products`, `tip_purchases`
11. `insurance_referrals`
12. **`event_log`** ← v2 추가
13. RLS 활성 + 정책 (전 테이블 생성 후 마지막)
14. **GRANT (`anon` / `authenticated`)** ← v3 추가

`set_updated_at()` 함수는 1번보다 먼저 만든다.

⚠️ **14번을 빠뜨리면 13번까지 다 해도 앱에서 아무것도 읽지 못한다.** (6-0)

### 7-1. 적용된 마이그레이션 — [변경 3] · [v4]

현재 `develop` 기준 **9개**다. — [v5]

| 파일 | 내용 |
|---|---|
| `20260827000001_init_schema.sql` | 초기 스키마 23개 테이블 + 인덱스 36 + RLS 활성 + `dev_open_all` 정책 |
| `20260828000001_grant_anon_access.sql` | `anon`/`authenticated` GRANT + `alter default privileges`. **RLS 와 짝이다** (6-0) |
| `20260831000001_add_user_group_list_preferences.sql` | 모임 목록 표시 설정 테이블. 정책·GRANT 를 직접 만든 첫 사례 (6-1) |
| `20260901000001_add_plan_item_display_mode.sql` | 계획 항목 표시 방식 |
| `20260901000002_add_transaction_refund.sql` | 거래 환불 |
| **`20260902000002_notifications.sql`** — [v4] | 알림함 테이블 + 인덱스 1 + RLS + GRANT (3장 · 6-1) |
| **`20260902000003_profile_images_storage.sql`** — [v4] | `profile-images` bucket + 정책 4개 (6-6) |
| **`20260903000001_notifications_type_check.sql`** — [v5] | `notifications.type` 에 `notifications_type_check` 추가. 허용값 3종 (3장) |

⚠️ `20260902000001_reaction_types.sql` 은 `reactions.reaction_type` 의 CHECK 를
`('LIKE')` → `('LIKE', 'DISLIKE', 'BOOKMARK')` 로 **넓히기만** 한다.
테이블 구조는 그대로다.

⚠️ **아래 세 개는 이번 판에서 3장 테이블 절에 반영하지 않았다.**
`20260831000001` · `20260901000001` · `20260901000002` 는 v3 이전부터 밀려 있던 것이고,
이번 v4 의 범위(PR #29 동기화) 밖이다. **다음 판에서 정리한다.**

**마이그레이션과 본 문서가 어긋나면 스키마를 임의 변경하지 말고 차이를 먼저 보고한다.**
