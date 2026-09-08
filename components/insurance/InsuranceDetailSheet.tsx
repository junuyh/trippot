// ============================================================================
// INSURANCE-01 · 보장 상세 바텀시트
//
// ⚠️ 이 시트가 없으면 카드에 금액만 남아 **비싼 쪽을 고를 이유가 사라진다.**
//    "왜 3만원을 더 내는가" 는 보장 한도로만 설명된다.
//
// ⚠️ 한도는 등급 배수까지 곱한 값이다. 보장 범위를 바꾸면 여기 숫자도 바뀐다.
//    (lib/insurance/quote.ts 의 coverage)
//
// ⚠️ 시트의 CTA 도 제휴사로 넘어가는 지점이다. 하단 바와 같은 이벤트를 쏜다.
//    화면 파일이 처리하고 여기서는 부르지 않는다. (CLAUDE.md 9장)
// ============================================================================
import { Pressable, Text, View } from 'react-native';

import { BottomSheet } from '@/components/ui';
import type { CountryTheme } from '@/lib/constants/countryTheme';
import type { PartnerQuote } from '@/lib/insurance/quote';

type Props = {
  row: PartnerQuote | null;
  theme: CountryTheme;
  headcount: number;
  days: number;
  onClose: () => void;
  /** 제휴사로 넘어간다 */
  onGo: (row: PartnerQuote) => void;
};

function won(value: number): string {
  return `${value.toLocaleString('ko-KR')}원`;
}

/** 3,000만원 처럼 읽는다. 30,000,000원 은 자릿수를 세게 만든다 */
function limit(value: number): string {
  if (value >= 100_000_000) {
    const eok = value / 100_000_000;
    return `${Number.isInteger(eok) ? eok : eok.toFixed(1)}억원`;
  }
  if (value >= 10_000) return `${(value / 10_000).toLocaleString('ko-KR')}만원`;
  return won(value);
}

export function InsuranceDetailSheet({
  row,
  theme,
  headcount,
  days,
  onClose,
  onGo,
}: Props) {
  return (
    <BottomSheet
      visible={row !== null}
      onClose={onClose}
      title={row ? row.partner.name : ''}
    >
      {row ? (
        <View className="gap-4 px-5 pb-6 pt-1">
          <Text className="text-xs text-gray-500">{row.partner.tagline}</Text>

          <View
            className="flex-row items-center justify-between rounded-xl px-3.5 py-3"
            style={{ backgroundColor: theme.primarySoft }}
          >
            <Text className="text-[11px] text-gray-600">
              {headcount}명 총액 · 1인 {won(row.perPersonPremium)}
            </Text>
            <Text className="text-[18px] font-black text-gray-900">
              {won(row.totalPremium)}
            </Text>
          </View>

          <View className="border-t border-gray-200">
            {row.coverage.map((line) => (
              <View
                key={line.label}
                className="flex-row justify-between border-b border-gray-200 py-3"
              >
                <Text className="text-xs text-gray-600">{line.label}</Text>
                <Text className="text-xs font-bold text-gray-900">
                  {limit(line.amount)}
                </Text>
              </View>
            ))}
          </View>

          <Text className="text-[10px] text-gray-400">
            {days}일 일정 기준 예상 한도예요. 실제 보장은 가입 시 약관을 따라요.
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${row.partner.name}에서 보험료 확인하기`}
            onPress={() => onGo(row)}
            className="h-12 items-center justify-center rounded-xl active:opacity-90"
            style={{ backgroundColor: theme.primary }}
          >
            <Text
              className="text-[13px] font-black"
              style={{ color: theme.onPrimary }}
            >
              {row.partner.name}에서 보험료 확인하기 →
            </Text>
          </Pressable>
        </View>
      ) : null}
    </BottomSheet>
  );
}
