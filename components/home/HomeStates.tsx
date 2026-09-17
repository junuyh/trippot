import { Ionicons } from '@expo/vector-icons';

import type { TripAction } from '@/lib/trip/tripActions';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { CreateTripFab } from './CreateTripFab';
import { DiscoverDestinationSection } from './DiscoverDestinationSection';
import { HomeButton } from './HomeButton';
import { HomeHeader } from './HomeHeader';
import { HomeActionBanners } from './HomeActionBanner';
import { InvitePrompt, type InvitePromptProps } from './InvitePrompt';
import { OnboardingEntryCard } from './onboarding/OnboardingEntryCard';
import type { DiscoverDestination } from './types';
import { useFabExpand } from './useFabExpand';

/**
 * HOME-01 의 Loading / Empty / Error.
 *
 * components/ui 의 공용 상태 컴포넌트는 흰 바탕과 파란 버튼을 쓴다.
 * 홈은 pot-stone 바탕에 검은 버튼이라 톤이 어긋나서 화면 전용으로 둔다.
 * ⚠️ components/ui 는 CLAUDE.md 5장 [공유] 라 그쪽을 고치지 않았다.
 */
function Shell({ children }: { children: React.ReactNode }) {
  return <View className="flex-1 items-center justify-center bg-white px-8">{children}</View>;
}

export function HomeLoading() {
  return (
    <Shell>
      <ActivityIndicator size="large" color="#121212" />
      <Text className="mt-4 text-sm text-pot-mute">여행을 불러오고 있어요</Text>
    </Shell>
  );
}

export function HomeError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Shell>
      <Ionicons name="alert-circle-outline" size={40} color="#EE3524" />
      <Text className="mt-4 text-center text-base font-bold text-pot-ink">문제가 생겼어요</Text>
      <Text className="mt-1.5 text-center text-sm leading-5 text-pot-mute">{message}</Text>
      <View className="mt-7 w-full max-w-xs">
        <HomeButton label="다시 시도" onPress={onRetry} />
      </View>
    </Shell>
  );
}

type HomeEmptyProps = {
  /** 인사에 쓸 이름. 없으면 이름 없이 인사한다. */
  userName: string | null;
  /** 커뮤니티에 글이 있는 여행지. 없으면 빈 배열이고 그 칸을 그리지 않는다. */
  discoveries: DiscoverDestination[];
  onCreateTrip: () => void;
  /** '둘러보기' 카드. 온보딩 페이지(/onboarding)로 보낸다. */
  onPressOnboarding: () => void;
  /** 여행자들은 이렇게 다녀왔어요 태그를 눌렀을 때. 커뮤니티로 보낸다. 한글 도시명을 넘긴다. */
  onPressDiscovery: (nameKo: string) => void;
  /** 여행자들은 이렇게 다녀왔어요 '전체 보기'. 커뮤니티 탭으로 보낸다. */
  onPressAllDiscoveries: () => void;
  /** 상단바 알림 버튼. 받은 알림 목록으로 보낸다. */
  onPressNotifications: () => void;
  /** 답하지 않은 여행 초대. 맨 위 배너. (InvitePrompt) */
  invitePrompt: InvitePromptProps;
  /**
   * 지금 답해야 할 일 — 참여 요청 대기 · 취소 요청 중.
   *
   * ⚠️ 신규 사용자 홈에도 둔다. 여행이 하나도 없어 보여도 **취소가 확정된 뒤**
   *    이 화면으로 떨어질 수 있고, 그때 되돌리기 안내가 여기 말고는 없다.
   */
  actions: TripAction[];
  onPressAction: (action: TripAction) => void;
  /** [개발용] 로고 길게 누르기. 신규 사용자 홈 미리보기 토글. (HomeHeader) */
  onLongPressLogo?: () => void;
};

/**
 * 여행이 하나도 없는 사람의 홈. (2026-09-09 개편)
 *
 *   로고 · 알림                      ← 기존 홈과 같다 (HomeHeader)
 *   답하지 않은 초대 배너              ← 기존 홈과 같다 (InvitePrompt)
 *   떠나기 전에, TripPot 먼저 여행해 볼래요?  ← 온보딩 들어가기 카드 (OnboardingEntryCard)
 *   여행자들은 이렇게 다녀왔어요 (트래블 스토리 카드 → 커뮤니티 그 여행지 글)
 *   새 여행 만들기                   ← 기존 홈과 같은 떠 있는 버튼 (CreateTripFab)
 *
 * ⚠️ 2026-09-17 온보딩 캐러셀을 홈에서 빼고 페이지(/onboarding)로 옮겼다.
 *    첫 화면이 설명서가 되어 부담스러웠다. 넘기는 설명은 대부분 건너뛴다는 조사도 있다.
 *    홈에는 궁금하면 들어가 보게 만드는 카드 한 장만 둔다.
 *    캐러셀 아래 '첫 여행 만들기' 가 함께 사라져서 떠 있는 버튼(CreateTripFab)을 되살렸다.
 *    기존 홈과 같은 버튼이라 첫 여행을 만든 뒤에도 자리가 그대로다.
 *
 * ⚠️ 2026-09-17 맨 위 '추천 여행지' 포스터 슬라이드를 뺐다. 여행지 추천 기능 제거.
 *    누르면 가던 여행지 상세 화면도 함께 지웠다. (app/(tabs)/index.tsx 주석)
 *
 * ⚠️ 껍데기(바탕색·좌우 여백·아래 여백)를 HomeView 와 같은 값으로 맞췄다.
 *    첫 여행을 만든 순간 이 화면이 HomeView 로 바뀌는데, 여백이 다르면
 *    글자가 옆으로 튀어서 다른 앱에 들어온 것처럼 보인다.
 *
 * ⚠️ 전에는 가운데 정렬한 아이콘 + 한 문장 + 버튼이었다. 틀리지는 않았지만
 *    "안내문" 이지 홈이 아니었다. 처음 온 사람이 보는 화면이 목록이 비었다는
 *    사실만 알려주고 끝나면, 이 앱으로 무엇을 하는지 알 방법이 없다.
 *
 * ⚠️ 이 화면에는 지난 여행 자리가 없다. 여행이 0개일 때만 나오는 화면이라
 *    지난 여행도 0개다. (app/(tabs)/index.tsx 의 trips.length === 0 분기)
 *
 * 데이터만 props 로 받는다. supabase / track() 을 직접 부르지 않는다. (CLAUDE.md 9장)
 */
export function HomeEmpty({
  userName,
  discoveries,
  onCreateTrip,
  onPressOnboarding,
  onPressDiscovery,
  onPressAllDiscoveries,
  onPressNotifications,
  invitePrompt,
  actions,
  onPressAction,
  onLongPressLogo,
}: HomeEmptyProps) {
  const { expanded, onScroll } = useFabExpand();

  return (
    <View className="flex-1 bg-white">
      {/* 기존 홈과 같은 상단바다. 다가오는 여행이 없으므로 남은 일수는 null 이다. */}
      <HomeHeader
        userName={userName}
        daysToNextTrip={null}
        onPressNotifications={onPressNotifications}
        onLongPressLogo={onLongPressLogo}
      />

      {/* 아래 여백은 기존 홈(HomeView)과 같은 값이다. 떠 있는 버튼까지 덮는다. */}
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-40 pt-6"
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {/* 초대받은 사람은 여행이 없는 신규 사용자일 때가 많다. 기존 홈과 같은 자리에 둔다. */}
        <InvitePrompt {...invitePrompt} />
        <HomeActionBanners actions={actions} onPressAction={onPressAction} />

        {/*
          서비스 소개 칸. 신규 사용자 홈에만 둔다 — 이미 여행을 만들어 본 사람에게
          서비스 설명을 반복하지 않는다.
          ⚠️ 2026-09-17 위에 있던 '추천 여행지' 를 빼서 이 칸이 맨 위다.
             초대 배너가 있으면 그 아래(InvitePrompt 가 mb-6 을 준다).
        */}
        <OnboardingEntryCard onPress={onPressOnboarding} />

        {/* 칸 사이 간격은 기존 홈(HomeView)의 mt-7 과 같다. */}
        <View className="mt-7">
          <DiscoverDestinationSection
            destinations={discoveries}
            onPressDestination={onPressDiscovery}
            onPressSeeAll={onPressAllDiscoveries}
          />
        </View>
      </ScrollView>

      {/* 기존 홈(HomeView)과 같은 버튼이다. 맨 위에서는 글자까지, 내리면 아이콘만. */}
      <CreateTripFab expanded={expanded} onPress={onCreateTrip} />
    </View>
  );
}
