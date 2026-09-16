// ============================================================================
// 받은 알림 (MY 알림함)
//
// 지키는 것 (CLAUDE.md 7장)
//   - 모든 DB Query 는 이 폴더 안에만 둔다.
//   - 다른 사용자의 알림에 접근할 수 있는 Query 를 만들지 않는다.
//     → 읽음 처리도 notificationId 만으로 하지 않고 userId 로 함께 좁힌다.
//   - Supabase error 가 있으면 throw 한다. 화면이 Error 상태로 처리한다.
//
// ⚠️ 알림을 **만드는** 코드는 여기 없다. 알림 행은 서버 RPC(SECURITY DEFINER)가
//    domain 전이와 같은 트랜잭션에서 만든다. (docs/14_알림센터_v1.md §2 ·
//    migration 20260916000001) 앱은 읽고 · 읽음 처리하고 · 지우기만 한다.
// ============================================================================
import { supabase } from '@/lib/supabase/client';
import type { NotificationType } from '@/lib/constants/status';
import type { Tables } from '@/types/database';

export type Notification = Tables<'notifications'>;

/** 다음 페이지를 가리키는 값. 마지막 행의 (created_at, id). 없으면 더 없다. */
export type NotificationCursor = { createdAt: string; id: string };

export type GetNotificationsOptions = {
  /** 이 type 들만. 비우면 전부. (lib/notifications/notificationCategory 가 만든다) */
  types?: readonly NotificationType[] | null;
  /** 페이지 크기. 기본 30. (docs/14 §9) */
  limit?: number;
  /** 이전 페이지가 돌려준 nextCursor. 첫 페이지는 없음. */
  cursor?: NotificationCursor | null;
  /** 조회 window. 기본 365일. (docs/14 §9 — UI 는 1년, DB 보관은 730일. 서로 다르다) */
  sinceDays?: number;
};

export type NotificationPage = {
  rows: Notification[];
  /** 다음 페이지가 있으면 그 커서, 없으면 null. */
  nextCursor: NotificationCursor | null;
};

/** 알림센터 한 페이지. (docs/14 §9) */
export const NOTIFICATION_PAGE_SIZE = 30;
/**
 * 알림센터 조회 window — 최근 1년. (docs/14 §9 · 2026-09-16 확정)
 * 해외여행은 수개월~1년 전부터 준비하므로 90일은 짧았다. "진행 중 여행은 기간 무관" 같은
 * 예외 정책은 두지 않고 단순한 window 하나로 간다. DB 보관(730일 · cron)과는 별개다.
 */
export const NOTIFICATION_CENTER_WINDOW_DAYS = 365;

/**
 * 내 알림 한 페이지 — 최근 1년 · 최신순 · 30건 · 커서 기반. (docs/14 §9)
 *
 * 정렬은 `created_at desc, id desc` 두 키다. 같은 시각의 알림이 있어도 페이지 경계에서
 * 빠지거나 두 번 나오지 않는다. 커서 조건은 `(created_at, id) < (cursor)` 를
 * PostgREST 로 푼 것: `created_at < c` or (`created_at = c` and `id < cid`).
 * `idx_notifications_user_created (user_id, created_at desc)` 가 그대로 쓰인다.
 *
 * limit+1 로 받아 하나 더 있으면 다음 페이지가 있다고 본다. offset 은 쓰지 않는다 —
 * 그 사이 새 알림이 오면 offset 은 같은 행을 두 번 보여준다.
 *
 * ⚠️ 이전 "전체 select → 화면에서 30개" 방식은 폐기했다. (2026-09-16)
 */
export async function getNotifications(
  userId: string,
  options: GetNotificationsOptions = {},
): Promise<NotificationPage> {
  const limit = options.limit ?? NOTIFICATION_PAGE_SIZE;
  const sinceDays = options.sinceDays ?? NOTIFICATION_CENTER_WINDOW_DAYS;
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();

  let query = supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', since);

  if (options.types && options.types.length > 0) {
    query = query.in('type', [...options.types]);
  }
  if (options.cursor) {
    const { createdAt, id } = options.cursor;
    query = query.or(`created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.lt.${id})`);
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1);
  if (error) throw error;

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];
  return {
    rows: page,
    nextCursor: hasMore && last ? { createdAt: last.created_at, id: last.id } : null,
  };
}

/**
 * 알림 하나. 상세 화면용. 없거나 남의 것이면 null.
 * ⚠️ id 만으로 찾지 않는다. userId 로 함께 좁혀 남의 알림을 열 수 없게 한다. (CLAUDE.md 7장)
 */
export async function getNotification(
  notificationId: string,
  userId: string,
): Promise<Notification | null> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('id', notificationId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * 안 읽은 알림 몇 건, 최신순. In-app Banner 의 보완 경로용 (docs/14 §8) —
 * 앱을 켰을 때 · 포그라운드로 돌아왔을 때 Realtime 이 놓친 것을 다시 본다.
 * 목록 화면이 쓰는 함수가 아니다. limit 은 작게.
 */
export async function getUnreadNotifications(userId: string, limit = 5): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .is('read_at', null)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

/**
 * 알림 하나를 읽음으로 표시하고, 저장된 읽은 시각을 돌려준다.
 *
 * ⚠️ `read_at` 을 클라이언트 시각으로 정하지 않고 DB 가 돌려준 값을 쓴다.
 *    기기 시계가 틀어져 있어도 목록 정렬·표시가 어긋나지 않는다.
 *
 * ⚠️ 이미 읽은 알림에는 부르지 않는다. 호출부에서 걸러 첫 읽은 시각을 지킨다.
 */
export async function markNotificationAsRead(
  notificationId: string,
  userId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    // ⚠️ 남의 알림을 읽음 처리할 수 없도록 사용자까지 좁힌다. (CLAUDE.md 7장)
    .eq('user_id', userId)
    .select('read_at')
    .single();

  if (error) throw error;
  return data.read_at ?? new Date().toISOString();
}

/**
 * 알림 하나를 지운다.
 *
 * ⚠️ 되돌릴 수 없다. 행을 실제로 지운다. notifications 에는 deleted_at 이 없다.
 *    (docs/05_ERD_v5.md §3 — 쌓기만 하는 테이블이라 soft delete 를 두지 않았다)
 *
 * ⚠️ 남의 알림을 지울 수 없도록 사용자까지 좁힌다. (CLAUDE.md 7장)
 *    id 만으로 지우면 uuid 를 아는 누구나 남의 알림을 지울 수 있다.
 */
/**
 * 초대 내용을 실제로 본 순간 INVITE_RECEIVED 를 읽음으로 맞춘다. (2026-09-17 · 읽음 정책)
 *
 * 기준은 "어디서 들어왔는가" 가 아니라 "그 초대 내용을 확인했는가" 다. 홈 배너 · 홈 모달 · 알림 CTA ·
 * 외부 링크가 전부 초대 화면(InviteFlowScreen)으로 모이므로, 그 화면의 resolve 성공 한 곳에서만 부른다.
 * 배너가 떠 있기만 한 것 · 홈이 초대를 미리 확인하는 것(loadInvites)은 읽음이 아니다.
 *
 * 매핑: inviteId 판(/invite/by/:inviteId)은 data->>'inviteId' 로 정확히 한 행. token 판(/invite/:token)은
 *   resolve 결과에 invite id 가 없어(token 은 앱이 서버에 되묻지 않는다) 같은 여행의 INVITE_RECEIVED 로 좁힌다.
 *   ⚠️ raw token 으로 알림을 찾지 않는다.
 * 멱등: read_at is null 인 행만 바꾼다. 맞는 행이 없어도 오류가 아니다(0행). 호출부는 결과를 화면 흐름에
 *   섞지 않는다 — 읽음 처리가 실패해도 초대 화면은 그대로 보여야 한다.
 */
export async function markInviteNotificationsAsRead(
  userId: string,
  target: { inviteId?: string | null; tripId?: string | null },
): Promise<void> {
  if (!target.inviteId && !target.tripId) return;

  let query = supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('type', 'INVITE_RECEIVED')
    .is('read_at', null);
  query = target.inviteId
    ? query.eq('data->>inviteId', target.inviteId)
    : query.eq('trip_id', target.tripId as string);

  const { error } = await query;
  if (error) throw error;
}

export async function deleteNotification(
  notificationId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId)
    .eq('user_id', userId);

  if (error) throw error;
}
