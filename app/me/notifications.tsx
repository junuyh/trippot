// ============================================================================
// 알림함 (MY 헤더 🔔)
//
// 실제로 받은 알림을 최신순으로 본다. 어떤 알림을 받을지 고르는 곳은
// /me/settings/notifications 다.
//
// 두 출처를 한 목록으로 합친다. (2026-09-14)
//   db    public.notifications — 이미 있던 서버 알림. 읽음·삭제는 기존 query 그대로.
//   push  기기에 도착해 보관한 알림 — lib/notifications/pushInbox. 제목·본문 그대로.
//   합쳐서 createdAt DESC · 최신 30개(PUSH_INBOX_MAX_ITEMS). 사용자에게 출처를 보여주지 않는다.
//
// ⚠️ 알림을 **만들지 않는다.** 어떤 알림을 언제 보낼지는 팀에서 다시 정한다.
// ⚠️ [중간점검 발표용] 개발 환경에서 두 출처가 **모두** 0건이면 목업을 보여준다.
//    DB 에도 기기에도 아무것도 넣지 않는다. (lib/notifications/demoMock.ts)
// ⚠️ useScreenView 를 부르지 않는다. SCREENS 에 이 화면 상수가 없고,
//    events.ts 는 공유 파일이라 임의로 상수를 추가하지 않는다. (CLAUDE.md 8장)
// ============================================================================
import * as Notifications from 'expo-notifications';
import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { NotificationList, type NotificationListItem } from '@/components/mypage';
import { EmptyState, ErrorState, Loading } from '@/components/ui';
import { useCurrentUserId } from '@/lib/auth/AuthProvider';
import { buildDemoNotifications, isDemoNotification } from '@/lib/notifications/demoMock';
import {
  PUSH_INBOX_MAX_ITEMS,
  deletePushNotification,
  getPushInbox,
  markPushNotificationAsRead,
  type StoredPushNotification,
} from '@/lib/notifications/pushInbox';
import {
  deleteNotification,
  getNotifications,
  markNotificationAsRead,
  type Notification,
} from '@/lib/supabase/queries/notifications';

type LoadState = 'loading' | 'ready' | 'error';

/** DB 행 → 목록 줄. */
function fromDbNotification(row: Notification): NotificationListItem {
  return {
    source: 'db',
    id: row.id,
    title: row.title,
    body: row.body,
    createdAt: row.created_at,
    readAt: row.read_at,
  };
}

/** 기기 보관 알림 → 목록 줄. */
function fromPushNotification(row: StoredPushNotification): NotificationListItem {
  return {
    source: 'push',
    id: row.id,
    title: row.title,
    body: row.body,
    createdAt: row.receivedAt,
    readAt: row.readAt,
  };
}

/** 최신순. 같은 시각이면 출처·id 로 갈라 순서가 흔들리지 않게 한다. */
function byCreatedAtDesc(a: NotificationListItem, b: NotificationListItem): number {
  return (
    b.createdAt.localeCompare(a.createdAt) ||
    a.source.localeCompare(b.source) ||
    a.id.localeCompare(b.id)
  );
}

export default function ScreenNotifications() {
  const userId = useCurrentUserId();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [items, setItems] = useState<NotificationListItem[]>([]);

  const load = useCallback(async () => {
    try {
      if (!userId) return;
      const [dbRows, pushRows] = await Promise.all([
        getNotifications(userId),
        getPushInbox(userId),
      ]);

      // 두 출처를 합쳐 최신순, **최대 30개**만 보여준다. (기기 보관함과 같은 상한)
      // ⚠️ 화면에서 자르는 것뿐이다. 잘린 DB 행을 지우지 않는다. 서버 보관 정책은 미확정.
      const merged = [...dbRows.map(fromDbNotification), ...pushRows.map(fromPushNotification)]
        .sort(byCreatedAtDesc)
        .slice(0, PUSH_INBOX_MAX_ITEMS);

      // ⚠️ [중간점검 발표용] 개발 환경에서 **두 출처가 모두 0건일 때만** 목업을 띄운다.
      //    실제 알림이 하나라도 있으면 언제나 그쪽이 우선이고, 배포 빌드에서는
      //    __DEV__ 가 false 라 목업이 절대 나오지 않는다.
      //    발표가 끝나면 이 줄과 lib/notifications/demoMock.ts 를 지운다.
      setItems(
        __DEV__ && merged.length === 0
          ? buildDemoNotifications().map(fromDbNotification)
          : merged,
      );
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

  function setReadAt(item: NotificationListItem, readAt: string | null) {
    setItems((prev) =>
      prev.map((row) =>
        row.source === item.source && row.id === item.id ? { ...row, readAt } : row,
      ),
    );
  }

  /**
   * 알림 하나를 읽음으로 표시한다.
   *
   * 이미 읽은 알림은 건드리지 않는다. 다시 부르면 read_at 이 덮어써져
   * "처음 읽은 시각" 이 사라진다.
   *
   * 먼저 화면을 바꾸고 저장한다. 실패하면 안 읽음으로 되돌린다.
   * 읽음 처리는 사용자가 다시 누르면 되는 일이라 실패를 알리지는 않는다.
   *
   * ⚠️ 눌러도 어디로 가지 않는다. 푸시 data 구조가 확정되지 않아 이동 경로를 정할 수 없다.
   */
  async function handlePressNotification(item: NotificationListItem) {
    if (item.readAt !== null) return;

    // ⚠️ [중간점검 발표용] 목업은 DB 에 없다. 읽음 처리를 보내면 404 가 난다.
    //    화면에서만 읽음으로 바꾼다.
    if (item.source === 'db' && isDemoNotification(item.id)) {
      setReadAt(item, new Date().toISOString());
      return;
    }

    setReadAt(item, new Date().toISOString());

    try {
      if (!userId) return;
      // 화면 시각이 아니라 저장소가 돌려준 값으로 맞춘다.
      const readAt =
        item.source === 'db'
          ? await markNotificationAsRead(item.id, userId)
          : await markPushNotificationAsRead(userId, item.id);
      setReadAt(item, readAt);
    } catch {
      setReadAt(item, null);
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
  async function handleDeleteNotification(item: NotificationListItem) {
    const previous = items;
    setItems((prev) => prev.filter((row) => !(row.source === item.source && row.id === item.id)));

    // ⚠️ [중간점검 발표용] 목업은 DB 에 없다. 화면에서만 지운다.
    if (item.source === 'db' && isDemoNotification(item.id)) return;

    try {
      if (!userId) return;
      if (item.source === 'db') {
        await deleteNotification(item.id, userId);
      } else {
        await deletePushNotification(userId, item.id);
        // ⚠️ OS 알림 센터에서도 지운다. 남겨 두면 다음 앱 시작의 알림 센터 sync 가
        //    같은 알림을 다시 넣어 "지웠는데 되살아나는" 일이 생긴다. 실패해도 무시.
        Notifications.dismissNotificationAsync(item.id).catch(() => undefined);
      }
    } catch {
      setItems(previous);
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
      {loadState === 'ready' && items.length === 0 ? (
        <EmptyState
          icon="notifications-outline"
          title="아직 받은 알림이 없어요."
          description="여행 준비 소식이 생기면 알려드릴게요."
        />
      ) : null}
      {loadState === 'ready' && items.length > 0 ? (
        <NotificationList
          notifications={items}
          onPressNotification={(item) => void handlePressNotification(item)}
          onDeleteNotification={(item) => void handleDeleteNotification(item)}
        />
      ) : null}
    </>
  );
}
