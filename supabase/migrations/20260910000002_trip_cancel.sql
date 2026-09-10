-- ============================================================================
-- 여행 취소 (CXL) 스키마 — 전원 동의 · 72시간 되돌리기
--
-- 원안: 다빈이 보낸 실행 요청 5건. 검토 후 DB 담당이 옮겨 적용한다.
-- 기준: CXL 스펙 v5 · 20260909000001(CANCELED) 의 후속
--
-- ⚠️ 실행 순서: ③ trip_cancel_requests 가 ④ trip_cancel_votes 보다 먼저다.
--    votes.request_id 가 requests 를 참조한다. 이 파일은 그 순서로 쓰여 있다.
--
-- ⚠️ 전부 추가형이다. 기존 칼럼·표를 바꾸거나 지우지 않는다.
--    ①만 제약을 교체하는데, 20260909000001 과 같은 방식(drop 후 재생성)이다.
--
-- ⚠️ 두 번 실행해도 안전하게 썼다. drop constraint / drop policy 에 if exists 를
--    붙였고 나머지는 if not exists 다. 중간에 끊겨도 처음부터 다시 돌릴 수 있다.
--
-- ── CANCEL_PENDING 이 생기면 앱 두 곳이 이 값을 만난다 ──────────────────────
--
--   둘 다 '부정 조건' 이 아니라 PLANNING·TRAVELING 만 통과시키는 화이트리스트다.
--   그래서 오작동이 아니라 **조용히 빠진다.** 지금은 이 값을 쓰는 코드가 없어
--   실제 영향이 없고, 취소 기능을 만들 때 각 담당자가 정한다.
--
--     lib/supabase/queries/trips.ts closeTripIfEnded()   [다빈]
--       CANCEL_PENDING 여행은 그대로 반환된다. 종료일이 지나도 ENDED 로 안 올라간다.
--       동의 절차가 도는 중에 상태가 바뀌면 투표 대상이 흔들리므로 이 편이 맞다.
--
--     app/(tabs)/index.tsx 홈 진행 중 목록                [L]
--       CANCEL_PENDING 여행이 홈 목록에서 사라진다. 동의해야 할 사람이
--       들어갈 길이 없어지므로 취소 기능을 붙일 때 반드시 함께 고친다.
-- ============================================================================


-- ============================================================================
-- ① trips.status — CANCEL_PENDING 추가 (6종 → 7종)
--
-- 현재 6개(PLANNING · TRAVELING · ENDED · SETTLED · DELETED · CANCELED)에
-- 1개만 더한다. 원격 DB 에 CANCELED 0건 · CANCEL_PENDING 0건이라 제약
-- 재생성에 걸릴 행이 없다.
--
-- ⚠️ 이 목록은 lib/constants/status.ts 의 TRIP_STATUS 와 같아야 한다.
--    같은 커밋에서 함께 반영한다.
-- ============================================================================
alter table public.trips drop constraint if exists trips_status_check;
alter table public.trips
  add constraint trips_status_check
  check (status in (
    'PLANNING',
    'TRAVELING',
    'ENDED',
    'SETTLED',
    'DELETED',
    'CANCEL_PENDING',  -- 취소 요청됨. 동의 절차가 도는 중
    'CANCELED'         -- 전원 동의로 취소 확정. canceled_at 부터 72시간 되돌리기
  ));


-- ============================================================================
-- ② trips — 취소 메타 3칸
--
-- canceled_at 은 20260909000001 에 이미 있다. 건드리지 않는다.
-- 전부 nullable 이라 기존 INSERT 가 그대로 동작한다.
-- ============================================================================
alter table public.trips
  add column if not exists canceled_by uuid references public.users (id) on delete set null,
  add column if not exists cancel_reason text,
  add column if not exists canceled_fund_snapshot_json jsonb;

comment on column public.trips.canceled_by is
  '취소를 요청한 사람. 되돌리면 null. 사람이 지워져도 취소 기록은 남아야 해서 set null 이다';
comment on column public.trips.cancel_reason is
  '취소 사유 코드. 선택 입력이라 null 가능. CHECK 를 걸지 않는다 — 사유 코드는 앱 상수라 문구가 바뀔 때마다 마이그레이션이 필요해진다';
comment on column public.trips.canceled_fund_snapshot_json is
  '취소 확정 시점의 금액 스냅샷. 조회 때마다 다시 계산하지 않는다';


-- ============================================================================
-- ③ trip_cancel_requests — 취소 요청
--
-- 멤버 누구나 요청하고, 요청자를 제외한 전원이 동의해야 확정된다. 7일 만료.
-- status 에는 CHECK 를 건다. 이 5개는 앱이 아니라 절차가 정하는 값이라 늘지 않는다.
-- ============================================================================
create table if not exists public.trip_cancel_requests (
  id            uuid primary key default gen_random_uuid(),
  trip_id       uuid not null references public.trips (id) on delete cascade,
  requested_by  uuid not null references public.users (id) on delete cascade,
  reason        text,
  status        text not null default 'PENDING'
                  check (status in ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'WITHDRAWN')),
  expires_at    timestamptz not null,
  requested_at  timestamptz not null default now(),
  resolved_at   timestamptz,
  resolved_note text
);

-- 한 여행에 대기 중인 취소 요청은 한 건뿐이다
create unique index if not exists idx_cancel_req_one_pending
  on public.trip_cancel_requests (trip_id)
  where status = 'PENDING';

-- 만료 처리 배치가 훑는 축
create index if not exists idx_cancel_req_expires
  on public.trip_cancel_requests (status, expires_at)
  where status = 'PENDING';

comment on table public.trip_cancel_requests is
  '여행 취소 요청. 멤버 누구나 요청하고 요청자를 제외한 전원이 동의해야 확정. 7일 만료';


-- ============================================================================
-- ④ trip_cancel_votes — 멤버별 동의
--
-- ⚠️ ③ 보다 뒤에 있어야 한다. request_id 가 trip_cancel_requests 를 참조한다.
-- ⚠️ 번복 차단을 유니크 인덱스로 건다. 앱에서만 막으면 동시 요청에 뚫린다.
-- ============================================================================
create table if not exists public.trip_cancel_votes (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.trip_cancel_requests (id) on delete cascade,
  user_id     uuid not null references public.users (id) on delete cascade,
  vote        text not null check (vote in ('AGREE', 'DISAGREE')),
  voted_at    timestamptz not null default now()
);

create unique index if not exists idx_cancel_vote_once
  on public.trip_cancel_votes (request_id, user_id);

comment on table public.trip_cancel_votes is
  '취소 요청에 대한 멤버별 동의. 1인 1회이고 번복할 수 없다';


-- ============================================================================
-- ⑤ RLS · GRANT — 새 표 2개
--
-- ⚠️ 20260828000001 의 alter default privileges 에 기대지 않고 직접 부여한다.
--    그 설정은 문장을 실행한 역할이 만든 객체에만 적용되어, 다른 역할로
--    마이그레이션이 돌면 42501 로 막힌다. (20260907000001 · 20260910000001 과 같은 판단)
--
-- ⚠️ create policy 에는 if not exists 가 없다. 재실행할 수 있게 먼저 지운다.
-- ============================================================================
alter table public.trip_cancel_requests enable row level security;
alter table public.trip_cancel_votes    enable row level security;

drop policy if exists "dev_open_all" on public.trip_cancel_requests;
drop policy if exists "dev_open_all" on public.trip_cancel_votes;

create policy "dev_open_all" on public.trip_cancel_requests
  for all using (true) with check (true);
create policy "dev_open_all" on public.trip_cancel_votes
  for all using (true) with check (true);

grant select, insert, update, delete
  on public.trip_cancel_requests, public.trip_cancel_votes
  to anon, authenticated;


-- ============================================================================
-- 실서비스 정책 (배포 전 dev_open_all 을 drop 하고 아래로 교체)
--
-- ⚠️ 동의 기록은 **같은 여행 멤버만** 읽어야 하고, 투표는 **본인 것만** 들어가야 한다.
--    지금은 개발용으로 전부 열려 있다.
--
-- drop policy "dev_open_all" on public.trip_cancel_requests;
-- drop policy "dev_open_all" on public.trip_cancel_votes;
--
-- -- 취소 요청은 그 여행의 활성 멤버만
-- create policy "cancel_req_member" on public.trip_cancel_requests
--   for select using (
--     exists (select 1 from public.trip_members m
--              where m.trip_id = trip_id and m.user_id = auth.uid()
--                and m.status = 'ACTIVE')
--   );
--
-- -- 투표는 본인 것만 넣는다
-- create policy "cancel_vote_self_insert" on public.trip_cancel_votes
--   for insert with check (user_id = auth.uid());
-- ============================================================================
