// ============================================================================
// 알림 상세  ·  /me/notifications/:notificationId?source=db|push   (docs/14 §6 · §7)
//
// 목록에서 누르면 바로 domain 화면으로 가지 않고 여기를 먼저 거친다.
//   title · body(스냅샷) · 발생 시각 · 관련 여행 · **지금 상태** · CTA
//
// source=db   public.notifications 한 행. 진입하면 읽음(read_at) — 사용자의 실제 확인 행동이다.
//             상태·CTA 는 lib/notifications/resolveNotificationAction 이 현재 domain 을 다시 물어 정한다.
// source=push 기기 보관 알림(generic Push fallback). 진입하면 읽음.
//             지출 리마인드(id `spend-reminder:{tripId}:{n}` · data.tripId)만 [여행 홈으로 가기] CTA 를 붙인다. (2026-09-21)
//             tripId 는 payload/id 규칙에서만 읽고(제목 파싱 없음), 아래 조건을 **모두** 만족할 때만 보여준다:
//               · getTripById 성공  · 현재 사용자가 그 여행의 ACTIVE 멤버(getMyParticipatingTripIds — 모임 멤버·리더라서
//                 여행이 읽히는 경우(RLS can_access_trip)는 제외)  · 여행이 CANCELED/DELETED 아님
//             LEFT · 멤버 아님 · 취소된 여행은 본문만. ENDED/SETTLED 는 여행 홈이 정산 등을 보여주므로 그대로 연다.
//             관련 여행 카드에는 모임명(개인 여행은 '개인 여행')을 한 줄 더 붙인다 — 같은 여행지 여행이 여럿일 때 가른다.
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
import { TRIP_STATUS } from '@/lib/constants/status';
import { fromDbNotification, fromPushNotification } from '@/lib/notifications/listItem';
import { toTripLabel } from '@/lib/notifications/messages';
import { getPushInbox, markPushNotificationAsRead } from '@/lib/notifications/pushInbox';
import { parseSpendReminderTripId } from '@/lib/notifications/spendReminderId';
import { notifyNotificationsChanged } from '@/lib/notifications/unreadNotifications';
import { resolveNotificationAction } from '@/lib/notifications/resolveNotificationAction';
import { getNotification, markNotificationAsRead } from '@/lib/supabase/queries/notifications';
import { toTripGroupLabel } from '@/lib/notifications/listItem';
import { getGroupById } from '@/lib/supabase/queries/groups';
import { getMyParticipatingTripIds, getTripById } from '@/lib/supabase/queries/trips';

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

        // 지출 리마인드 → 관련 여행 홈. tripId 는 저장된 메타데이터 또는 id 규칙에서만. 여행을 지금 읽을 수 있을 때만 CTA.
        const reminderTripId = row.tripId ?? parseSpendReminderTripId(row.id);
        if (reminderTripId) {
          setResolving(true);
          const [trip, participating] = await Promise.all([
            getTripById(reminderTripId).catch(() => null),
            getMyParticipatingTripIds(userId).catch(() => new Set<string>()),
          ]);
          const group = trip?.group_id ? await getGroupById(trip.group_id).catch(() => null) : null;
          const isActiveMember = participating.has(reminderTripId);
          const isOpen = trip !== null && trip.status !== TRIP_STATUS.CANCELED && trip.status !== TRIP_STATUS.DELETED;
          setItem((prev) =>
            prev && trip
              ? {
                  ...prev,
                  tripLabel: toTripLine(trip.destination, trip.start_date, trip.end_date),
                  tripGroupLabel: toTripGroupLabel({ owner_type: trip.owner_type, groupName: group?.name ?? null }),
                  cta: isActiveMember && isOpen ? { label: '여행 홈으로 가기', href: `/trips/${trip.id}` } : null,
                }
              : prev,
          );
          setResolving(false);
        }
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
