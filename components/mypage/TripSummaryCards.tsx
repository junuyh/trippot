import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { TRIP_STATUS_LABEL } from '@/lib/constants/status';

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
      className="flex-1 rounded-2xl bg-white px-3 py-4 active:opacity-70"
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
        {/* chevron 색은 마이페이지 MenuRow · 개인 여행 상세와 같은 #C3C9D2 다. */}
        <Ionicons name="chevron-forward" size={13} color="#C3C9D2" />
      </View>

      {/* 숫자는 라벨과 같은 왼쪽 선에 둔다. 라벨은 왼쪽인데 숫자만 가운데면
          카드마다 시작점이 둘로 갈려 읽는 눈이 흔들렸다. (2026-09-13) */}
      <Text className="mt-2.5 font-black text-pot-ink" style={{ fontSize: 22, lineHeight: 28, ...NUM }}>
        {count}
      </Text>
    </Pressable>
  );
}

type Props = {
  counts: MyTripCounts;
  onPressPlanning: () => void;
  onPressTraveling: () => void;
  onPressPast: () => void;
};

/**
 * 5-2 내 여행. (docs/09_IA_v1.md §5-2)
 *
 * MY-01 에서는 목록이 아니라 개수 요약만 보여준다.
 * Figma 의 2열 카드 구조를 유지한다. 폭은 px 로 고정하지 않고 flex-1 로 나눈다.
 */
export function TripSummaryCards({
  counts,
  onPressPlanning,
  onPressTraveling,
  onPressPast,
}: Props) {
  return (
    <View>
      {/* 홈 SectionHeader 와 같은 단. (16 / 800 / -0.5) */}
      <Text
        className="text-pot-ink"
        style={{ fontSize: 16, lineHeight: 21, fontWeight: '800', letterSpacing: -0.5 }}
      >
        내 여행
      </Text>

      {/* ⚠️ 카드 폭을 px 로 정하지 않는다. flex-1 이라 셋이 같은 폭으로 나뉜다.
          두 개일 때 gap-4 였는데 셋이 되면서 폭이 좁아져 gap-2.5 로 줄였다.
          섹션 전체 너비와 화면 padding 은 그대로다.

          ⚠️ 라벨은 TRIP_STATUS_LABEL 을 쓴다. /me/trips 탭이 쓰는 것과 같은
             상수라 카드와 탭의 이름이 갈라지지 않는다. */}
      <View className="mt-2.5 flex-row gap-2.5">
        <CountCard
          label={TRIP_STATUS_LABEL.PLANNING}
          count={counts.planning}
          onPress={onPressPlanning}
        />
        <CountCard
          label={TRIP_STATUS_LABEL.TRAVELING}
          count={counts.traveling}
          onPress={onPressTraveling}
        />
        <CountCard label="지난 여행" count={counts.past} onPress={onPressPast} />
      </View>
    </View>
  );
}
