// ============================================================================
// Analytics 단일 진입점
// 기준 문서: docs/06_이벤트로그정의서_v3.md 2·5·11장, CLAUDE.md 8장
//
// ⚠️ 이 파일은 CLAUDE.md 5장 [공유] 파일이다.
//
//   화면/기능 → track() ─┬─ Amplitude
//                        └─ event_log (Supabase)
//
// - amplitude.track() / analytics().logEvent() 를 직접 호출하지 않는다.
// - event_log 에 직접 INSERT 하지 않는다. 이 파일 내부에서만 한다.
// - __DEV__ 에서는 전송하지 않고 콘솔에만 출력한다. (docs/06 §5)
// ============================================================================
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as amplitude from '@amplitude/analytics-react-native';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { ADVANCED_EVENT_NAMES, type EventName } from '@/lib/analytics/events';
import { supabase } from '@/lib/supabase/client';

/** 파라미터 값은 스네이크 문자열 / boolean / number 만 쓴다. (docs/06 §4) */
export type EventParams = Record<string, string | number | boolean | null | undefined>;

const ANON_ID_STORAGE_KEY = 'trippot.analytics.anon_id';

const ENV: 'development' | 'production' = __DEV__ ? 'development' : 'production';
const APP_VERSION = Constants.expoConfig?.version ?? 'unknown';

// ── 세션 컨텍스트 ───────────────────────────────────────────────────────────
let currentUserId: string | null = null;
let currentTripId: string | null = null;

// ── anon_id ────────────────────────────────────────────────────────────────
// 최초 실행 시 발급 → AsyncStorage 저장 → 이후 재사용. (docs/06 §5)
// 로그인 전 이벤트를 anon_id 로 묶어두지 않으면 유입 대비 전환율의 분모가 틀어진다.
let cachedAnonId: string | null = null;
let anonIdPromise: Promise<string> | null = null;

function createUuidV4(): string {
  const webCrypto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (typeof webCrypto?.randomUUID === 'function') {
    return webCrypto.randomUUID();
  }
  // Expo 런타임에 crypto.randomUUID 가 없을 때를 위한 대비책.
  // anon_id 는 보안 토큰이 아니라 익명 식별자이므로 이 수준으로 충분하다.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getAnonId(): Promise<string> {
  if (cachedAnonId) return Promise.resolve(cachedAnonId);
  if (anonIdPromise) return anonIdPromise;

  anonIdPromise = (async () => {
    try {
      const stored = await AsyncStorage.getItem(ANON_ID_STORAGE_KEY);
      if (stored) {
        cachedAnonId = stored;
        return stored;
      }
      const created = createUuidV4();
      await AsyncStorage.setItem(ANON_ID_STORAGE_KEY, created);
      cachedAnonId = created;
      return created;
    } catch {
      // 저장소 접근이 실패해도 로깅은 계속되어야 한다.
      // 이 세션 동안만 유효한 임시 id를 쓴다.
      cachedAnonId = cachedAnonId ?? createUuidV4();
      return cachedAnonId;
    }
  })();

  return anonIdPromise;
}

// ── Amplitude ──────────────────────────────────────────────────────────────
let amplitudeReady: boolean | null = null;

function ensureAmplitude(): boolean {
  if (amplitudeReady !== null) return amplitudeReady;

  const apiKey = process.env.EXPO_PUBLIC_AMPLITUDE_API_KEY;
  if (!apiKey) {
    console.warn('[analytics] EXPO_PUBLIC_AMPLITUDE_API_KEY 없음 — Amplitude 전송을 건너뜁니다.');
    amplitudeReady = false;
    return false;
  }

  try {
    amplitude.init(apiKey);
    amplitudeReady = true;
  } catch (error) {
    console.warn('[analytics] Amplitude 초기화 실패 — 이 전송만 건너뜁니다.', error);
    amplitudeReady = false;
  }
  return amplitudeReady;
}

// ── 공통 파라미터 ──────────────────────────────────────────────────────────
type CommonParams = {
  anon_id: string;
  user_id: string | null;
  trip_id: string | null;
  platform: string;
  app_version: string;
  env: 'development' | 'production';
};

// ── 공개 API ───────────────────────────────────────────────────────────────

/**
 * 앱 시작 시 1회 호출한다. anon_id 를 미리 발급해 첫 이벤트가 지연되지 않게 한다.
 */
export async function initAnalytics(): Promise<void> {
  await getAnonId();
  if (!__DEV__) {
    ensureAmplitude();
  }
}

/**
 * 로그인 / 로그아웃 시 호출한다.
 * 이후 모든 이벤트에 user_id 가 붙고, anon_id 도 함께 남아 로그인 전후가 이어진다.
 */
export function setAnalyticsUser(userId: string | null): void {
  currentUserId = userId;
  if (__DEV__) return;

  if (ensureAmplitude()) {
    try {
      amplitude.setUserId(userId ?? undefined);
    } catch {
      // 무시. 이벤트 전송 자체는 계속된다.
    }
  }
}

/** 여행 화면에 진입/이탈할 때 호출한다. 이후 이벤트에 trip_id 가 자동으로 붙는다. */
export function setTripContext(tripId: string | null): void {
  currentTripId = tripId;
}

/**
 * 모든 이벤트 기록의 단일 진입점.
 *
 *   track(EVENTS.BUDGET_METHOD_SELECTED, { method: 'recommended' });
 *
 * - 이벤트 이름은 EVENTS 상수만 쓴다. 문자열 리터럴 금지. (docs/06 §11)
 * - 성공한 결과에만 쏜다. 저장에 실패했으면 쏘지 않는다.
 * - 화면 이동 전에 쏜다.
 */
export function track(name: EventName, params: EventParams = {}): void {
  void dispatch(name, params);
}

async function dispatch(name: EventName, params: EventParams): Promise<void> {
  const anonId = await getAnonId();

  const tripId =
    typeof params.trip_id === 'string' ? params.trip_id : currentTripId;

  const common: CommonParams = {
    anon_id: anonId,
    user_id: currentUserId,
    trip_id: tripId,
    platform: Platform.OS,
    app_version: APP_VERSION,
    env: ENV,
  };

  // 호출부 파라미터가 공통 파라미터를 덮어쓸 수 있다 (trip_id 명시 전달 등).
  const merged = { ...common, ...params };

  if (__DEV__) {
    if (ADVANCED_EVENT_NAMES.includes(name)) {
      console.warn(`[track] "${name}" 은 고도화(9/07~) 이벤트입니다. MVP에서 호출하지 마세요.`);
    }
    console.log('[track]', name, merged);
    return;
  }

  // ── ① Amplitude ──
  if (ensureAmplitude()) {
    try {
      amplitude.track(name, merged);
    } catch (error) {
      console.warn('[analytics] Amplitude 전송 실패', error);
    }
  }

  // ── ② event_log (Supabase) ──
  // 실패해도 앱이 죽지 않아야 한다. await 하지 않고 reject 도 삼킨다.
  // user_id / anon_id / trip_id / env 는 전용 칼럼이므로 params 에서 제외한다.
  try {
    const { anon_id: _a, user_id: _u, trip_id: _t, env: _e, ...logParams } = merged;

    void supabase
      .from('event_log')
      .insert({
        user_id: currentUserId,
        anon_id: anonId,
        trip_id: tripId,
        event_name: name,
        params: logParams,
        env: ENV,
      })
      .then(
        ({ error }) => {
          if (error) console.warn('[analytics] event_log INSERT 실패', error.message);
        },
        (error: unknown) => {
          console.warn('[analytics] event_log INSERT 예외', error);
        },
      );
  } catch (error) {
    console.warn('[analytics] event_log 기록 건너뜀', error);
  }
}
