// ============================================================================
// 안 읽은 알림 존재 여부 — 알림 아이콘의 점 (2026-09-18)
//
//   기준(통합 · unreadPolicy.computeHasUnread): 알림센터 [전체] 에 안 읽은 줄이 하나라도 있으면 점.
//     DB   notifications where user_id = 나 and read_at is null        (getUnreadNotifications limit 1)
//     push 기기 보관함(pushInbox) readAt === null — D1 지출 리마인드 같은 로컬 알림
//   새 count 컬럼 · 별도 표를 만들지 않는다.
//
// 갱신 시점
//   · 앱 시작(로그인 확정) · background → foreground 복귀           (여기 · AppState)
//   · 새 DB 알림 INSERT                                               (NotificationBannerObserver 의 Realtime 채널 → notifyNotificationsChanged)
//   · 기기 알림 도착 · OS 알림 탭 · 알림 센터 sync                    (PushInboxObserver → notifyNotificationsChanged)
//   · 읽음 처리 · 삭제 · 초대 화면의 INVITE_RECEIVED 읽음 동기화      (그 화면이 notifyNotificationsChanged 를 부른다)
//
// ⚠️ Realtime UPDATE/DELETE 는 구독하지 않는다. user_id 필터가 DELETE 의 old row 에는 없어
//    믿을 수 없고, 읽음·삭제는 어차피 이 앱이 스스로 하므로 그 자리에서 알린다.
// ⚠️ 개발용 미리보기(isPreview)는 세션이 없다. 조회하지 않고 점도 없다.
// ⚠️ 실패는 전부 삼킨다. 점은 보너스다.
// ============================================================================
import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { useAuth, useCurrentUserId } from '@/lib/auth/AuthProvider';
import { getPushInbox } from '@/lib/notifications/pushInbox';
import { computeHasUnread } from '@/lib/notifications/unreadPolicy';
import { getUnreadNotifications } from '@/lib/supabase/queries/notifications';

type Listener = () => void;
const listeners = new Set<Listener>();

/** 알림 행이 바뀌었다(생성 · 읽음 · 삭제). 점을 다시 계산하라고 알린다. */
export function notifyNotificationsChanged(): void {
  listeners.forEach((listener) => listener());
}

/** 안 읽은 알림이 하나라도 있는가. 알림 아이콘이 점을 그릴 때 쓴다. */
export function useHasUnreadNotifications(): boolean {
  const currentUserId = useCurrentUserId();
  const { isPreview } = useAuth();
  const userId = __DEV__ && isPreview ? null : currentUserId;
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    if (!userId) {
      setHasUnread(false);
      return;
    }
    let alive = true;
    const refresh = () => {
      // DB 와 기기 보관함을 같이 본다. 한쪽이 실패해도 다른 쪽으로 판정한다(점은 보너스).
      Promise.all([
        getUnreadNotifications(userId, 1).catch(() => []),
        getPushInbox(userId).catch(() => []),
      ])
        .then(([dbRows, pushRows]) => {
          if (alive) setHasUnread(computeHasUnread(dbRows.length, pushRows));
        })
        .catch(() => undefined);
    };

    refresh();
    listeners.add(refresh);

    let previous: AppStateStatus = AppState.currentState;
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active' && previous !== 'active') refresh();
      previous = next;
    });

    return () => {
      alive = false;
      listeners.delete(refresh);
      sub.remove();
    };
  }, [userId]);

  return hasUnread;
}
