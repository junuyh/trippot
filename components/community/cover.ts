// ============================================================================
// 커버 사진 [임시]
//
// ⚠️ **더미다.** 사진을 담을 스키마가 아직 없어서, 글 내용에서 짐작한 주제로
//    외부 placeholder 서비스에서 사진을 받아 온다. 사용자가 올린 사진이 아니다.
//    같은 글은 항상 같은 사진이 나온다 — 글 id 로 lock 값을 만들기 때문이다.
//
// 스키마가 생기면 이 파일을 지운다.
//   1. 이 파일 삭제
//   2. grep -rn "toCoverUrls" components/ app/ 로 호출부를 찾는다
//   3. toCoverUrls(...) → post.imageUrls 로 바꾼다
//
// 관련 요청: post_images 테이블(또는 text[] 컬럼) + Storage 'community' 버킷 (DB 담당)
//
// ⚠️ 위키미디어(upload.wikimedia.org)를 쓰려다 되돌렸다. 앱에서 직접 불러오면
//    429(요청 과다)로 막힌다. 재단이 앱 핫링크를 허용하지 않는다.
//    loremflickr 는 이런 용도로 만들어진 서비스다.
// ============================================================================

/** 주제별 검색어. 글 제목·본문에 아래 낱말이 있으면 그 주제로 본다. */
const TOPICS: { words: string[]; tags: string[] }[] = [
  {
    // 정산 · 예산 · 돈
    words: ['정산', '예산', '지출', '영수증', '금액', '얼마'],
    tags: ['money,cash', 'receipt,bill', 'calculator,budget'],
  },
  {
    // 식비 · 먹거리
    words: ['식비', '먹', '맛집', '음식', '라멘', '스시', '초밥'],
    tags: ['ramen,japan', 'sushi,japanese', 'streetfood,market'],
  },
  {
    // 숙소
    words: ['숙소', '호텔', '숙박', '1실', '트윈', '온천', '료칸'],
    tags: ['hotel,room', 'hotel,bed', 'ryokan,japan'],
  },
  {
    // 교통
    words: ['교통', '지하철', '전철', '패스', '이동', '공항'],
    tags: ['subway,tokyo', 'train,station,japan', 'airport,terminal'],
  },
  {
    // 쇼핑 · 짐
    words: ['쇼핑', '면세', '짐', '캐리어'],
    tags: ['shopping,street', 'suitcase,luggage'],
  },
];

/** 목적지별 검색어. 주제를 못 찾았을 때 쓴다. */
const DESTINATIONS: Record<string, string[]> = {
  도쿄: ['tokyo,shibuya', 'tokyo,street', 'tokyo,skyline'],
  오사카: ['osaka,dotonbori', 'osaka,castle'],
  교토: ['kyoto,temple', 'kyoto,street'],
  후쿠오카: ['fukuoka,japan'],
  삿포로: ['sapporo,japan'],
  파리: ['paris,street', 'paris,eiffel'],
  다낭: ['danang,vietnam', 'vietnam,beach'],
  방콕: ['bangkok,thailand'],
  타이베이: ['taipei,taiwan'],
  홍콩: ['hongkong,skyline'],
  세부: ['cebu,beach'],
};

/** 주제도 목적지도 모를 때. */
const FALLBACK = ['travel,journey', 'airplane,window'];

/** 글 id 를 숫자로. 같은 글은 늘 같은 사진이 되게 하는 기준값이다. */
function seedOf(postId: string): number {
  let sum = 0;
  for (let i = 0; i < postId.length; i += 1) sum += postId.charCodeAt(i);
  return sum;
}

/**
 * 검색어 하나를 사진 주소로.
 *
 * lock 을 주면 같은 검색어라도 늘 같은 사진이 나온다.
 * 이게 없으면 화면을 다시 그릴 때마다 사진이 바뀌어 눈이 어지럽다.
 */
function photoUrl(tag: string, lock: number): string {
  return `https://loremflickr.com/640/480/${tag}?lock=${lock}`;
}

export type CoverInput = {
  postId: string;
  title: string;
  /** 본문. 목록에서는 앞부분만 있어도 된다. */
  content: string | null;
  destination: string | null;
};

/**
 * 글 내용에 어울리는 더미 사진 1~2장.
 *
 * 제목·본문의 낱말로 주제를 먼저 찾고, 없으면 목적지 사진을 쓴다.
 * 주제와 목적지를 둘 다 알면 한 장씩 섞는다 — 같은 주제 글끼리도 달라 보인다.
 */
export function toCoverUrls({ postId, title, content, destination }: CoverInput): string[] {
  const text = `${title} ${content ?? ''}`;
  const seed = seedOf(postId);

  const topic = TOPICS.find((entry) => entry.words.some((word) => text.includes(word)))?.tags;
  const byDestination = destination
    ? Object.entries(DESTINATIONS).find(([name]) => destination.includes(name))?.[1]
    : undefined;

  const pool = topic ?? byDestination ?? FALLBACK;
  const first = photoUrl(pool[seed % pool.length], seed % 50);

  const secondPool = topic && byDestination ? byDestination : pool;
  // 같은 검색어가 두 번 나오면 lock 을 달리해 다른 사진이 되게 한다.
  const second = photoUrl(secondPool[(seed + 1) % secondPool.length], (seed % 50) + 1);

  return [first, second];
}
