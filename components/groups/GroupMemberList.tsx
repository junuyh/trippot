import { Text, View } from 'react-native';

import type { GroupMemberItem } from './types';

type Props = {
  members: GroupMemberItem[];
};

/**
 * 3-2. 멤버 목록. (docs/09_IA_v1.md §3-2, REQ-GROUP-001)
 *
 * 참여 중(ACTIVE) 멤버의 이름을 모두 보여주고 모임장에만 배지를 붙인다.
 * 배지 문구는 lib/constants/status.ts 의 GROUP_MEMBER_ROLE_LABEL 을 화면이 넘겨준다.
 */
export function GroupMemberList({ members }: Props) {
  if (members.length === 0) {
    return <Text className="text-sm text-gray-400">참여 중인 멤버가 없어요.</Text>;
  }

  return (
    <View className="gap-2.5">
      {members.map((member) => (
        <View key={member.memberId} className="flex-row items-center">
          <Text numberOfLines={1} className="shrink text-sm text-gray-800">
            {member.name}
          </Text>
          {member.isOwner ? (
            <View className="ml-2 shrink-0 rounded-full bg-pot-paper px-2 py-0.5">
              <Text className="text-[11px] font-semibold text-pot-ink">모임장</Text>
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}
