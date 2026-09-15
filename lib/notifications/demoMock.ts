// ============================================================================
// [중간점검 발표용] 알림함 목업
//
// ⚠️ **DB 에 넣지 않는다.** 화면에서만 쓰고 사라지는 값이다.
//    알림 자동 생성(스케줄러·트리거)이 아직 없어서, 발표에서 목록 UI 와
//    읽음/미읽음 동작을 보여주려고 둔다.
//
// ⚠️ 발표가 끝나면 이 파일과 app/me/notifications.tsx 의 호출부를 지운다.
//    실제 알림 생성이 붙으면 필요 없다.
//
// ⚠️ 문구를 여기서 새로 쓰지 않는다. buildNotificationMessage 를 그대로 쓴다.
//    목업이 진짜 알림과 다른 말을 하면 발표에서 보여준 것이 거짓이 된다.
//
// ⚠️ 여행명은 '예시 여행' 이다. 실제 여행지·금액·날짜를 지어내지 않는다.
//    진짜 알림으로 오해될 수 있다.
// ============================================================================
import { NOTIFICATION_TYPE } from '@/lib/constants/status';
import { buildNotificationMessage } from '@/lib/notifications/messages';
import type { Notification } from '@/lib/supabase/queries/notifications';

/** 목업임을 한눈에 알 수 있는 id 접두사. 실제 행은 uuid 라 절대 겹치지 않는다. */
export const DEMO_NOTIFICATION_ID_PREFIX = 'demo-';

/** 문구에 들어갈 이름. 실제 여행지를 쓰지 않는다. */
const DEMO_TRIP_NAME = '예시 여행';

/** 이 id 로 시작하면 DB 에 없는 목업이다. 읽음 처리를 DB 로 보내면 안 된다. */
export function isDemoNotification(id: string): boolean {
  return id.startsWith(DEMO_NOTIFICATION_ID_PREFIX);
}

/**
 * 확정된 알림 3종을 최신순으로. 하나는 읽은 상태로 둬서 두 표현을 함께 보여준다.
 *
 * created_at 은 화면을 열 때 기준으로 만든다. 날짜를 고정으로 박으면
 * 발표 당일에 '3개월 전' 같은 문구가 나온다.
 */
export function buildDemoNotifications(): Notification[] {
  const now = Date.now();
  const daysAgo = (days: number) => new Date(now - days * 24 * 60 * 60 * 1000).toISOString();

  const rows: { type: keyof typeof NOTIFICATION_TYPE; days: number; read: boolean }[] = [
    { type: 'FUND_GOAL_REACHED', days: 0, read: false },
    { type: 'TRIP_D7', days: 1, read: false },
    { type: 'SETTLEMENT_READY', days: 3, read: true },
  ];

  return rows.map((row, index) => {
    const type = NOTIFICATION_TYPE[row.type];
    const { title, body } = buildNotificationMessage(type, DEMO_TRIP_NAME);

    return {
      id: `${DEMO_NOTIFICATION_ID_PREFIX}${index}`,
      user_id: '',
      type,
      title,
      body,
      trip_id: null,
      // notifications.data (jsonb · 2026-09-16). 목업은 이동 문맥이 없다.
      data: null,
      read_at: row.read ? daysAgo(row.days) : null,
      created_at: daysAgo(row.days),
    };
  });
}
