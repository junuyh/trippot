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
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import Svg, { Circle, Defs, Pattern, Rect } from "react-native-svg";

import type { CountryTheme } from "@/lib/constants/countryTheme";
import {
  CATEGORY_CODE_LABEL,
  type CategoryCode,
  type SpendingProfileType,
} from "@/lib/constants/status";
import { TRAVEL_TYPE_COPY } from "@/lib/constants/travelTypeCopy";
import { travelTypeTheme } from "@/lib/constants/travelTypeTheme";

import { TYPE_COUNT } from "./TravelTypeCard";
import { travelTypeHeadline } from "./TypeIdCard";
import { TypeIdCard } from "./TypeIdCard";

const GREEN = "#19865f";

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
  /** 정산 확정 전의 잠정 결과인지. 문구가 달라진다 */
  provisional: boolean;
  /** 공유 안내에 쓰는 한글 여행지명 */
  destinationKo: string;
  /** 신분증에 적는 영문 도시명. 없으면 '' */
  destinationEn: string;
  /** "2026.05.14 – 05.17". 없으면 null */
  periodLabel: string | null;
  topSpentLabel: string | null;
  topSavedLabel: string | null;
  /** 모임 여행이면 '우리의', 개인 여행이면 '나의' 로 부른다 */
  shared?: boolean;

  onClose: () => void;
  /** 이미지 저장. 확정 결과에서만 보인다. 없으면 준비 중 안내를 띄운다 */
  onSaveImage?: () => void;
};

function won(value: number): string {
  return `${Math.abs(value).toLocaleString("ko-KR")}원`;
}

export function TypeResultOverlay({
  visible,
  theme,
  code,
  accuracyBp,
  provisional,
  destinationKo,
  destinationEn,
  periodLabel,
  topSpentLabel,
  topSavedLabel,
  shared,
  evidence,
  onClose,
  onSaveImage,
}: Props) {
  const copy = TRAVEL_TYPE_COPY[code];
  const typeTheme = travelTypeTheme(code);
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
          {/* ── 표지: 유형색 바탕 + 신분증. 홈 카드·공유 이미지와 같은 얼굴 ── */}
          <View
            style={{
              borderRadius: 19,
              backgroundColor: typeTheme.bg,
              padding: 18,
              overflow: "hidden",
            }}
          >
            <Svg
              width="100%"
              height="100%"
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
                  <Circle cx={1.4} cy={1.4} r={1.4} fill={typeTheme.ink} opacity={0.14} />
                </Pattern>
              </Defs>
              <Rect width="100%" height="100%" fill="url(#type-cover-dots)" />
            </Svg>

            <View className="flex-row items-center justify-between">
              <Text style={{ fontSize: 9, fontWeight: "900", letterSpacing: 1.5, color: typeTheme.ink }}>
                TRIPPOT · TRAVEL TYPE
              </Text>
              <Text style={{ fontSize: 9, fontWeight: "900", letterSpacing: 1, color: typeTheme.ink }}>
                NO. {copy.no} / {TYPE_COUNT}
              </Text>
            </View>
            <Text style={{ marginTop: 14, fontSize: 11, fontWeight: "800", color: typeTheme.ink }}>
              {travelTypeHeadline(shared)}
            </Text>
            <Text
              style={{
                marginTop: 2,
                fontSize: 28,
                lineHeight: 34,
                fontWeight: "900",
                letterSpacing: -0.5,
                color: typeTheme.ink,
              }}
            >
              {copy.headline}
            </Text>
            <View style={{ marginTop: 14 }}>
              <TypeIdCard
                code={code}
                accuracyBp={accuracyBp}
                destinationEn={destinationEn}
                periodLabel={periodLabel}
                topSpentLabel={topSpentLabel}
                topSavedLabel={topSavedLabel}
              />
            </View>
            <Text
              style={{
                marginTop: 12,
                fontSize: 13,
                lineHeight: 19,
                fontWeight: "900",
                color: typeTheme.ink,
              }}
            >
              “{typeTheme.hook}”
            </Text>
            <Text style={{ marginTop: 3, fontSize: 11, lineHeight: 16, fontWeight: "600", color: typeTheme.ink }}>
              {copy.description}
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

          {/*
            ── 이미지로 공유 ── [검토 필요]

            ⚠️ 버튼만 먼저 둔다. 화면을 이미지로 굽는 것(react-native-view-shot
               또는 expo 의 캡처 API)과 카카오톡 공유(네이티브 SDK · 개발 빌드
               필요 · 앱 키 발급은 사람이 해야 함)는 아직 만들지 않았다.
               눌러도 아무 일이 없으면 고장으로 읽히므로 준비 중임을 말한다.

            ⚠️ 잠정 결과는 공유 대상이 아니다. 확정 전 유형을 이미지로 내보내면
               나중에 바뀐 뒤에도 그 이미지가 남아 돌아다닌다.
          */}
          {provisional ? (
            <View
              style={{
                marginTop: 20,
                borderRadius: 12,
                backgroundColor: "#f5f6f8",
                padding: 14,
              }}
            >
              <Text style={{ fontSize: 11, lineHeight: 17, color: "#5d6674" }}>
                아직 정산이 끝나지 않아 지금까지의 지출로 계산한 결과예요.
                정산을 확정하면 이미지로 저장하고 공유할 수 있어요.
              </Text>
            </View>
          ) : (
            /*
              ⚠️ 카카오톡 보내기 버튼을 뺐다. (2026-09-21 테스트)
                 네이티브 SDK 라 Expo Go·테스트 빌드에서 동작하지 않아 눌러도
                 "곧 만나요" 안내만 떴다. 되지 않는 버튼을 두면 사용자는
                 고장으로 읽는다. 이미지 공유는 OS 공유 시트로 카카오톡까지
                 보낼 수 있어서 이 하나로 충분하다.
            */
            <View style={{ marginTop: 20 }}>
              <ShareAction
                icon="image-outline"
                label="이미지로 공유"
                onPress={
                  onSaveImage ??
                  (() =>
                    Alert.alert(
                      "곧 만나요",
                      `${destinationKo} 여행 유형을 이미지로 저장하는 기능을 준비하고 있어요.`,
                    ))
                }
              />
            </View>
          )}

          <Text
            style={{
              marginTop: 16,
              fontSize: 10,
              lineHeight: 16,
              color: "#a8afb9",
            }}
          >
            {provisional
              ? "정산을 확정하면 그 시점의 기록으로 고정돼요."
              : "이 결과는 정산을 확정한 시점의 기록이에요. 이후 예산을 고쳐도 바뀌지 않아요."}
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

/** 공유 버튼 한 칸. 아직 준비 중이라 눌리면 안내만 띄운다 */
function ShareAction({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      /*
        ⚠️ 카카오톡 버튼을 빼면서 혼자 남아 폭을 다 차지했고, 높이 74 짜리가
           통째로 커져 화면을 눌렀다. (2026-09-21 2차) 한 줄짜리 가로 버튼으로
           줄인다. 이 결과지에서 가장 중요한 건 유형과 근거지 공유 버튼이 아니다.
      */
      className="flex-row items-center justify-center active:opacity-70"
      style={{
        gap: 6,
        height: 44,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#e5e8ec",
        backgroundColor: "#fff",
      }}
    >
      <Ionicons name={icon} size={16} color="#3d4654" />
      <Text style={{ fontSize: 12, fontWeight: "800", color: "#3d4654" }}>
        {label}
      </Text>
    </Pressable>
  );
}
