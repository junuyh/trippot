// TRIP-03 예산 구성 요약.
//
// 기본 상태에서는 카테고리명과 금액만 보여준다. (요청 §2)
// 근거·상품·직접 입력은 '수정' 을 눌렀을 때 BudgetCategoryList 가 같은 자리에서
// 이어받는다. 목록을 아래에 하나 더 쌓지 않는다.
//
// ⚠️ 여행자보험과 예비비는 '기타' 한 줄로 묶는다. 둘 다 사용자가 고르는 항목이
//    아니라 딸려오는 금액이라, 요약에서 각각 한 줄씩 차지하면 정작 중요한
//    항공·숙소·식비가 밀린다. 수정 모드에서는 원래대로 각각 보인다.
import { Text, View } from 'react-native';

import { CATEGORY_CODE, CATEGORY_CODE_LABEL, type CategoryCode } from '@/lib/constants/status';

type Row = { key: string; label: string; amount: number };

type Props = {
  categories: { categoryCode: CategoryCode; plannedAmount: number }[];
};

/** '기타' 로 묶는 카테고리. */
const ETC_CODES: CategoryCode[] = [CATEGORY_CODE.INSURANCE, CATEGORY_CODE.CONTINGENCY];

/** 요약에 낱개로 보여줄 카테고리 순서. */
const VISIBLE_ORDER: CategoryCode[] = [
  CATEGORY_CODE.AIRFARE,
  CATEGORY_CODE.LODGING,
  CATEGORY_CODE.FOOD,
  CATEGORY_CODE.TRANSPORT,
  CATEGORY_CODE.ACTIVITY,
  CATEGORY_CODE.SHOPPING,
];

export function BudgetPreviewList({ categories }: Props) {
  const amountOf = (code: CategoryCode) =>
    categories.find((c) => c.categoryCode === code)?.plannedAmount ?? 0;

  const rows: Row[] = [
    ...VISIBLE_ORDER.map((code) => ({
      key: code,
      label: CATEGORY_CODE_LABEL[code],
      amount: amountOf(code),
    })),
    {
      key: 'ETC',
      label: '기타',
      amount: ETC_CODES.reduce((sum, code) => sum + amountOf(code), 0),
    },
  ];

  return (
    <View className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      {rows.map((row, index) => (
        <View
          key={row.key}
          className={`flex-row items-center justify-between gap-3 px-4 py-[13px] ${
            index > 0 ? 'border-t border-gray-100' : ''
          }`}
        >
          <Text className="text-sm text-gray-700">{row.label}</Text>
          <Text className="text-sm font-bold text-gray-900">
            {row.amount.toLocaleString('ko-KR')}원
          </Text>
        </View>
      ))}
    </View>
  );
}
