// ============================================================================
// 초대 권유 모달을 이 여행에서 이미 띄웠는가 — 기기 저장
//
// 여행을 만들고 여행 홈에 처음 들어오면 "초대해 보세요" 모달이 한 번 뜬다.
// 매번 뜨면 여행 홈에 들어올 때마다 막힌다.
//
// ⚠️ **DB 에 기록하지 않는다.** '이 화면을 봤다' 를 서버에 남기려면 칼럼이
//    필요하고 그건 스키마 변경이다. 초대 받는 쪽(pendingInvites.modalShownAt)도
//    같은 이유로 기기에 저장한다. 같은 방식으로 맞춘다. (2026-09-16)
//
// ⚠️ 그래서 **기기별**이다. 폰을 바꾸면 모달이 한 번 더 뜬다. 초대를 한 번 더
//    권하는 것뿐이라 손해가 작다고 보고 받아들인다. 서버에 남겨야 할 만큼
//    중요해지면 trips 에 칼럼을 요청한다.
//
// ⚠️ useScreenView(SCREENS.*) 로 대신하지 않는다. 그건 분석용이고 __DEV__ 에서는
//    저장조차 하지 않는다. 화면 분기에 쓰면 개발 중에는 매번 뜨고 분석 데이터도
//    더럽힌다. (CLAUDE.md 8장)
//
// ⚠️ 사용자별로 key 를 나눈다. 다른 계정으로 들어와도 남의 기록을 보지 않는다.
//    (lib/invite/pendingInvites 와 같은 방식)
// ============================================================================
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY_PREFIX = 'trippot:invite-nudge:';

/**
 * 보관 상한. 여행마다 한 줄씩 쌓이므로 오래된 것부터 버린다.
 * 넘쳐서 지워지면 그 여행에서 모달이 한 번 더 뜬다. 그뿐이다.
 */
const MAX_ITEMS = 50;

function storageKey(userId: string): string {
  return `${STORAGE_KEY_PREFIX}${userId}`;
}

async function readAll(userId: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === 'string' && v.length > 0);
  } catch {
    // 깨진 값이 있어도 여행 홈은 떠야 한다. 안 띄운 것으로 본다.
    return [];
  }
}

/** 이 여행에서 초대 권유 모달을 이미 띄웠는가. */
export async function wasInviteNudgeShown(userId: string, tripId: string): Promise<boolean> {
  const rows = await readAll(userId);
  return rows.includes(tripId);
}

/**
 * 띄웠다고 표시한다.
 *
 * ⚠️ 모달을 **띄우는 시점**에 부른다. 닫는 시점이 아니다. 닫기 전에 앱이
 *    꺼지면 다음에 또 뜬다.
 */
export async function markInviteNudgeShown(userId: string, tripId: string): Promise<void> {
  try {
    const rows = await readAll(userId);
    if (rows.includes(tripId)) return;
    await AsyncStorage.setItem(
      storageKey(userId),
      JSON.stringify([tripId, ...rows].slice(0, MAX_ITEMS)),
    );
  } catch {
    // 저장에 실패해도 모달은 이미 떴다. 다음에 한 번 더 뜰 뿐이다.
  }
}
