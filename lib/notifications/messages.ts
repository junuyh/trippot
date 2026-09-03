// ============================================================================
// 알림 문구 — notifications.title / body 의 단일 기준
//
// 알림을 만드는 곳이 여러 군데로 늘어나도 문구는 여기 하나만 고친다.
// (자금 목표 달성은 자금 화면에서, D-7 은 스케줄러에서 만들게 된다)
//
// ⚠️ 이 파일은 **문구만** 만든다. notifications 에 INSERT 하지 않는다.
//    생성 시점(스케줄러·트리거·Edge Function)은 이 브랜치 범위가 아니다.
//
// ⚠️ type 문자열을 여기서 다시 적지 않는다. NOTIFICATION_TYPE 을 그대로 쓴다.
//    Record<NotificationType, …> 이라 3종에서 하나라도 빠지거나 없는 type 을
//    적으면 tsc 가 막는다. 상수·DB CHECK·문구가 갈라지지 않는다.
// ============================================================================
import { NOTIFICATION_TYPE, type NotificationType } from '@/lib/constants/status';

/** notifications 의 title · body 한 쌍. */
export type NotificationMessage = {
  title: string;
  body: string;
};

/** 여행명을 받아 문구를 만든다. */
type NotificationMessageBuilder = (tripName: string) => NotificationMessage;

/**
 * 알림 3종의 문구.
 *
 * ⚠️ title 은 여행명 없이 그 자체로 읽힌다. 목록에서 굵게 보이는 한 줄이라
 *    여행명은 body 에 둔다. (docs/05_ERD_v5.md §3 notifications)
 */
export const NOTIFICATION_MESSAGES: Record<NotificationType, NotificationMessageBuilder> = {
  [NOTIFICATION_TYPE.FUND_GOAL_REACHED]: (tripName) => ({
    title: '여행 준비금 목표를 달성했어요',
    body: `${tripName}의 목표 여행비를 모두 모았어요.`,
  }),
  [NOTIFICATION_TYPE.TRIP_D7]: (tripName) => ({
    title: '여행이 일주일 남았어요',
    body: `${tripName}이 7일 뒤 시작돼요.`,
  }),
  [NOTIFICATION_TYPE.SETTLEMENT_READY]: (tripName) => ({
    title: '여행 정산을 확인해 보세요',
    body: `${tripName}이 끝났어요. 실제 지출을 확인해 보세요.`,
  }),
};

/**
 * 알림 하나의 문구를 만든다.
 *
 * ```ts
 * const { title, body } = buildNotificationMessage(NOTIFICATION_TYPE.TRIP_D7, '오사카');
 * ```
 */
export function buildNotificationMessage(
  type: NotificationType,
  tripName: string,
): NotificationMessage {
  return NOTIFICATION_MESSAGES[type](tripName);
}
