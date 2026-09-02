// BUDGET-02 실제 지출.
//
// ⚠️ 연결 계좌 정보를 이 목록에서 뺐다. 지출 항목 상세 화면에서 확인한다. (스펙)
//    카테고리 상세는 '이 카테고리에 얼마를 썼나' 를 보는 자리지
//    어느 계좌에서 나갔는지를 보는 자리가 아니다.
//
// ⚠️ 지출 직접 입력은 화면 내 폼이 아니라 바텀시트로 뺐다. (스펙)
//    지출 그래프도 이 화면에 넣지 않는다.
//
// ⚠️ 자동 분류(AUTO)와 직접 입력(USER)을 화면에서 구분한다.
//    이 구분으로 자동분류 로직의 품질을 잰다. (docs/06 §7-3)
//
// ⚠️ 계좌번호는 마스킹된 값만 받는다. (NFR-002)
//    거래명은 화면에 보여주되 이벤트 파라미터로는 보내지 않는다. (NFR-007)
import { Ionicons } from "@expo/vector-icons";
import { format, parseISO } from "date-fns";
import { Pressable, Text, View } from "react-native";

import type { CountryTheme } from "@/lib/constants/countryTheme";

export type ExpenseItem = {
  id: string;
  name: string;
  amount: number;
  occurredAt: string;
  /** true 면 연결 계좌에서 자동 분류된 거래 */
  auto: boolean;
};

/** 지출 입력값. occurredOn 은 'yyyy-MM-dd', 기본은 오늘이다 */
export type ExpenseDraft = {
  name: string;
  amount: number | null;
  occurredOn: string;
};

type Props = {
  expenses: ExpenseItem[];
  theme: CountryTheme;
  /** 지출 직접 입력 바텀시트를 연다. 없으면 버튼을 감춘다 (결산 완료) */
  onStartAdd?: () => void;
  /** 지출 항목 상세 보기. 연결 계좌와 거래 정보는 거기서 확인한다 */
  onPressDetail?: () => void;
  /** 더 있는 거래가 있으면 전체 내역으로 보낸다 */
  onPressMore?: () => void;
};

export function ExpenseCard({
  expenses,
  theme,
  onStartAdd,
  onPressDetail,
  onPressMore,
}: Props) {
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: "#e7e9ed",
        borderRadius: 15,
        overflow: "hidden",
      }}
    >
      {/* 거래 목록 */}
      {expenses.length > 0 ? (
        expenses.map((expense, index) => (
          <View
            key={expense.id}
            className="flex-row items-center gap-2.5"
            style={{
              padding: 14,
              borderTopWidth: index === 0 ? 0 : 1,
              borderColor: "#e7e9ed",
            }}
          >
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                backgroundColor: expense.auto ? "#fff0e8" : "#eef2f8",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons
                name={expense.auto ? "flash-outline" : "create-outline"}
                size={15}
                color={expense.auto ? "#d97a4a" : "#5d6674"}
              />
            </View>
            <View className="flex-1">
              <Text
                numberOfLines={1}
                style={{ fontSize: 12, fontWeight: "700", color: "#121a2a" }}
              >
                {expense.name}
              </Text>
              <Text style={{ fontSize: 9, color: "#7d8797", marginTop: 3 }}>
                {format(parseISO(expense.occurredAt), "M월 d일")} ·{" "}
                {expense.auto ? "연결 계좌" : "직접 입력"}
              </Text>
            </View>
            <View className="items-end">
              <Text
                style={{ fontSize: 12, fontWeight: "700", color: "#121a2a" }}
              >
                {expense.amount.toLocaleString("ko-KR")}원
              </Text>
              {expense.auto ? (
                <Text style={{ fontSize: 8, color: "#2d8a63", marginTop: 2 }}>
                  자동 분류
                </Text>
              ) : null}
            </View>
          </View>
        ))
      ) : (
        <View style={{ padding: 20, borderColor: "#e7e9ed" }}>
          <Text style={{ fontSize: 11, color: "#7d8797", textAlign: "center" }}>
            아직 이 카테고리의 지출이 없어요.
          </Text>
        </View>
      )}

      {/* 더보기 — 최근 몇 건만 보여주고 전체는 내역 화면으로 */}
      {onPressMore ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="지출 전체 내역 보기"
          onPress={onPressMore}
          style={{
            padding: 13,
            borderTopWidth: 1,
            borderColor: "#e7e9ed",
            backgroundColor: "#fff",
          }}
          className="flex-row items-center justify-center active:bg-gray-50"
        >
          <Text style={{ fontSize: 11, fontWeight: "700", color: "#5d6674" }}>
            전체 내역 보기
          </Text>
          <Ionicons name="chevron-forward" size={13} color="#8b94a2" />
        </Pressable>
      ) : null}

      {onStartAdd ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="지출 직접 입력"
          onPress={onStartAdd}
          style={{
            padding: 13,
            borderTopWidth: 1,
            borderColor: "#e7e9ed",
            backgroundColor: "#fff",
          }}
          className="active:bg-gray-50"
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: "900",
              color: theme.primary,
              textAlign: "center",
            }}
          >
            ＋ 지출 직접 입력
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
