// ============================================================================
// BUDGET-02 세부 계획 목록 (시안 v3)
//
// 항목을 **왼쪽으로 밀면 수정 / 삭제**가 나온다.
//
// ⚠️ 2026-09-02 · 시안 v3 · **체크 기능을 걷어냈다.**
//    '계획에서 빼기(체크 해제)' 와 '삭제' 는 사용자 입장에서 결과가 같았다.
//    둘 다 그 금액이 예산에서 빠진다. 꺼진 채 목록에 남은 항목은
//    "이건 왜 여기 있지" 만 남기고, 세부 계획 합계를 읽기 어렵게 만들었다.
//    이제 목록에 있는 항목은 전부 계획에 포함된다.
//
// ⚠️ 실제 지출이 연결된 항목은 **수정도 삭제도 막는다.**
//    이미 쓴 돈이 달린 계획을 고치거나 없애면 '계획에 없는 지출' 이 생겨
//    계획 대비 실제 비교가 성립하지 않는다.
//    연결 해제는 지출 상세 화면에서만 한다. (스펙)
//
// ⚠️ 여유 예산은 DB 행이 아니라 **설정 예산 − 계획 합계**다.
//    전체 여행 공통 '예비비' 카테고리와 헷갈리지 않게 이름을 다르게 쓴다. (스펙)
// ============================================================================
import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import type { SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import { useRef } from "react";

import type { CountryTheme } from "@/lib/constants/countryTheme";
import {
  PLAN_DISPLAY_MODE,
  type PlanDisplayMode,
} from "@/lib/constants/status";

const GREEN = "#19865f";
const SUB = "#858e9c";
const LINE = "#e5e8ec";

export type PlanItem = {
  id: string;
  name: string;
  expectedAmount: number;
  actualAmount: number;
  emoji: string;
  /** 금액을 총액으로 보여줄지 1인당 × 인원으로 보여줄지. 총액은 바뀌지 않는다 */
  displayMode: PlanDisplayMode;
  /**
   * 실제 지출과 연결된 항목인가.
   * 연결되면 잠긴다 — 수정도 삭제도 못 한다.
   */
  locked: boolean;
};

export type PlanDraft = {
  name: string;
  /** 언제나 **총액**이다. 1인당으로 보여주더라도 저장되는 값은 총액이다 */
  amount: number | null;
  displayMode: PlanDisplayMode;
};

type Props = {
  items: PlanItem[];
  headcount: number;
  theme: CountryTheme;
  /**
   * 설정 예산 − 계획 합계. **0 이하면 행을 그리지 않는다.**
   * 계산값이라 수정·삭제(스와이프)가 없다. 계획 항목처럼 보이지만 항목이 아니다.
   */
  reserveAmount: number;
  /** 없으면 수정·삭제를 막는다 (결산 중·완료) */
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  /** 연결된 항목을 누르면 지출 상세로 간다 */
  onOpenLinked: (id: string) => void;
  /** 없으면 '계획 항목 추가' 를 감춘다 (결산 중·완료) */
  onStartAdd?: () => void;
};

function won(value: number): string {
  return `${value.toLocaleString("ko-KR")}원`;
}

/** '총액 기준' 또는 '50,000원 × 4명'. 총액을 인원으로 나눠 보여줄 뿐이다 */
function amountCaption(item: PlanItem, headcount: number): string {
  if (item.displayMode !== PLAN_DISPLAY_MODE.PER_PERSON || headcount <= 0)
    return "총액 기준";
  return `${won(Math.round(item.expectedAmount / headcount))} × ${headcount}명`;
}

export function PlanItemCard({
  items,
  headcount,
  theme,
  reserveAmount,
  onEdit,
  onDelete,
  onOpenLinked,
  onStartAdd,
}: Props) {
  const swipeRefs = useRef(new Map<string, SwipeableMethods | null>());

  return (
    <View style={{ gap: 9 }}>
      {items.map((item) =>
        item.locked || !onEdit ? (
          // ── 실제 지출과 연결된 계획 ──────────────────────────────────
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={`${item.name} 지출 상세 보기`}
            onPress={() => onOpenLinked(item.id)}
            className="active:opacity-70"
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              minHeight: 96,
              padding: 10,
              borderWidth: 1,
              borderColor: "#d9dde3",
              borderRadius: 14,
              backgroundColor: "#fbfcfd",
            }}
          >
            <View
              style={{
                width: 45,
                height: 45,
                borderRadius: 11,
                backgroundColor: "#eef2f7",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 22 }}>{item.emoji}</Text>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 9, fontWeight: "900", color: GREEN }}>
                결제 완료 · 지출 연결됨
              </Text>
              <Text
                style={{
                  marginTop: 4,
                  fontSize: 12,
                  fontWeight: "700",
                  color: "#111827",
                }}
              >
                {item.name}
              </Text>
              <Text style={{ marginTop: 4, fontSize: 9, color: SUB }}>
                예상 {won(item.expectedAmount)}
              </Text>
              <Text
                style={{
                  marginTop: 7,
                  fontSize: 9,
                  fontWeight: "800",
                  color: "#657080",
                }}
              >
                지출 상세 보기 ›
              </Text>
            </View>

            <View style={{ alignItems: "flex-end", minWidth: 86 }}>
              <Text
                style={{ fontSize: 11, fontWeight: "700", color: "#111827" }}
              >
                실제 {won(item.actualAmount)}
              </Text>
              {/*
                예상과 실제의 차액. 아낀 건 그린, 더 쓴 건 포인트 컬러.
                금액이 같으면 알려줄 게 없다.
              */}
              {item.actualAmount !== item.expectedAmount ? (
                <Text
                  style={{
                    marginTop: 5,
                    fontSize: 9,
                    fontWeight: "900",
                    color:
                      item.actualAmount > item.expectedAmount
                        ? theme.primary
                        : GREEN,
                  }}
                >
                  {won(Math.abs(item.expectedAmount - item.actualAmount))}{" "}
                  {item.actualAmount > item.expectedAmount ? "초과" : "절약"}
                </Text>
              ) : null}
              <Ionicons
                name="lock-closed"
                size={11}
                color="#929aa6"
                style={{ marginTop: 7 }}
              />
            </View>
          </Pressable>
        ) : (
          // ── 일반 계획 ────────────────────────────────────────────────
          <Swipeable
            key={item.id}
            ref={(node) => {
              if (node) swipeRefs.current.set(item.id, node);
              else swipeRefs.current.delete(item.id);
            }}
            overshootRight={false}
            renderRightActions={() => (
              // 수정이 왼쪽, 삭제가 오른쪽(끝)이다. 되돌릴 수 없는 쪽을
              // 바깥에 두어야 손가락이 미끄러져도 삭제가 먼저 눌리지 않는다.
              <View className="flex-row">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${item.name} 수정`}
                  onPress={() => {
                    swipeRefs.current.get(item.id)?.close();
                    onEdit?.(item.id);
                  }}
                  style={{
                    width: 68,
                    backgroundColor: "#526274",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="create-outline" size={16} color="#fff" />
                  <Text
                    style={{
                      marginTop: 3,
                      fontSize: 11,
                      fontWeight: "800",
                      color: "#fff",
                    }}
                  >
                    수정
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${item.name} 삭제`}
                  onPress={() => {
                    swipeRefs.current.get(item.id)?.close();
                    onDelete?.(item.id);
                  }}
                  style={{
                    width: 68,
                    backgroundColor: theme.primary,
                    alignItems: "center",
                    justifyContent: "center",
                    borderTopRightRadius: 14,
                    borderBottomRightRadius: 14,
                  }}
                >
                  <Ionicons
                    name="trash-outline"
                    size={16}
                    color={theme.onPrimary}
                  />
                  <Text
                    style={{
                      marginTop: 3,
                      fontSize: 11,
                      fontWeight: "800",
                      color: theme.onPrimary,
                    }}
                  >
                    삭제
                  </Text>
                </Pressable>
              </View>
            )}
          >
            {/*
              ⚠️ 카드는 항상 불투명하다. 뒤의 수정·삭제 배경이 비치면
                 모든 항목이 빨갛게 물든 것처럼 보인다.
            */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                minHeight: 72,
                padding: 10,
                borderWidth: 1,
                borderColor: LINE,
                borderRadius: 14,
                backgroundColor: "#fff",
              }}
            >
              <View
                style={{
                  width: 45,
                  height: 45,
                  borderRadius: 11,
                  backgroundColor: "#f2f4f7",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontSize: 22 }}>{item.emoji}</Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text
                  style={{ fontSize: 12, fontWeight: "700", color: "#111827" }}
                >
                  {item.name}
                </Text>
                <Text style={{ marginTop: 4, fontSize: 9, color: SUB }}>
                  {amountCaption(item, headcount)}
                </Text>
              </View>

              <View style={{ alignItems: "flex-end" }}>
                <Text
                  style={{ fontSize: 11, fontWeight: "700", color: "#111827" }}
                >
                  {won(item.expectedAmount)}
                </Text>
                {/* 스와이프를 모르는 사람이 있다. 있다는 사실만 조용히 알린다 */}
                <Text style={{ marginTop: 5, fontSize: 8, color: "#b3bac4" }}>
                  ← 밀어서 수정·삭제
                </Text>
              </View>
            </View>
          </Swipeable>
        ),
      )}

      {/* ── 여유 예산 ── 설정 예산에서 계획 합계를 뺀 차액이다 ── */}
      {reserveAmount > 0 ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            minHeight: 72,
            padding: 10,
            borderWidth: 1,
            borderColor: LINE,
            borderRadius: 14,
            backgroundColor: "#fff",
          }}
        >
          <View
            style={{
              width: 45,
              height: 45,
              borderRadius: 11,
              backgroundColor: "#fff7e8",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 22 }}>🪙</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#111827" }}>
              여유 예산
            </Text>
            <Text style={{ marginTop: 4, fontSize: 9, color: "#9a7a37" }}>
              예상 밖 비용에 대비해요
            </Text>
          </View>
          <Text style={{ fontSize: 11, fontWeight: "700", color: "#111827" }}>
            {won(reserveAmount)}
          </Text>
        </View>
      ) : null}

      {onStartAdd ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="계획 항목 추가"
          onPress={onStartAdd}
          /**
           * 이 화면에서 가장 많이 누르는 버튼이라 목록 카드에 묻히면 안 된다.
           * 모양은 원래대로 사각형을 쓰되, 선·글자·＋ 를 여행지 색으로 올리고
           * 글자를 키워 버튼으로 보이게 한다. (2026-09-18)
           *
           * ⚠️ 점선(dashed)을 쓰지 않는다. iOS 는 모서리를 둥글린 상자에 점선을
           *    그리지 못해 **테두리가 통째로 사라진다.** 실제로 그 상태라 글자만
           *    떠 있어 버튼으로 보이지 않았다. 실선으로 그린다.
           */
          className="active:opacity-70"
          style={{
            marginTop: 4,
            borderWidth: 1.5,
            borderColor: theme.primary,
            borderRadius: 13,
            backgroundColor: theme.primarySoft,
            paddingVertical: 15,
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: "800", color: theme.primary }}>
            ＋ 계획 항목 추가
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
