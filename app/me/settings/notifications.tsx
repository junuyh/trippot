// ============================================================================
// 알림 설정 (MY-01 설정 → 알림)
//
// 어떤 알림을 받을지 켜고 끈다. 받은 알림을 보는 곳은 /me/notifications 다.
//
// ⚠️ useScreenView 를 부르지 않는다. SCREENS 에 이 화면 상수가 없고,
//    events.ts 는 공유 파일이라 임의로 상수를 추가하지 않는다. (CLAUDE.md 8장)
// ============================================================================
import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import { NotificationSettingsList } from '@/components/mypage';
import { ErrorState, Loading } from '@/components/ui';
import { useCurrentUserId } from '@/lib/auth/AuthProvider';
import type { NotificationType } from '@/lib/constants/status';
import {
  getNotificationSettings,
  updateNotificationSettings,
  type NotificationSettings,
} from '@/lib/supabase/queries/users';

type LoadState = 'loading' | 'ready' | 'error';

export default function ScreenNotificationSettings() {
  const userId = useCurrentUserId();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      if (!userId) return;
      const stored = await getNotificationSettings(userId);
      if (!stored) {
        setLoadState('error');
        return;
      }
      setSettings(stored);
      setLoadState('ready');
    } catch {
      // 예외 객체를 화면에 그대로 노출하지 않는다. (components/ui/ErrorState)
      setLoadState('error');
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  /**
   * 스위치 하나를 바꾼다.
   *
   * 먼저 화면을 바꾸고 저장한다. 스위치는 즉시 반응해야 해서 저장을 기다리지
   * 않는다. 대신 **실패하면 되돌리고** 사용자에게 알린다. 조용히 넘어가면
   * 껐다고 생각한 알림이 계속 온다.
   */
  async function handleToggle(type: NotificationType, next: boolean) {
    if (!settings || saving) return;

    const previous = settings;
    const updated: NotificationSettings = { ...settings, [type]: next };

    setSettings(updated);
    setSaving(true);
    try {
      if (!userId) return;
      await updateNotificationSettings(userId, updated);
    } catch {
      setSettings(previous);
      Alert.alert('설정을 저장하지 못했어요', '잠시 후 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* 다른 상세 화면과 같은 헤더. 뒤로 버튼은 root Stack 이 이미 그린다. */}
      <Stack.Screen options={{ title: '알림 설정', headerTitleAlign: 'center' }} />

      {loadState === 'loading' ? <Loading /> : null}
      {loadState === 'error' ? (
        <ErrorState message="알림 설정을 불러오지 못했어요." onRetry={() => void load()} />
      ) : null}
      {loadState === 'ready' && settings ? (
        <NotificationSettingsList
          settings={settings}
          onToggle={(type, next) => void handleToggle(type, next)}
          disabled={saving}
        />
      ) : null}
    </>
  );
}
