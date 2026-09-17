// ============================================================================
// 참여 요청 대기 배너 — 여행 홈 상단
//
// ⚠️ 여행장만 본다. 수락·거절은 여행장만 할 수 있다. (POL-INV-004 · canDecideJoinRequest)
//    초대는 ACTIVE 멤버 누구나 보내지만, 들이는 건 한 사람이 쥔다.
//
// ⚠️ 왜 필요한가 — 참여 요청은 **여행 정보 수정 안에만** 있었다. 여행장이
//    거기 들어가 보기 전에는 누가 기다리는지 알 길이 없었다. 초대 링크를
//    보낸 사람은 상대가 요청을 넣은 줄 아는데, 받는 쪽은 모른다.
//    (2026-09-15 팀 테스트)
//
// ⚠️ 수락·거절을 여기서 하지 않는다. 누르면 여행 정보 수정으로 보낸다.
//    그 화면에 목록(INV-04 진입)과 수락·거절이 이미 다 있다. 여기에 또 만들면
//    같은 흐름이 두 벌이 된다. leaveTrip 이 둘로 갈렸던 것과 같은 일이다.
//
// ⚠️ TRIP-HOME-04(취소 요청 중) 와 같은 자리, 같은 모양이다. 여행 홈 위쪽에
//    "지금 네가 결정해야 할 일" 이 쌓이는 자리다.
//
// ⚠️ 2026-09-17 문구를 여기서 만들지 않는다. lib/trip/tripActions 가 만든 것을
//    받아서 자리에만 넣는다. 같은 일이 홈(HOME-01)에도 뜨는데 문장을 양쪽에서
//    쓰면 한쪽만 고쳐진다. **제목과 부제가 홈과 반대로 들어가는 것**이 이
//    화면의 몫이다 — 여기는 상태(meta)가 제목, 홈은 사건(headline)이 제목이다.
//
// ⚠️ action.tripLabel 을 그리지 않는다. 이미 그 여행 안이다.
// ============================================================================
import { Pressable, Text, View } from "react-native";

import { TONE } from "@/lib/constants/toneColor";
import type { TripAction } from "@/lib/trip/tripActions";

type Props = {
  action: TripAction;
  onOpen: () => void;
};

export function JoinRequestBanner({ action, onOpen }: Props) {
  const c = TONE[action.tone];

  return (
    <View style={{ gap: 8 }}>
      <View
        className="flex-row items-center rounded-2xl px-4 py-3.5"
        style={{ gap: 11, backgroundColor: c.tint }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13.5, fontWeight: "700", color: c.fg }}>{action.meta}</Text>
          {/*
            ⚠️ 이름을 부른다. "요청 3건" 만으로는 누가 기다리는지 모른다. 여러 명이면
               첫 사람만 부르고 나머지는 수로 말한다 — 문장은 tripActions 가 만든다.
            ⚠️ 2026-09-17 색을 홈 배너 부제와 맞췄다(#747B88 → TONE.brand.body).
               같은 일을 알리는 배너가 화면마다 다른 회색을 쓰고 있었다.
          */}
          <Text style={{ marginTop: 3, fontSize: 12, lineHeight: 18, color: c.body }}>
            {action.headline}
          </Text>
        </View>
        <View style={{ flexShrink: 0 }}>
          {/*
            ⚠️ 공통 Button 을 쓰지 않는다. Button 은 브랜드 보라 고정이라 취소
               배너가 앰버 바탕에 보라 버튼이 됐다. 톤을 따르는 버튼이 필요해서
               두 배너가 같은 모양으로 직접 그린다. (2026-09-17 다빈)
               tailwind.config.js 에 앰버를 넣지 않았다 — 25개 화면이 함께 쓴다.
          */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${action.meta} ${action.ctaLabel}`}
            onPress={onOpen}
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
        ⚠️ 이 문장을 빼지 말 것. 수락해야만 여행이 돌아가는 줄 알고 준비를
           멈춘다. 요청은 여행 준비와 무관하게 쌓인다.
        ⚠️ 홈에서는 그리지 않는다. 여행 준비를 하러 온 자리가 아니라서다.
      */}
      <Text style={{ fontSize: 11.5, lineHeight: 18, color: "#8B94A2" }}>{action.note}</Text>
    </View>
  );
}
