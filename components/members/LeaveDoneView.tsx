// ============================================================================
// MEM-03 나가기 완료 — 전체 화면
//
// ⚠️ **바로 홈으로 보내지 않는다.** (POL-MEM-010) 나가기는 되돌릴 수 없는
//    행동이라 무엇이 일어났는지 한 번은 알려야 한다. 지금까지는 나가는 즉시
//    router.replace("/") 였는데, 그러면 모임에서도 나갔는지 · 여행장을 누가
//    이어받았는지 · 여행이 취소됐는지를 알 길이 없다.
//
// ⚠️ 세 갈래의 **다음 행동이 아니라 다음 인식**이 다르다. 셋 다 버튼은
//    '홈으로' 하나뿐이지만, 사용자가 방금 무슨 일을 겪었는지가 다르다.
//    그래서 화면을 나누지 않고 variant 로 문구만 가른다.
//
// ⚠️ '나간 여행이 목록에 남는다' 는 안내는 여기까지다. 실제 모임 상세 목록과
//    '나간 여행' 뱃지 · 접근 차단은 **다른 팀원 담당**이다. (POL-MEM-011)
//    여기서 만들지 않는다.
// ============================================================================
import { Text, View } from "react-native";

import { Button } from "@/components/ui";

type Props = {
  /**
   * `left`      그냥 나갔다
   * `delegated` 여행장을 넘기고 나갔다
   * `canceled`  나가면서 여행이 취소됐다 (POL-MEM-015)
   */
  variant: "left" | "delegated" | "canceled";

  destination: string;
  groupName: string;

  /** 모임에서도 나갔는가. **variant='left' 에서만 쓴다** */
  alsoLeftGroup: boolean;
  /** 새 여행장 이름. **variant='delegated' 에서만 쓴다** */
  newLeaderName?: string;

  /**
   * 나가기 뒤 돌아갈 곳의 이름. 진입점마다 다르다.
   *
   * ⚠️ 문구를 여기서 고정하지 않는다. 여행 홈에서 나가면 갈 곳이 앱 홈이지만,
   *    모임 상세에서 나가면 그 모임으로 돌아가는 게 맞다 — 여행 하나에서만
   *    나갔고 모임에는 그대로 남아 있기 때문이다. (다빈 결정 2026-09-14)
   */
  homeLabel?: string;
  onGoHome: () => void;
};

export function LeaveDoneView({
  variant,
  destination,
  groupName,
  alsoLeftGroup,
  newLeaderName,
  homeLabel = "홈으로",
  onGoHome,
}: Props) {
  const copy = resolveCopy({
    variant,
    destination,
    groupName,
    alsoLeftGroup,
    newLeaderName,
  });

  return (
    <View className="flex-1 bg-white">
      <View className="flex-1 items-center justify-center px-7">
        <View
          className="items-center justify-center rounded-full bg-gray-100"
          style={{ width: 62, height: 62 }}
        >
          <Text style={{ fontSize: 27 }}>{copy.icon}</Text>
        </View>

        <Text
          style={{
            marginTop: 20,
            fontSize: 20.5,
            fontWeight: "800",
            lineHeight: 29,
            color: "#111827",
            textAlign: "center",
          }}
        >
          {copy.title}
        </Text>

        <Text
          style={{
            marginTop: 9,
            fontSize: 13.5,
            lineHeight: 22,
            color: "#4B5563",
            textAlign: "center",
          }}
        >
          {copy.body}
        </Text>

        {/*
          ⚠️ 이 박스를 빼지 말 것. 나간 뒤에 여행이 목록에 그대로 보이면
             '안 나가진 것' 으로 읽힌다. 왜 보이는지를 여기서 미리 말한다.
        */}
        <View
          className="w-full bg-gray-100 px-4 py-3.5"
          style={{ marginTop: 22, borderRadius: 12 }}
        >
          <Text style={{ fontSize: 12.5, fontWeight: "700", color: "#374151" }}>
            {copy.noticeTitle}
          </Text>
          <Text style={{ marginTop: 4, fontSize: 12, lineHeight: 19, color: "#6B7280" }}>
            {copy.noticeBody}
          </Text>
        </View>
      </View>

      <View className="px-5 pb-9">
        <Button label={homeLabel} onPress={onGoHome} />
      </View>
    </View>
  );
}

type Copy = {
  icon: string;
  title: string;
  body: string;
  noticeTitle: string;
  noticeBody: string;
};

/**
 * ⚠️ 문구를 컴포넌트 밖으로 뺀 이유는 **세 갈래를 나란히 두고 읽기 위해서**다.
 *    JSX 안에 삼항으로 흩어 두면 어느 경우에 무엇이 보이는지 알 수 없다.
 */
function resolveCopy({
  variant,
  destination,
  groupName,
  alsoLeftGroup,
  newLeaderName,
}: Omit<Props, "onGoHome" | "homeLabel">): Copy {
  /** 모임에 남아 있을 때의 안내. left · delegated 가 같은 문장을 쓴다 */
  const staysInGroup = `${groupName} 모임 목록에서 ${destination} 여행이 계속 보이지만, 눌러서 들어갈 수는 없어요.`;

  if (variant === "delegated") {
    return {
      icon: "👋",
      title: "여행장을 넘기고\n여행에서 나왔어요",
      // ⚠️ 새 여행장 이름을 반드시 말한다. 넘기고 나온 사람이 가장 궁금한 값이다
      body: `${newLeaderName ?? "새 여행장"}님이 ${destination} 여행을 이어서 준비해요.`,
      noticeTitle: "나간 여행은 이렇게 보여요",
      noticeBody: staysInGroup,
    };
  }

  if (variant === "canceled") {
    return {
      icon: "🗂️",
      title: "여행에서 나왔고\n여행도 취소됐어요",
      body: `남은 멤버들이 모두 취소에 동의한 상태였어요.\n${destination} 여행이 취소로 처리됐어요.`,
      /*
        ⚠️ 여기만 안내 내용이 다르다. 여행이 취소된 마당에 '목록에 어떻게
           보이는가' 는 관심사가 아니고, 모아 둔 돈이 어떻게 되는지가 관심사다.
        ⚠️ TripPot 은 돈을 옮기지 않는다. 환불·분배를 대신 해준다고 읽히면 안 된다.
      */
      noticeTitle: "모은 돈은 어떻게 하나요",
      noticeBody:
        "TripPot은 돈을 옮기지 않아요. 정산은 멤버들과 직접 진행해 주세요.",
    };
  }

  return {
    icon: "👋",
    title: `${destination} 여행에서\n나왔어요`,
    body: alsoLeftGroup
      ? `${groupName} 모임에서도 나왔어요.`
      : `${groupName} 모임 멤버로는 남아 있어요.`,
    noticeTitle: "나간 여행은 이렇게 보여요",
    // 모임에서도 나갔으면 모임 자체가 안 보이므로 그 여행도 안 보인다 (POL-MEM-012)
    noticeBody: alsoLeftGroup
      ? "모임에서도 나와서 이 여행은 더 이상 보이지 않아요."
      : staysInGroup,
  };
}
