// ============================================================================
// 알림함 (MY 헤더 🔔)
//
// 실제로 받은 알림을 최신순으로 본다. 어떤 알림을 받을지 고르는 곳은
// /me/settings/notifications 다.
//
// ⚠️ 알림을 **만들지 않는다.** 생성 시점(D-7 스케줄러 등)은 이번 범위가 아니다.
// ⚠️ useScreenView 를 부르지 않는다. SCREENS 에 이 화면 상수가 없고,
//    events.ts 는 공유 파일이라 임의로 상수를 추가하지 않는다. (CLAUDE.md 8장)
// ============================================================================
import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { NotificationList } from '@/components/mypage';
import { EmptyState, ErrorState, Loading } from '@/components/ui';
import { DEV_USER_ID } from '@/lib/constants/devUser';
import {
  getNotifications,
  markNotificationAsRead,
  type Notification,
} from '@/lib/supabase/queries/notifications';

type LoadState = 'loading' | 'ready' | 'error';

export default function ScreenNotifications() {
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const load = useCallback(async () => {
    try {
      // TODO: 로그인 연동 시 교체
      // 이미 created_at DESC 로 정렬돼 온다. 화면에서 다시 정렬하지 않는다.
      const rows = await getNotifications(DEV_USER_ID);
      setNotifications(rows);
      setLoadState('ready');
    } catch {
      // 예외 객체를 화면에 그대로 노출하지 않는다. (components/ui/ErrorState)
      setLoadState('error');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  /**
   * 알림 하나를 읽음으로 표시한다.
   *
   * 이미 읽은 알림은 건드리지 않는다. 다시 부르면 read_at 이 덮어써져
   * "처음 읽은 시각" 이 사라진다.
   *
   * 먼저 화면을 바꾸고 저장한다. 실패하면 안 읽음으로 되돌린다.
   * 읽음 처리는 사용자가 다시 누르면 되는 일이라 실패를 알리지는 않는다.
   */
  async function handlePressNotification(notification: Notification) {
    if (notification.read_at !== null) return;

    setNotifications((prev) =>
      prev.map((row) =>
        row.id === notification.id ? { ...row, read_at: new Date().toISOString() } : row,
      ),
    );

    try {
      // TODO: 로그인 연동 시 교체
      // 화면 시각이 아니라 DB 가 돌려준 값으로 맞춘다.
      const readAt = await markNotificationAsRead(notification.id, DEV_USER_ID);
      setNotifications((prev) =>
        prev.map((row) => (row.id === notification.id ? { ...row, read_at: readAt } : row)),
      );
    } catch {
      setNotifications((prev) =>
        prev.map((row) => (row.id === notification.id ? { ...row, read_at: null } : row)),
      );
    }
  }

  return (
    <>
      {/* 설정 화면과 같은 헤더 패턴. 뒤로 버튼은 root Stack 이 이미 그린다. */}
      <Stack.Screen options={{ title: '알림 메시지', headerTitleAlign: 'center' }} />

      {loadState === 'loading' ? <Loading /> : null}
      {loadState === 'error' ? (
        <ErrorState message="알림을 불러오지 못했어요." onRetry={() => void load()} />
      ) : null}
      {loadState === 'ready' && notifications.length === 0 ? (
        <EmptyState
          icon="notifications-outline"
          title="아직 받은 알림이 없어요."
          description="여행 준비 소식이 생기면 알려드릴게요."
        />
      ) : null}
      {loadState === 'ready' && notifications.length > 0 ? (
        <NotificationList
          notifications={notifications}
          onPressNotification={(notification) => void handlePressNotification(notification)}
        />
      ) : null}
    </>
  );
}
