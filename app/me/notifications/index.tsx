// ============================================================================
// 알림센터 (MY 헤더 🔔)  ·  /me/notifications        (docs/14_알림센터_v1.md)
//
// 사용자가 알아야 하는 여행·참여 상태 변화를 나중에도 다시 보고, 눌러서 상세 → 행동으로
// 이어가는 통합 알림함이다. "푸시 알림 목록" 이 아니다. 어떤 알림을 받을지 고르는 곳은
// /me/settings/notifications 다.
//
// 데이터 (docs/14 §2 · §9 · §11)
//   db    public.notifications — Source of Truth. 최근 1년 · 최신순 · 30건 커서 페이지.
//         필터 칩은 **서버 쪽** type 필터다. 30건 받아 놓고 앱에서 거르지 않는다.
//   push  기기에 도착해 보관한 알림(lib/notifications/pushInbox) — notificationId 가 없는
//         generic/test Push 의 **fallback**. type 이 없어 [전체] 에서만 보인다.
//   두 출처를 합쳐 최신순. 사용자에게 출처를 보여주지 않는다.
//   이전의 "전체 select → 화면에서 30개" 는 폐기했다. (2026-09-16)
//
// ⚠️ 개발용 미리보기(isPreview)는 실제 세션이 없다. RLS 가 잠기면 notifications 조회가
//    permission 오류가 되므로 DB 를 묻지 않고 기기 보관함(push)만 보여준다. 가짜 DB 알림을 만들지 않는다.
//
// 누르면 상세(/me/notifications/:id)로 간다. 읽음 처리는 상세 진입에서 한다. (docs/14 §7)
// 왼쪽으로 밀면 삭제. DB 는 hard delete, push 는 기기 보관함 + OS 알림 센터에서 제거.
//
// ⚠️ 알림을 **만들지 않는다.** 서버 RPC 가 만든다. (migration 20260916000001)
// ⚠️ useScreenView 를 부르지 않는다. SCREENS 에 이 화면 상수가 없고,
//    events.ts 는 공유 파일이라 임의로 상수를 추가하지 않는다. (CLAUDE.md 8장)
// ============================================================================
import * as Notifications from 'expo-notifications';
import { Stack, router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { View } from 'react-native';

import {
  NotificationFilterChips,
  NotificationList,
  type NotificationListItem,
} from '@/components/mypage';
import { EmptyState, ErrorState, Loading } from '@/components/ui';
import { useAuth, useCurrentUserId } from '@/lib/auth/AuthProvider';
import { fromDbNotification, fromPushNotification } from '@/lib/notifications/listItem';
import {
  NOTIFICATION_CATEGORY,
  typesForCategory,
  type NotificationCategory,
} from '@/lib/notifications/notificationCategory';
import { deletePushNotification, getPushInbox } from '@/lib/notifications/pushInbox';
import { notifyNotificationsChanged } from '@/lib/notifications/unreadNotifications';
import {
  deleteNotification,
  getNotifications,
  type NotificationCursor,
} from '@/lib/supabase/queries/notifications';

type LoadState = 'loading' | 'ready' | 'error';

/** 최신순. 같은 시각이면 출처·id 로 갈라 순서가 흔들리지 않게 한다. */
function byCreatedAtDesc(a: NotificationListItem, b: NotificationListItem): number {
  return (
    b.createdAt.localeCompare(a.createdAt) ||
    a.source.localeCompare(b.source) ||
    b.id.localeCompare(a.id)
  );
}

export default function ScreenNotifications() {
  const userId = useCurrentUserId();
  const { isPreview } = useAuth();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [category, setCategory] = useState<NotificationCategory>(NOTIFICATION_CATEGORY.ALL);
  /** DB 페이지들을 이어 붙인 것. 필터가 바뀌면 처음부터. */
  const [dbItems, setDbItems] = useState<NotificationListItem[]>([]);
  /** 기기 보관 알림. [전체] 에서만 섞는다. */
  const [pushItems, setPushItems] = useState<NotificationListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<NotificationCursor | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  /** 요청이 겹칠 때(필터 연타 · 포커스 복귀) 늦게 온 응답이 화면을 덮지 않게 한다. */
  const requestSeq = useRef(0);

  const loadFirstPage = useCallback(
    async (nextCategory: NotificationCategory) => {
      if (!userId) return;
      const seq = ++requestSeq.current;
      setLoadState('loading');
      try {
        const [page, pushRows] = await Promise.all([
          // 미리보기는 DB 를 묻지 않는다 (위 머리 주석). 빈 페이지로 본다.
          __DEV__ && isPreview
            ? Promise.resolve({ rows: [], nextCursor: null })
            : getNotifications(userId, { types: typesForCategory(nextCategory) }),
          nextCategory === NOTIFICATION_CATEGORY.ALL ? getPushInbox(userId) : Promise.resolve([]),
        ]);
        if (seq !== requestSeq.current) return;
        setDbItems(page.rows.map(fromDbNotification));
        setPushItems(pushRows.map(fromPushNotification));
        setNextCursor(page.nextCursor);
        setLoadState('ready');
      } catch {
        if (seq !== requestSeq.current) return;
        // 예외 객체를 화면에 그대로 노출하지 않는다. (components/ui/ErrorState)
        setLoadState('error');
      }
    },
    [userId, isPreview],
  );

  // 돌아올 때마다 첫 페이지를 다시 본다. 상세에서 읽음 처리한 결과 · 새 알림이 반영된다.
  useFocusEffect(
    useCallback(() => {
      void loadFirstPage(category);
    }, [loadFirstPage, category]),
  );

  function handleSelectCategory(next: NotificationCategory) {
    if (next === category) return;
    setCategory(next);
    void loadFirstPage(next);
  }

  /** [더 보기] — 다음 30건. 커서는 마지막 행의 (created_at, id). */
  async function handleLoadMore() {
    if (!userId || !nextCursor || loadingMore) return;
    const seq = requestSeq.current;
    setLoadingMore(true);
    try {
      const page = await getNotifications(userId, {
        types: typesForCategory(category),
        cursor: nextCursor,
      });
      if (seq !== requestSeq.current) return;
      setDbItems((prev) => [...prev, ...page.rows.map(fromDbNotification)]);
      setNextCursor(page.nextCursor);
    } catch {
      // 다음 페이지 실패는 목록을 깨지 않는다. 다시 누르면 된다.
    } finally {
      setLoadingMore(false);
    }
  }

  /** 상세로. 읽음 처리는 상세 화면이 한다. (docs/14 §7 — 목록에 떴다고 읽은 게 아니다) */
  function handlePressNotification(item: NotificationListItem) {
    router.push({
      pathname: '/me/notifications/[notificationId]',
      params: { notificationId: item.id, source: item.source },
    });
  }

  /**
   * 알림 하나를 지운다. ⚠️ 되돌릴 수 없다. 확인 모달·Undo 는 MVP 범위가 아니다.
   * 먼저 목록에서 빼고 지운다. 실패하면 되돌린다.
   */
  async function handleDeleteNotification(item: NotificationListItem) {
    const previousDb = dbItems;
    const previousPush = pushItems;
    if (item.source === 'db') setDbItems((prev) => prev.filter((row) => row.id !== item.id));
    else setPushItems((prev) => prev.filter((row) => row.id !== item.id));

    try {
      if (!userId) return;
      if (item.source === 'db') {
        await deleteNotification(item.id, userId);
        // 안 읽은 알림을 지웠을 수 있다 — 아이콘의 점을 다시 계산한다.
        notifyNotificationsChanged();
      } else {
        await deletePushNotification(userId, item.id);
        // 안 읽은 기기 알림을 지웠을 수 있다 — 점을 다시 계산한다.
        notifyNotificationsChanged();
        // ⚠️ OS 알림 센터에서도 지운다. 남겨 두면 다음 앱 시작의 알림 센터 sync 가
        //    같은 알림을 다시 넣어 "지웠는데 되살아나는" 일이 생긴다. 실패해도 무시.
        Notifications.dismissNotificationAsync(item.id).catch(() => undefined);
      }
    } catch {
      setDbItems(previousDb);
      setPushItems(previousPush);
    }
  }

  const items = [...dbItems, ...pushItems].sort(byCreatedAtDesc);

  return (
    <View className="flex-1 bg-white">
      {/* 설정 화면과 같은 헤더 패턴. 뒤로 버튼은 root Stack 이 이미 그린다. */}
      <Stack.Screen options={{ title: '알림', headerTitleAlign: 'center' }} />

      <NotificationFilterChips selected={category} onSelect={handleSelectCategory} />

      {loadState === 'loading' ? <Loading /> : null}
      {loadState === 'error' ? (
        <ErrorState
          message="알림을 불러오지 못했어요."
          onRetry={() => void loadFirstPage(category)}
        />
      ) : null}
      {loadState === 'ready' && items.length === 0 ? (
        <EmptyState
          icon="notifications-outline"
          title={
            category === NOTIFICATION_CATEGORY.ALL
              ? '아직 받은 알림이 없어요.'
              : '이 종류의 알림이 없어요.'
          }
          description="최근 1년 동안 온 알림을 보여드려요."
        />
      ) : null}
      {loadState === 'ready' && items.length > 0 ? (
        <NotificationList
          notifications={items}
          onPressNotification={handlePressNotification}
          onDeleteNotification={(item) => void handleDeleteNotification(item)}
          hasMore={nextCursor !== null}
          loadingMore={loadingMore}
          onLoadMore={() => void handleLoadMore()}
        />
      ) : null}
    </View>
  );
}
