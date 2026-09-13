// ============================================================================
// 수신 알림 관찰자 — 앱 전역에서 **한 번만** 붙는다 (2026-09-14)
//
// 기기에 알림이 오는 네 경로를 전부 lib/notifications/pushInbox 로 모은다.
//   1. 포그라운드 수신      addNotificationReceivedListener
//   2. 백그라운드에서 탭     addNotificationResponseReceivedListener   (읽음으로)
//   3. 꺼진 앱을 탭으로 실행  getLastNotificationResponseAsync           (읽음으로)
//   4. 알림 센터에 남은 것    getPresentedNotificationsAsync (앱 시작 · 사용자 바뀔 때)
//
// ⚠️ 알림의 내용을 해석하지 않는다. type · trip · 이동 경로를 여기서 정하지 않는다.
//    data payload 구조가 확정되지 않았다. 제목·본문을 보관하는 것까지다.
// ⚠️ AuthProvider 안쪽에 있어야 한다. userId 가 없으면(미로그인) 아무것도 저장하지 않는다.
// ⚠️ 화면을 그리지 않는다. app/_layout.tsx 에 한 줄로 붙인다. 그 파일의 auth · invite
//    가드 로직은 건드리지 않는다.
// ⚠️ 실패는 전부 삼킨다. 알림 모듈이 없는 환경(Android Expo Go 등)에서도 앱은 떠야 한다.
// ============================================================================
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';

import { useCurrentUserId } from '@/lib/auth/AuthProvider';
import {
  savePushNotification,
  syncPresentedNotifications,
  toStoredPushNotification,
} from '@/lib/notifications/pushInbox';

export function PushInboxObserver() {
  const userId = useCurrentUserId();

  useEffect(() => {
    if (!userId) return;
    let alive = true;

    // 1. 앱이 켜져 있을 때 도착한 알림.
    const received = Notifications.addNotificationReceivedListener((notification) => {
      if (!alive) return;
      savePushNotification(userId, toStoredPushNotification(notification)).catch(() => undefined);
    });

    // 2. 백그라운드에서 OS 알림을 눌러 들어온 경우. 사용자가 직접 봤으니 읽음이다.
    const responded = Notifications.addNotificationResponseReceivedListener((response) => {
      if (!alive) return;
      savePushNotification(
        userId,
        toStoredPushNotification(response.notification, { readAt: new Date().toISOString() }),
      ).catch(() => undefined);
    });

    // 3 · 4. 시작 시점에 한 번 — 꺼진 앱을 알림 탭으로 열었을 때의 마지막 응답, 그리고
    //        알림 센터에 아직 남아 있는 것들.
    (async () => {
      try {
        const last = await Notifications.getLastNotificationResponseAsync();
        if (alive && last) {
          await savePushNotification(
            userId,
            toStoredPushNotification(last.notification, { readAt: new Date().toISOString() }),
          );
        }
      } catch {
        // 지원하지 않거나 아직 없는 환경. 무시한다.
      }
      try {
        const presented = await Notifications.getPresentedNotificationsAsync();
        if (alive && presented.length > 0) await syncPresentedNotifications(userId, presented);
      } catch {
        // 위와 같다.
      }
    })();

    return () => {
      alive = false;
      received.remove();
      responded.remove();
    };
  }, [userId]);

  return null;
}
