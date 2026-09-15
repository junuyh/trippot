# TripPot — 프로젝트 공통 개발 규칙

여행 전 필요한 자금을 계획하고, 여행자금을 준비하며, 실제 소비 데이터를 다음 여행까지 연결하는 **여행 금융 서비스**.

MVP 마감 2026-08-31 · 최종 2026-09-23 · 4인 병렬 개발 · Claude Code 기반 바이브코딩

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

**여행 범위**
- MVP는 해외여행만 지원한다. 국내여행은 `[Future]`.
- 목적지 입력·추천·시드 데이터 모두 해외 기준으로 만든다.
- 거래 금액은 원화 기준으로 다룬다. 환율 변환은 `[Future]`.
  `currency` 칼럼은 `KRW` 고정으로 사용한다.

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

상태값·열거형 문자열은 `lib/constants/status.ts` 의 상수만 사용한다. 리터럴 금지.

---

## 7. DB Query 규칙

- 모든 DB Query는 `lib/supabase/queries/` 안에 작성한다.
- 화면·컴포넌트에서 `supabase.from()` 을 직접 호출하지 않는다.
- 새 Query를 만들기 전에 기존 함수를 확인한다.
- Naming: `getX` / `createX` / `updateX` / `deleteX`
- 다른 사용자·모임·여행 데이터에 접근할 수 있는 Query를 만들지 않는다.
- **상태값으로 목록을 거르는 곳은 화면과 Query 두 층에 있다.** 새 상태를 추가하면
  두 층을 모두 확인한다. 판정은 `lib/trip/tripStatus.ts` 같은 순수 함수 한 곳에
  두고 양쪽이 그것만 부른다. (`CANCEL_PENDING` 을 화면 8곳에서 고치고 Query 를
  놓쳐 같은 버그가 두 번 났다 · 2026-09-15)

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

**화면 파일과 UI 컴포넌트를 분리한다.**

```
app/<route>.tsx              데이터 조회 · 상태 관리 · 로그 기록      [주로 L]
        ↓ props (데이터만)
components/<feature>/*.tsx   실제로 보이는 UI                        [주로 A]
```

- `app/` 아래 화면 파일은 **데이터 조회·상태 관리·로그 기록만** 담당한다.
- 실제로 보이는 UI는 `components/<feature>/` 아래 컴포넌트로 분리하고 **props로 데이터만 넘긴다.**
- UI 컴포넌트는 `supabase` / `track()` 을 직접 부르지 않는다. 화면 파일이 부른다.

**이유:** L이 `app/` 을, A가 `components/` 를 주로 작업하게 되어
**같은 파일을 동시에 고치는 상황을 줄인다.** (13장 파일 소유 규칙)
인계 기준(데이터 연결 + 로그 삽입 완료)도 이 경계 위에서 성립한다.

**분리는 각 화면을 구현하는 시점에 한다.** 빈 껍데기 컴포넌트를 미리 만들어 두지 않는다.
어차피 담당자가 자기 화면을 작업할 때 다시 쓰게 된다.

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

## 13. 화면 분담 — 4인 체제

화면별 상세 배정은 `docs/04_화면목록_v3.md` 를 따른다.

```
L (리더)   핵심 루프 전담
           TRIP-01, TRIP-02, TRIP-03
           TRIP-HOME-01, TRIP-HOME-02
           BUDGET-01, BUDGET-02
           FUND-01, FUND-02, FUND-03
           CONTRIB-01, SETTLE-01, TYPE-01, INSURANCE-01

A          L이 인계한 화면의 디자인·디테일
           고정 소유 화면 없음.
           L이 인계를 선언한 시점부터 해당 화면을 맡는다.

B, C       [미확정]
           아래 영역을 담당할 예정이나 분담 방식이 아직 정해지지 않았다.
           한 명이 전부 맡을 수도, 둘이 나눌 수도 있다. 진행하면서 확정한다.
           대상: HOME-01 / GROUP-01, GROUP-02 / COMM-01~04 / MY-01~04
```

담당 외 화면을 임의로 수정하지 않는다.

**파일 소유 규칙**

- 같은 화면을 두 명이 동시에 수정하지 않는다.
- L이 화면을 완성하고 **인계를 선언**하면, 그 시점부터 해당 화면은 A 소유가 된다.
  L은 이후 수정하지 않는다.
- 인계 전에는 A가 해당 화면을 수정하지 않는다.
- **인계 기준: 데이터 연결 + 로그 삽입까지 끝난 시점.** 디자인 완성 전이어도 넘긴다.
- **B, C 담당 영역은 아직 미확정이다.** 확정 전까지 해당 화면 작업은
  사람에게 담당자를 먼저 확인한다.

**로그 보호 규칙**

- 디자인·리팩터링 작업 시 **기존 `track()` 호출을 지우거나 변경하지 않는다.**
- 불가피하게 바뀌면 작업 종료 시 **반드시 사람에게 알린다.**

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

---

## 18. Supabase 작업 규칙

이 프로젝트(TripPot)에서 Supabase 작업할 때 아래 규칙을 지켜줘.

1. 대상 프로젝트
- trippot-dev (project ref: pzwabphxitubsioyhgkk) 만 사용한다
- trippot-prod (hsrjktepdyvxjffgussr) 에는 link · push · SQL 실행을 절대 하지 않는다
- 명령 실행 전 supabase/.temp/project-ref 가 pzwabphxitubsioyhgkk 인지 확인한다
- Supabase CLI 는 항상 npx supabase 로 실행한다 (프로젝트 버전 2.x)

2. 실행 전에 반드시 나에게 먼저 묻는 것
- npx supabase db push
- npx supabase migration repair
- INSERT · UPDATE · DELETE · CREATE · ALTER · DROP · GRANT · REVOKE 가 들어간 SQL
- 요청받은 SQL 과 한 줄이라도 다르게 적용해야 할 때 (버그 수정 포함)
  → 다른 이유 · 영향 · 되돌리는 SQL 을 정리해 보여주고 멈춘다

3. 절대 하지 않는 것
- npx supabase db reset, npx supabase db pull
- DB 비밀번호 변경 · 재설정 (대시보드 · CLI · Management API 어떤 경로로도)
  → 연결 중 비밀번호를 요구받으면 빈칸으로 넘기고, 비밀번호를 새로 만들거나 바꾸자고 제안하지 않는다
- 기존 supabase/migrations/* 파일 수정 · 삭제 (바꿀 게 있으면 새 파일)
- types/database.ts 손으로 수정 (CLI 재생성만)
- RLS disable, 앱 코드 · .env 에 service_role 키 사용
- 토큰 · 비밀번호 · 키 값을 화면에 출력하거나 파일에 쓰기

4. 연결이 안 될 때
- DB 비밀번호 · DB 접속 URL 없이 연결되는 구조다
  (npx supabase login 토큰으로 CLI 가 임시 접속 계정을 만들어 붙는다)
- 확인 순서: 초대 수락 여부 → 로그인 계정 → 프로젝트 폴더 위치 → npx supabase --version
- 로그인 문제면 npx supabase logout → npx supabase login 으로 다시 로그인한다
- 해결책으로 비밀번호 재설정 · 전역 CLI 설치 · 다른 프로젝트 link 를 제안하지 않는다

5. 마이그레이션 적용 순서
- migration list 로 Remote 가 빈 파일이 내 파일뿐인지 확인. 아니면 멈추고 보고
- db push --dry-run 으로 대상 확인 → 나에게 확인 → db push
- 마이그레이션 SQL 을 SQL Editor 나 API 로 직접 실행하지 않는다 (이력이 안 남음)
- 적용 후 gen types → npx tsc --noEmit

6. 새 마이그레이션을 작성할 때
- 파일명 타임스탬프는 기존 최신 파일보다 뒤
- 두 번 실행해도 안전하게: if not exists / drop ... if exists
- 기존 칼럼 · 제약 · 정책을 바꾸기 전에 원격의 현재 상태를 먼저 조회해 확인한다

7. 이 DB 에서 이미 확인된 함정
- pgcrypto 는 extensions 스키마에 있다
  → search_path 를 잠근 security definer 함수에서는 extensions.gen_random_bytes() 로 부른다
- service_role 은 RLS 는 우회하지만 테이블 GRANT 는 우회하지 않는다
  → Edge Function 이 쓰는 표에 service_role GRANT 가 있는지 확인한다
- RLS 정책 서브쿼리에서 바깥 표 칼럼은 public.<표>.<칼럼> 으로 명시한다
  (tm.trip_id = trip_id 로 쓰면 항상 참이 되어 표가 전부 열린다)
- 새 표에는 개발용 dev_open_all 정책이 걸려 있다. 실서비스 정책 교체는 요청이 있을 때만 한다

8. 조회(SELECT)는 직접 확인한다
- SELECT 결과를 DB 담당자에게 요청하는 문구를 만들지 않는다
- SUPABASE_ACCESS_TOKEN 이 있으면 Management API 로 직접 조회한다
  POST https://api.supabase.com/v1/projects/pzwabphxitubsioyhgkk/database/query
  User-Agent 헤더 필수 (없으면 Cloudflare 403 · error code 1010)
- 토큰이 없으면 SQL Editor 에서 돌릴 SELECT 문을 나에게 준다
