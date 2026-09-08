// ============================================================================
// INSURANCE-01 · 견적 목록 (BM 1)
//
// 시안: docs/Team/tripPot/html/TripPot — 일본 국기색 여행자보험.html
//
// ⚠️ 이 컴포넌트는 supabase 도 track() 도 부르지 않는다. 화면 파일이 부른다.
//    (CLAUDE.md 9장)
//
// ============================================================================
// 카드를 누르면 '이동' 이 아니라 '선택' 이다
// ============================================================================
//
//   카드 → 선택 → 하단 바에 금액과 예산 차액이 뜬다 → 하단 CTA 로 제휴사 이동
//
//   왜 두 단계인가: 보험은 셋을 **비교하는** 화면이다. 카드를 누르자마자
//   밖으로 나가면 비교가 안 된다. 고른 것을 하단에 붙여 두면 다른 카드를
//   눌러 가며 금액과 차액이 바뀌는 걸 볼 수 있다.
//
//   그래서 insurance_cta_clicked 는 여기서 쏘지 않는다. 하단 CTA 와 보장 상세
//   시트의 CTA, 즉 **실제로 제휴사로 넘어가는 지점**에서만 쏜다.
//   (docs/06_이벤트로그정의서_v4.md §7-7)
//
// ⚠️ 제휴사는 전부 가상이다. 그 사실과 수수료를 받는다는 사실을 맨 아래에 쓴다.
// ============================================================================
import { Pressable, Text, View } from 'react-native';

import { COVERAGE_ORDER, COVERAGE_TIER } from '@/lib/constants/insurancePartners';
import type { CountryTheme } from '@/lib/constants/countryTheme';
import type { InsuranceCoverage } from '@/lib/constants/status';
import type { InsuranceQuote, PartnerQuote } from '@/lib/insurance/quote';

type Props = {
  quote: InsuranceQuote;
  theme: CountryTheme;
  coverage: InsuranceCoverage;
  onChangeCoverage: (coverage: InsuranceCoverage) => void;
  /** 카드를 골랐다. 이동이 아니라 선택이다 */
  onSelect: (row: PartnerQuote) => void;
  /** '보장 상세' — 바텀시트를 연다 */
  onOpenDetail: (row: PartnerQuote) => void;
  selectedId: string | null;
  /** 예산에 잡아 둔 여행자보험 금액. 없으면 비교 줄을 그리지 않는다 */
  budgetAmount: number | null;
  disabled?: boolean;
};

function won(value: number): string {
  return `${value.toLocaleString('ko-KR')}원`;
}

export function InsuranceQuoteList({
  quote,
  theme,
  coverage,
  onChangeCoverage,
  onSelect,
  onOpenDetail,
  selectedId,
  budgetAmount,
  disabled = false,
}: Props) {
  const tier = COVERAGE_TIER[coverage];

  return (
    <View className="gap-6">
      {/* ── 예산 맥락 ─────────────────────────────────────────────────
          예산·최저 견적·예산 안에 드는 개수를 맨 위에 둔다. 이 화면은
          "얼마인가" 가 아니라 "잡아 둔 예산 안에 드는가" 를 보는 자리다. */}
      {budgetAmount !== null ? (
        <View className="flex-row border-y border-gray-200 py-3">
          {[
            { label: '보험 예산', value: won(budgetAmount), accent: false },
            {
              label: '최저 견적',
              value: quote.cheapest ? won(quote.cheapest.totalPremium) : '—',
              accent: false,
            },
            {
              label: '예산 내 견적',
              value: `${quote.withinBudgetCount ?? 0}개`,
              accent: true,
            },
          ].map((cell, index) => (
            <View
              key={cell.label}
              className={`flex-1 ${index > 0 ? 'border-l border-gray-200 pl-3' : ''}`}
            >
              <Text className="text-[10px] text-gray-400">{cell.label}</Text>
              <Text
                className="mt-1 text-[13px] font-bold"
                style={{ color: cell.accent ? theme.primary : '#101828' }}
              >
                {cell.value}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* ── 보장 범위 ────────────────────────────────────────────────── */}
      <View className="gap-2.5">
        <View className="flex-row items-end justify-between">
          <Text className="text-[17px] font-bold text-gray-900">보장 범위</Text>
          <Text className="text-[10px] text-gray-400">조건을 바꿔 비교하세요</Text>
        </View>

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
                className="h-11 flex-1 items-center justify-center rounded-xl border"
                style={{
                  borderColor: selected ? theme.primary : '#e2e6eb',
                  backgroundColor: selected ? theme.primary : '#ffffff',
                }}
              >
                <Text
                  className="text-xs font-extrabold"
                  style={{ color: selected ? theme.onPrimary : '#6e7887' }}
                >
                  {COVERAGE_TIER[value].label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text className="text-[11px] text-gray-500">{tier.summary}</Text>
      </View>

      {/* ── 견적 ─────────────────────────────────────────────────────── */}
      <View className="gap-2.5">
        <View className="flex-row items-end justify-between">
          <Text className="text-[17px] font-bold text-gray-900">추천 견적</Text>
          <Text className="text-[10px] text-gray-400">
            {quote.headcount}명 총액 · 낮은 가격순
          </Text>
        </View>

        {quote.quotes.map((row) => {
          const selected = selectedId === row.partner.id;
          const over = row.budgetDiff !== null && row.budgetDiff < 0;

          return (
            <Pressable
              key={row.partner.id}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled }}
              accessibilityLabel={`${row.partner.name} ${won(row.totalPremium)}`}
              disabled={disabled}
              onPress={() => onSelect(row)}
              className="gap-3 rounded-2xl bg-white p-4"
              style={{
                borderWidth: selected ? 2 : 1,
                borderColor: selected ? theme.primary : '#e2e6eb',
                padding: selected ? 15 : 16,
              }}
            >
              {/* 선택 배지. 카드 위쪽 테두리에 걸친다 */}
              {selected ? (
                <View
                  className="absolute right-3 -top-2 rounded-md px-1.5 py-0.5"
                  style={{ backgroundColor: theme.primary }}
                >
                  <Text
                    className="text-[9px] font-black"
                    style={{ color: theme.onPrimary }}
                  >
                    확인 중
                  </Text>
                </View>
              ) : null}

              <View className="flex-row items-center gap-2.5">
                {/* 이모지 대신 두 글자. 보험사처럼 읽힌다 */}
                <View
                  className="h-[42px] w-[42px] items-center justify-center rounded-[13px]"
                  style={{ backgroundColor: theme.primarySoft }}
                >
                  <Text
                    className="text-[15px] font-black"
                    style={{ color: theme.primary }}
                  >
                    {row.partner.mark}
                  </Text>
                </View>

                <View className="flex-1">
                  <View className="flex-row items-center gap-1">
                    <Text className="text-[13px] font-bold text-gray-900">
                      {row.partner.name}
                    </Text>
                    {row.partner.badge ? (
                      <View
                        className="rounded-[5px] px-1.5 py-0.5"
                        style={{ backgroundColor: theme.primarySoft }}
                      >
                        <Text
                          className="text-[9px] font-bold"
                          style={{ color: theme.primary }}
                        >
                          {row.partner.badge}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text className="mt-1 text-[10px] text-gray-400">
                    {row.partner.tagline}
                  </Text>
                </View>

                <View className="items-end">
                  <Text className="text-[9px] text-gray-400">
                    {quote.headcount}명 총액
                  </Text>
                  <Text className="mt-0.5 text-[17px] font-black text-gray-900">
                    {won(row.totalPremium)}
                  </Text>
                  <Text className="mt-0.5 text-[9px] text-gray-400">
                    1인 {won(row.perPersonPremium)}
                  </Text>
                </View>
              </View>

              {/* 예산과의 비교. 카드마다 붙어야 고르는 기준이 된다 */}
              {row.budgetDiff !== null ? (
                <View className="flex-row justify-between rounded-lg bg-gray-50 px-2.5 py-2.5">
                  <Text className="text-[10px] text-gray-500">보험 예산과 비교</Text>
                  <Text
                    className="text-[10px] font-bold"
                    style={{ color: over ? '#e84a5d' : theme.primary }}
                  >
                    {won(Math.abs(row.budgetDiff))} {over ? '초과' : '남음'}
                  </Text>
                </View>
              ) : null}

              <View className="flex-row flex-wrap gap-1.5">
                {row.partner.features.map((feature) => (
                  <View
                    key={feature}
                    className="rounded-md border px-2 py-1"
                    style={{ borderColor: '#f2dfe4', backgroundColor: '#fff5f6' }}
                  >
                    <Text className="text-[10px] text-gray-600">
                      <Text style={{ color: theme.primary, fontWeight: '900' }}>#</Text>
                      {feature}
                    </Text>
                  </View>
                ))}
              </View>

              <View className="flex-row gap-1.5">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${row.partner.name} 보장 상세`}
                  disabled={disabled}
                  onPress={() => onOpenDetail(row)}
                  className="h-10 flex-[1] items-center justify-center rounded-lg border border-gray-200 bg-white active:bg-gray-50"
                >
                  <Text className="text-[11px] font-bold text-gray-700">보장 상세</Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${row.partner.name} 견적 선택`}
                  disabled={disabled}
                  onPress={() => onSelect(row)}
                  className="h-10 flex-[1.65] items-center justify-center rounded-lg active:opacity-90"
                  style={{ backgroundColor: selected ? theme.primary : theme.neutral }}
                >
                  <Text
                    className="text-[11px] font-bold"
                    style={{ color: theme.onPrimary }}
                  >
                    {selected ? '선택한 견적' : '이 견적 선택'}
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* ── 고지 ─────────────────────────────────────────────────────── */}
      <View className="gap-1 rounded-xl border border-gray-200 p-3.5">
        <Text className="text-[11px] font-bold text-gray-600">
          ⓘ 보험사에서 최종 보험료를 확인해 주세요.
        </Text>
        <Text className="text-[11px] leading-4 text-gray-500">
          여기 보험사는 <Text className="font-bold">서비스 준비 중 예시</Text>예요.
          표시 금액은 여행지·일정·인원으로 계산한 예상 보험료이고, 나이와 보장
          한도에 따라 달라져요. 가입 시 트립팟이 제휴 수수료를 받아요.
        </Text>
      </View>
    </View>
  );
}
