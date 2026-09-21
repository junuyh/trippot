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
// 헤더 [모두 읽음] (2026-09-20): 현재 사용자의 안 읽은 것 **전부** — DB(read_at) + 기기 보관함(readAt).
//   필터와 무관하다. 두 출처는 한 트랜잭션이 아니라 각각 처리하고, 실패한 쪽만 다시 읽어 안내한다.
//
// ⚠️ 알림을 **만들지 않는다.** 서버 RPC 가 만든다. (migration 20260916000001)
// ⚠️ useScreenView 를 부르지 않는다. SCREENS 에 이 화면 상수가 없고,
//    events.ts 는 공유 파일이라 임의로 상수를 추가하지 않는다. (CLAUDE.md 8장)
// ============================================================================
import * as Notifications from 'expo-notifications';
import { Stack, router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, View } from 'react-native';

import {
  MarkAllReadButton,
  NotificationFilterChips,
  NotificationList,
  type NotificationListItem,
} from '@/components/mypage';
import { EmptyState, ErrorState, Loading } from '@/components/ui';
import { useAuth, useCurrentUserId } from '@/lib/auth/AuthProvider';
import {
  fromDbNotification,
  fromPushNotification,
  toSpendReminderContext,
} from '@/lib/notifications/listItem';
import {
  NOTIFICATION_CATEGORY,
  typesForCategory,
  type NotificationCategory,
} from '@/lib/notifications/notificationCategory';
import { dismissNotificationBanner } from '@/lib/notifications/NotificationBannerObserver';
import { parseSpendReminderTripId } from '@/lib/notifications/spendReminderId';
import {
  deletePushNotification,
  getPushInbox,
  markAllPushNotificationsAsRead,
} from '@/lib/notifications/pushInbox';
import {
  notifyNotificationsChanged,
  useHasUnreadNotifications,
} from '@/lib/notifications/unreadNotifications';
import {
  deleteNotification,
  getNotifications,
  markAllNotificationsAsRead,
  type NotificationCursor,
} from '@/lib/supabase/queries/notifications';
import { getTripsByIds } from '@/lib/supabase/queries/trips';

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
  /** [모두 읽음] 처리 중. 중복 탭 방지. */
  const [markingAll, setMarkingAll] = useState(false);
  /**
   * 안 읽은 것이 하나라도 있는가(DB + 기기 보관함 · 필터·페이지와 무관). 버튼을 그릴지 정한다.
   * 아이콘의 점과 같은 훅이라 [모두 읽음] 뒤 notifyNotificationsChanged 로 함께 꺼진다.
   */
  const hasUnread = useHasUnreadNotifications();

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

        // 지출 리마인드의 보조 문맥('모임명 · 기간'). tripId(메타데이터/id 규칙)만 모아 **한 번**에 읽는다(행마다 묻지 않는다).
        // 못 읽는 여행(권한 없음 등)은 그냥 문맥 없이 둔다. 실패해도 목록은 이미 떠 있다.
        const reminderTripIds = [
          ...new Set(
            pushRows
              .map((row) => row.tripId ?? parseSpendReminderTripId(row.id))
              .filter((id): id is string => id !== null),
          ),
        ];
        if (reminderTripIds.length > 0 && !(__DEV__ && isPreview)) {
          const trips = await getTripsByIds(reminderTripIds).catch(() => []);
          if (seq !== requestSeq.current) return;
          const byId = new Map(trips.map((trip) => [trip.id, toSpendReminderContext(trip)]));
          setPushItems((prev) =>
            prev.map((item) => {
              const tripId = pushRows.find((row) => row.id === item.id)?.tripId ?? parseSpendReminderTripId(item.id);
              const context = tripId ? byId.get(tripId) ?? null : null;
              return context ? { ...item, context } : item;
            }),
          );
        }
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

  /**
   * [모두 읽음] — DB 와 기기 보관함의 안 읽은 것 전부. 필터와 무관하다.
   *
   * 두 출처는 한 트랜잭션이 아니다. 각각 시도하고, 성공한 쪽은 화면에 바로 반영하며(읽음 표시 제거),
   * 실패한 쪽은 그대로 두고 한 번만 안내한다. 억지 rollback 은 하지 않는다 — 읽음은 되돌릴 일이 아니다.
   * 미리보기는 DB 를 묻지 않으므로 기기 보관함만 처리한다.
   * 끝나면 점을 다시 계산하고(notifyNotificationsChanged), 떠 있는 배너를 내린다.
   */
  async function handleMarkAllRead() {
    if (!userId || markingAll) return;
    setMarkingAll(true);
    const now = new Date().toISOString();
    const readAll = (rows: NotificationListItem[]) =>
      rows.map((row) => (row.readAt === null ? { ...row, readAt: now } : row));

    const [db, push] = await Promise.allSettled([
      __DEV__ && isPreview ? Promise.resolve(0) : markAllNotificationsAsRead(userId),
      markAllPushNotificationsAsRead(userId),
    ]);
    if (db.status === 'fulfilled') setDbItems(readAll);
    if (push.status === 'fulfilled') setPushItems(readAll);

    // 한쪽이라도 바뀌었을 수 있다. 점 · 헤더 버튼을 다시 계산하고 배너를 내린다.
    notifyNotificationsChanged();
    dismissNotificationBanner();
    setMarkingAll(false);

    if (db.status === 'rejected' || push.status === 'rejected') {
      // 예외 객체를 그대로 보여주지 않는다. 다시 누르면 남은 쪽만 처리된다(이미 읽은 행은 건드리지 않는다).
      Alert.alert('일부 알림을 읽음 처리하지 못했어요', '잠시 후 다시 시도해 주세요.');
    }
  }

  const items = [...dbItems, ...pushItems].sort(byCreatedAtDesc);

  return (
    <View className="flex-1 bg-white">
      {/*
        설정 화면과 같은 헤더 패턴. 뒤로 버튼은 root Stack 이 이미 그린다. 오른쪽은 [모두 읽음] — 항상.
        안 읽은 것이 없으면 회색 비활성으로 남긴다(MarkAllReadButton 주석). 실제 글자가 그려지므로
        iOS 헤더의 빈 슬롯(둥근 유리 원)은 생기지 않는다. (null 컴포넌트를 넘기면 생겼다 · 시뮬 확인)
      */}
      <Stack.Screen
        options={{
          title: '알림',
          headerTitleAlign: 'center',
          headerRight: () => (
            <MarkAllReadButton
              enabled={hasUnread}
              busy={markingAll}
              onPress={() => void handleMarkAllRead()}
            />
          ),
        }}
      />

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
