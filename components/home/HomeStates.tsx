import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { CreateTripFab } from './CreateTripFab';
import { DestinationSuggestSection } from './DestinationSuggestSection';
import { DiscoverDestinationSection } from './DiscoverDestinationSection';
import { HomeButton } from './HomeButton';
import { HomeHeader } from './HomeHeader';
import { HowItWorksSection } from './HowItWorksSection';
import { InvitePrompt, type InvitePromptProps } from './InvitePrompt';
import type { DestinationSuggestion, DiscoverDestination } from './types';
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
  /** 추천 여행지 카드. 상수 조회는 화면 파일이 하고 결과만 받는다. */
  suggestions: DestinationSuggestion[];
  /** 커뮤니티에 글이 있는 여행지. 없으면 빈 배열이고 그 칸을 그리지 않는다. */
  discoveries: DiscoverDestination[];
  onCreateTrip: () => void;
  /** 추천 여행지 카드를 눌렀을 때. 목적지 코드를 넘긴다. */
  onPressSuggestion: (code: string) => void;
  /** 여행자들은 이렇게 다녀왔어요 태그를 눌렀을 때. 커뮤니티로 보낸다. 한글 도시명을 넘긴다. */
  onPressDiscovery: (nameKo: string) => void;
  /** 상단바 알림 버튼. 받은 알림 목록으로 보낸다. */
  onPressNotifications: () => void;
  /** 답하지 않은 여행 초대. 추천 여행지 위 배너와 모달. (InvitePrompt) */
  invitePrompt: InvitePromptProps;
};

/**
 * 여행이 하나도 없는 사람의 홈. (2026-09-09 개편)
 *
 * **기존 홈의 두 칸을 그대로 쓰고 내용만 바꾼 것이다.**
 *
 *   기존 홈 (HomeView)              신규 사용자 홈 (여기)
 *   ─────────────────────           ─────────────────────
 *   로고 · 인사말                    로고 · 인사말          ← 같다 (HomeHeader)
 *   준비 중인 여행 슬라이드           추천 여행지 슬라이드    ← 같은 보딩패스 카드
 *   지난 여행 태그 목록              여행자들은 이렇게 다녀왔어요 태그 목록  ← 같은 러기지 태그
 *   새 여행 만들기 버튼              새 여행 만들기 버튼      ← 같다 (CreateTripFab)
 *
 * ⚠️ 두 칸 모두 **기존 홈과 같은 부품·같은 치수**다. 첫 여행을 만든 순간
 *    이 화면이 HomeView 로 바뀌는데, 카드가 다르게 생기면 사용자에게는
 *    화면이 통째로 바뀐 것으로 보인다.
 *
 * ⚠️ 두 칸이 하는 말이 다르다.
 *    · 추천 여행지   앞으로 갈 곳 → 누르면 **여행 만들기**
 *    · 여행자들은 이렇게 다녀왔어요 다녀온 사람의 이야기 → 누르면 **커뮤니티 그 여행지 글**
 *    보딩패스와 러기지 태그라는 생김새 차이가 그 말을 대신한다.
 *
 * ⚠️ 2026-09-09 새 여행 만들기를 카드에서 떠 있는 버튼으로 바꿨다.
 *    기존 홈과 같은 컴포넌트·같은 자리·같은 접힘 규칙을 쓴다. 첫 여행을 만든
 *    순간 이 화면이 HomeView 로 바뀌는데, 그때 버튼이 옮겨 다니면 안 된다.
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
  suggestions,
  discoveries,
  onCreateTrip,
  onPressSuggestion,
  onPressDiscovery,
  onPressNotifications,
  invitePrompt,
}: HomeEmptyProps) {
  const { expanded, onScroll } = useFabExpand();

  return (
    <View className="flex-1 bg-white">
      {/* 기존 홈과 같은 상단바다. 다가오는 여행이 없으므로 남은 일수는 null 이다. */}
      <HomeHeader
        userName={userName}
        daysToNextTrip={null}
        onPressNotifications={onPressNotifications}
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

        <DestinationSuggestSection
          suggestions={suggestions}
          onPressSuggestion={onPressSuggestion}
        />

        {/*
          2026-09-16 서비스 소개 칸.

          ⚠️ **추천 여행지 아래, 다녀온 이야기 위**다. 첫 화면은 '어디 가지?' 가
             먼저 잡고, 바로 아래에서 '이 앱이 뭘 해주나' 에 답한다. 맨 위에 두면
             처음 온 사람이 안내문부터 읽어야 한다.

          ⚠️ **신규 사용자 홈에만 둔다.** 기존 홈(HomeView)에는 넣지 않는다 —
             이미 여행을 만들어 본 사람에게 서비스 설명을 반복하지 않는다.
        */}
        <View className="mt-7">
          <HowItWorksSection />
        </View>

        {/* 칸 사이 간격은 기존 홈(HomeView)의 mt-7 과 같다. */}
        <View className="mt-7">
          <DiscoverDestinationSection
            destinations={discoveries}
            onPressDestination={onPressDiscovery}
          />
        </View>
      </ScrollView>

      {/* 맨 위에서는 글자까지 보이고, 내리면 아이콘만 남는다. */}
      <CreateTripFab expanded={expanded} onPress={onCreateTrip} />
    </View>
  );
}
