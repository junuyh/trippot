// ============================================================================
// SETTLE-01 정산 요약 — 목표 vs 실제
//
// 여행이 끝난 뒤 "우리 계획대로 썼나?" 에 답한다.
// 이 화면의 결과가 다음 여행 개인화로 이어진다. (핵심 루프의 마지막 칸)
//
// ⚠️ 2026-09-03 · 파랑/빨강 단색 카드를 걷어냈다. (시안)
//    화면 맨 위를 색면으로 덮으면 그 아래 흰 카드들과 톤이 갈라지고,
//    초과했을 때 빨간 판 전체가 실패처럼 읽혔다. 이제 흰 카드에 숫자만
//    두고, 늘고 줄었다는 사실은 **한 줄 문장의 색**으로만 말한다.
//
// ⚠️ 최종 사용 금액을 가장 크게 둔다. 차액이 아니다. 사용자가 이 화면에서
//    가장 먼저 찾는 숫자는 "그래서 얼마 썼지" 다.
// ============================================================================
import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

type Props = {
  targetAmount: number;
  actualAmount: number;
  headcount: number;
  /** 정산에 잡힌 확정 지출 건수 */
  confirmedCount: number;
  /** 아직 확인할 거래가 남았는지. 남아 있으면 초록 배너를 그리지 않는다 */
  allConfirmed: boolean;
};

const SAVED = "#18865e";
const OVER = "#d64550";
const INK = "#121a2a";

function won(value: number): string {
  return `${value.toLocaleString("ko-KR")}원`;
}

export function SettlementSummaryCard({
  targetAmount,
  actualAmount,
  headcount,
  confirmedCount,
  allConfirmed,
}: Props) {
  const difference = actualAmount - targetAmount;
  const saved = difference < 0;
  const same = difference === 0;
  const accent = same ? INK : saved ? SAVED : OVER;

  /**
   * 예산 사용률.
   * ⚠️ 목표가 0 이면 나눌 수 없다. 100% 로 만들지 않는다 — 목표를 안 정한
   *    여행에 "예산을 다 썼다" 고 말하는 셈이 된다.
   */
  const usageRate =
    targetAmount > 0 ? ((actualAmount / targetAmount) * 100).toFixed(1) : null;

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: "#e8eaee",
        borderRadius: 18,
        backgroundColor: "#fff",
        padding: 20,
      }}
    >
      <Text
        style={{
          fontSize: 9,
          fontWeight: "900",
          letterSpacing: 1.2,
          color: "#a8afb9",
        }}
      >
        FINAL TRIP SETTLEMENT
      </Text>

      <Text style={{ marginTop: 14, fontSize: 12, color: "#7c8695" }}>
        최종 사용 금액
      </Text>
      <Text
        style={{
          marginTop: 4,
          fontSize: 34,
          lineHeight: 40,
          fontWeight: "900",
          letterSpacing: -1.2,
          color: INK,
          fontVariant: ["tabular-nums"],
        }}
      >
        {actualAmount.toLocaleString("ko-KR")}
        <Text style={{ fontSize: 14, fontWeight: "800", letterSpacing: 0 }}>
          원
        </Text>
      </Text>

      <Text
        style={{ marginTop: 6, fontSize: 12, fontWeight: "800", color: accent }}
      >
        {same
          ? "목표한 금액에 딱 맞췄어요"
          : `목표보다 ${Math.abs(difference).toLocaleString("ko-KR")}원 ${saved ? "절약했어요" : "더 썼어요"}`}
      </Text>

      <View
        style={{
          marginTop: 18,
          paddingTop: 16,
          borderTopWidth: 1,
          borderTopColor: "#eef0f3",
        }}
        className="flex-row"
      >
        <Stat label="목표 여행비" value={won(targetAmount)} />
        <Stat
          label="예산 사용률"
          value={usageRate ? `${usageRate}%` : "—"}
          color={same ? INK : accent}
          divider
        />
        <Stat label="확정 지출" value={`${confirmedCount}건`} divider />
      </View>

      {headcount > 1 ? (
        <Text style={{ marginTop: 14, fontSize: 11, color: "#8b94a2" }}>
          1인 {won(Math.round(actualAmount / headcount / 1000) * 1000)} 썼어요
        </Text>
      ) : null}

      {/*
        ⚠️ 확인할 거래가 남아 있으면 그리지 않는다. 아직 분류가 끝나지 않은
           상태에서 "확인이 완료됐어요" 는 사실이 아니다.
      */}
      {allConfirmed ? (
        <View
          className="flex-row items-center"
          style={{
            gap: 7,
            marginTop: 16,
            borderRadius: 10,
            backgroundColor: "#eef8f2",
            paddingHorizontal: 13,
            paddingVertical: 12,
          }}
        >
          <Ionicons name="checkmark-circle" size={15} color={SAVED} />
          <Text style={{ fontSize: 11, fontWeight: "700", color: "#1c6f4f" }}>
            모든 지출 확인이 완료됐어요
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function Stat({
  label,
  value,
  color,
  divider,
}: {
  label: string;
  value: string;
  color?: string;
  divider?: boolean;
}) {
  return (
    <View
      style={{
        flex: 1,
        paddingLeft: divider ? 12 : 0,
        borderLeftWidth: divider ? 1 : 0,
        borderLeftColor: "#eef0f3",
      }}
    >
      <Text style={{ fontSize: 10, color: "#98a1ad" }}>{label}</Text>
      <Text
        numberOfLines={1}
        style={{
          marginTop: 5,
          fontSize: 13,
          fontWeight: "800",
          color: color ?? INK,
        }}
      >
        {value}
      </Text>
    </View>
  );
}
