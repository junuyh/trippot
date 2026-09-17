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
// ⚠️ 2026-09-17 문구를 여기서 만들지 않는다. lib/trip/tripActions 가 만든 것을
//    받아서 넘기기만 한다. 같은 일이 홈(HOME-01)에도 뜨는데 문장을 양쪽에서
//    쓰면 한쪽만 고쳐진다.
//
// ⚠️ 2026-09-17 그리는 일도 여기서 하지 않는다. 취소 배너·초대 배너와
//    **생김새가 한 글자도 다르지 않아** 껍데기를 TripActionBanner 한 벌로
//    합쳤다. 이 파일에 남은 것은 "이 배너를 누르면 어디로 가는가" 뿐이다.
//
// ⚠️ 배너 밖 보조 문장(action.note)을 빼지 말 것. 수락해야만 여행이 돌아가는
//    줄 알고 준비를 멈춘다. 요청은 여행 준비와 무관하게 쌓인다.
//
// ⚠️ action.tripLabel 을 그리지 않는다. 이미 그 여행 안이다. (TripActionBanner)
// ============================================================================
import { TripActionBanner } from "@/components/trip-home/TripActionBanner";
import type { TripAction } from "@/lib/trip/tripActions";

type Props = {
  action: TripAction;
  onOpen: () => void;
};

export function JoinRequestBanner({ action, onOpen }: Props) {
  return <TripActionBanner action={action} onPress={onOpen} />;
}
