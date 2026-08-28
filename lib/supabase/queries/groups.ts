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
} from '@/lib/constants/status';
import { supabase } from '@/lib/supabase/client';
import type { Tables, TablesInsert } from '@/types/database';

export type Group = Tables<'groups'>;
export type GroupInsert = TablesInsert<'groups'>;
export type GroupMember = Tables<'group_members'>;

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
  // TODO: groups 단건 조회. 호출자가 이 모임의 멤버인지 확인한 뒤 반환한다.
  //       .maybeSingle() 사용.
  return null;
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
