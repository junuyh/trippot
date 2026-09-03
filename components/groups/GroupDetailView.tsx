import { ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/ui';

import { GroupAccountList } from './GroupAccountList';
import { GroupMemberList } from './GroupMemberList';
import { GroupTripCard } from './GroupTripCard';
import { formatCreatedDate, formatMemberCount } from './format';
import type { GroupDetailData } from './types';

type Props = {
  group: GroupDetailData;
  onPressTrip: (tripId: string) => void;
  onPressCreateTrip: () => void;
};

/** 섹션 제목 + 본문. 상세 화면의 블록이 전부 같은 리듬을 갖게 한다. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mt-7">
      <Text className="text-sm font-bold text-gray-900">{title}</Text>
      <View className="mt-3">{children}</View>
    </View>
  );
}

/**
 * GROUP-02 모임 상세 본문. (docs/09_IA_v1.md §3-2)
 *
 * 기본정보 · 멤버 · 연결 계좌 · 진행 중인 여행 · 지난 여행 ·
 * [이 모임으로 새 여행 만들기]
 *
 * '누적 여행 유형 / 소비 특성' 은 IA 가 [고도화] 로 표시해 넣지 않는다.
 *
 * 데이터 조회·로그는 app/groups/[groupId].tsx 가 한다. 여기는 그리기만 한다.
 * (CLAUDE.md 9장)
 */
export function GroupDetailView({ group, onPressTrip, onPressCreateTrip }: Props) {
  return (
    <ScrollView className="flex-1 bg-white" contentContainerClassName="px-5 pb-10 pt-6">
      {/* 모임 기본정보 */}
      <View>
        <Text numberOfLines={2} className="text-2xl font-bold leading-8 text-gray-900">
          {group.name}
        </Text>
        <Text className="mt-1.5 text-xs text-gray-500">
          {`만든 날 ${formatCreatedDate(group.createdAt)} · ${formatMemberCount(group.memberCount)}`}
        </Text>
      </View>

      <Section title="멤버">
        <GroupMemberList members={group.members} />
      </Section>

      <Section title="연결 계좌">
        <GroupAccountList accounts={group.accounts} />
      </Section>

      <Section title="준비 중인 여행">
        {group.ongoingTrips.length === 0 ? (
          <Text className="text-sm text-gray-400">준비 중인 여행이 없어요.</Text>
        ) : (
          <View className="gap-3">
            {group.ongoingTrips.map((trip) => (
              <GroupTripCard key={trip.tripId} trip={trip} onPress={onPressTrip} />
            ))}
          </View>
        )}
      </Section>

      <Section title="지난 여행">
        {group.pastTrips.length === 0 ? (
          <Text className="text-sm text-gray-400">지난 여행이 없어요.</Text>
        ) : (
          <View className="gap-3">
            {group.pastTrips.map((trip) => (
              <GroupTripCard key={trip.tripId} trip={trip} onPress={onPressTrip} />
            ))}
          </View>
        )}
      </Section>

      {/* 화면 가장 아래. 모든 여행 목록 다음이다. */}
      <View className="mt-9">
        <Button label="이 모임으로 새 여행 만들기" onPress={onPressCreateTrip} />
      </View>
    </ScrollView>
  );
}
