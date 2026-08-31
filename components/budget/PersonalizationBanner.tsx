// BUDGET-01 개인화 제안 배너.
//
// ⚠️ 추천이 사용자 대신 확정하지 않는다. (CLAUDE.md 4장)
//      추천 + **근거 제시** → 사용자 확인/수정 → 사용자 최종 확정
//
//    그래서 이 배너는 세 가지를 반드시 같이 보여준다.
//      ① 무엇을 근거로 하는가 — "지난 여행 2건"
//      ② 무엇이 어떻게 달라지는가 — "식비 880,000 → 1,054,000"
//      ③ 거절할 수단 — "이번엔 괜찮아요"
//
//    근거 없이 금액만 바꾸자고 하면 사용자는 판단할 방법이 없다.
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { CATEGORY_CODE_LABEL, type CategoryCode } from '@/lib/constants/status';

export type PersonalizationItem = {
  categoryId: string;
  categoryCode: CategoryCode;
  /** 기본 추천 원본 */
  recommendedAmount: number;
  /** 개인화 추천 */
  personalizedAmount: number;
  /** 과거 편차. basis point 정수 (1250 = +12.5%) */
  deviationBp: number;
  /** 상한(±50%)에 걸려 잘렸는가 */
  clamped: boolean;
};

type Props = {
  basedOnTripCount: number;
  items: PersonalizationItem[];
  expanded: boolean;
  onToggle: () => void;
  onApply: () => void;
  onDismiss: () => void;
  applying: boolean;
};

function won(value: number): string {
  return `${value.toLocaleString('ko-KR')}원`;
}

function percent(bp: number): string {
  return `${bp > 0 ? '+' : ''}${(bp / 100).toFixed(0)}%`;
}

export function PersonalizationBanner({
  basedOnTripCount,
  items,
  expanded,
  onToggle,
  onApply,
  onDismiss,
  applying,
}: Props) {
  if (items.length === 0) return null;

  // 가장 크게 벗어난 항목을 대표로 보여준다. 목록은 펼쳐야 나온다.
  const top = items[0];

  return (
    <View className="gap-3 rounded-2xl bg-white p-4">
      <View className="flex-row items-start gap-2">
        <Text className="text-base">💡</Text>
        <View className="flex-1">
          <Text className="text-[15px] font-semibold leading-5 text-gray-900">
            지난 여행 {basedOnTripCount}건을 보니{'\n'}
            {CATEGORY_CODE_LABEL[top.categoryCode]}를 {percent(top.deviationBp)} 쓰셨어요
          </Text>
          <Text className="mt-1 text-xs text-gray-500">
            그때 쓴 만큼으로 이번 예산을 다시 잡아드릴까요?
          </Text>
        </View>
      </View>

      {/* ── 무엇이 어떻게 달라지는가 ── */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="개인화 추천 항목 자세히 보기"
        accessibilityState={{ expanded }}
        onPress={onToggle}
        className="gap-2 rounded-xl bg-gray-50 px-3 py-2.5 active:bg-gray-100"
      >
        {(expanded ? items : items.slice(0, 1)).map((item) => {
          const diff = item.personalizedAmount - item.recommendedAmount;
          return (
            <View key={item.categoryId} className="flex-row items-center justify-between">
              <Text className="text-[13px] text-gray-700">
                {CATEGORY_CODE_LABEL[item.categoryCode]}
              </Text>
              <View className="flex-row items-center gap-1.5">
                <Text className="text-[13px] text-gray-400 line-through">
                  {won(item.recommendedAmount)}
                </Text>
                <Ionicons name="arrow-forward" size={11} color="#9ca3af" />
                <Text className="text-[13px] font-semibold text-gray-900">
                  {won(item.personalizedAmount)}
                </Text>
                <Text
                  className={`text-[11px] font-medium ${
                    diff > 0 ? 'text-pot-coral' : 'text-gray-500'
                  }`}
                >
                  {diff > 0 ? '+' : ''}
                  {Math.round(diff / 1000).toLocaleString('ko-KR')}천
                </Text>
              </View>
            </View>
          );
        })}

        {items.length > 1 ? (
          <View className="flex-row items-center gap-0.5">
            <Text className="text-[11px] text-gray-400">
              {expanded ? '접기' : `외 ${items.length - 1}개 더 보기`}
            </Text>
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={11}
              color="#9ca3af"
            />
          </View>
        ) : null}
      </Pressable>

      {/* 상한에 걸린 항목이 있으면 알린다. 왜 편차만큼 안 올렸는지 설명이 필요하다 */}
      {items.some((item) => item.clamped) ? (
        <Text className="text-[11px] leading-4 text-gray-400">
          한 번의 예외가 예산을 흔들지 않도록 조정 폭은 50%까지만 반영했어요.
        </Text>
      ) : null}

      <View className="flex-row gap-2">
        <View className="flex-1">
          <Button
            label="이번엔 괜찮아요"
            variant="secondary"
            onPress={onDismiss}
            disabled={applying}
          />
        </View>
        <View className="flex-1">
          <Button label="반영하기" onPress={onApply} loading={applying} />
        </View>
      </View>
    </View>
  );
}
