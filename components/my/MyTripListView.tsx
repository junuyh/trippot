import { Pressable, ScrollView, Text, View } from 'react-native';

import { HOME_ACCENT } from '@/components/home/palette';

import { MyTripCard } from './MyTripCard';
import { MY_TRIP_FILTER_TABS, TripFilterTabs } from './TripFilterTabs';
import type { MyTripFilter, MyTripItem } from './types';

type Props = {
  trips: MyTripItem[];
  filter: MyTripFilter;
  onChangeFilter: (filter: MyTripFilter) => void;
  onPressTrip: (tripId: string) => void;
  onPressCreateTrip: () => void;
  /**
   * 탭 목록. 기본은 MY-02 의 5탭이다.
   * 개인 여행 상세(/groups/personal)가 '나간 여행' 을 뺀 4탭으로 쓴다. (2026-09-12)
   */
  tabs?: typeof MY_TRIP_FILTER_TABS;
};

/** 탭마다 비었을 때 할 말이 다르다. */
const EMPTY_MESSAGE: Record<MyTripFilter, string> = {
  planning: '준비 중인 여행이 없어요.',
  traveling: '지금 여행 중인 여행이 없어요.',
  past: '아직 다녀온 여행 기록이 없어요.',
  canceled: '취소된 여행이 없어요.',
  left: '나간 여행이 없어요.',
};

/**
 * MY-02 나의 여행 목록. (docs/04_화면목록_v3.md MY-02)
 *
 * 홈의 '준비 중인 여행 — 전체 보기' 가 여기로 들어온다.
 * 그래서 기본 탭이 '준비 중' 이다.
 *
 * 홈은 지금 챙길 것을 추려 보여주는 자리고, 이 화면은 전부 훑는 자리다.
 * 카드 모양은 홈과 같게 두되 세로로 쌓는다.
 *
 * 데이터만 props 로 받는다. supabase / track() 을 직접 부르지 않는다. (CLAUDE.md 9장)
 */
export function MyTripListView({
  trips,
  filter,
  onChangeFilter,
  onPressTrip,
  onPressCreateTrip,
  tabs = MY_TRIP_FILTER_TABS,
}: Props) {
  return (
    <View className="flex-1 bg-pot-visual">
      {/* 탭. GROUP-02 모임 상세와 같은 컴포넌트를 쓴다. */}
      <TripFilterTabs filter={filter} onChangeFilter={onChangeFilter} tabs={tabs} />

      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-16 pt-4">
        {trips.length === 0 ? (
          <View className="items-center rounded-2xl border border-dashed border-pot-dash bg-white px-4 py-8">
            <Text className="text-pot-mute" style={{ fontSize: 13, lineHeight: 19 }}>
              {EMPTY_MESSAGE[filter]}
            </Text>

            {/* 여행 중·지난 여행이 비었을 때는 만들기를 권하지 않는다. 준비부터다. */}
            {filter === 'planning' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="새 여행 만들기"
                onPress={onPressCreateTrip}
                className="mt-3 rounded-full bg-pot-ink px-4 py-2.5 active:opacity-80"
              >
                <Text className="font-bold text-white" style={{ fontSize: 12.5 }}>
                  + 여행 만들기
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <View className="gap-2.5">
            {trips.map((trip) => (
              <MyTripCard key={trip.tripId} trip={trip} onPress={onPressTrip} />
            ))}
          </View>
        )}

        {/* 목록 끝에 안내 한 줄. 홈과 역할이 다르다는 걸 알려준다. */}
        {trips.length > 0 && (filter === 'planning' || filter === 'traveling') ? (
          <Text
            className="mt-4 text-center"
            style={{ fontSize: 11.5, color: HOME_ACCENT }}
          >
            여행을 누르면 예산과 여행자금을 관리할 수 있어요
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}
