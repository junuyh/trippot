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
// ============================================================================
import { Text, View } from "react-native";

import { Button } from "@/components/ui";

type Props = {
  /** 동의한 사람 수 */
  agreedCount: number;
  /** 동의 대상 수 = ACTIVE 멤버 − 요청자 */
  voteTargetCount: number;

  /** 내가 요청자인가 */
  isRequester: boolean;
  /** 내가 이미 투표했는가. 요청자면 무시된다 */
  hasVoted: boolean;
  /** 취소를 요청한 사람 이름. 멤버에게 보여준다 */
  requesterName: string;

  /** 현황 보기 → CXL-07 */
  onOpenProgress: () => void;
  /** 확인하기 → CXL-06 */
  onOpenVote: () => void;
};

export function CancelPendingBanner({
  agreedCount,
  voteTargetCount,
  isRequester,
  hasVoted,
  requesterName,
  onOpenProgress,
  onOpenVote,
}: Props) {
  /** 아직 안 고른 멤버만 CXL-06 으로 간다. 나머지는 현황으로 */
  const needsVote = !isRequester && !hasVoted;

  return (
    <View style={{ gap: 8 }}>
      <View
        className="flex-row items-center rounded-2xl px-4 py-3.5"
        style={{ gap: 11, backgroundColor: "#FFF7E8" }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13.5, fontWeight: "700", color: "#8A5A00" }}>
            취소 요청 중 · {agreedCount}/{voteTargetCount}명 동의
          </Text>
          <Text style={{ marginTop: 3, fontSize: 12, lineHeight: 18, color: "#8A5A00" }}>
            {isRequester
              ? "멤버 모두가 동의하면 취소돼요"
              : `${requesterName}님이 여행 취소를 요청했어요`}
          </Text>
        </View>
        <View style={{ flexShrink: 0 }}>
          <Button
            label={needsVote ? "확인하기" : "현황 보기"}
            fullWidth={false}
            onPress={needsVote ? onOpenVote : onOpenProgress}
          />
        </View>
      </View>

      {/*
        ⚠️ 이 문장을 빼지 말 것. 요청 중이면 아무것도 못 고치는 줄 알고
           동의가 모일 때까지 여행 준비를 멈춘다. (POL-CXL-006)
      */}
      <Text style={{ fontSize: 11.5, lineHeight: 18, color: "#8B94A2" }}>
        취소 요청 중에도 예산과 계획은 그대로 수정할 수 있어요.
      </Text>
    </View>
  );
}
