// TRIP-HOME 떠나기 전 챙겨보기 — 여행 팁 · 여행자보험 CTA.
// HTML 시안(.promos / .promo) 치수를 그대로 옮겼다.
//   카드   min-height 132 · radius 15 · padding 17 · 컬러 배경
//   제목   16px · 본문 10px · go 링크는 좌하단 고정
//   일러스트는 우하단
//
// ⚠️ 광고 배너처럼 보이지 않게 한다. 여행 준비 기능의 일부로 배치한다.
//    두 CTA 는 BM 과 직접 연결된다. 팁 → BM 2, 보험 → BM 1.
import { Pressable, Text, View } from "react-native";

import type { CountryTheme } from "@/lib/constants/countryTheme";

type Props = {
  destination: string;
  theme: CountryTheme;
  onPressTips: () => void;
  onPressInsurance: () => void;
};

export function TripGuideCards({
  destination,
  theme,
  onPressTips,
  onPressInsurance,
}: Props) {
  return (
    <View style={{ gap: 10 }}>
      {/* 여행 팁 */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="여행 팁 보러가기"
        onPress={onPressTips}
        style={{
          minHeight: 132,
          borderRadius: 15,
          overflow: "hidden",
          padding: 17,
          backgroundColor: "#eef7ff",
        }}
        className="active:opacity-90"
      >
        <Text
          style={{
            fontSize: 16,
            lineHeight: 20,
            fontWeight: "800",
            letterSpacing: -0.5,
            color: "#111827",
            maxWidth: "68%",
          }}
        >
          {destination} 여행자들이{"\n"}저장한 진짜 팁
        </Text>
        <Text
          style={{
            fontSize: 10,
            lineHeight: 15,
            color: "#596272",
            marginTop: 7,
            maxWidth: "68%",
          }}
        >
          교통패스부터 현지 맛집까지{"\n"}커뮤니티에서 먼저 확인해요.
        </Text>
        <Text
          style={{
            fontSize: 10,
            fontWeight: "900",
            color: "#2a5caa",
            marginTop: 10,
          }}
        >
          여행 팁 보러가기 →
        </Text>

        {/* 일러스트 */}
        <View
          style={{
            position: "absolute",
            right: 12,
            bottom: 8,
            width: 100,
            height: 100,
          }}
          className="items-center justify-center"
        >
          <View
            style={{
              width: 84,
              height: 84,
              borderRadius: 42,
              backgroundColor: "#fff",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 40 }}>🗺️</Text>
          </View>
          <View
            style={{
              position: "absolute",
              left: 2,
              bottom: 6,
              width: 16,
              height: 16,
              borderRadius: 8,
              backgroundColor: "#315efb",
            }}
          />
        </View>
      </Pressable>

      {/* 여행자보험 */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="여행자보험 계산하기"
        onPress={onPressInsurance}
        style={{
          minHeight: 132,
          borderRadius: 15,
          overflow: "hidden",
          padding: 17,
          backgroundColor: "#fff2ef",
        }}
        className="active:opacity-90"
      >
        <Text
          style={{
            fontSize: 16,
            lineHeight: 20,
            fontWeight: "800",
            letterSpacing: -0.5,
            color: "#111827",
            maxWidth: "68%",
          }}
        >
          우리 여행 보험료,{"\n"}1분이면 계산 끝
        </Text>
        <Text
          style={{
            fontSize: 10,
            lineHeight: 15,
            color: "#596272",
            marginTop: 7,
            maxWidth: "68%",
          }}
        >
          여행 인원과 일정만으로{"\n"}알맞은 보장을 비교해 보세요.
        </Text>
        <Text
          style={{
            fontSize: 10,
            fontWeight: "900",
            color: theme.primary,
            marginTop: 10,
          }}
        >
          무료로 계산하기 →
        </Text>

        <View
          style={{
            position: "absolute",
            right: 12,
            bottom: 12,
            width: 96,
            height: 96,
          }}
          className="items-center justify-center"
        >
          <View
            style={{
              width: 82,
              height: 82,
              borderRadius: 41,
              backgroundColor: "#fff",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 38 }}>🛡️</Text>
          </View>
        </View>
      </Pressable>
    </View>
  );
}
