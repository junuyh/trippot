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
    .neq('status', TRIP_STATUS.DELETED)
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
