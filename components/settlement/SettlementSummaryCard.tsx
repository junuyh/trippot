// SETTLE-01 결산 요약 — 목표 vs 실제, 초과/절약 금액과 비율.
//
// 여행이 끝난 뒤 "우리 계획대로 썼나?" 에 답한다.
// 이 화면의 결과가 다음 여행 개인화로 이어진다. (핵심 루프의 마지막 칸)
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

type Props = {
  targetAmount: number;
  actualAmount: number;
  /** basis point 정수. 1250 = 12.50% */
  differenceRateBp: number;
  headcount: number;
};

function won(value: number): string {
  return `${value.toLocaleString('ko-KR')}원`;
}

/** basis point → 화면용 퍼센트 문자열. 소수점 한 자리까지만 보여준다. */
function bpToPercent(bp: number): string {
  return (Math.abs(bp) / 100).toFixed(1);
}

export function SettlementSummaryCard({
  targetAmount,
  actualAmount,
  differenceRateBp,
  headcount,
}: Props) {
  const difference = actualAmount - targetAmount;
  const saved = difference < 0;
  const same = difference === 0;

  return (
    <View className={`gap-4 rounded-2xl p-5 ${saved || same ? 'bg-blue-600' : 'bg-red-500'}`}>
      <View className="flex-row items-center gap-1.5">
        <Ionicons
          name={saved ? 'trending-down-outline' : same ? 'checkmark-circle-outline' : 'trending-up-outline'}
          size={16}
          color="#ffffff"
        />
        <Text className="text-sm font-medium text-white">
          {same ? '계획대로 썼어요' : saved ? '계획보다 아꼈어요' : '계획보다 더 썼어요'}
        </Text>
      </View>

      <View>
        <Text className="text-4xl font-bold text-white">
          {same ? won(0) : `${saved ? '−' : '+'}${Math.abs(difference).toLocaleString('ko-KR')}원`}
        </Text>
        {!same ? (
          <Text className="mt-1 text-sm text-white/80">
            목표 대비 {bpToPercent(differenceRateBp)}% {saved ? '절약' : '초과'}
          </Text>
        ) : null}
      </View>

      <View className="h-px bg-white/20" />

      <View className="flex-row">
        <View className="flex-1 gap-0.5">
          <Text className="text-xs text-white/70">목표 여행비</Text>
          <Text className="text-base font-semibold text-white">{won(targetAmount)}</Text>
        </View>
        <View className="w-px bg-white/20" />
        <View className="flex-1 gap-0.5 pl-4">
          <Text className="text-xs text-white/70">실제 여행비</Text>
          <Text className="text-base font-semibold text-white">{won(actualAmount)}</Text>
        </View>
      </View>

      {headcount > 1 ? (
        <Text className="text-xs text-white/70">
          1인 {won(Math.round(actualAmount / headcount / 1000) * 1000)} 썼어요
        </Text>
      ) : null}
    </View>
  );
}
