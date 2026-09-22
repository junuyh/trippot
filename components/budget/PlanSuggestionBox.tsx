// ============================================================================
// BUDGET-02 세부 계획 추천 (시안 v3)
//
// '계획 항목 추가' 를 누르면 열린다. 가로로 넘기는 카드다.
//
// ⚠️ **추천이 사용자 대신 확정하지 않는다.** (CLAUDE.md 3장)
//    카드를 누르는 순간 세부 계획에 들어가지만, 그건 사용자의 확정 행동이다.
//    자동으로 미리 넣어 두지 않는다.
//
// ⚠️ 이미 계획에 있는 항목은 여기 오기 전에 걸러져 있다.
//    (lib/budget/planSuggestions.ts) 화면은 받은 것만 그린다.
//
// ⚠️ 이 컴포넌트는 supabase / track 을 부르지 않는다. 화면이 부른다.
// ============================================================================
import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import type { PlanSuggestion } from "@/lib/budget/planSuggestions";
import type { CountryTheme } from "@/lib/constants/countryTheme";

type Props = {
  theme: CountryTheme;
  suggestions: PlanSuggestion[];
  loading: boolean;
  /**
   * 카탈로그를 띄워 둔 채 AI 추천을 기다리는 중인가.
   * true 면 카드 위에 "○○에 맞는 항목을 찾는 중…" 을 적는다.
   */
  aiPending?: boolean;
  /** 지금 보이는 카드가 AI 결과인가. 바뀐 뒤 무엇이 바뀌었는지 적는다 */
  aiApplied?: boolean;
  /** 여행지 이름. '로마에 맞는…' 에 쓴다 */
  destinationLabel?: string;
  /** 추가 중인 항목 key. 그 카드만 잠근다 */
  busyKey: string | null;
  onAdd: (suggestion: PlanSuggestion) => void;
  /** '원하는 항목 직접 추가' — 기존 입력 바텀시트를 연다 */
  onDirectAdd: () => void;
  onClose: () => void;
};

function won(value: number): string {
  return `${value.toLocaleString("ko-KR")}원`;
}

export function PlanSuggestionBox({
  theme,
  suggestions,
  loading,
  aiPending = false,
  aiApplied = false,
  destinationLabel,
  busyKey,
  onAdd,
  onDirectAdd,
  onClose,
}: Props) {
  return (
    <View
      style={{
        marginTop: 11,
        borderWidth: 1,
        borderColor: "#dce5f2",
        borderRadius: 16,
        backgroundColor: "#f5f8fc",
        padding: 14,
      }}
    >
      <View
        className="flex-row items-start justify-between"
        style={{ gap: 14 }}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 9,
              fontWeight: "900",
              letterSpacing: 0.8,
              color: "#2d67b2",
            }}
          >
            AI PLAN SUGGESTION
          </Text>
          <Text
            style={{
              marginTop: 4,
              fontSize: 14,
              fontWeight: "800",
              color: "#111827",
            }}
          >
            함께 준비하면 좋은 항목
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="추천 닫기"
          onPress={onClose}
          hitSlop={8}
          style={{
            width: 29,
            height: 29,
            borderRadius: 14.5,
            backgroundColor: "#fff",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="close" size={16} color="#697586" />
        </Pressable>
      </View>

      <Text style={{ marginTop: 7, fontSize: 9, color: "#858e9c" }}>
        여행지·일정·인원을 보고, 현재 계획에 없는 항목만 추천해요.
      </Text>

      {/*
        ⚠️ **대략적인 금액이라고 적는다.** (2026-09-21 4차)
           추천 금액은 여행지별 실제 시세가 아니라 일정·인원으로 계산한
           대략값이다. 도시별 숙소 카탈로그가 없어 "침사추이 3박" 같은
           구체적인 추천을 못 한다. 그런데 화면은 금액을 딱 떨어지게 적어
           두니 조사한 값처럼 읽힌다. 테스터가 그걸 믿고 예산을 정하면
           우리가 틀린 값을 확정시킨 것이 된다.
           고치는 것은 카탈로그를 갖춘 뒤의 일이고, 그전까지는 말을 맞춘다.
        ⚠️ "실제 시세를 조회한 값이 아니니" 는 뺐다. (2026-09-22) 그렇게 쓰면
           "실제 금액도 아닌데 왜 보여주나" 로 읽힌다. 못 하는 것을 말하지
           말고 이 숫자가 무엇인지만 말한다.
      */}
      <View
        className="flex-row items-start"
        style={{
          marginTop: 9,
          gap: 6,
          borderRadius: 9,
          backgroundColor: "#fffaf0",
          paddingHorizontal: 9,
          paddingVertical: 7,
        }}
      >
        <Ionicons name="information-circle-outline" size={12} color="#b4700f" />
        <Text
          style={{ flex: 1, fontSize: 9, lineHeight: 14, color: "#8a6420" }}
        >
          일정·인원으로 잡은 대략적인 금액이에요. 확인하고 고쳐서 쓰세요.
        </Text>
      </View>

      {/*
        ⚠️ AI 를 기다리는 동안 **무엇을 기다리는지 말한다.** (2026-09-22)
           카탈로그 카드를 먼저 보여 주고 AI 가 오면 바꿔 끼운다. 말없이
           카드가 바뀌면 "방금 본 게 어디 갔지" 가 된다. 바뀔 거라고 미리
           적어 두고, 바뀐 뒤에는 바뀌었다고 적는다.
      */}
      {aiPending || aiApplied ? (
        <View
          className="flex-row items-center"
          style={{ marginTop: 9, gap: 6, paddingHorizontal: 2 }}
        >
          {aiPending ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <Ionicons name="sparkles" size={12} color={theme.primary} />
          )}
          <Text
            style={{ fontSize: 10, fontWeight: "700", color: theme.primary }}
          >
            {aiPending
              ? `${destinationLabel ?? "여행지"}에 맞는 항목을 찾는 중…`
              : `${destinationLabel ?? "여행지"}에 맞춰 골랐어요`}
          </Text>
        </View>
      ) : null}

      {loading ? (
        <View style={{ paddingVertical: 34, alignItems: "center" }}>
          <ActivityIndicator color={theme.primary} />
          <Text style={{ marginTop: 9, fontSize: 10, color: "#858e9c" }}>
            추천을 만드는 중이에요…
          </Text>
        </View>
      ) : suggestions.length === 0 ? (
        <View style={{ paddingVertical: 26, alignItems: "center" }}>
          <Text style={{ fontSize: 10, color: "#858e9c" }}>
            추천할 항목을 모두 계획에 추가했어요.
          </Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 9, paddingRight: 14 }}
          style={{
            marginTop: 12,
            marginHorizontal: -14,
            paddingHorizontal: 14,
          }}
        >
          {suggestions.map((suggestion) => {
            const busy = busyKey === suggestion.key;
            return (
              <Pressable
                key={suggestion.key}
                accessibilityRole="button"
                accessibilityLabel={`${suggestion.name} 계획에 추가`}
                disabled={busyKey !== null}
                onPress={() => onAdd(suggestion)}
                className="active:opacity-70"
                style={{
                  width: 148,
                  minHeight: 150,
                  borderWidth: 1,
                  borderColor: "#e2e7ee",
                  borderRadius: 14,
                  backgroundColor: "#fff",
                  padding: 12,
                  opacity: busyKey !== null && !busy ? 0.5 : 1,
                }}
              >
                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 10,
                    backgroundColor: "#f2f5f9",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ fontSize: 21 }}>{suggestion.emoji}</Text>
                </View>
                <Text
                  style={{
                    marginTop: 13,
                    fontSize: 11,
                    fontWeight: "800",
                    color: "#111827",
                  }}
                >
                  {suggestion.name}
                </Text>
                <Text
                  style={{
                    marginTop: 5,
                    fontSize: 8,
                    lineHeight: 13,
                    color: "#858e9c",
                  }}
                >
                  {suggestion.reason}
                </Text>
                {/*
                  ⚠️ 금액을 이유 문장과 **따로** 적는다. (2026-09-22)
                     9/02 시안부터 이유 뒤에 줄만 바꿔 같은 8pt 회색으로 붙어
                     있어서, 카드에서 가장 중요한 숫자가 설명문처럼 묻혔다.
                     사용자가 '추가' 를 누를지 정하는 근거는 금액이다.
                */}
                <Text
                  style={{
                    marginTop: 7,
                    fontSize: 13,
                    fontWeight: "800",
                    color: "#111827",
                  }}
                >
                  {won(suggestion.amount)}
                </Text>
                <Text
                  style={{
                    marginTop: 10,
                    fontSize: 9,
                    fontWeight: "900",
                    color: "#2d67b2",
                  }}
                >
                  {busy ? "추가하는 중…" : "＋ 추가"}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="원하는 항목 직접 추가"
        onPress={onDirectAdd}
        className="active:opacity-70"
        style={{
          marginTop: 10,
          borderRadius: 11,
          backgroundColor: "#fff",
          paddingVertical: 12,
          alignItems: "center",
        }}
      >
        <Text style={{ fontSize: 10, fontWeight: "900", color: "#4f5b6b" }}>
          <Text style={{ color: theme.primary }}>＋ </Text>
          원하는 항목 직접 추가
        </Text>
      </Pressable>
    </View>
  );
}
