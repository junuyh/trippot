// ============================================================================
// FUND-01 현재 여행자금 (시안 v3)
//
// 대표 금액은 **지금 쓸 수 있는 돈**이다.
//   현재 사용할 수 있는 여행자금 = 누적 입금 − 여행 지출
//
// ⚠️ 사용자가 이 금액을 직접 고칠 수 없다. 거래로만 움직인다.
//    잔액을 손으로 덮어쓰게 두면 "언제 얼마를 모았는지" 가 사라져
//    하루 얼마씩 모으면 되는지도, 결산·개인화에 쓸 데이터도 만들어지지 않는다.
//
// ⚠️ **앞으로 필요한 금액은 목표 − 누적 입금**이다. 잔액 기준이 아니다.
//    이미 모은 돈을 항공권에 썼다고 해서 더 모아야 할 돈이 늘지 않는다.
//    이 값은 BUDGET-01 의 '앞으로 필요한 금액' 과 같은 계산이어야 한다.
//
// ⚠️ 2026-09-02 · 시안 v3 · 준비율 막대를 걷어냈다.
//    진행률은 BUDGET-01 준비 단계와 TRIP-HOME 보딩패스가 말한다.
//    여기서 또 그리면 잔액 기준인지 누적 기준인지 헷갈리는 세 번째 막대가 된다.
// ============================================================================
import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

import type { CountryTheme } from "@/lib/constants/countryTheme";

type Props = {
  theme: CountryTheme;
  /** 누적 입금. 결제해도 줄지 않는다 */
  raisedAmount: number;
  /** 현재 사용할 수 있는 여행자금 = 누적 입금 − 여행 지출 */
  balanceAmount: number;
  /** BUDGET-01 과 같은 목표 여행비 */
  targetAmount: number;
  /** 여행 지출 합계 (환불 완료·취소 제외) */
  spentAmount: number;
  /**
   * 없으면 '입금 기록' 버튼을 내린다.
   *
   * ⚠️ 확정 뒤에 입출금을 더 적으면 이미 남은 결산 스냅샷과 어긋난다.
   *    화면은 "확정됐어요" 라고 해 놓고 기록 버튼은 살아 있었다.
   *    (2026-09-21 2차) 거래 상세는 이미 같은 이유로 막고 있었다.
   *
   * ⚠️ 결산 중(ENDED)에는 **지출만 열고 입금은 닫는다.** (2026-09-21 4차)
   *    여행에서 돌아와 마지막 날 지출을 적는 일은 실제로 있지만, 이미
   *    끝난 여행에 돈을 더 모을 일은 없다.
   */
  onRecordDeposit?: () => void;
  /** 없으면 '지출 기록' 버튼을 내린다 */
  onRecordExpense?: () => void;
  /**
   * 기록을 막은 이유. 왜 버튼이 줄었는지 적는다. 결산 중과 확정은 이유가 다르다.
   * 확정은 "확정 시점의 기록", 결산 중은 "지출은 그대로 된다" 가 핵심이다.
   */
  lockNote?: string | null;
};

function won(value: number): string {
  return `${value.toLocaleString("ko-KR")}원`;
}

export function FundSummaryCard({
  theme,
  raisedAmount,
  balanceAmount,
  targetAmount,
  spentAmount,
  onRecordDeposit,
  onRecordExpense,
  lockNote = null,
}: Props) {
  const actions = [
    ...(onRecordDeposit
      ? [
          {
            label: "입금 기록",
            icon: "add-circle-outline" as const,
            onPress: onRecordDeposit,
            tone: theme.primary,
          },
        ]
      : []),
    ...(onRecordExpense
      ? [
          {
            label: "지출 기록",
            icon: "remove-circle-outline" as const,
            onPress: onRecordExpense,
            tone: "#66707e",
          },
        ]
      : []),
  ];
  const needed = Math.max(0, targetAmount - raisedAmount);

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: "#e8eaee",
        borderRadius: 17,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          backgroundColor: "#f6f7f9",
          paddingHorizontal: 18,
          paddingTop: 17,
          paddingBottom: 16,
        }}
      >
        <Text style={{ fontSize: 11, color: "#7c8695" }}>
          현재 사용할 수 있는 여행자금
        </Text>
        <Text
          style={{
            marginTop: 3,
            fontSize: 33,
            lineHeight: 39,
            fontWeight: "900",
            letterSpacing: -1.5,
            color: "#141b28",
          }}
        >
          {balanceAmount.toLocaleString("ko-KR")}
          <Text style={{ fontSize: 14, letterSpacing: 0 }}>원</Text>
        </Text>
        <Text style={{ marginTop: 7, fontSize: 10, color: "#949daa" }}>
          누적 입금에서 여행 지출을 뺀 금액이에요. 직접 고칠 수 없고 기록으로만
          바뀌어요.
        </Text>
      </View>

      <View
        style={{
          flexDirection: "row",
          paddingVertical: 14,
          paddingHorizontal: 18,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 9, color: "#858e9c" }}>누적 입금</Text>
          <Text
            style={{
              marginTop: 4,
              fontSize: 13,
              fontWeight: "800",
              color: "#141b28",
            }}
          >
            {won(raisedAmount)}
          </Text>
        </View>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={{ fontSize: 9, color: "#858e9c" }}>여행 지출</Text>
          <Text
            style={{
              marginTop: 4,
              fontSize: 13,
              fontWeight: "800",
              color: "#141b28",
            }}
          >
            {won(spentAmount)}
          </Text>
        </View>
        <View style={{ flex: 1, alignItems: "flex-end" }}>
          <Text style={{ fontSize: 9, color: "#858e9c" }}>
            앞으로 필요한 금액
          </Text>
          <Text
            style={{
              marginTop: 4,
              fontSize: 13,
              fontWeight: "800",
              color: theme.primary,
            }}
          >
            {targetAmount <= 0
              ? "목표 미설정"
              : needed > 0
                ? won(needed)
                : "다 모았어요"}
          </Text>
          {/*
            ⚠️ 계산식은 '앞으로 필요한 금액' **바로 아래**에 붙인다.
               (2026-09-21 2차) 처음에는 카드 맨 밑에 왼쪽 정렬로 뒀는데,
               위 숫자와 떨어져 있어서 그 숫자의 근거라는 게 읽히지 않았다.
               같은 칸 · 같은 정렬이어야 한 덩어리로 보인다.
          */}
          {targetAmount > 0 ? (
            <Text
              style={{
                marginTop: 4,
                fontSize: 9,
                lineHeight: 13,
                color: "#a2aab5",
                textAlign: "right",
              }}
            >
              목표 {won(targetAmount)}
              {"\n"}− 입금 {won(raisedAmount)}
            </Text>
          ) : null}
        </View>
      </View>

      {/*
        ⚠️ 안내와 버튼은 **함께** 나올 수 있다. 결산 중에는 '입금 기록' 만
           내려가고 '지출 기록' 은 남는데, 버튼이 왜 하나로 줄었는지
           적어 두지 않으면 사라진 쪽을 사용자가 찾아다닌다.
      */}
      {lockNote ? (
        <View
          style={{
            borderTopWidth: 1,
            borderColor: "#eceef1",
            paddingHorizontal: 18,
            paddingVertical: 14,
          }}
        >
          <Text style={{ fontSize: 11, lineHeight: 17, color: "#5d6674" }}>
            {lockNote}
          </Text>
        </View>
      ) : null}

      {actions.length > 0 ? (
      <View
        style={{
          flexDirection: "row",
          borderTopWidth: 1,
          borderColor: "#eceef1",
        }}
      >
        {actions.map((action, index) => (
          <Pressable
            key={action.label}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            onPress={action.onPress}
            className="active:bg-gray-50"
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
              paddingVertical: 14,
              borderLeftWidth: index === 1 ? 1 : 0,
              borderColor: "#eceef1",
            }}
          >
            <Ionicons name={action.icon} size={15} color={action.tone} />
            <Text
              style={{ fontSize: 12, fontWeight: "800", color: action.tone }}
            >
              {action.label}
            </Text>
          </Pressable>
        ))}
      </View>
      ) : null}
    </View>
  );
}
