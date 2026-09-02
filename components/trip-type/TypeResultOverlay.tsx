// ============================================================================
// TYPE-01 여행 유형 결과 — TRIP-HOME-02 위에 올라오는 오버레이 (시안 v3)
//
// ⚠️ 2026-09-03 · **별도 화면이 아니라 오버레이다.** (시안 v3 흐름)
//    유형은 결산 결과를 다르게 읽은 것이지 다른 곳으로 간 게 아니다.
//    라우트를 따로 두면 뒤로가기 스택이 하나 더 생기고, 홈으로 돌아오는 데
//    두 번 눌러야 한다. 라우트(/trips/:tripId/type-result)는 그대로 두어
//    깊은 링크와 공유 링크가 깨지지 않게 한다.
//
// ⚠️ **근거를 반드시 함께 보여준다.** 유형 이름만 던지면 사용자는
//    "왜 내가 미식형이지?" 에 답을 못 얻고, 그러면 다음 여행 개인화 추천도
//    믿지 않는다.
//
// 데이터만 props 로 받는다. supabase / track() 을 직접 부르지 않는다.
// ============================================================================
import { Ionicons } from "@expo/vector-icons";
import { Image, Modal, Pressable, ScrollView, Text, View } from "react-native";
import Svg, { Circle, Defs, Pattern, Rect } from "react-native-svg";

import type { CountryTheme } from "@/lib/constants/countryTheme";
import {
  CATEGORY_CODE_LABEL,
  type CategoryCode,
  type SpendingProfileType,
} from "@/lib/constants/status";
import { TRAVEL_TYPE_COPY } from "@/lib/constants/travelTypeCopy";

const YELLOW = "#ffd92f";
const INK = "#111827";
const GREEN = "#19865f";
const COVER_HEIGHT = 430;

export type TypeEvidenceRow = {
  categoryCode: CategoryCode;
  plannedAmount: number;
  actualAmount: number;
  /** 계획 대비 실제. basis point. 11200 = 112% */
  usageBp: number;
  /** 실제 − 계획. 양수면 초과 */
  diff: number;
};

type Props = {
  visible: boolean;
  theme: CountryTheme;
  code: SpendingProfileType;
  /** 예산 정확도. basis point */
  accuracyBp: number;
  evidence: TypeEvidenceRow[];
  onClose: () => void;
};

function won(value: number): string {
  return `${Math.abs(value).toLocaleString("ko-KR")}원`;
}

export function TypeResultOverlay({
  visible,
  theme,
  code,
  accuracyBp,
  evidence,
  onClose,
}: Props) {
  const copy = TRAVEL_TYPE_COPY[code];
  const accuracy = (accuracyBp / 100).toFixed(1).replace(/\.0$/, "");
  // 근거는 세 줄이면 충분하다. 여덟 줄을 다 펴면 무엇이 특징인지 사라진다.
  const rows = evidence.filter((row) => row.diff !== 0).slice(0, 3);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
    >
      <View className="flex-1 bg-white">
        <View
          className="flex-row items-center justify-between"
          style={{
            height: 64,
            paddingHorizontal: 17,
            borderBottomWidth: 1,
            borderColor: "#e8eaee",
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: "800", color: "#141b28" }}>
            나의 여행 유형
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="닫기"
            onPress={onClose}
            hitSlop={8}
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: "#f5f6f8",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="close" size={18} color="#5d6674" />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {/* ── 표지 ── */}
          <View
            style={{
              height: COVER_HEIGHT,
              borderRadius: 19,
              backgroundColor: YELLOW,
              padding: 20,
              overflow: "hidden",
            }}
          >
            <Svg
              width="100%"
              height={COVER_HEIGHT}
              style={{ position: "absolute", left: 0, top: 0 }}
              pointerEvents="none"
            >
              <Defs>
                <Pattern
                  id="type-cover-dots"
                  width={16}
                  height={16}
                  patternUnits="userSpaceOnUse"
                >
                  <Circle cx={1.4} cy={1.4} r={1.4} fill={INK} opacity={0.12} />
                </Pattern>
              </Defs>
              <Rect
                width="100%"
                height={COVER_HEIGHT}
                fill="url(#type-cover-dots)"
              />
            </Svg>

            {copy.image ? (
              <Image
                source={copy.image}
                style={{
                  position: "absolute",
                  right: -40,
                  top: 72,
                  width: "96%",
                  height: 345,
                }}
                resizeMode="contain"
                accessibilityIgnoresInvertColors
              />
            ) : (
              <Text
                style={{
                  position: "absolute",
                  right: 24,
                  top: 150,
                  fontSize: 120,
                }}
              >
                {copy.emoji}
              </Text>
            )}

            <View className="flex-row items-start justify-between">
              <Text
                style={{
                  fontSize: 9,
                  fontWeight: "900",
                  letterSpacing: 1,
                  color: INK,
                }}
              >
                TRIPPOT TYPE REPORT
              </Text>
              <View
                style={{
                  backgroundColor: "#fff",
                  borderWidth: 1,
                  borderColor: INK,
                  paddingHorizontal: 9,
                  paddingVertical: 6,
                  transform: [{ rotate: "4deg" }],
                }}
              >
                <Text style={{ fontSize: 8, fontWeight: "900", color: INK }}>
                  TRAVEL TYPE {copy.no}
                </Text>
              </View>
            </View>

            <Text
              style={{
                marginTop: 54,
                fontSize: 40,
                lineHeight: 38,
                fontWeight: "900",
                letterSpacing: -2,
                color: INK,
              }}
            >
              {copy.headline}
            </Text>
            <View
              style={{
                alignSelf: "flex-start",
                maxWidth: "56%",
                marginTop: 10,
                backgroundColor: "rgba(255,255,255,0.64)",
                padding: 7,
                transform: [{ rotate: "-2deg" }],
              }}
            >
              <Text style={{ fontSize: 10, lineHeight: 15, color: INK }}>
                {copy.description}
              </Text>
            </View>
          </View>

          <View
            className="flex-row items-center justify-between"
            style={{
              marginTop: 16,
              padding: 15,
              borderRadius: 14,
              backgroundColor: "#f6f7f9",
            }}
          >
            <Text style={{ fontSize: 12, color: "#5d6674" }}>예산 정확도</Text>
            <Text
              style={{ fontSize: 20, fontWeight: "900", color: theme.primary }}
            >
              {accuracy}%
            </Text>
          </View>

          {/* ── 근거 ── 유형 이름만 던지지 않는다 ── */}
          <Text
            style={{
              marginTop: 26,
              fontSize: 17,
              fontWeight: "800",
              color: "#141b28",
            }}
          >
            이 유형이 나온 이유
          </Text>

          <View style={{ marginTop: 12, gap: 9 }}>
            {rows.map((row) => {
              const over = row.diff > 0;
              return (
                <View
                  key={row.categoryCode}
                  className="flex-row items-center"
                  style={{
                    gap: 12,
                    padding: 14,
                    borderWidth: 1,
                    borderColor: "#e8eaee",
                    borderRadius: 14,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "800",
                        color: "#141b28",
                      }}
                    >
                      {CATEGORY_CODE_LABEL[row.categoryCode]}
                    </Text>
                    <Text
                      style={{ marginTop: 4, fontSize: 11, color: "#7c8695" }}
                    >
                      계획 {won(row.plannedAmount)} 중 {won(row.actualAmount)}을
                      썼어요
                    </Text>
                    <Text
                      style={{
                        marginTop: 4,
                        fontSize: 11,
                        fontWeight: "800",
                        color: over ? theme.primary : GREEN,
                      }}
                    >
                      {won(row.diff)} {over ? "초과" : "절약"}
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontSize: 17,
                      fontWeight: "900",
                      color: over ? theme.primary : GREEN,
                    }}
                  >
                    {Math.round(row.usageBp / 100)}%
                  </Text>
                </View>
              );
            })}
          </View>

          <Text
            style={{
              marginTop: 16,
              fontSize: 10,
              lineHeight: 16,
              color: "#a8afb9",
            }}
          >
            이 결과는 결산을 확정한 시점의 기록이에요. 이후 예산을 고쳐도 바뀌지
            않아요.
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}
