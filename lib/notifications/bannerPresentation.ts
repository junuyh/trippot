// ============================================================================
// In-app Banner 노출 기록 — "이 기기에서 이 알림을 배너로 이미 보여줬는가" (2026-09-20)
//
// 왜 필요한가
//   NotificationBannerObserver 의 dedupe 는 메모리 Set 뿐이었다. JS 런타임이 다시 시작되면
//   (앱 종료 · Expo reload · 개발 중 새로고침) Set 이 비어, 로그인 확정 시점의 보완 경로
//   (getUnreadNotifications → 최신 1건)가 **아직 안 읽은 같은 알림을 또 배너로 띄웠다.**
//   팀 테스트에서 "로그아웃 → 같은 계정 로그인" 마다 같은 배너가 반복된 원인이다.
//
// 무엇을 저장하는가
//   사용자별 AsyncStorage 한 키에 { id, shownAt } 목록. 최신 BANNER_SHOWN_MAX_ITEMS 개만 남긴다.
//   ⚠️ 읽음(read_at · readAt)이 아니다. 배너를 보여줬어도 알림은 안 읽음이고 점도 켜져 있다.
//      점 계산(unreadPolicy)은 이 저장소를 보지 않는다.
//   ⚠️ 기기 안의 UX 상태다. 서버에 올리지 않고 migration 도 만들지 않는다.
//
// 사용자 분리
//   key 가 userId 별이다. A 에게 보여준 기록이 B 의 배너를 막지 않는다.
//   로그아웃해도 지우지 않는다 — 같은 사용자가 다시 들어왔을 때 반복을 막는 것이 목적이다.
//
// 상한 (BANNER_SHOWN_MAX_ITEMS = 100)
//   배너 후보는 getUnreadNotifications(uid, 5) 의 최신 5건뿐이라, 실제로 대조되는 id 는 "최근에
//   보여준 것 몇 개" 다. 100 은 그보다 훨씬 넉넉하고, 알림센터 페이지(30건)의 3배가 넘는다.
//   기간으로 자르지 않는다 — 기간이 지나 기록이 사라지면 오래된 안 읽은 알림이 다시 뜬다.
// ============================================================================
import AsyncStorage from '@react-native-async-storage/async-storage';

export type BannerShownRecord = {
  /** public.notifications.id */
  id: string;
  /** ISO. 배너를 띄우기로 결정한 시각. */
  shownAt: string;
};

const STORAGE_KEY_PREFIX = 'trippot:notification-banner-shown:';

/** 보관 상한. 파일 머리의 근거를 본다. */
export const BANNER_SHOWN_MAX_ITEMS = 100;

function storageKey(userId: string): string {
  return `${STORAGE_KEY_PREFIX}${userId}`;
}

function isBannerShownRecord(value: unknown): value is BannerShownRecord {
  if (value === null || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === 'string' && typeof row.shownAt === 'string';
}

/** 최신순. 같은 시각이면 id 로 갈라 순서가 흔들리지 않게 한다. */
function byShownAtDesc(a: BannerShownRecord, b: BannerShownRecord): number {
  return b.shownAt.localeCompare(a.shownAt) || a.id.localeCompare(b.id);
}

async function readAll(userId: string): Promise<BannerShownRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isBannerShownRecord).sort(byShownAtDesc);
  } catch {
    // 깨진 값이 있어도 앱은 떠야 한다. 기록이 없는 것으로 본다(최악의 경우 배너가 한 번 더 뜬다).
    return [];
  }
}

/**
 * 순수 함수 — 기록 하나를 더하고 상한으로 자른다. 같은 id 는 처음 기록을 지킨다.
 * (관찰자 · 검증 스크립트가 같이 쓴다)
 */
export function appendBannerShown(
  rows: readonly BannerShownRecord[],
  record: BannerShownRecord,
  max = BANNER_SHOWN_MAX_ITEMS,
): BannerShownRecord[] {
  if (rows.some((row) => row.id === record.id)) return [...rows].sort(byShownAtDesc).slice(0, max);
  return [record, ...rows].sort(byShownAtDesc).slice(0, max);
}

/** 이 사용자에게 이 기기에서 배너로 보여준 알림 id 들. */
export async function getShownBannerIds(userId: string): Promise<Set<string>> {
  const rows = await readAll(userId);
  return new Set(rows.map((row) => row.id));
}

/**
 * 배너를 띄우기로 **결정한** 시점에 기록한다. (렌더 완료는 알 수 없다 — NotificationBannerObserver 주석)
 * 실패해도 던지지 않는다. 배너는 보너스다.
 */
export async function recordBannerShown(userId: string, notificationId: string): Promise<void> {
  try {
    const rows = await readAll(userId);
    const next = appendBannerShown(rows, { id: notificationId, shownAt: new Date().toISOString() });
    await AsyncStorage.setItem(storageKey(userId), JSON.stringify(next));
  } catch {
    // 저장 실패 → 다음 실행에서 한 번 더 뜰 수 있다. 앱을 막지 않는다.
  }
}
