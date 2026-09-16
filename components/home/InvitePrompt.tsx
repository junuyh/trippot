import { View } from 'react-native';

import { InviteBanner } from './InviteBanner';
import { InviteModal } from './InviteModal';
import type { HomeInvite } from './types';

export type InvitePromptProps = {
  /** 답하지 않은 초대. 없으면 빈 배열이고 이 칸을 그리지 않는다. */
  invites: HomeInvite[];
  /** 지금 모달로 띄울 초대. 한 초대에 한 번만 온다. 없으면 null. */
  modalInvite: HomeInvite | null;
  /** 참여 요청을 보내는 중인 초대의 token. 없으면 null. */
  requestingToken: string | null;
  onRequestJoin: (token: string) => void;
  onDecline: (token: string) => void;
  onCloseModal: () => void;
};

/**
 * 홈 맨 위의 초대 칸. 상시 배너 목록 + 한 번 뜨는 모달. (2026-09-15)
 *
 * ⚠️ **두 홈이 함께 쓴다.** 기존 사용자 홈(HomeView)은 준비 중인 여행 위에,
 *    신규 사용자 홈(HomeEmpty)은 추천 여행지 위에 놓는다. 초대받은 사람은
 *    여행이 하나도 없는 신규 사용자일 때가 많아서 한쪽만 두면 안 된다.
 *
 * 데이터만 props 로 받는다. supabase / track() 을 직접 부르지 않는다. (CLAUDE.md 9장)
 */
export function InvitePrompt({
  invites,
  modalInvite,
  requestingToken,
  onRequestJoin,
  onDecline,
  onCloseModal,
}: InvitePromptProps) {
  return (
    <>
      {invites.length > 0 ? (
        <View className="mb-6 gap-2.5">
          {invites.map((invite) => (
            <InviteBanner
              key={invite.token}
              invite={invite}
              // 한 번에 하나만 보낸다. 다른 초대 버튼도 같이 막아 요청이 겹치지 않게 한다.
              requesting={requestingToken !== null}
              onRequestJoin={() => onRequestJoin(invite.token)}
              onDecline={() => onDecline(invite.token)}
            />
          ))}
        </View>
      ) : null}

      <InviteModal
        invite={modalInvite}
        requesting={modalInvite !== null && requestingToken === modalInvite.token}
        onRequestJoin={() => {
          if (modalInvite) onRequestJoin(modalInvite.token);
        }}
        onDecline={() => {
          if (modalInvite) onDecline(modalInvite.token);
        }}
        onClose={onCloseModal}
      />
    </>
  );
}
