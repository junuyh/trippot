// ============================================================================
// 알림함 (MY 헤더 🔔)
//
// 실제로 받은 알림을 최신순으로 본다. 어떤 알림을 받을지 고르는 곳은
// /me/settings/notifications 다.
//
// ⚠️ 알림을 **만들지 않는다.** 생성 시점(D-7 스케줄러 등)은 이번 범위가 아니다.
// ⚠️ [중간점검 발표용] 개발 환경에서 알림이 0건이면 목업을 보여준다.
//    DB 에는 아무것도 넣지 않는다. (lib/notifications/demoMock.ts)
// ⚠️ useScreenView 를 부르지 않는다. SCREENS 에 이 화면 상수가 없고,
//    events.ts 는 공유 파일이라 임의로 상수를 추가하지 않는다. (CLAUDE.md 8장)
// ============================================================================
import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { NotificationList } from '@/components/mypage';
import { EmptyState, ErrorState, Loading } from '@/components/ui';
import { DEV_USER_ID } from '@/lib/constants/devUser';
import { buildDemoNotifications, isDemoNotification } from '@/lib/notifications/demoMock';
import {
  deleteNotification,
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

      // ⚠️ [중간점검 발표용] 개발 환경에서 **실제 알림이 0건일 때만** 목업을 띄운다.
      //    실제 데이터가 있으면 언제나 그쪽이 우선이고, 배포 빌드에서는
      //    __DEV__ 가 false 라 목업이 절대 나오지 않는다.
      //    발표가 끝나면 이 줄과 lib/notifications/demoMock.ts 를 지운다.
      setNotifications(__DEV__ && rows.length === 0 ? buildDemoNotifications() : rows);
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

    // ⚠️ [중간점검 발표용] 목업은 DB 에 없다. 읽음 처리를 보내면 404 가 난다.
    //    화면에서만 읽음으로 바꾼다.
    if (isDemoNotification(notification.id)) {
      setNotifications((prev) =>
        prev.map((row) =>
          row.id === notification.id ? { ...row, read_at: new Date().toISOString() } : row,
        ),
      );
      return;
    }

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

  /**
   * 알림 하나를 지운다.
   *
   * ⚠️ 되돌릴 수 없다. 확인 모달·Undo 는 MVP 범위가 아니다.
   *    스와이프로만 닿을 수 있어 실수로 눌리기 어렵다.
   *
   * 먼저 목록에서 빼고 지운다. 실패하면 되돌린다.
   */
  async function handleDeleteNotification(notification: Notification) {
    const previous = notifications;
    setNotifications((prev) => prev.filter((row) => row.id !== notification.id));

    // ⚠️ [중간점검 발표용] 목업은 DB 에 없다. 화면에서만 지운다.
    if (isDemoNotification(notification.id)) return;

    try {
      // TODO: 로그인 연동 시 교체
      await deleteNotification(notification.id, DEV_USER_ID);
    } catch {
      setNotifications(previous);
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
          onDeleteNotification={(notification) => void handleDeleteNotification(notification)}
        />
      ) : null}
    </>
  );
}
