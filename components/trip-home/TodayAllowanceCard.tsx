// ============================================================================
// TODAY 카드 — 오늘 쓸 수 있는 돈 (TRIP-HOME-01 · 여행 중에만)
//
// 수하물 태그 바로 아래에 선다. 태그는 "얼마 모였나", 이 카드는 "오늘 얼마 써도
// 되나" 를 말한다. 여행 중인 사람이 홈을 여는 이유는 사실 이 숫자 하나다.
//
// 모양은 홈의 다른 카드와 같다: 흰 카드 · 하늘선 테두리 · 영문 눈썹 · 큰 등폭
// 숫자 · 얇은 진행 막대 하나. 색은 국기색(진행)과 결과색(초과=국기색)뿐.
//
//   TODAY · D3 / 6
//   오늘 쓸 수 있는 돈
//   84,000원
//   ▮▮▮▮▮▮▯▯▯▯  오늘 32,000원 썼어요 · 52,000원 남음
//   ───────────────────────────────────────────
//   남은 예산 1,240,000원 │ 남은 날 4일 │ 하루 기준 84,000원
//   [📷 영수증으로 기록]  [직접 입력]
//
// ⚠️ 이 컴포넌트는 supabase 도 track() 도 부르지 않는다. (CLAUDE.md 9장)
// ============================================================================
import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

import type { DailyAllowance } from "@/lib/budget/dailyAllowance";
import type { CountryTheme } from "@/lib/constants/countryTheme";

const INK = "#111827";
const MUTED = "#8b94a2";
const HAIR = "#eef0f3";
const NUM = { fontVariant: ["tabular-nums" as const] };

function won(value: number): string {
  return `${value.toLocaleString("ko-KR")}원`;
}

type Props = {
  theme: CountryTheme;
  allowance: DailyAllowance;
  /** 여행 전체 일수. 'D3 / 6' 의 6 */
  totalDays: number;
  /** 직접 입력으로 기록 (여행자금 화면) */
  onPressRecord: () => void;
  /** 영수증 찍어서 기록 (여행자금 화면이 곧바로 사진을 받는다) */
  onPressReceipt: () => void;
};

export function TodayAllowanceCard({ theme, allowance, totalDays, onPressRecord, onPressReceipt }: Props) {
  const over = allowance.todayLeft < 0;
  const ratio =
    allowance.allowance > 0 ? Math.min(1, allowance.spentToday / allowance.allowance) : 1;

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: "#e8eaee",
        borderRadius: 18,
        backgroundColor: "#fff",
        padding: 18,
      }}
    >
      <View className="flex-row items-center justify-between">
        <Text style={{ fontSize: 9, fontWeight: "900", letterSpacing: 1.3, color: theme.primary }}>
          TODAY · D{allowance.dayIndex} / {totalDays}
        </Text>
      </View>

      <Text style={{ marginTop: 12, fontSize: 12, color: MUTED }}>오늘 쓸 수 있는 돈</Text>
      <Text
        style={{
          marginTop: 2,
          fontSize: 32,
          lineHeight: 38,
          fontWeight: "900",
          letterSpacing: -1.2,
          color: INK,
          ...NUM,
        }}
      >
        {allowance.allowance.toLocaleString("ko-KR")}
        <Text style={{ fontSize: 14, fontWeight: "800", letterSpacing: 0 }}>원</Text>
      </Text>

      {/* 오늘 진행. 넘기면 국기색으로 꽉 찬다 */}
      <View
        style={{
          marginTop: 12,
          height: 8,
          borderRadius: 4,
          backgroundColor: HAIR,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: `${ratio * 100}%`,
            height: "100%",
            borderRadius: 4,
            backgroundColor: over ? theme.primary : theme.neutral,
          }}
        />
      </View>
      <Text
        style={{
          marginTop: 7,
          fontSize: 11,
          fontWeight: "700",
          color: over ? theme.primary : MUTED,
          ...NUM,
        }}
      >
        {allowance.spentToday === 0
          ? "아직 오늘 지출을 적지 않았어요"
          : over
            ? `오늘 ${won(allowance.spentToday)} 썼어요 · 기준보다 ${won(-allowance.todayLeft)} 넘김`
            : `오늘 ${won(allowance.spentToday)} 썼어요 · ${won(allowance.todayLeft)} 남음`}
      </Text>

      <View
        className="flex-row"
        style={{ marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: HAIR }}
      >
        <Stat label="남은 예산" value={won(allowance.remainingBudget)} />
        <Stat label="남은 날" value={`${allowance.daysLeft}일`} divider />
        <Stat label="하루 기준" value={won(allowance.allowance)} divider />
      </View>

      {/*
        영수증으로 기록 — 여행 중 지출 기록의 가장 짧은 길.
        사진 한 장이면 가맹점·금액·날짜가 채워진다. 직접 입력은 옆의 작은 버튼.
      */}
      <View className="flex-row" style={{ marginTop: 14, gap: 8 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="영수증으로 지출 기록하기"
          onPress={onPressReceipt}
          className="flex-row items-center justify-center active:opacity-90"
          style={{
            flex: 1,
            gap: 6,
            height: 44,
            borderRadius: 12,
            backgroundColor: theme.neutral,
          }}
        >
          <Ionicons name="camera-outline" size={16} color="#fff" />
          <Text style={{ fontSize: 13, fontWeight: "800", color: "#fff" }}>영수증으로 기록</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="직접 입력으로 지출 기록하기"
          onPress={onPressRecord}
          className="items-center justify-center active:bg-gray-100"
          style={{
            paddingHorizontal: 14,
            height: 44,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "#e8eaee",
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: "700", color: INK }}>직접 입력</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Stat({ label, value, divider }: { label: string; value: string; divider?: boolean }) {
  return (
    <View
      style={{
        flex: 1,
        paddingLeft: divider ? 12 : 0,
        borderLeftWidth: divider ? 1 : 0,
        borderLeftColor: HAIR,
      }}
    >
      <Text style={{ fontSize: 10, color: "#98a1ad" }}>{label}</Text>
      <Text numberOfLines={1} style={{ marginTop: 4, fontSize: 12, fontWeight: "800", color: INK, ...NUM }}>
        {value}
      </Text>
    </View>
  );
}
