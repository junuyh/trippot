// ============================================================================
// 사용자 프로필 조회
//
// 지키는 것 (CLAUDE.md 7장)
//   - 모든 DB Query 는 이 폴더 안에만 둔다. 화면·컴포넌트에서 supabase.from() 직접 호출 금지.
//   - 다른 사용자 데이터에 접근할 수 있는 Query 를 만들지 않는다.
//   - Supabase error 가 있으면 throw 한다. 화면은 그걸 Error 상태로 처리한다.
//   - 타입은 types/database.ts 생성 타입만 쓴다. 직접 정의하지 않는다.
//
// ⚠️ 프로필 중 **이미지만** 수정한다. 이름·계정은 수정 기능이 확정되기 전까지
//    update 를 만들지 않는다.
// ============================================================================
import {
  AUTH_PROVIDER,
  NOTIFICATION_TYPE,
  type AuthProvider,
  type NotificationType,
} from '@/lib/constants/status';
import { IS_TEST_BUILD } from '@/lib/constants/testBuild';
import { supabase } from '@/lib/supabase/client';
import { ensureTestVirtualAccounts } from '@/lib/supabase/queries/funds';
import type { Json, Tables } from '@/types/database';

export type User = Tables<'users'>;

/**
 * MY-01 프로필에 필요한 만큼만. 알림 설정 등은 담지 않는다.
 *
 * ⚠️ auth_provider_user_id 는 **일부러 넣지 않았다.** `kakao_1001` 같은 내부 연동
 *    식별자라 화면에 보여줄 일이 없다. 가져오지 않으면 실수로 그릴 수도 없다.
 */
export type UserProfile = Pick<
  User,
  'id' | 'name' | 'english_name' | 'profile_image_url' | 'auth_provider' | 'created_at'
>;

/**
 * 프로필 한 명. 없거나 탈퇴한 사용자면 null 이다.
 *
 * maybeSingle() 이라 잘못된 userId 로 들어와도 던지지 않는다.
 * 화면은 null 을 Error 상태로 처리한다. (CLAUDE.md 9장)
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('users')
    // created_at = 이 카카오 계정으로 TripPot 에 처음 들어와 사용자 행이 생긴 날.
    // MY-01 여권의 MEMBER SINCE 가 쓴다. (2026-09-13) 카카오 가입일이 아니다.
    // english_name = 여권 영문 이름. 사용자가 계정관리에서 직접 넣은 값 그대로.
    // (2026-09-15 · migration 20260915000001) 없으면 null → 여권에 '—'.
    .select('id, name, english_name, profile_image_url, auth_provider, created_at')
    .eq('id', userId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * 프로필 이미지 위치를 갱신한다. (MY-01)
 *
 * ⚠️ `publicUrl` 은 **public URL 전체**다. object path 가 아니다.
 *    컬럼 이름이 `_url` 이고 앱이 `Image` 의 `uri` 에 그대로 넣는다.
 *    (docs/05_ERD_v5.md §3 users · 파일 업로드는 lib/supabase/storage/profileImage.ts)
 *
 * ⚠️ 다른 사용자의 행을 건드리지 않도록 `userId` 로만 좁힌다. (CLAUDE.md 7장)
 */
export async function updateProfileImageUrl(
  userId: string,
  publicUrl: string,
): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ profile_image_url: publicUrl })
    .eq('id', userId)
    .is('deleted_at', null);

  if (error) throw error;
}

// ============================================================================
// 알림 설정 (MY 설정 → 알림)
//
// ⚠️ key 는 NOTIFICATION_TYPE 3종과 1:1 이다. (2026-09-03 제품 확정)
//    문자열을 여기서 다시 정의하지 않고 상수를 그대로 돌려 쓴다.
//
//    ERD v5 는 이 칼럼을 "상위 카테고리", notifications.type 을 "세부 사건" 으로
//    적고 있다. 그 모델은 이번 제품 결정으로 대체됐다. MVP 는 카테고리 층을
//    두지 않고 확정된 3개 type 과 설정을 1:1 로 잇는다.
//    (문서 정합성 정리는 기능 구현 후 별도 작업)
// ============================================================================

/** 알림 3종 각각의 수신 여부. */
export type NotificationSettings = Record<NotificationType, boolean>;

/**
 * 저장된 JSON 을 화면이 쓸 수 있는 형태로 바꾼다.
 *
 * **기본값은 ON 이다.** `false` 로 저장돼 있을 때만 OFF 다.
 * 그래서 DB default 인 `{}` 사용자도 세 스위치가 모두 켜져 보인다.
 *
 * ⚠️ seed 에 남아 있는 `trip_reminder` · `settlement_reminder` 는 legacy key 라
 *    보지 않는다. 호환 로직도 두지 않는다. (제품 확정)
 */
function toNotificationSettings(raw: Json): NotificationSettings {
  // jsonb 라 배열이나 문자열이 들어와 있을 수도 있다. 객체일 때만 읽는다.
  const stored =
    raw !== null && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  const settings = {} as NotificationSettings;
  for (const type of Object.values(NOTIFICATION_TYPE)) {
    settings[type] = stored[type] !== false;
  }
  return settings;
}

/**
 * 내 알림 설정. 없거나 탈퇴한 사용자면 null 이다.
 *
 * 화면은 null 을 Error 상태로 처리한다. (CLAUDE.md 9장)
 */
export async function getNotificationSettings(
  userId: string,
): Promise<NotificationSettings | null> {
  const { data, error } = await supabase
    .from('users')
    .select('notification_settings_json')
    .eq('id', userId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return toNotificationSettings(data.notification_settings_json);
}

/**
 * 알림 설정을 저장한다.
 *
 * ⚠️ 확정된 3개 key 만 담아 통째로 덮어쓴다. 기존 JSON 에 legacy 나 알 수 없는
 *    key 가 있어도 그 값이 남아 현재 동작에 끼어들지 않는다. 읽기(기본 ON)와
 *    쓰기가 같은 3개 key 만 보므로 화면과 저장이 어긋날 수 없다.
 */
export async function updateNotificationSettings(
  userId: string,
  settings: NotificationSettings,
): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ notification_settings_json: settings })
    .eq('id', userId)
    .is('deleted_at', null);

  if (error) throw error;
}

// ============================================================================
// 최초 로그인 시 public.users 행 만들기
//
// ⚠️ public.users.id 는 auth.users(id) 를 참조한다. (init_schema.sql:37)
//    그래서 별도 매핑 칼럼이 필요 없고 migration 도 필요 없다.
//    Supabase 가 auth.users 를 만들지만 public.users 는 아무도 안 만든다.
//
// ⚠️ **매번 덮어쓰지 않는다.** 이미 행이 있으면 그대로 둔다.
//    upsert 로 매 로그인마다 카카오 값을 밀어 넣으면, 앱에서 바꾼 프로필
//    사진(MY-01 기능)이 로그인할 때마다 카카오 사진으로 되돌아간다.
// ============================================================================

/** 카카오가 준 값 중 우리가 쓰는 것만. */
type OAuthProfile = {
  name: string | null;
  imageUrl: string | null;
  provider: AuthProvider | null;
  providerUserId: string | null;
};

/**
 * Supabase 의 provider 식별자를 **TripPot 제품 기준 로그인 방식**으로 바꾼다.
 *
 * 둘은 같은 개념이 아니다.
 *
 *   Supabase 기술 식별자        TripPot 제품 로그인 방식
 *   'kakao'                →   AUTH_PROVIDER.KAKAO
 *   'custom:kakao-oidc'    →   AUTH_PROVIDER.KAKAO
 *
 * 사용자 입장에서는 둘 다 그냥 '카카오 로그인' 이다. Custom OIDC 는 카카오
 * 동의항목(account_email) 문제를 피하려고 고른 **구현 방식**일 뿐, 새로운
 * 로그인 수단이 아니다. 그래서 화면과 저장값은 제품 기준 하나로 통일한다.
 *
 * ⚠️ 이 변환을 화면마다 조건으로 늘리지 않는다. (`=== 'kakao' || === 'custom:…'`)
 *    provider 를 읽는 경계가 여기 하나뿐이어야, 나중에 Provider 이름이 바뀌어도
 *    고칠 곳이 한 곳이다.
 *
 * ⚠️ 아는 값만 옮긴다. 모르는 값은 null 이다. 임의로 'kakao' 로 넘겨짚으면
 *    나중에 Apple·Google 을 붙였을 때 전부 카카오로 보이게 된다.
 */
export function toProductAuthProvider(raw: string | null): AuthProvider | null {
  // Supabase Dashboard 에 만들어 둔 Custom OIDC Provider 이름을 포함한다.
  // (lib/auth/kakao.ts OIDC_PROVIDER 와 같은 값이다)
  const KAKAO_IDS = ['kakao', 'custom:kakao-oidc'];
  if (raw === null) return null;
  if (KAKAO_IDS.includes(raw)) return AUTH_PROVIDER.KAKAO;
  // 로그인 수단 확대(2026-09-16). Supabase identity.provider 값 그대로다.
  if (raw === 'google') return AUTH_PROVIDER.GOOGLE;
  if (raw === 'email') return AUTH_PROVIDER.EMAIL;
  return null;
}

/**
 * 지금 세션이 **어떤 인증 방법**으로 만들어졌나. access token 의 `amr` 청구항이다.
 *   'password'  이메일+비밀번호      'oauth' · 'oidc'  소셜(구글 · 카카오 Custom OIDC)
 * 토큰을 로컬에서 디코드할 뿐 네트워크를 타지 않는다. (auth-js getAuthenticatorAssuranceLevel)
 * 세션이 없거나 amr 이 없으면 null.
 */
export async function readSessionAuthMethod(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const methods = data?.currentAuthenticationMethods ?? [];
    // 시간순 마지막 항목이 이 세션을 만든 방법이다. 문자열 형식(RFC-8176)과 객체 형식 둘 다 온다.
    const last = methods[methods.length - 1];
    if (!last) return null;
    return typeof last === 'string' ? last : last.method;
  } catch {
    return null;
  }
}

/**
 * **지금 세션이 어떤 방식으로 로그인됐는가.** (2026-09-20 · 계정관리 연결된 계정)
 *
 * ⚠️ `app_metadata.provider` 를 쓰지 않는다. trippot-dev 실측(2026-09-20): 그 값은 **처음 만든
 *    신원**이고, 구글과 이메일이 한 계정으로 이어진 사용자(providers = [email, google])도
 *    'email' 그대로였다. `identities[].last_sign_in_at` 도 만들 때 시각에서 갱신되지 않았다.
 *    그래서 "지금 무엇으로 들어왔나" 는 세션 토큰의 인증 방법(amr) 으로만 알 수 있다.
 *
 *   amr 'password'            → 이메일 (이메일 신원이 있을 때)
 *   amr 'oauth' · 'oidc'      → 신원 중 **소셜 하나** (구글 / 카카오). 둘 이상이면 모른다(null)
 *   amr 없음                  → 신원이 하나뿐이면 그 신원. 여럿이면 모른다(null)
 *
 * ⚠️ email 이 있다는 이유로 '이메일 로그인' 이라고 판단하지 않는다. 구글도 email 을 준다.
 * ⚠️ 모르면 null. 카카오·이메일로 넘겨짚지 않는다. 여러 신원을 나열하지도 않는다 — 이 화면은
 *    "지금 로그인한 계정 하나" 를 보여주는 곳이다.
 */
export function readSessionAuthProvider(
  user: { identities?: { provider: string; id: string }[] | null },
  method: string | null,
): AuthProvider | null {
  const providers = Array.from(
    new Set(
      (user.identities ?? [])
        .map((identity) => toProductAuthProvider(identity.provider))
        .filter((p): p is AuthProvider => p !== null),
    ),
  );
  const social = providers.filter((p) => p !== AUTH_PROVIDER.EMAIL);

  if (method === 'password') {
    return providers.includes(AUTH_PROVIDER.EMAIL) ? AUTH_PROVIDER.EMAIL : null;
  }
  if (method === 'oauth' || method === 'oidc') {
    return social.length === 1 ? social[0] : null;
  }
  return providers.length === 1 ? providers[0] : null;
}

/**
 * 세션에서 프로필을 뽑는다.
 *
 * ⚠️ 키 이름을 하나로 단정하지 않는다. Supabase 는 provider 응답을 정규화하면서
 *    이름을 name / full_name / preferred_username 중 하나로, 사진을
 *    avatar_url / picture 중 하나로 넣는다. 실제로 들어온 것을 쓴다.
 *
 * ⚠️ email · phone 은 읽지 않는다. 서비스에 필요하지 않은 개인정보를
 *    저장하지 않는다.
 */
export function readOAuthProfile(user: {
  user_metadata?: Record<string, unknown>;
  identities?: { provider: string; id: string }[] | null;
}): OAuthProfile {
  const meta = user.user_metadata ?? {};
  const pick = (...keys: string[]): string | null => {
    for (const key of keys) {
      const value = meta[key];
      if (typeof value === 'string' && value.trim() !== '') return value;
    }
    return null;
  };

  // 로그인에 쓴 provider 하나. 카카오만 쓰므로 사실상 첫 항목이다.
  const identity = user.identities?.[0] ?? null;

  return {
    name: pick('name', 'full_name', 'preferred_username', 'nickname'),
    imageUrl: pick('avatar_url', 'picture', 'profile_image_url'),
    // ⚠️ Supabase 식별자를 그대로 저장하지 않는다. 'custom:kakao-oidc' 가
    //    users.auth_provider 에 들어가면, 제품 기준 값('kakao')과 비교하는
    //    화면들이 전부 어긋난다. 만드는 경계에서 한 번만 바꾼다.
    provider: toProductAuthProvider(identity?.provider ?? null),
    providerUserId: identity?.id ?? null,
  };
}

/**
 * 로그인한 사용자의 public.users 행을 보장한다.
 *
 * 1. 행이 없으면 만든다
 * 2. 행이 있으면 아무것도 하지 않는다 — **탈퇴 대기 · 탈퇴 완료 행을 되살리지 않는다.**
 *    (회원탈퇴 30일 유예 정책 · 2026-09-17) 되살리는 길은 사용자가 직접 누르는
 *    cancelWithdrawal() 하나뿐이다. 로그인 이벤트로 자동 복구하던 allowRevive 는 없앴다.
 *    계정 상태(대기/완료)는 AuthProvider 가 getAccountState() 로 읽어 화면을 가른다.
 *
 * ⚠️ name 은 NOT NULL 이다. 카카오가 닉네임을 주지 않는 경우
 *    (동의항목 미설정·거부) 를 대비해 '여행자' 를 쓴다. 빈 문자열이나
 *    id 조각을 넣지 않는다 — 화면 곳곳에 그대로 노출되는 값이다.
 *    사용자는 나중에 프로필에서 바꿀 수 있다.
 */
export async function ensureUserProfile(user: {
  id: string;
  user_metadata?: Record<string, unknown>;
  identities?: { provider: string; id: string }[] | null;
}): Promise<void> {
  const { data: existing, error: readError } = await supabase
    .from('users')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  if (readError) throw readError;

  if (!existing) {
    const profile = readOAuthProfile(user);

    const { error } = await supabase.from('users').insert({
      id: user.id,
      name: profile.name ?? '여행자',
      profile_image_url: profile.imageUrl,
      auth_provider: profile.provider,
      auth_provider_user_id: profile.providerUserId,
    });

    // 같은 순간에 두 번 들어와 이미 만들어졌으면 그대로 둔다. (23505 = unique_violation)
    if (error && error.code !== '23505') throw error;
  }

  /*
    테스트 빌드: 내 가상 계좌(카카오뱅크·토스뱅크 각 200만 원)를 한 번 만든다.
    (2026-09-22 결정 · lib/supabase/queries/funds.ts ensureTestVirtualAccounts)

    ⚠️ 행이 **이미 있던 경우에도** 부른다. "가입 시 한 번" 이 요구지만, 오늘
       이전에 가입한 테스터는 가입 순간이 이미 지나가 버렸다. 그 사람들도
       다음 로그인에서 한 번은 받아야 한다. 한 번만 만들어지는 것은
       ensureTestVirtualAccounts 안의 개수 확인이 보장한다 — 있으면 아무것도
       안 하므로 로그인마다 불려도 계좌가 불어나지 않는다.

    ⚠️ 실패해도 로그인을 막지 않는다. 계좌는 시연 편의이지 로그인 조건이
       아니다. 여기서 던지면 AuthProvider 의 catch 가 프로필 보장까지 실패한
       것으로 읽는다.
  */
  if (IS_TEST_BUILD) {
    try {
      await ensureTestVirtualAccounts(user.id);
    } catch (e) {
      if (__DEV__) console.warn('[ensureUserProfile] 테스트 가상 계좌 생성 실패', e);
    }
  }
}

/**
 * 사용자가 직접 정한 이름으로 바꾼다. (계정관리)
 *
 * ⚠️ 카카오 닉네임과 별개다. 카카오 닉네임은 auth 세션의 user_metadata 에
 *    있고 앱이 바꿀 수 없다. 이 값은 앱 안에서 보이는 이름이다.
 *    한 번 바꾸면 다시 로그인해도 카카오 값으로 되돌아가지 않는다.
 *    (ensureUserProfile 이 기존 행의 name 을 덮지 않는다)
 *
 * ⚠️ name 은 NOT NULL 이다. 빈 문자열도 받지 않는다. 화면 곳곳에 그대로
 *    노출되는 값이라 공백만 남은 이름이 들어가면 이름 자리가 비어 보인다.
 *    검증은 화면에서 하고 여기서도 한 번 더 막는다.
 *
 * ⚠️ 다른 사용자의 행을 건드리지 않도록 userId 로만 좁힌다. (CLAUDE.md 7장)
 */
export async function updateUserName(userId: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (trimmed === '') throw new Error('이름은 비워 둘 수 없습니다.');

  const { error } = await supabase
    .from('users')
    .update({ name: trimmed })
    .eq('id', userId)
    .is('deleted_at', null);

  if (error) throw error;
}

/**
 * 여권 영문 이름을 갱신한다. (계정관리 → MY-01 여권 ENGLISH NAME)
 *
 * ⚠️ name 과 달리 **선택값**이다. 앞뒤 공백을 지운 뒤 비어 있으면 빈 문자열이
 *    아니라 **null 로 저장**한다. 여권은 null 을 '—' 로 그린다. 빈 문자열이
 *    남으면 '있는데 비어 보이는' 값이 된다.
 * ⚠️ 자동 변환하지 않는다. 대문자화 · 로마자 변환 · 형식 검증 없이 입력한
 *    그대로 둔다. 여권에 적힌 표기가 기준이고 그건 사용자만 안다.
 *
 * ⚠️ 다른 사용자의 행을 건드리지 않도록 userId 로만 좁힌다. (CLAUDE.md 7장)
 */
export async function updateUserEnglishName(userId: string, englishName: string): Promise<void> {
  const trimmed = englishName.trim();

  const { error } = await supabase
    .from('users')
    .update({ english_name: trimmed === '' ? null : trimmed })
    .eq('id', userId)
    .is('deleted_at', null);

  if (error) throw error;
}

/** 회원탈퇴 유예 30일. 서버 RPC 와 같은 값이다. (docs/15_회원탈퇴정책_v1.md) */
export const WITHDRAWAL_GRACE_DAYS = 30;

/** 서버가 message 로 돌려주는 탈퇴 도메인 오류. migration 20260917000001 머리 주석의 표 그대로. */
export const WITHDRAWAL_ERROR = {
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  NOT_FOUND: 'NOT_FOUND',
  /** 다른 ACTIVE 멤버가 있는 진행 중 여행의 여행장. 위임(delegate_trip_leader)이 먼저다. */
  LEADER_MUST_DELEGATE: 'LEADER_MUST_DELEGATE',
  ALREADY_WITHDRAWN: 'ALREADY_WITHDRAWN',
} as const;
export type WithdrawalErrorCode = (typeof WITHDRAWAL_ERROR)[keyof typeof WITHDRAWAL_ERROR];

const WITHDRAWAL_ERROR_CODES = new Set<string>(Object.values(WITHDRAWAL_ERROR));

/** 던져진 오류에서 탈퇴 도메인 코드를 꺼낸다. 없으면 null. (queries/tripJoinRequests 와 같은 방식) */
export function withdrawalErrorCode(error: unknown): WithdrawalErrorCode | null {
  const message =
    error !== null && typeof error === 'object' && 'message' in error
      ? String((error as { message: unknown }).message).trim()
      : '';
  return WITHDRAWAL_ERROR_CODES.has(message) ? (message as WithdrawalErrorCode) : null;
}

/**
 * 계정 상태. users 의 두 시각으로 가른다. (회원탈퇴 30일 유예 · 2026-09-17)
 *   ACTIVE              정상
 *   PENDING_WITHDRAWAL  탈퇴 신청 뒤 30일 이내. effectiveAt 에 최종 탈퇴 예정 (ISO)
 *   WITHDRAWN           최종 탈퇴 완료(tombstone). 세션이 남아 있어도 서비스를 쓸 수 없다
 */
export type AccountState =
  | { kind: 'ACTIVE' }
  | { kind: 'PENDING_WITHDRAWAL'; effectiveAt: string }
  | { kind: 'WITHDRAWN' };

/** 내 계정 상태. 행이 없으면(아직 ensureUserProfile 전) ACTIVE 로 본다. */
export async function getAccountState(userId: string): Promise<AccountState> {
  const { data, error } = await supabase
    .from('users')
    .select('deleted_at, withdrawal_requested_at')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return { kind: 'ACTIVE' };
  if (data.deleted_at) return { kind: 'WITHDRAWN' };
  if (data.withdrawal_requested_at) {
    const effective = new Date(data.withdrawal_requested_at);
    effective.setDate(effective.getDate() + WITHDRAWAL_GRACE_DAYS);
    return { kind: 'PENDING_WITHDRAWAL', effectiveAt: effective.toISOString() };
  }
  return { kind: 'ACTIVE' };
}

/**
 * 회원탈퇴 신청. 서버 request_withdrawal — 본인만 · 멱등.
 *
 * 즉시 지우지 않는다. users.withdrawal_requested_at 만 찍히고 30일 뒤 서버(cron)가 최종 처리한다.
 * 그 사이 같은 계정으로 로그인하면 홈 대신 '탈퇴 진행 중' 화면(app/withdrawal-pending)이 뜨고
 * 거기서 취소할 수 있다. 여행장이면 LEADER_MUST_DELEGATE — 멤버 관리에서 위임한 뒤 다시 신청한다.
 *
 * ⚠️ 모임 · 여행 · 납부 · 지출 · 정산 · 게시글은 최종 탈퇴 뒤에도 그대로다. 다른 멤버의 공동 기록이다.
 * ⚠️ 세션 삭제는 여기서 하지 않는다. 화면이 signOut() 을 따로 부른다. (DB 먼저, 로그아웃은 그다음)
 *
 * @returns 최종 탈퇴 예정 시각 (ISO)
 */
export async function requestWithdrawal(): Promise<string> {
  const { data, error } = await supabase.rpc('request_withdrawal');
  if (error) throw error;
  const row = data?.[0];
  if (!row) throw new Error('request_withdrawal: 서버가 빈 결과를 돌려줬습니다.');
  return row.withdrawal_effective_at;
}

/** 탈퇴 취소. 30일 이내 · 본인만. 되살아나는 것은 없다 — 아무것도 지우지 않았으니 그대로 ACTIVE 다. */
export async function cancelWithdrawal(): Promise<void> {
  const { error } = await supabase.rpc('cancel_withdrawal');
  if (error) throw error;
}
