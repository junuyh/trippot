// ============================================================================
// BUDGET-01 상단 요약 — 목표 여행비 + 여행자금 준비 단계 (시안 v3)
//
// 위쪽은 옅은 회색에 목표 여행비, 아래쪽은 흰 바탕에 준비된 자금 ·
// 앞으로 필요한 금액 · 준비 단계 4개 · 다음 단계까지 필요한 금액.
//
// ⚠️ **준비 단계는 실제 자금 분리가 아니다.** 계좌에서 카테고리별로 돈을
//    나눈 값이 아니라 결제 예정 순서에 따른 가상 배분이다.
//    화면 아래 안내 문구를 지우지 않는다. 지우면 사용자는 항공비가 따로
//    떼어져 있다고 믿고, 그 돈을 다른 데 써 버린다.
//
// ⚠️ 금액을 축약하지 않는다. 174천이 아니라 174,000원이다. (스펙)
// ⚠️ 실제 지출 그래프를 넣지 않는다. 이 화면은 계획을 보는 자리다.
//
// ⚠️ 2026-09-02 · 시안 v3 · 준비율 막대(경로)를 걷어냈다.
//    같은 진행도를 퍼센트 막대와 단계 트랙 두 번 그리면
//    "지금 어디까지 왔나" 의 답이 둘이 된다.
// ============================================================================
import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

import type { CountryTheme } from "@/lib/constants/countryTheme";
import type { JourneyStage } from "@/lib/budget/vault";

type Props = {
  theme: CountryTheme;
  /** 카테고리별 설정 예산의 합계 */
  targetAmount: number;
  /**
   * 누적 모금액. 지금까지 실제로 모은 총금액이다.
   * ⚠️ 모임통장에서 결제해도 이 값은 줄지 않는다. (스펙 데이터 정의)
   */
  raisedAmount: number;
  /** 0~100 */
  progress: number;

  /** 준비 단계 4개. lib/budget/vault.ts journeyStages() 가 만든다 */
  stages: JourneyStage[];

  /** '현재 준비된 자금' 을 누르면 여행자금 관리(FUND-01)로 간다 */
  onPressFund?: () => void;
  /** '○○원 더 필요' 를 누르면 여행자금 관리(FUND-01)로 간다 */
  onPressNextGoal?: () => void;
};

function won(value: number): string {
  return `${value.toLocaleString("ko-KR")}원`;
}

/** 만원 단위로 줄인다. 단계 라벨은 네 칸에 나눠 들어가 자리가 없다 */
function shortWon(value: number): string {
  if (value >= 10000)
    return `${Math.round(value / 10000).toLocaleString("ko-KR")}만원`;
  return `${value.toLocaleString("ko-KR")}원`;
}

export function BudgetTicketCard({
  theme,
  targetAmount,
  raisedAmount,
  progress,
  stages,
  onPressFund,
  onPressNextGoal,
}: Props) {
  const needed = Math.max(0, targetAmount - raisedAmount);
  const percent = Math.round(progress);
  const done = needed === 0 && targetAmount > 0;

  // 아직 못 채운 첫 단계. 없으면 전부 확보한 것이다.
  const nextStage = stages.find((stage) => !stage.reached) ?? null;
  const nextShortage = nextStage
    ? Math.max(0, nextStage.threshold - raisedAmount)
    : 0;

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: "#e8eaee",
        borderRadius: 17,
        overflow: "hidden",
        backgroundColor: "#fff",
      }}
    >
      <View
        style={{
          backgroundColor: "#f6f7f9",
          paddingHorizontal: 18,
          paddingTop: 17,
          paddingBottom: 15,
        }}
      >
        <Text
          style={{
            fontSize: 9,
            fontWeight: "900",
            letterSpacing: 1.1,
            color: theme.primary,
          }}
        >
          TRIP BUDGET · {done ? "READY" : "PREPARING"}
        </Text>
        <Text style={{ marginTop: 13, fontSize: 11, color: "#7c8695" }}>
          목표 여행비
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
          {targetAmount.toLocaleString("ko-KR")}
          <Text style={{ fontSize: 14, letterSpacing: 0 }}>원</Text>
        </Text>
      </View>

      <View
        style={{ paddingHorizontal: 18, paddingTop: 15, paddingBottom: 17 }}
      >
        <View className="flex-row">
          {/* 자금을 더하거나 뺄 곳이 필요하다. 목록만 보는 화면이 아니다 */}
          <Pressable
            accessibilityRole={onPressFund ? "button" : undefined}
            accessibilityLabel={onPressFund ? "여행자금 관리" : undefined}
            disabled={!onPressFund}
            onPress={onPressFund}
            style={{ flex: 1 }}
            className={onPressFund ? "active:opacity-60" : undefined}
          >
            <Text style={{ fontSize: 10, color: "#7c8695" }}>
              현재 준비된 자금
            </Text>
            <View
              className="flex-row items-center"
              style={{ gap: 3, marginTop: 3 }}
            >
              <Text
                style={{ fontSize: 14, fontWeight: "800", color: "#141b28" }}
              >
                {won(raisedAmount)}
              </Text>
              {onPressFund ? (
                <Ionicons name="chevron-forward" size={13} color="#a8afb9" />
              ) : null}
            </View>
          </Pressable>
          <View style={{ flex: 1, alignItems: "flex-end" }}>
            <Text style={{ fontSize: 10, color: "#7c8695" }}>
              앞으로 필요한 금액
            </Text>
            <Text
              style={{
                marginTop: 3,
                fontSize: 14,
                fontWeight: "800",
                color: theme.primary,
              }}
            >
              {done ? "다 모았어요" : won(needed)}
            </Text>
          </View>
        </View>

        {/* ── 준비 단계 ── */}
        <View
          className="flex-row items-end justify-between"
          style={{ marginTop: 16 }}
        >
          <Text style={{ fontSize: 11, fontWeight: "800", color: "#141b28" }}>
            여행자금 준비 단계
          </Text>
          <Text style={{ fontSize: 9, color: "#7c8695" }}>
            결제 예정 순서 기준
          </Text>
        </View>

        <View style={{ marginTop: 13, paddingTop: 17 }}>
          {/* 트랙. 좌우 7% 를 비워 첫·마지막 정거장 아이콘 아래에서 끊는다 */}
          <View
            style={{
              position: "absolute",
              left: "7%",
              right: "7%",
              top: 7,
              height: 3,
              borderRadius: 3,
              backgroundColor: "#e7eaf0",
            }}
          />
          <View
            style={{
              position: "absolute",
              left: "7%",
              top: 7,
              height: 3,
              borderRadius: 3,
              // 남은 86% 구간 안에서 움직인다
              width: `${(percent / 100) * 86}%`,
              backgroundColor: theme.primary,
            }}
          />
          <View
            style={{
              position: "absolute",
              left: `${7 + (percent / 100) * 86}%`,
              top: -5,
              marginLeft: -12.5,
              width: 25,
              height: 25,
              borderRadius: 12.5,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: theme.primary,
            }}
          >
            <Ionicons name="airplane" size={12} color={theme.onPrimary} />
          </View>

          <View className="flex-row">
            {stages.map((stage) => (
              <View key={stage.key} style={{ flex: 1, alignItems: "center" }}>
                <Text
                  style={{
                    fontSize: 17,
                    // 아직 못 채운 단계는 흐리게 둔다
                    opacity: stage.reached ? 1 : 0.4,
                  }}
                >
                  {stage.emoji}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{
                    marginTop: 4,
                    fontSize: 9,
                    fontWeight: "800",
                    color: stage.reached ? "#141b28" : "#949daa",
                  }}
                >
                  {stage.label}
                </Text>
                <Text style={{ marginTop: 2, fontSize: 8, color: "#949daa" }}>
                  {shortWon(stage.threshold)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/*
          ⚠️ 이 줄은 **모으는 행동**에 대한 안내다. 예산을 보러 가는 곳이 아니라
             자금을 넣는 곳(FUND-01)으로 보낸다.
        */}
        {onPressNextGoal && nextStage ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${nextStage.label} 단계까지 ${won(nextShortage)} 더 필요. 여행자금 관리로 이동`}
            onPress={onPressNextGoal}
            className="flex-row items-center justify-between active:opacity-70"
            style={{
              marginTop: 13,
              padding: 11,
              borderRadius: 10,
              backgroundColor: theme.primarySoft,
            }}
          >
            <Text style={{ fontSize: 10, color: "#687587" }}>
              다음 단계 · {nextStage.label} 예산
            </Text>
            <Text
              style={{ fontSize: 11, fontWeight: "900", color: theme.primary }}
            >
              {won(nextShortage)} 더 필요 ›
            </Text>
          </Pressable>
        ) : (
          <View
            style={{
              marginTop: 13,
              padding: 11,
              borderRadius: 10,
              backgroundColor: theme.primarySoft,
            }}
          >
            <Text
              style={{ fontSize: 11, fontWeight: "800", color: theme.primary }}
            >
              목표 여행비를 다 모았어요
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
