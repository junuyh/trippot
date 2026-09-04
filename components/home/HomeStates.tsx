import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Text, View } from 'react-native';

import { HomeButton } from './HomeButton';

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

/**
 * 여행도 모임도 없을 때의 전체 빈 화면.
 *
 * 이 화면은 여행이 하나도 없을 때만 나온다. 그래서 항상 "최초" 문구다.
 * 지난 여행이 있는데 진행 중인 것만 없는 경우는 본문을 그리고,
 * HomeView 의 진행 중 섹션이 "재방문" 문구를 쓴다. (docs/03 REQ-HOME-002)
 */
export function HomeEmpty({ onCreateTrip }: { onCreateTrip: () => void }) {
  return (
    <Shell>
      <Ionicons name="airplane-outline" size={40} color="#8C8A85" />
      <Text className="mt-4 text-center text-base font-bold text-pot-ink">
        첫 여행을 만들어보세요
      </Text>
      <Text className="mt-1.5 text-center text-sm leading-5 text-pot-mute">
        여행에 쓸 돈을 미리 계획하고{'\n'}얼마나 모았는지 확인할 수 있어요.
      </Text>
      <View className="mt-7 w-full max-w-xs">
        <HomeButton label="여행 만들기" onPress={onCreateTrip} />
      </View>
    </Shell>
  );
}
