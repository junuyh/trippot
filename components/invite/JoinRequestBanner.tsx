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
// ============================================================================
import { Text, View } from "react-native";

import { Button } from "@/components/ui";
import { BRAND } from "@/lib/constants/brandColor";

type Props = {
  /** 대기 중인 요청 수. 0이면 화면 파일이 배너를 그리지 않는다 */
  count: number;
  /** 가장 오래 기다린 사람 이름. 목록의 첫 번째 */
  firstName: string;
  onOpen: () => void;
};

export function JoinRequestBanner({ count, firstName, onOpen }: Props) {
  return (
    <View style={{ gap: 8 }}>
      <View
        className="flex-row items-center rounded-2xl px-4 py-3.5"
        style={{ gap: 11, backgroundColor: BRAND.primarySoft }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13.5, fontWeight: "700", color: BRAND.primary }}>
            승인 대기 {count}건
          </Text>
          {/*
            ⚠️ 이름을 부른다. "요청 3건" 만으로는 누가 기다리는지 모른다.
               여러 명이면 첫 사람만 부르고 나머지는 수로 말한다 — 이름을 다
               늘어놓으면 배너가 두 줄을 넘는다.
          */}
          <Text style={{ marginTop: 3, fontSize: 12, lineHeight: 18, color: "#747B88" }}>
            {count === 1
              ? `${firstName}님이 함께 가고 싶어 해요`
              : `${firstName}님 외 ${count - 1}명이 기다리고 있어요`}
          </Text>
        </View>
        <View style={{ flexShrink: 0 }}>
          <Button label="확인하기" fullWidth={false} onPress={onOpen} />
        </View>
      </View>

      {/*
        ⚠️ 이 문장을 빼지 말 것. 수락해야만 여행이 돌아가는 줄 알고 준비를
           멈춘다. 요청은 여행 준비와 무관하게 쌓인다.
      */}
      <Text style={{ fontSize: 11.5, lineHeight: 18, color: "#8B94A2" }}>
        수락은 여행장만 할 수 있어요. 지금 결정하지 않아도 괜찮아요.
      </Text>
    </View>
  );
}
