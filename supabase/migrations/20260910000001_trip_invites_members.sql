-- ============================================================================
-- 초대 · 멤버 관리 (INV / MEM) 스키마 변경
--
-- 원안: 다빈이 이슈 #73 코멘트로 제안한 SQL. 검토 후 DB 담당이 옮겨 적용한다.
-- 옮기면서 고친 것 세 가지 (2026-09-10):
--   1. 배포용 정책 초안의 owner_user_id → leader_user_id
--      그 칸은 개인 여행의 주인이라 모임 여행에서는 비어 있다. 그대로 두면
--      배포 시 모임 여행의 여행장이 자기 초대 링크를 만들지 못한다.
--   2. drop constraint / create policy 를 재실행 가능하게
--      나머지 문장은 전부 if not exists 인데 이 둘만 빠져 있었다.
--      중간에 끊기면 처음부터 다시 돌릴 수 없다.
--   3. 백필 주석의 여행 건수 정정 (9건 → 실제 15건)
--
-- 작성일: 2026-09-09
-- 기준 문서: INV-초대멤버관리-구현스펙.md v1
-- 결정: 다빈 (2026-09-09)
--
-- ── 스펙 §4 와 달라진 점 ────────────────────────────────────────────────────
--
-- 스펙 §4 는 현재 스키마보다 이전 상태를 기준으로 쓰였다. 이미 있는 것을
-- 빼고, 결정 사항을 반영해 다음과 같이 정리했다.
--
--   스펙 §4                             실제
--   ─────────────────────────────────  ──────────────────────────────────────
--   trips ADD owner_user_id             이미 있음. **뜻이 다르다** → 건드리지 않는다
--                                       대신 leader_user_id 를 새로 만든다 (①)
--   trip_members ADD status             이미 있음 (ACTIVE/INVITED/LEFT)
--   group_members ADD status            이미 있음 (ACTIVE/INVITED/LEFT)
--   trip_members ADD role               ❌ 넣지 않는다 (아래 참조)
--
-- ⚠️⚠️ trips.owner_user_id 를 여행장으로 쓰지 않는다. ⚠️⚠️ (2026-09-10 L 회신)
--
--    그 칸은 8/27 초기 스키마부터 있던 것이고 **뜻이 다르다.**
--      · 현재 의미  = 개인 여행의 주인
--      · 모임 여행이면 일부러 비워 두는 규칙이 trips_owner_shape CHECK 에 걸려 있고,
--        앱 세 곳(여행 생성 · 여행 정보 수정 · 새 모임 만들기)이 그 규칙을 지킨다
--
--    여기에 여행장을 넣으면 앱이 모임 여행을 **개인 여행으로 착각한다.**
--    실제로 확인된 지점:
--      lib/supabase/queries/personalization.ts:69
--        scope.ownerType === 'PERSONAL' 일 때 .eq('owner_user_id', userId) 로 거른다.
--        모임 여행에 값이 차면 개인 개인화 소스에 모임 여행이 섞여 다음 여행
--        예산 추천이 어긋난다.
--      lib/supabase/queries/trips.ts:56
--        개인 여행을 owner_user_id 로 뽑고 모임 여행을 group_id 로 뽑아 합친다.
--        (지금은 byId Map 으로 중복이 제거되지만, 같은 여행이 두 갈래로
--         잡히는 상태 자체가 다른 목록 화면에서 두 번 뜰 여지를 만든다)
--
--    ⚠️ 이 파일의 이전 버전(2026-09-09)은 trips_owner_shape 를 고쳐
--       owner_user_id 를 모든 여행에 채우려 했다. **그 방향은 폐기됐다.**
--       CHECK 제약과 owner_user_id 는 한 글자도 건드리지 않는다.
--
-- ⚠️ trip_members.role 을 넣지 않는다.
--    여행장은 **여행의 불변 속성(생성자)** 이지 멤버의 속성이 아니다.
--    trips.leader_user_id 와 trip_members.role 두 곳에 같은 사실을 두면
--    group_members 처럼 어긋날 여지가 생긴다. 여행장 판정은
--    trips.leader_user_id 한 곳에서만 한다.
--
--    참고: 모임장(groups.owner_user_id + group_members.role='OWNER')은
--    이미 두 곳에 중복 저장돼 있다. 이번 변경에서는 건드리지 않는다.
--
-- ⚠️ 용어 정리 (다빈 결정)
--      모임장 = 그 모임의 첫 여행을 만든 사람   (모임 단위 · 1명)
--      여행장 = 그 여행을 만든 사람             (여행 단위 · 1명)
--    둘은 같을 수도 다를 수도 있다. 서로 다른 개념이다.
--
--      trips.owner_user_id   개인 여행의 주인      (기존 · 손대지 않음)
--      trips.leader_user_id  여행장               (이번에 추가)
-- ============================================================================


-- ============================================================================
-- ① trips.leader_user_id — 여행장 (새 칸)
--
-- ⚠️⚠️ owner_user_id 를 건드리지 않는다. trips_owner_shape CHECK 도 그대로 둔다.
--       이유는 파일 상단 참조. (2026-09-10 L 회신)
--
-- nullable 이다. NOT NULL 을 걸지 않는 이유:
--   · 기존 행을 개발용 사용자로 채우는 건 **추정**이다. 추정값 위에 NOT NULL 을
--     걸면 나중에 "여행장을 모르는 여행" 을 표현할 방법이 사라진다.
--   · 앱이 아직 이 칸을 채우지 않는다. 채우는 코드가 나가기 전에 NOT NULL 이
--     적용되면 여행 생성이 통째로 실패한다.
--   화면은 null 이면 여행장 배지를 그리지 않는 것으로 처리한다.
-- ============================================================================
alter table public.trips
  add column if not exists leader_user_id uuid references public.users (id) on delete set null;

-- 여행장으로 목록을 뽑는 화면이 없다. 인덱스를 걸지 않는다.
-- (여행 한 건을 열 때 그 행의 칼럼을 읽을 뿐이다)

comment on column public.trips.leader_user_id is
  '여행장. 이 여행을 만든 사람. 개인·모임 여행 모두 갖는다. 위임(MEM-02) 시에만 바뀐다. owner_user_id(개인 여행의 주인)와 다른 칸이다.';


-- ── ①-1 백필 ────────────────────────────────────────────────────────────────
--
-- ⚠️ 생성자를 기록한 적이 없어 원본이 없다. **추정이다.**
--    개발용 사용자로 채운다. 현재 여행 15건(삭제 4건 포함) 중 owner_user_id 가
--    채워진 건 개인 여행 3건뿐이고 그 값이 전부 이 사용자다. 모임 여행 12건은
--    만든 사람 기록이 없어 **확인할 수 없다.** 전부 개발 데이터라 이 값으로
--    채워도 무해하지만, '전부 이 사용자가 만들었다' 는 확인된 사실이 아니다.
--    (2026-09-10 DB 조회)
--
-- ⚠️ 앞으로는 추정하지 않는다. 앱이 여행 생성 시점에 직접 넣는다.
--    (TRIP-03 budget-fund.tsx · 새 모임 만들기 groups/new.tsx)
update public.trips
   set leader_user_id = '11111111-1111-4111-8111-111111111111'
 where leader_user_id is null;


-- ============================================================================
-- ② trips — 모임 이동 예정값 (POL-INV-035)
--
-- ⚠️ INV-05 에서 입력한 새 모임 이름을 **저장만** 한다. 모임을 만들지 않는다.
--    실제 생성·이동은 acceptRequest() 안에서 일어난다. 초대 발송 시점에
--    옮기면, 상대가 거절하거나 응답하지 않을 때 여행이 새 모임에 혼자 남는다.
--    거절·만료 시 이 값을 null 로 비운다.
-- ============================================================================
alter table public.trips
  add column if not exists pending_group_name text;

comment on column public.trips.pending_group_name is
  'INV-05 에서 정한 새 모임 이름. 수락 시 소비하고 null 로 되돌린다. 거절·만료 시에도 null.';


-- ============================================================================
-- ③ trip_members — 나간 시각
--
-- ⚠️ status 는 이미 있다 (ACTIVE / INVITED / LEFT). 추가하지 않는다.
-- ⚠️ REMOVED(여행장이 강제로 내보냄)는 넣지 않는다. 스펙 §12 에서 v2 로
--    미뤄 둔 기능이라 지금 값을 만들면 쓰는 곳 없이 남는다.
-- ⚠️ 나간 사람의 거래·납부 기록은 지우지 않는다. (POL-MEM-005)
-- ============================================================================
alter table public.trip_members
  add column if not exists left_at timestamptz;

comment on column public.trip_members.left_at is
  '여행에서 나간 시각. status = LEFT 와 짝이다. 거래 기록은 남긴다.';


-- ============================================================================
-- ④ trip_invites — 초대 링크
--
-- ⚠️ 기존 lib/invite/inviteLink.ts 는 **모임** 초대(/groups/:id/join)이고
--    groupId 를 링크에 그대로 싣는다. 이 표는 **여행** 초대다. 두 진입점을
--    합칠지는 화면 작업에서 정한다. 이 표만으로 기존 링크가 깨지지는 않는다.
-- ============================================================================
create table if not exists public.trip_invites (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips (id) on delete cascade,
  -- 추측 불가한 랜덤 문자열. 앱이 만들어 넣는다 (POL-INV-010)
  token       text not null unique,
  created_by  uuid not null references public.users (id) on delete cascade,
  -- 발급 + 7일 (POL-INV-011)
  expires_at  timestamptz not null,
  -- 재발급 시 이전 링크를 즉시 무효화한다 (POL-INV-014)
  revoked_at  timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists idx_trip_invites_token on public.trip_invites (token);
create index if not exists idx_trip_invites_trip  on public.trip_invites (trip_id, revoked_at);

comment on table public.trip_invites is
  '여행 초대 링크. /invite/{token}. 7일 유효 · 사용 횟수 무제한 · 인원이 차면 앱이 막는다.';


-- ============================================================================
-- ⑤ trip_join_requests — 참여 요청
--
-- ⚠️ 링크를 열었다고 멤버가 되지 않는다. 여행장이 수락해야 trip_members 에
--    들어간다. 수락 전에는 예산·금액·멤버 목록을 볼 수 없다 (POL-INV-021).
-- ============================================================================
create table if not exists public.trip_join_requests (
  id            uuid primary key default gen_random_uuid(),
  trip_id       uuid not null references public.trips (id) on delete cascade,
  invite_id     uuid not null references public.trip_invites (id) on delete cascade,
  user_id       uuid not null references public.users (id) on delete cascade,
  status        text not null default 'PENDING'
                  check (status in ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELED')),
  requested_at  timestamptz not null default now(),
  decided_at    timestamptz,
  decided_by    uuid references public.users (id) on delete set null
);

-- 같은 여행에 대기 중인 요청은 1인 1건 (NFR-005 · REQ-INV-012)
create unique index if not exists idx_join_req_unique_pending
  on public.trip_join_requests (trip_id, user_id)
  where status = 'PENDING';

create index if not exists idx_join_req_trip
  on public.trip_join_requests (trip_id, status);

comment on table public.trip_join_requests is
  '초대 링크로 들어온 참여 요청. 거절 기록(REJECTED)은 같은 링크 재요청 차단에 쓴다.';


-- ============================================================================
-- ⑥ notifications.type — 신규 14종 추가 (기존 3종 + 14종 = 17개)
--
-- 2026-09-10 L 회신으로 확정
--   · 신규 **14종을 한 번에** 넣는다 (INV 7 + CXL 7)
--     "세 곳(문서 · status.ts · DB)이 글자 하나까지 같아야 하는 구조라,
--      나눠서 하면 세 곳을 두 번 맞춰야 한다"
--   · lib/constants/status.ts 는 **L 이 직접 반영한다.**
--     DB 와 docs 를 먼저 올린 뒤 알리면 글자 그대로 맞춰 커밋한다
--   · 생성 주체는 **A안 — 서버(Edge Function)가 만들고 앱은 요청만 한다.**
--     앱에서 직접 INSERT 하면 누구나 타인에게 임의 알림을 보낼 수 있다.
--     B안(DB 트리거)은 조건 정의 없이 적용하면 나중에 문구·발송 조건을
--     바꿀 때 수정 지점을 찾기 어려워진다
--
-- ⚠️ 이 목록은 아래 셋과 **글자 하나까지 같아야 한다.** (20260903000001 의 경고)
--      docs/05_ERD_v?.md 의 확정 목록
--      lib/constants/status.ts 의 NOTIFICATION_TYPE   ← L 이 반영
--      이 파일
--
-- ⚠️ 20260903000001 이 정한 방식을 따른다 — 그 파일을 고치지 않고, 새
--    마이그레이션에서 제약을 drop 하고 다시 만든다.
--
-- ⚠️ CXL 7종은 여행 취소 기능용이다. 아직 발송하는 코드가 없다. 값을 미리
--    열어 두는 것뿐이라 부작용이 없고, 나중에 제약을 또 고치지 않아도 된다.
-- ============================================================================
alter table public.notifications drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    -- ── 기존 3종 (20260903000001) ─────────────────────────────────────────
    'FUND_GOAL_REACHED',    -- 전체 목표 여행비 100% 최초 달성
    'TRIP_D7',              -- 여행 시작 7일 전
    'SETTLEMENT_READY',     -- 여행 종료 후 정산 가능

    -- ── 초대 · 멤버 (INV) 7종 ─────────────────────────────────────────────
    'INVITE_SENT',          -- 초대 링크 발송 → 초대받은 사람
    'JOIN_REQUESTED',       -- 참여 요청 도착 → 여행장
    'JOIN_ACCEPTED',        -- 수락됨 → 요청자
    'JOIN_REJECTED',        -- 거절됨 → 요청자
    'MEMBER_JOINED',        -- 새 멤버 합류 → 기존 멤버
    'MEMBER_LEFT',          -- 멤버 이탈 → 남은 멤버
    'OWNER_DELEGATED',      -- 여행장 위임 → 새 여행장

    -- ── 여행 취소 (CXL) 7종 ───────────────────────────────────────────────
    'CANCEL_REQUESTED',     -- 취소 요청 발생
    'CANCEL_VOTE_AGREED',   -- 멤버가 동의
    'CANCEL_REJECTED',      -- 멤버가 반대 → 요청 폐기
    'CANCEL_EXPIRED',       -- 만료 → 요청 폐기
    'CANCEL_WITHDRAWN',     -- 요청자 철회
    'CANCEL_CONFIRMED',     -- 전원 동의 → 취소 확정
    'CANCEL_RESTORED'       -- 되돌리기 실행
  ));

-- ⚠️ payload 에 금액을 담지 않는다. notifications 에는 payload 칼럼이 없고
--    title · body 가 전부다. 거기에 금액을 적지 않는다는 뜻이다. (스펙 §6)
--
-- ⚠️ 생성 주체가 Edge Function(service_role)이므로 anon/authenticated 에
--    insert 를 열지 않는다. 배포 전 정책 전환 시 20260902000002 하단 주석의
--    own_notifications_select / _update 만 남긴다.


-- ============================================================================
-- ⑦ RLS · GRANT — 새 표 2개
--
-- ⚠️ 20260828000001 의 alter default privileges 에 기대지 않고 직접 부여한다.
--    그 설정은 문장을 실행한 역할이 만든 객체에만 적용되어, 다른 역할로
--    마이그레이션이 돌면 42501 로 막힌다. (20260907000001 과 같은 판단)
-- ============================================================================
alter table public.trip_invites       enable row level security;
alter table public.trip_join_requests enable row level security;

-- ⚠️ create policy 에는 if not exists 가 없다. 재실행할 수 있게 먼저 지운다.
drop policy if exists "dev_open_all" on public.trip_invites;
drop policy if exists "dev_open_all" on public.trip_join_requests;

create policy "dev_open_all" on public.trip_invites
  for all using (true) with check (true);
create policy "dev_open_all" on public.trip_join_requests
  for all using (true) with check (true);

grant select, insert, update, delete
  on public.trip_invites, public.trip_join_requests
  to anon, authenticated;


-- ============================================================================
-- 실서비스 정책 (배포 전 dev_open_all 을 drop 하고 아래로 교체)
--
-- ⚠️ trip_invites 는 **토큰만 알면 조회돼야 한다.** 초대받은 사람은 아직
--    이 여행과 아무 관계가 없어 멤버 기준 정책으로는 막힌다.
--    대신 조회 결과로 금액·멤버가 새어 나가면 안 되므로, 링크 해석은
--    Edge Function 이 맡고 앱에는 여행지·일정·인원·초대자 이름만 돌려준다.
--    (POL-INV-020 · resolveInvite 의 preview)
--
-- drop policy "dev_open_all" on public.trip_invites;
-- drop policy "dev_open_all" on public.trip_join_requests;
--
-- -- 링크 발급·조회는 여행장만 (leader_user_id 다. owner_user_id 가 아니다)
-- create policy "invites_owner" on public.trip_invites
--   for all using (
--     exists (select 1 from public.trips t
--              where t.id = trip_id and t.leader_user_id = auth.uid())
--   );
--
-- -- 요청은 본인 것과, 그 여행의 여행장만
-- create policy "join_req_self_or_owner" on public.trip_join_requests
--   for select using (
--     user_id = auth.uid()
--     or exists (select 1 from public.trips t
--                 where t.id = trip_id and t.leader_user_id = auth.uid())
--   );
-- ============================================================================
