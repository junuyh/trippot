import { Pressable, ScrollView, Text, View } from 'react-native';

import { HOME_ACCENT } from '@/components/home/palette';

import { MyTripCard } from './MyTripCard';
import { MY_TRIP_FILTER_TABS, TripFilterTabs } from './TripFilterTabs';
import type { MyTripFilter, MyTripItem } from './types';

type Props = {
  trips: MyTripItem[];
  filter: MyTripFilter;
  onChangeFilter: (filter: MyTripFilter) => void;
  /**
   * 카드를 눌렀을 때. 되돌릴 수 있는 취소 여행도 여기로 온다 —
   * 화면 파일이 여행 홈 대신 되돌리기 확인 시트를 연다. (2026-09-16)
   */
  onPressTrip: (tripId: string) => void;
  onPressCreateTrip: () => void;
  /** 되돌리기 준비(내역 조회) 중인 여행. 없으면 null. */
  preparingRestoreTripId: string | null;
  /**
   * 목록 아래 여백(pt). 떠 있는 하단 탭바(FloatingTabBar)가 있는 /groups 에서만 넘긴다(pb-28 = 112).
   * 없으면 기존 MY-02 값(pb-16) 그대로. (2026-09-21)
   */
  contentBottomPadding?: number;
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
  preparingRestoreTripId,
  contentBottomPadding,
}: Props) {
  return (
    // 페이지 바탕 = 앱 공통 light gray(bg-gray-50 · 계정 관리·좋아요·여행 홈·결산과 같다). 헤더 아래 탭 영역부터
    // 하단까지 한 색이고 카드는 흰색. 브랜드 soft 는 선택된 칩 배경 몫이라 페이지 바탕으로 쓰지 않는다. (2026-09-21)
    <View className="flex-1 bg-gray-50">
      {/* 탭. GROUP-02 모임 상세와 같은 컴포넌트를 쓴다. */}
      {/* 탭 버튼 스타일은 그대로, 탭 바깥 배경만 페이지와 같은 gray 로 잇는다 (GROUP 상세는 기본 white 그대로). */}
      <TripFilterTabs
        filter={filter}
        onChangeFilter={onChangeFilter}
        tabs={MY_TRIP_FILTER_TABS}
        className="bg-gray-50"
      />

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-16 pt-4"
        contentContainerStyle={contentBottomPadding !== undefined ? { paddingBottom: contentBottomPadding } : undefined}
      >
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
                className="mt-3 rounded-full bg-brand px-4 py-2.5 active:bg-brand-pressed"
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
              <MyTripCard
                key={trip.tripId}
                trip={trip}
                onPress={onPressTrip}
                restoreLoading={preparingRestoreTripId === trip.tripId}
              />
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
