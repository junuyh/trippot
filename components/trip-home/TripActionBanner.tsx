// ============================================================================
// 여행 홈 상단 "지금 답해야 할 일" 배너 — 껍데기 한 벌 (2026-09-17)
//
// 여행 홈 위쪽에는 성격이 같은 배너가 셋 뜬다.
//   승인 대기        JoinRequestBanner
//   취소 요청 중      CancelPendingBanner
//   아직 나 혼자      InviteEmptyBanner
//
// ⚠️ **셋의 생김새가 한 글자도 다르지 않다.** 다른 것은 눌렀을 때 무엇을
//    하느냐뿐이고, 그 판단은 이미 lib/trip/tripActions 가 intent 로 내놓는다.
//    앞의 둘은 실제로 레이아웃이 통째로 복제돼 있었다 — 세 번째를 만들면서
//    한 벌로 합쳤다. (2026-09-17 다빈)
//
//    이 프로젝트에서 같은 것이 두 벌이 되어 한쪽만 고쳐진 일이 세 번 있었다
//    (leaveTrip · CANCEL_PENDING · buildFundSnapshot). 배너 부제 색을 맞추는
//    작업도 두 파일을 따로 고쳐야 했다.
//
// ⚠️ 색은 action.tone 이 정한다. 공통 Button 을 쓰지 않는 이유가 여기 있다 —
//    Button 은 브랜드 보라 고정이라 취소 배너가 앰버 바탕에 보라 버튼이 됐다.
//    tailwind.config.js 에 앰버를 넣지 않았다. 25개 화면이 함께 쓴다.
//
// ⚠️ action.tripLabel 을 그리지 않는다. 이미 그 여행 안이다.
//    (홈 HOME-01 은 여행 이름이 필요해서 자기 껍데기를 따로 쓴다 —
//     HomeActionBanner. 거기는 카드·초대 배너와 자리를 다투므로 모양이 다르다)
//
// ⚠️ 배너 밖 보조 문장(note)이 아래에 붙어 있었다. 2026-09-17 걷어냈다 —
//    셋 중 둘은 한 탭 뒤 시트에 같은 말이 있었고, 하나는 여행장만 보는
//    배너에서 "여행장만 할 수 있어요" 라고 말하고 있었다. (tripActions 주석)
//    그래서 이 컴포넌트는 이제 **한 덩어리**다. 바깥 래퍼를 두지 않는다 —
//    자식이 하나뿐인데 gap 을 주면 다음 사람이 뭔가 더 있는 줄 안다.
//
// 데이터만 받는다. supabase / track() 을 직접 부르지 않는다. (CLAUDE.md 9장)
// ============================================================================
import { Pressable, Text, View } from "react-native";

import { TONE } from "@/lib/constants/toneColor";
import type { TripAction } from "@/lib/trip/tripActions";

type Props = {
  action: TripAction;
  /** 버튼을 눌렀을 때. 무엇을 열지는 부르는 쪽이 action.intent 로 정한다 */
  onPress: () => void;
};

export function TripActionBanner({ action, onPress }: Props) {
  const c = TONE[action.tone];

  return (
    <View
      className="flex-row items-center rounded-2xl px-4 py-3.5"
      style={{ gap: 11, backgroundColor: c.tint }}
    >
      <View style={{ flex: 1 }}>
        {/*
          ⚠️ 여행 홈은 **상태(meta)가 제목**이고 사건(headline)이 부제다.
             홈은 정반대다. 문장은 둘 다 tripActions 가 만든다.
          ⚠️ 부제는 제목보다 옅어야 위계가 선다. 두 배너가 각자 다른 회색을
             쓰다가 2026-09-17 에 TONE.body 로 맞췄다.
        */}
        <Text style={{ fontSize: 13.5, fontWeight: "700", color: c.fg }}>{action.meta}</Text>
        <Text style={{ marginTop: 3, fontSize: 12, lineHeight: 18, color: c.body }}>
          {action.headline}
        </Text>
      </View>
      <View style={{ flexShrink: 0 }}>
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
  );
}
