// BUDGET-02 카테고리 요약.
//
// 설정 예산 / 준비 금액 / 실제 사용 / 남은 예산 + 준비율·사용률 (REQ-BUDGET-004)
//
// ⚠️ 설정 예산(planned_amount)은 사용자가 여기서 고칠 수 있다.
//    고치면 applied_source 가 'user' 가 되고 recommended_amount 는 그대로 둔다.
//    추천 원본이 사라지면 "사용자가 자주 고치는 카테고리" 를 영원히 못 잰다.
//    (CLAUDE.md 4장)
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { Button, CurrencyInput } from '@/components/ui';
import { preparationRate, usageRate } from '@/lib/budget/vault';

type Props = {
  plannedAmount: number;
  preparedAmount: number;
  actualAmount: number;
  recommendedAmount: number;

  editing: boolean;
  draftAmount: number | null;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onChangeDraft: (value: number | null) => void;
  onSave: () => void;
  saving: boolean;
};

function won(value: number): string {
  return `${value.toLocaleString('ko-KR')}원`;
}

export function CategoryOverviewCard({
  plannedAmount,
  preparedAmount,
  actualAmount,
  recommendedAmount,
  editing,
  draftAmount,
  onStartEdit,
  onCancelEdit,
  onChangeDraft,
  onSave,
  saving,
}: Props) {
  const prep = preparationRate(preparedAmount, plannedAmount);
  const usage = usageRate(actualAmount, plannedAmount);
  const remaining = plannedAmount - actualAmount;
  const over = remaining < 0;

  return (
    <View className="gap-4 rounded-2xl border border-gray-200 bg-white p-5">
      <View className="flex-row items-start justify-between">
        <View>
          <Text className="text-xs text-gray-500">설정 예산</Text>
          {editing ? null : (
            <Text className="mt-0.5 text-3xl font-bold text-gray-900">{won(plannedAmount)}</Text>
          )}
        </View>
        {editing ? null : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="예산 수정"
            onPress={onStartEdit}
            className="flex-row items-center gap-1 rounded-lg px-2 py-1 active:bg-gray-100"
          >
            <Ionicons name="pencil" size={13} color="#6b7280" />
            <Text className="text-sm text-gray-600">수정</Text>
          </Pressable>
        )}
      </View>

      {editing ? (
        <View className="gap-3">
          <CurrencyInput value={draftAmount} onChangeValue={onChangeDraft} editable={!saving} />
          <Text className="text-xs text-gray-400">
            추천 금액은 {won(recommendedAmount)} 이에요.
          </Text>
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Button label="취소" variant="secondary" onPress={onCancelEdit} disabled={saving} />
            </View>
            <View className="flex-1">
              <Button label="저장" onPress={onSave} loading={saving} />
            </View>
          </View>
        </View>
      ) : (
        <>
          {/* 준비(연한) 위에 사용(진한)을 겹친다. BUDGET-01 과 같은 방식 */}
          <View className="h-2 overflow-hidden rounded-full bg-gray-100">
            <View
              className="absolute h-full rounded-full bg-blue-200"
              style={{ width: `${prep}%` }}
            />
            <View
              className={`absolute h-full rounded-full ${over ? 'bg-red-500' : 'bg-blue-600'}`}
              style={{ width: `${Math.min(100, usage)}%` }}
            />
          </View>

          <View className="flex-row items-center justify-between">
            <View className="flex-row gap-3">
              <Text className="text-xs text-gray-500">
                준비 <Text className="font-medium text-blue-600">{prep}%</Text>
              </Text>
              <Text className="text-xs text-gray-500">
                사용{' '}
                <Text className={`font-medium ${over ? 'text-red-500' : 'text-gray-700'}`}>
                  {usage}%
                </Text>
              </Text>
            </View>
            <Text className={`text-xs ${over ? 'text-red-500' : 'text-gray-400'}`}>
              {over ? `${won(-remaining)} 초과` : `${won(remaining)} 남음`}
            </Text>
          </View>

          <View className="h-px bg-gray-100" />

          <View className="flex-row">
            <View className="flex-1 gap-0.5">
              <Text className="text-xs text-gray-500">금고 배분</Text>
              <Text className="text-base font-semibold text-gray-900">{won(preparedAmount)}</Text>
            </View>
            <View className="w-px bg-gray-100" />
            <View className="flex-1 gap-0.5 pl-4">
              <Text className="text-xs text-gray-500">실제 사용</Text>
              <Text className="text-base font-semibold text-gray-900">{won(actualAmount)}</Text>
            </View>
          </View>
        </>
      )}
    </View>
  );
}
