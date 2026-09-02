// ============================================================================
// TRIP-HOME-01 카테고리별 준비 현황 — 4열 그리드 (시안 v4)  → BUDGET-02
//
// ⚠️ **준비율·채움 색상을 그리지 않는다.** (시안 v4 적용 조건)
//    누적 모금액을 카테고리에 어떻게 배분할지가 아직 정책으로 확정되지 않았다.
//    확정되지 않은 기준으로 "숙소 62% 준비됨" 을 보여주면 사용자는 그 숫자를
//    믿고 준비를 멈추거나 더 모은다. 기준이 정해지기 전에는 이름과 진입만 준다.
//    (이전 v3 의 가상 여행 금고 그리드가 이 자리에 있었다)
//
// ⚠️ 금액도 여기 쓰지 않는다. 카드가 8칸이라 한 칸에 금액을 넣으면
//    한 줄에 네 개의 큰 숫자가 서로 경쟁한다. 금액은 BUDGET-01/02 가 맡는다.
// ============================================================================
import { useState } from "react";
import { Pressable, Text, View, type LayoutChangeEvent } from "react-native";

import { CATEGORY_EMOJI } from "@/lib/constants/categoryEmoji";
import {
  CATEGORY_CODE,
  CATEGORY_CODE_LABEL,
  type CategoryCode,
} from "@/lib/constants/status";

export type GridCategory = {
  id: string;
  categoryCode: CategoryCode;
};

/** 화면 표시 순서. 여행 준비를 실제로 하는 순서에 가깝게 둔다 */
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
  categories: GridCategory[];
  onSelect: (categoryId: string) => void;
};

export function CategoryGrid({ categories, onSelect }: Props) {
  const byCode = new Map(
    categories.map((category) => [category.categoryCode, category]),
  );
  const [boxWidth, setBoxWidth] = useState(0);

  // ⚠️ 퍼센트 폭 + gap 을 함께 쓰면 RN 의 반올림 때문에 마지막 칸이 다음 줄로 접힌다.
  //    컨테이너 실제 폭을 재서 픽셀로 나눈다.
  const handleLayout = (event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    setBoxWidth(Math.floor((width - GAP * (COLUMNS - 1)) / COLUMNS));
  };

  // 예산에 없는 카테고리는 그리지 않는다. 눌러도 갈 곳이 없다.
  const visible = DISPLAY_ORDER.filter((code) => byCode.has(code));

  return (
    <View
      className="flex-row flex-wrap"
      style={{ gap: GAP }}
      onLayout={handleLayout}
    >
      {visible.map((code) => (
        <Pressable
          key={code}
          accessibilityRole="button"
          accessibilityLabel={`${CATEGORY_CODE_LABEL[code]} 예산 상세`}
          onPress={() => onSelect(byCode.get(code)!.id)}
          className="active:bg-gray-50"
          style={{
            width: boxWidth || undefined,
            height: 109,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: "#e6e9ed",
            backgroundColor: "#fff",
            paddingVertical: 11,
            paddingHorizontal: 9,
            justifyContent: "space-between",
          }}
        >
          <Text style={{ fontSize: 21 }}>{CATEGORY_EMOJI[code]}</Text>
          <View>
            <Text
              numberOfLines={1}
              style={{
                fontSize: 10,
                fontWeight: "800",
                letterSpacing: -0.3,
                color: "#111827",
              }}
            >
              {CATEGORY_CODE_LABEL[code]}
            </Text>
            <Text
              numberOfLines={1}
              style={{ fontSize: 8, color: "#98a1ad", marginTop: 4 }}
            >
              예산 확인 ›
            </Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}
