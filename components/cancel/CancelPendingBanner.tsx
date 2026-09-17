// ============================================================================
// TRIP-HOME-04 취소 요청 중 배너
//
// ⚠️ **화면이 아니라 배너다.** 여행 홈(app/trips/[tripId]/index.tsx)의 status
//    분기에서 이 배너만 얹는다. 새 라우트를 만들지 않는다. (스펙 §7)
//
// ⚠️ **여행 홈 전체 기능이 그대로 돈다.** CANCEL_PENDING 은 읽기 전용이 아니다.
//    (POL-CXL-006) 예산·계획·지출을 그대로 수정할 수 있다. 잠그면 한 명이
//    요청만 걸어두고 여행을 마비시킬 수 있다.
//
// ⚠️ **홈 대시보드에서도 숨기지 않는다.** (POL-CXL-022) 요청 중 여행이
//    사라지면 동의를 요청받은 멤버가 진입 경로를 잃는다.
//
// 배너는 보는 사람에 따라 세 모양이다.
//   요청자            현황 보기 (CXL-07)
//   멤버 · 미투표      확인하기 (CXL-06)   ← 여기서 동의·반대를 고른다
//   멤버 · 투표 완료   현황 보기 (CXL-07)   동의는 번복할 수 없다
//
// ⚠️ 2026-09-17 문구와 위 세 갈래 판정을 여기서 하지 않는다.
//    lib/trip/tripActions 가 정한 것을 받아 자리에만 넣는다. 같은 일이
//    홈(HOME-01)에도 뜨는데 판정을 양쪽에서 하면 한쪽만 고쳐진다.
//    (CLAUDE.md 7장 · leaveTrip 이 둘로 갈렸던 것과 같은 일)
//
// ⚠️ action.tripLabel 을 그리지 않는다. 이미 그 여행 안이다.
// ============================================================================
import { Pressable, Text, View } from "react-native";

import { TONE } from "@/lib/constants/toneColor";
import type { TripAction } from "@/lib/trip/tripActions";

type Props = {
  action: TripAction;
  /** 현황 보기 → CXL-07 */
  onOpenProgress: () => void;
  /** 확인하기 → CXL-06 */
  onOpenVote: () => void;
};

export function CancelPendingBanner({ action, onOpenProgress, onOpenVote }: Props) {
  const c = TONE[action.tone];
  /*
    ⚠️ 현황은 **동의 시트가 아니다.** 여기서 동의 시트를 열면 요청자가 자기
       요청에 동의할 수 있게 되고, 동의 대상 수는 요청자를 빼고 세므로 분자만
       부풀어 남은 사람이 동의하지 않았는데 취소가 확정된다.
       어느 쪽인지는 tripActions 가 intent 로 정해 준다.
  */
  const onPress = action.intent === "OPEN_CANCEL_VOTE" ? onOpenVote : onOpenProgress;

  return (
    <View style={{ gap: 8 }}>
      <View
        className="flex-row items-center rounded-2xl px-4 py-3.5"
        style={{ gap: 11, backgroundColor: c.tint }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13.5, fontWeight: "700", color: c.fg }}>{action.meta}</Text>
          {/*
            ⚠️ 2026-09-17 부제 색을 제목과 같은 앰버(#8A5A00)에서 톤 body 로 내렸다.
               홈 배너 부제와 같은 규칙이다 — 제목보다 옅어야 위계가 선다.
          */}
          <Text style={{ marginTop: 3, fontSize: 12, lineHeight: 18, color: c.body }}>
            {action.headline}
          </Text>
        </View>
        <View style={{ flexShrink: 0 }}>
          {/*
            ⚠️ 공통 Button 을 쓰지 않는다. Button 은 브랜드 보라 고정이라
               앰버 바탕에 보라 버튼이 됐다. 취소는 경고 색이라 버튼도 같은 톤이어야
               한 벌로 읽힌다. (2026-09-17 다빈)
               tailwind.config.js 에 앰버를 넣지 않았다 — 25개 화면이 함께 쓴다.
               모양은 JoinRequestBanner 버튼과 **같은 값**이다.
          */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${action.meta} ${action.ctaLabel}`}
            onPress={onPress}
            className="active:opacity-90"
            style={{
              height: 40,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 12,
              backgroundColor: c.fg,
              paddingHorizontal: 18,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: "700", color: "#FFFFFF" }}>
              {action.ctaLabel}
            </Text>
          </Pressable>
        </View>
      </View>

      {/*
        ⚠️ 이 문장을 빼지 말 것. 요청 중이면 아무것도 못 고치는 줄 알고
           동의가 모일 때까지 여행 준비를 멈춘다. (POL-CXL-006)
        ⚠️ 홈에서는 그리지 않는다. 여행 준비를 하러 온 자리가 아니라서다.
      */}
      <Text style={{ fontSize: 11.5, lineHeight: 18, color: "#8B94A2" }}>{action.note}</Text>
    </View>
  );
}
