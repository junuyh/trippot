-- ============================================================================
-- 위임 · 나가기 · 취소를 서버에서 검사한다 (보안 점검 「필수 6」)
--
-- 2026-09-16 · 나가기·취소 담당(A) 요청 → 계약서 .handoff/필수6-RPC계약서.md
-- 9/13 참여 요청 RPC(20260913000001)와 **같은 형태**로 맞췄다.
--
-- ── 왜 ──────────────────────────────────────────────────────────────────────
--
--   지금은 앱이 테이블을 직접 고치고 "여행장만" · "전원 동의 후" · "본인만" 을
--   화면에서만 검사한다. 공개 키로 서버를 직접 부르면 같은 여행 멤버가
--   자신을 여행장으로 만들거나, 투표 없이 여행을 취소하거나, 남을 내보낼 수 있다.
--
-- ⚠️⚠️ 이 파일만으로는 막히지 않는다. ⚠️⚠️
--       필수 1(권한 전환)에서 아래 직접 UPDATE 를 **같이** 닫아야 한다.
--       열려 있으면 공격자는 RPC 를 안 쓰고 테이블을 그냥 고친다.
--
--         trips                  leader_user_id · status · canceled_*
--         trip_members           status · left_at
--         group_members          status
--         trip_cancel_requests   INSERT · UPDATE · DELETE 전부
--         trip_cancel_votes      INSERT · UPDATE · DELETE 전부
--
-- ── 오류 계약 ───────────────────────────────────────────────────────────────
--
--   raise exception 의 message 를 **그대로 코드**로 쓴다. 앱은 error.message 로 분기한다.
--
--     AUTH_REQUIRED            42501   auth.uid() 없음
--     NOT_FOUND                P0002   여행 / 요청 없음
--     NOT_MEMBER               42501   ACTIVE 가입 멤버가 아님
--     NOT_LEADER               42501   여행장 아님
--     NOT_REQUESTER            42501   요청자 본인이 아님
--     LAST_MEMBER              P0003   나를 빼면 가입 멤버가 0명 — 여행이 빈다
--     NEEDS_DELEGATION         P0003   여행장이라 그냥 나갈 수 없음 → delegate_and_leave
--     INVALID_TARGET           22023   위임 대상이 ACTIVE 가입 멤버가 아니거나 본인
--     NOT_CANCELABLE           22023   여행이 PLANNING 이 아님
--     REQUEST_NOT_PENDING      22023   요청이 PENDING 이 아님
--     REQUEST_EXPIRED          22023   7일 경과 또는 출발일 도달 — 그 자리에서 폐기함
--     REQUESTER_CANNOT_VOTE    42501   요청자는 투표하지 않는다
--     ALREADY_VOTED            23505   1인 1회 (유니크 인덱스)
--     NOT_CANCELED             22023   CANCELED 가 아님
--     RESTORE_WINDOW_CLOSED    22023   취소 후 72시간 경과
--
-- ⚠️ 두 번 실행해도 안전하다. create or replace 만 쓴다. 표·칼럼을 만들지 않는다.
--
-- ⚠️⚠️ count 는 전부 **count(distinct user_id)** 다.
--       trip_members 에 unique (trip_id, user_id) 가 없어 같은 사람 행이
--       여러 개일 수 있다. 그냥 세면 한 사람이 분모를 2로 만든다.
--
-- ⚠️ 미가입 동행자(user_id is null)는 어느 계산에도 넣지 않는다. 투표할 계정이
--    없어 영영 채워지지 않는 분모가 되고, 여행장도 될 수 없다.
-- ============================================================================


-- ============================================================================
-- ① 내부 helper — 취소 시점 금액 스냅샷 (외부에 열지 않는다)
--
-- 앱의 lib/trip/cancelPolicy.ts buildCancelFundSnapshot 과 같은 식이다.
-- 결정 1 = A (2026-09-16 다빈) — 서버가 직접 계산한다. 앱이 보낸 값을 믿지 않는다.
--
-- ⚠️⚠️ ACCOUNT 에서 `잔액 − 지출` 을 다시 하지 않는다. 현재 잔액은 이미 지출이
--       빠진 값이라 또 빼면 **이중 차감**이다.
--
-- ⚠️ source_type 은 'MOCK' 과 'ACCOUNT' **둘 다** 계좌로 본다.
--    여행을 만들 때 계좌를 고르면 'MOCK' 이 저장되고(budget-fund.tsx),
--    수기에서 계좌로 전환하면 'ACCOUNT' 가 저장된다(funds.ts). 둘은 같은 뜻이다.
--    앱의 buildCancelFundSnapshot 은 'ACCOUNT' 만 보고 있어 계좌 여행이 MANUAL 로
--    잡히는 버그가 있다. 여기서는 바로 잡는다. (앱 수정은 별건)
-- ============================================================================
create or replace function public._trip_cancel_fund_snapshot(p_trip_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_source_type text;
  v_current     bigint := 0;
  v_deposit     bigint := 0;
  v_spent       bigint := 0;
  v_goal        bigint := 0;
  v_headcount   integer := 0;
  v_kind        text;
  v_total_saved bigint;
  v_remaining   bigint;
begin
  select fs.source_type, coalesce(fs.current_amount, 0)
    into v_source_type, v_current
  from public.fund_sources fs
  where fs.trip_id = p_trip_id
  limit 1;

  select coalesce(sum(t.amount), 0) into v_deposit
  from public.transactions t
  where t.trip_id = p_trip_id
    and t.transaction_type = 'DEPOSIT'
    and t.deleted_at is null;

  select coalesce(sum(bc.actual_amount), 0) into v_spent
  from public.budget_categories bc
  join public.trip_budgets tb on tb.id = bc.trip_budget_id
  where tb.trip_id = p_trip_id;

  select coalesce(tb.target_amount, 0) into v_goal
  from public.trip_budgets tb
  where tb.trip_id = p_trip_id
  limit 1;

  select coalesce(t.headcount, 0) into v_headcount
  from public.trips t
  where t.id = p_trip_id;

  if v_source_type in ('ACCOUNT', 'MOCK') then
    v_kind := 'ACCOUNT';
  elsif v_current > 0 or v_deposit > 0 then
    v_kind := 'MANUAL';
  else
    v_kind := 'ZERO';
  end if;

  -- ⚠️ deposit 만 쓰지 않는다. 직접 입력한 여행자금은 거래로 남지 않고
  --    fund_sources.current_amount 에만 있다. deposit 만 보면 수기 입력 여행의
  --    스냅샷이 0원으로 굳는다.
  v_total_saved := case when v_deposit > 0 then v_deposit else v_current end;

  v_remaining := case v_kind
    when 'ZERO'    then 0
    when 'ACCOUNT' then v_current
    else greatest(0, v_total_saved - v_spent)
  end;

  return jsonb_build_object(
    'fund_type',      v_kind,
    'masked_account', null,
    'total_saved',    v_total_saved,
    'actual_spent',   v_spent,
    'remaining',      v_remaining,
    'goal_amount',    v_goal,
    'headcount',      v_headcount,
    'captured_at',    to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
end;
$$;


-- ============================================================================
-- ② 내부 helper — 동의 대상 수 · 동의 수 · 반대 유무
--
-- ⚠️⚠️ **지금 ACTIVE 인 멤버의 표만** 센다.
--       trip_cancel_votes 를 그냥 세면 나간 사람의 표가 분자에 남는다.
--       4명이 요청 → 2명 동의 → 1명 나감 이면 분모는 2로 줄었는데 분자는 2라
--       아무도 새로 동의하지 않았는데 취소가 확정된다.
-- ============================================================================
create or replace function public._trip_cancel_tally(
  p_request_id uuid,
  out target_count  integer,
  out agreed_count  integer,
  out has_disagree  boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_req public.trip_cancel_requests%rowtype;
begin
  select * into v_req from public.trip_cancel_requests r where r.id = p_request_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;

  select count(distinct tm.user_id)::integer into target_count
  from public.trip_members tm
  where tm.trip_id = v_req.trip_id
    and tm.status = 'ACTIVE'
    and tm.user_id is not null
    and tm.user_id <> v_req.requested_by;

  select
    (count(distinct v.user_id) filter (where v.vote = 'AGREE'))::integer,
    bool_or(v.vote = 'DISAGREE')
  into agreed_count, has_disagree
  from public.trip_cancel_votes v
  where v.request_id = p_request_id
    and v.user_id <> v_req.requested_by
    and exists (
      select 1 from public.trip_members tm
      where tm.trip_id = v_req.trip_id
        and tm.user_id = v.user_id
        and tm.status = 'ACTIVE'
    );

  agreed_count := coalesce(agreed_count, 0);
  has_disagree := coalesce(has_disagree, false);
end;
$$;


-- ============================================================================
-- ③ 내부 helper — 취소 확정
--
-- **앱이 부를 수 있는 확정 함수를 만들지 않는다.** 확정은 서버가 표를 센
-- 결과로만 일어난다. 이게 이번 작업의 핵심이다.
-- ============================================================================
create or replace function public._trip_cancel_confirm(
  p_trip_id    uuid,
  p_request_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_req public.trip_cancel_requests%rowtype;
begin
  -- 이미 취소됐으면 아무 일도 하지 않는다 (멱등)
  if exists (select 1 from public.trips t where t.id = p_trip_id and t.status = 'CANCELED') then
    return;
  end if;

  select * into v_req from public.trip_cancel_requests r where r.id = p_request_id;

  update public.trips t
     set status                      = 'CANCELED',
         canceled_at                 = now(),
         canceled_by                 = v_req.requested_by,
         cancel_reason               = v_req.reason,
         canceled_fund_snapshot_json = public._trip_cancel_fund_snapshot(p_trip_id)
   where t.id = p_trip_id;

  update public.trip_cancel_requests r
     set status        = 'APPROVED',
         resolved_at   = now(),
         resolved_note = 'ALL_AGREED'
   where r.id = p_request_id
     and r.status = 'PENDING';
end;
$$;


-- ============================================================================
-- ④ 내부 helper — 요청을 닫고 여행 상태를 되돌린다 (반대 · 만료 · 철회 공통)
--
-- ⚠️ 원래 상태를 저장값에서 꺼내지 않는다. PLANNING 으로 두고 날짜로 다시
--    계산하게 한다(여행 홈의 closeTripIfEnded). 저장값을 쓰면 그 사이 날짜가
--    지난 여행이 PLANNING 으로 되살아난다.
-- ============================================================================
create or replace function public._trip_cancel_close(
  p_request_id uuid,
  p_trip_id    uuid,
  p_status     text,
  p_note       text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.trip_cancel_requests r
     set status        = p_status,
         resolved_at   = now(),
         resolved_note = p_note
   where r.id = p_request_id
     and r.status = 'PENDING';

  update public.trips t
     set status = 'PLANNING'
   where t.id = p_trip_id
     and t.status = 'CANCEL_PENDING';
end;
$$;


-- ============================================================================
-- ⑤ 내부 helper — 멤버가 나간 뒤 취소 동의를 다시 판정한다
--
-- ⚠️ **요청자 본인이 나가면 요청을 철회한다.** 요청한 사람이 없어졌는데 남은
--    사람들에게 계속 동의를 물으면 아무도 원하지 않는 취소가 진행된다.
--
-- ⚠️ 나감으로 남은 인원이 전원 동의 상태가 되면 **그 순간 확정된다.**
-- ============================================================================
create or replace function public._trip_cancel_recheck_after_leave(
  p_trip_id      uuid,
  p_left_user_id uuid
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_req    public.trip_cancel_requests%rowtype;
  v_tally  record;
begin
  select * into v_req
  from public.trip_cancel_requests r
  where r.trip_id = p_trip_id and r.status = 'PENDING'
  limit 1;

  if not found then
    return 'NONE';
  end if;

  if v_req.requested_by = p_left_user_id then
    perform public._trip_cancel_close(v_req.id, p_trip_id, 'WITHDRAWN', 'REQUESTER_LEFT');
    return 'WITHDRAWN';
  end if;

  select * into v_tally from public._trip_cancel_tally(v_req.id);

  if v_tally.has_disagree then
    perform public._trip_cancel_close(v_req.id, p_trip_id, 'REJECTED', 'DISAGREED');
    return 'REJECTED';
  end if;

  if v_tally.agreed_count >= v_tally.target_count then
    perform public._trip_cancel_confirm(p_trip_id, v_req.id);
    return 'CANCELED';
  end if;

  return 'PENDING';
end;
$$;


-- ============================================================================
-- ⑥ 내부 helper — 나가기 본체 (여행장 검사 없이)
--
-- leave_trip 과 delegate_and_leave 가 같이 쓴다. 나가는 절차가 두 곳에 생기면
-- 한쪽만 고쳐진다.
-- ============================================================================
create or replace function public._trip_leave_core(
  p_trip_id          uuid,
  p_user_id          uuid,
  p_also_leave_group boolean
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_group_id uuid;
begin
  -- ⚠️ ACTIVE 행만 바꾼다. unique 가 없어 같은 사람 행이 여러 개일 수 있고,
  --    조건을 빼면 예전에 나갔던 행의 left_at 까지 지금 시각으로 덮어쓴다.
  --    멱등성도 여기서 나온다 — 이미 나간 사람이 다시 불러도 아무 일이 없다.
  update public.trip_members tm
     set status = 'LEFT', left_at = now(), updated_at = now()
   where tm.trip_id = p_trip_id
     and tm.user_id = p_user_id
     and tm.status = 'ACTIVE';

  if p_also_leave_group then
    select t.group_id into v_group_id from public.trips t where t.id = p_trip_id;

    if v_group_id is not null then
      -- ⚠️ group_members 에는 left_at 이 없다. status 만 바꾼다.
      update public.group_members gm
         set status = 'LEFT', updated_at = now()
       where gm.group_id = v_group_id
         and gm.user_id = p_user_id
         and gm.status = 'ACTIVE';
    end if;
  end if;

  return public._trip_cancel_recheck_after_leave(p_trip_id, p_user_id);
end;
$$;


-- ============================================================================
-- ⑦ leave_trip — 여행에서 나간다
--
-- ⚠️ 거래·납부 기록을 지우지 않는다. status 를 LEFT 로 바꾸고 left_at 만 찍는다.
--    지우면 남은 사람들의 정산 근거가 사라진다.
--
-- ⚠️ 마지막 1명 가드가 여행장 판정보다 **먼저**다. 멤버가 0명인 여행이 남으면
--    취소도 결산도 할 사람이 없는 유령 데이터가 된다.
-- ============================================================================
create or replace function public.leave_trip(
  p_trip_id          uuid,
  p_also_leave_group boolean default false
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_trip   public.trips%rowtype;
  v_others integer;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;

  select * into v_trip from public.trips t where t.id = p_trip_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;

  if not exists (
    select 1 from public.trip_members tm
    where tm.trip_id = p_trip_id and tm.user_id = v_uid and tm.status = 'ACTIVE'
  ) then
    raise exception using errcode = '42501', message = 'NOT_MEMBER';
  end if;

  select count(distinct tm.user_id)::integer into v_others
  from public.trip_members tm
  where tm.trip_id = p_trip_id
    and tm.status = 'ACTIVE'
    and tm.user_id is not null
    and tm.user_id <> v_uid;

  if v_others <= 0 then
    raise exception using errcode = 'P0003', message = 'LAST_MEMBER';
  end if;

  -- 여행장은 그냥 못 나간다. 나가면 참여 요청을 수락할 사람이 없어져
  -- 초대가 영영 막힌다. delegate_and_leave 로만 나간다.
  if v_trip.leader_user_id is not null and v_trip.leader_user_id = v_uid then
    raise exception using errcode = 'P0003', message = 'NEEDS_DELEGATION';
  end if;

  return public._trip_leave_core(p_trip_id, v_uid, coalesce(p_also_leave_group, false));
end;
$$;


-- ============================================================================
-- ⑧ delegate_trip_leader — 여행장을 넘긴다 (나가지 않고)
--
-- ⚠️ trips.leader_user_id 한 곳만 바꾼다. trip_members 에 role 이 없어서
--    맞출 곳이 하나뿐이다. 이게 role 을 안 만든 이유다.
-- ============================================================================
create or replace function public.delegate_trip_leader(
  p_trip_id    uuid,
  p_to_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid  uuid := auth.uid();
  v_trip public.trips%rowtype;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;

  select * into v_trip from public.trips t where t.id = p_trip_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;

  if v_trip.leader_user_id is null or v_trip.leader_user_id <> v_uid then
    raise exception using errcode = '42501', message = 'NOT_LEADER';
  end if;

  -- 이미 그 사람이 여행장이면 아무 일도 하지 않는다 (멱등)
  if v_trip.leader_user_id = p_to_user_id then
    return;
  end if;

  if p_to_user_id is null or p_to_user_id = v_uid then
    raise exception using errcode = '22023', message = 'INVALID_TARGET';
  end if;

  if not exists (
    select 1 from public.trip_members tm
    where tm.trip_id = p_trip_id and tm.user_id = p_to_user_id and tm.status = 'ACTIVE'
  ) then
    raise exception using errcode = '22023', message = 'INVALID_TARGET';
  end if;

  update public.trips t
     set leader_user_id = p_to_user_id
   where t.id = p_trip_id;
end;
$$;


-- ============================================================================
-- ⑨ delegate_and_leave — 여행장을 넘기고 나간다 (MEM-02)
--
-- ⚠️ **위임 먼저, 나가기 나중.** 나가기가 먼저면 그 사이 여행장 없는 여행이
--    생긴다. 함수 하나라 중간에 끊기지 않는다.
-- ============================================================================
create or replace function public.delegate_and_leave(
  p_trip_id          uuid,
  p_to_user_id       uuid,
  p_also_leave_group boolean default false
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_others integer;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;

  select count(distinct tm.user_id)::integer into v_others
  from public.trip_members tm
  where tm.trip_id = p_trip_id
    and tm.status = 'ACTIVE'
    and tm.user_id is not null
    and tm.user_id <> v_uid;

  if v_others <= 0 then
    raise exception using errcode = 'P0003', message = 'LAST_MEMBER';
  end if;

  perform public.delegate_trip_leader(p_trip_id, p_to_user_id);

  return public._trip_leave_core(p_trip_id, v_uid, coalesce(p_also_leave_group, false));
end;
$$;


-- ============================================================================
-- ⑩ request_trip_cancel — 취소를 요청한다
--
-- ⚠️⚠️ **동의 대상 수를 앱에서 받지 않는다.** 분모다. 앱이 1 을 보내면
--       3명 여행이 한 명 동의로 취소된다.
-- ============================================================================
create or replace function public.request_trip_cancel(
  p_trip_id uuid,
  p_reason  text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid      uuid := auth.uid();
  v_trip     public.trips%rowtype;
  v_existing public.trip_cancel_requests%rowtype;
  v_targets  integer;
  v_new_id   uuid;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;

  select * into v_trip from public.trips t where t.id = p_trip_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;

  if not exists (
    select 1 from public.trip_members tm
    where tm.trip_id = p_trip_id and tm.user_id = v_uid and tm.status = 'ACTIVE'
  ) then
    raise exception using errcode = '42501', message = 'NOT_MEMBER';
  end if;

  -- 이미 대기 중인 요청이 있으면 그것을 쓴다 (멱등)
  select * into v_existing
  from public.trip_cancel_requests r
  where r.trip_id = p_trip_id and r.status = 'PENDING'
  limit 1;

  if found then
    return jsonb_build_object('outcome', 'PENDING', 'request_id', v_existing.id);
  end if;

  if v_trip.status <> 'PLANNING' then
    raise exception using errcode = '22023', message = 'NOT_CANCELABLE';
  end if;

  insert into public.trip_cancel_requests (trip_id, requested_by, reason, expires_at)
  values (p_trip_id, v_uid, p_reason, now() + interval '7 days')
  returning id into v_new_id;

  select count(distinct tm.user_id)::integer into v_targets
  from public.trip_members tm
  where tm.trip_id = p_trip_id
    and tm.status = 'ACTIVE'
    and tm.user_id is not null
    and tm.user_id <> v_uid;

  -- 동의할 사람이 없으면 절차를 건너뛴다 (개인 여행)
  if v_targets = 0 then
    perform public._trip_cancel_confirm(p_trip_id, v_new_id);
    return jsonb_build_object('outcome', 'CANCELED', 'request_id', v_new_id);
  end if;

  update public.trips t set status = 'CANCEL_PENDING' where t.id = p_trip_id;

  return jsonb_build_object('outcome', 'PENDING', 'request_id', v_new_id);
end;
$$;


-- ============================================================================
-- ⑪ cast_trip_cancel_vote — 동의 또는 반대
--
-- ⚠️ 반대가 나오면 **즉시 폐기한다.** 나머지 동의를 계속 받지 않는다.
--    계속 물으면 반대한 사람을 압박하는 구조가 된다.
--
-- ⚠️⚠️ 요청자는 투표하지 않는다. 동의 대상 수가 요청자를 빼고 세어지므로
--       요청자 표가 섞이면 분자만 1 늘어나 3명 여행이 1명 동의로 확정된다.
-- ============================================================================
create or replace function public.cast_trip_cancel_vote(
  p_request_id uuid,
  p_vote       text
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_req   public.trip_cancel_requests%rowtype;
  v_trip  public.trips%rowtype;
  v_tally record;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;

  if p_vote not in ('AGREE', 'DISAGREE') then
    raise exception using errcode = '22023', message = 'INVALID_TARGET';
  end if;

  select * into v_req from public.trip_cancel_requests r where r.id = p_request_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;

  if v_req.status <> 'PENDING' then
    raise exception using errcode = '22023', message = 'REQUEST_NOT_PENDING';
  end if;

  select * into v_trip from public.trips t where t.id = v_req.trip_id;

  -- 만료는 조회 시점에 판정한다. 크론을 만들지 않는다.
  --   시간   요청 + 7일
  --   출발   출발일 당일부터 (date 타입이라 시각이 없다)
  if now() >= v_req.expires_at
     or (v_trip.start_date is not null and (now() at time zone 'utc')::date >= v_trip.start_date)
  then
    perform public._trip_cancel_close(v_req.id, v_req.trip_id, 'EXPIRED', 'EXPIRED');
    raise exception using errcode = '22023', message = 'REQUEST_EXPIRED';
  end if;

  if not exists (
    select 1 from public.trip_members tm
    where tm.trip_id = v_req.trip_id and tm.user_id = v_uid and tm.status = 'ACTIVE'
  ) then
    raise exception using errcode = '42501', message = 'NOT_MEMBER';
  end if;

  if v_uid = v_req.requested_by then
    raise exception using errcode = '42501', message = 'REQUESTER_CANNOT_VOTE';
  end if;

  begin
    insert into public.trip_cancel_votes (request_id, user_id, vote)
    values (p_request_id, v_uid, p_vote);
  exception when unique_violation then
    raise exception using errcode = '23505', message = 'ALREADY_VOTED';
  end;

  if p_vote = 'DISAGREE' then
    perform public._trip_cancel_close(v_req.id, v_req.trip_id, 'REJECTED', 'DISAGREED');
    return 'REJECTED';
  end if;

  select * into v_tally from public._trip_cancel_tally(p_request_id);

  if v_tally.agreed_count >= v_tally.target_count then
    perform public._trip_cancel_confirm(v_req.trip_id, v_req.id);
    return 'APPROVED';
  end if;

  return 'PENDING';
end;
$$;


-- ============================================================================
-- ⑫ withdraw_trip_cancel_request — 요청자가 스스로 철회한다
-- ============================================================================
create or replace function public.withdraw_trip_cancel_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_req public.trip_cancel_requests%rowtype;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;

  select * into v_req from public.trip_cancel_requests r where r.id = p_request_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;

  if v_req.requested_by <> v_uid then
    raise exception using errcode = '42501', message = 'NOT_REQUESTER';
  end if;

  -- 이미 닫혔으면 아무 일도 하지 않는다 (멱등)
  if v_req.status <> 'PENDING' then
    return;
  end if;

  perform public._trip_cancel_close(v_req.id, v_req.trip_id, 'WITHDRAWN', 'WITHDRAWN');
end;
$$;


-- ============================================================================
-- ⑬ restore_canceled_trip — 되돌리기 (72시간 이내)
--
-- 결정 2 (2026-09-16 다빈) — **여행 멤버 누구나** 되돌릴 수 있다.
-- 나간 사람(LEFT)은 할 수 없다.
--
-- ⚠️ 상태를 저장값에서 꺼내지 않는다. PLANNING 으로 두고 날짜로 다시 계산하게
--    한다. 저장해 둔 값을 쓰면 그 사이 날짜가 지난 여행이 PLANNING 으로 되살아난다.
--
-- ⚠️ canceled_* 를 전부 비운다. canceled_at 이 남으면 72시간 계산이 어긋난다.
--
-- ⚠️ 동의를 받지 않는다. 원래 상태로 돌아가는 것이라 새 결정이 아니다.
-- ============================================================================
create or replace function public.restore_canceled_trip(p_trip_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid  uuid := auth.uid();
  v_trip public.trips%rowtype;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;

  select * into v_trip from public.trips t where t.id = p_trip_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;

  if not exists (
    select 1 from public.trip_members tm
    where tm.trip_id = p_trip_id and tm.user_id = v_uid and tm.status = 'ACTIVE'
  ) then
    raise exception using errcode = '42501', message = 'NOT_MEMBER';
  end if;

  if v_trip.status <> 'CANCELED' then
    raise exception using errcode = '22023', message = 'NOT_CANCELED';
  end if;

  if v_trip.canceled_at is null or now() >= v_trip.canceled_at + interval '72 hours' then
    raise exception using errcode = '22023', message = 'RESTORE_WINDOW_CLOSED';
  end if;

  update public.trips t
     set status                      = 'PLANNING',
         canceled_at                 = null,
         canceled_by                 = null,
         cancel_reason               = null,
         canceled_fund_snapshot_json = null
   where t.id = p_trip_id
     and t.status = 'CANCELED';
end;
$$;


-- ============================================================================
-- ⑭ 권한 — 내부 helper 는 열지 않는다
--
-- security definer 라 helper 는 소유자 권한으로 실행된다. 바깥에서 부를 이유가
-- 없으므로 전부 회수한다. (9/13 참여 요청 RPC 와 같은 방식)
-- ============================================================================
revoke all on function public._trip_cancel_fund_snapshot(uuid)          from public, anon, authenticated;
revoke all on function public._trip_cancel_tally(uuid)                  from public, anon, authenticated;
revoke all on function public._trip_cancel_confirm(uuid, uuid)          from public, anon, authenticated;
revoke all on function public._trip_cancel_close(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public._trip_cancel_recheck_after_leave(uuid, uuid) from public, anon, authenticated;
revoke all on function public._trip_leave_core(uuid, uuid, boolean)     from public, anon, authenticated;

revoke all on function public.leave_trip(uuid, boolean)                 from public, anon, authenticated;
revoke all on function public.delegate_trip_leader(uuid, uuid)          from public, anon, authenticated;
revoke all on function public.delegate_and_leave(uuid, uuid, boolean)   from public, anon, authenticated;
revoke all on function public.request_trip_cancel(uuid, text)           from public, anon, authenticated;
revoke all on function public.cast_trip_cancel_vote(uuid, text)         from public, anon, authenticated;
revoke all on function public.withdraw_trip_cancel_request(uuid)        from public, anon, authenticated;
revoke all on function public.restore_canceled_trip(uuid)               from public, anon, authenticated;

grant execute on function public.leave_trip(uuid, boolean)               to authenticated;
grant execute on function public.delegate_trip_leader(uuid, uuid)        to authenticated;
grant execute on function public.delegate_and_leave(uuid, uuid, boolean) to authenticated;
grant execute on function public.request_trip_cancel(uuid, text)         to authenticated;
grant execute on function public.cast_trip_cancel_vote(uuid, text)       to authenticated;
grant execute on function public.withdraw_trip_cancel_request(uuid)      to authenticated;
grant execute on function public.restore_canceled_trip(uuid)             to authenticated;


comment on function public.leave_trip(uuid, boolean) is
  '여행에서 나간다. 본인·ACTIVE·마지막 1명·여행장 여부를 서버가 검사한다. 나간 뒤 취소 재판정 결과를 돌려준다';
comment on function public.delegate_and_leave(uuid, uuid, boolean) is
  '여행장을 넘기고 나간다. 위임 먼저, 나가기 나중. 한 함수라 중간에 끊기지 않는다';
comment on function public.request_trip_cancel(uuid, text) is
  '취소를 요청한다. 동의 대상 수는 서버가 센다. 대상이 0명이면 그 자리에서 확정한다';
comment on function public.cast_trip_cancel_vote(uuid, text) is
  '취소 동의·반대. 요청자는 투표할 수 없고, 집계는 지금 ACTIVE 인 멤버의 표만 센다';
comment on function public.restore_canceled_trip(uuid) is
  '취소를 되돌린다. 멤버 누구나 72시간 이내에만 할 수 있다';
