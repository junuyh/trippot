// 담당자가 본문을 채우는 스텁이다. 시그니처와 반환 타입만 확정돼 있다.
//
// 채울 때 지킬 것 (CLAUDE.md 7장)
//   - 모든 DB Query 는 이 폴더 안에만 둔다. 화면·컴포넌트에서 supabase.from() 직접 호출 금지.
//   - 다른 사용자·모임·여행 데이터에 접근할 수 있는 Query 를 만들지 않는다.
//   - Supabase error 가 있으면 throw 한다. 화면은 그걸 Error 상태로 처리한다.
//   - 타입은 types/database.ts 생성 타입만 쓴다. 직접 정의하지 않는다.
import { supabase } from '@/lib/supabase/client';
import type { Tables, TablesInsert } from '@/types/database';

export type Group = Tables<'groups'>;
export type GroupInsert = TablesInsert<'groups'>;
export type GroupMember = Tables<'group_members'>;

/** 내가 속한 모임만 반환한다. 다른 사용자의 모임이 섞이지 않게 한다. */
export async function getMyGroups(userId: string): Promise<Group[]> {
  // TODO: group_members 를 통해 user_id = userId, status = 'ACTIVE' 인 모임 조회.
  //       groups.status = 'DELETED' 는 제외.
  return [];
}

export async function getGroupById(groupId: string): Promise<Group | null> {
  // TODO: groups 단건 조회. 호출자가 이 모임의 멤버인지 확인한 뒤 반환한다.
  //       .maybeSingle() 사용.
  return null;
}

export async function createGroup(input: GroupInsert): Promise<Group> {
  // TODO: groups insert 후, owner 를 group_members 에 role='OWNER' 로 함께 추가.
  //       두 작업이 함께 성공하거나 함께 실패해야 한다.
  throw new Error('[queries/groups] createGroup 미구현');
}
