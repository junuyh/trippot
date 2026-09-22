import type { Ionicons } from '@expo/vector-icons';
import { RefreshControl, ScrollView, Text, View } from 'react-native';

import { HOME_ACCENT } from '@/components/home/palette';
import { SwipeToAction } from '@/components/mypage';
import { EmptyState } from '@/components/ui';

import { MyTripCard } from './MyTripCard';
import { MY_TRIP_LIST_TABS, TripFilterTabs } from './TripFilterTabs';
import type { MyTripItem, MyTripListFilter } from './types';

type Props = {
  trips: MyTripItem[];
  filter: MyTripListFilter;
  onChangeFilter: (filter: MyTripListFilter) => void;
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
  /**
   * 카드를 밀어 나온 '여행 나가기' 를 눌렀을 때. (2026-09-22)
   * trip.leavable 인 카드만 밀린다. 넘기지 않으면 어떤 카드도 밀리지 않는다.
   */
  onPressLeaveTrip?: (tripId: string) => void;
  /**
   * 아래로 당겨 새로고침. useMyTrips 가 목록을 조용히 다시 읽는다. (2026-09-22 · 홈과 같은 방식)
   * 넘기지 않으면 새로고침을 그리지 않는다.
   */
  refreshing?: boolean;
  onRefresh?: () => void;
};

/**
 * 탭마다 비었을 때 할 말이 다르다. 모양은 모임 목록 빈 화면과 같은 EmptyState 다. (2026-09-22)
 *
 * ⚠️ 만들기 버튼(canCreate)은 준비 중 · 전체에만 둔다. 여행 중 · 지난 여행이 비었을 때
 *    만들기를 권하지 않는다 — 준비부터다. 전체가 비었으면 여행이 하나도 없다는 뜻이라 권한다.
 */
const EMPTY_STATE: Record<
  MyTripListFilter,
  { icon: keyof typeof Ionicons.glyphMap; title: string; description?: string; canCreate: boolean }
> = {
  all: {
    icon: 'airplane-outline',
    title: '아직 여행이 없어요',
    description: '새 여행을 만들면 여기에 모여요.',
    canCreate: true,
  },
  planning: {
    icon: 'airplane-outline',
    title: '준비 중인 여행이 없어요',
    description: '새 여행을 만들면 여기에 모여요.',
    canCreate: true,
  },
  traveling: { icon: 'navigate-outline', title: '지금 여행 중인 여행이 없어요', canCreate: false },
  past: { icon: 'time-outline', title: '아직 다녀온 여행 기록이 없어요', canCreate: false },
  canceled: { icon: 'close-circle-outline', title: '취소된 여행이 없어요', canCreate: false },
  left: { icon: 'exit-outline', title: '나간 여행이 없어요', canCreate: false },
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
  onPressLeaveTrip,
  refreshing,
  onRefresh,
}: Props) {
  const empty = trips.length === 0;
  const emptyState = EMPTY_STATE[filter];
  /*
    ⚠️ 비었을 때는 화면 전체를 흰색으로 바꾼다. (2026-09-22)
       EmptyState 가 흰 바탕을 스스로 깔아서, 회색 페이지 위에 두면 흰 네모만 떠 보인다.
       모임 목록(GroupListSection)도 비었을 때만 흰 화면이다 — 같은 규칙이다.
       components/ui/EmptyState 는 공유 파일이라 고치지 않는다. (CLAUDE.md 5장)
  */
  const pageBg = empty ? 'bg-white' : 'bg-gray-50';

  return (
    // 페이지 바탕 = 앱 공통 light gray(bg-gray-50 · 계정 관리·좋아요·여행 홈·결산과 같다). 헤더 아래 탭 영역부터
    // 하단까지 한 색이고 카드는 흰색. 브랜드 soft 는 선택된 칩 배경 몫이라 페이지 바탕으로 쓰지 않는다. (2026-09-21)
    <View className={`flex-1 ${pageBg}`}>
      {/* 탭. GROUP-02 모임 상세와 같은 컴포넌트를 쓴다. */}
      {/* 탭 버튼 스타일은 그대로, 탭 바깥 배경만 페이지와 같은 색으로 잇는다 (GROUP 상세는 기본 white 그대로). */}
      <TripFilterTabs
        filter={filter}
        onChangeFilter={onChangeFilter}
        tabs={MY_TRIP_LIST_TABS}
        className={pageBg}
      />

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-16 pt-4"
        contentContainerStyle={[
          contentBottomPadding !== undefined ? { paddingBottom: contentBottomPadding } : null,
          // 빈 화면이 남은 높이를 다 채워야 EmptyState 가 가운데에 선다.
          empty ? { flexGrow: 1 } : null,
        ]}
        refreshControl={
          onRefresh ? <RefreshControl refreshing={refreshing ?? false} onRefresh={onRefresh} /> : undefined
        }
      >
        {empty ? (
          <EmptyState
            icon={emptyState.icon}
            title={emptyState.title}
            description={emptyState.description}
            actionLabel={emptyState.canCreate ? '새 여행 만들기' : undefined}
            onAction={emptyState.canCreate ? onPressCreateTrip : undefined}
          />
        ) : (
          <View className="gap-2.5">
            {trips.map((trip) => {
              const card = (
                <MyTripCard
                  trip={trip}
                  onPress={onPressTrip}
                  restoreLoading={preparingRestoreTripId === trip.tripId}
                />
              );
              /*
                여행에서 나가기 — 카드를 왼쪽으로 밀면 오른쪽에 나온다. (2026-09-22)
                ⚠️ 모임 상세(GroupDetailView)와 같은 컴포넌트 · 같은 아이콘 · 같은 색이다.
                   삭제가 아니라 trash 가 아닌 exit-outline 이다.
                ⚠️ 나갈 수 없는 카드는 감싸지 않는다. 밀어도 아무것도 안 나온다.
                ⚠️ SwipeToAction 은 모서리를 스스로 자르지 않는다. 둥근 틀로 감싸
                   밀 때 뒤의 버튼이 카드 모서리 밖으로 비치지 않게 한다.
              */
              if (!trip.leavable || !onPressLeaveTrip) {
                return <View key={trip.tripId}>{card}</View>;
              }
              return (
                <View key={trip.tripId} className="overflow-hidden rounded-2xl">
                  <SwipeToAction
                    label="여행 나가기"
                    accessibilityLabel={`${trip.destination ?? '여행'} 에서 나가기`}
                    icon="exit-outline"
                    color="#6B7280"
                    onPress={() => onPressLeaveTrip(trip.tripId)}
                  >
                    {card}
                  </SwipeToAction>
                </View>
              );
            })}
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
