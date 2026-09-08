// ============================================================================
// 커뮤니티 게시글 사진 Storage
// 기준 문서: docs/05_ERD_v6.md §6-7
//            supabase/migrations/20260904000002_community_images_storage.sql
//
// 파일은 Storage 에, 파일의 위치는 community_posts.image_urls 에 둔다.
// 이 파일은 Storage 쪽만 다룬다. DB 갱신은 queries/community.ts 가 한다.
//
// ⚠️ 경로에 post_id 를 넣지 않는다. 새 글은 저장되기 전에 post_id 가 없다.
//    사용자는 사진을 고르고 미리보기를 본 뒤 게시하므로 업로드가 글 저장보다
//    앞선다. 경로 규칙은 {user_id}/{파일명}.jpg 다. (마이그레이션 주석과 같은 판단)
//
// ⚠️ 이 파일은 storage/profileImage.ts 와 구조가 같고 base64 디코더도 같은
//    코드다. 합치지 않았다 — profileImage.ts 는 마이페이지 담당 영역이라
//    이 작업에서 건드리지 않는다. (CLAUDE.md 13장 파일 소유 규칙)
//    로그인 연동으로 두 곳을 함께 손볼 때 하나로 합치는 편이 낫다.
// ============================================================================
import { supabase } from '@/lib/supabase/client';

const BUCKET = 'community-images';

/** bucket 정책과 같은 값. 넘으면 어차피 거부되므로 앱에서 먼저 막고 안내한다. */
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * ⚠️ 항상 jpg 로 올린다. preparePostImage 가 JPEG 로 저장하기 때문이다.
 *    경로 규칙의 `.jpg` 와도 맞는다.
 */
const CONTENT_TYPE = 'image/jpeg';
const EXT = 'jpg';

/** 파일이 커서 올리지 못한 경우. 화면이 이 경우만 다른 문구를 쓴다. */
export class PostImageTooLargeError extends Error {
  constructor(public readonly bytes: number) {
    super(`이미지가 너무 큽니다: ${bytes} bytes`);
    this.name = 'PostImageTooLargeError';
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
 * 파일 이름.
 *
 * ⚠️ 고정하지 않는다. 경로가 그대로면 사진을 바꿔도 URL 이 같아
 *    브라우저·CDN 캐시 때문에 예전 사진이 계속 보인다.
 *    (crypto.randomUUID 가 Hermes 에 없어 시각 + 난수로 만든다)
 */
function newFileName(): string {
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `${stamp}-${rand}.${EXT}`;
}

/**
 * 사진 한 장을 올리고 **public URL 전체**를 돌려준다.
 *
 * 이 URL 을 그대로 community_posts.image_urls 에 넣는다.
 */
export async function uploadPostImage(userId: string, base64: string): Promise<string> {
  const body = base64ToArrayBuffer(base64);

  // 원본 파일 크기가 아니라 **실제로 올릴 바이트**로 잰다.
  // 크기 조정·품질 조정을 거친 뒤라 원본 크기와 다르다.
  if (body.byteLength > MAX_BYTES) {
    throw new PostImageTooLargeError(body.byteLength);
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
 * 우리 bucket 의 URL 이 아니면 null 이다. (외부 URL·예전 데이터)
 */
export function toPostImagePath(publicUrl: string): string | null {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const at = publicUrl.indexOf(marker);
  if (at === -1) return null;

  const path = publicUrl.slice(at + marker.length);
  return path.length > 0 ? decodeURIComponent(path) : null;
}

/**
 * 글에서 빠진 사진 파일들을 지운다.
 *
 * ⚠️ **DB 갱신이 성공한 뒤에** 부른다. 먼저 지우면 저장이 실패했을 때
 *    글에는 URL 이 남아 있는데 파일이 없는 상태가 된다.
 *
 * ⚠️ 실패해도 던지지 않는다. 파일이 남는 것은 사용자가 겪는 문제가 아니다.
 *    여기서 던지면 이미 성공한 글 수정이 실패로 보인다.
 *    (남은 파일 청소는 [Future] — 배포 전 정책과 함께 정한다)
 */
export async function deletePostImages(publicUrls: string[]): Promise<void> {
  const paths = publicUrls
    .map(toPostImagePath)
    .filter((path): path is string => path !== null);

  if (paths.length === 0) return;

  await supabase.storage.from(BUCKET).remove(paths);
}
