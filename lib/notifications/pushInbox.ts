// ============================================================================
// 수신 알림함 — 기기에 도착한 알림을 그대로 보관한다 (2026-09-14)
//
//   알림 도착  →  title/body 그대로 저장(AsyncStorage)  →  /me/notifications
//
// 무엇을 하는가
//   OS 가 이 기기에 띄운 알림(포그라운드 수신 · 탭해서 진입 · 알림 센터에 남은 것)의
//   **실제 제목과 본문**을 사용자별로 보관해, 마이페이지 알림 목록에서 다시 볼 수 있게 한다.
//
// 무엇을 하지 않는가
//   - 어떤 알림을 언제 보낼지 정하지 않는다. (알림 종류·문구는 팀에서 다시 정한다)
//   - public.notifications 에 넣지 않는다. 그 테이블은 type CHECK 가 있고 체계가 바뀔
//     예정이라, 도착한 알림에 기존 type 을 억지로 붙이지 않는다.
//   - 푸시 토큰 · 발송 서버 · 스케줄러가 없다. 받는 쪽만이다.
//   - buildNotificationMessage 를 쓰지 않는다. 문구를 다시 만들지 않는다.
//
// ⚠️ 한계 — 기기 안에만 남는 이력이다.
//    앱이 완전히 꺼진 채 알림이 왔고, 사용자가 탭하지 않았고, 알림 센터에서도
//    지워진 뒤 앱을 열면 그 알림은 여기 남지 않는다. 그걸 보장하려면
//    서버 이벤트 → 서버 보관 → 푸시 순서의 구조가 필요한데, 알림 종류가 확정된
//    뒤에 만든다. 지금은 MVP 수신 이력이다.
//
// ⚠️ 사용자별로 key 를 나눈다. 로그아웃 뒤 다른 계정으로 들어와도 남의 알림이 안 보인다.
//    userId 가 없으면(미로그인) 저장하지 않는다. 익명 함에 쌓아 다음 사람에게 보여주지 않는다.
// ============================================================================
import AsyncStorage from '@react-native-async-storage/async-storage';
import type * as Notifications from 'expo-notifications';

/** 도착한 알림 한 건. DB notifications 와 무관한 기기 보관용 모양이다. */
export type StoredPushNotification = {
  /** expo-notifications 의 request.identifier. 같은 알림이 여러 경로로 들어와도 하나다. */
  id: string;
  title: string;
  body: string | null;
  /** ISO. OS 가 알림을 띄운 시각(notification.date). 없으면 저장 시각. */
  receivedAt: string;
  /** ISO. 목록에서 눌러 읽었거나 OS 알림을 직접 탭한 시각. */
  readAt: string | null;
};

const STORAGE_KEY_PREFIX = 'trippot:push-inbox:';

/**
 * 보관 상한 — "최근 알림 최대 30개". (MVP 정책 · 2026-09-14)
 *
 * 저장할 때마다  id 중복 제거 → receivedAt DESC → 30개 자르기 → 저장  순서라
 * 31번째부터는 가장 오래된 것이 AsyncStorage 에서 **실제로 지워진다.**
 * 읽음 여부는 보지 않는다. 시간으로만 자른다. 화면(/me/notifications)도 같은 수만 보여준다.
 * ⚠️ 이 상한은 기기 보관함에만 적용한다. public.notifications 의 오래된 행은 지우지 않는다.
 */
export const PUSH_INBOX_MAX_ITEMS = 30;

/** 제목이 비어 있는 알림. 그대로 두면 목록에 빈 줄이 생긴다. */
const UNTITLED = '알림';

function storageKey(userId: string): string {
  return `${STORAGE_KEY_PREFIX}${userId}`;
}

function isStoredPushNotification(value: unknown): value is StoredPushNotification {
  if (value === null || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === 'string' &&
    typeof row.title === 'string' &&
    (row.body === null || typeof row.body === 'string') &&
    typeof row.receivedAt === 'string' &&
    (row.readAt === null || typeof row.readAt === 'string')
  );
}

/** 최신순. 같은 시각이면 id 로 갈라 순서가 흔들리지 않게 한다. */
function byReceivedAtDesc(a: StoredPushNotification, b: StoredPushNotification): number {
  return b.receivedAt.localeCompare(a.receivedAt) || a.id.localeCompare(b.id);
}

async function readAll(userId: string): Promise<StoredPushNotification[]> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isStoredPushNotification).sort(byReceivedAtDesc);
  } catch {
    // 깨진 값이 있어도 화면은 떠야 한다. 빈 함으로 본다.
    return [];
  }
}

async function writeAll(userId: string, rows: StoredPushNotification[]): Promise<void> {
  const trimmed = [...rows].sort(byReceivedAtDesc).slice(0, PUSH_INBOX_MAX_ITEMS);
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(trimmed));
}

/** 이 사용자의 수신 알림 전체, 최신순. */
export async function getPushInbox(userId: string): Promise<StoredPushNotification[]> {
  return readAll(userId);
}

/**
 * notification.date → ISO.
 *
 * ⚠️ iOS 는 **초** 단위, Android 는 **밀리초** 단위로 온다. (expo-notifications 0.32 실측 —
 *    iOS 에서 ms 로 읽으면 1970년이 된다) 1e12 보다 작으면 초로 본다. 못 읽으면 지금.
 */
function toIsoFromNotificationDate(date: unknown): string {
  if (typeof date !== 'number' || !Number.isFinite(date) || date <= 0) {
    return new Date().toISOString();
  }
  const ms = date < 1e12 ? date * 1000 : date;
  return new Date(ms).toISOString();
}

/**
 * expo-notifications 의 Notification → 보관 모양.
 * 제목·본문은 **받은 그대로**다. 해석하지 않는다.
 */
export function toStoredPushNotification(
  notification: Notifications.Notification,
  options?: { readAt?: string | null },
): StoredPushNotification {
  const { request, date } = notification;
  const receivedAt = toIsoFromNotificationDate(date);

  return {
    id: request.identifier,
    title: request.content.title?.trim() || UNTITLED,
    body: request.content.body?.trim() || null,
    receivedAt,
    readAt: options?.readAt ?? null,
  };
}

/**
 * 한 건을 넣거나(없으면) 갱신한다(있으면). 같은 id 는 한 번만 남는다.
 *
 * ⚠️ 이미 readAt 이 찍힌 알림은 나중에 다시 들어와도 **안 읽음으로 돌아가지 않는다.**
 *    (포그라운드 수신 → 탭 → 알림 센터 sync 순으로 같은 알림이 세 번 올 수 있다)
 *    반대로 새로 들어온 쪽에 readAt 이 있으면(OS 알림을 탭한 경우) 그걸 채운다.
 */
export async function savePushNotification(
  userId: string,
  incoming: StoredPushNotification,
): Promise<StoredPushNotification[]> {
  const rows = await readAll(userId);
  const index = rows.findIndex((row) => row.id === incoming.id);

  if (index === -1) {
    const next = [incoming, ...rows];
    await writeAll(userId, next);
    return next;
  }

  const existing = rows[index];
  const merged: StoredPushNotification = {
    ...existing,
    readAt: existing.readAt ?? incoming.readAt ?? null,
  };
  const next = [...rows];
  next[index] = merged;
  await writeAll(userId, next);
  return next;
}

/** 읽음 표시. 이미 읽었으면 처음 읽은 시각을 지킨다. 저장된 값을 돌려준다. */
export async function markPushNotificationAsRead(userId: string, id: string): Promise<string> {
  const rows = await readAll(userId);
  const index = rows.findIndex((row) => row.id === id);
  if (index === -1) return new Date().toISOString();

  const existing = rows[index];
  if (existing.readAt) return existing.readAt;

  const readAt = new Date().toISOString();
  const next = [...rows];
  next[index] = { ...existing, readAt };
  await writeAll(userId, next);
  return readAt;
}

/** 한 건 삭제. 되돌릴 수 없다. */
export async function deletePushNotification(userId: string, id: string): Promise<void> {
  const rows = await readAll(userId);
  await writeAll(
    userId,
    rows.filter((row) => row.id !== id),
  );
}

/**
 * OS 알림 센터에 아직 남아 있는 알림을 함에 반영한다.
 *
 * 앱이 백그라운드일 때 도착해 사용자가 탭하지 않은 알림도, 알림 센터에 남아 있는 동안
 * 앱을 열면 목록에 들어온다. 이미 있는 건 그대로다(중복 없음 · 읽음 유지).
 * ⚠️ 알림 센터에서 이미 지운 것은 여기서도 못 가져온다. (파일 머리의 한계)
 */
export async function syncPresentedNotifications(
  userId: string,
  presented: Notifications.Notification[],
): Promise<void> {
  for (const notification of presented) {
    await savePushNotification(userId, toStoredPushNotification(notification));
  }
}
