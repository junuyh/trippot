import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { BRAND } from '@/lib/constants/brandColor';

import type { HomeInvite } from './types';

type Props = {
  invite: HomeInvite;
  /** 이 초대로 참여 요청을 보내는 중. 버튼 두 개를 모두 막는다. (중복 제출 방지) */
  requesting: boolean;
  onRequestJoin: () => void;
  onDecline: () => void;
};

/**
 * 답하지 않은 여행 초대를 알리는 상시 배너. (2026-09-15)
 *
 * GitHub 저장소 첫 화면의 "Compare & pull request" 줄처럼, 사용자가 답할 때까지
 * **준비 중인 여행 위에 계속 남는다.** 모달을 그냥 닫아도 여기서 다시 답할 수 있다.
 *
 * ⚠️ 닫기(X) 버튼을 두지 않는다. 사라지는 길은 '참여 요청하기' 와 '거절하기' 둘뿐이다.
 *    링크가 만료되거나 그새 참여가 확정되면 화면 파일이 알아서 뺀다.
 *
 * ⚠️ 모양은 여행 카드와 겹치지 않게 얇은 테두리 한 줄로 둔다. 홈은 내 여행이 놓인
 *    선반이라, 알림이 카드보다 커 보이면 선반이 가려진다.
 *
 * 데이터만 props 로 받는다. supabase / track() 을 직접 부르지 않는다. (CLAUDE.md 9장)
 */
export function InviteBanner({ invite, requesting, onRequestJoin, onDecline }: Props) {
  const inviter = invite.inviterName ? `${invite.inviterName}님이` : '함께 갈 사람이';
  const destination = invite.destination ?? '여행';

  return (
    <View
      className="rounded-2xl border border-pot-line bg-pot-visual px-4 py-3.5"
      accessibilityRole="summary"
    >
      <View className="flex-row items-start">
        <Ionicons name="mail-unread-outline" size={20} color={BRAND.primary} style={{ marginTop: 1 }} />
        <View className="ml-2.5 flex-1">
          <Text className="text-[15px] font-semibold leading-5 text-pot-ink">
            {inviter} {destination} 여행에 초대했어요
          </Text>
          {invite.periodLabel ? (
            <Text className="mt-0.5 text-[13px] text-pot-mute">{invite.periodLabel}</Text>
          ) : null}
        </View>
      </View>

      <View className="mt-3 flex-row justify-end gap-2">
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: requesting }}
          disabled={requesting}
          onPress={onDecline}
          className={`h-9 items-center justify-center rounded-lg border border-pot-line bg-white px-3.5 active:bg-pot-visual ${
            requesting ? 'opacity-40' : ''
          }`}
        >
          <Text className="text-[13px] font-semibold text-pot-ink">거절하기</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: requesting, busy: requesting }}
          disabled={requesting}
          onPress={onRequestJoin}
          className="h-9 min-w-[104px] items-center justify-center rounded-lg bg-brand px-3.5 active:bg-brand-pressed"
        >
          {requesting ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text className="text-[13px] font-semibold text-white">초대 수락하기</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
