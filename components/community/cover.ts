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
import { findDestinationByName } from '@/lib/constants/destinations';
import { destinationPhoto } from '@/lib/constants/destinationPhoto';

const TOPICS: { words: string[]; tags: string[] }[] = [
  {
    // 정산 · 예산 · 돈
    words: ['정산', '예산', '지출', '영수증', '금액', '얼마'],
    tags: ['money,cash', 'receipt,bill', 'calculator,budget'],
  },
  {
    // 식비 · 먹거리
    words: ['식비', '먹', '맛집', '음식', '라멘', '스시', '초밥'],
    tags: ['restaurant,table', 'food,plate', 'streetfood,market'],
  },
  {
    // 숙소
    words: ['숙소', '호텔', '숙박', '1실', '트윈', '온천', '료칸'],
    tags: ['hotel,room', 'hotel,bed', 'hotel,lobby'],
  },
  {
    // 교통
    words: ['교통', '지하철', '전철', '패스', '이동', '공항'],
    tags: ['subway,metro', 'train,station', 'airport,terminal'],
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
  파리: ['paris,street', 'paris,eiffel', 'paris,cafe', 'paris,louvre'],
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

/**
 * 목적지별로 확인해 둔 사진. (destinationPhoto.ts)
 *
 * ⚠️ loremflickr 는 태그가 같아도 **무엇이 나올지 모른다.** 파리 태그에
 *    흰옷 입은 사람들 사진이 나오는 식이라, 여행 글 옆에 붙으면 무슨
 *    이야기인지 흐려진다. 목적지를 아는 글은 확인해 둔 사진 한 장을 쓴다.
 *
 * ⚠️ 한 장만 쓴다. 두 장을 채우려고 임의 사진을 한 장 더 붙이면 결국
 *    같은 문제가 생긴다. 좋은 한 장이 애매한 두 장보다 낫다.
 */
function curatedPhoto(destination: string | null): string | null {
  const found = findDestinationByName(destination);
  return found ? (destinationPhoto(found.code)?.url ?? null) : null;
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
 * ⚠️ **목적지를 먼저 본다.** 주제를 먼저 보면, 파리 여행기가 '15만원 아꼈다'
 *    한 줄 때문에 지폐 사진으로 덮인다. 여행 글에서 사람이 먼저 보는 것은
 *    돈이 아니라 어디를 다녀왔는가다.
 *    목적지를 아는 글은 목적지 사진 + 주제 사진을 한 장씩 섞고,
 *    목적지를 모르는 글만 주제 사진 두 장을 쓴다.
 */
export function toCoverUrls({ postId, title, content, destination }: CoverInput): string[] {
  // 확인해 둔 목적지 사진이 있으면 그것 한 장으로 끝낸다
  const curated = curatedPhoto(destination);
  if (curated) return [curated];

  const text = `${title} ${content ?? ''}`;
  const seed = seedOf(postId);

  const topic = TOPICS.find((entry) => entry.words.some((word) => text.includes(word)))?.tags;
  const byDestination = destination
    ? Object.entries(DESTINATIONS).find(([name]) => destination.includes(name))?.[1]
    : undefined;

  const pool = byDestination ?? topic ?? FALLBACK;
  const first = photoUrl(pool[seed % pool.length], seed % 50);

  /*
    ⚠️ 목적지를 알면 **두 장 다 그 도시 사진**을 쓴다. 주제 사진을 한 장
       섞으면 파리 여행기 옆에 지하철 사진이 붙어 어디 이야기인지 흐려진다.
       주제 사진은 목적지를 모르는 글에서만 쓴다.
  */
  const secondPool = pool;
  // 같은 검색어가 두 번 나오면 lock 을 달리해 다른 사진이 되게 한다.
  const second = photoUrl(secondPool[(seed + 1) % secondPool.length], (seed % 50) + 1);

  return [first, second];
}
