// ============================================================================
// BUDGET-02 세부 계획 목록
//
// ⚠️ 삭제는 **왼쪽으로 밀었을 때만** 나온다. 체크 해제는 계획에서 빼는 것이고
//    삭제는 항목 자체를 없애는 것이라, 두 동작이 한 자리에 같이 있으면 안 된다.
//
// ⚠️ 체크를 해제해도 **삭제 배경이 카드 전체에 비치면 안 된다.** (스펙)
//    빨간 배경 위에 반투명 카드를 얹는 방식은 꺼진 항목을 전부 빨갛게 만든다.
//    카드는 항상 불투명하게 두고, 삭제 배경은 카드 뒤 오른쪽에만 깐다.
//
// ⚠️ 실제 지출이 연결된 항목은 **체크 해제도 스와이프 삭제도 막는다.**
//    이미 쓴 돈이 달린 계획을 빼면 '계획에 없는 지출' 이 생겨
//    계획 대비 실제 비교가 성립하지 않는다.
//    연결 해제는 지출 상세 화면에서만 한다. (스펙)
//
// ⚠️ 여유 예산은 DB 행이 아니라 **설정 예산 − 선택된 계획 합계**다.
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
  /** 계획에 포함할지. 끄면 합계에서 빠진다 */
  selected: boolean;
  emoji: string;
  /** 금액을 총액으로 보여줄지 1인당 × 인원으로 보여줄지. 총액은 바뀌지 않는다 */
  displayMode: PlanDisplayMode;
  /**
   * 실제 지출과 연결된 항목인가.
   * 연결되면 잠긴다 — 체크 해제도 삭제도 못 한다.
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
  /** 설정 예산 − 선택된 계획 합계. 0 이면 행을 그리지 않는다 */
  reserveAmount: number;
  /** 없으면 체크·삭제를 막는다 (결산 중·완료) */
  onToggle?: (id: string) => void;
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
  onToggle,
  onDelete,
  onOpenLinked,
  onStartAdd,
}: Props) {
  const swipeRefs = useRef(new Map<string, SwipeableMethods | null>());

  return (
    <View style={{ gap: 9 }}>
      {items.map((item) =>
        item.locked || !onToggle ? (
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
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${item.name} 삭제`}
                onPress={() => {
                  swipeRefs.current.get(item.id)?.close();
                  onDelete?.(item.id);
                }}
                style={{
                  width: 74,
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
            )}
          >
            {/*
              ⚠️ 카드는 항상 불투명하다. 체크를 꺼도 뒤의 삭제 배경이 비치지 않는다.
                 꺼진 상태는 배경을 회색으로 바꾸고 안쪽 요소만 흐리게 해서 알린다.
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
                backgroundColor: item.selected ? "#fff" : "#f7f8fa",
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
                  opacity: item.selected ? 1 : 0.48,
                }}
              >
                <Text style={{ fontSize: 22 }}>{item.emoji}</Text>
              </View>

              <View style={{ flex: 1, opacity: item.selected ? 1 : 0.48 }}>
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
                  style={{
                    fontSize: 11,
                    fontWeight: "700",
                    color: "#111827",
                    opacity: item.selected ? 1 : 0.48,
                  }}
                >
                  {won(item.expectedAmount)}
                </Text>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityLabel={`${item.name} 계획에 포함`}
                  accessibilityState={{ checked: item.selected }}
                  onPress={() => onToggle?.(item.id)}
                  hitSlop={8}
                  style={{
                    width: 23,
                    height: 23,
                    marginTop: 6,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: item.selected ? theme.primary : "#cfd4dc",
                    backgroundColor: item.selected ? theme.primary : "#fff",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {item.selected ? (
                    <Ionicons
                      name="checkmark"
                      size={14}
                      color={theme.onPrimary}
                    />
                  ) : null}
                </Pressable>
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
          className="active:bg-gray-50"
          style={{
            marginTop: 1,
            borderWidth: 1,
            borderStyle: "dashed",
            borderColor: "#cfd5dc",
            borderRadius: 13,
            backgroundColor: "#fff",
            paddingVertical: 14,
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: "800", color: "#576170" }}>
            <Text style={{ color: theme.primary }}>＋ </Text>
            계획 항목 추가
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
