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
//    Record<NotificationType, …> 이라 하나라도 빠지거나 없는 type 을 적으면
//    tsc 가 막는다. 상수·DB CHECK·문구가 갈라지지 않는다.
//
// ⚠️ 2026-09-10 · 알림이 3종 → 17종으로 늘어 INV 7종 · CXL 7종 문구를 채웠다.
//    (이슈 #73 확정본) 이 Record 가 컴파일로 요구해서 함께 넣은 것이고,
//    **발송하는 코드는 아직 없다.**
//
// ⚠️ 2026-09-16 · docs/14_알림센터_v1.md §4 — 1차 4종(INVITE_RECEIVED · JOIN_*)은
//    DB producer(migration 20260916000001)가 **같은 문자열**로 title/body 를 스냅샷한다.
//    여기 문구를 바꾸면 DB 함수도 같이 바꿔야 한다. 앱은 이 빌더로 새 알림을 만들지 않고,
//    DB 가 준 title/body 를 그대로 보여준다. 이 파일은 문구의 앱 쪽 기준일 뿐이다.
//    - tripLabel  = "{destination} 여행" · 없으면 "이 여행"   (toTripLabel)
//    - personName = users.name · 없으면 "사용자"               (toPersonLabel)
//    나머지 type 은 tripLabel 하나만 받는 이전 문구 그대로다. producer 가 생길 때 맞춘다.
// ============================================================================
import { NOTIFICATION_TYPE, type NotificationType } from '@/lib/constants/status';

/** notifications 의 title · body 한 쌍. */
export type NotificationMessage = {
  title: string;
  body: string;
};

/**
 * "{destination} 여행" · destination 이 없거나 공백이면 "이 여행".
 * DB `notification_trip_label()` 과 같은 규칙. 문구 쪽에서 '여행' 을 다시 붙이지 않는다.
 */
export function toTripLabel(destination: string | null | undefined): string {
  const trimmed = destination?.trim() ?? '';
  return trimmed === '' ? '이 여행' : `${trimmed} 여행`;
}

/** users.name 그대로 · 없거나 공백이면 "사용자". DB `notification_person_label()` 과 같은 규칙. */
export function toPersonLabel(name: string | null | undefined): string {
  const trimmed = name?.trim() ?? '';
  return trimmed === '' ? '사용자' : trimmed;
}

/**
 * 문구 빌더. tripLabel 은 toTripLabel 결과, personName 은 toPersonLabel 결과를 넘긴다.
 * personName 은 "누가" 가 필요한 type 만 쓴다. 안 넘기면 "사용자" 로 읽힌다.
 */
type NotificationMessageBuilder = (tripLabel: string, personName?: string) => NotificationMessage;

/**
 * 알림 18종의 문구.
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

  // ── 초대 · 멤버 (INV/MEM) ─────────────────────────────────────────────
  /** ⚠️ 미사용. 발송 시점에 수신자를 알 수 없다. (docs/14 §3) 값만 지킨다. */
  [NOTIFICATION_TYPE.INVITE_SENT]: (tripLabel) => ({
    title: '여행에 초대받았어요',
    body: `${tripLabel}에 함께 가자는 초대가 왔어요.`,
  }),
  // ── 1차 4종 · docs/14 §4 확정 문구 · DB producer 와 글자까지 같다 ─────────
  [NOTIFICATION_TYPE.INVITE_RECEIVED]: (tripLabel, personName = '사용자') => ({
    title: '여행 초대가 도착했어요',
    body: `${personName}님이 ${tripLabel}에 초대했어요.`,
  }),
  [NOTIFICATION_TYPE.JOIN_REQUESTED]: (tripLabel, personName = '사용자') => ({
    title: '참여 의사가 도착했어요',
    body: `${personName}님이 ${tripLabel} 참여 의사를 보냈어요.`,
  }),
  [NOTIFICATION_TYPE.JOIN_ACCEPTED]: (tripLabel) => ({
    title: '여행 참여가 수락됐어요',
    body: `${tripLabel} 참여가 수락됐어요.`,
  }),
  /** ⚠️ 거절 사유를 묻지도 전달하지도 않는다. (POL-INV-051) */
  [NOTIFICATION_TYPE.JOIN_REJECTED]: (tripLabel) => ({
    title: '여행 참여가 거절됐어요',
    body: `${tripLabel} 참여 의사가 거절됐어요.`,
  }),
  // ── 멤버 합류·이탈 (2026-09-18 확정 문구 · migration 20260918000001 이 같은 문자열로 만든다) ──
  [NOTIFICATION_TYPE.MEMBER_JOINED]: (tripLabel, personName = '사용자') => ({
    title: '새 멤버가 참여했어요',
    body: `${personName}님이 ${tripLabel}에 함께하게 됐어요.`,
  }),
  [NOTIFICATION_TYPE.MEMBER_LEFT]: (tripLabel, personName = '사용자') => ({
    title: '멤버가 여행에서 나갔어요',
    body: `${personName}님이 ${tripLabel}에서 나갔어요.`,
  }),
  // OWNER_DELEGATED 는 받는 사람에 따라 문구가 갈린다.
  // 아래는 **새 여행장용**. 나머지 멤버용은 DB 함수에만 있다:
  //   제목: 여행장이 바뀌었어요
  //   본문: 이제 ○○님이 {여행}의 여행장이에요.
  [NOTIFICATION_TYPE.OWNER_DELEGATED]: (tripName) => ({
    title: '여행장이 되었어요',
    body: `${tripName}의 여행장을 맡게 됐어요.`,
  }),

  // ── 여행 취소 (CXL) ──────────────────────────────────────────────────
  /** ⚠️ 취소 사유를 본문에 넣지 않는다. 앱 안에서만 보여준다. (POL-CXL-029) */
  [NOTIFICATION_TYPE.CANCEL_REQUESTED]: (tripName) => ({
    title: '여행 취소 요청이 왔어요',
    body: `${tripName}을 취소할지 정해 주세요.`,
  }),
  // ⚠️ 실제 본문에는 **숫자가 들어간다.** 빌더는 tripLabel·personName 만 받아서
  //    여기서는 못 만든다. 갈래 인자를 더하지 않기로 했다 (앱은 이 빌더로 알림을
  //    만들지 않는다). DB 함수의 실제 문구:
  //      본문: {여행} 취소에 3명 중 2명이 동의했어요.
  [NOTIFICATION_TYPE.CANCEL_VOTE_AGREED]: (tripName) => ({
    title: '취소에 동의한 사람이 있어요',
    body: `${tripName} 취소 요청에 동의가 하나 늘었어요.`,
  }),
  [NOTIFICATION_TYPE.CANCEL_REJECTED]: (tripName) => ({
    title: '여행 취소가 없던 일이 됐어요',
    body: `${tripName}은 그대로 진행돼요.`,
  }),
  [NOTIFICATION_TYPE.CANCEL_EXPIRED]: (tripName) => ({
    title: '취소 요청 기한이 지났어요',
    body: `${tripName} 취소 요청이 사라졌어요. 여행은 그대로예요.`,
  }),
  // CANCEL_WITHDRAWN 은 철회 사유에 따라 문구가 갈린다.
  // 아래는 **요청자가 직접 거둔 경우**. 요청자가 여행에서 나가 자동 철회된
  // 경우의 문구는 DB 함수에만 있다:
  //   제목: 취소 요청이 사라졌어요
  //   본문: {여행} 취소를 요청한 사람이 나가서 요청이 사라졌어요.
  [NOTIFICATION_TYPE.CANCEL_WITHDRAWN]: (tripName) => ({
    title: '취소 요청이 철회됐어요',
    body: `${tripName} 취소 요청을 요청한 사람이 거뒀어요.`,
  }),
  [NOTIFICATION_TYPE.CANCEL_CONFIRMED]: (tripName) => ({
    title: '여행이 취소됐어요',
    body: `${tripName}이 모두의 동의로 취소됐어요. 72시간 안에는 되돌릴 수 있어요.`,
  }),
  [NOTIFICATION_TYPE.CANCEL_RESTORED]: (tripName) => ({
    title: '여행을 다시 준비해요',
    body: `${tripName} 취소를 되돌렸어요.`,
  }),
};

/**
 * 알림 하나의 문구를 만든다.
 *
 * ```ts
 * const { title, body } = buildNotificationMessage(
 *   NOTIFICATION_TYPE.JOIN_REQUESTED, toTripLabel('오사카'), toPersonLabel('민지'),
 * );
 * ```
 */
export function buildNotificationMessage(
  type: NotificationType,
  tripLabel: string,
  personName?: string,
): NotificationMessage {
  return NOTIFICATION_MESSAGES[type](tripLabel, personName);
}
