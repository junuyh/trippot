// ============================================================================
// 알림 상세  ·  /me/notifications/:notificationId?source=db|push   (docs/14 §6 · §7)
//
// 목록에서 누르면 바로 domain 화면으로 가지 않고 여기를 먼저 거친다.
//   title · body(스냅샷) · 발생 시각 · 관련 여행 · **지금 상태** · CTA
//
// source=db   public.notifications 한 행. 진입하면 읽음(read_at) — 사용자의 실제 확인 행동이다.
//             상태·CTA 는 lib/notifications/resolveNotificationAction 이 현재 domain 을 다시 물어 정한다.
// source=push 기기 보관 알림(generic Push fallback). 문맥이 없어 CTA 없음. 진입하면 읽음.
//
// ⚠️ 알림 id 만으로 조회하지 않는다. userId 로 함께 좁혀 남의 알림을 열 수 없다.
// ⚠️ useScreenView 를 부르지 않는다. (SCREENS 상수 없음 · events.ts 는 공유 파일)
// ============================================================================
import { format, isValid, parseISO } from 'date-fns';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { NotificationDetailView, type NotificationDetailItem } from '@/components/mypage';
import { EmptyState, ErrorState, Loading } from '@/components/ui';
import { useAuth, useCurrentUserId } from '@/lib/auth/AuthProvider';
import { fromDbNotification, fromPushNotification } from '@/lib/notifications/listItem';
import { toTripLabel } from '@/lib/notifications/messages';
import { getPushInbox, markPushNotificationAsRead } from '@/lib/notifications/pushInbox';
import { notifyNotificationsChanged } from '@/lib/notifications/unreadNotifications';
import { resolveNotificationAction } from '@/lib/notifications/resolveNotificationAction';
import { getNotification, markNotificationAsRead } from '@/lib/supabase/queries/notifications';
import { getTripById } from '@/lib/supabase/queries/trips';

type LoadState = 'loading' | 'ready' | 'missing' | 'error';

/** '도쿄 여행 · 10.2–10.5'. 일정이 없으면 라벨만. */
function toTripLine(destination: string | null, start: string | null, end: string | null): string {
  const label = toTripLabel(destination);
  if (!start || !end) return label;
  const s = parseISO(start);
  const e = parseISO(end);
  if (!isValid(s) || !isValid(e)) return label;
  return `${label} · ${format(s, 'M.d')}–${format(e, 'M.d')}`;
}

export default function ScreenNotificationDetail() {
  const { notificationId, source } = useLocalSearchParams<{
    notificationId: string;
    source?: string;
  }>();
  const userId = useCurrentUserId();
  const { isPreview } = useAuth();
  const isPush = source === 'push';

  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [item, setItem] = useState<NotificationDetailItem | null>(null);
  /** 상태·CTA 계산 중. 본문은 먼저 보여주고 버튼만 나중에 붙는다. */
  const [resolving, setResolving] = useState(false);

  const load = useCallback(async () => {
    if (!userId || !notificationId) {
      setLoadState('missing');
      return;
    }
    setLoadState('loading');
    try {
      if (isPush) {
        const row = (await getPushInbox(userId)).find((n) => n.id === notificationId);
        if (!row) {
          setLoadState('missing');
          return;
        }
        // 진입 = 확인. 처음 읽은 시각을 지킨다. 실패해도 본문은 보여준다.
        const readAt = row.readAt ?? (await markPushNotificationAsRead(userId, row.id).catch(() => null));
        // 기기 알림도 읽음이 바뀌면 점을 다시 계산한다. (DB 알림과 같은 규칙)
        if (!row.readAt && readAt) notifyNotificationsChanged();
        setItem({
          ...fromPushNotification(row),
          readAt,
          tripLabel: null,
          statusLabel: null,
          cta: null,
        });
        setLoadState('ready');
        return;
      }

      // 미리보기는 실제 세션이 없어 DB 알림을 열 수 없다(RLS). 기기 보관 알림만 연다.
      const row = __DEV__ && isPreview ? null : await getNotification(notificationId, userId);
      if (!row) {
        setLoadState('missing');
        return;
      }
      const readAt = row.read_at ?? (await markNotificationAsRead(row.id, userId).catch(() => null));
      // 읽음이 바뀌었으면 알림 아이콘의 점을 다시 계산한다. (lib/notifications/unreadNotifications)
      if (!row.read_at && readAt) notifyNotificationsChanged();
      const base: NotificationDetailItem = {
        ...fromDbNotification(row),
        readAt,
        tripLabel: null,
        statusLabel: null,
        cta: null,
      };
      setItem(base);
      setLoadState('ready');

      // 관련 여행 한 줄 + 지금 상태. 본문이 뜬 뒤에 붙는다. 실패해도 본문은 남는다.
      setResolving(true);
      const [trip, action] = await Promise.all([
        row.trip_id ? getTripById(row.trip_id).catch(() => null) : Promise.resolve(null),
        resolveNotificationAction(row, userId),
      ]);
      setItem((prev) =>
        prev
          ? {
              ...prev,
              tripLabel: trip ? toTripLine(trip.destination, trip.start_date, trip.end_date) : null,
              statusLabel: action.statusLabel,
              cta: action.cta,
            }
          : prev,
      );
      setResolving(false);
    } catch {
      setResolving(false);
      setLoadState('error');
    }
  }, [userId, notificationId, isPush, isPreview]);

  useEffect(() => {
    void load();
  }, [load]);

  const screen = <Stack.Screen options={{ title: '알림', headerTitleAlign: 'center' }} />;

  if (loadState === 'loading') {
    return (
      <View className="flex-1 bg-white">
        {screen}
        <Loading />
      </View>
    );
  }
  if (loadState === 'error') {
    return (
      <View className="flex-1 bg-white">
        {screen}
        <ErrorState message="알림을 불러오지 못했어요." onRetry={() => void load()} />
      </View>
    );
  }
  if (loadState === 'missing' || !item) {
    return (
      <View className="flex-1 bg-white">
        {screen}
        <EmptyState
          icon="notifications-off-outline"
          title="사라진 알림이에요"
          description="이미 지웠거나 더 이상 볼 수 없는 알림이에요."
          actionLabel="알림 목록으로"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  return (
    <>
      {screen}
      <NotificationDetailView
        notification={item}
        resolving={resolving}
        // href 는 resolver 가 만든 앱 내부 경로다. (/trips/… · /invite/by/…)
        onPressCta={(href) => router.push(href as never)}
      />
    </>
  );
}
