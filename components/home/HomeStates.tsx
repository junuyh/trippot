import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { CreateTripCard } from './CreateTripCard';
import { DestinationSuggestSection } from './DestinationSuggestSection';
import { HomeButton } from './HomeButton';
import { HomeHeader } from './HomeHeader';
import type { DestinationSuggestion } from './types';

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
  /** 배너에 돌릴 여행지 후보. 상수 조회는 화면 파일이 하고 결과만 받는다. */
  suggestions: DestinationSuggestion[];
  onCreateTrip: () => void;
};

/**
 * 여행이 하나도 없는 사람의 홈. (2026-09-07 개편)
 *
 * **기존 홈에서 여행 목록 두 개를 빼고 그 자리에 추천 배너를 넣은 것이다.**
 *
 *   기존 홈 (HomeView)              신규 사용자 홈 (여기)
 *   ─────────────────────           ─────────────────────
 *   로고 · 인사말                    로고 · 인사말          ← 같다 (HomeHeader)
 *   준비 중인 여행 슬라이드           여행지 추천 슬라이드    ← 이 자리만 바뀐다
 *   지난 여행 슬라이드               (없음)
 *   새 여행 만들기                   새 여행 만들기         ← 같다 (CreateTripCard)
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
export function HomeEmpty({ userName, suggestions, onCreateTrip }: HomeEmptyProps) {
  return (
    <View className="flex-1 bg-white">
      {/* 기존 홈과 같은 상단바다. 다가오는 여행이 없으므로 남은 일수는 null 이다. */}
      <HomeHeader userName={userName} daysToNextTrip={null} />

      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-28 pt-2">
        <DestinationSuggestSection suggestions={suggestions} onPressSuggestion={onCreateTrip} />

        <View className="mt-7">
          <CreateTripCard onPress={onCreateTrip} />
        </View>
      </ScrollView>
    </View>
  );
}
