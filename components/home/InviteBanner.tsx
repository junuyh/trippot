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
 * 카톡 링크로 들어간 초대 화면(INV-02)에서 **참여 요청도 거절도 누르지 않고 창을 닫으면**
 * 그 건이 처리되지 않은 채 남는다. 그때 홈이 대신 알린다.
 * GitHub 저장소 첫 화면의 "Compare & pull request" 줄처럼, 답할 때까지 준비 중인 여행
 * 위에 계속 남는다.
 *
 * ⚠️ 닫기(X) 버튼을 두지 않는다. 사라지는 길은 '참여 요청하기' 와 '거절하기' 둘뿐이다.
 *    링크가 만료되거나 그새 참여가 확정되면 화면 파일이 알아서 뺀다.
 *
 * ⚠️ 2026-09-16 홈 모달을 뺐다. 배너 하나로 충분하다 — 초대를 읽는 자리는 초대 화면이고,
 *    여기는 "아직 답하지 않았다" 를 알리는 자리다. 모달은 이미 한 번 본 내용을 다시
 *    가로막는 셈이었다.
 *
 * ⚠️ **색은 이 배너에만 쓰는 브랜드 퍼플이다.** (2026-09-16)
 *    홈의 다른 카드는 국가색이나 무채색을 쓴다. 이 배너만 다른 색을 쓰는 이유는
 *    내 여행 카드가 아니라 **답해야 할 일**이라서다. 색이 그 차이를 말한다.
 *    tailwind.config.js 를 고치지 않았다. 그 파일은 25개 화면이 함께 쓴다. (CLAUDE.md 5장)
 *
 * ⚠️ 2026-09-17 퍼플 값을 직접 적지 않고 BRAND 토큰에서 가져온다.
 *    직접 적은 연보라(#F3ECF7)가 확정값 BRAND.primarySoft(#F6F0FA)와 미묘하게
 *    달라서, 같은 성격의 배너인 여행 홈 JoinRequestBanner 와 톤이 어긋났다.
 *    두 화면이 "같은 색" 이라고 말하면서 실제로는 다른 상태였다.
 *    (2026-09-16 Final Color System · lib/constants/brandColor.ts)
 *
 * 데이터만 props 로 받는다. supabase / track() 을 직접 부르지 않는다. (CLAUDE.md 9장)
 */

/** 브랜드 퍼플. 이 배너의 기준색이다. */
const PURPLE = BRAND.primary;
/** 눌렀을 때. 기준색보다 어둡다. */
const PURPLE_DEEP = BRAND.primaryPressed;
/** 배너 바탕. */
const PURPLE_TINT = BRAND.primarySoft;
/**
 * 배너 테두리 · 보조 버튼 테두리.
 *
 * ⚠️ BRAND 에는 테두리 값이 없다. 확정된 세 값(primary · primaryPressed ·
 *    primarySoft)뿐이라 여기만 직접 적는다. 토큰이 생기면 이 줄을 지운다.
 */
const PURPLE_LINE = '#E0D0EC';
/** 본문 보조 글자. */
const BODY = '#6B5B78';

export function InviteBanner({ invite, requesting, onRequestJoin, onDecline }: Props) {
  const inviter = invite.inviterName ? `${invite.inviterName}님이` : '함께 갈 사람이';
  const destination = invite.destination ?? '여행';

  return (
    <View
      accessibilityRole="summary"
      style={{
        borderRadius: 16,
        borderWidth: 1,
        borderColor: PURPLE_LINE,
        backgroundColor: PURPLE_TINT,
        paddingHorizontal: 16,
        paddingVertical: 14,
      }}
    >
      <View className="flex-row items-start">
        <Ionicons name="mail-unread-outline" size={20} color={PURPLE} style={{ marginTop: 1 }} />
        <View className="ml-2.5 flex-1">
          {/*
            ⚠️ 제목은 PURPLE_DEEP 이 아니라 기준색이다. BRAND.primaryPressed 는
               "실제 눌린 상태에서만" 쓰기로 확정된 값이라 글자색으로 쓰지 않는다.
               (lib/constants/brandColor.ts · 2026-09-17)
          */}
          <Text style={{ fontSize: 15, fontWeight: '700', lineHeight: 20, color: PURPLE }}>
            {inviter} {destination} 여행에 초대했어요
          </Text>
          <Text style={{ marginTop: 2, fontSize: 13, color: BODY }}>
            {invite.periodLabel ? `${invite.periodLabel} · ` : ''}아직 답하지 않았어요
          </Text>
        </View>
      </View>

      <View className="mt-3 flex-row justify-end gap-2">
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: requesting }}
          disabled={requesting}
          onPress={onDecline}
          style={{
            height: 36,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 10,
            borderWidth: 1,
            borderColor: PURPLE_LINE,
            backgroundColor: '#FFFFFF',
            paddingHorizontal: 14,
            opacity: requesting ? 0.4 : 1,
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '700', color: PURPLE }}>거절하기</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: requesting, busy: requesting }}
          disabled={requesting}
          onPress={onRequestJoin}
          style={{
            height: 36,
            minWidth: 104,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 10,
            backgroundColor: requesting ? PURPLE_DEEP : PURPLE,
            paddingHorizontal: 14,
          }}
        >
          {requesting ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>참여 요청하기</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
