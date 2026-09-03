import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
    // 섹션 사이 mt-8, 제목 아래 mt-3.5. 홈의 mt-7 / mt-2.5 리듬에서
    // 한 단계씩만 넓혔다. 멤버·계좌가 제목에 붙어 답답해 보였다.
    <View className="mt-8">
      {/* 홈 섹션 제목과 같은 단이다. (16 / 800 / -0.5)
          HOME 컴포넌트를 가져다 쓰지 않고 값만 맞춘다. */}
      <Text
        className="text-pot-ink"
        style={{ fontSize: 16, lineHeight: 21, fontWeight: '800', letterSpacing: -0.5 }}
      >
        {title}
      </Text>
      <View className="mt-3.5">{children}</View>
    </View>
  );
}

/**
 * GROUP-02 모임 상세 본문. (docs/09_IA_v1.md §3-2)
 *
 * 기본정보 · 멤버 · 연결 계좌 · 진행 중인 여행 · 지난 여행 ·
 * [이 모임으로 새 여행 만들기] — 화면 하단 고정
 *
 * '누적 여행 유형 / 소비 특성' 은 IA 가 [고도화] 로 표시해 넣지 않는다.
 *
 * 데이터 조회·로그는 app/groups/[groupId].tsx 가 한다. 여기는 그리기만 한다.
 * (CLAUDE.md 9장)
 */
export function GroupDetailView({ group, onPressTrip, onPressCreateTrip }: Props) {
  // 이 화면은 (tabs) 밖 Stack 화면이라 FloatingTabBar 가 없다.
  // 대신 홈 인디케이터 자리는 직접 비켜 준다.
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-pot-visual">
      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-10 pt-5">
      {/* 모임 기본정보 */}
      <View>
        <Text
          numberOfLines={2}
          className="font-black text-pot-ink"
          style={{ fontSize: 22, lineHeight: 30, letterSpacing: -0.6 }}
        >
          {group.name}
        </Text>
        <Text className="mt-1.5 text-pot-mute" style={{ fontSize: 12.5 }}>
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
          <Text className="text-pot-faint" style={{ fontSize: 13 }}>준비 중인 여행이 없어요.</Text>
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
          <Text className="text-pot-faint" style={{ fontSize: 13 }}>지난 여행이 없어요.</Text>
        ) : (
          <View className="gap-3">
            {group.pastTrips.map((trip) => (
              <GroupTripCard key={trip.tripId} trip={trip} onPress={onPressTrip} />
            ))}
          </View>
        )}
      </Section>

      </ScrollView>

      {/*
        CTA 는 화면 하단에 고정한다.
        전에는 ScrollView 의 마지막 자식이라 여행이 많은 모임에서는 끝까지
        내려야 보였다. 모임 상세에서 가장 하고 싶은 일이 스크롤 뒤에 숨어 있었다.

        ⚠️ absolute 로 띄우지 않고 ScrollView 의 형제로 둔다. 그러면 스크롤
           영역이 그만큼 줄어들어 마지막 콘텐츠가 버튼 뒤로 들어가지 않는다.
           별도 bottom padding 을 계산할 필요도 없다.

        모양은 GroupEditActionBar 와 같다. (border-t · px-5 · pt-3)
        아래 여백은 그 바의 pb-8(32) 을 하한으로 두고 안전영역이 더 크면 그쪽을 쓴다.
      */}
      <View
        className="border-t border-pot-line bg-white px-4 pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 32) }}
      >
        <Button label="이 모임으로 새 여행 만들기" onPress={onPressCreateTrip} />
      </View>
    </View>
  );
}
