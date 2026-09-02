import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { HOME_CREAM, HOME_DANGER } from './palette';
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
 * ⚠️ 여기서 예산을 고치지 않는다. 추천이 사용자 대신 확정하지 않는다.
 *    (CLAUDE.md 3장 — 추천 + 근거 → 사용자 확인 → 사용자 확정)
 */
export function PastTripInsight({ insight, onPress }: Props) {
  return (
    <View className="rounded-3xl px-5 py-5" style={{ backgroundColor: HOME_CREAM }}>
      <Text className="font-black text-pot-ink" style={{ fontSize: 16, letterSpacing: -0.5 }}>
        지난 여행에서 발견했어요
      </Text>

      {insight === null ? (
        <Text className="mt-2.5 text-pot-mute" style={{ fontSize: 13.5, lineHeight: 20 }}>
          여행을 기록할수록 다음 여행 예산이 더 정확해져요.
        </Text>
      ) : (
        <View className="mt-3 flex-row items-center">
          <View className="h-12 w-12 items-center justify-center rounded-2xl bg-white/70">
            <Text style={{ fontSize: 22 }}>{insight.emoji}</Text>
          </View>

          <View className="ml-3 flex-1">
            <Text className="text-pot-mute" style={{ fontSize: 12 }} numberOfLines={1}>
              {insight.destination ?? '지난 여행'}
            </Text>
            <Text
              className="mt-0.5 text-pot-ink"
              style={{ fontSize: 14, lineHeight: 20, letterSpacing: -0.3 }}
            >
              {insight.categoryLabel}를 예상보다{' '}
              <Text className="font-black" style={{ color: HOME_DANGER, ...NUM }}>
                {insight.overAmount.toLocaleString('ko-KR')}원
              </Text>{' '}
              더 썼어요
            </Text>
            <Text className="mt-0.5 text-pot-mute" style={{ fontSize: 12 }}>
              다음 여행 예산에 반영해 보세요!
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${insight.destination ?? '지난 여행'} 결산 자세히 보기`}
            onPress={() => onPress(insight.tripId)}
            className="ml-2 flex-row items-center rounded-full bg-white px-3 py-2.5 active:opacity-70"
          >
            <Text className="font-bold text-pot-ink" style={{ fontSize: 12 }}>
              자세히
            </Text>
            <Ionicons name="chevron-forward" size={12} color="#111827" />
          </Pressable>
        </View>
      )}
    </View>
  );
}
