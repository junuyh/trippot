// ============================================================================
// 받은 알림 (MY 알림함)
//
// 지키는 것 (CLAUDE.md 7장)
//   - 모든 DB Query 는 이 폴더 안에만 둔다.
//   - 다른 사용자의 알림에 접근할 수 있는 Query 를 만들지 않는다.
//     → 읽음 처리도 notificationId 만으로 하지 않고 userId 로 함께 좁힌다.
//   - Supabase error 가 있으면 throw 한다. 화면이 Error 상태로 처리한다.
//
// ⚠️ 알림을 **만드는** 코드는 여기 없다. 생성 시점(D-7 스케줄러 등)은
//    이번 범위가 아니다. 이미 쌓인 알림을 읽고 읽음 처리만 한다.
// ============================================================================
import { supabase } from '@/lib/supabase/client';
import type { Tables } from '@/types/database';

export type Notification = Tables<'notifications'>;

/**
 * 내 알림 전체를 최신순으로.
 *
 * `idx_notifications_user_created (user_id, created_at desc)` 가 그대로 쓰인다.
 *
 * ⚠️ 페이지네이션을 두지 않았다. MVP 알림은 3종뿐이라 한 사람에게 쌓이는 양이
 *    적다. 늘어나면 range() 를 붙인다.
 */
export async function getNotifications(userId: string): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

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
