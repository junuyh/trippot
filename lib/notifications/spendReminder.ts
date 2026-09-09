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
import { addDays, differenceInCalendarDays, parseISO, startOfDay } from "date-fns";
import * as Notifications from "expo-notifications";

/** 알림 시각. 저녁을 먹고 숙소로 돌아올 즈음 */
const REMIND_HOUR = 21;
/** 여행 시작이 이보다 멀면 권한을 묻지 않는다 */
const ARM_BEFORE_DAYS = 7;
/** 한 여행에 잡는 최대 일수. 그보다 긴 여행은 앞쪽만 */
const MAX_DAYS = 30;

const ID_PREFIX = "spend-reminder:";

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
 * 여행 기간의 남은 날마다 21:00 알림을 잡는다.
 *
 * @returns 잡은 알림 수. 권한이 없거나 기간 밖이면 0
 */
export async function scheduleSpendReminders(
  trip: SpendReminderTrip,
  today: Date = new Date(),
): Promise<number> {
  if (!trip.start_date || !trip.end_date) return 0;
  const start = parseISO(trip.start_date);
  const end = parseISO(trip.end_date);
  const untilStart = differenceInCalendarDays(start, today);
  const untilEnd = differenceInCalendarDays(end, today);
  // 끝난 여행이거나 아직 먼 여행이면 아무것도 안 한다
  if (untilEnd < 0 || untilStart > ARM_BEFORE_DAYS) return 0;

  const { status } = await Notifications.getPermissionsAsync();
  const granted =
    status === "granted" || (await Notifications.requestPermissionsAsync()).status === "granted";
  if (!granted) return 0;

  await cancelSpendReminders(trip.id);

  const firstDay = untilStart > 0 ? start : startOfDay(today);
  const dayCount = Math.min(MAX_DAYS, differenceInCalendarDays(end, firstDay) + 1);
  const label = trip.destination ?? "여행";
  let count = 0;
  for (let i = 0; i < dayCount; i += 1) {
    const at = addDays(startOfDay(firstDay), i);
    at.setHours(REMIND_HOUR, 0, 0, 0);
    if (at <= today) continue; // 오늘 21시가 이미 지났으면 오늘 것은 건너뛴다
    const dayIndex = differenceInCalendarDays(at, start) + 1;
    await Notifications.scheduleNotificationAsync({
      identifier: `${ID_PREFIX}${trip.id}:${i}`,
      content: {
        title: `${label} D${dayIndex} · 오늘 쓴 거 적었어요?`,
        body: "지금 적어 두면 내일 쓸 수 있는 돈이 바로 나와요.",
        data: { url: `/trips/${trip.id}/funds` },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
    });
    count += 1;
  }
  return count;
}
