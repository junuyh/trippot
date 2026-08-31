// TRIP-HOME 가상 여행 금고 — 4열 그리드.
// HTML 시안(.vault-grid / .vault-box) 치수를 그대로 옮겼다.
//   박스  104px · radius 13 · border #e8ebef · padding 11/8
//   활성  테두리·배경을 국가 포인트 컬러의 옅은 톤으로
//   미설정 점선 테두리
import { useState } from 'react';
import { Pressable, Text, View, type LayoutChangeEvent } from 'react-native';

import type { CountryTheme } from '@/lib/constants/countryTheme';
import { CATEGORY_CODE, CATEGORY_CODE_LABEL, type CategoryCode } from '@/lib/constants/status';

export type VaultCategory = {
  id: string;
  categoryCode: CategoryCode;
  plannedAmount: number;
  preparedAmount: number;
  actualAmount: number;
};

const EMOJI: Record<CategoryCode, string> = {
  [CATEGORY_CODE.AIRFARE]: '✈️',
  [CATEGORY_CODE.LODGING]: '🏨',
  [CATEGORY_CODE.FOOD]: '🍽️',
  [CATEGORY_CODE.TRANSPORT]: '🚇',
  [CATEGORY_CODE.ACTIVITY]: '🎡',
  [CATEGORY_CODE.SHOPPING]: '🛍️',
  [CATEGORY_CODE.INSURANCE]: '🛡️',
  [CATEGORY_CODE.CONTINGENCY]: '💰',
};

/** 화면 표시 순서. 금고를 채우는 순서와 다르다 (vault.ts VAULT_FILL_ORDER) */
const DISPLAY_ORDER: CategoryCode[] = [
  CATEGORY_CODE.AIRFARE,
  CATEGORY_CODE.LODGING,
  CATEGORY_CODE.FOOD,
  CATEGORY_CODE.TRANSPORT,
  CATEGORY_CODE.ACTIVITY,
  CATEGORY_CODE.SHOPPING,
  CATEGORY_CODE.INSURANCE,
  CATEGORY_CODE.CONTINGENCY,
];

const GAP = 8;
const COLUMNS = 4;

type Props = {
  categories: VaultCategory[];
  theme: CountryTheme;
  onSelect: (categoryId: string) => void;
};

export function VaultGrid({ categories, theme, onSelect }: Props) {
  const byCode = new Map(categories.map((c) => [c.categoryCode, c]));
  const [boxWidth, setBoxWidth] = useState(0);

  // ⚠️ 퍼센트 폭 + gap 을 함께 쓰면 RN 의 반올림 때문에 마지막 칸이 다음 줄로 접힌다.
  //    컨테이너 실제 폭을 재서 픽셀로 나눈다.
  const handleLayout = (event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    setBoxWidth(Math.floor((width - GAP * (COLUMNS - 1)) / COLUMNS));
  };

  return (
    <View className="flex-row flex-wrap" style={{ gap: GAP }} onLayout={handleLayout}>
      {DISPLAY_ORDER.map((code) => {
        const category = byCode.get(code);
        const unset = !category || category.plannedAmount <= 0;
        const rate =
          category && category.plannedAmount > 0
            ? Math.min(100, Math.round((category.preparedAmount / category.plannedAmount) * 100))
            : 0;
        const active = rate > 0;

        return (
          <Pressable
            key={code}
            accessibilityRole="button"
            accessibilityLabel={`${CATEGORY_CODE_LABEL[code]} 예산 상세`}
            disabled={!category}
            onPress={() => category && onSelect(category.id)}
            style={{
              width: boxWidth || undefined,
              height: 104,
              borderRadius: 13,
              borderWidth: 1,
              borderStyle: unset ? 'dashed' : 'solid',
              borderColor: active ? theme.primary + '55' : '#e8ebef',
              backgroundColor: active ? theme.primarySoft : unset ? '#fafbfc' : '#fff',
              paddingVertical: 11,
              paddingHorizontal: 8,
              justifyContent: 'space-between',
            }}
          >
            <Text style={{ fontSize: 21 }}>{EMOJI[code]}</Text>
            <View>
              <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: '800', color: '#111827' }}>
                {CATEGORY_CODE_LABEL[code]}
              </Text>
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 9,
                  letterSpacing: -0.2,
                  marginTop: 2,
                  color: active ? theme.primary : '#969da8',
                  fontWeight: active ? '800' : '400',
                }}
              >
                {unset ? '설정 전' : `${rate}% 채움`}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
