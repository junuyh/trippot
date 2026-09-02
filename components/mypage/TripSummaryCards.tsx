import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import type { MyTripCounts } from './types';

/**
 * 카드 하나. Figma 는 152×70(≈2.17:1)이라 폭이 달라져도 비율을 유지한다.
 * 라벨은 작고 숫자가 크다 — 시안의 정보 위계를 그대로 따른다.
 */
function CountCard({
  label,
  count,
  onPress,
}: {
  label: string;
  count: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} ${count}건`}
      onPress={onPress}
      className="flex-1 rounded-2xl border border-pot-line bg-white px-3 py-2.5 active:opacity-70"
    >
      <View className="flex-row items-center">
        <Text numberOfLines={1} className="shrink text-xs leading-4 text-pot-mute">
          {label}
        </Text>
        <Ionicons name="chevron-forward" size={13} color="#8B94A2" />
      </View>

      <Text className="mt-1 text-center text-xl font-bold leading-7 text-pot-ink">
        {count}
      </Text>
    </Pressable>
  );
}

type Props = {
  counts: MyTripCounts;
  onPressOngoing: () => void;
  onPressPast: () => void;
};

/**
 * 5-2 내 여행. (docs/09_IA_v1.md §5-2)
 *
 * MY-01 에서는 목록이 아니라 개수 요약만 보여준다.
 * Figma 의 2열 카드 구조를 유지한다. 폭은 px 로 고정하지 않고 flex-1 로 나눈다.
 */
export function TripSummaryCards({ counts, onPressOngoing, onPressPast }: Props) {
  return (
    <View>
      <Text className="text-base font-semibold leading-6 text-pot-ink">내 여행</Text>

      <View className="mt-2.5 flex-row gap-3">
        <CountCard label="진행중인 여행" count={counts.ongoing} onPress={onPressOngoing} />
        <CountCard label="지난 여행" count={counts.past} onPress={onPressPast} />
      </View>
    </View>
  );
}
