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
import { supabase } from '@/lib/supabase/client';
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
  'id' | 'name' | 'profile_image_url' | 'auth_provider' | 'created_at'
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
    .select('id, name, profile_image_url, auth_provider, created_at')
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
  return KAKAO_IDS.includes(raw) ? AUTH_PROVIDER.KAKAO : null;
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

/** ensureUserProfile 의 동작을 정하는 값. */
export type EnsureUserProfileOptions = {
  /**
   * 탈퇴한 계정을 되살려도 되는지.
   *
   *   SIGNED_IN        true   사용자가 직접 로그인한 것이다 = 재가입
   *   INITIAL_SESSION  false  저장된 세션이 복원된 것뿐이다
   *
   * ⚠️ 이 구분이 없으면, 탈퇴 직후 로그아웃이 실패해 세션만 남은 사용자가
   *    앱을 다시 켰다는 이유만으로 탈퇴가 취소된다. 본인이 하지 않은 일이다.
   */
  allowRevive: boolean;
};

/**
 * 로그인한 사용자의 public.users 행을 보장한다.
 *
 * 1. 행이 없으면 만든다 (두 이벤트 모두)
 * 2. 살아 있는 행이면 아무것도 하지 않는다
 * 3. 탈퇴한 행이면 allowRevive 일 때만 되살린다
 *
 * ⚠️ name 은 NOT NULL 이다. 카카오가 닉네임을 주지 않는 경우
 *    (동의항목 미설정·거부) 를 대비해 '여행자' 를 쓴다. 빈 문자열이나
 *    id 조각을 넣지 않는다 — 화면 곳곳에 그대로 노출되는 값이다.
 *    사용자는 나중에 프로필에서 바꿀 수 있다.
 */
export async function ensureUserProfile(
  user: {
    id: string;
    user_metadata?: Record<string, unknown>;
    identities?: { provider: string; id: string }[] | null;
  },
  options: EnsureUserProfileOptions,
): Promise<void> {
  const { data: existing, error: readError } = await supabase
    .from('users')
    .select('id, deleted_at')
    .eq('id', user.id)
    .maybeSingle();

  if (readError) throw readError;

  if (existing) {
    // 살아 있는 계정이면 아무것도 하지 않는다. 매 로그인마다 덮어쓰지 않는다.
    if (existing.deleted_at === null) return;

    // ⚠️ 여기부터는 탈퇴한 계정이다. 같은 카카오 계정으로 다시 들어오면
    //    auth.users 의 id 가 같아서 이 행이 그대로 잡힌다.
    //
    //    되살릴지 말지는 **어떤 이벤트로 왔는지**가 정한다. (allowRevive)
    //    세션 복원(INITIAL_SESSION)으로는 절대 되살리지 않는다. 탈퇴 직후
    //    로그아웃이 실패해 세션만 남은 경우, 앱을 다시 켰다는 이유만으로
    //    탈퇴가 취소되면 사용자가 의도하지 않은 일이 벌어진다.
    if (!options.allowRevive) return;

    const { error: reviveError } = await supabase
      .from('users')
      .update({ deleted_at: null })
      .eq('id', user.id);
    if (reviveError) throw reviveError;

    // ⚠️ 되살릴 때 name·profile_image_url 을 카카오 값으로 덮지 않는다.
    //    탈퇴해도 여행·모임 데이터는 그대로 두는 정책이라(2026-09-08 확정)
    //    돌아온 사람은 자기 기록을 그대로 돌려받는다. 그 사람이 앱에서 직접
    //    바꿔둔 이름과 사진까지 카카오 값으로 되돌리면 남의 계정처럼 보인다.
    return;
  }

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
 * 회원탈퇴. (계정관리)
 *
 * users.deleted_at 을 채우는 soft delete 다. 행을 지우지 않는다.
 *
 * ⚠️ auth.users 는 건드리지 않는다. 지우려면 service_role 이 필요한데
 *    앱은 anon key 만 쓴다. (CLAUDE.md 1장) 그래서 카카오 연결 자체는
 *    남고, 같은 계정으로 다시 로그인하면 ensureUserProfile 이 이 행을
 *    되살린다. 재가입 허용이 확정된 정책이다. (2026-09-08)
 *
 * ⚠️ 모임 · 여행 · 게시글은 건드리지 않는다. 같은 날 확정된 정책이다.
 *    조회 query 들이 이미 users.deleted_at 으로 걸러 작성자 이름을 null 로
 *    내려주고 있어(queries/community.ts · groups.ts) 화면은 대응돼 있다.
 *    여기서 남의 모임·여행 기록까지 지우면 다른 모임원의 데이터가 깨진다.
 *
 * ⚠️ 세션 삭제는 여기서 하지 않는다. 화면이 signOut() 을 따로 부른다.
 *    DB 갱신이 실패했는데 로그아웃만 되는 순서를 만들지 않기 위해서다.
 */
export async function withdrawUser(userId: string): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', userId)
    .is('deleted_at', null);

  if (error) throw error;
}
