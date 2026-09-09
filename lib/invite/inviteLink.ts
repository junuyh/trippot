// ============================================================================
// 모임 초대 링크 · 초대 문구 (TRIP-02 여행 정보 수정 → 여행 멤버 초대하기)
//
// ⚠️ [검토 필요] 지금 링크는 **모임 id 를 그대로 싣는다.** 링크를 받은 사람이
//    실제로 모임에 합류하려면 group_members 에 자기 행을 넣어야 하는데, RLS 상
//    모임원이 아닌 사용자는 넣을 수 없다. 합류를 열려면
//      · group_invites(token · group_id · expires_at · created_by) 테이블  ← DB 담당
//      · 토큰을 검증해 group_members 에 넣는 Edge Function
//    이 필요하다. 그때 buildGroupInviteLink 는 토큰을 싣도록 바뀌고, 이 파일을
//    쓰는 쪽은 안 바뀐다.
//
// ⚠️ 순수 함수. 네트워크도 스토리지도 없다.
// ============================================================================
import * as Linking from "expo-linking";

/** 초대를 받은 사람이 여는 경로. /groups/:groupId/join 은 아직 없다 [팀원] */
export function buildGroupInviteLink(groupId: string): string {
  return Linking.createURL(`/groups/${groupId}/join`);
}

/**
 * 카카오톡·문자에 그대로 붙여 넣는 초대 문구.
 *
 * 받는 사람이 "이게 뭔데" 하지 않고 누르게 하는 글이다. 서비스 가치 하나만 말한다:
 * **돈 얘기는 미리 끝내고, 여행 가서는 놀기만.** 기능 나열은 안 한다.
 */
export function buildInviteMessage(input: {
  destination: string;
  groupName: string;
  periodLabel: string | null;
  link: string;
}): string {
  const when = input.periodLabel ? ` · ${input.periodLabel}` : "";
  return [
    `🧳 ${input.groupName} 모임의 ${input.destination} 여행에 초대해요${when}`,
    "",
    "가서 돈 얘기 꺼내면 분위기 깨지잖아요.",
    "얼마 모을지, 어디에 쓸지, 누가 얼마 냈는지까지",
    "TripPot에서 미리 정해두고 현지에선 놀기만 해요.",
    "",
    "아래 링크 누르면 바로 우리 여행이에요 👇",
    input.link,
  ].join("\n");
}
