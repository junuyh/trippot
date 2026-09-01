// BUDGET-01 카테고리별 예산 행.
//
// 시안(.budget-row)을 옮겼다.
//   아이콘 · 이름 · 설정 예산 · 전체 예산 비중 · 준비율 막대 · 화살표
//
// ⚠️ 아이콘 뒤에 카테고리별 컬러 배경을 두지 않는다. (스펙)
//    시안은 카테고리마다 --tone 을 다르게 줬지만, 국가 포인트 컬러 하나만
//    쓰기로 한 규칙과 충돌한다. 여덟 색이 동시에 보이면 포인트가 사라진다.
//
// ⚠️ 실제 지출 그래프를 넣지 않는다. 막대는 준비율(금고 배분) 하나다.
//    지출 비교는 BUDGET-02 와 결산이 담당한다.
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { CATEGORY_EMOJI } from '@/lib/constants/categoryEmoji';
import type { CountryTheme } from '@/lib/constants/countryTheme';
import { CATEGORY_CODE_LABEL, type CategoryCode } from '@/lib/constants/status';

export type BudgetCategoryRowData = {
  id: string;
  categoryCode: CategoryCode;
  plannedAmount: number;
  preparedAmount: number;
  actualAmount: number;
};

type Props = {
  category: BudgetCategoryRowData;
  theme: CountryTheme;
  /** 목표 여행비. 이 카테고리가 차지하는 비중을 내는 분모다 */
  targetAmount: number;
  onPress: (categoryId: string) => void;
};

export function BudgetCategoryRow({ category, theme, targetAmount, onPress }: Props) {
  const { plannedAmount, preparedAmount } = category;

  const prepRate = plannedAmount > 0 ? Math.min(100, (preparedAmount / plannedAmount) * 100) : 0;
  const share = targetAmount > 0 ? Math.round((plannedAmount / targetAmount) * 100) : 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${CATEGORY_CODE_LABEL[category.categoryCode]} 예산 상세`}
      onPress={() => onPress(category.id)}
      className="active:bg-gray-50"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 9,
        paddingHorizontal: 12,
        paddingVertical: 13,
      }}
    >
      <Text style={{ fontSize: 20, width: 26 }}>{CATEGORY_EMOJI[category.categoryCode]}</Text>

      <View style={{ flex: 1, gap: 6 }}>
        <View className="flex-row items-center justify-between">
          <Text style={{ fontSize: 12, fontWeight: '800', color: '#141b28' }}>
            {CATEGORY_CODE_LABEL[category.categoryCode]}
          </Text>
          {/* 금액을 축약하지 않는다. 174천이 아니라 174,000원이다 (스펙) */}
          <Text style={{ fontSize: 13, fontWeight: '800', color: '#141b28' }}>
            {plannedAmount.toLocaleString('ko-KR')}원
          </Text>
        </View>

        <View className="flex-row items-center" style={{ gap: 9 }}>
          <View
            style={{
              flex: 1,
              height: 5,
              borderRadius: 5,
              backgroundColor: '#eff1f3',
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${prepRate}%`,
                height: '100%',
                borderRadius: 5,
                backgroundColor: theme.primary,
              }}
            />
          </View>
          <Text style={{ fontSize: 9, color: '#7c8695' }}>
            <Text style={{ color: theme.primary, fontWeight: '800' }}>{share}%</Text>
            {' · '}
            {prepRate > 0 ? `${Math.round(prepRate)}% 준비` : '준비 전'}
          </Text>
        </View>
      </View>

      <Ionicons name="chevron-forward" size={16} color="#a8afb9" />
    </Pressable>
  );
}
