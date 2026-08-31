import { ScrollView, View } from 'react-native';

import { GroupTravelCard } from './GroupTravelCard';
import type { GroupTravelCardData } from './types';

type Props = {
  groups: GroupTravelCardData[];
  onPressGroup: (groupId: string) => void;
};

/**
 * 모임 카드 1열 목록. 세로로 쌓이고 넘치면 스크롤한다.
 *
 * 폭을 px 로 잡지 않는다. contentContainer 의 좌우 padding(20px)만 주고
 * 카드는 남은 폭을 그대로 채운다. 기기 폭이 달라도 항상 화면 폭 - 40 이다.
 */
export function GroupTravelCardList({ groups, onPressGroup }: Props) {
  return (
    <ScrollView className="flex-1 bg-white" contentContainerClassName="px-5 pb-10 pt-6">
      <View className="gap-3">
        {groups.map((group) => (
          <GroupTravelCard key={group.groupId} group={group} onPress={onPressGroup} />
        ))}
      </View>
    </ScrollView>
  );
}
