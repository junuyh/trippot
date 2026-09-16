// ============================================================================
// 탈퇴 진행 중 (회원탈퇴 30일 유예 · 2026-09-17)
//
// 탈퇴를 신청한 계정으로 다시 로그인하면 루트 가드(app/_layout.tsx)가 홈 대신 여기로 보낸다.
// 이 화면에서 할 수 있는 일은 둘뿐이다: 탈퇴 취소 · 로그아웃. 다른 화면으로는 못 나간다.
//
// ⚠️ 자동 복구는 없다. 취소는 사용자가 직접 누를 때만이다. (docs/15_회원탈퇴정책_v1.md)
// ⚠️ useScreenView 를 부르지 않는다. SCREENS 에 상수가 없고 events.ts 는 공유 파일이다. (CLAUDE.md 8장)
// ============================================================================
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui';
import { useAuth } from '@/lib/auth/AuthProvider';
import { BRAND } from '@/lib/constants/brandColor';
import { cancelWithdrawal } from '@/lib/supabase/queries/users';

export default function ScreenWithdrawalPending() {
  const insets = useSafeAreaInsets();
  const { accountState, refreshAccountState, signOut } = useAuth();
  const [busy, setBusy] = useState(false);

  const effectiveAt =
    accountState?.kind === 'PENDING_WITHDRAWAL' ? new Date(accountState.effectiveAt) : null;

  /** 탈퇴 취소. 서버가 요청 시각을 지우면 계정 상태를 다시 읽고, 가드가 홈으로 보낸다. */
  async function handleCancelWithdrawal() {
    if (busy) return;
    setBusy(true);
    try {
      await cancelWithdrawal();
      await refreshAccountState();
    } catch {
      Alert.alert('탈퇴를 취소하지 못했어요', '잠시 후 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View
      className="flex-1 items-center justify-center bg-white px-8"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom + 16 }}
    >
      <View className="h-16 w-16 items-center justify-center rounded-full bg-brand-soft">
        <Ionicons name="time-outline" size={30} color={BRAND.primary} />
      </View>

      <Text
        className="mt-6 text-center text-pot-ink"
        style={{ fontSize: 20, fontWeight: '800', lineHeight: 28 }}
      >
        이 계정은 탈퇴가 진행 중이에요
      </Text>

      {effectiveAt ? (
        <Text className="mt-2 text-center text-pot-mute" style={{ fontSize: 14, lineHeight: 22 }}>
          탈퇴 예정일: {format(effectiveAt, 'yyyy.MM.dd')}
        </Text>
      ) : null}

      <Text className="mt-4 text-center text-pot-mute" style={{ fontSize: 13, lineHeight: 20 }}>
        예정일까지는 탈퇴를 취소할 수 있어요.{'\n'}
        취소하면 기존 여행과 기록을 그대로 다시 쓸 수 있어요.
      </Text>

      <View className="mt-8 w-full gap-2">
        <Button label="탈퇴 취소" loading={busy} onPress={() => void handleCancelWithdrawal()} />
        <Button
          label="로그아웃"
          variant="secondary"
          disabled={busy}
          onPress={() => void signOut().catch(() => undefined)}
        />
      </View>
    </View>
  );
}
