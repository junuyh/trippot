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
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { CurrencyInput } from '@/components/ui';
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
  userTotalDraft,
  onChangeUserTotalDraft,
  onApplyUserTotal,
  disabled = false,
}: Props) {
  const userDefined = method === BUDGET_METHOD.USER_DEFINED;
  const canApply = userTotalDraft !== null && userTotalDraft > 0;

  return (
    <View className="mt-5 rounded-[22px] border border-blue-100 bg-[#f6f9ff] px-[18px] pb-[18px] pt-5">
      <Text className="text-xs font-bold text-blue-600">
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

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={userDefined ? '추천 예산으로 돌아가기' : '총 예산을 직접 정하기'}
        disabled={disabled}
        onPress={onToggleMethod}
        className={`mt-3.5 flex-row items-center gap-1 self-start rounded-lg py-1 pr-2 active:bg-blue-100 ${
          disabled ? 'opacity-40' : ''
        }`}
      >
        <Text className="text-xs font-bold text-blue-600">
          {userDefined ? '추천 예산으로 돌아가기' : '총 예산을 직접 정할래요'}
        </Text>
        <Ionicons name="chevron-forward" size={13} color="#2563eb" />
      </Pressable>

      {/*
        ⚠️ 이 블록은 method 가 바뀔 때만 붙고 떨어진다. 입력 한 글자마다
           구조가 바뀌면 TextInput 이 다시 마운트되어 포커스가 풀린다. (요청 '유지할 동작')
      */}
      {userDefined ? (
        <View className="mt-3.5 border-t border-blue-100 pt-3.5">
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
            className={`mt-2 h-[42px] items-center justify-center rounded-xl bg-blue-600 active:bg-blue-700 ${
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
