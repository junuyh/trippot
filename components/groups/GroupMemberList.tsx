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
    return <Text className="text-pot-faint" style={{ fontSize: 13 }}>참여 중인 멤버가 없어요.</Text>;
  }

  return (
    <View className="gap-2.5">
      {members.map((member) => (
        <View key={member.memberId} className="flex-row items-center">
          <Text numberOfLines={1} className="shrink text-pot-ink" style={{ fontSize: 13.5 }}>
            {member.name}
          </Text>
          {member.isOwner ? (
            // ⚠️ 전에는 bg-pot-paper 였는데 tailwind.config.js 에 그 토큰이 없다.
            //    배경이 칠해지지 않아 배지가 아니라 멀찍이 떨어진 글자로 보였다.
            //    실제로 있는 pot-visual 을 쓴다. 홈·MY 가 쓰는 옅은 바탕과 같다.
            <View className="ml-1.5 shrink-0 rounded-full bg-pot-visual px-2 py-0.5">
              <Text className="font-semibold text-pot-mute" style={{ fontSize: 10.5 }}>
                모임장
              </Text>
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}
