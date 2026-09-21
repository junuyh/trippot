// ============================================================================
// 지출 입력 리마인드 — 여행 중 매일 저녁 로컬 알림
//
// 수기 입력의 최대 적은 "까먹음" 이다. 여행 기간 동안 매일 21:00 에 한 번
// "오늘 쓴 거 적었어요?" 를 띄운다. 서버도 푸시 토큰도 없다. 기기 안에서만 돈다.
//
// ⚠️ 여행마다 알림 id 에 tripId 를 넣어 두고, 다시 잡기 전에 그 여행 것만 지운다.
//    홈을 열 때마다 잡아도 중복되지 않고, 일정을 고치면 새 날짜로 바뀐다.
// ⚠️ 권한은 여행이 임박했거나 진행 중일 때만 묻는다. 만들자마자 물으면
//    맥락이 없어 거절당한다.
// ⚠️ Expo Go: iOS 는 로컬 알림이 된다. Android Expo Go 는 SDK 53 부터
//    알림 모듈이 빠져 dev build 가 필요하다. 실패해도 화면은 멀쩡해야 하므로
//    전부 try/catch 로 감싼다. [검토 필요] app.json 에 expo-notifications
//    플러그인(아이콘·색)은 빌드 때 추가한다.
// ============================================================================
import { addDays, differenceInCalendarDays, format, parseISO, startOfDay } from "date-fns";
import * as Notifications from "expo-notifications";

import { TRIP_STATUS } from "@/lib/constants/status";
import { SPEND_REMINDER_ID_PREFIX } from "@/lib/notifications/spendReminderId";
import { getMyParticipatingTrips } from "@/lib/supabase/queries/trips";

/** 알림 시각. 저녁을 먹고 숙소로 돌아올 즈음 */
const REMIND_HOUR = 21;
/** 여행 시작이 이보다 멀면 권한을 묻지 않는다 */
const ARM_BEFORE_DAYS = 7;
/** 한 여행에 잡는 최대 일수. 그보다 긴 여행은 앞쪽만 */
const MAX_DAYS = 30;

/** 알림 id 접두어. 값은 그대로(`spend-reminder:`) — 보관함·상세가 같은 규칙을 읽도록 spendReminderId 로 옮겼다. (2026-09-21) */
const ID_PREFIX = SPEND_REMINDER_ID_PREFIX;

// 앱이 켜져 있을 때도 배너를 보여준다. 여행 중엔 앱을 켠 채로 두는 일이 많다.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export type SpendReminderTrip = {
  id: string;
  destination: string | null;
  /** 'YYYY-MM-DD' */
  start_date: string | null;
  end_date: string | null;
  /** 있으면 reconcile 이 취소·삭제 여행을 거른다. 여행 홈 호출은 status 를 보고 부르므로 없어도 된다 */
  status?: string | null;
};

/** 이 여행에 잡아 둔 알림을 지운다. 일정을 고치거나 여행이 끝났을 때 */
export async function cancelSpendReminders(tripId: string): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.identifier.startsWith(`${ID_PREFIX}${tripId}:`))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

/**
 * 여행의 "지금 기준" 리마인드 slot — 순수 함수. (2026-09-21 · 예약과 동기화(reconcile)가 같은 계산을 쓴다)
 *   · 일정이 없거나, 끝났거나(untilEnd < 0), 아직 멀면(untilStart > ARM_BEFORE_DAYS) 빈 배열
 *   · 첫날(아직 시작 전이면 start, 진행 중이면 오늘)부터 end 까지 · 최대 MAX_DAYS · 오늘 21시가 지났으면 오늘은 제외
 *   · dayIndex 는 **현재 start_date 기준** D-번호. 일정을 바꾸면 D-번호도 다시 계산된다.
 */
export type SpendReminderSlot = { date: string; at: Date; dayIndex: number };

export function computeSpendReminderSlots(
  trip: SpendReminderTrip,
  today: Date = new Date(),
): SpendReminderSlot[] {
  if (!trip.start_date || !trip.end_date) return [];
  const start = parseISO(trip.start_date);
  const end = parseISO(trip.end_date);
  const untilStart = differenceInCalendarDays(start, today);
  const untilEnd = differenceInCalendarDays(end, today);
  if (untilEnd < 0 || untilStart > ARM_BEFORE_DAYS) return [];

  const firstDay = untilStart > 0 ? start : startOfDay(today);
  const dayCount = Math.min(MAX_DAYS, differenceInCalendarDays(end, firstDay) + 1);
  const slots: SpendReminderSlot[] = [];
  for (let i = 0; i < dayCount; i += 1) {
    const at = addDays(startOfDay(firstDay), i);
    at.setHours(REMIND_HOUR, 0, 0, 0);
    if (at <= today) continue; // 오늘 21시가 이미 지났으면 오늘 것은 건너뛴다
    slots.push({ date: format(at, "yyyy-MM-dd"), at, dayIndex: differenceInCalendarDays(at, start) + 1 });
  }
  return slots;
}

/**
 * 알림 id. `spend-reminder:{tripId}:{YYYY-MM-DD}` (2026-09-21 · 전에는 `:{n}` 순번)
 * ⚠️ 날짜를 id 에 넣는 이유: 일정을 바꾸면 같은 순번이 다른 날을 가리켜 "이미 있다" 로 오판했다.
 *    날짜가 id 라 desired ↔ scheduled 비교가 id 만으로 정확하고, 같은 상태에서 몇 번 돌려도 바뀌는 게 없다(멱등).
 *    옛 순번 id 는 desired 에 없으므로 첫 동기화 때 한 번 정리된다. tripId 파싱(spendReminderId)은 그대로 동작한다.
 */
export function spendReminderIdentifier(tripId: string, date: string): string {
  return `${ID_PREFIX}${tripId}:${date}`;
}

async function scheduleSlot(trip: SpendReminderTrip, slot: SpendReminderSlot): Promise<void> {
  const label = trip.destination ?? "여행";
  await Notifications.scheduleNotificationAsync({
    identifier: spendReminderIdentifier(trip.id, slot.date),
    content: {
      title: `${label} D${slot.dayIndex} · 오늘 쓴 거 적었어요?`,
      body: "지금 적어 두면 내일 쓸 수 있는 돈이 바로 나와요.",
      // tripId: 알림 상세의 [여행 홈으로 가기] 가 어느 여행인지 알기 위한 최소 메타데이터. (2026-09-21)
      //         url 은 그대로 둔다(기존 계약). 상세는 url 이 아니라 tripId 로 여행 홈(/trips/:tripId)을 연다.
      data: { url: `/trips/${trip.id}/funds`, tripId: trip.id },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: slot.at },
  });
}

/**
 * 여행 기간의 남은 날마다 21:00 알림을 잡는다. (여행 홈 진입 시 · 권한이 없으면 여기서 묻는다)
 *
 * @returns 잡은 알림 수. 권한이 없거나 기간 밖이면 0
 */
export async function scheduleSpendReminders(
  trip: SpendReminderTrip,
  today: Date = new Date(),
): Promise<number> {
  const slots = computeSpendReminderSlots(trip, today);
  if (slots.length === 0) return 0;

  const { status } = await Notifications.getPermissionsAsync();
  const granted =
    status === "granted" || (await Notifications.requestPermissionsAsync()).status === "granted";
  if (!granted) return 0;

  await cancelSpendReminders(trip.id);
  for (const slot of slots) await scheduleSlot(trip, slot);
  return slots.length;
}

/** reconcile 결과 — 로그·검증용 */
export type SpendReminderReconcileResult = {
  /** 동기화 전 OS 에 잡혀 있던 지출 리마인드 id */
  before: string[];
  /** 지운 것(stale) — 나간 여행 · 취소된 여행 · 바뀐 일정 · 지난 날짜 · 옛 순번 id */
  cancelled: string[];
  /** 새로 잡은 것 */
  added: string[];
  /** 그대로 둔 것 */
  kept: string[];
  /** 권한이 없어 새로 잡지 못한 수 (지우기는 권한과 무관) */
  skippedForPermission: number;
};

/**
 * 지출 리마인드 동기화 — desired-state reconciliation. (2026-09-21)
 *
 * 정답은 과거에 잡아 둔 예약이 아니라 **지금 DB** 다:
 *   desired = 내가 지금 ACTIVE 멤버인 여행(getMyParticipatingTrips · LEFT/INVITED 제외)
 *             − 취소(CANCELED)·삭제(DELETED)된 여행
 *             → 각 여행의 **현재** start/end 로 computeSpendReminderSlots (미래 21시만 · D-번호 재계산)
 *   scheduled = OS 에 잡힌 `spend-reminder:` id 전부
 *   stale(scheduled − desired) 는 지우고, missing(desired − scheduled) 만 새로 잡는다. 같은 id 는 그대로 둔다.
 * 그래서 나간 여행 · 취소된 여행 · 일정이 바뀐 여행 · 끝난 여행의 남은 예약이 전부 사라진다.
 * ⚠️ 권한을 **묻지 않는다.** 이미 허용된 경우에만 새로 잡는다(앱 시작·복귀에서 갑자기 권한을 묻지 않는다).
 *    묻는 건 여행 홈의 scheduleSpendReminders 가 한다. 지우는 건 권한과 무관하다.
 * ⚠️ 이미 도착해 기기 보관함(pushInbox)에 있는 과거 알림은 건드리지 않는다. 미래 예약만 다룬다.
 * ⚠️ 실패는 전부 삼킨다(호출부에서 catch). 알림 때문에 앱이 죽지 않는다.
 */
export async function reconcileSpendReminders(
  userId: string,
  today: Date = new Date(),
): Promise<SpendReminderReconcileResult> {
  const [scheduledAll, trips, permission] = await Promise.all([
    Notifications.getAllScheduledNotificationsAsync(),
    getMyParticipatingTrips(userId),
    Notifications.getPermissionsAsync(),
  ]);
  const scheduled = scheduledAll
    .map((n) => n.identifier)
    .filter((id) => id.startsWith(ID_PREFIX));

  const desired = new Map<string, { trip: SpendReminderTrip; slot: SpendReminderSlot }>();
  for (const trip of trips) {
    if (trip.status === TRIP_STATUS.CANCELED || trip.status === TRIP_STATUS.DELETED) continue;
    for (const slot of computeSpendReminderSlots(trip, today)) {
      desired.set(spendReminderIdentifier(trip.id, slot.date), { trip, slot });
    }
  }

  const cancelled = scheduled.filter((id) => !desired.has(id));
  const kept = scheduled.filter((id) => desired.has(id));
  const missing = [...desired.keys()].filter((id) => !scheduled.includes(id));

  await Promise.all(cancelled.map((id) => Notifications.cancelScheduledNotificationAsync(id)));

  const added: string[] = [];
  let skippedForPermission = 0;
  if (permission.status === "granted") {
    for (const id of missing) {
      const entry = desired.get(id);
      if (!entry) continue;
      await scheduleSlot(entry.trip, entry.slot);
      added.push(id);
    }
  } else {
    skippedForPermission = missing.length;
  }

  const result = { before: scheduled, cancelled, added, kept, skippedForPermission };
  if (__DEV__) {
    // 검증용 한 줄. 운영 빌드에서는 찍지 않는다.
    console.log("[spendReminder] reconcile", {
      before: scheduled.length,
      cancelled,
      added,
      kept: kept.length,
      skippedForPermission,
    });
  }
  return result;
}
