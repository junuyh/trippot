import { RefreshControl, ScrollView, View } from 'react-native';

import type { TripAction } from '@/lib/trip/tripActions';

import { CreateTripFab } from './CreateTripFab';
import { HomeHeader } from './HomeHeader';
import { HomeNoticeCarousel } from './HomeNoticeCarousel';
import { type InvitePromptProps } from './InvitePrompt';
import { OngoingTripCarousel } from './OngoingTripCarousel';
import { PastTripSection } from './PastTripSection';
import type {
  EndedTripCardData,
  HomeEmptyVariant,
  OngoingTripCardData,
} from './types';
import { useFabExpand } from './useFabExpand';

type Props = {
  userName: string | null;
  /** 가장 가까운 여행까지 남은 일수. 인사 문구에 쓴다. */
  daysToNextTrip: number | null;

  /** 준비 중인 여행 전부. 티켓 카드 가로 슬라이드가 된다. */
  ongoingTrips: OngoingTripCardData[];
  /** 진행 중 여행이 하나도 없을 때 문구를 고르는 값. (docs/03 REQ-HOME-002) */
  emptyVariant: HomeEmptyVariant;

  /*
   * ⚠️ 2026-09-16 추천 여행지(suggestions · onPressSuggestion)를 뺐다.
   *    준비 중인 여행이 없을 때 그 자리를 채우던 값인데, 이제 그 자리는 빈 카드가
   *    맡는다. 신규 사용자 홈(HomeEmpty)은 그대로 이 값을 쓴다.
   */

  /** 홈에 보여줄 지난 여행. 최근 몇 개만이다. 전체는 MY-02. */
  pastTrips: EndedTripCardData[];

  onPressTrip: (tripId: string) => void;
  /** 지난 여행 카드의 '결산하기' 를 눌렀을 때. 결산 화면으로 바로 보낸다. */
  onPressSettle: (tripId: string) => void;
  onPressCreateTrip: () => void;
  onPressAllPastTrips: () => void;
  /** 상단바 알림 버튼. 받은 알림 목록으로 보낸다. */
  onPressNotifications: () => void;
  /**
   * 아래로 당겨 새로고침. 화면 파일이 조회를 다시 돌린다. (app/(tabs)/index.tsx)
   * 넘기지 않으면 새로고침을 그리지 않는다.
   */
  refreshing?: boolean;
  onRefresh?: () => void;
  /** 답하지 않은 여행 초대. 준비 중인 여행 위 배너. (InvitePrompt) */
  invitePrompt: InvitePromptProps;
  /**
   * 지금 답해야 할 일 — 참여 요청 대기 · 취소 요청 중. 초대 배너 바로 아래.
   * 판단·문구는 lib/trip/tripActions 가 한다. 여기는 그리기만.
   */
  actions: TripAction[];
  onPressAction: (action: TripAction) => void;
  /** [개발용] 로고 길게 누르기. 신규 사용자 홈 미리보기 토글. (HomeHeader) */
  onLongPressLogo?: () => void;

  /*
   * ⚠️ 2026-09-16 여행지 추천 두 칸(계절 추천 · 여행 스타일)을 뺐다.
   *    기존 사용자 홈은 **내 여행이 놓인 선반**이다. 추천이 지난 여행 아래
   *    두 칸을 더 차지하면서 홈이 길어지고, 내 여행보다 추천이 많아 보였다.
   *    추천은 신규 사용자 홈과 여행지 추천 화면(/destinations)이 맡는다.
   */
};

/**
 * HOME-01 본문. (2026-09-03 개편)
 *
 * 홈은 **내 여행이 놓인 선반**이다. 지금 가는 여행과 다녀온 여행을 보여주고,
 * 새 여행을 시작하게 한다. docs/09_IA_v2.md §1 구조 그대로다.
 *
 *   1-1. 준비 중인 여행   여행지·일정·여행자금 배너, 가로 슬라이드
 *   1-2. 지난 여행        빈티지 우표, 가로 슬라이드 (결산 전이면 '결산하기')
 *   1-4. 새 여행 만들기   본문 위에 떠 있는 버튼 (CreateTripFab)
 *
 * ⚠️ **[문서와 어긋남] 새 여행 만들기가 본문 안에 없다.** (2026-09-09)
 *    docs/09_IA_v2.md §1-4 는 이것을 목록 맨 아래 카드로 두라고 적고 있다.
 *    카드는 스크롤을 따라 화면 밖으로 사라져서, 지난 여행을 훑다가
 *    "그럼 새로 만들자" 고 마음먹은 순간 버튼이 화면에 없었다.
 *    떠 있는 버튼은 어디까지 내려가도 남는다.
 *    (9/07 에 카드를 지난 여행 위로 올린 것도 같은 이유였는데, 그때는
 *     자리만 바꿔서 조금만 내리면 여전히 사라졌다.)
 *    문서를 임의로 고치지 않았다. (CLAUDE.md 1-1)
 *
 * ⚠️ 2026-09-02 대시보드 개편(메인 카드·지금 챙겨야 할 것·여행자금 현황·
 *    모임 바로가기·지난 여행 인사이트)을 되돌렸다.
 *    금액·준비율·부족 금액이 홈 대부분을 차지하면서 홈이 "어디 가지?" 가 아니라
 *    "얼마 있지?" 에 답하고 있었다. 계좌관리 앱·가계부처럼 만들지 않는다는
 *    CLAUDE.md 2장에 어긋난다. 금액은 여행 준비 홈(TRIP-HOME-01)에서 본다.
 *
 * ⚠️ 지난 여행을 홈에 둔 것은 취향이 아니라 요구사항이다.
 *    docs/03_요구사항정의서_v1.md REQ-HOME-001 은 Must 이고,
 *    개편 전 홈은 종료 여행을 아예 그리지 않아 이 항목을 채우지 못했다.
 *
 * ⚠️ 2026-09-03 바탕을 흰색으로 바꿨다.
 *    카드도 흰색이라 경계가 약해지는데, 카드마다 1px 테두리(#edf0f2)와 그림자가
 *    있어서 구분된다. trip-home 카드들이 쓰는 방식과 같다.

 *
 * 데이터만 props 로 받는다. supabase / track() 을 직접 부르지 않는다. (CLAUDE.md 9장)
 */
export function HomeView({
  userName,
  daysToNextTrip,
  ongoingTrips,
  emptyVariant,
  pastTrips,
  onPressTrip,
  onPressSettle,
  onPressCreateTrip,
  onPressAllPastTrips,
  onPressNotifications,
  refreshing,
  onRefresh,
  invitePrompt,
  actions,
  onPressAction,
  onLongPressLogo,
}: Props) {
  const { expanded, onScroll } = useFabExpand();

  return (
    <View className="flex-1 bg-white">
      {/* 상단바에는 만들기 버튼이 없다. 이유는 HomeHeader 주석 참조. */}
      <HomeHeader
        userName={userName}
        daysToNextTrip={daysToNextTrip}
        onPressNotifications={onPressNotifications}
        onLongPressLogo={onLongPressLogo}
      />

      {/* 아래 여백은 탭바(58~84)만이 아니라 떠 있는 버튼까지 덮을 만큼 준다.
          그러지 않으면 끝까지 내렸을 때 마지막 카드가 버튼에 가린다. */}
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-40 pt-6"
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={
          onRefresh ? <RefreshControl refreshing={refreshing ?? false} onRefresh={onRefresh} /> : undefined
        }
      >
        {/*
          답하지 않은 초대와 답해야 할 일. 둘 다 준비 중인 여행보다 위다.
          한 무더기로 묶어 한 장씩 옆으로 넘긴다. (HomeNoticeCarousel · 2026-09-21)
        */}
        <HomeNoticeCarousel
          {...invitePrompt}
          actions={actions}
          onPressAction={onPressAction}
        />

        {/*
          ⚠️ **준비 중인 여행이 없으면 그 사실을 그대로 말한다.** (2026-09-16 되돌림)
             9/11 에는 이 자리에 추천 여행지 배너를 놓았었다. "없다" 만 알리고
             끝나지 않게 하려던 것인데, 그러면 **내 여행 선반이 있어야 할 자리에
             추천이 들어와** 홈이 무엇을 보여주는 화면인지 흐려졌다.
             지금은 추천을 지난 여행 아래 두 칸(지금 떠나기 좋은 해외여행지 ·
             여행 스타일로 떠나보기)이 맡으므로, 이 자리는 비었다는 사실과
             '새 여행 만들기' 로 가는 길만 보여주면 된다.
             빈 카드 문구는 OngoingTripCarousel 의 EmptyCard 가 emptyVariant
             (first · return)로 가른다.
        */}
        <OngoingTripCarousel
          trips={ongoingTrips}
          emptyVariant={emptyVariant}
          onPressTrip={onPressTrip}
          onPressCreateTrip={onPressCreateTrip}
        />

        <View className="mt-7">
          <PastTripSection
            trips={pastTrips}
            onPressTrip={onPressTrip}
            onPressSettle={onPressSettle}
            onPressSeeAll={onPressAllPastTrips}
          />
        </View>
      </ScrollView>

      {/* 맨 위에서는 글자까지 보이고, 내리면 아이콘만 남는다. */}
      <CreateTripFab expanded={expanded} onPress={onPressCreateTrip} />
    </View>
  );
}
