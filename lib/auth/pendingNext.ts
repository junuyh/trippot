// ============================================================================
// 로그인 뒤 돌아갈 곳 — 인증 왕복 동안 기기에 남긴다 (2026-09-22)
//
// 왜 필요한가
//   가드(app/_layout.tsx)는 미로그인 사용자를 /login?next=/invite/:token 으로 보내고, 로그인이 끝나면
//   ?next 로 돌아간다. 그런데 next 는 **URL 파라미터**라서 그 사이 라우터가 한 번이라도 다른 곳으로
//   움직이면(카카오 · 구글 콜백 URL 이 딥링크로 들어와 '/' 로 이동 · 앱 재시작) 사라졌다.
//   그래서 같은 값을 여기에도 적어 두고, 로그인이 확인된 순간 한 번 꺼내 쓴다.
//
// 무엇을 저장하는가
//   앱 안 경로 문자열 하나(예 '/invite/ad90c6…')와 적은 시각. 초대 token 이 경로에 포함된다.
//   ⚠️ 사용자 정보 · 세션 · 비밀값은 넣지 않는다. 사용자별로 나누지도 않는다 — 아직 누구인지 모르는 상태다.
//
// 언제 지우는가
//   · 가드가 꺼내 쓴 순간(consume) — 한 번만 쓴다. 이미 그 경로에 있으면 그냥 지운다.
//   · TTL(1시간)이 지난 값 — 며칠 전 열었다 만 초대 링크가 평범한 로그인을 납치하지 않게.
//   잘못된 · 만료된 초대 token 이라도 초대 화면이 그 상태를 그린다. 여기서 되풀이하지 않는다.
//
// ⚠️ 메모리에 먼저 두고 AsyncStorage 에 같이 적는다. 같은 실행 안에서는 동기로 읽히고(콜백 URL 로
//    라우터가 움직이는 사이에도), 앱이 다시 시작되면 hydrate 로 되살린다.
// ============================================================================
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'trippot:auth-pending-next';
/** 인증 왕복은 길어야 몇 분이다. 그보다 오래된 값은 버린다. */
const TTL_MS = 60 * 60 * 1000;

type Stored = { path: string; savedAt: number };

let memory: string | null = null;

/**
 * 앱 안 경로만 받는다. '//example.com' 은 protocol-relative URL 이라 앱 밖을 가리키므로 막는다.
 * (app/_layout.tsx 의 next 검사와 같은 규칙)
 */
export function isInternalPath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//');
}

/** 가드가 미로그인 사용자를 로그인으로 보내기 직전에 부른다. 루트('/')는 남길 이유가 없어 적지 않는다. */
export function savePendingNext(path: string): void {
  if (!isInternalPath(path) || path === '/') return;
  memory = path;
  const stored: Stored = { path, savedAt: Date.now() };
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stored)).catch(() => undefined);
}

/** 지금 기억하고 있는 값. 지우지 않는다. */
export function peekPendingNext(): string | null {
  return memory;
}

export function clearPendingNext(): void {
  memory = null;
  AsyncStorage.removeItem(STORAGE_KEY).catch(() => undefined);
}

/**
 * 앱 시작 때 한 번. 저장된 값이 유효하면 메모리에 올린다.
 * 깨진 값 · 오래된 값은 지운다. 실패해도 던지지 않는다 — 없는 것으로 본다.
 */
export async function hydratePendingNext(): Promise<string | null> {
  if (memory !== null) return memory;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    const stored = parsed as Partial<Stored> | null;
    const path = typeof stored?.path === 'string' ? stored.path : null;
    const savedAt = typeof stored?.savedAt === 'number' ? stored.savedAt : 0;
    if (path && isInternalPath(path) && path !== '/' && Date.now() - savedAt <= TTL_MS) {
      memory = path;
      return memory;
    }
    await AsyncStorage.removeItem(STORAGE_KEY);
    return null;
  } catch {
    return null;
  }
}
