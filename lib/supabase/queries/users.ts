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
import { supabase } from '@/lib/supabase/client';
import type { Tables } from '@/types/database';

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
