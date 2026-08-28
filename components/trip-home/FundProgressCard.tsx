// TRIP-HOME 여행자금 준비 현황.
//
// 목표 여행비 · 현재 여행자금 · 준비율 · 부족금액. (docs/09 §2-2)
//
// ⚠️ 현재 여행자금은 항상 **단일 소스** 기준이다.
//    직접입력 금액과 계좌 잔액을 합산하지 않는다. (CLAUDE.md 3장)
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { Button } from '@/components/ui';

import { FUND_SOURCE_TYPE, FUND_SOURCE_TYPE_LABEL, type FundSourceType } from '@/lib/constants/status';

type Props = {
  targetAmount: number;
  currentAmount: number;
  headcount: number;
  fundSourceType: FundSourceType;
  /** 계좌 연결 사용자일 때만. 마스킹된 값만 받는다 (NFR-002) */
  maskedAccountNumber: string | null;
  /** 남은 일수. 없으면 '하루 얼마' 안내를 그리지 않는다 */
  daysLeft: number | null;
  /** 목표 예산을 정하러 가는 콜백. 미확정일 때만 쓴다 */
  onSetBudget: () => void;
};

function won(value: number): string {
  return `${value.toLocaleString('ko-KR')}원`;
}

export function FundProgressCard({
  targetAmount,
  currentAmount,
  headcount,
  fundSourceType,
  maskedAccountNumber,
  daysLeft,
  onSetBudget,
}: Props) {
  // ⚠️ 목표가 0이면 준비율도 부족금액도 의미가 없다.
  //    예산을 아직 확정하지 않은 여행이 그렇다 (trip_budgets.confirmed_at is null).
  //    그대로 계산하면 부족금액이 0이 되어 "목표를 채웠어요" 가 뜬다.
  //    자금이 얼마든 목표가 없으면 채운 것이 아니다. 아예 다른 화면을 보여준다.
  const budgetUnset = targetAmount <= 0;

  const rate = targetAmount > 0 ? Math.min(100, Math.round((currentAmount / targetAmount) * 100)) : 0;
  const shortage = Math.max(0, targetAmount - currentAmount);

  // 남은 기간 동안 하루 얼마씩 모으면 되는지. 1,000원 단위로 올림해 보여준다.
  const perDay =
    daysLeft && daysLeft > 0 && shortage > 0
      ? Math.ceil(shortage / daysLeft / 1000) * 1000
      : null;

  if (budgetUnset) {
    return (
      <View className="gap-4 rounded-2xl border border-gray-200 bg-white p-5">
        <View>
          <Text className="text-xs text-gray-500">현재 여행자금</Text>
          <Text className="mt-0.5 text-2xl font-bold text-gray-900">{won(currentAmount)}</Text>
        </View>

        <View className="flex-row items-start gap-1.5 rounded-xl bg-amber-50 px-3 py-2.5">
          <Ionicons name="information-circle-outline" size={16} color="#d97706" />
          <Text className="flex-1 text-xs leading-4 text-amber-700">
            아직 목표 여행비를 정하지 않았어요. 목표가 있어야 준비율을 볼 수 있어요.
          </Text>
        </View>

        <Button label="목표 예산 정하기" variant="secondary" onPress={onSetBudget} />
      </View>
    );
  }

  return (
    <View className="gap-4 rounded-2xl border border-gray-200 bg-white p-5">
      <View className="flex-row items-end justify-between">
        <View>
          <Text className="text-xs text-gray-500">현재 여행자금</Text>
          <Text className="mt-0.5 text-2xl font-bold text-gray-900">{won(currentAmount)}</Text>
        </View>
        <Text className="text-sm text-gray-500">목표 {won(targetAmount)}</Text>
      </View>

      {/* 준비율 */}
      <View className="gap-1.5">
        <View className="h-2 overflow-hidden rounded-full bg-gray-100">
          <View className="h-full rounded-full bg-blue-600" style={{ width: `${rate}%` }} />
        </View>
        <View className="flex-row items-center justify-between">
          <Text className="text-xs font-semibold text-blue-700">준비율 {rate}%</Text>
          {shortage > 0 ? (
            <Text className="text-xs text-gray-500">{won(shortage)} 남음</Text>
          ) : (
            <Text className="text-xs font-medium text-blue-600">목표를 채웠어요</Text>
          )}
        </View>
      </View>

      {perDay ? (
        <Text className="text-xs text-gray-500">
          출발까지 {daysLeft}일 · 하루 {won(perDay)}씩 모으면 목표에 닿아요.
        </Text>
      ) : null}

      <View className="h-px bg-gray-100" />

      {/* 자금 출처 — 단일 소스 */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-1.5">
          <Ionicons
            name={
              fundSourceType === FUND_SOURCE_TYPE.MANUAL
                ? 'create-outline'
                : fundSourceType === FUND_SOURCE_TYPE.ZERO
                  ? 'flag-outline'
                  : 'card-outline'
            }
            size={15}
            color="#6b7280"
          />
          <Text className="text-sm text-gray-600">
            {FUND_SOURCE_TYPE_LABEL[fundSourceType]}
          </Text>
        </View>
        {maskedAccountNumber ? (
          <Text className="text-sm text-gray-500">{maskedAccountNumber}</Text>
        ) : (
          <Text className="text-sm text-gray-400">
            1인 {won(headcount > 0 ? Math.round(targetAmount / headcount / 1000) * 1000 : 0)}
          </Text>
        )}
      </View>
    </View>
  );
}
