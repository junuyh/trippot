// 여행 생성 3단계 진행 표시.
//
// components/ui/ 가 아니라 여기 있는 이유: 생성 흐름(TRIP-01~03) 전용이다.
// 다른 화면에서 쓸 일이 생기면 그때 ui/ 로 옮긴다. (CLAUDE.md 9장)
import { Text, View } from 'react-native';

export const TRIP_CREATE_STEPS = ['누구와', '기본정보', '예산·자금'] as const;

type Props = {
  /** 1부터 시작한다. TRIP-01 이면 1. */
  current: number;
};

export function StepProgress({ current }: Props) {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={`${TRIP_CREATE_STEPS.length}단계 중 ${current}단계`}>
      <View className="flex-row gap-1.5">
        {TRIP_CREATE_STEPS.map((label, index) => {
          const step = index + 1;
          const done = step <= current;
          return (
            <View key={label} className="flex-1">
              <View className={`h-1 rounded-full ${done ? 'bg-brand' : 'bg-gray-200'}`} />
            </View>
          );
        })}
      </View>

      <Text className="mt-2 text-xs font-medium text-gray-500">
        {current}/{TRIP_CREATE_STEPS.length} · {TRIP_CREATE_STEPS[current - 1]}
      </Text>
    </View>
  );
}
