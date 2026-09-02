import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { SectionHeader } from './SectionHeader';
import type { HomePastInsightData } from './types';

type Props = {
  /** 확정된 결산이 없으면 null. 빈 상태를 보여준다. */
  insight: HomePastInsightData | null;
  onPress: (tripId: string) => void;
};

const NUM = { fontVariant: ['tabular-nums' as const] };

/**
 * 지난 여행 인사이트.
 *
 * "실제 소비 → 다음 여행 예산" 이 TripPot 의 핵심 루프다. (CLAUDE.md 2장)
 * 그 연결이 홈에서 보이도록 지난 결산에서 계획과 가장 크게 벌어진
 * 카테고리 하나만 문장으로 보여준다.
 *
 * 주의: 여기서 예산을 고치지 않는다. 추천이 사용자 대신 확정하지 않는다.
 *       (CLAUDE.md 3장 — 추천 + 근거 → 사용자 확인 → 사용자 확정)
 */
export function PastTripInsight({ insight, onPress }: Props) {
  return (
    <View>
      <SectionHeader title="지난 여행에서 발견했어요" />

      {insight === null ? (
        <View className="rounded-2xl border border-pot-line bg-white px-4 py-5">
          <Text className="text-center text-pot-mute" style={{ fontSize: 13, lineHeight: 20 }}>
            여행을 기록할수록{'\n'}다음 여행 예산이 더 정확해져요.
          </Text>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${insight.destination ?? '지난 여행'} 결산 자세히 보기`}
          onPress={() => onPress(insight.tripId)}
          className="rounded-2xl border border-pot-line bg-white px-5 py-5 active:opacity-80"
        >
          <View className="flex-row items-center">
            <Text style={{ fontSize: 16 }}>{insight.emoji}</Text>
            <Text className="ml-2 font-bold text-pot-ink" style={{ fontSize: 13.5 }}>
              {insight.destination ?? '지난 여행'}
            </Text>
          </View>

          <Text
            className="mt-2 text-pot-ink"
            style={{ fontSize: 15, lineHeight: 23, letterSpacing: -0.3 }}
          >
            {insight.categoryLabel}를 예상보다{' '}
            <Text className="font-black" style={NUM}>
              {insight.overAmount.toLocaleString('ko-KR')}원
            </Text>{' '}
            더 사용했어요.
          </Text>

          <Text className="mt-1 text-pot-mute" style={{ fontSize: 12.5, lineHeight: 18 }}>
            다음 여행 예산에 반영해 보세요.
          </Text>

          <View className="mt-3 flex-row items-center">
            <Text className="font-bold text-pot-ink" style={{ fontSize: 13 }}>
              자세히 보기
            </Text>
            <Ionicons name="chevron-forward" size={13} color="#111827" />
          </View>
        </Pressable>
      )}
    </View>
  );
}
