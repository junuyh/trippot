# 12. 여행 초대 수신 · 참가 요청 · 승인 — 서버 계약 v1 (최종 확정)

| 항목 | 내용 |
|---|---|
| 문서 상태 | **DB 담당 구현 계약 · 팀 확정 (2026-09-13)** |
| 작성일 | 2026-09-13 (같은 날 미확정 5건을 팀 결정으로 확정) |
| 근거 정책 | `10_여행초대정책_v2.md` §3 · §6 · §7 · §8 · §9 · §10 · §11 · §12 / `11_모임정책_v1.md` §1 · §4 |
| 이 문서가 우선하는 곳 | 아래 §13 "canonical 문서와의 차이" 에 적힌 항목은 **이 문서(최신 팀 확정)가 우선**한다. `10_v2` · `11_v1` 본문은 CLAUDE.md 1-1 에 따라 고치지 않는다 |

**이 문서는 "초대 링크 발급 이후"** — Receiver · 참가 요청 · 승인/거절 — 의 서버 계약이다.
PR #86 이 끝낸 발급 쪽(`trip_invites` · `get_or_create_trip_invite` · token 서버 생성 · 7일 · 재사용 · RLS · service_role SELECT)은 **그대로 두고 그 위에 더한다.** 대체하지 않는다.

---

## 0. 제품 원칙 — 왜 이렇게 나뉘는가

```
group_members   같은 모임에 속한 사용자 · 모임 단위 visibility
trip_members    특정 여행에 실제로 참여하는 사용자
```

MVP 에는 **"모임 멤버 초대/관리" 기능이 없다.** 사람은 여행 초대로만 들어온다.
그래서 새 사람이 특정 여행에 합류하면서 새 모임이 생길 때, **그 여행에 참여하지 않는 기존 모임 멤버를 새 모임에 자동으로 넣지 않는다.**

> **새 모임의 최초 멤버 = target 여행의 ACTIVE trip_members + 이번에 승인되는 요청자.**
> 기존 모임의 멤버십은 바꾸지 않는다.

---

## 1. 왜 앱에서 못 하는가 — 현재 상태 (develop `fadca65`)

| 필요한 일 | 현재 | 막히는 이유 |
|---|---|---|
| 수신자가 token 으로 초대 확인 | 서버 경로 **없음** | PR #86 이후 `trip_invites` 는 ACTIVE 멤버만 SELECT (dev 도 동일). 수신자는 아직 멤버가 아니라 **읽을 수 없다.** 정책상 열지 않는다 |
| 참가 요청 생성 | 함수 **없음** | `trip_join_requests.invite_id` FK 가 필요한데 수신자는 invite 행을 못 본다 |
| 승인 | 함수 **없음** | 최대 5개 테이블 write + 여행장 검사 + headcount 재검사 + PERSONAL→GROUP 전환. 앱 순차 처리는 반쪽 상태와 race 를 남긴다 |
| 거절 · 취소 | 함수 **없음** | 권한 검사를 서버에서 해야 한다 |
| 여행장 판정 | `trips.leader_user_id` | **앱이 여행 생성 시 채우지 않는다** (실제 write 0건 · 주석만). 백필 이후 만든 여행은 **NULL** |

`types/database.ts` `Functions` 에는 `get_or_create_trip_invite` 만 있다. Edge Function 은 `budget-products · classify-transaction · plan-suggestions · receipt-scan` 뿐이다.

---

## 2. 공통 규칙

| 규칙 | 내용 |
|---|---|
| 함수 형태 | `security definer` · `set search_path = public, pg_temp` · `grant execute → authenticated` 만 (`public` · `anon` 회수). PR #86 과 같다 |
| 신원 | **`auth.uid()`** 하나. 앱이 user id 를 인자로 넘기지 않는다 |
| **여행장** | **`trips.leader_user_id = auth.uid()`**. `owner_user_id` 는 판정에 쓰지 않는다. **`leader_user_id IS NULL` 이면 승인·거절을 진행하지 않고 `LEADER_NOT_CONFIGURED` 오류** — 대체 판정으로 임의 여행장을 세우지 않는다 |
| 유효 여행 | `trips.status ∉ ('DELETED', 'CANCELED')` — 앱 `getTrips` 와 같은 기준 |
| ACTIVE 멤버 수 | `trip_members` 중 `status = 'ACTIVE' and user_id is not null` 의 **distinct user_id** 수. PENDING 은 세지 않는다 |
| **outsider** | target 모임의 **ACTIVE `group_members` 가 아닌** 사용자 = 행이 없거나 `status = 'LEFT'`. LEFT 였던 모임원을 자동 복귀시킨 것으로 가정하지 않는다. 판정은 **승인 시점의 ACTIVE 멤버십** 기준 |
| **membership 복원 규칙** (모든 write 공통) | 같은 (trip, user) / (group, user) 행이 이미 있으면 INSERT 하지 않는다. LEFT 행이면 `status = 'ACTIVE'`, `trip_members.left_at = null` 로 **복원**. 기존 `role` · `joined_at` 은 **유지**. 행이 없으면 INSERT. 전부 **멱등** |
| 중복 행 | `trip_members` 에 unique 가 없다. "ACTIVE 행이 하나 이상이면 참여 중" 으로 판단하고, 복원할 때는 그 사용자의 행 전부를 대상으로 한다 |
| 오류 | `raise exception using errcode, message`. 앱은 errcode 로 분기. 아래 표기 `[코드]` 는 DB 담당이 프로젝트 convention 에 맞춰 확정 |

### 2-1. `leader_user_id` — 서버 선행 조건

| | 내용 |
|---|---|
| 의미 | "이 여행의 참가 요청을 최종 수락/거절하는 여행장" |
| **신규 여행** | 앞으로 모든 여행 생성(PERSONAL · GROUP)에서 **`leader_user_id = 생성한 사용자`** 를 저장한다. 현재 앱(`createTripBundle` · `groups/new`)은 넣지 않는다 → **앱 수정 필요** (담당 화면 소유자). 이 문서에서는 계약만 적는다 |
| **기존 NULL 여행 백필** | PERSONAL: `leader_user_id = owner_user_id` — 주인이 곧 여행장이라 추정이 아니다. GROUP: `owner_user_id` 는 여행장이 아니므로 **임의로 채우지 않는다.** DB 담당이 먼저 precheck 를 보고한다 — NULL 인 GROUP 여행 목록 · 생성자를 알 수 있는 칼럼/이력 존재 여부 · ACTIVE trip_members · seed/test 여부. 근거가 있으면 그 값으로, seed/test 는 팀이 명시 지정. **"첫 멤버" 같은 규칙으로 추정하지 않는다** |

---

## 3. `resolve_trip_invite(p_token text)` — 수신자용 초대 확인

**목적** 링크를 연 사람에게 **최소 미리보기**만 준다. `trip_invites` RLS 를 수신자에게 열지 않는다 — 서버 함수(security definer)가 대신 읽는다. Edge Function 으로 구현해도 계약은 같다.

| | |
|---|---|
| auth | `authenticated`. 멤버 여부 무관 |
| 읽기 | `trip_invites` · `trips` · `users`(초대자 이름) · `trip_members`(인원 · 내 상태) · `trip_join_requests`(내 요청) |
| 쓰기 | **없음** |

**반환 (returns table)**

```
invite_state         text   'VALID' | 'EXPIRED' | 'REVOKED' | 'NOT_FOUND'
trip_id              uuid            VALID 일 때만
destination          text
start_date           date
end_date             date
headcount            int             예정 인원
active_member_count  int             현재 ACTIVE 멤버 수
inviter_name         text            trip_invites.created_by → users.name
my_state             text   'NONE' | 'ACTIVE' | 'LEFT' | 'PENDING' | 'REJECTED'
my_request_id        uuid            my_state = PENDING 일 때 (INV-03 취소용)
```

**절대 반환하지 않는 것** 예산 · 목표 금액 · 모은 돈 · 계좌 · 거래 · 멤버 목록 · `invite_id` · `created_by` id · invite 행 전체 · 다른 여행 정보.

```
invite_state 판정
  행 없음                    → NOT_FOUND
  revoked_at is not null     → REVOKED
  expires_at <= now()        → EXPIRED
  그 외                      → VALID

my_state 판정 (auth.uid() 기준 · 위에서부터 첫 일치)
  trip_members ACTIVE 있음                                         → ACTIVE
  trip_join_requests PENDING 있음 (이 trip)                         → PENDING
  trip_join_requests REJECTED 있음 (이 invite_id · 이 user)         → REJECTED
  trip_members LEFT 만 있음                                        → LEFT
  그 외                                                            → NONE
```

⚠️ **headcount 도달은 `invite_state` 가 아니다.** token 은 유효하다. 앱은 `active_member_count >= headcount` 를 "지금은 자리가 없어요 · 여행장이 인원을 늘리면 승인돼요" 로 표시하고 **요청은 허용**한다. 기존 `InviteFailReason.FULL` 은 쓰지 않는다.

---

## 4. `request_trip_join(p_token text)` — 참가 요청

| | |
|---|---|
| auth | `authenticated` |
| 검사 (순서) | ① token → invite 행. 없으면 `[NOT_FOUND]` ② `revoked_at is null and expires_at > now()` 아니면 `[INVITE_NOT_VALID]` ③ 요청자가 ACTIVE `trip_members` 면 `[ALREADY_MEMBER]` ④ **같은 `invite_id` + 같은 `user_id` 로 REJECTED 가 있으면 `[REJECTED_ON_THIS_INVITE]`** ⑤ 같은 trip + user 의 PENDING 이 있으면 **오류 없이 그 행을 돌려준다**(멱등) |
| 쓰기 | `insert trip_join_requests (trip_id, invite_id, user_id, status='PENDING')` |
| 반환 | `request_id uuid · trip_id uuid · status text` |
| 멱등 · race | 기존 `idx_join_req_unique_pending (trip_id, user_id) where status='PENDING'` 이 막는다. 충돌 시 기존 행 반환. 별도 락 불필요 |

- headcount 가 찼어도 **요청은 받는다.** 막는 것은 승인 단계다 (headcount 상향 후 같은 요청을 다시 승인)
- `LEFT` 였던 사람의 재요청은 **허용**한다. 승인 시 membership 이 복원된다
- **REJECTED 는 (invite_id, user_id) 단위 상태다.** A 가 거절돼도 B · C 는 같은 링크를 쓴다. 그 invite 가 만료되고 새 `invite_id` 가 발급되면 A 도 다시 요청할 수 있다. token 자체는 건드리지 않는다

---

## 5. `cancel_trip_join_request(p_request_id uuid)` — 요청 취소 (INV-03)

| | |
|---|---|
| auth | `authenticated` · 요청의 `user_id = auth.uid()` 만. 아니면 `[FORBIDDEN]` |
| 검사 | PENDING 아니면 `[NOT_PENDING]` |
| 쓰기 | `status='CANCELED', decided_at=now()` (`decided_by` null — 여행장 결정이 아니다) |
| 하지 않는 것 | membership · group · token 변경 |
| 반환 | `request_id · status` |

---

## 6. `get_trip_join_requests(p_trip_id uuid)` — 여행장의 대기 목록 (INV-04)

| | |
|---|---|
| auth | **여행장만** (`trips.leader_user_id = auth.uid()`). NULL 이면 `[LEADER_NOT_CONFIGURED]`, 아니면 `[FORBIDDEN]` |
| 반환 (table) | `request_id · user_id · user_name · requested_at · status · is_group_member boolean · has_other_trips boolean · needs_new_group boolean · trip_owner_type text` |

`needs_new_group` 은 §7-1 판정을 서버가 미리 계산한 값이다 — 여행장이 수락을 누르기 **전에** "이 사람을 받으면 새 모임이 생깁니다" 를 보여주기 위해서다 (INV-04 → INV-05).
⚠️ **UI 안내용일 뿐이다.** 실제 CASE 는 승인 함수가 락 안에서 **다시 계산**한다. 목록 값을 transaction 의 진실로 쓰지 않는다.

> RLS 정책(`join_req_self_or_owner` 초안)으로 SELECT 를 여는 대안도 있으나, `needs_new_group` 에 조인이 필요해 함수가 단순하다. DB 담당 판단.

---

## 7. `accept_trip_join_request(p_request_id uuid, p_new_group_name text default null)` — 승인 (원자적)

**한 트랜잭션.** 앱이 insert → update → update 로 나눠 부르지 않는다.

| | |
|---|---|
| auth | **여행장만.** `leader_user_id` NULL → `[LEADER_NOT_CONFIGURED]`. 다른 사람 → `[FORBIDDEN]` |
| 락 | `select … from trip_join_requests where id = p_request_id for update` → `select … from trips where id = trip_id for update`. 같은 여행의 승인을 직렬화한다 — headcount 초과 · CASE C/D 새 모임 중복 생성 방지 |
| 락 이후 재조회 | request status · 여행장 · ACTIVE 멤버 수 · 요청자의 group membership · 다른 유효 여행 수 — **전부 락 안에서 다시 읽는다** |

### 7-0. 공통 검사 (락 안)

```
① request 가 PENDING 인가                               아니면 [NOT_PENDING]
② trips 가 유효 여행인가 (DELETED · CANCELED 아님)          아니면 [TRIP_NOT_OPEN]
③ active_member_count < trips.headcount                  아니면 [HEADCOUNT_REACHED]
     → request 는 PENDING 그대로. REJECTED 로 바꾸지 않는다. token 을 건드리지 않는다.
       여행장이 headcount 를 올린 뒤 같은 요청을 다시 승인한다.
④ 요청자가 이미 ACTIVE trip_members 면                    → request 만 ACCEPTED 로 닫고 종료 (멱등)
```

### 7-1. 분기 판정 (락 안에서 계산)

```
is_personal   = trips.owner_type = 'PERSONAL'
in_group      = trips.group_id 가 있고 요청자가 그 group_members ACTIVE   (LEFT 는 outsider)
other_trips   = 같은 group_id 의 **다른 유효 여행 수** (target 제외 · status ∉ DELETED,CANCELED)
                ⚠️ PLANNING · TRAVELING · ENDED · SETTLED 전부 센다. SETTLED 만 보던 기준은 폐기

CASE A   !is_personal  and  in_group
CASE B   !is_personal  and  !in_group  and  other_trips = 0
CASE C   !is_personal  and  !in_group  and  other_trips >= 1      ← p_new_group_name 필수
CASE D   is_personal                                              ← p_new_group_name 필수
```

C · D 에서 `p_new_group_name` 이 null/공백이면 `[NEW_GROUP_NAME_REQUIRED]` — **아무것도 쓰지 않고** 종료. 앱은 INV-05 로 이름을 받아 다시 부른다. A · B 는 인자를 무시한다.

### 7-2. CASE 별 쓰기

**공통 마무리** — 모든 CASE 마지막에
```
trip_members         요청자: 복원 규칙(§2) 적용 — LEFT 면 ACTIVE 로, 없으면 INSERT
trip_join_requests   status='ACCEPTED', decided_at=now(), decided_by=auth.uid()
```

**CASE A** — 요청자가 이미 모임원
```
group_members   변화 없음
+ 공통
```

**CASE B** — outsider · 보존할 다른 여행 없음 → 기존 모임에 합류
```
group_members   요청자: 복원 규칙 적용 (없으면 INSERT role='MEMBER', status='ACTIVE', joined_at=now())
+ 공통
새 모임을 만들지 않는다.
```

**CASE C** — outsider · 다른 여행 있음 → **target 여행 1건만 새 모임으로**
```
groups          INSERT (name = p_new_group_name, owner_user_id = trips.leader_user_id, status='ACTIVE')
                → new_group_id
group_members   새 모임에 **target 여행의 현재 ACTIVE trip_members 전원** (distinct user_id, user_id not null)
                  role='MEMBER', status='ACTIVE', joined_at=now()
                  ⚠️ 기존 모임의 다른 멤버는 넣지 않는다 — 이 여행에 참여하지 않는 사람이다 (§0)
                + 요청자 (role='MEMBER', status='ACTIVE')
trips           set group_id = new_group_id      (target 한 건만 · owner_type 은 GROUP 그대로)
                ⚠️ 새 trips 행을 만들지 않는다. trip.id 유지
                ⚠️ fund_sources · financial_accounts 관계 · transactions · trip_budgets · settlement
                   데이터는 trip_id 를 따라간다 — 손대지 않는다
기존 모임        group_members 그대로. 다른 여행 그대로. 아무것도 빼지 않는다
+ 공통
```

예 — 기존 모임 A 멤버 {A, B, C, D}, 로마 여행 ACTIVE 참여자 {A, B}, 요청자 E
→ 새 모임 {A, B, E} · 로마는 새 모임으로 · 기존 모임 A 는 {A, B, C, D} 와 다른 여행 그대로 · A, B 는 두 모임 모두의 멤버 (정상) · C, D 는 새 모임에 들어가지 않는다.

**CASE D** — PERSONAL → GROUP 전환 (`11_v1` §4)
```
groups          INSERT (name = p_new_group_name, owner_user_id = trips.leader_user_id, status='ACTIVE')
                → new_group_id
group_members   target 여행의 현재 ACTIVE trip_members 전원 (보통 주인 1명)
                  role='MEMBER', status='ACTIVE', joined_at=now()
                + 요청자 (role='MEMBER', status='ACTIVE')
trips           set owner_type='GROUP', owner_user_id=null, group_id=new_group_id
                ⚠️ trips_owner_shape CHECK 때문에 세 칸을 **한 UPDATE** 로 바꾼다
                ⚠️ 같은 trips 행이다. trip.id 유지. 새 여행을 만들지 않는다
trip_members    기존 주인의 ACTIVE 행 그대로
+ 공통
```

**반환** `request_id · trip_id · group_id (최종) · resolved_case text ('A'|'B'|'C'|'D')`

### 7-3. 새 모임의 `groups.owner_user_id` · `role`

- `groups.owner_user_id` 는 NOT NULL 이라 값이 필요하다. **C · D 모두 `trips.leader_user_id`** 를 넣는다 (승인 함수가 이미 그 사람을 검증했다). 이 칼럼은 **모임장 권한이 아니다** — MVP 에 모임장 개념은 없다. technical owner/creator 필드로만 둔다
- 새 모임의 `group_members.role` 은 전원 `'MEMBER'`. `'OWNER'` 를 부여하지 않는다 (같은 이유)

### 7-4. `pending_group_name` — 쓰지 않는다

한 여행에 PENDING 요청이 여럿이고 요청자마다 새 모임 여부가 다르다. trip 한 칸으로 표현할 수 없다. 이름은 `p_new_group_name` 으로 그 순간 받는다. **칼럼은 지우지 않고(마이그레이션 없음), 읽지도 쓰지도 않는다.** historical unused column.

---

## 8. `reject_trip_join_request(p_request_id uuid)` — 거절

| | |
|---|---|
| auth | **여행장만.** NULL → `[LEADER_NOT_CONFIGURED]` |
| 검사 | PENDING 아니면 `[NOT_PENDING]` |
| 쓰기 | `status='REJECTED', decided_at=now(), decided_by=auth.uid()` |
| 하지 않는 것 | 사유 저장 · **token revoke** · `pending_group_name` 조작 · membership 변경 · 다른 사용자의 요청 영향 |

거절의 효과는 §4 ④ 하나다 — 같은 invite 로 같은 사람의 재요청만 막는다.

---

## 9. 알림 — 트랜잭션과 분리

`notifications` 생성 주체는 **Edge Function(service_role)** 로 확정돼 있다 (`10_v2` §14). 위 함수들은 `notifications` 에 직접 INSERT 하지 않고, **알림 실패가 membership 트랜잭션을 깨뜨리지 않는다.**

```
JOIN_REQUESTED   → 여행장               (request_trip_join 후)
JOIN_ACCEPTED    → 요청자               (accept 후)
JOIN_REJECTED    → 요청자               (reject 후)
MEMBER_JOINED    → 기존 ACTIVE 멤버     (accept 후)
```

트리거로 붙일지 앱이 Edge Function 을 부를지는 **알림 담당 결정.** push infrastructure 는 이 문서 범위 밖.

---

## 10. 기존 sender DB — 다시 만들지 않는다

| 이미 끝난 것 (PR #78 · #86) | 이 문서에서 |
|---|---|
| `trip_invites` · `trip_join_requests` 스키마 | 그대로 |
| `get_or_create_trip_invite` · token 서버 생성 · 7일 · 유효 링크 재사용 | 그대로 |
| ACTIVE 멤버 누구나 발급 | 그대로 |
| `trip_invites` RLS(ACTIVE 멤버 SELECT) · 앱 INSERT/UPDATE 회수 · `service_role` SELECT | 그대로 |
| `idx_join_req_unique_pending` | §4 멱등에 그대로 사용 |

**새로 필요한 것** — 함수 6개(§3~§8) + `leader_user_id` 선행 조건(§2-1) + `types/database.ts` 재생성. **테이블·칼럼 추가 없음.**

---

## 11. 앱이 이 계약으로 만드는 것 (DB 완료 후)

```
lib/supabase/queries/tripJoinRequests.ts     resolve · request · cancel · list · accept · reject 래퍼 (.rpc 만)
app/invite/[token].tsx                       placeholder → InviteLandingView / JoinWaitingView / InviteUnavailableView
                                             (FULL 대신 active_member_count >= headcount 안내)
여행장 화면                                   INV-04 목록 → JoinRequestSheet → needs_new_group 이면 NewGroupNameSheet → accept
여행 생성 flow                                leader_user_id = 생성자 저장 (담당 소유자)
```

---

## 12. 확정 요약

| 항목 | 최종 |
|---|---|
| 새 모임 최초 멤버 (C · D) | **target 여행 ACTIVE trip_members + 요청자.** 기존 모임 멤버 전원 복사 ❌ |
| 기존 모임 | 멤버십 · 다른 여행 **그대로** |
| outsider | ACTIVE `group_members` 아님 (없음 또는 LEFT) |
| REJECTED | **(invite_id, user_id) 단위.** 같은 invite 재요청만 차단. 다른 사람·새 invite 는 영향 없음 |
| LEFT 복원 | `status=ACTIVE`, `left_at=null`. `role` · `joined_at` 유지. 중복 INSERT 없음 |
| 새 `groups.owner_user_id` | `trips.leader_user_id`. 모임장 권한 아님 |
| `leader_user_id` | 여행장 판정 유일 기준 · 신규 생성 시 필수 저장 · NULL 이면 승인/거절 오류 · 백필은 PERSONAL 만 자동, GROUP 은 precheck |
| `pending_group_name` | 사용 안 함 · 삭제 안 함 |
| headcount | 요청은 허용 · 승인만 차단 · 자동 거절/폐기 없음 |
| 원자성 | 요청·여행 행 락 → 재조회 → 판정 → 쓰기, 한 트랜잭션 |

---

## 13. canonical 문서와의 차이 — 이 문서가 우선

| 문서 | 문구 | 이 문서 |
|---|---|---|
| `10_v2` §8 | "거절 기록은 같은 링크로의 재요청 차단에 쓴다" | **(invite_id, user_id) 단위**로 한정. 다른 사용자·새 invite 에는 영향 없음 (§4) |
| `10_v2` §9-4 · `11_v1` §4 | 새 모임 생성 시 멤버 구성을 명시하지 않음 | **target 여행 ACTIVE 참여자 + 요청자** (§7-2) |
| `10_v2` §9-5 · `11_v1` §4 | INV-05 이름을 `pending_group_name` 에 저장 | **저장하지 않는다.** 승인 인자로 전달 (§7-4) |
| `10_v2` §16-3 | LEFT→ACTIVE `joined_at` 미확정 | **유지** (§2 복원 규칙) |
| `20260910000001` 칼럼 주석 | `pending_group_name` "수락 시 소비" | 미사용 (§7-4) |

`10_v2` · `11_v1` 본문은 고치지 않는다 (CLAUDE.md 1-1). 다음 버전(v3 / v2)을 낼 때 위 표를 반영한다.

## 14. 남은 진짜 미확정

- **GROUP 여행의 `leader_user_id` 백필 값** — DB 담당 precheck 결과에 따라 팀이 지정 (§2-1). 자동 규칙 없음
- 알림 발송 주체(트리거 vs 앱 호출) — 알림 담당
