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
import { NOTIFICATION_TYPE, type NotificationType } from '@/lib/constants/status';
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
  'id' | 'name' | 'profile_image_url' | 'auth_provider'
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
    .select('id, name, profile_image_url, auth_provider')
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
