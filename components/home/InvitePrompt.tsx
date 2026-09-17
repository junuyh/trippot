import { View } from 'react-native';

import { InviteBanner } from './InviteBanner';
import type { HomeInvite } from './types';

export type InvitePromptProps = {
  /** 답하지 않은 초대. 없으면 빈 배열이고 이 칸을 그리지 않는다. */
  invites: HomeInvite[];
  /** 참여 요청을 보내는 중인 초대의 token. 없으면 null. */
  requestingToken: string | null;
  onRequestJoin: (token: string) => void;
  onDecline: (token: string) => void;
};

/**
 * 홈 맨 위의 초대 칸. 답하지 않은 초대마다 상시 배너 한 줄. (2026-09-15)
 *
 * ⚠️ **두 홈이 함께 쓴다.** 기존 사용자 홈(HomeView)은 준비 중인 여행 위에,
 *    신규 사용자 홈(HomeEmpty)은 추천 여행지 위에 놓는다. 초대받은 사람은
 *    여행이 하나도 없는 신규 사용자일 때가 많아서 한쪽만 두면 안 된다.
 *
 * ⚠️ 2026-09-16 홈 모달(InviteModal)을 뺐다. 초대 내용은 초대 화면(INV-02)에서 이미
 *    보여준다. 홈은 "아직 답하지 않았다" 만 알리면 된다.
 *
 * 데이터만 props 로 받는다. supabase / track() 을 직접 부르지 않는다. (CLAUDE.md 9장)
 */
export function InvitePrompt({
  invites,
  requestingToken,
  onRequestJoin,
  onDecline,
}: InvitePromptProps) {
  if (invites.length === 0) return null;

  return (
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
  );
}
