// BUDGET-02 세부 계획 항목 — 추가 / 수정 / 삭제.
//
// ⚠️ 관광지 추천 목록이 아니다. **이번 여행에서 돈을 쓸 계획 항목**이다. (docs/09 §2-3)
//    '스시로 시부야 70,000원' 처럼 사용자가 직접 적는다.
//    TRIP-03 의 추천 근거가 "이 금액이 어디서 나왔나" 라면,
//    여기는 "그 돈을 실제로 어디에 쓸 건가" 다.
//
// ⚠️ 실제금액(actual_amount)은 여기서 입력하지 않는다.
//    연결된 거래(transactions)의 합이라 사람이 적는 값이 아니다.
//    표시만 한다.
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { Button, CurrencyInput, Input } from '@/components/ui';
import {
  BUDGET_PLAN_ITEM_STATUS,
  BUDGET_PLAN_ITEM_STATUS_LABEL,
  type BudgetPlanItemStatus,
} from '@/lib/constants/status';

export type PlanItem = {
  id: string;
  name: string;
  expectedAmount: number;
  actualAmount: number;
  status: BudgetPlanItemStatus;
};

/** 추가·수정 중인 입력값. id 가 null 이면 새 항목이다. */
export type PlanItemDraft = {
  id: string | null;
  name: string;
  expectedAmount: number | null;
};

type Props = {
  items: PlanItem[];
  draft: PlanItemDraft | null;
  nameError: string | null;
  saving: boolean;
  deletingId: string | null;

  onStartAdd: () => void;
  onStartEdit: (item: PlanItem) => void;
  onChangeDraft: (draft: PlanItemDraft) => void;
  onCancel: () => void;
  onSave: () => void;
  onDelete: (itemId: string) => void;
};

function won(value: number): string {
  return `${value.toLocaleString('ko-KR')}원`;
}

export function PlanItemList({
  items,
  draft,
  nameError,
  saving,
  deletingId,
  onStartAdd,
  onStartEdit,
  onChangeDraft,
  onCancel,
  onSave,
  onDelete,
}: Props) {
  const addingNew = draft !== null && draft.id === null;

  return (
    <View className="gap-2.5">
      {items.length > 0 || addingNew ? (
        <View className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          {items.map((item, index) => {
            const editing = draft?.id === item.id;
            const done = item.status === BUDGET_PLAN_ITEM_STATUS.DONE;
            const diff = item.actualAmount - item.expectedAmount;

            return (
              <View
                key={item.id}
                className={index > 0 ? 'border-t border-gray-100' : undefined}
              >
                {editing ? (
                  <View className="gap-3 bg-blue-50 p-4">
                    <Input
                      label="항목 이름"
                      required
                      value={draft.name}
                      onChangeText={(name) => onChangeDraft({ ...draft, name })}
                      placeholder="예: 스시로 시부야"
                      error={nameError}
                      editable={!saving}
                      maxLength={30}
                    />
                    <CurrencyInput
                      label="예상 금액"
                      value={draft.expectedAmount}
                      onChangeValue={(expectedAmount) =>
                        onChangeDraft({ ...draft, expectedAmount })
                      }
                      editable={!saving}
                    />
                    <View className="flex-row gap-2">
                      <Button
                        label="삭제"
                        variant="danger"
                        fullWidth={false}
                        onPress={() => onDelete(item.id)}
                        loading={deletingId === item.id}
                        disabled={saving}
                      />
                      <View className="flex-1" />
                      <Button
                        label="취소"
                        variant="secondary"
                        fullWidth={false}
                        onPress={onCancel}
                        disabled={saving}
                      />
                      <Button label="저장" fullWidth={false} onPress={onSave} loading={saving} />
                    </View>
                  </View>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${item.name} 수정`}
                    onPress={() => onStartEdit(item)}
                    className="flex-row items-center justify-between px-4 py-3.5 active:bg-gray-50"
                  >
                    <View className="flex-1 pr-3">
                      <View className="flex-row items-center gap-1.5">
                        <Text className="text-base text-gray-800">{item.name}</Text>
                        {done ? (
                          <View className="rounded-full bg-gray-100 px-1.5 py-0.5">
                            <Text className="text-[10px] font-medium text-gray-600">
                              {BUDGET_PLAN_ITEM_STATUS_LABEL[item.status]}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      {item.actualAmount > 0 ? (
                        <Text className="mt-0.5 text-xs text-gray-400">
                          실제 {won(item.actualAmount)}
                          {diff !== 0 ? (
                            <Text className={diff > 0 ? 'text-red-500' : 'text-blue-600'}>
                              {' '}
                              ({diff > 0 ? '+' : ''}
                              {diff.toLocaleString('ko-KR')})
                            </Text>
                          ) : null}
                        </Text>
                      ) : null}
                    </View>

                    <View className="flex-row items-center gap-1">
                      <Text className="text-base font-medium text-gray-900">
                        {won(item.expectedAmount)}
                      </Text>
                      <Ionicons name="chevron-forward" size={15} color="#d1d5db" />
                    </View>
                  </Pressable>
                )}
              </View>
            );
          })}

          {/* 새 항목 */}
          {addingNew ? (
            <View
              className={`gap-3 bg-blue-50 p-4 ${items.length > 0 ? 'border-t border-gray-100' : ''}`}
            >
              <Input
                label="항목 이름"
                required
                value={draft.name}
                onChangeText={(name) => onChangeDraft({ ...draft, name })}
                placeholder="예: 스시로 시부야"
                error={nameError}
                editable={!saving}
                maxLength={30}
                autoFocus
              />
              <CurrencyInput
                label="예상 금액"
                value={draft.expectedAmount}
                onChangeValue={(expectedAmount) => onChangeDraft({ ...draft, expectedAmount })}
                editable={!saving}
              />
              <View className="flex-row gap-2">
                <View className="flex-1">
                  <Button
                    label="취소"
                    variant="secondary"
                    onPress={onCancel}
                    disabled={saving}
                  />
                </View>
                <View className="flex-1">
                  <Button label="추가" onPress={onSave} loading={saving} />
                </View>
              </View>
            </View>
          ) : null}
        </View>
      ) : (
        <View className="items-center gap-1 rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-8">
          <Text className="text-sm text-gray-500">아직 계획한 항목이 없어요.</Text>
          <Text className="text-xs text-gray-400">
            이 카테고리에서 돈을 쓸 곳을 적어두면 예산이 구체적이 돼요.
          </Text>
        </View>
      )}

      {draft === null ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="계획 항목 추가"
          onPress={onStartAdd}
          className="flex-row items-center justify-center gap-1.5 rounded-xl border border-dashed border-gray-300 py-3 active:bg-gray-50"
        >
          <Ionicons name="add" size={18} color="#6b7280" />
          <Text className="text-sm font-medium text-gray-600">계획 항목 추가</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
