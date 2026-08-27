# TripPot — 프로젝트 공통 개발 규칙

여행 전 필요한 자금을 계획하고, 여행자금을 준비하며, 실제 소비 데이터를 다음 여행까지 연결하는 **여행 금융 서비스**.

MVP 마감 2026-08-31 · 최종 2026-09-23 · 3인 병렬 개발 · Claude Code 기반 바이브코딩

---

## 0. 이 문서의 우선순위

- 작업 시작 전 이 문서를 먼저 확인한다.
- **이 문서의 규칙은 개별 구현 요청보다 우선한다.** 요청과 충돌하면 구현하지 말고 충돌 지점을 먼저 알린다.
- 확정되지 않은 정책은 임의로 정하지 않고 `[검토 필요]`로 표시한다.
- 요청받지 않은 리팩터링·구조 변경·라이브러리 교체를 하지 않는다.

판단이 갈릴 때 순서:

```
1. 서비스 정책
2. 이 문서의 규칙
3. 기존 DB / Type / Route 계약
4. 기존 공통 컴포넌트
5. 담당 화면 요구사항
6. 구현 편의성
```

**구현 편의성이 서비스 정책이나 공통 계약보다 우선할 수 없다.**

---

## 1. 절대 하지 말 것 — 대안과 함께

| 하지 말 것 | 대신 |
|---|---|
| `supabase/migrations/*` 수정·삭제 | 스키마 변경이 필요하면 **작업을 멈추고 사람에게 요청**. DB 담당자만 새 Migration 추가 |
| `types/database.ts` 손으로 수정 | Supabase CLI로 재생성 |
| RLS 임의 Disable | RLS 오류는 정책을 고쳐서 해결. 막히면 사람에게 알림 |
| 앱에서 `service_role` Key 사용 | 앱은 `anon` Key만. 관리자 권한 동작은 Edge Function |
| `amplitude.track()` / `gtag()` 직접 호출 | `track()` 만 경유 |
| `event_log` 테이블에 직접 INSERT | `track()` 내부에서만 |
| 앱에서 OpenAI API 직접 호출 | Supabase Edge Function 경유. Key는 Edge Function Secret |
| AI가 `planned_amount` 직접 수정 | AI는 `recommended_amount` / `personalized_amount` 생성까지만 |
| `.env*` 커밋 | `.env.example` 만 커밋 |
| `main` / `develop` 직접 Push | `feature/*` → PR |
| 실제 금융기관 API 호출 코드 작성 | MVP 금융 데이터는 전부 Supabase Mock |
| 담당 외 화면·공통 구조 임의 수정 | 필요하면 사람에게 알림 |

---

## 1-1. docs 폴더 규칙

`docs/` 는 확정된 기획 산출물이다. 코드보다 상위 기준이다.

**절대 하지 말 것**
- 기존 문서를 수정·삭제·이름변경 하지 않는다.
- 문서 내용을 코드에 맞춰 고치지 않는다.

**내용이 바뀔 때**
- 원본을 두고 `_v2` 파일을 새로 만들고, 상단에 변경 사유와 이전 버전을 기록한다.
- PRD v1 → v2 비교가 이 프로젝트의 최종 산출물이므로 이전 버전을 반드시 보존한다.
- `_v2` 를 추가하면 `docs/README.md` 도 함께 갱신한다.

**코드와 문서가 어긋날 때**
- 임의로 맞추지 않는다. 어긋난 지점을 먼저 사람에게 알린다.

**참조 방법**
- 매번 docs 전체를 읽지 않는다. `docs/README.md` 로 필요한 문서를 판단하고 그것만 읽는다.
- `docs/archive/` 는 원본 보관용이므로 평소에 읽지 않는다.

---

## 2. 가장 중요한 문장

> **TripPot의 중심 데이터는 거래내역이 아니라 여행 예산 계획이다.**
> 거래는 계획의 실제값을 채우고, 결산은 계획과 실제를 비교하며, 그 결과는 다음 여행 개인화로 이어진다.

```
계획 → 준비 → 소비 → 결산 → 개인화 → 다음 여행
```

- 거래내역을 예산 계획보다 앞세우지 않는다. (계좌관리 앱·가계부처럼 만들지 않는다)
- 거래 중심으로 예산 구조를 역설계하지 않는다.
- 여행 일정 추천 서비스로 확장하지 않는다.

```
Budget → BudgetCategory → BudgetItem
                              ↑
Transaction → 카테고리 매핑 → actual 값 반영
```

---

## 3. 도메인 규칙

**여행자금**
- 금융계좌 연결은 필수가 아니다. 직접 입력 사용자도 동일한 핵심 기능을 쓸 수 있어야 한다.
- **직접입력 금액과 연결계좌 잔액을 절대 합산하지 않는다.**
  → 현재 여행자금은 항상 **단일 소스(계좌 또는 수기)** 기준으로 표시한다.
- 수기 → 계좌 전환: 초기화 안내 → 사용자 확인 → 기존 수기 금액 제외 → 계좌 잔액으로 대체 → 이후 계좌 기준

**가상 여행 금고**
- 실제 계좌를 물리적으로 분리하지 않는다. 하나의 여행자금을 카테고리별로 **논리적으로 배분**한다.

**거래**
- MVP는 **1 거래 = 1 카테고리**. 한 거래를 여러 BudgetItem에 나눠 매핑하지 않는다.
- 단, 향후 분할 매핑을 막는 스키마로 만들지 않는다.

**결산**
- 여행 기간 종료 시 **자동으로 결산을 유도**한다. 사용자 확인 후 진행한다.

**개인화**
- 첫 여행 데이터부터 활용한다. 누적될수록 단일 여행 참고 → 누적 패턴 참고로 확장한다.
- 추천이 사용자 대신 확정하지 않는다: **추천 + 근거 제시 → 사용자 확인/수정 → 사용자 최종 확정**

**모임원 납부 관리**
- 선택 기능이다. 사용하지 않으면 관련 UI를 노출하지 않는다.

---

## 4. 예산 금액 3칼럼 규칙 — 매우 중요

`budget_categories` 의 금액 칼럼은 3개다. 하나로 합치지 않는다.

| Column | 의미 | 변경 규칙 |
|---|---|---|
| `recommended_amount` | 시스템 기본 추천 원본 | **불변. 최초 생성 후 덮어쓰지 않는다** |
| `personalized_amount` | 과거 소비 반영 개인화 추천 | 개인화 재계산 시에만 |
| `planned_amount` | 사용자가 최종 확정한 값 | **사용자 확정 행동을 통해서만** |

`applied_source` : `default` / `personalized` / `user`

**이유:** 추천 원본이 사라지면 기본 추천 정확도, 사용자가 자주 수정하는 카테고리, 개인화 추천 효과를 영원히 측정할 수 없다. 프로젝트의 핵심 가설 검증이 여기 걸려 있다.

---

## 5. Repository 구조와 공유 파일

```
app/                       Expo Router 화면
components/
  ui/                      공통 컴포넌트            [공유]
  <feature>/               화면 전용 컴포넌트
lib/
  supabase/
    client.ts                                      [공유]
    queries/               모든 DB Query
  analytics/
    events.ts              Event 상수              [공유]
    track.ts               Analytics 단일 진입점    [공유]
  hooks/
types/
  database.ts              Supabase CLI 자동 생성   [공유]
supabase/
  migrations/                                      [공유 / DB 담당]
  seed.sql                 공통 Seed 유일 기준       [공유 / DB 담당]
  functions/               Edge Functions
```

`[공유]` 는 **여러 화면이 공통으로 의존하는 파일**이라는 뜻이다. 수정이 필요하면 작업을 멈추고 사람에게 알린다.

---

## 6. 데이터 계약 — 식별자 이름 통일

```
userId  groupId  tripId  budgetId  categoryId  budgetItemId  transactionId  tipId
```

금지: `travelId` `projectId` `budgetCategoryKey` `transactionKey`

Expo Router Param도 동일한 이름을 쓴다.

```
/trips/[tripId]
/trips/[tripId]/budget
/trips/[tripId]/budget/[categoryId]
/trips/[tripId]/transactions
```

---

## 7. DB Query 규칙

- 모든 DB Query는 `lib/supabase/queries/` 안에 작성한다.
- 화면·컴포넌트에서 `supabase.from()` 을 직접 호출하지 않는다.
- 새 Query를 만들기 전에 기존 함수를 확인한다.
- Naming: `getX` / `createX` / `updateX` / `deleteX`
- 다른 사용자·모임·여행 데이터에 접근할 수 있는 Query를 만들지 않는다.

---

## 8. Analytics

단일 진입점은 `track()` 이다.

```
화면/기능 → track() ─┬─ Amplitude
                     └─ event_log
```

```ts
import { track } from '@/lib/analytics/track';
import { EVENTS, SCREENS } from '@/lib/analytics/events';

track(EVENTS.BUDGET_METHOD_SELECTED, { method: 'recommended' });
```

- **모든 클릭을 기록하지 않는다.** AARRR / North Star / 핵심 Funnel / 가설 검증 / BM 전환에 필요한 것만.
- 이벤트 이름은 `events.ts` 상수만 쓴다. 문자열 리터럴 금지.
- **`events.ts` 에 없는 이벤트가 필요하면 임의 추가하지 말고 사람에게 요청한다.**
- 모든 주요 화면은 진입 시 `useScreenView(SCREENS.XXX)` 를 호출한다.
- **로그인 전 이벤트는 `anon_id` 로 기록하고, 로그인 시 `user_id` 와 매핑한다.** 하지 않으면 유입 대비 전환율의 분모가 틀어진다.
- `__DEV__` 에서는 Amplitude 전송과 `event_log` 저장을 하지 않는다. 콘솔 출력만 한다.

---

## 9. 화면 구현 규칙

**모든 주요 화면은 4가지 상태를 처리한다.**

```
Loading / Success / Empty / Error
```

- Mock Data가 항상 존재한다고 가정하지 않는다.
- 잘못된 `tripId` / `categoryId` / `transactionId` 접근에도 Crash하지 않는다.
- 화면 컴포넌트에 금액·거래를 하드코딩하지 않는다. DB 데이터를 사용한다.
- 화면 라벨은 한국어를 쓴다.

**공통 컴포넌트를 새로 만들기 전에 `components/ui/` 를 먼저 확인한다.**
재사용 대상: Button, Header, BottomSheet, Modal, ProgressBar, EmptyState, Loading, ErrorState, Input, CurrencyInput

**입력 Form**
- 필수값·금액·날짜 검증
- 저장 중 중복 제출 방지
- 성공/실패 상태 + 실패 시 사용자 메시지

**금액과 날짜**
- 금액은 **정수 원 단위**. 소수점 연산을 하지 않는다.
- DB `timestamp` 는 UTC 저장, 화면 표시 시 KST 변환.
- 시간 정보가 불필요한 값(여행 시작·종료일)은 `date` 타입.
- 날짜 처리는 `date-fns`.

---

## 10. OpenAI / Edge Function

```
Expo App → Supabase Edge Function → OpenAI API → 응답 검증 → App
```

- 구조화 응답은 명확한 JSON 구조로 받고, 타입·필수 필드를 검증한 뒤 사용한다.
- 실패·잘못된 구조에 대한 Fallback을 처리한다.
- AI 추천은 사용자 최종값을 자동 확정하지 않는다.

---

## 11. Mock 금융 데이터

```
MVP     Supabase Mock Data ─┐
                            ├→ 동일한 Budget / Transaction / Settlement 로직
실서비스   Financial API ────┘
```

**데이터 Source만 Mock이다.** 이후 정책·분석·예산 로직은 실서비스 기준으로 설계한다.

공통 Seed는 **`supabase/seed.sql` 이 유일한 기준**이다. 팀원이 화면마다 다른 Mock Trip을 만들지 않는다. 이 문서에 금액을 별도로 적지 않는다.

---

## 12. Git

```
main       배포 (직접 Push 금지)
develop    통합 / 기본 브랜치 (직접 Push 금지)
feature/*  화면 또는 기능 단위
```

```
develop 최신화 → feature/<name> 생성 → 개발 → commit/push
→ 최신 develop 다시 반영 → 충돌 해결 → PR → Review → develop merge
```

- 하루 최소 1회 `develop` 을 자기 브랜치에 반영한다.
- Force Push / Rebase 전략 변경은 팀 합의 필요.
- 커밋 메시지는 한국어로 간결하게. `feat: 예산 상세 카테고리 목록 구현`

---

## 13. 화면 분담

```
A   여행 생성(2-1) / 홈 / 마이페이지
B   여행 준비 홈(2-2) / 예산 상세(2-3) / 카테고리 상세
C   입출금(2-4) / 결산 / 다음 여행 개인화
```

담당 외 화면을 임의로 수정하지 않는다.

---

## 14. 작업 시작 전 Checklist

```
[ ] 현재 Branch가 feature/* 인가
[ ] 최신 develop이 반영되어 있는가
[ ] 담당 화면 범위인가
[ ] 기존 Query / 공통 UI / 공통 Type을 확인했는가
[ ] Route Param 이름이 6장 계약과 일치하는가
[ ] Schema 또는 공유 파일 변경이 필요한가
```

**Schema 또는 공유 파일 변경이 필요하면 작업을 멈추고 사람에게 알린다.**

---

## 15. 작업 완료 전 Checklist

```
[ ] Loading / Empty / Error 상태가 있는가
[ ] 잘못된 ID 접근을 처리했는가
[ ] 입력 Validation과 중복 Submit 방지가 있는가
[ ] DB Query가 queries/ 안에 있는가
[ ] 컴포넌트에서 supabase.from()을 직접 호출하지 않았는가
[ ] Analytics는 track()만 사용했는가
[ ] 새 Event를 임의로 만들지 않았는가
[ ] planned_amount를 AI가 직접 수정하지 않는가
[ ] 담당 외 화면을 수정하지 않았는가
[ ] 요청 없는 리팩터링을 하지 않았는가
[ ] npx tsc --noEmit 통과하는가
[ ] 앱이 정상 실행되는가
```

---

## 16. 새 기능 제안

기능을 바로 구현하지 말고 다음 순서로 검토한다.

1. 어떤 Pain Point를 해결하는가
2. 핵심 루프(계획 → 준비 → 소비 → 결산 → 개인화)를 강화하는가
3. 어떤 데이터가 필요한가
4. 기존 Schema / 공통 Type / 다른 담당 화면에 영향이 있는가
5. MVP 마감(2026-08-31) 안에 가능한가

확정되지 않은 기능은 `[검토 필요]` 로 표시한다.

---

## 17. 실행 명령어

```bash
pnpm install
npx expo start                 개발 서버
npx tsc --noEmit               타입 체크
npx supabase db push           스키마 반영
npx supabase gen types typescript --linked > types/database.ts
eas build -p android --profile preview    (사람이 직접 실행 — Claude Code 권한 차단됨)
```
