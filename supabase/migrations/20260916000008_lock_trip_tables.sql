-- ============================================================================
-- 테스트 빌드 전 권한 전환 · 3단계 — 여행·예산·지출·자금·결산을 여행 참여자만 보게 한다
-- 기준 문서: docs/05_ERD_v6.md §6-5 · 20260827000001 하단 "실서비스 정책" 초안
-- 작성일: 2026-09-16
--
-- 지금은 공개 키(앱 파일에서 꺼낼 수 있다)만으로 로그인 없이 남의 여행지·일정·
-- 예산 금액·지출 내역을 읽고, 고치고, 지울 수 있다. (2026-09-16 실제로 확인)
-- 테스터에게 APK 를 주기 전에 닫는다.
--
-- ⚠️ 모임·커뮤니티·사용자 표는 이 파일에서 다루지 않는다. 공개용 뷰(결정 1)와
--    글에 여행지 저장(결정 2)이 함께 바뀌어야 해서 다음 단계로 뺐다.
--
-- ⚠️ 표 구조는 바꾸지 않는다. 함수 두 개(can_access_trip · trips_guard_direct_update)와
--    트리거 하나를 새로 만든다. types/database.ts 는 재생성한다.
--
-- ⚠️ 필수 6(20260916000004 · 000005)과 **짝이다.** 그 파일이 서버 함수로 옮긴 일
--    (여행장 위임 · 나가기 · 취소 요청 · 투표 · 철회 · 확정 · 되돌리기)을 앱이 표를
--    직접 고쳐서 우회하지 못하게 여기서 닫는다. 그 파일 머리 주석의 목록:
--      trips                  leader_user_id · status · canceled_*
--      trip_members           status · left_at
--      trip_cancel_requests   INSERT · UPDATE · DELETE 전부
--      trip_cancel_votes      INSERT · UPDATE · DELETE 전부
--    (group_members.status 는 모임 표를 다루는 다음 단계에서 닫는다)
--
-- ⚠️ 서버 함수는 전부 SECURITY DEFINER(소유자 postgres)라 이 파일의 막기와 무관하게
--    통과한다. 막히는 것은 앱·공개 키로 표를 **직접** 고치는 경로뿐이다.
-- ============================================================================


-- ── 헬퍼: 지금 사용자가 이 여행에 접근할 수 있는가 ───────────────────────────
--
-- 세 경우 중 하나면 접근한다. (init_schema 하단 초안과 같다)
--   ① 개인 여행의 주인           trips.owner_user_id = 나
--   ② 여행이 속한 모임의 멤버     group_members (ACTIVE)
--   ③ 여행 참여자                 trip_members  (ACTIVE)
--
-- ⚠️ ②를 빼지 않는다. 앱의 여행 목록(getTrips)은 "내 모임의 여행" 을 모임 id 로
--    읽는다. ③만 두면 모임 여행 목록과 모임 상세(GROUP-02)가 비어 보인다.
--
-- ⚠️ SECURITY DEFINER 로 만든다. trips · trip_members 의 정책이 이 함수를 부르고,
--    이 함수가 다시 그 표를 읽는다. 호출자 권한으로 읽으면 정책이 자기 자신을
--    다시 부르는 무한 반복(42P17)이 난다.
--
-- ⚠️ search_path 를 잠근다. security definer 함수에서 잠그지 않으면 호출자가
--    같은 이름의 표를 먼저 보이게 해서 결과를 조작할 수 있다.
--
-- ⚠️ 서브쿼리 안의 바깥 칼럼은 전부 표 이름을 붙여 쓴다. (CLAUDE.md 18장 7)
create or replace function public.can_access_trip(p_trip_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $fn$
  select exists (
    select 1
    from public.trips t
    where t.id = p_trip_id
      and (
        t.owner_user_id = auth.uid()
        or exists (
          select 1 from public.group_members gm
          where gm.group_id = t.group_id
            and gm.user_id = auth.uid()
            and gm.status = 'ACTIVE'
        )
        or exists (
          select 1 from public.trip_members tm
          where tm.trip_id = t.id
            and tm.user_id = auth.uid()
            and tm.status = 'ACTIVE'
        )
      )
  );
$fn$;

revoke all on function public.can_access_trip(uuid) from public, anon;
grant execute on function public.can_access_trip(uuid) to authenticated;


-- ── trips ────────────────────────────────────────────────────────────────────
--
-- ⚠️ INSERT 는 따로 건다. 새 여행은 아직 trip_members 행이 없어서
--    can_access_trip(id) 가 거짓이다. 만드는 사람이 주인이거나(개인 여행)
--    그 모임의 멤버일 때(모임 여행)만 넣을 수 있다.
drop policy if exists "dev_open_all" on public.trips;

create policy "trips_select" on public.trips
  for select to authenticated
  using (public.can_access_trip(id));

create policy "trips_insert" on public.trips
  for insert to authenticated
  with check (
    owner_user_id = auth.uid()
    or exists (
      select 1 from public.group_members gm
      where gm.group_id = public.trips.group_id
        and gm.user_id = auth.uid()
        and gm.status = 'ACTIVE'
    )
  );

-- ⚠️ UPDATE 는 참여자면 걸리지만, **어떤 칸을 어떻게 바꾸는지**는 아래 트리거가 본다.
create policy "trips_update" on public.trips
  for update to authenticated
  using (public.can_access_trip(id))
  with check (public.can_access_trip(id));

-- ⚠️ DELETE 는 **여행을 만들다 실패했을 때 되돌리는 용도**로만 연다. (trips.ts createTripBundle)
--    앱의 여행 삭제는 status 를 바꾸는 것이지 행을 지우는 게 아니다. 만든 사람이
--    방금(10분 안) 만든 여행만 지울 수 있다. 하위 표는 FK CASCADE 로 함께 지워진다.
create policy "trips_delete" on public.trips
  for delete to authenticated
  using (
    leader_user_id = auth.uid()
    and created_at > now() - interval '10 minutes'
  );


-- ── trips 직접 수정 검사 ────────────────────────────────────────────────────
--
-- 앱이 표를 **직접** 고칠 때만 검사한다. 서버 함수 안에서는 current_user 가
-- 함수 소유자(postgres)라 그냥 통과한다.
--
--   직접 바꿔도 되는 것
--     일정 · 인원 · 목적지 · 여행 스타일 · pending_group_name
--     상태를 **앞으로만**:  준비 중 → 여행 중 → 종료 → 정산 완료
--       (trips.ts closeTripIfEnded · settlements.ts 결산 확정)
--
--   서버 함수로만 바꿀 수 있는 것
--     여행장(leader_user_id)                      delegate_trip_leader · delegate_and_leave
--     취소 기록(canceled_* · cancel_reason)        request/confirm/restore RPC
--     그 밖의 상태 변화(취소 요청 · 취소 · 되돌리기 · 삭제)
--     소유 형태(owner_type · owner_user_id · group_id) — 참여 수락 RPC 가 PERSONAL→GROUP 으로 옮긴다
--
-- ⚠️ 'authenticated' 뿐 아니라 'anon' 도 검사한다. anon 은 GRANT 를 회수해 애초에
--    UPDATE 가 안 되지만, 나중에 GRANT 가 잘못 열려도 여기서 한 번 더 막힌다.
create or replace function public.trips_guard_direct_update()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if new.leader_user_id is distinct from old.leader_user_id then
    raise exception using errcode = '42501', message = 'LEADER_CHANGE_REQUIRES_RPC';
  end if;

  if new.canceled_at is distinct from old.canceled_at
     or new.canceled_by is distinct from old.canceled_by
     or new.cancel_reason is distinct from old.cancel_reason
     or new.canceled_fund_snapshot_json is distinct from old.canceled_fund_snapshot_json then
    raise exception using errcode = '42501', message = 'CANCEL_FIELDS_REQUIRE_RPC';
  end if;

  if new.owner_type is distinct from old.owner_type
     or new.owner_user_id is distinct from old.owner_user_id
     or new.group_id is distinct from old.group_id then
    raise exception using errcode = '42501', message = 'OWNER_CHANGE_REQUIRES_RPC';
  end if;

  if new.status is distinct from old.status
     and not (
       (old.status = 'PLANNING'  and new.status in ('TRAVELING', 'ENDED'))
       or (old.status = 'TRAVELING' and new.status = 'ENDED')
       or (old.status = 'ENDED'     and new.status = 'SETTLED')
     ) then
    raise exception using errcode = '42501', message = 'STATUS_CHANGE_REQUIRES_RPC';
  end if;

  return new;
end;
$fn$;

drop trigger if exists trips_guard_direct_update on public.trips;
create trigger trips_guard_direct_update
  before update on public.trips
  for each row execute function public.trips_guard_direct_update();


-- ── trip_id 를 직접 가진 표 ─────────────────────────────────────────────────
--
-- trip_budgets · fund_sources · transactions · contributions · settlements · trip_type_results
-- (trip_members · trip_cancel_requests 는 쓰기를 더 좁혀 아래에서 따로 둔다)
do $$
declare
  t text;
begin
  foreach t in array array[
    'trip_budgets', 'fund_sources', 'transactions',
    'contributions', 'settlements', 'trip_type_results'
  ]
  loop
    execute format('drop policy if exists "dev_open_all" on public.%I', t);
    execute format('drop policy if exists "%s_by_trip" on public.%I', t, t);
    execute format(
      'create policy "%s_by_trip" on public.%I for all to authenticated
         using (public.can_access_trip(trip_id))
         with check (public.can_access_trip(trip_id))',
      t, t
    );
  end loop;
end;
$$;


-- ── trip_id 를 한 단계 건너 가진 표 ─────────────────────────────────────────

-- budget_categories → trip_budgets
drop policy if exists "dev_open_all" on public.budget_categories;
drop policy if exists "budget_categories_by_trip" on public.budget_categories;
create policy "budget_categories_by_trip" on public.budget_categories
  for all to authenticated
  using (exists (
    select 1 from public.trip_budgets tb
    where tb.id = public.budget_categories.trip_budget_id
      and public.can_access_trip(tb.trip_id)
  ))
  with check (exists (
    select 1 from public.trip_budgets tb
    where tb.id = public.budget_categories.trip_budget_id
      and public.can_access_trip(tb.trip_id)
  ));

-- budget_plan_items → budget_categories → trip_budgets
drop policy if exists "dev_open_all" on public.budget_plan_items;
drop policy if exists "budget_plan_items_by_trip" on public.budget_plan_items;
create policy "budget_plan_items_by_trip" on public.budget_plan_items
  for all to authenticated
  using (exists (
    select 1 from public.budget_categories bc
    join public.trip_budgets tb on tb.id = bc.trip_budget_id
    where bc.id = public.budget_plan_items.budget_category_id
      and public.can_access_trip(tb.trip_id)
  ))
  with check (exists (
    select 1 from public.budget_categories bc
    join public.trip_budgets tb on tb.id = bc.trip_budget_id
    where bc.id = public.budget_plan_items.budget_category_id
      and public.can_access_trip(tb.trip_id)
  ));

-- trip_type_result_items → trip_type_results
drop policy if exists "dev_open_all" on public.trip_type_result_items;
drop policy if exists "trip_type_result_items_by_trip" on public.trip_type_result_items;
create policy "trip_type_result_items_by_trip" on public.trip_type_result_items
  for all to authenticated
  using (exists (
    select 1 from public.trip_type_results r
    where r.id = public.trip_type_result_items.trip_type_result_id
      and public.can_access_trip(r.trip_id)
  ))
  with check (exists (
    select 1 from public.trip_type_results r
    where r.id = public.trip_type_result_items.trip_type_result_id
      and public.can_access_trip(r.trip_id)
  ));

-- ── 참여자 · 취소 요청 · 투표 ───────────────────────────────────────────────

-- trip_members
--   읽기: 참여자
--   넣기: 여행을 만들 때 동행자 행을 넣는다(trips.ts createTripMembers). 여행 행이
--         먼저 생긴 뒤라 만든 사람은 can_access_trip 이 참이다.
--   고치기·지우기: **막는다.** 나가기·위임·참여 수락은 서버 함수다. (필수 6)
--     trips.ts 의 옛 leaveTrip(직접 UPDATE)은 @deprecated 이고 호출부가 없다.
drop policy if exists "dev_open_all" on public.trip_members;
drop policy if exists "trip_members_by_trip" on public.trip_members;
drop policy if exists "trip_members_select" on public.trip_members;
drop policy if exists "trip_members_insert" on public.trip_members;
create policy "trip_members_select" on public.trip_members
  for select to authenticated
  using (public.can_access_trip(trip_id));
create policy "trip_members_insert" on public.trip_members
  for insert to authenticated
  with check (public.can_access_trip(trip_id));

-- trip_cancel_requests · trip_cancel_votes — 읽기만. 쓰기는 전부 서버 함수다. (필수 6)
drop policy if exists "dev_open_all" on public.trip_cancel_requests;
drop policy if exists "trip_cancel_requests_by_trip" on public.trip_cancel_requests;
drop policy if exists "trip_cancel_requests_select" on public.trip_cancel_requests;
create policy "trip_cancel_requests_select" on public.trip_cancel_requests
  for select to authenticated
  using (public.can_access_trip(trip_id));

drop policy if exists "dev_open_all" on public.trip_cancel_votes;
drop policy if exists "trip_cancel_votes_select" on public.trip_cancel_votes;
drop policy if exists "trip_cancel_votes_write_own" on public.trip_cancel_votes;
drop policy if exists "trip_cancel_votes_update_own" on public.trip_cancel_votes;
-- (취소 진행 화면이 누가 동의했는지 보여준다 · tripCancel.ts getVoteProgress)
create policy "trip_cancel_votes_select" on public.trip_cancel_votes
  for select to authenticated
  using (exists (
    select 1 from public.trip_cancel_requests r
    where r.id = public.trip_cancel_votes.request_id
      and public.can_access_trip(r.trip_id)
  ));


-- ── financial_accounts — Mock 계좌 ──────────────────────────────────────────
--
-- 계좌는 모임에 붙는다(group_id). 개인 여행의 계좌는 group_id 가 비어 있고,
-- 그 계좌를 쓰는 여행(fund_sources)으로만 주인을 알 수 있다.
-- 그래서 "이 계좌를 쓰는 여행에 접근할 수 있다" 로도 읽게 한다.
--
-- ⚠️ INSERT 는 연결 화면이 여행에 붙이기 **전에** 만든다. 그 순간에는
--    fund_sources 가 아직 없다. 로그인 사용자면 만들 수 있게 두고, 읽기·고치기는
--    위 기준으로 좁힌다. Mock 데이터라 실제 금융 정보는 없다. (CLAUDE.md 1장)
drop policy if exists "dev_open_all" on public.financial_accounts;
drop policy if exists "financial_accounts_select" on public.financial_accounts;
drop policy if exists "financial_accounts_insert" on public.financial_accounts;
drop policy if exists "financial_accounts_modify" on public.financial_accounts;
drop policy if exists "financial_accounts_delete" on public.financial_accounts;

create policy "financial_accounts_select" on public.financial_accounts
  for select to authenticated
  using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = public.financial_accounts.group_id
        and gm.user_id = auth.uid()
        and gm.status = 'ACTIVE'
    )
    or exists (
      select 1 from public.fund_sources fs
      where fs.financial_account_id = public.financial_accounts.id
        and public.can_access_trip(fs.trip_id)
    )
  );

create policy "financial_accounts_insert" on public.financial_accounts
  for insert to authenticated
  with check (true);

create policy "financial_accounts_modify" on public.financial_accounts
  for update to authenticated
  using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = public.financial_accounts.group_id
        and gm.user_id = auth.uid()
        and gm.status = 'ACTIVE'
    )
    or exists (
      select 1 from public.fund_sources fs
      where fs.financial_account_id = public.financial_accounts.id
        and public.can_access_trip(fs.trip_id)
    )
  );

create policy "financial_accounts_delete" on public.financial_accounts
  for delete to authenticated
  using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = public.financial_accounts.group_id
        and gm.user_id = auth.uid()
        and gm.status = 'ACTIVE'
    )
    or exists (
      select 1 from public.fund_sources fs
      where fs.financial_account_id = public.financial_accounts.id
        and public.can_access_trip(fs.trip_id)
    )
  );


-- ── trip_join_requests — 서버 함수로만 다룬다 ───────────────────────────────
--
-- 앱은 이 표를 직접 읽거나 쓰지 않는다. 참여 요청·수락·거절·목록은 전부
-- security definer RPC 다. (tripJoinRequests.ts) 정책 없이 닫는다.
drop policy if exists "dev_open_all" on public.trip_join_requests;
revoke all on public.trip_join_requests from anon, authenticated;


-- ── GRANT — anon 을 빼고 로그인 사용자에게만 준다 ───────────────────────────
--
-- ⚠️ RLS 와 GRANT 는 별개다. 정책만 바꾸고 anon GRANT 를 남기면 권한이 넓은 채로
--    남는다. 둘 다 좁힌다. (ERD v6 §6-0 · §6-5)
-- ⚠️ TRUNCATE · TRIGGER · REFERENCES 는 앱이 쓰지 않는다. 함께 회수한다.
do $$
declare
  t text;
begin
  -- 참여자면 읽고·넣고·고치고·지우는 표
  foreach t in array array[
    'trips', 'trip_budgets', 'budget_categories', 'budget_plan_items',
    'fund_sources', 'transactions', 'contributions', 'settlements',
    'trip_type_results', 'trip_type_result_items', 'financial_accounts'
  ]
  loop
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end;
$$;

-- 참여자: 읽기·넣기만
revoke all on public.trip_members from anon, authenticated;
grant select, insert on public.trip_members to authenticated;

-- 취소 요청·투표: 읽기만
revoke all on public.trip_cancel_requests from anon, authenticated;
grant select on public.trip_cancel_requests to authenticated;
revoke all on public.trip_cancel_votes from anon, authenticated;
grant select on public.trip_cancel_votes to authenticated;


-- ============================================================================
-- 되돌리기 (문제가 생기면 새 마이그레이션으로 아래를 적용한다)
--
-- do $$ declare t text; p record; begin
--   foreach t in array array[
--     'trips','trip_members','trip_budgets','budget_categories','budget_plan_items',
--     'fund_sources','transactions','contributions','settlements',
--     'trip_type_results','trip_type_result_items',
--     'trip_cancel_requests','trip_cancel_votes','financial_accounts','trip_join_requests'
--   ] loop
--     for p in select policyname from pg_policies where schemaname='public' and tablename=t loop
--       execute format('drop policy %I on public.%I', p.policyname, t);
--     end loop;
--     execute format('create policy "dev_open_all" on public.%I for all using (true) with check (true)', t);
--     execute format('grant select, insert, update, delete on public.%I to anon, authenticated', t);
--   end loop;
-- end $$;
-- drop trigger if exists trips_guard_direct_update on public.trips;
-- drop function if exists public.trips_guard_direct_update();
-- drop function if exists public.can_access_trip(uuid);
-- ============================================================================
