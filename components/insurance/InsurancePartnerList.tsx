// ============================================================================
// INSURANCE-01 · 제휴사 견적 목록 (BM 1)
//
// ⚠️ 이 컴포넌트는 supabase 도 track() 도 부르지 않는다. 화면 파일이 부른다.
//    (CLAUDE.md 9장)
//
// ⚠️ 여기 회사들은 **전부 가상**이다. 그 사실을 화면 맨 아래에 그대로 쓴다.
//    실존 보험사처럼 보이면 사실과 다른 표시가 된다.
//    (lib/constants/insurancePartners.ts 주석)
//
// ⚠️ 수수료율은 그리지 않는다. 다만 **수수료를 받는다는 사실은 밝힌다.**
//    광고성 표시이기도 하고, 숨기면 신뢰를 잃는다.
// ============================================================================
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import type { CountryTheme } from '@/lib/constants/countryTheme';

import { COVERAGE_ORDER, COVERAGE_TIER } from '@/lib/constants/insurancePartners';
import type { InsuranceCoverage } from '@/lib/constants/status';
import type { InsuranceQuote, PartnerQuote } from '@/lib/insurance/quote';

/**
 * 국기 색을 그대로 쓰지 않고 한 단계 눅인다.
 *
 * ⚠️ countryTheme.ts 의 규칙 — "배경과 기본 카드는 항상 화이트·쿨그레이,
 *    포인트 컬러는 의미가 있는 곳에만" 을 지킨다. 이 화면은 카드 세 장이
 *    세로로 이어져서, 국기 원색을 그대로 CTA 세 개에 쓰면 화면이 그 색으로
 *    덮인다. 특히 일본·중국처럼 채도가 높은 빨강이 그렇다.
 *
 * @param ratio 흰색에 섞는 비율. 0 이면 원색, 1 이면 흰색
 */
function soften(hex: string, ratio: number): string {
  const value = hex.replace('#', '');
  if (value.length !== 6) return hex;
  const mix = (start: number) =>
    Math.round(start + (255 - start) * ratio)
      .toString(16)
      .padStart(2, '0');
  return `#${mix(parseInt(value.slice(0, 2), 16))}${mix(
    parseInt(value.slice(2, 4), 16),
  )}${mix(parseInt(value.slice(4, 6), 16))}`;
}

type Props = {
  quote: InsuranceQuote;
  theme: CountryTheme;
  coverage: InsuranceCoverage;
  onChangeCoverage: (coverage: InsuranceCoverage) => void;
  /** 제휴사로 넘어간다. 화면 파일이 로그를 남기고 이동시킨다 */
  onPressPartner: (row: PartnerQuote) => void;
  /** 예산에서 이 카테고리에 잡아 둔 금액. 없으면 비교 줄을 그리지 않는다 */
  budgetAmount: number | null;
  disabled?: boolean;
};

function won(value: number): string {
  return `${value.toLocaleString('ko-KR')}원`;
}

export function InsurancePartnerList({
  quote,
  theme,
  coverage,
  onChangeCoverage,
  onPressPartner,
  budgetAmount,
  disabled = false,
}: Props) {
  const tier = COVERAGE_TIER[coverage];
  // 선택 상태·CTA 는 눅인 국기색, 옅은 배경은 테마가 이미 가진 primarySoft 를 쓴다.
  const accent = soften(theme.primary, 0.18);

  return (
    <View className="gap-4">
      {/* ── 보장 등급 ────────────────────────────────────────────────── */}
      <View className="gap-2">
        <Text className="text-sm font-bold text-gray-900">보장 범위</Text>

        <View className="flex-row gap-1.5">
          {COVERAGE_ORDER.map((value) => {
            const selected = value === coverage;
            return (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ selected, disabled }}
                accessibilityLabel={COVERAGE_TIER[value].label}
                disabled={disabled}
                onPress={() => onChangeCoverage(value)}
                className="flex-1 items-center rounded-xl border py-2.5"
                style={{
                  borderColor: selected ? accent : '#e5e8ec',
                  backgroundColor: selected ? theme.primarySoft : '#ffffff',
                }}
              >
                <Text
                  className="text-[13px] font-bold"
                  style={{ color: selected ? accent : '#596272' }}
                >
                  {COVERAGE_TIER[value].label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text className="text-xs text-gray-500">{tier.summary}</Text>
      </View>

      {/* ── 제휴사 카드 ──────────────────────────────────────────────── */}
      <View className="gap-2.5">
        {quote.quotes.map((row) => {
          const cheapest = quote.cheapest?.partner.id === row.partner.id;
          return (
            <Pressable
              key={row.partner.id}
              accessibilityRole="button"
              accessibilityLabel={`${row.partner.name} 예상 보험료 ${won(row.totalPremium)} 확인하기`}
              disabled={disabled}
              onPress={() => onPressPartner(row)}
              className="gap-3 rounded-2xl border bg-white p-4 active:opacity-90"
              style={{ borderColor: cheapest ? accent : '#e5e8ec' }}
            >
              <View className="flex-row items-start gap-3">
                <Text className="text-2xl">{row.partner.emoji}</Text>

                <View className="flex-1 gap-0.5">
                  <View className="flex-row items-center gap-1.5">
                    <Text className="text-[15px] font-bold text-gray-900">
                      {row.partner.name}
                    </Text>
                    {row.partner.badge ? (
                      <View
                        className="rounded-full px-1.5 py-0.5"
                        style={{ backgroundColor: theme.primarySoft }}
                      >
                        <Text className="text-[10px] font-bold" style={{ color: accent }}>
                          {row.partner.badge}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text className="text-xs text-gray-500">{row.partner.tagline}</Text>
                </View>

                <View className="items-end">
                  {/*
                    ⚠️ '예상' 을 금액 바로 위에 붙인다. 카드 밖 한 줄로 밀어 두면
                       사용자는 큰 숫자만 보고 확정 보험료로 읽는다.
                  */}
                  <Text className="text-[10px] text-gray-400">예상</Text>
                  <Text className="text-[17px] font-black text-gray-900">
                    {won(row.totalPremium)}
                  </Text>
                  <Text className="text-[10px] text-gray-400">
                    1인 {won(row.perPersonPremium)}
                  </Text>
                </View>
              </View>

              <View className="flex-row flex-wrap gap-1.5">
                {row.partner.features.map((feature) => (
                  <View key={feature} className="rounded-md bg-gray-100 px-2 py-1">
                    <Text className="text-[11px] text-gray-600">{feature}</Text>
                  </View>
                ))}
              </View>

              <View
                className="flex-row items-center justify-center gap-1 rounded-xl py-2.5"
                style={{ backgroundColor: accent }}
              >
                <Text
                  className="text-[13px] font-bold"
                  style={{ color: theme.onPrimary }}
                >
                  보험료 확인하기
                </Text>
                <Ionicons name="arrow-forward" size={13} color={theme.onPrimary} />
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* ── 예산과의 비교 ────────────────────────────────────────────── */}
      {/*
        예산에 잡아 둔 금액과 견적이 얼마나 다른지 여기서 바로 보여준다.
        이 화면에서 나가서 예산 화면을 다시 열어 비교하게 만들 이유가 없다.
      */}
      {budgetAmount !== null && quote.cheapest ? (
        <View className="gap-1 rounded-xl bg-gray-50 p-3.5">
          <View className="flex-row items-center justify-between">
            <Text className="text-xs text-gray-500">예산에 잡아 둔 여행자보험</Text>
            <Text className="text-xs font-bold text-gray-900">{won(budgetAmount)}</Text>
          </View>
          <View className="flex-row items-center justify-between">
            <Text className="text-xs text-gray-500">가장 저렴한 견적</Text>
            <Text className="text-xs font-bold text-gray-900">
              {won(quote.cheapest.totalPremium)}
            </Text>
          </View>
          {budgetAmount !== quote.cheapest.totalPremium ? (
            <Text
              className="mt-0.5 text-right text-[11px] font-semibold"
              style={{
                color: quote.cheapest.totalPremium > budgetAmount ? '#ef4444' : accent,
              }}
            >
              예산보다 {quote.cheapest.totalPremium > budgetAmount ? '+' : '−'}
              {won(Math.abs(quote.cheapest.totalPremium - budgetAmount))}
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* ── 고지 ─────────────────────────────────────────────────────── */}
      <View className="gap-1.5 rounded-xl border border-gray-200 p-3.5">
        <View className="flex-row items-center gap-1.5">
          <Ionicons name="information-circle-outline" size={14} color="#858e9c" />
          <Text className="text-[11px] font-bold text-gray-500">꼭 확인해 주세요</Text>
        </View>
        <Text className="text-[11px] leading-4 text-gray-500">
          여기 보험사는 <Text className="font-bold">서비스 준비 중 예시</Text>예요. 실제 판매
          중인 상품이 아니에요.
        </Text>
        <Text className="text-[11px] leading-4 text-gray-500">
          보험료는 여행지·일정·인원으로 계산한 <Text className="font-bold">예상 금액</Text>이에요.
          나이와 보장 한도에 따라 달라져요.
        </Text>
        <Text className="text-[11px] leading-4 text-gray-500">
          가입이 이루어지면 트립팟이 제휴사로부터 수수료를 받아요.
        </Text>
      </View>
    </View>
  );
}
