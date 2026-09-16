// ============================================================================
// 초대 링크를 열 수 없을 때 — 전체 화면 (/invite/[token] · /invite/by/[inviteId])
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
//
// 2026-09-16 · visual 만 바꿨다 (InviteShell 카드 안 · 공용 EmptyState 대신 같은 구성을 그린다).
//    아이콘 · 문구 · [홈으로] 동작은 그대로다.
// ============================================================================
import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import { InvitePrimaryButton } from "./InviteButtons";
import { InviteShell } from "./InviteShell";
import { INVITE_THEME } from "./inviteTheme";
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
  // ⚠️ "새 링크가 발급되어" 라고 쓰지 않는다. 재발급이 기존 링크를 끊는 정책은 폐기됐다.
  //    (docs/10_v2 §4) revoked_at 이 채워지는 경로는 지금 없다 — 자리만 둔다.
  REVOKED: {
    icon: "time-outline",
    title: "사용할 수 없는 초대 링크예요",
    description: "이 링크는 더 이상 쓸 수 없어요. 초대한 분에게 새 링크를 받아 주세요.",
  },
  // ⚠️ FULL 은 없다. 인원이 차도 링크는 유효하고 요청도 받는다. (docs/12 §3)
  // 같은 invite 에서 거절된 사람. 다른 사람·새 링크에는 영향이 없다. (docs/12 §4)
  ALREADY_REJECTED: {
    icon: "lock-closed-outline",
    title: "이 초대에는 다시 응답할 수 없어요",
    description: "새 초대 링크를 받으면 다시 수락할 수 있어요.",
  },
  NOT_FOUND: {
    icon: "link-outline",
    title: "초대 정보를 찾을 수 없어요",
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
    <InviteShell footer={<InvitePrimaryButton label="홈으로" onPress={onGoHome} />}>
      <View className="items-center">
        <View
          className="mt-8 h-14 w-14 items-center justify-center rounded-full"
          style={{ backgroundColor: INVITE_THEME.well }}
        >
          <Ionicons name={copy.icon} size={26} color={INVITE_THEME.primary} />
        </View>
        <Text
          className="mt-4 text-center text-base font-semibold"
          style={{ color: INVITE_THEME.ink }}
        >
          {copy.title}
        </Text>
        <Text
          className="mt-1.5 text-center text-sm leading-5"
          style={{ color: INVITE_THEME.body }}
        >
          {copy.description}
        </Text>
      </View>
    </InviteShell>
  );
}
