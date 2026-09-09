import { Text, View } from 'react-native';

import { formatCreatedDate } from './format';
import type { GroupMemberItem } from './types';

type Props = {
  members: GroupMemberItem[];
};

/**
 * 3-2. 멤버 목록. (docs/09_IA_v1.md §3-2, REQ-GROUP-001)
 *
 * 참여 중(ACTIVE) 멤버의 이름과 최초 참여일을 보여준다.
 *
 * ⚠️ **모임장을 표시하지 않는다.** (2026-09-09 확정) OWNER 는 서비스 내부
 *    권한 개념으로만 두고 사용자에게는 누가 모임장인지 알리지 않는다.
 *    DB 의 group_members.role · groups.owner_user_id 는 그대로 둔다.
 *
 * ⚠️ 참여일은 group_members.joined_at 이다. **없으면 줄을 그리지 않는다.**
 *    모임 생성일(groups.created_at)이나 오늘 날짜로 대신 채우지 않는다 —
 *    참여일이 아닌 값을 참여일이라고 보여주게 된다.
 *    나가기·재가입이 생겨도 이 값을 덮어쓰지 않아 최초 참여일이 유지된다.
 *
 * ⚠️ 누르는 자리가 아니다. 멤버 관리 화면은 없앴다. (2026-09-09)
 *
 * ⚠️ justify-between 을 쓰지 않는다. 그러면 참여일이 화면 오른쪽 끝까지 밀려
 *    이름과 멀어지고 날짜가 별도 열처럼 보인다. 참여일은 이름에 딸린 값이라
 *    바로 옆에 붙어야 한다. 이름은 shrink, 날짜는 shrink-0 이라 이름이 길어지면
 *    이름만 줄고 날짜는 잘리지 않는다. (2026-09-09)
 */
export function GroupMemberList({ members }: Props) {
  if (members.length === 0) {
    return (
      <Text className="text-pot-faint" style={{ fontSize: 13 }}>
        참여 중인 멤버가 없어요.
      </Text>
    );
  }

  return (
    <View className="gap-2.5">
      {members.map((member) => (
        <View key={member.memberId} className="flex-row items-center gap-3.5">
          <Text
            numberOfLines={1}
            className="shrink text-pot-ink"
            style={{ fontSize: 13.5 }}
          >
            {member.name}
          </Text>

          {member.joinedAt ? (
            <Text className="shrink-0 text-pot-faint" style={{ fontSize: 11.5 }}>
              {`${formatCreatedDate(member.joinedAt)} 참여`}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}
