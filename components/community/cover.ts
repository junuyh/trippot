// ============================================================================
// 커버 사진 [임시]
//
// ⚠️ **더미다.** 사진을 담을 스키마가 아직 없어서
//    글 id 로 고정된 외부 placeholder 주소를 만들어 쓴다.
//    같은 글은 항상 같은 사진이 나온다.
//
// 스키마가 생기면 이 파일을 지운다.
//   1. 이 파일 삭제
//   2. grep -rn "toCoverUrls" components/ app/ 로 호출부를 찾는다
//   3. toCoverUrls(post.postId) → post.imageUrls 로 바꾼다
//
// 관련 요청: post_images 테이블(또는 text[] 컬럼) + Storage 'community' 버킷 (DB 담당)
// ============================================================================

/** 글 id 에서 만든 고정 사진 수(1~3장). 글마다 장수가 달라 보이게 한다. */
function countFor(postId: string): number {
  let sum = 0;
  for (let i = 0; i < postId.length; i += 1) sum += postId.charCodeAt(i);
  return (sum % 3) + 1;
}

/** 글 id 로 고정된 더미 사진 주소 목록. */
export function toCoverUrls(postId: string): string[] {
  return Array.from(
    { length: countFor(postId) },
    (_, i) => `https://picsum.photos/seed/${postId}-${i}/900/600`,
  );
}
