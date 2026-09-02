// ============================================================================
// SETTLE-01 주요 지출 — 큰 금액순 (시안 v2)
//
// 결산에서 "어디에 제일 많이 썼나" 는 카테고리 합계가 아니라 **거래 한 건**으로
// 기억된다. 숙소 120만원이 아니라 '시부야 호텔 3박' 이다.
//
// ⚠️ 확인이 필요한 거래는 여기 넣지 않는다. 분류가 안 끝난 금액을
//    '주요 지출' 로 세우면 결산이 확정되면서 목록이 바뀐다.
// ============================================================================
import { format, parseISO } from "date-fns";
import { Pressable, Text, View } from "react-native";

import { CATEGORY_EMOJI } from "@/lib/constants/categoryEmoji";
import { CATEGORY_CODE_LABEL, type CategoryCode } from "@/lib/constants/status";

export type MajorExpense = {
  id: string;
  name: string;
  amount: number;
  occurredAt: string;
  /** 없으면 미분류 */
  categoryCode: CategoryCode | null;
  /** 계획에 연결됐는가 */
  linked: boolean;
};

type Props = {
  expenses: MajorExpense[];
  onSelect: (transactionId: string) => void;
};

export function MajorExpenseList({ expenses, onSelect }: Props) {
  if (expenses.length === 0) {
    return (
      <View
        style={{
          borderWidth: 1,
          borderColor: "#e8eaee",
          borderRadius: 15,
          paddingVertical: 22,
          alignItems: "center",
        }}
      >
        <Text style={{ fontSize: 11, color: "#858e9c" }}>
          아직 확정된 지출이 없어요.
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: "#e8eaee",
        borderRadius: 15,
        overflow: "hidden",
      }}
    >
      {expenses.map((expense, index) => (
        <Pressable
          key={expense.id}
          accessibilityRole="button"
          accessibilityLabel={`${expense.name} 거래 상세`}
          onPress={() => onSelect(expense.id)}
          className="flex-row items-center active:bg-gray-50"
          style={{
            gap: 9,
            padding: 14,
            borderTopWidth: index === 0 ? 0 : 1,
            borderColor: "#eef0f3",
          }}
        >
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 9,
              backgroundColor: "#f5f6f8",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 16 }}>
              {expense.categoryCode
                ? CATEGORY_EMOJI[expense.categoryCode]
                : "❓"}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text
              numberOfLines={1}
              style={{ fontSize: 11, fontWeight: "700", color: "#141b28" }}
            >
              {expense.name}
            </Text>
            <Text style={{ marginTop: 3, fontSize: 8, color: "#858e9c" }}>
              {format(parseISO(expense.occurredAt), "MM.dd")}
              {" · "}
              {expense.categoryCode
                ? CATEGORY_CODE_LABEL[expense.categoryCode]
                : "미분류"}
              {" · "}
              {expense.linked ? "계획 연결" : "계획 미연결"}
            </Text>
          </View>
          <Text style={{ fontSize: 11, fontWeight: "800", color: "#141b28" }}>
            {expense.amount.toLocaleString("ko-KR")}원
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
