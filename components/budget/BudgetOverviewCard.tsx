// BUDGET-01 전체 예산 현황.
//
// 목표 여행비 · 현재 준비된 여행자금 · 실제 사용금액 · 남은 예산 · 사용률
// (docs/09 §2-3)
//
// "이번 여행에서 어디에 얼마를 쓸 계획이지?" 에 답하는 화면의 머리다.
import { Text, View } from 'react-native';

type Props = {
  targetAmount: number;
  preparedAmount: number;
  actualAmount: number;
};

function won(value: number): string {
  return `${value.toLocaleString('ko-KR')}원`;
}

export function BudgetOverviewCard({ targetAmount, preparedAmount, actualAmount }: Props) {
  // 남은 예산은 계획 대비다. 준비된 자금 대비가 아니다.
  // 사용자가 묻는 건 "계획한 것 중 얼마 남았나" 이다.
  const remaining = targetAmount - actualAmount;
  const usage = targetAmount > 0 ? Math.round((actualAmount / targetAmount) * 100) : 0;
  const over = remaining < 0;

  return (
    <View className="gap-4 rounded-2xl border border-gray-200 bg-white p-5">
      <View>
        <Text className="text-xs text-gray-500">목표 여행비</Text>
        <Text className="mt-0.5 text-3xl font-bold text-gray-900">{won(targetAmount)}</Text>
      </View>

      {/* 사용률 */}
      <View className="gap-1.5">
        <View className="h-2 overflow-hidden rounded-full bg-gray-100">
          <View
            className={`h-full rounded-full ${over ? 'bg-red-500' : 'bg-blue-600'}`}
            style={{ width: `${Math.min(100, usage)}%` }}
          />
        </View>
        <View className="flex-row items-center justify-between">
          <Text className={`text-xs font-semibold ${over ? 'text-red-500' : 'text-blue-700'}`}>
            사용률 {usage}%
          </Text>
          <Text className={`text-xs ${over ? 'text-red-500' : 'text-gray-500'}`}>
            {over ? `${won(-remaining)} 초과` : `${won(remaining)} 남음`}
          </Text>
        </View>
      </View>

      <View className="h-px bg-gray-100" />

      <View className="flex-row">
        <View className="flex-1 gap-0.5">
          <Text className="text-xs text-gray-500">준비된 자금</Text>
          <Text className="text-base font-semibold text-gray-900">{won(preparedAmount)}</Text>
        </View>
        <View className="w-px bg-gray-100" />
        <View className="flex-1 gap-0.5 pl-4">
          <Text className="text-xs text-gray-500">실제 사용</Text>
          <Text className="text-base font-semibold text-gray-900">{won(actualAmount)}</Text>
        </View>
      </View>
    </View>
  );
}
