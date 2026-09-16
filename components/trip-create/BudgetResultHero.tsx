// TRIP-03 추천 결과 히어로.
//
// ⚠️ 2026-09-02 · 화면의 첫 블록이 '예산 설정 방식 선택' 에서 **추천 결과**로 바뀌었다.
//    (HTML 시안 반영) 사용자는 고를 것을 먼저 받는 게 아니라 답을 먼저 받는다.
//    직접 정하고 싶은 사람만 아래 액션으로 입력칸을 연다.
//
// ⚠️ 입력 중에는 총액도 카테고리도 바꾸지 않는다. (요청 §1)
//    입력값은 draft 로만 들고 있다가 '이 금액으로 적용' 을 눌렀을 때만 반영한다.
//    한 글자 지울 때마다 아래 예산 구성이 통째로 요동치면 무엇을 고치는 중인지
//    알 수 없다.
//
// ⚠️ 2026-09-03 · 적용이 끝나면 입력칸을 닫는다.
//    열어 둔 채로 두면 같은 금액이 큰 글씨와 입력칸에 두 번 나오고, 화면에서
//    가장 강한 '이 금액으로 적용' 버튼이 눌러도 아무 일이 없는 채로 남아
//    "적용이 안 된 건가" 하고 다시 누르게 만든다.
//    입력칸은 목적이 아니라 수단이라 목적을 이루면 물러난다.
//    다시 고칠 사람은 '금액 변경' 으로 연다.
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { CurrencyInput } from '@/components/ui';
import { BRAND } from '@/lib/constants/brandColor';
import { BUDGET_METHOD, type BudgetMethod } from '@/lib/constants/status';

type Props = {
  method: BudgetMethod;
  /** 지금 화면이 말하고 있는 목표 여행비 */
  totalAmount: number;
  headcount: number;
  perPersonAmount: number;
  /** '보통' 같은 여행 스타일 라벨 */
  styleLabel: string;
  /** 지난 여행 반영이 하나라도 살아 있는가 */
  pastApplied: boolean;

  /** 추천 ↔ 직접 입력 전환 */
  onToggleMethod: () => void;

  /**
   * 총액 입력칸을 열어 둔 상태인가.
   *
   * 화면이 들고 있다. 값으로 유추하지 않는다 — 적용 직후에는 draft 와 적용값이
   * 같아서, '금액 변경' 을 눌러 다시 열어도 곧바로 닫힌 것으로 판정된다.
   */
  amountEditing: boolean;
  /** '금액 변경' — 닫혀 있던 입력칸을 다시 연다 */
  onStartEditAmount: () => void;

  /** 입력 중인 총액. 아직 적용 전 값이다 */
  userTotalDraft: number | null;
  onChangeUserTotalDraft: (value: number | null) => void;
  onApplyUserTotal: () => void;

  disabled?: boolean;
};

export function BudgetResultHero({
  method,
  totalAmount,
  headcount,
  perPersonAmount,
  styleLabel,
  pastApplied,
  onToggleMethod,
  amountEditing,
  onStartEditAmount,
  userTotalDraft,
  onChangeUserTotalDraft,
  onApplyUserTotal,
  disabled = false,
}: Props) {
  const userDefined = method === BUDGET_METHOD.USER_DEFINED;
  const canApply = userTotalDraft !== null && userTotalDraft > 0;

  return (
    <View className="mt-5 rounded-[22px] border border-brand-soft bg-brand-soft px-[18px] pb-[18px] pt-5">
      <Text className="text-xs font-bold text-brand">
        {userDefined ? '내가 정한 목표 여행비' : 'TripPot 추천 여행비'}
      </Text>

      <Text className="mt-1.5 text-[32px] font-extrabold leading-[38px] text-gray-900">
        {totalAmount.toLocaleString('ko-KR')}
        <Text className="text-xl font-bold">원</Text>
      </Text>

      <Text className="mt-1.5 text-[13px] text-gray-500">
        {headcount}명 · 1인당 약 {perPersonAmount.toLocaleString('ko-KR')}원
      </Text>

      {/* 이 금액이 무엇을 기준으로 만들어졌는지 한 줄로 남긴다 */}
      <View className="mt-3.5 flex-row flex-wrap gap-1.5">
        <View className="rounded-full border border-gray-200 bg-white px-2.5 py-1.5">
          <Text className="text-[10px] font-bold text-gray-600">{styleLabel} 여행 기준</Text>
        </View>
        {pastApplied ? (
          <View className="flex-row items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1.5">
            <Ionicons name="sparkles-outline" size={11} color="#047857" />
            <Text className="text-[10px] font-bold text-emerald-700">지난 여행 반영</Text>
          </View>
        ) : null}
      </View>

      {/*
        모드 수준의 액션 줄. 입력칸이 닫혀 있을 때만 '금액 변경' 이 앞에 선다.
        열려 있을 때는 바로 아래에 입력칸과 '이 금액으로 적용' 이 있으므로
        같은 일을 하는 버튼을 하나 더 두지 않는다.
      */}
      <View className="mt-3.5 flex-row items-center gap-1">
        {userDefined && !amountEditing ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="목표 여행비 금액 변경"
              disabled={disabled}
              onPress={onStartEditAmount}
              className={`flex-row items-center gap-1 rounded-lg px-1.5 py-1 active:bg-brand-soft ${
                disabled ? 'opacity-40' : ''
              }`}
            >
              <Ionicons name="create-outline" size={13} color={BRAND.primary} />
              <Text className="text-xs font-bold text-brand">금액 변경</Text>
            </Pressable>
            <Text className="text-[10px] text-pot-dash">·</Text>
          </>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={userDefined ? '추천 예산으로 돌아가기' : '총 예산을 직접 정하기'}
          disabled={disabled}
          onPress={onToggleMethod}
          className={`flex-row items-center gap-1 rounded-lg py-1 pr-2 active:bg-brand-soft ${
            userDefined && !amountEditing ? 'pl-1.5' : ''
          } ${disabled ? 'opacity-40' : ''}`}
        >
          <Text className="text-xs font-bold text-brand">
            {userDefined ? '추천 예산으로 돌아가기' : '총 예산을 직접 정할래요'}
          </Text>
          <Ionicons name="chevron-forward" size={13} color={BRAND.primary} />
        </Pressable>
      </View>

      {/*
        ⚠️ 이 블록이 붙고 떨어지는 시점은 세 곳뿐이다.
           직접 입력으로 전환 · '이 금액으로 적용' · '금액 변경'.
           **입력 한 글자마다 바뀌지 않는다.** 타이핑 중에 구조가 바뀌면
           TextInput 이 다시 마운트되어 포커스가 풀린다. (요청 '유지할 동작')
      */}
      {userDefined && amountEditing ? (
        <View className="mt-3.5 border-t border-brand-soft pt-3.5">
          <CurrencyInput
            label="생각한 총 예산"
            value={userTotalDraft}
            onChangeValue={onChangeUserTotalDraft}
            editable={!disabled}
            hint="입력한 총액을 여행 항목별로 나눠 보여드려요."
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="이 금액으로 적용"
            accessibilityState={{ disabled: disabled || !canApply }}
            disabled={disabled || !canApply}
            onPress={onApplyUserTotal}
            className={`mt-2 h-[42px] items-center justify-center rounded-xl bg-brand active:bg-brand-pressed ${
              disabled || !canApply ? 'opacity-40' : ''
            }`}
          >
            <Text className="text-[13px] font-semibold text-white">이 금액으로 적용</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
