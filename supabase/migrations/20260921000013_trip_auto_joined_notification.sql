-- ============================================================================
-- TRIP_AUTO_JOINED — 기존 모임으로 만든 새 여행에 자동 합류된 사람에게 알리고,
-- 자동 합류 후보를 "이 여행에 행이 아직 없는 사람" 으로 좁힌다 (2026-09-21)
--
-- 왜 필요한가
--   20260921000010 이 모임 멤버를 초대 없이 여행에 넣게 했지만, 합류당한 본인에게는
--   아무 알림이 없었다. MEMBER_JOINED 는 "새 멤버가 왔다" 를 **기존 멤버**에게 알리는
--   것이고, JOIN_ACCEPTED 는 내가 보낸 참여 의사가 수락됐을 때다. "초대·요청 없이
--   여행에 들어갔다" 를 본인에게 알리는 타입이 없어 새로 둔다.
--
-- 이 파일이 하는 일
--   ① notifications_type_check 18 → 19 (TRIP_AUTO_JOINED 추가 · 나머지 순서 그대로)
--   ② TRIP_AUTO_JOINED 멱등 partial unique index (user_id, trip_id)
--      — create_notification 의 on conflict do nothing 이 이 index 에 걸려 조용히 넘긴다.
--        같은 여행 · 같은 사람에게는 함수를 몇 번 불러도 알림이 한 번이다.
--   ③ add_group_members_to_trip 재정의 — 20260921000010 본문을 그대로 두고 두 가지만 바꾼다.
--      A. 후보 = 모임 ACTIVE 멤버 중 이 여행에 **trip_members 행이 하나도 없는** 사람.
--         전에는 "ACTIVE 행이 없는 사람" 이라 LEFT · INVITED 행이 있는 사람도 후보가 됐고
--         activate_trip_member 가 그 행을 되살렸다. 나간 사람은 자동 합류 재호출로
--         돌아올 수 없다. 재참여는 초대 → 참여 의사 → 수락 경로뿐이다. (2026-09-21 확정)
--         생성자는 이미 ACTIVE 행이 있어 걸러지지만, 명시적으로도 뺀다.
--      B. 실제로 넣은 사람에게 TRIP_AUTO_JOINED 알림. 생성자에게는 절대 가지 않는다.
--         _notify_trip_members 는 ACTIVE 전원 대상이라 쓰지 않고 create_notification 을 직접 부른다.
--
-- 문구 (DB 가 완성 문자열을 저장한다 · docs/14 §4 관례 · lib/notifications/messages.ts 와 같은 문자열)
--   제목  새 여행에 함께하게 됐어요
--   본문  {모임명}의 {목적지} 여행에 함께하게 됐어요. {M월 D일}부터 {M월 D일}까지예요.
--         시작일 · 종료일 중 하나라도 없으면 두 번째 문장을 통째로 뺀다.
--   모임명이 비면 '모임' (notification_person_label 의 '사용자' 와 같은 방식의 최소 fallback)
--
-- 되돌리기
--   alter table public.notifications drop constraint if exists notifications_type_check;
--   alter table public.notifications add constraint notifications_type_check check (type in (<18종>));
--   drop index if exists public.notifications_trip_auto_joined_uniq;
--   add_group_members_to_trip 은 20260921000010 의 정의로 create or replace.
-- ============================================================================

-- ── ① type CHECK 18 → 19 ─────────────────────────────────────────────────────
-- ⚠️ 적용 전 select distinct type from public.notifications; 가 전부 아래 목록 안에 있어야 한다.
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'FUND_GOAL_REACHED', 'TRIP_D7', 'SETTLEMENT_READY',
    'INVITE_SENT', 'INVITE_RECEIVED',
    'JOIN_REQUESTED', 'JOIN_ACCEPTED', 'JOIN_REJECTED',
    'MEMBER_JOINED', 'MEMBER_LEFT', 'OWNER_DELEGATED',
    'CANCEL_REQUESTED', 'CANCEL_VOTE_AGREED', 'CANCEL_REJECTED', 'CANCEL_EXPIRED',
    'CANCEL_WITHDRAWN', 'CANCEL_CONFIRMED', 'CANCEL_RESTORED',
    'TRIP_AUTO_JOINED'      -- 기존 모임의 새 여행에 자동 합류 → 합류당한 본인 (2026-09-21)
  ));

-- ── ② TRIP_AUTO_JOINED 멱등 (notifications_invite_received_uniq 와 같은 방식) ──
create unique index if not exists notifications_trip_auto_joined_uniq
  on public.notifications (user_id, trip_id)
  where type = 'TRIP_AUTO_JOINED';

-- ── ③ add_group_members_to_trip — 후보 조건 A + 알림 B ────────────────────────
create or replace function public.add_group_members_to_trip(p_trip_id uuid)
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_user_id     uuid := auth.uid();
  v_trip        public.trips%rowtype;
  v_candidates  uuid[];
  v_uid         uuid;
  v_total       integer;
  v_group_label text;
  v_body        text;
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

  -- 넣을 사람 = 모임의 ACTIVE 멤버 중 이 여행에 **행이 하나도 없는** 사람. 생성자 제외.
  -- 탈퇴 계정은 뺀다. (lib/supabase/queries/groups.ts getGroupMembers 와 같은 기준)
  -- ⚠️ ACTIVE · LEFT · INVITED 어느 행이든 있으면 후보가 아니다. 나간 사람을 자동 합류로
  --    되돌리지 않는다 — 재참여는 초대 → 참여 의사 → 수락 경로뿐이다. (2026-09-21 확정)
  select array_agg(distinct gm.user_id) into v_candidates
  from public.group_members gm
  join public.users u on u.id = gm.user_id and u.deleted_at is null
  where gm.group_id = v_trip.group_id
    and gm.status = 'ACTIVE'
    and gm.user_id <> v_user_id
    and not exists (
      select 1 from public.trip_members tm
      where tm.trip_id = p_trip_id
        and tm.user_id = gm.user_id
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

  -- 알림 문구는 루프 밖에서 한 번만 만든다. 모임명도 한 번만 읽는다. (N+1 금지)
  select coalesce(nullif(btrim(g.name), ''), '모임') into v_group_label
  from public.groups g where g.id = v_trip.group_id;
  v_group_label := coalesce(v_group_label, '모임');

  v_body := v_group_label || '의 ' || public.notification_trip_label(v_trip.destination)
            || '에 함께하게 됐어요.';
  if v_trip.start_date is not null and v_trip.end_date is not null then
    v_body := v_body || ' ' || to_char(v_trip.start_date, 'FMMM"월" FMDD"일"') || '부터 '
              || to_char(v_trip.end_date, 'FMMM"월" FMDD"일"') || '까지예요.';
  end if;

  -- 후보는 행이 없는 사람뿐이라 activate_trip_member 는 항상 새 행을 insert 한다.
  -- (되살리는 분기는 타지 않는다 · 20260913000001 ①)
  -- 넣은 직후 그 사람에게 알린다. create_notification 은 실패해도 이 트랜잭션을 깨지 않고,
  -- ② index 덕에 같은 여행 · 같은 사람에게는 한 번만 남는다.
  foreach v_uid in array v_candidates loop
    perform public.activate_trip_member(p_trip_id, v_uid);
    if v_uid <> v_user_id then   -- 생성자 이중 안전장치
      perform public.create_notification(
        v_uid,
        'TRIP_AUTO_JOINED',
        '새 여행에 함께하게 됐어요',
        v_body,
        p_trip_id,
        jsonb_build_object('groupId', v_trip.group_id, 'actorUserId', v_user_id)
      );
    end if;
  end loop;

  return cardinality(v_candidates);
end;
$function$;

comment on function public.add_group_members_to_trip(uuid) is
  '여행 생성 직후 1회. 그 여행 모임의 ACTIVE 멤버 중 이 여행에 행이 없는 사람을 참여시키고 정원을 맞추고 TRIP_AUTO_JOINED 로 알린다. 여행장만 부를 수 있다. (2026-09-21)';

-- 권한은 20260921000010 과 같다. 두 번 실행해도 안전하게 다시 적는다.
revoke all on function public.add_group_members_to_trip(uuid) from public, anon;
grant execute on function public.add_group_members_to_trip(uuid) to authenticated;
