import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { TRIP_STATUS_LABEL } from '@/lib/constants/status';

import { PASSPORT } from './passport';
import type { MyTripCounts } from './types';

const NUM = { fontVariant: ['tabular-nums' as const] };

/**
 * 한 칸. 작은 라벨 아래 큰 숫자. 여권 내지의 통계 칸이다.
 *
 * ⚠️ 흰 카드가 아니다. 셋이 한 패널 안에 나란히 놓이고 사이에 얇은 세로선만 있다.
 * 라벨 오른쪽에 chevron 을 둔다. 칸 전체가 눌리고, 누르면 그 탭의 목록으로 간다.
 *    chevron 은 라벨보다 옅은 hint 색이라 "눌린다" 만 알리고 튀지 않는다. (2026-09-13)
 */
function CountColumn({
  label,
  count,
  onPress,
  divider,
}: {
  label: string;
  count: number;
  onPress: () => void;
  /** 왼쪽에 세로 구분선을 그릴지. 첫 칸은 없다. */
  divider: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} ${count}건`}
      onPress={onPress}
      // 라벨 · 숫자 모두 칸 가운데. (2026-09-13) 왼쪽 정렬이면 세로선과 붙어 보였다.
      className="flex-1 items-center py-1.5 active:opacity-60"
      style={divider ? { borderLeftWidth: 1, borderLeftColor: PASSPORT.rule } : undefined}
    >
      <View className="flex-row items-center">
        <Text numberOfLines={1} className="shrink" style={{ fontSize: 12, lineHeight: 16, color: PASSPORT.label }}>
          {label}
        </Text>
        <Ionicons name="chevron-forward" size={12} color={PASSPORT.hint} />
      </View>
      <Text
        className="mt-1.5 text-center font-black"
        style={{ fontSize: 30, lineHeight: 36, letterSpacing: -0.6, color: PASSPORT.accent, ...NUM }}
      >
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
 * 5-2 내 여행 — 여권 내지의 아랫칸. (docs/09_IA_v1.md §5-2 · 2026-09-13)
 *
 * MY-01 에서는 목록이 아니라 개수 요약만 보여준다. 세 칸이 같은 폭으로 나뉜다.
 * 전에는 흰 카드 셋이었는데, 여권 한 장 안에서는 카드가 떠 있으면 안 돼서
 * 라벨·숫자만 남겼다. 누르면 가는 곳은 그대로다. (/me/trips?filter=…)
 *
 * ⚠️ 라벨은 TRIP_STATUS_LABEL 을 쓴다. /me/trips 탭이 쓰는 것과 같은 상수라
 *    칸과 탭의 이름이 갈라지지 않는다.
 */
export function TripSummaryCards({
  counts,
  onPressPlanning,
  onPressTraveling,
  onPressPast,
}: Props) {
  return (
    <View>
      <Text
        style={{ fontSize: 9.5, lineHeight: 13, letterSpacing: 0.8, fontWeight: '600', color: PASSPORT.label }}
      >
        TRAVEL SUMMARY
      </Text>
      {/* 홈 SectionHeader 와 같은 단(16 / 800 / -0.5). 색만 여권 잉크다. */}
      <Text
        className="mt-0.5"
        style={{ fontSize: 16, lineHeight: 21, fontWeight: '800', letterSpacing: -0.5, color: PASSPORT.ink }}
      >
        내 여행
      </Text>

      <View className="mt-3.5 flex-row">
        <CountColumn
          label={TRIP_STATUS_LABEL.PLANNING}
          count={counts.planning}
          onPress={onPressPlanning}
          divider={false}
        />
        <CountColumn
          label={TRIP_STATUS_LABEL.TRAVELING}
          count={counts.traveling}
          onPress={onPressTraveling}
          divider
        />
        <CountColumn label="지난 여행" count={counts.past} onPress={onPressPast} divider />
      </View>
    </View>
  );
}
