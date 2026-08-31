// BUDGET-02 세부 계획 목록.
// HTML 시안(.plan / .plan-list)의 치수를 옮겼다. thumb 50px · radius 14 · gap 9
//
// ⚠️ 계산 근거("38,000원 × 4명")는 **저장하지 않고 화면에서 나눈다.**
//    예상금액 ÷ 인원이 딱 떨어질 때만 보여준다.
//    사용자가 90,000원을 직접 적었는데 4로 나눠 "22,500원 × 4명" 이라고 쓰면
//    없는 단가를 지어내는 셈이다. 그런 항목은 '직접 입력' 으로 표시한다.
//
// ⚠️ 체크를 끄면 세부 계획 합계에서 빠진다. 삭제와는 다르다.
//    budget_plan_items.status 의 PLANNED / CANCELED 로 저장한다.
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';

import { Button, CurrencyInput, Input } from '@/components/ui';
import type { CountryTheme } from '@/lib/constants/countryTheme';

export type PlanItem = {
  id: string;
  name: string;
  expectedAmount: number;
  actualAmount: number;
  /** 계획에 포함할지. 끄면 합계에서 빠진다 */
  selected: boolean;
  emoji: string;
  /**
   * 실제 지출과 연결된 항목인가.
   *
   * ⚠️ 연결된 항목은 **삭제도 체크 해제도 못 한다.**
   *    이미 쓴 돈이 붙어 있는 계획을 빼면 "계획에 없는 지출" 이 생겨
   *    계획 대비 실제 비교가 성립하지 않는다.
   */
  locked: boolean;
};

export type PlanDraft = { name: string; amount: number | null };

/** 썸네일 배경. HTML 의 t1~t4 를 순환한다 */
const THUMB_BG = ['#e4efff', '#ffe8dc', '#eee4fa', '#dff5f0'];

type Props = {
  items: PlanItem[];
  headcount: number;
  theme: CountryTheme;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;

  adding: boolean;
  draft: PlanDraft;
  nameError: string | null;
  onStartAdd: () => void;
  onChangeDraft: (draft: PlanDraft) => void;
  onCancelAdd: () => void;
  onConfirmAdd: () => void;
};

function won(value: number): string {
  return `${value.toLocaleString('ko-KR')}원`;
}

/**
 * 계산 근거 한 줄.
 * 인원으로 나누어떨어질 때만 단가를 보여준다. 아니면 '직접 입력'.
 */
function basisLabel(amount: number, headcount: number): string {
  if (headcount > 1 && amount > 0 && amount % headcount === 0) {
    return `${(amount / headcount).toLocaleString('ko-KR')}원 × ${headcount}명`;
  }
  return '직접 입력';
}

export function PlanItemCard({
  items,
  headcount,
  theme,
  onToggle,
  onDelete,
  adding,
  draft,
  nameError,
  onStartAdd,
  onChangeDraft,
  onCancelAdd,
  onConfirmAdd,
}: Props) {
  return (
    <View>
      <View style={{ gap: 9 }}>
        {items.map((item, index) => (
          <Swipeable
            key={item.id}
            // 지출이 붙은 항목은 밀어도 삭제가 열리지 않는다
            enabled={!item.locked}
            overshootRight={false}
            renderRightActions={() => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${item.name} 삭제`}
                onPress={() => onDelete(item.id)}
                style={{
                  width: 74,
                  marginLeft: 9,
                  borderRadius: 14,
                  backgroundColor: '#e1394a',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="trash-outline" size={19} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800', marginTop: 3 }}>
                  삭제
                </Text>
              </Pressable>
            )}
          >
          <View
            className="flex-row items-center"
            style={{
              gap: 11,
              borderWidth: 1,
              borderColor: '#e7e9ed',
              borderRadius: 14,
              padding: 10,
              backgroundColor: item.selected ? '#fff' : '#f7f8f9',
              opacity: item.selected ? 1 : 0.62,
            }}
          >
            <View
              style={{
                width: 50,
                height: 50,
                borderRadius: 11,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: THUMB_BG[index % THUMB_BG.length],
              }}
            >
              <Text style={{ fontSize: 25 }}>{item.emoji}</Text>
            </View>

            <View className="flex-1">
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#121a2a' }}>
                {item.name}
              </Text>
              <Text style={{ fontSize: 9, color: '#7d8797', marginTop: 4 }}>
                {basisLabel(item.expectedAmount, headcount)}
                {item.actualAmount > 0 ? `  ·  실제 ${won(item.actualAmount)}` : ''}
              </Text>
              {item.locked ? (
                <Text style={{ fontSize: 9, color: '#8b94a2', marginTop: 3 }}>
                  지출이 연결돼 있어 뺄 수 없어요
                </Text>
              ) : null}
            </View>

            <View className="items-end">
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#121a2a' }}>
                {won(item.expectedAmount)}
              </Text>
              <View className="mt-1.5">
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: item.selected, disabled: item.locked }}
                  accessibilityLabel={`${item.name} 계획에 포함`}
                  disabled={item.locked}
                  onPress={() => onToggle(item.id)}
                  hitSlop={6}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: item.locked
                      ? '#cfd4dc'
                      : item.selected
                        ? theme.primary
                        : '#cfd4dc',
                    backgroundColor: item.locked
                      ? '#e7e9ed'
                      : item.selected
                        ? theme.primary
                        : '#fff',
                  }}
                >
                  {item.locked ? (
                    <Ionicons name="lock-closed" size={10} color="#8b94a2" />
                  ) : item.selected ? (
                    <Ionicons name="checkmark" size={12} color={theme.onPrimary} />
                  ) : null}
                </Pressable>
              </View>
            </View>
          </View>
          </Swipeable>
        ))}
      </View>

      {/* 직접 추가 — 기본은 버튼만, 누르면 카드 안에서 펼친다 */}
      {adding ? (
        <View
          style={{
            marginTop: 10,
            borderWidth: 1,
            borderColor: theme.primary + '55',
            borderRadius: 14,
            backgroundColor: theme.primarySoft,
            padding: 13,
            gap: 8,
          }}
        >
          <Input
            value={draft.name}
            onChangeText={(name) => onChangeDraft({ ...draft, name })}
            placeholder="항목 이름 · 예: 오사카성 입장권"
            error={nameError}
            maxLength={30}
            autoFocus
          />
          <CurrencyInput
            value={draft.amount}
            onChangeValue={(amount) => onChangeDraft({ ...draft, amount })}
            placeholder="예상 금액"
          />
          <View className="flex-row justify-end gap-2">
            <Button label="취소" variant="secondary" fullWidth={false} onPress={onCancelAdd} />
            <Button label="추가" fullWidth={false} onPress={onConfirmAdd} />
          </View>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="계획 항목 직접 추가"
          onPress={onStartAdd}
          style={{
            marginTop: 10,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: '#cdd3da',
            borderRadius: 13,
            backgroundColor: '#fff',
            padding: 13,
          }}
          className="flex-row items-center justify-center active:bg-gray-50"
        >
          <Text style={{ fontSize: 12, fontWeight: '800', color: theme.primary }}>＋ </Text>
          <Text style={{ fontSize: 12, fontWeight: '800', color: '#596474' }}>
            계획 항목 직접 추가
          </Text>
        </Pressable>
      )}
    </View>
  );
}
