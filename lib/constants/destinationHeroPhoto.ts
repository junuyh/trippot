// ============================================================================
// 신규 사용자 홈 추천 배너 전용 사진 (2026-09-07)
//
// ⚠️ **destinationPhoto.ts 와 목적이 다르다. 그래서 파일을 나눴다.**
//
//    destinationPhoto      "이건 내 도쿄 여행이다" 를 알아보게 하는 사진.
//                          여행 카드·커뮤니티 표지가 쓴다. 알아보기만 하면 된다.
//    destinationHeroPhoto  "여기 가고 싶다" 를 만들어야 하는 사진. (이 파일)
//                          신규 사용자 홈 배너 하나만 쓴다. 광고다.
//
//    그래서 destinationPhoto 를 고치지 않았다. 그 파일을 바꾸면 여행 카드와
//    커뮤니티 표지까지 같이 바뀐다. 담당도 다르다. (CLAUDE.md 13장)
//
// ⚠️ **한 장씩 눈으로 보고 골랐다. 세 가지를 봤다.**
//    ① 그 도시가 맞는가 — 검색 결과에는 엉뚱한 파일(PDF·다른 도시)이 섞여 온다.
//    ② 광고로 쓸 만한가 — 기존 destinationPhoto 의 세부 사진은 폭풍우 하늘에
//       모르는 사람이 걸어가는 기록 사진이었다. 그런 사진은 "가고 싶다" 를
//       만들지 못한다. **야경·노을 위주로 골랐다.** 조명이 켜진 시간대는
//       날씨가 흐려도 색이 살아 있다.
//    ③ 가로 비율 1.2~1.9 — 카드가 343:300(≈1.14)이다. 파노라마(3.0)는 좌우가
//       잘려 랜드마크가 사라지고, 세로 사진은 위아래가 잘린다.
//       기존 destinationPhoto 에는 3.07(상하이)·0.67(파리) 같은 것이 있다.
//
// ⚠️ **이 서비스가 다루는 8개국이 모두 한 곳씩 들어 있다.**
//    목적지가 늘면 여기도 채워야 배너에 나온다. 없으면 그 나라는 배너에서
//    빠진다 — 억지로 아무 사진이나 채우면 이 파일을 만든 이유가 없어진다.
//
// ⚠️ **전부 CC 라이선스이고 표시 의무가 있다. [Release Blocker]**
//    아직 출처를 보여주는 화면이 없다. destinationPhoto 도 같은 상태다
//    ("지금은 쓰는 화면이 없다"). 배포 전에 한 곳에 모아 표시해야 한다.
//    광고성으로 쓰는 만큼 이 파일 쪽이 더 급하다.
// ============================================================================
import { DESTINATION_CODE, type DestinationCode } from './destinations';

export type HeroPhoto = {
  /** upload.wikimedia.org 가 실제로 파일을 주는 호스트다. thumb. 은 쓰지 않는다. */
  url: string;
  /** 무엇을 찍은 사진인가. 출처 표시와 나중 검수에 쓴다. */
  caption: string;
  author: string;
  license: string;
  sourcePage: string;
  /** 가로÷세로. 카드(≈1.14)와 얼마나 차이 나는지 판단하려고 적어 둔다. */
  ratio: number;
};

const HERO_PHOTOS: Partial<Record<DestinationCode, HeroPhoto>> = {
  // ── 일본 ──
  [DESTINATION_CODE.TOKYO]: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Tokyo_-_Sunset_Skyline.jpg/1280px-Tokyo_-_Sunset_Skyline.jpg',
    caption: '노을 진 도쿄 — 후지산 실루엣과 스카이트리',
    author: 'Fred Cherrygarden',
    license: 'CC BY-SA 4.0',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Tokyo_-_Sunset_Skyline.jpg',
    ratio: 1.5,
  },

  // ── 중국 ──
  [DESTINATION_CODE.SHANGHAI]: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/Shanghai_Skyline_from_a_tour_boat_%28Pudong%29.jpg/1280px-Shanghai_Skyline_from_a_tour_boat_%28Pudong%29.jpg',
    caption: '상하이 야경 — 동방명주와 푸둥 스카이라인',
    author: 'Peter K Burian',
    license: 'CC BY-SA 4.0',
    sourcePage:
      'https://commons.wikimedia.org/wiki/File:Shanghai_Skyline_from_a_tour_boat_(Pudong).jpg',
    ratio: 1.57,
  },

  // ── 대만 ──
  [DESTINATION_CODE.TAIPEI]: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Taipei_Night_Skyline_from_Hongludi_20240113.jpg/1280px-Taipei_Night_Skyline_from_Hongludi_20240113.jpg',
    caption: '타이베이 야경 — 101 타워',
    author: 'xiangyang17',
    license: 'CC BY-SA 2.0',
    sourcePage:
      'https://commons.wikimedia.org/wiki/File:Taipei_Night_Skyline_from_Hongludi_20240113.jpg',
    ratio: 1.5,
  },

  // ── 홍콩 ──
  [DESTINATION_CODE.HONG_KONG]: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Hong_Kong_Harbour_Night_2019-06-11.jpg/1280px-Hong_Kong_Harbour_Night_2019-06-11.jpg',
    caption: '홍콩 야경 — 빅토리아 피크에서 본 항구',
    author: 'Benh LIEU SONG',
    license: 'CC BY-SA 4.0',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Hong_Kong_Harbour_Night_2019-06-11.jpg',
    // ⚠️ 여덟 곳 중 이 한 장만 1.9 를 넘는다. 가운데에 항구와 스카이라인이
    //    다 들어 있어 잘려도 홍콩으로 읽혀서 예외로 넣었다.
    ratio: 2.12,
  },

  // ── 프랑스 ──
  [DESTINATION_CODE.PARIS]: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/64/Paris%2C_view_from_Trocadero_at_night%2C_2010.jpg/1280px-Paris%2C_view_from_Trocadero_at_night%2C_2010.jpg',
    caption: '트로카데로에서 본 에펠탑 — 푸른 시간',
    author: 'Moyan Brenn',
    license: 'CC BY 2.0',
    sourcePage:
      'https://commons.wikimedia.org/wiki/File:Paris,_view_from_Trocadero_at_night,_2010.jpg',
    ratio: 1.64,
  },

  // ── 이탈리아 ──
  [DESTINATION_CODE.ROME]: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/Colosseum_by_blue_hour%2C_Rome%2C_Italy1.jpg/1280px-Colosseum_by_blue_hour%2C_Rome%2C_Italy1.jpg',
    caption: '푸른 시간의 콜로세움',
    author: 'Christoph Strässler',
    license: 'CC BY-SA 2.0',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Colosseum_by_blue_hour,_Rome,_Italy1.jpg',
    ratio: 1.78,
  },

  // ── 필리핀 ──
  [DESTINATION_CODE.CEBU]: {
    // ⚠️ 이 한 장만 썸네일이 아니라 원본이다. 원본이 이미 작아서
    //    /thumb/.../1280px- 경로가 없다. 용량은 다른 것과 비슷하다.
    url: 'https://upload.wikimedia.org/wikipedia/commons/1/1e/Kawasan_Falls%2C_Cebu%2C_Philippines1.jpg',
    caption: '세부 카와산 폭포 — 에메랄드빛 물과 대나무 뗏목',
    author: 'Andrewhaimerl',
    license: 'CC BY 4.0',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Kawasan_Falls,_Cebu,_Philippines1.jpg',
    ratio: 1.51,
  },

  // ── 베트남 ──
  [DESTINATION_CODE.DA_NANG]: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/27/Da_Nang_Dragon_Bridge_%28II%29.jpg/1280px-Da_Nang_Dragon_Bridge_%28II%29.jpg',
    caption: '다낭 용다리 야경 — 강에 비친 조명',
    author: 'Supanut Arunoprayote',
    license: 'CC BY 4.0',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Da_Nang_Dragon_Bridge_(II).jpg',
    ratio: 1.78,
  },
};

/**
 * 광고용 사진을 찾는다.
 *
 * ⚠️ 없으면 null 이고, **쓰는 쪽은 그 목적지를 배너에서 뺀다.**
 *    destinationPhoto 로 넘어가지 않는다. 기록 사진 한 장이 섞이는 순간
 *    그 칸에서 광고가 끊긴다.
 */
export function destinationHeroPhoto(code: DestinationCode | null | undefined): HeroPhoto | null {
  if (!code) return null;
  return HERO_PHOTOS[code] ?? null;
}

/** 출처 표시 화면을 만들 때 쓸 전체 목록. (아직 그 화면이 없다 — 위 Release Blocker) */
export const HERO_PHOTO_CREDITS: readonly HeroPhoto[] = Object.values(HERO_PHOTOS);
