// ============================================================================
// 아직 답하지 않은 초대 — 기기에 보관한다 (2026-09-15)
//
//   /invite/:token 열림  →  token 저장  →  홈 모달 · 상시 배너  →  참여 요청 또는 거절  →  삭제
//
// 왜 기기에 두는가
//   초대 링크(trip_invites)에는 **받는 사람이 없다.** 여러 사람이 같이 쓰는 링크다.
//   (docs/10_여행초대정책_v2.md §4) 그래서 서버는 "누구에게 온 초대인가" 를 모른다.
//   이 사람이 링크를 열었다는 사실은 이 기기만 안다.
//
// 무엇을 저장하는가
//   token 과 저장 시각, 모달을 이미 띄웠는지만. **여행지 · 날짜 · 초대자 이름은 저장하지 않는다.**
//   홈이 열릴 때마다 resolve_trip_invite 로 다시 확인한다. 그새 만료 · 수락 · 거절됐을 수 있다.
//
// ⚠️ '거절하기' 는 이 기기에서 지우는 것뿐이다. 서버에 아무것도 보내지 않는다.
//    받는 사람이 초대를 거절하는 서버 기능은 정책에 없다. (수락 · 거절은 여행장이 한다)
//    같은 링크를 다시 열면 다시 저장된다.
//
// ⚠️ 사용자별로 key 를 나눈다. 다른 계정으로 들어와도 남의 초대가 뜨지 않는다.
//    (lib/notifications/pushInbox 와 같은 방식)
// ============================================================================
import AsyncStorage from '@react-native-async-storage/async-storage';

export type StoredPendingInvite = {
  token: string;
  /** ISO. 링크를 처음 연 시각. 최신순 정렬에만 쓴다. */
  savedAt: string;
  /**
   * ISO. 홈에서 모달을 띄운 시각.
   *
   * ⚠️ 2026-09-16 홈 모달을 빼면서 **쓰지 않는 값이 됐다.** 칸은 남겨 둔다 —
   *    이미 기기에 저장된 값이 이 모양이라, 없애면 그 초대들이 읽히지 않고 사라진다.
   *    새로 저장하는 초대는 null 이다.
   */
  modalShownAt: string | null;
};

const STORAGE_KEY_PREFIX = 'trippot:pending-invites:';

/**
 * 로그인 전에 연 초대를 맡아 두는 자리. (2026-09-16)
 *
 * ⚠️ 위 보관함은 **사용자별**이라 로그인 전에는 쓸 수 없다. 누구의 초대인지
 *    모르기 때문이다. 그래서 로그인할 때까지만 여기에 token 하나를 맡아 두고,
 *    로그인이 끝나 userId 를 알게 되면 그 사람의 보관함으로 옮긴다.
 *
 * ⚠️ 한 칸뿐이다. 로그인 전에 링크를 여러 번 열면 마지막 것만 남는다.
 *    로그인 절차를 밟는 동안 다른 초대를 또 열 일은 드물다.
 *
 * ⚠️ 주소 파라미터(?next=)로 넘기지 않는다. 카카오 로그인은 앱 밖을 한 번
 *    다녀오고 웹에서는 새로고침이 일어나서, 주소에 담아 둔 값이 사라질 수 있다.
 */
const HANDOFF_KEY = 'trippot:invite-handoff';

/**
 * 보관 상한. 배너가 홈을 덮지 않게 한다.
 * 링크는 7일이면 만료되고 홈이 확인할 때 지워지므로 보통 한두 개다.
 */
const MAX_ITEMS = 5;

function storageKey(userId: string): string {
  return `${STORAGE_KEY_PREFIX}${userId}`;
}

function isStoredPendingInvite(value: unknown): value is StoredPendingInvite {
  if (value === null || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.token === 'string' &&
    row.token.length > 0 &&
    typeof row.savedAt === 'string' &&
    (row.modalShownAt === null || typeof row.modalShownAt === 'string')
  );
}

async function readAll(userId: string): Promise<StoredPendingInvite[]> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isStoredPendingInvite)
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  } catch {
    // 깨진 값이 있어도 홈은 떠야 한다. 초대가 없는 것으로 본다.
    return [];
  }
}

async function writeAll(userId: string, rows: StoredPendingInvite[]): Promise<void> {
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(rows.slice(0, MAX_ITEMS)));
}

/** 로그인 전에 연 초대를 맡아 둔다. 실패해도 조용히 넘어간다 — 로그인 자체를 막지 않는다. */
export async function rememberInviteForLogin(token: string): Promise<void> {
  try {
    await AsyncStorage.setItem(HANDOFF_KEY, token);
  } catch {
    // 저장소를 못 쓰면 초대만 놓친다. 링크를 다시 열면 된다.
  }
}

/** 맡아 둔 초대를 꺼내고 자리를 비운다. 없으면 null. */
export async function takeRememberedInvite(): Promise<string | null> {
  try {
    const token = await AsyncStorage.getItem(HANDOFF_KEY);
    if (token) await AsyncStorage.removeItem(HANDOFF_KEY);
    return token;
  } catch {
    return null;
  }
}

/** 이 사용자가 열어 둔 초대, 최신순. */
export async function getPendingInvites(userId: string): Promise<StoredPendingInvite[]> {
  return readAll(userId);
}

/**
 * 초대를 저장한다. 이미 있으면 그대로 둔다 — 모달을 다시 띄우지 않기 위해서다.
 */
export async function savePendingInvite(userId: string, token: string): Promise<void> {
  const rows = await readAll(userId);
  if (rows.some((row) => row.token === token)) return;
  await writeAll(userId, [
    { token, savedAt: new Date().toISOString(), modalShownAt: null },
    ...rows,
  ]);
}

/** 초대를 지운다. 참여 요청을 보냈거나, 거절했거나, 더 이상 답할 수 없는 초대일 때. */
export async function removePendingInvite(userId: string, token: string): Promise<void> {
  const rows = await readAll(userId);
  const next = rows.filter((row) => row.token !== token);
  if (next.length === rows.length) return;
  await writeAll(userId, next);
}
