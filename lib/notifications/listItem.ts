// 알림센터 목록 줄 매핑 — DB 행 · 기기 보관 알림 → NotificationListItem. (목록 · 상세 · Banner 공용)
import { format, isValid, parseISO } from 'date-fns';

import type { NotificationListItem } from '@/components/mypage/types';
import { TRIP_OWNER_TYPE } from '@/lib/constants/status';
import type { StoredPushNotification } from '@/lib/notifications/pushInbox';
import type { Notification } from '@/lib/supabase/queries/notifications';

/** '9.15–9.16'. 일정이 없거나 깨졌으면 null. */
export function toTripPeriodLabel(start: string | null, end: string | null): string | null {
  if (!start || !end) return null;
  const s = parseISO(start);
  const e = parseISO(end);
  if (!isValid(s) || !isValid(e)) return null;
  return `${format(s, 'M.d')}–${format(e, 'M.d')}`;
}

/**
 * 모임 문맥 한 줄 — 모임명, 개인 여행이면 '개인 여행'(홈 카드와 같은 표현). 둘 다 없으면 null.
 * ⚠️ 제목(여행지)에서 파싱하지 않는다. tripId 로 읽은 여행·모임 행에서만 만든다. (2026-09-21)
 */
export function toTripGroupLabel(trip: { owner_type: string; groupName: string | null }): string | null {
  if (trip.groupName && trip.groupName.trim() !== '') return trip.groupName.trim();
  if (trip.owner_type === TRIP_OWNER_TYPE.PERSONAL) return '개인 여행';
  return null;
}

/**
 * 지출 리마인드 목록 줄의 보조 문맥: `918 테스트 · 9.15–9.16`. 같은 여행지(홍콩) 여행이 여럿일 때 어느 여행인지 가른다.
 * 모임명이 없으면 기간만, 기간도 없으면 null(줄을 그리지 않는다).
 */
export function toSpendReminderContext(trip: {
  owner_type: string;
  groupName: string | null;
  start_date: string | null;
  end_date: string | null;
}): string | null {
  const parts = [toTripGroupLabel(trip), toTripPeriodLabel(trip.start_date, trip.end_date)].filter(
    (v): v is string => v !== null,
  );
  return parts.length > 0 ? parts.join(' · ') : null;
}

/** DB 행 → 목록 줄. */
export function fromDbNotification(row: Notification): NotificationListItem {
  return {
    source: 'db',
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    createdAt: row.created_at,
    readAt: row.read_at,
  };
}

/** 기기 보관 알림 → 목록 줄. type 은 없다. */
export function fromPushNotification(row: StoredPushNotification): NotificationListItem {
  return {
    source: 'push',
    id: row.id,
    type: null,
    title: row.title,
    body: row.body,
    createdAt: row.receivedAt,
    readAt: row.readAt,
  };
}
