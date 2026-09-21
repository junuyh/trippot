// ============================================================================
// INSURANCE-01 · 하단 선택 바 (BM 1 전환 지점)
//
// ⚠️ **이 버튼이 BM 1 의 전환 지점이다.** 여기서 제휴사로 넘어가고,
//    화면 파일이 그 순간 insurance_cta_clicked 를 쏜다.
//    (docs/06_이벤트로그정의서_v4.md §7-7)
//
// ⚠️ 고르기 전에는 눌리지 않는다. "견적을 선택해 주세요" 라고 이유를 쓴다.
//    비활성 버튼만 두면 왜 안 눌리는지 알 수 없다.
//
// ⚠️ 금액 위에 예산과의 차액을 함께 쓴다. 카드를 바꿔 누를 때마다 여기가
//    같이 움직이는 게 이 화면의 비교 기능이다.
// ============================================================================
import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { Pressable } from 'react-native';

import type { CountryTheme } from '@/lib/constants/countryTheme';
import type { PartnerQuote } from '@/lib/insurance/quote';

type Props = {
  theme: CountryTheme;
  /** 고른 견적. 아직 안 골랐으면 null */
  selected: PartnerQuote | null;
  onPress: () => void;
  /**
   * 여행자보험 예산 카테고리 주소. 고른 금액을 예산에 넣으러 갈 곳이다.
   * 예산을 안 짠 여행이면 null 이고, 그때는 링크를 그리지 않는다.
   */
  budgetHref?: string | null;
  disabled?: boolean;
};

function won(value: number): string {
  return `${value.toLocaleString('ko-KR')}원`;
}

export function InsuranceSelectionBar({
  theme,
  selected,
  onPress,
  budgetHref = null,
  disabled = false,
}: Props) {
  const diff = selected?.budgetDiff ?? null;

  return (
    <View className="border-t border-gray-200 bg-white px-5 pb-7 pt-3">
      <View className="mb-2 flex-row items-end justify-between gap-3">
        <View className="flex-1">
          <Text className="text-[10px] text-gray-400">확인할 보험</Text>
          <Text className="mt-0.5 text-xs font-bold text-gray-900" numberOfLines={1}>
            {selected ? selected.partner.name : '아직 선택하지 않았어요'}
          </Text>
          {selected ? (
            <Text className="mt-0.5 text-[9px] text-gray-400">
              보험사에서 최종 보험료를 확인해요
            </Text>
          ) : null}
        </View>

        <View className="items-end">
          {diff !== null ? (
            <Text
              className="text-[9px] font-semibold"
              style={{ color: diff >= 0 ? theme.primary : '#e84a5d' }}
            >
              예산보다 {won(Math.abs(diff))} {diff >= 0 ? '적어요' : '높아요'}
            </Text>
          ) : null}
          <Text className="text-[17px] font-black text-gray-900">
            {selected ? won(selected.totalPremium) : '—'}
          </Text>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !selected || disabled }}
        accessibilityLabel={
          selected ? `${selected.partner.name}에서 보험료 확인하기` : '견적을 선택해 주세요'
        }
        disabled={!selected || disabled}
        onPress={onPress}
        className="h-12 items-center justify-center rounded-xl active:opacity-90"
        style={{ backgroundColor: selected ? theme.primary : '#dce1e7' }}
      >
        <Text
          className="text-[13px] font-black"
          style={{ color: selected ? theme.onPrimary : '#98a1ac' }}
        >
          {selected
            ? `${selected.partner.name}에서 보험료 확인하기 →`
            : '견적을 선택해 주세요'}
        </Text>
      </Pressable>

      {/*
        ⚠️ 제휴사로 가는 것 말고 하나 더 — 고른 금액을 내 보험 예산에 넣기.
           견적을 보고 나면 대개 예산을 손보고 싶어진다. 지금까지는 예산까지
           스스로 찾아가야 했다. (2026-09-21 테스트)
        ⚠️ 금액을 대신 확정하지 않는다. 예산 화면으로 보내기만 한다.
      */}
      {selected && budgetHref ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="보험 예산 항목으로 가기"
          onPress={() => router.push(budgetHref as never)}
          className="mt-2 h-9 items-center justify-center active:opacity-60"
        >
          <Text className="text-[12px] font-bold" style={{ color: theme.primary }}>
            이 금액으로 보험 예산 정하기 →
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
