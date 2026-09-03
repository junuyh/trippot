import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import type { MyTripCounts } from './types';

const NUM = { fontVariant: ['tabular-nums' as const] };

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
      // py-3 → py-4, 라벨-숫자 간격 6 → 12. 높이 75 → 89 다.
      // 아래에만 빈 자리를 더하지 않고 위·사이·아래가 함께 늘어난다.
      className="flex-1 rounded-2xl bg-white px-3.5 py-4 active:opacity-70"
      style={{
        shadowColor: '#111827',
        shadowOpacity: 0.05,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
      }}
    >
      <View className="flex-row items-center">
        <Text numberOfLines={1} className="shrink text-pot-mute" style={{ fontSize: 12.5, lineHeight: 17 }}>
          {label}
        </Text>
        <Ionicons name="chevron-forward" size={13} color="#8B94A2" />
      </View>

      <Text className="mt-3 text-center font-black text-pot-ink" style={{ fontSize: 22, lineHeight: 28, ...NUM }}>
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
      {/* 홈 SectionHeader 와 같은 단. (16 / 800 / -0.5) */}
      <Text
        className="text-pot-ink"
        style={{ fontSize: 16, lineHeight: 21, fontWeight: '800', letterSpacing: -0.5 }}
      >
        내 여행
      </Text>

      {/* ⚠️ 카드 폭을 px 로 정하지 않는다. flex-1 이라 gap 을 한 단계 올리면
          두 카드가 2씩 줄면서 가운데가 4 벌어진다. 폭은 늘 같고 섹션 전체
          너비와 화면 padding 은 그대로다. */}
      <View className="mt-2.5 flex-row gap-4">
        <CountCard label="진행중인 여행" count={counts.ongoing} onPress={onPressOngoing} />
        <CountCard label="지난 여행" count={counts.past} onPress={onPressPast} />
      </View>
    </View>
  );
}
