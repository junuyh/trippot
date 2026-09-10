// ============================================================================
// 초대 링크를 열 수 없을 때 — 전체 화면 (/invite/[token])
//
// resolveInvite() 가 실패한 이유별로 다른 말을 한다. 다섯 가지를 "잘못된
// 링크예요" 하나로 묶으면, 만료된 사람은 새 링크를 받으면 된다는 걸 모르고
// 인원이 찬 사람은 자기 잘못인 줄 안다.
//
// ⚠️ 실패 이유에도 여행 정보를 붙이지 않는다. 링크가 유효하지 않다는 건
//    이 사람에게 여행을 보여줄 근거가 없다는 뜻이다. (POL-INV-021)
//
// ⚠️ ALREADY_REJECTED 에 "거절당했어요" 라고 쓰지 않는다. 사유를 전달하지
//    않는 것이 정책이고, 링크가 안 된다는 사실만 알리면 된다. (POL-INV-051)
// ============================================================================
import { View } from "react-native";

import { EmptyState } from "@/components/ui";

import type { InviteFailReason } from "./types";

type Copy = {
  icon: "time-outline" | "people-outline" | "link-outline" | "lock-closed-outline";
  title: string;
  description: string;
};

const COPY: Record<InviteFailReason, Copy> = {
  EXPIRED: {
    icon: "time-outline",
    title: "초대 링크가 만료됐어요",
    description: "링크는 7일간만 쓸 수 있어요. 초대한 분에게 새 링크를 받아 주세요.",
  },
  REVOKED: {
    icon: "time-outline",
    title: "초대 링크가 만료됐어요",
    description: "새 링크가 발급되어 이 링크는 더 이상 쓸 수 없어요. 초대한 분에게 새 링크를 받아 주세요.",
  },
  FULL: {
    icon: "people-outline",
    title: "인원이 다 찼어요",
    description: "이 여행은 예정한 인원이 모두 모였어요. 초대한 분에게 문의해 주세요.",
  },
  ALREADY_REJECTED: {
    icon: "lock-closed-outline",
    title: "이 링크로는 참여할 수 없어요",
    description: "초대한 분이 새 링크를 보내 주면 다시 요청할 수 있어요.",
  },
  NOT_FOUND: {
    icon: "link-outline",
    title: "잘못된 링크예요",
    description: "주소가 바르게 복사됐는지 확인해 주세요.",
  },
};

type Props = {
  reason: InviteFailReason;
  onGoHome: () => void;
};

export function InviteUnavailableView({ reason, onGoHome }: Props) {
  const copy = COPY[reason];
  return (
    <View className="flex-1 bg-white">
      <EmptyState
        icon={copy.icon}
        title={copy.title}
        description={copy.description}
        actionLabel="홈으로"
        onAction={onGoHome}
      />
    </View>
  );
}
