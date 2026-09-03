// ============================================================================
// 프로필 이미지 Storage
// 기준 문서: docs/05_ERD_v5.md §6-6
//
// 파일은 Storage 에, 파일의 위치는 users.profile_image_url 에 둔다.
// 이 파일은 Storage 쪽만 다룬다. DB 갱신은 queries/users.ts 가 한다.
//
// ⚠️ 경로 규칙 {user_id}/{uuid}.jpg 는 **앱이 지키는 규약이고 DB 강제가 아니다.**
//    현재 Storage 정책은 bucket_id 만 보고 경로를 보지 않는다.
//    (실서비스 정책은 경로 첫 폴더가 본인 uid 인지 본다 — 05_ERD_v5 §6-6-4)
// ============================================================================
import { supabase } from '@/lib/supabase/client';

const BUCKET = 'profile-images';

/** bucket 정책과 같은 값. 넘으면 어차피 거부되므로 앱에서 먼저 막고 안내한다. */
const MAX_BYTES = 2 * 1024 * 1024;

/**
 * ⚠️ 항상 jpg 로 올린다.
 *    expo-image-picker 의 base64 는 **JPEG 데이터**다. (라이브러리 문서 명시)
 *    allowsEditing 으로 잘라내면서 다시 인코딩되기 때문이다.
 *    경로 규칙의 `.jpg` 와도 맞는다.
 */
const CONTENT_TYPE = 'image/jpeg';
const EXT = 'jpg';

/** 파일이 커서 올리지 못한 경우. 화면이 이 경우만 다른 문구를 쓴다. */
export class ProfileImageTooLargeError extends Error {
  constructor(public readonly bytes: number) {
    super(`이미지가 너무 큽니다: ${bytes} bytes`);
    this.name = 'ProfileImageTooLargeError';
  }
}

// ── base64 → 바이트 ─────────────────────────────────────────────────────────
//
// ⚠️ base64 문자열을 그대로 올리면 텍스트로 저장된다. 바이트로 바꿔야 한다.
//    RN 에는 Buffer 가 없고 fetch(uri).blob() 은 크기가 0 으로 오는 일이 있어
//    직접 디코딩한다. 새 패키지를 넣지 않으려고 표를 만들어 쓴다.

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const B64_LOOKUP = (() => {
  const table = new Int8Array(128).fill(-1);
  for (let i = 0; i < B64_CHARS.length; i += 1) {
    table[B64_CHARS.charCodeAt(i)] = i;
  }
  return table;
})();

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  // 개행·패딩을 걷어낸다. 패딩은 길이 계산으로 대신한다.
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const remainder = clean.length % 4;
  const byteLength =
    ((clean.length - remainder) / 4) * 3 + (remainder === 2 ? 1 : remainder === 3 ? 2 : 0);

  const bytes = new Uint8Array(byteLength);
  let out = 0;

  for (let i = 0; i < clean.length; i += 4) {
    const c0 = B64_LOOKUP[clean.charCodeAt(i)];
    const c1 = B64_LOOKUP[clean.charCodeAt(i + 1)];
    const c2 = i + 2 < clean.length ? B64_LOOKUP[clean.charCodeAt(i + 2)] : -1;
    const c3 = i + 3 < clean.length ? B64_LOOKUP[clean.charCodeAt(i + 3)] : -1;

    if (out < byteLength) bytes[out++] = (c0 << 2) | (c1 >> 4);
    if (c2 >= 0 && out < byteLength) bytes[out++] = ((c1 & 15) << 4) | (c2 >> 2);
    if (c3 >= 0 && out < byteLength) bytes[out++] = ((c2 & 3) << 6) | c3;
  }

  return bytes.buffer;
}

/**
 * 파일 이름. 사용자 폴더 안에서만 겹치지 않으면 된다.
 *
 * ⚠️ profile.jpg 처럼 고정하지 않는다. 경로가 그대로면 사진을 바꿔도 URL 이 같아
 *    브라우저·CDN 캐시 때문에 예전 사진이 계속 보인다.
 *    (crypto.randomUUID 가 Hermes 에 없어 시각 + 난수로 만든다)
 */
function newFileName(): string {
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `${stamp}-${rand}.${EXT}`;
}

/**
 * 프로필 이미지를 올리고 **public URL 전체**를 돌려준다.
 *
 * 이 URL 을 그대로 users.profile_image_url 에 넣는다. (05_ERD_v5 §3 users)
 */
export async function uploadProfileImage(userId: string, base64: string): Promise<string> {
  const body = base64ToArrayBuffer(base64);

  // 원본 파일 크기가 아니라 **실제로 올릴 바이트**로 잰다.
  // 자르기·품질 조정을 거친 뒤라 원본 크기와 다르다.
  if (body.byteLength > MAX_BYTES) {
    throw new ProfileImageTooLargeError(body.byteLength);
  }

  const path = `${userId}/${newFileName()}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, body, {
    contentType: CONTENT_TYPE,
    // 파일 이름이 매번 달라 덮어쓸 일이 없다. 겹치면 오히려 알아야 한다.
    upsert: false,
  });
  if (error) throw error;

  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/**
 * public URL 에서 bucket 안의 경로를 되뽑는다.
 * 우리 bucket 의 URL 이 아니면 null 이다. (예전 데이터·외부 URL)
 */
export function toProfileImagePath(publicUrl: string | null): string | null {
  if (!publicUrl) return null;

  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const at = publicUrl.indexOf(marker);
  if (at === -1) return null;

  const path = publicUrl.slice(at + marker.length);
  return path.length > 0 ? decodeURIComponent(path) : null;
}

/**
 * 이전 프로필 이미지를 지운다.
 *
 * ⚠️ **새 이미지 업로드와 DB 갱신이 모두 성공한 뒤에** 부른다.
 *    먼저 지우면 중간에 실패했을 때 사진이 사라진다.
 *
 * 우리 bucket 의 URL 이 아니면 아무것도 하지 않는다.
 */
export async function deleteProfileImage(publicUrl: string | null): Promise<void> {
  const path = toProfileImagePath(publicUrl);
  if (!path) return;

  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}
