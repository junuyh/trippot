import { Pressable, ScrollView, Text, View } from 'react-native';

import { HOME_ACCENT } from '@/components/home/palette';

import { MyTripCard } from './MyTripCard';
import type { MyTripFilter, MyTripItem } from './types';

type Props = {
  trips: MyTripItem[];
  filter: MyTripFilter;
  onChangeFilter: (filter: MyTripFilter) => void;
  onPressTrip: (tripId: string) => void;
  onPressCreateTrip: () => void;
  /** 탭에 몇 개씩 있는지 옆에 적는다. 0 이어도 탭은 그린다. */
  counts: Record<MyTripFilter, number>;
};

const NUM = { fontVariant: ['tabular-nums' as const] };

const TABS: { value: MyTripFilter; label: string }[] = [
  // ⚠️ value 는 'ongoing' 그대로다. 내부 상태값이라 바꾸지 않는다.
  //    보이는 말만 '준비 중' 이다. (2026-09-04 팀 확정 — 출발 전 상태를
  //    '진행 중' 이라 부르면 여행 중과 헷갈린다)
  { value: 'ongoing', label: '준비 중' },
  { value: 'past', label: '지난 여행' },
];

/**
 * MY-02 나의 여행 목록. (docs/04_화면목록_v3.md MY-02)
 *
 * 홈의 '진행 중인 여행 — 전체 보기' 가 여기로 들어온다.
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
  counts,
}: Props) {
  return (
    <View className="flex-1 bg-pot-visual">
      {/* 탭 */}
      <View className="flex-row gap-2 bg-white px-4 pb-3 pt-2">
        {TABS.map((tab) => {
          const active = tab.value === filter;
          return (
            <Pressable
              key={tab.value}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => onChangeFilter(tab.value)}
              className="rounded-full px-3.5 py-2"
              style={{ backgroundColor: active ? '#111827' : '#F1F3F6' }}
            >
              <Text
                className="font-bold"
                style={{ fontSize: 12.5, color: active ? '#FFFFFF' : '#747B88', ...NUM }}
              >
                {`${tab.label} ${counts[tab.value]}`}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-16 pt-4">
        {trips.length === 0 ? (
          <View className="items-center rounded-2xl border border-dashed border-pot-dash bg-white px-4 py-8">
            <Text className="text-pot-mute" style={{ fontSize: 13, lineHeight: 19 }}>
              {filter === 'ongoing'
                ? '준비 중인 여행이 없어요.'
                : '아직 다녀온 여행 기록이 없어요.'}
            </Text>

            {filter === 'ongoing' ? (
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
        {trips.length > 0 && filter === 'ongoing' ? (
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
