import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { BRAND } from '@/lib/constants/brandColor';
import type { HomeInvite } from './types';

type Props = {
  /** 띄울 초대. null 이면 모달이 닫혀 있다. */
  invite: HomeInvite | null;
  requesting: boolean;
  onRequestJoin: () => void;
  onDecline: () => void;
  /** 답하지 않고 닫기. 초대는 배너로 남는다. */
  onClose: () => void;
};

/**
 * 홈에 들어왔을 때 답하지 않은 초대를 한 번 알리는 모달. (2026-09-15)
 *
 * 초대한 사람 · 여행지 · 날짜만 보여준다. 승인 전 공개 범위다.
 * (docs/10_여행초대정책_v2.md §11)
 *
 * ⚠️ 닫아도 초대는 사라지지 않는다. 준비 중인 여행 위 배너(InviteBanner)로 남는다.
 *    한 초대에 모달은 한 번만 뜬다. 매번 뜨면 홈에 들어올 때마다 막힌다.
 *
 * ⚠️ 바깥을 눌러도 닫힌다. 답을 강요하지 않는다 — 배너가 남기 때문이다.
 *
 * 데이터만 props 로 받는다. supabase / track() 을 직접 부르지 않는다. (CLAUDE.md 9장)
 */
export function InviteModal({ invite, requesting, onRequestJoin, onDecline, onClose }: Props) {
  return (
    <Modal
      visible={invite !== null}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        className="flex-1 items-center justify-center bg-black/40 px-6"
        onPress={requesting ? undefined : onClose}
        accessibilityLabel="닫기"
      >
        {/* 카드 안을 눌렀을 때 바깥 닫기로 번지지 않게 한 번 받는다. */}
        <Pressable className="w-full max-w-sm rounded-3xl bg-white px-6 pb-5 pt-6" onPress={() => {}}>
          {invite ? (
            <>
              <View className="h-12 w-12 items-center justify-center self-center rounded-full bg-brand-soft">
                <Ionicons name="mail-unread-outline" size={24} color={BRAND.primary} />
              </View>

              <Text className="mt-4 text-center text-lg font-bold text-pot-ink">
                여행 초대가 도착했어요
              </Text>
              <Text className="mt-1.5 text-center text-sm leading-5 text-pot-mute">
                참여 의사를 보내면 여행장이 확인해요.
              </Text>

              <View className="mt-5 rounded-2xl bg-pot-visual px-4 py-3.5">
                <InfoRow label="초대한 사람" value={invite.inviterName ?? '—'} />
                <InfoRow label="여행지" value={invite.destination ?? '—'} />
                <InfoRow label="날짜" value={invite.periodLabel ?? '—'} last />
              </View>

              <View className="mt-5">
                <Button label="참여 의사 보내기" loading={requesting} onPress={onRequestJoin} />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: requesting }}
                disabled={requesting}
                onPress={onDecline}
                className={`mt-2 items-center py-3 ${requesting ? 'opacity-40' : ''}`}
              >
                <Text className="text-sm font-semibold text-pot-mute">거절하기</Text>
              </Pressable>
            </>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function InfoRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View className={`flex-row items-center justify-between ${last ? '' : 'mb-2'}`}>
      <Text className="text-[13px] text-pot-mute">{label}</Text>
      <Text className="ml-4 flex-1 text-right text-[14px] font-semibold text-pot-ink" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}
