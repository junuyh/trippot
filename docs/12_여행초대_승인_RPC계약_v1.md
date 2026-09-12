# 12. 여행 초대 수신 · 참가 요청 · 승인 — DB/RPC 계약 요청서 v1

| 항목 | 내용 |
|---|---|
| 문서 상태 | **DB 담당 요청서** (앱 구현 전 필요한 서버 계약) |
| 작성일 | 2026-09-13 |
| 근거 정책 | `10_여행초대정책_v2.md` §3 · §6 · §7 · §8 · §9 · §10 · §11 · §12 / `11_모임정책_v1.md` §1 · §4 |
| 작성 배경 | Sender P0(PR #90)는 `get_or_create_trip_invite()` 하나로 끝났다. Receiver → 참가 요청 → 승인은 **서버 계약이 하나도 없어** 앱에서 시작할 수 없다. 앱이 직접 쓰면 정책(§12 "client 직접 INSERT 금지" · "atomic 처리")을 어긴다. |

**이 문서는 정책을 새로 정하지 않는다.** 확정 정책을 서버 함수 계약으로 옮긴 것이다. 구현 방식(plpgsql RPC / Edge Function)은 DB 담당이 정하되, 아래 "auth rule · atomic writes · race protection" 은 어느 방식이든 지켜야 한다.

---

## 0. 왜 앱에서 못 하는가 — 현재 상태 (2026-09-13 develop `fadca65`)

| 필요한 일 | 현재 | 막히는 이유 |
|---|---|---|
| 수신자가 token 으로 초대 확인 | 서버 경로 **없음** | PR #86 이후 `trip_invites` 는 ACTIVE 멤버만 SELECT (dev 도 동일). 수신자는 아직 멤버가 아니라 **읽을 수 없다.** 정책상 열지 않는다 (§6) |
| 참가 요청 생성 | RPC **없음** | `trip_join_requests.invite_id` FK 가 필요한데 수신자는 invite 행을 못 본다. dev 는 `dev_open_all` 이라 INSERT 는 되지만 invite_id 를 알 수 없고, 배포 정책 초안은 INSERT 를 막는다 |
| 승인 | RPC **없음** | 4~7개 테이블 write + 여행장 검사 + headcount 재검사 + PERSONAL→GROUP 전환. 앱에서 순차로 하면 중간 실패 시 반쪽 상태가 남고 동시 승인 race 를 막을 수 없다 (§12) |
| 거절 | RPC **없음** | 여행장 검사를 서버에서 해야 한다. dev `dev_open_all` 로는 누구나 UPDATE 가능 |
| 여행장 판정 | `trips.leader_user_id` | **앱이 여행 생성 시 채우지 않는다.** 마이그레이션 백필 이후 만들어진 여행(예: 실제 카카오 계정의 니스)은 **NULL** → 승인 권한자가 없다 |

`types/database.ts` `Functions` 에는 `get_or_create_trip_invite` 만 있다. Edge Function 은 `budget-products · classify-transaction · plan-suggestions · receipt-scan` 뿐이다.

---

## 1. 공통 규칙

- 모든 함수는 `security definer` · `set search_path = public, pg_temp` · `grant execute → authenticated` 만 (`public` · `anon` 회수). PR #86 과 같은 형태
- 신원은 **`auth.uid()`** 하나. 앱이 user id 를 인자로 넘기지 않는다
- 여행장 = **`trips.leader_user_id = auth.uid()`**. `owner_user_id` 로 판정하지 않는다 (§2)
- "유효 여행" = `trips.status ∉ ('DELETED', 'CANCELED')` — 앱 `getTrips` 와 같은 기준 (`11` §9-3)
- ACTIVE 멤버 수 = `trip_members` 중 `status = 'ACTIVE' and user_id is not null` 의 **distinct user_id** 수. PENDING 은 세지 않는다 (§10)
- 같은 여행에 `trip_members` 행이 여러 개일 수 있다 (unique 없음). "ACTIVE 행이 하나 이상이면 참여 중" 으로 본다
- 오류는 `raise exception using errcode, message` 로. 앱은 `errcode` 로 분기한다

---

## 2. `resolve_trip_invite(p_token text)` — 수신자용 초대 확인

**목적** 링크를 연 사람에게 **최소 미리보기**만 준다. (§6 · §11)

| | |
|---|---|
| auth | `authenticated`. 멤버 여부 무관 (아직 멤버가 아닌 사람이 주 사용자) |
| 읽기 | `trip_invites` (security definer 로 RLS 우회) · `trips` · `users`(초대자 이름) · `trip_members`(인원 · 내 상태) · `trip_join_requests`(내 요청) |
| 쓰기 | **없음** |

**반환 (returns table)**

```
state                text   'VALID' | 'EXPIRED' | 'REVOKED' | 'NOT_FOUND'
trip_id              uuid            (VALID 일 때만)
destination          text
start_date           date
end_date             date
headcount            int             예정 인원
active_member_count  int             현재 ACTIVE 멤버 수
inviter_name         text            trip_invites.created_by → users.name
my_state             text   'NONE' | 'ACTIVE' | 'LEFT' | 'PENDING' | 'REJECTED'
my_request_id        uuid            PENDING 이면 그 요청 id (INV-03 취소용)
```

**절대 반환하지 않는 것** 예산 · 목표 금액 · 모은 돈 · 계좌 · 거래 · 멤버 목록 · `invite_id` · `created_by` id · 다른 여행 정보. (§11)

**state 판정**
```
행 없음                           → NOT_FOUND
revoked_at is not null            → REVOKED
expires_at <= now()               → EXPIRED
그 외                             → VALID
```

⚠️ **headcount 도달은 state 가 아니다.** token 은 유효하다. `active_member_count >= headcount` 는 앱이 "지금은 자리가 없어요 · 여행장이 인원을 늘리면 승인돼요" 로 표시하고 **요청은 허용**한다. (§4-4 · §10) 기존 `InviteFailReason.FULL` 은 쓰지 않는다.

**my_state** 는 `auth.uid()` 기준. `trip_members` ACTIVE 가 있으면 `ACTIVE`, LEFT 만 있으면 `LEFT`, `trip_join_requests` PENDING 이 있으면 `PENDING`, 가장 최근 요청이 REJECTED 면 `REJECTED`, 그 외 `NONE`.

---

## 3. `request_trip_join(p_token text)` — 참가 요청

**목적** 링크를 연 사람이 "참여 요청" 을 누른다. `trip_join_requests` PENDING 한 행. (§7)

| | |
|---|---|
| auth | `authenticated` |
| 검사 (순서) | ① token → invite 행. 없으면 `P0002 Invite not found` ② `revoked_at is null and expires_at > now()` 아니면 `22023 Invite not valid` ③ 요청자가 이미 ACTIVE `trip_members` 면 `23505 Already a member` ④ PENDING 이 이미 있으면 **오류 없이 그 행을 돌려준다** (멱등) |
| 쓰기 | `insert trip_join_requests (trip_id, invite_id, user_id, status='PENDING')` |
| 반환 | `request_id uuid · trip_id uuid · status text` |
| 멱등 | `idx_join_req_unique_pending (trip_id, user_id) where status='PENDING'` 을 그대로 쓴다. 충돌 시 기존 행 반환 |
| race | unique partial index 가 막는다. 별도 락 불필요 |

⚠️ headcount 도달 상태여도 **요청은 받는다.** 막는 것은 승인 단계다. (§10 "headcount 상향 후 기존 PENDING 재사용")
⚠️ `LEFT` 였던 사람의 재요청은 **허용**한다 (재참여 확정 정책 · §7).
⚠️ 이전에 REJECTED 된 사람의 재요청 — **미확정.** `10_v2` §8 "거절 기록은 같은 링크로의 재요청 차단에 쓴다" 와 §4 "같은 링크를 여러 명이 7일간 재사용" 이 충돌 여지가 있다. **팀 결정 전까지 차단하지 않는다** (아래 §8 미확정 참조).

---

## 4. `cancel_trip_join_request(p_request_id uuid)` — 요청 취소 (INV-03)

| | |
|---|---|
| auth | `authenticated` · 요청의 `user_id = auth.uid()` 만 |
| 검사 | PENDING 이 아니면 `22023 Not pending` |
| 쓰기 | `status='CANCELED', decided_at=now()` (`decided_by` 는 null — 여행장 결정이 아니다) |
| 반환 | `request_id · status` |

---

## 5. `get_trip_join_requests(p_trip_id uuid)` — 여행장의 대기 목록 (INV-04)

| | |
|---|---|
| auth | **여행장만** (`trips.leader_user_id = auth.uid()`). 아니면 `42501` |
| 반환 (table) | `request_id · user_id · user_name · requested_at · needs_new_group boolean · from_group_name text` |

`needs_new_group` 은 §6-1 판정을 서버가 미리 계산해 준다 — 여행장이 수락 버튼을 누르기 **전에** "이 사람을 받으면 새 모임이 생깁니다" 를 보여주기 위해서다 (INV-04 → INV-05 흐름). 앱에서 다시 계산하지 않는다.

> 이 함수 대신 **RLS 정책** `join_req_self_or_owner`(마이그레이션 하단 초안) 로 SELECT 를 여는 방법도 있다. 다만 `needs_new_group` 판정에 group_members · trips 조인이 필요해 함수가 더 단순하다. **DB 담당 판단.**

---

## 6. `accept_trip_join_request(p_request_id uuid, p_new_group_name text default null)` — 승인 (원자적)

**목적** 여행장이 수락한다. **한 트랜잭션**에서 4 CASE 중 하나를 실행한다. (§8 · §9-4 · `11` §4)

| | |
|---|---|
| auth | **여행장만.** 아니면 `42501 Trip leader required` |
| 락 | `select … from trips where id = trip_id for update` — 같은 여행의 승인을 직렬화 (headcount race · 동시 새 모임 생성 방지) |

### 6-0. 공통 검사 (락 안에서)

```
① request 가 PENDING 인가                            아니면 22023 Not pending
② trips.status 가 유효 여행인가 (DELETED·CANCELED 아님)  아니면 22023 Trip not open
③ active_member_count < trips.headcount               아니면 P0003 Headcount reached
   → 요청은 PENDING 그대로 둔다. REJECTED 로 바꾸지 않는다. token 을 건드리지 않는다. (§10)
④ 요청자가 이미 ACTIVE trip_members 면                 → 요청만 ACCEPTED 로 닫고 종료 (멱등)
```

### 6-1. 분기 판정

```
is_personal     = trips.owner_type = 'PERSONAL'
in_group        = trips.group_id 가 있고 요청자가 그 group_members ACTIVE
other_trips     = 같은 group_id 의 다른 유효 여행 수 (target 제외 · status ∉ DELETED,CANCELED)
                  ⚠️ PLANNING · TRAVELING · ENDED · SETTLED 전부 센다. SETTLED 만 보던 기준은 폐기 (§9-2)

CASE A  !is_personal and in_group
CASE B  !is_personal and !in_group and other_trips = 0
CASE C  !is_personal and !in_group and other_trips >= 1     ← p_new_group_name 필수
CASE D  is_personal                                          ← p_new_group_name 필수
```

C · D 에서 `p_new_group_name` 이 null/공백이면 `22023 New group name required` — **아무것도 쓰지 않고** 끝낸다. 앱은 이 오류(또는 §5 의 `needs_new_group`)를 보고 INV-05 를 띄운 뒤 이름을 넣어 다시 부른다.

### 6-2. CASE 별 쓰기

**공통 마지막 두 줄** — 모든 CASE 에서 수행
```
trip_members    요청자의 LEFT 행이 있으면 status='ACTIVE' 로 복원, 없으면 insert (status='ACTIVE')
trip_join_requests  status='ACCEPTED', decided_at=now(), decided_by=auth.uid()
```

**CASE A** — 위 공통만. `group_members` 변화 없음.

**CASE B**
```
group_members   insert (group_id, user_id=요청자, role='MEMBER', status='ACTIVE', joined_at=now())
                ⚠️ unique(group_id, user_id) — LEFT 행이 있으면 status='ACTIVE' 로 복원 (role · joined_at 처리는 미확정 · 10_v2 §16-3)
+ 공통
```

**CASE C** — target 여행 1건만 새 모임으로 이동
```
groups          insert (name=p_new_group_name, owner_user_id=auth.uid(), status='ACTIVE')  → new_group_id
group_members   기존 group 의 ACTIVE 멤버 전원을 새 group 에 복사
                  (role 은 그대로 · status='ACTIVE' · joined_at=now())
                요청자 insert (role='MEMBER', status='ACTIVE')
trips           set group_id = new_group_id   (target 한 건만. owner_type 은 GROUP 그대로)
                ⚠️ 새 trips 행을 만들지 않는다. fund_sources · transactions · trip_budgets 는 trip_id 로 따라간다 — 손대지 않는다
                ⚠️ 기존 group 의 다른 여행은 그대로 둔다
+ 공통
```

**CASE D** — PERSONAL → GROUP 전환 (`11` §4)
```
groups          insert (name=p_new_group_name, owner_user_id=trips.owner_user_id, status='ACTIVE') → new_group_id
group_members   기존 주인(trips.owner_user_id)  role='OWNER', status='ACTIVE', joined_at=now()
                요청자                          role='MEMBER', status='ACTIVE', joined_at=now()
trips           set owner_type='GROUP', owner_user_id=null, group_id=new_group_id
                ⚠️ trips_owner_shape CHECK 를 통과하려면 세 칸을 **한 UPDATE** 로 바꿔야 한다
                ⚠️ 같은 trips 행이다. trip id 가 바뀌지 않는다
trip_members    기존 주인의 ACTIVE 행은 그대로 (이미 있다)
+ 공통
```

**반환** `request_id · trip_id · group_id(최종) · case text ('A'|'B'|'C'|'D')`

### 6-3. `pending_group_name` — 쓰지 않는다

`trips.pending_group_name` 은 발송 시점에 이름을 미리 받던 옛 흐름의 칸이다. multi-use 링크에서는 한 여행에 PENDING 요청이 여럿이고 각 요청자마다 새 모임 여부가 다를 수 있어 **trip 한 칸으로 표현할 수 없다.** 이름은 승인 함수의 인자(`p_new_group_name`)로 그 순간 받는다. **칼럼은 지우지 않는다. 읽지도 쓰지도 않는다.**

---

## 7. `reject_trip_join_request(p_request_id uuid)` — 거절

| | |
|---|---|
| auth | **여행장만** |
| 검사 | PENDING 아니면 `22023` |
| 쓰기 | `status='REJECTED', decided_at=now(), decided_by=auth.uid()` |
| 하지 않는 것 | 사유 저장 (§8 POL-INV-051) · **token revoke** (다른 수신자에게 영향) · 요청자 재요청 차단 (§8 미확정) |

---

## 8. 미확정 — 함수 구현 전에 팀 결정 필요

| # | 항목 | 현재 문서 | 이 요청서의 기본안 |
|---|---|---|---|
| 1 | 거절된 사람이 같은 링크로 **재요청** 가능한가 | `10_v2` §8 "거절 기록은 재요청 차단에 쓴다" ↔ §4 다인용·7일 재사용 | **차단하지 않는다.** `my_state='REJECTED'` 를 앱이 보여주고 요청 버튼은 열어 둔다. 결정되면 `request_trip_join` ③ 에 한 줄 추가 |
| 2 | LEFT → ACTIVE 복원 시 `group_members.role` · `joined_at` | `10_v2` §16-3 미확정 | role 유지 · joined_at 유지 (건드리지 않음) |
| 3 | CASE C 새 모임의 `groups.owner_user_id` | 명문 없음 | **승인한 여행장**(`auth.uid()`). 모임장 개념은 없으나 칼럼이 NOT NULL 이다 |
| 4 | CASE C 에서 기존 모임 멤버를 새 모임에 **전원 복사**할지, 여행 참여자만 복사할지 | `10_v2` §9-4 "새 모임 생성 → target trip 이동" 만 | **여행의 ACTIVE trip_members 만** 복사하는 안도 가능. 요청서는 "기존 group ACTIVE 전원" 으로 적었으나(지시 §13 CASE C 문구) 확인 필요 |
| 5 | **`trips.leader_user_id` 가 NULL 인 여행** | 앱이 생성 시 안 채움 | ① 앱 수정: `createTripBundle` · `groups/new` 가 `leader_user_id = 생성자` 를 넣는다 (담당: 박현주 · yaliyala 파일) ② DB: NULL 이면 `owner_user_id`(PERSONAL) 또는 `groups.owner_user_id` 로 **1회 백필** ③ 그 사이 승인 함수는 NULL 이면 `42501` — 대체 판정을 넣지 않는다 |

---

## 9. 알림 (별도 — 승인 트랜잭션을 막지 않는다)

`notifications` 생성 주체는 **Edge Function(service_role)** 로 확정돼 있다 (`10_v2` §14). 위 함수들이 `notifications` 에 직접 INSERT 하지 않는다. 필요 이벤트와 수신자:

```
JOIN_REQUESTED   → 여행장             (request_trip_join 후)
JOIN_ACCEPTED    → 요청자             (accept 후)
JOIN_REJECTED    → 요청자             (reject 후)
MEMBER_JOINED    → 기존 ACTIVE 멤버   (accept 후)
```

트리거로 붙일지 앱이 Edge Function 을 부를지는 **알림 담당 결정.** 이 요청서의 5개 함수는 알림 없이도 완결된다.

---

## 10. 앱이 이 계약으로 만드는 것 (DB 완료 후)

```
lib/supabase/queries/tripJoinRequests.ts   resolve · request · cancel · list · accept · reject 래퍼
app/invite/[token].tsx                     placeholder → InviteLandingView / JoinWaitingView / InviteUnavailableView
app/trips/[tripId]/…  또는 members 화면    INV-04 목록 · JoinRequestSheet · NewGroupNameSheet (accept-time)
```

앱은 `types/database.ts` 재생성 후 `supabase.rpc(...)` 로만 부른다. 직접 INSERT/UPDATE 없음.
