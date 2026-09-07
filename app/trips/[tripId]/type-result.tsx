// ============================================================================
// TYPE-01 여행 유형 결과  ·  /trips/:tripId/type-result
//
// 결산이 확정된 여행이 어떤 여행이었는지 한 문장으로 부른다.
//
// ⚠️ **근거를 반드시 함께 보여준다.** 유형 이름만 던지면 사용자는
//    "왜 내가 미식형이지?" 에 답을 못 얻고, 그러면 다음 여행 개인화 추천도
//    믿지 않는다. 카테고리별 계획 대비 실제를 그대로 편다.
//
// ⚠️ 결산 확정 전에는 들어와도 유형을 만들지 않는다. (IA v2 §2-6-3)
//
// 데이터 조회·상태 관리·로그 기록만 한다. UI 는 components/trip-type/.
// ============================================================================
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Image, ScrollView, Text, View } from "react-native";

import { Button, EmptyState, ErrorState, Loading } from "@/components/ui";
import { SCREENS } from "@/lib/analytics/events";
import { countryTheme } from "@/lib/constants/countryTheme";
import { findDestinationByName } from "@/lib/constants/destinations";
import {
  CATEGORY_CODE_LABEL,
  TRIP_STATUS,
  type CategoryCode,
} from "@/lib/constants/status";
import { TRAVEL_TYPE_COPY } from "@/lib/constants/travelTypeCopy";
import { useScreenView } from "@/lib/hooks/useScreenView";
import { useTripContext } from "@/lib/hooks/useTripContext";
import {
  getTripTypeResult,
  type TripTypeResult,
} from "@/lib/supabase/queries/travelTypes";
import { getTripById, type Trip } from "@/lib/supabase/queries/trips";

const GREEN = "#19865f";

export default function ScreenTYPE01() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  // 이 화면의 모든 이벤트에 trip_id 를 붙인다. (docs/06 v4 §5)
  useTripContext(tripId);
  useScreenView(SCREENS.TRIP_HOME);

  const [trip, setTrip] = useState<Trip | null>(null);
  const [result, setResult] = useState<TripTypeResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    if (!tripId) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setError(false);
    try {
      const found = await getTripById(tripId);
      if (!found) {
        setNotFound(true);
        return;
      }
      setTrip(found);
      setResult(await getTripTypeResult(found.id));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <View className="flex-1 bg-white">
        <Stack.Screen options={{ title: "여행 유형" }} />
        <Loading message="여행 유형을 불러오는 중…" />
      </View>
    );
  }
  if (notFound || !trip) {
    return (
      <View className="flex-1 bg-white">
        <Stack.Screen options={{ title: "여행 유형" }} />
        <EmptyState
          icon="sparkles-outline"
          title="여행을 찾을 수 없어요"
          description="삭제되었거나 접근할 수 없는 여행이에요."
          actionLabel="홈으로"
          onAction={() => router.replace("/")}
        />
      </View>
    );
  }
  if (error) {
    return (
      <View className="flex-1 bg-white">
        <Stack.Screen options={{ title: "여행 유형" }} />
        <ErrorState
          message="여행 유형을 불러오지 못했어요."
          onRetry={() => void load()}
        />
      </View>
    );
  }

  const theme = countryTheme(
    findDestinationByName(trip.destination)?.countryKo,
  );

  // 결산 전에는 유형이 없다. 만들어 보여주지 않는다.
  if (!result) {
    return (
      <View className="flex-1 bg-white">
        <Stack.Screen options={{ title: "여행 유형" }} />
        <EmptyState
          icon="hourglass-outline"
          title="아직 유형이 나오지 않았어요"
          description={
            trip.status === TRIP_STATUS.SETTLED
              ? "유형을 만들 만한 지출 기록이 없어요."
              : "지출 확인을 마치고 결산을 확정하면 여행 유형이 공개돼요."
          }
          actionLabel="여행비 결산 보기"
          onAction={() => router.replace(`/trips/${trip.id}/settlement`)}
        />
      </View>
    );
  }

  const copy = TRAVEL_TYPE_COPY[result.code];
  const accuracy = (result.accuracyBp / 100).toFixed(1).replace(/\.0$/, "");
  // 근거는 세 줄이면 충분하다. 여덟 줄을 다 펴면 무엇이 특징인지 사라진다.
  const evidence = result.evidence.filter((row) => row.diff !== 0).slice(0, 3);

  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingTop: 18,
        paddingBottom: 40,
      }}
    >
      <Stack.Screen options={{ title: "여행 유형" }} />

      <Text
        style={{
          fontSize: 9,
          fontWeight: "900",
          letterSpacing: 1.4,
          color: theme.primary,
        }}
      >
        TRIPPOT TYPE REPORT
      </Text>

      <View
        className="flex-row items-center"
        style={{ marginTop: 14, gap: 14 }}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 34,
              fontWeight: "900",
              color: "#e9ecef",
              letterSpacing: -1,
            }}
          >
            {copy.no}
          </Text>
          <Text
            style={{
              marginTop: 2,
              fontSize: 24,
              lineHeight: 33,
              fontWeight: "900",
              letterSpacing: -0.8,
              color: "#141b28",
            }}
          >
            {copy.headline}
          </Text>
        </View>
        {copy.image ? (
          <Image
            source={copy.image}
            style={{ width: 116, height: 102 }}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
        ) : (
          <Text style={{ fontSize: 64 }}>{copy.emoji}</Text>
        )}
      </View>

      <Text
        style={{
          marginTop: 10,
          fontSize: 13,
          lineHeight: 20,
          color: "#5d6674",
        }}
      >
        {copy.description}
      </Text>

      <View
        className="flex-row"
        style={{ gap: 7, marginTop: 14, flexWrap: "wrap" }}
      >
        {copy.hashtags.map((tag) => (
          <Text
            key={tag}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 20,
              backgroundColor: theme.primarySoft,
              fontSize: 11,
              fontWeight: "700",
              color: theme.primary,
            }}
          >
            {tag}
          </Text>
        ))}
      </View>

      <View
        className="flex-row items-center justify-between"
        style={{
          marginTop: 20,
          padding: 15,
          borderRadius: 14,
          backgroundColor: "#f6f7f9",
        }}
      >
        <Text style={{ fontSize: 12, color: "#5d6674" }}>예산 정확도</Text>
        <Text style={{ fontSize: 20, fontWeight: "900", color: theme.primary }}>
          {accuracy}%
        </Text>
      </View>

      {/* ── 근거 ── 유형 이름만 던지지 않는다 ── */}
      <Text
        style={{
          marginTop: 28,
          fontSize: 17,
          fontWeight: "800",
          color: "#141b28",
        }}
      >
        이 유형이 나온 이유
      </Text>

      <View style={{ marginTop: 12, gap: 9 }}>
        {evidence.map((row) => {
          const over = row.diff > 0;
          const label = CATEGORY_CODE_LABEL[row.categoryCode as CategoryCode];
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
                  style={{ fontSize: 12, fontWeight: "800", color: "#141b28" }}
                >
                  {label}
                </Text>
                <Text style={{ marginTop: 4, fontSize: 11, color: "#7c8695" }}>
                  계획 {row.plannedAmount.toLocaleString("ko-KR")}원 중{" "}
                  {row.actualAmount.toLocaleString("ko-KR")}원을 썼어요
                </Text>
                <Text
                  style={{
                    marginTop: 4,
                    fontSize: 11,
                    fontWeight: "800",
                    color: over ? theme.primary : GREEN,
                  }}
                >
                  {Math.abs(row.diff).toLocaleString("ko-KR")}원{" "}
                  {over ? "초과" : "절약"}
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

      <View style={{ marginTop: 24 }}>
        <Button
          label="같은 멤버로 다시 여행 만들기"
          onPress={() => router.push("/trips/new/owner?entryPoint=past_trip")}
        />
      </View>
    </ScrollView>
  );
}
