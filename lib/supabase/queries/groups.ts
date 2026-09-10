// 담당자가 본문을 채우는 스텁이다. 시그니처와 반환 타입만 확정돼 있다.
//
// 채울 때 지킬 것 (CLAUDE.md 7장)
//   - 모든 DB Query 는 이 폴더 안에만 둔다. 화면·컴포넌트에서 supabase.from() 직접 호출 금지.
//   - 다른 사용자·모임·여행 데이터에 접근할 수 있는 Query 를 만들지 않는다.
//   - Supabase error 가 있으면 throw 한다. 화면은 그걸 Error 상태로 처리한다.
//   - 타입은 types/database.ts 생성 타입만 쓴다. 직접 정의하지 않는다.
import {
  GROUP_MEMBER_ROLE,
  GROUP_MEMBER_STATUS,
  GROUP_STATUS,
  TRIP_STATUS,
} from '@/lib/constants/status';
import { supabase } from '@/lib/supabase/client';
import type { Trip } from '@/lib/supabase/queries/trips';
import type { Tables, TablesInsert, TablesUpdate } from '@/types/database';

export type Group = Tables<'groups'>;
export type GroupInsert = TablesInsert<'groups'>;
export type GroupMember = Tables<'group_members'>;
export type GroupUpdate = TablesUpdate<'groups'>;

/** 내가 속한 모임만 반환한다. 다른 사용자의 모임이 섞이지 않게 한다. */
export async function getMyGroups(userId: string): Promise<Group[]> {
  // group_members 를 기준으로 조회한다. groups.owner_user_id 로 조회하면
  // 내가 만든 모임만 나오고, 초대받아 들어간 모임이 빠진다.
  const { data, error } = await supabase
    .from('group_members')
    .select('groups!inner(*)')
    .eq('user_id', userId)
    .eq('status', GROUP_MEMBER_STATUS.ACTIVE)
    .neq('groups.status', GROUP_STATUS.DELETED)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => row.groups);
}

/**
 * 모임의 참여 중인 멤버 수.
 *
 * 여행 생성에서 인원 기본값으로 쓴다. 기존 모임을 골랐는데 인원이 1명으로
 * 남아 있으면 사용자가 매번 직접 올려야 하고, 그대로 넘어가면 4인 여행 예산이
 * 1인 기준으로 추천된다.
 *
 * INVITED / LEFT 는 세지 않는다. 아직 안 왔거나 이미 나간 사람이다.
 */
export async function getGroupMemberCount(groupId: string): Promise<number> {
  const { count, error } = await supabase
    .from('group_members')
    .select('id', { count: 'exact', head: true })
    .eq('group_id', groupId)
    .eq('status', GROUP_MEMBER_STATUS.ACTIVE);

  if (error) throw error;
  return count ?? 0;
}

export async function getGroupById(groupId: string): Promise<Group | null> {
  const { data, error } = await supabase
    .from('groups')
    .select('*')
    .eq('id', groupId)
    .neq('status', GROUP_STATUS.DELETED)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * 모임 생성. owner 를 group_members 에 role='OWNER' 로 함께 넣는다.
 *
 * ⚠️ supabase-js 에는 트랜잭션이 없다. groups insert 는 성공했는데
 *    group_members insert 가 실패하면 **멤버가 아무도 없는 모임**이 남고,
 *    그 모임은 getMyGroups() 에 잡히지 않아 사용자 눈에도 안 보인다.
 *    그래서 실패 시 방금 만든 groups 행을 지워 원래 상태로 되돌린다.
 *    진짜 원자성이 필요해지면 Edge Function 이나 RPC 로 옮긴다.
 *
 * ⚠️ 동행자(아직 앱에 가입하지 않은 사람)는 여기 넣지 않는다.
 *    group_members.user_id 가 NOT NULL + users FK 라 가입자만 들어갈 수 있다.
 *    동행자 이름은 trip_members.display_name 에 저장한다.
 *    (docs/README.md §5 #15)
 */
export async function createGroup(input: GroupInsert): Promise<Group> {
  const { data: group, error } = await supabase
    .from('groups')
    .insert(input)
    .select()
    .single();

  if (error) throw error;

  const { error: memberError } = await supabase.from('group_members').insert({
    group_id: group.id,
    user_id: group.owner_user_id,
    role: GROUP_MEMBER_ROLE.OWNER,
    status: GROUP_MEMBER_STATUS.ACTIVE,
    joined_at: new Date().toISOString(),
  });

  if (memberError) {
    // 보상 삭제. 이것마저 실패하면 멤버 없는 모임이 남지만,
    // 원래 에러를 덮어쓰지 않도록 삭제 에러는 무시한다.
    await supabase.from('groups').delete().eq('id', group.id);
    throw memberError;
  }

  return group;
}

/**
 * 이미 있는 모임에 멤버를 여러 명 넣는다. (새 모임 만들기 — 기존 모임원 데려오기)
 *
 * ⚠️ createGroup() 이 만든 사람을 OWNER 로 넣은 **뒤에** 부른다.
 *    여기서 넣는 사람은 전부 MEMBER 다. 모임장은 한 명이다.
 *
 * ⚠️ 만든 사람이 userIds 에 섞여 들어와도 OWNER 자리를 빼앗지 않는다.
 *    (group_id, user_id) UNIQUE 라 같은 사람을 또 넣으면 통째로 실패하므로,
 *    호출부가 거르지 못한 경우를 대비해 여기서 한 번 더 뺀다.
 *
 * ⚠️ 빈 배열이면 아무것도 하지 않는다. 데려올 사람을 아무도 안 골랐을 때
 *    빈 INSERT 를 보내면 supabase 가 에러로 돌려준다.
 */
export async function addGroupMembers(
  groupId: string,
  userIds: string[],
  excludeUserId?: string,
): Promise<void> {
  const targets = Array.from(new Set(userIds)).filter((id) => id !== excludeUserId);
  if (targets.length === 0) return;

  const joinedAt = new Date().toISOString();
  const { error } = await supabase.from('group_members').insert(
    targets.map((userId) => ({
      group_id: groupId,
      user_id: userId,
      role: GROUP_MEMBER_ROLE.MEMBER,
      status: GROUP_MEMBER_STATUS.ACTIVE,
      joined_at: joinedAt,
    })),
  );

  if (error) throw error;
}

export type GroupMemberWithUser = GroupMember & {
  user: Pick<Tables<'users'>, 'id' | 'name' | 'profile_image_url'>;
};

/**
 * 모임의 참여 중인 멤버 목록. 이름까지 함께 가져온다.
 *
 * getGroupMemberCount() 는 숫자만 센다. 인원 수만 필요하면 그쪽이 더 싸다.
 * 화면에 이름을 보여줘야 할 때만 이 함수를 쓴다.
 *
 * INVITED / LEFT 는 제외한다. 아직 안 왔거나 이미 나간 사람이다.
 * 탈퇴한 사용자(users.deleted_at)도 제외한다. 이름 자리가 비어 보이게 된다.
 *
 * OWNER 를 맨 앞에 둔다. 모임장이 누구인지 목록 첫 줄에서 바로 보이게 한다.
 */
export async function getGroupMembers(groupId: string): Promise<GroupMemberWithUser[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select('*, users!inner(id, name, profile_image_url)')
    .eq('group_id', groupId)
    .eq('status', GROUP_MEMBER_STATUS.ACTIVE)
    .is('users.deleted_at', null)
    .order('joined_at', { ascending: true });

  if (error) throw error;

  return (data ?? [])
    .map(({ users, ...member }) => ({ ...member, user: users }))
    .sort((a, b) => {
      // OWNER 먼저. 나머지는 조회 순서(가입일 오름차순)를 그대로 둔다.
      if (a.role === b.role) return 0;
      return a.role === GROUP_MEMBER_ROLE.OWNER ? -1 : 1;
    });
}

export type GroupTrips = {
  /** 아직 끝나지 않은 여행. PLANNING · TRAVELING */
  ongoing: Trip[];
  /** 끝난 여행. ENDED · SETTLED */
  past: Trip[];
};

/**
 * 모임의 여행 목록을 진행 중 / 지난 으로 나눠 반환한다.
 *
 * GROUP-01 은 진행 중인 여행과 지난 여행 수를, GROUP-02 는 양쪽 목록을 모두 쓴다.
 * 화면마다 status 로 나누면 분류 기준이 갈라지므로 여기서 한 번만 나눈다.
 *
 * 최신 여행이 위로 오도록 start_date 내림차순이다.
 */
export async function getGroupTrips(groupId: string): Promise<GroupTrips> {
  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .eq('group_id', groupId)
    // ⚠️ 취소된 여행도 뺀다. develop 의 getTrips · personalization 이 쓰는 것과
    //    같은 조건이다. 여기만 DELETED 만 빼면 취소한 여행이 모임 상세에서만
    //    계속 보인다. (2026-09-10 · develop de1dfc7 의 CANCELED 정책에 맞춤)
    .not('status', 'in', `(${TRIP_STATUS.DELETED},${TRIP_STATUS.CANCELED})`)
    .order('start_date', { ascending: false });

  if (error) throw error;

  const trips = data ?? [];

  return {
    ongoing: trips.filter(
      (trip) =>
        trip.status === TRIP_STATUS.PLANNING || trip.status === TRIP_STATUS.TRAVELING,
    ),
    past: trips.filter(
      (trip) => trip.status === TRIP_STATUS.ENDED || trip.status === TRIP_STATUS.SETTLED,
    ),
  };
}

/**
 * 모임 정보 수정. 지금은 이름 변경에만 쓴다.
 *
 * 권한은 RLS 가 판단한다. (docs/05_ERD_v3.md §6-2 — groups 는 소유자 또는 ACTIVE 멤버만)
 * 앱에서 별도 owner 검사를 넣지 않는다. 두 곳에 권한 규칙이 생기면 서로 어긋난다.
 * 권한이 없으면 Supabase 가 error 를 주고 화면이 실패 메시지를 띄운다.
 */
export async function updateGroup(groupId: string, patch: GroupUpdate): Promise<Group> {
  const { data, error } = await supabase
    .from('groups')
    .update(patch)
    .eq('id', groupId)
    .select()
    .single();

  if (error) throw error;
  return data;
}


// ============================================================================
// GROUP-01 목록 표시 설정 (user_group_list_preferences)
//
// ⚠️ 이 아래 함수들은 GROUP-01 전용이다. getMyGroups() 는 HOME-01 과 TRIP-01 도
//    함께 쓰므로 숨김·정렬을 그쪽에 넣지 않는다. 숨긴 모임으로도 새 여행을
//    만들 수 있어야 하고, 홈에서는 계속 보여야 한다.
//    (supabase/migrations/20260831000001_add_user_group_list_preferences.sql)
// ============================================================================
export type GroupListPreference = Tables<'user_group_list_preferences'>;
export type GroupListPreferenceInsert = TablesInsert<'user_group_list_preferences'>;

/** 목록이 어떤 기준으로 정렬돼 있는지. 화면은 이 값을 문구로만 보여준다. */
export type GroupSortMode = 'RECENT_TRIP' | 'CREATED_AT';

/** 정렬·쓰기에 필요한 최소 정보. 카드 데이터로는 화면이 다시 가공한다. */
export type GroupListEntry = {
  group: Group;
  /** null 이면 사용자가 이 모임의 순서를 지정한 적이 없다. */
  sortOrder: number | null;
};

export type MyGroupListForDisplay = {
  /** 숨김을 제외하고 정렬까지 끝난 목록. */
  entries: GroupListEntry[];
  /** 편집 모드의 '숨긴 모임 N개 보기' 노출 판단에 쓴다. */
  hiddenCount: number;
};

/** 최신 모임이 위로. 기본 정렬이자 모든 동률의 보조 기준이다. */
function compareCreatedAtDesc(a: Group, b: Group): number {
  return (b.created_at ?? '').localeCompare(a.created_at ?? '');
}

/** 현재 사용자의 표시 설정 전체. 숨긴 행도 포함한다. */
async function getListPreferences(userId: string): Promise<GroupListPreference[]> {
  const { data, error } = await supabase
    .from('user_group_list_preferences')
    .select('*')
    .eq('user_id', userId);

  if (error) throw error;
  return data ?? [];
}

/**
 * GROUP-01 목록. 숨김을 빼고 정렬까지 끝내서 준다.
 *
 * ⚠️ 읽기만 한다. preference 행을 자동으로 만들지 않는다.
 *    화면 진입마다(useFocusEffect) 불리는 함수라 여기서 쓰면 탭 전환만으로
 *    DB 에 쓰게 된다. 순서 부여는 사용자가 Chevron 을 누를 때만 한다.
 *
 * 정렬
 *   1. sort_order 가 있는 모임  → sort_order ASC
 *   2. 순서 미설정 모임         → groups.created_at DESC (뒤쪽)
 *   동률·NULL 은 항상 created_at DESC 로 갈라 결과가 흔들리지 않게 한다.
 *
 * ⚠️ getMyGroups() 는 group_members.created_at(내 가입 시각) 으로 정렬한다.
 *    GROUP-01 기본 정렬은 groups.created_at(모임 생성일) 이라 여기서 다시 세운다.
 *    공유 함수를 고치지 않는 이유는 위 파일 상단 주석과 같다.
 */
export async function getMyGroupListForDisplay(userId: string): Promise<MyGroupListForDisplay> {
  const [groups, preferences] = await Promise.all([
    getMyGroups(userId),
    getListPreferences(userId),
  ]);

  const byGroupId = new Map(preferences.map((row) => [row.group_id, row]));

  // ⚠️ sort_order 를 읽지 않는다. GROUP-01 에서 '사용자 지정 순' 을 없앴다.
  //    (2026-09-03 정책 — 정렬은 최근 여행순 / 모임 생성순 둘뿐이다)
  //    컬럼과 migration 은 그대로 둔다. 지우지 않는다.
  //    여기서 preferences 는 hidden 판정에만 쓴다.
  const visible: GroupListEntry[] = [];
  let hiddenCount = 0;

  for (const group of groups) {
    const preference = byGroupId.get(group.id);
    if (preference?.hidden) {
      hiddenCount += 1;
      continue;
    }
    visible.push({ group, sortOrder: preference?.sort_order ?? null });
  }

  // 기본 순서는 모임 생성 최신순이다. '최근 여행순' 은 여행 날짜가 필요해서
  // 화면이 카드 데이터를 다 모은 뒤에 다시 정렬한다. (app/(tabs)/groups.tsx)
  visible.sort((a, b) => compareCreatedAtDesc(a.group, b.group));

  return { entries: visible, hiddenCount };
}

/**
 * 숨긴 모임. 편집 모드의 바텀시트에서만 쓴다.
 *
 * getMyGroups() 를 거쳐서 만든다. 그래야 참여 중(ACTIVE) 판정과
 * 삭제 모임 제외 기준이 일반 목록과 정확히 같아진다.
 */
export async function getHiddenGroups(userId: string): Promise<Group[]> {
  const [groups, preferences] = await Promise.all([
    getMyGroups(userId),
    getListPreferences(userId),
  ]);

  const hiddenIds = new Set(
    preferences.filter((row) => row.hidden).map((row) => row.group_id),
  );

  return groups.filter((group) => hiddenIds.has(group.id)).sort(compareCreatedAtDesc);
}

/**
 * ⚠️ upsert 는 명시하지 않은 칼럼을 기본값으로 덮어쓴다.
 *    hidden 과 sort_order 를 항상 함께 실어야 기존 값이 초기화되지 않는다.
 *    unique (user_id, group_id) 가 있어 onConflict 가 성립한다.
 *
 * 배열을 한 번에 보내면 PostgREST 가 단일 INSERT ... ON CONFLICT 문으로 실행한다.
 * SQL 한 문장은 원자적이라 일부 행만 반영되는 상태가 생기지 않는다.
 */
async function upsertPreferences(rows: GroupListPreferenceInsert[]): Promise<void> {
  if (rows.length === 0) return;

  const { error } = await supabase
    .from('user_group_list_preferences')
    .upsert(rows, { onConflict: 'user_id,group_id' });

  if (error) throw error;
}

/**
 * 내 목록에서 제거. 여러 건을 한 번에 처리한다.
 *
 * ⚠️ 삭제도 탈퇴도 아니다. groups / group_members / trips 를 건드리지 않는다.
 *    현재 사용자의 GROUP-01 표시 여부만 바꾼다.
 *
 * sort_order 는 넘겨받은 값을 그대로 유지한다. 원래 위치 복원에 쓰기 위해서가
 * 아니라, 사용자가 이미 사용자 지정 정렬을 쓰고 있었다는 상태를 잃지 않기 위해서다.
 */
export async function hideGroups(
  userId: string,
  items: { groupId: string; sortOrder: number | null }[],
): Promise<void> {
  await upsertPreferences(
    items.map((item) => ({
      user_id: userId,
      group_id: item.groupId,
      hidden: true,
      sort_order: item.sortOrder,
    })),
  );
}

/**
 * 숨긴 모임을 다시 표시한다.
 *
 * 원래 위치로 되돌리지 않는다. 복구는 '목록에 다시 추가' 의 의미다.
 *   기본 정렬 상태      → sortOrder = null  (created_at 자리로 들어간다)
 *   사용자 지정 순 상태 → 보이는 목록의 마지막 값 + 1  (맨 아래)
 * 위치 계산은 화면이 한다. 여기서는 받은 값을 그대로 쓴다.
 */
export async function unhideGroup(
  userId: string,
  groupId: string,
  sortOrder: number | null,
): Promise<void> {
  await upsertPreferences([
    { user_id: userId, group_id: groupId, hidden: false, sort_order: sortOrder },
  ]);
}

/**
 * 보이는 목록 전체에 1..N 을 부여한다.
 *
 * 사용자가 처음 Chevron 을 누를 때 쓴다. 일부에만 순서를 넣으면 NULL 과 숫자가
 * 섞여 정렬이 정의되지 않으므로 항상 전체를 정규화한다.
 * 이동을 반영한 최종 순서를 받아서 한 번에 저장한다. 저장을 두 단계로 나누지 않는다.
 */
export async function saveGroupOrder(userId: string, orderedGroupIds: string[]): Promise<void> {
  await upsertPreferences(
    orderedGroupIds.map((groupId, index) => ({
      user_id: userId,
      group_id: groupId,
      hidden: false,
      sort_order: index + 1,
    })),
  );
}

/**
 * 인접한 두 모임의 sort_order 를 교환한다.
 *
 * 두 행을 한 배열로 보낸다. 각각 독립 UPDATE 로 보내면 한 행만 성공해
 * sort_order 가 중복되거나 비는 상태가 생긴다. (upsertPreferences 주석)
 */
export async function swapGroupOrder(
  userId: string,
  a: { groupId: string; sortOrder: number },
  b: { groupId: string; sortOrder: number },
): Promise<void> {
  await upsertPreferences([
    { user_id: userId, group_id: a.groupId, hidden: false, sort_order: b.sortOrder },
    { user_id: userId, group_id: b.groupId, hidden: false, sort_order: a.sortOrder },
  ]);
}

/**
 * 사용자 지정 순서를 모두 지운다. 모임 생성일 순으로 돌아간다.
 *
 * ⚠️ hidden 은 건드리지 않는다. 정렬 초기화가 숨김 해제까지 하면 사용자가
 *    예상하지 못한다. 숨김 해제는 '숨긴 모임 → 다시 표시' 만 담당한다.
 *    그래서 upsert 가 아니라 update 다. upsert 는 hidden 을 덮어쓴다.
 */
export async function resetGroupOrder(userId: string): Promise<void> {
  const { error } = await supabase
    .from('user_group_list_preferences')
    .update({ sort_order: null })
    .eq('user_id', userId);

  if (error) throw error;
}

/**
 * 여행별 금액 요약. GROUP-02 여행 카드가 MY 카드와 같은 값을 보여주기 위해 쓴다.
 *
 * ⚠️ getTripsWithSummary() 와 **같은 세 테이블·같은 칼럼**을 읽는다.
 *    (trip_budgets.target_amount · fund_sources.current_amount ·
 *     settlements.actual_amount) 규칙을 새로 만들지 않는다.
 *    같은 여행이면 MY 목록과 GROUP-02 에서 금액·진행률이 같아야 한다.
 *
 * ⚠️ 그쪽 함수를 그대로 쓸 수 없는 이유는 userId 로 시작하기 때문이다.
 *    여기는 모임의 여행 id 목록에서 시작한다. 조회 방식만 옮겨 왔다.
 *
 * ⚠️ getGroupTrips() 는 건드리지 않았다. 필요한 화면만 이 함수를 덧붙여 부른다.
 */
export type TripAmountSummary = {
  /** trip_budgets.target_amount. 예산 미확정이면 null */
  targetAmount: number | null;
  /** fund_sources.current_amount. 여행자금 미등록이면 null */
  currentAmount: number | null;
  /** settlements.actual_amount. 결산 전이면 null */
  finalAmount: number | null;
};

export async function getTripAmountSummaries(
  tripIds: string[],
): Promise<Map<string, TripAmountSummary>> {
  if (tripIds.length === 0) return new Map();

  const [budgets, funds, settlements] = await Promise.all([
    supabase.from('trip_budgets').select('trip_id, target_amount').in('trip_id', tripIds),
    supabase.from('fund_sources').select('trip_id, current_amount').in('trip_id', tripIds),
    supabase.from('settlements').select('trip_id, actual_amount').in('trip_id', tripIds),
  ]);

  if (budgets.error) throw budgets.error;
  if (funds.error) throw funds.error;
  if (settlements.error) throw settlements.error;

  // trip_id 가 셋 다 UNIQUE 라 여행당 최대 한 행이다.
  const targetByTrip = new Map((budgets.data ?? []).map((r) => [r.trip_id, r.target_amount]));
  const currentByTrip = new Map((funds.data ?? []).map((r) => [r.trip_id, r.current_amount]));
  const finalByTrip = new Map((settlements.data ?? []).map((r) => [r.trip_id, r.actual_amount]));

  return new Map(
    tripIds.map((id) => [
      id,
      {
        targetAmount: targetByTrip.get(id) ?? null,
        currentAmount: currentByTrip.get(id) ?? null,
        finalAmount: finalByTrip.get(id) ?? null,
      },
    ]),
  );
}
