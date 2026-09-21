-- ============================================================================
-- 기존 모임으로 새 여행을 만들면 그 모임 멤버가 초대 없이 바로 합류한다
-- (2026-09-21 팀 합의)
--
-- 전에는 만든 사람만 trip_members 에 들어갔다. 이미 같이 다니는 모임인데도
-- 여행 홈이 '아직 나 혼자' 로 보고 초대를 다시 권했다.
--
-- 앱이 직접 넣을 수 없는 이유
--   trip_members_insert_self (20260917000003 ④) 가 user_id = auth.uid() 로
--   본인 행만 허용한다. '남을 ACTIVE 로 넣는 길은 승인 RPC 뿐' 이라는 원칙이다.
--   그 원칙을 풀지 않고, 자동 합류만 하는 좁은 RPC 를 하나 더 둔다.
--
-- 왜 여행 생성 전체를 RPC 로 옮기지 않았나
--   그러려면 trips → trip_budgets → budget_categories → fund_sources 까지
--   한 함수로 끌어와야 한다. 지금 잘 도는 생성 경로를 통째로 다시 쓰는 일이라
--   이번 요청 범위를 넘는다. 이 함수는 여행이 만들어진 **뒤에** 부른다.
--   실패해도 만든 사람만 있는 여행이 남을 뿐이고 그건 오늘까지의 동작과 같다.
--   나머지는 초대로 채울 수 있다.
--
-- 정원(headcount) 을 함께 올리는 이유
--   accept_trip_join_request 가 'ACTIVE 참여자 >= headcount' 면
--   HEADCOUNT_REACHED 로 막는다(20260917000003). 정원보다 많이 넣으면
--   만들자마자 아무도 더 못 받는 여행이 된다.
--
-- 알림은 아직 보내지 않는다. 합류당한 본인에게 갈 타입이 없다
--   (MEMBER_JOINED 는 기존 멤버에게 가는 것이다). TRIP_AUTO_JOINED 가
--   생기면 그때 여기에 붙인다. (.handoff/MEMBER-AUTOJOIN-DB요청서.md §5)
-- ============================================================================

create or replace function public.add_group_members_to_trip(p_trip_id uuid)
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_user_id    uuid := auth.uid();
  v_trip       public.trips%rowtype;
  v_candidates uuid[];
  v_uid        uuid;
  v_total      integer;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  if not public.is_account_active() then
    raise exception using errcode = '42501', message = 'ACCOUNT_NOT_ACTIVE';
  end if;

  -- 같은 여행에 동시에 들어오는 것을 직렬화한다. headcount 를 읽고 고치기 때문이다.
  select * into v_trip from public.trips t where t.id = p_trip_id for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Trip not found';
  end if;

  if v_trip.status in ('DELETED', 'CANCELED') then
    raise exception using errcode = '22023', message = 'TRIP_NOT_OPEN';
  end if;

  -- 여행을 만든 사람만 부를 수 있다. 자동 합류는 생성 직후 1회를 위한 것이라
  -- 아무 멤버나 남을 끌어들이는 문이 되면 안 된다. (초대는 기존 경로가 있다)
  if v_trip.leader_user_id is distinct from v_user_id then
    raise exception using errcode = '42501', message = 'NOT_TRIP_LEADER';
  end if;

  -- 모임 여행이 아니면 할 일이 없다. 개인 여행에 남을 넣지 않는다.
  if v_trip.owner_type <> 'GROUP' or v_trip.group_id is null then
    return 0;
  end if;

  -- 부르는 사람이 그 모임 사람이어야 한다.
  -- 남의 모임 멤버를 자기 여행으로 끌어오는 것을 막는다.
  if not exists (
    select 1 from public.group_members gm
    where gm.group_id = v_trip.group_id
      and gm.user_id = v_user_id
      and gm.status = 'ACTIVE'
  ) then
    raise exception using errcode = '42501', message = 'NOT_GROUP_MEMBER';
  end if;

  -- 넣을 사람 = 모임의 ACTIVE 멤버 중 아직 이 여행에 ACTIVE 로 없는 사람.
  -- 탈퇴 계정은 뺀다. (lib/supabase/queries/groups.ts getGroupMembers 와 같은 기준)
  select array_agg(distinct gm.user_id) into v_candidates
  from public.group_members gm
  join public.users u on u.id = gm.user_id and u.deleted_at is null
  where gm.group_id = v_trip.group_id
    and gm.status = 'ACTIVE'
    and not exists (
      select 1 from public.trip_members tm
      where tm.trip_id = p_trip_id
        and tm.user_id = gm.user_id
        and tm.status = 'ACTIVE'
    );

  if v_candidates is null or cardinality(v_candidates) = 0 then
    return 0;
  end if;

  -- 정원을 먼저 맞춘다. 넣고 나서 올리면 그 사이 들어온 수락 요청이
  -- HEADCOUNT_REACHED 로 튕긴다.
  select count(distinct tm.user_id) into v_total
  from public.trip_members tm
  where tm.trip_id = p_trip_id and tm.status = 'ACTIVE' and tm.user_id is not null;

  v_total := v_total + cardinality(v_candidates);

  if v_total > v_trip.headcount then
    update public.trips set headcount = v_total, updated_at = now()
     where id = p_trip_id;
  end if;

  -- 이미 LEFT 로 있던 행이 있으면 되살리고 없으면 새로 넣는다.
  -- activate_trip_member 가 그 판단을 한다. (20260913000001 ①)
  -- trip_members 에 unique (trip_id, user_id) 가 없어서 그냥 insert 하면
  -- 나갔다 들어온 사람이 두 줄이 된다.
  foreach v_uid in array v_candidates loop
    perform public.activate_trip_member(p_trip_id, v_uid);
  end loop;

  return cardinality(v_candidates);
end;
$function$;

comment on function public.add_group_members_to_trip(uuid) is
  '여행 생성 직후 1회. 그 여행 모임의 ACTIVE 멤버를 초대 없이 참여시키고 정원을 맞춘다. 여행장만 부를 수 있다. (2026-09-21)';

revoke all on function public.add_group_members_to_trip(uuid) from public, anon;
grant execute on function public.add_group_members_to_trip(uuid) to authenticated;
