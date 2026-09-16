// 알림센터 목록 줄 매핑 — DB 행 · 기기 보관 알림 → NotificationListItem. (목록 · 상세 · Banner 공용)
import type { NotificationListItem } from '@/components/mypage/types';
import type { StoredPushNotification } from '@/lib/notifications/pushInbox';
import type { Notification } from '@/lib/supabase/queries/notifications';

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
