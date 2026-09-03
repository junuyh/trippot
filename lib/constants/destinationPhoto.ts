// ============================================================================
// 목적지별 랜드마크 사진 — 홈 여행 카드 배너용 (2026-09-03)
//
// 홈 상단의 진행 중 여행 카드를 사진 배너로 만들면서 추가했다.
// 키는 도시(DestinationCode)다. 국가 테마(countryTheme)와 달리 도쿄·오사카·
// 후쿠오카가 각각 다른 사진을 써야 하기 때문이다.
//
// ⚠️ 원격 URL 이다. 네트워크가 없거나 이미지 로드가 실패하면 사진이 없다.
//    카드는 사진이 없어도 그대로 읽혀야 한다. 쓰는 쪽에서 반드시 대체 화면을
//    그린다. (components/home/DestinationBanner)
//
// ⚠️ 목록에 없는 목적지(직접 입력 등)는 null 이다. 억지로 비슷한 사진을 주지
//    않는다. 엉뚱한 도시 사진이 뜨는 편이 사진이 없는 것보다 나쁘다.
//
// ⚠️ [검토 필요] 라이선스와 호스팅
//    전부 위키미디어 공용(Wikimedia Commons)의 자유 라이선스 사진이다.
//    CC0 / Public domain 은 표시 의무가 없지만 CC BY · CC BY-SA 는 저작자와
//    라이선스를 표시해야 한다. 그래서 URL 만 두지 않고 author / license 를
//    함께 보관한다. 실서비스 전에 두 가지를 사람이 결정해야 한다.
//      1) 앱 어딘가(설정 > 오픈소스·출처)에 출처 목록을 노출할 것인가
//      2) 위키미디어를 직접 호출할 것인가, 이미지를 우리 스토리지로 옮길 것인가
//    MVP 는 화면 확인이 목적이라 원격 URL 을 그대로 쓴다.
//
// URL 은 위키미디어 CDN(upload.wikimedia.org)의 960px 썸네일이다.
// 원본은 수천 픽셀이라 카드 배너에 그대로 쓰면 트래픽만 늘어난다.
// ============================================================================

import { DESTINATION_CODE, type DestinationCode } from './destinations';

export type DestinationPhoto = {
  /** 960px 썸네일 URL. */
  url: string;
  /** 무엇을 찍은 사진인가. 화면 낭독기 설명과 출처 목록에 쓴다. */
  caption: string;
  /** 저작자. CC BY 계열은 표시 의무가 있다. */
  author: string;
  /** 라이선스 이름. */
  license: string;
  /** 출처 파일 문서. 출처 표시할 때 링크로 쓴다. */
  sourcePage: string;
};

const PHOTOS: Record<DestinationCode, DestinationPhoto> = {
  [DESTINATION_CODE.TOKYO]: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Tokyo_Tower%2C_Minato.jpg/960px-Tokyo_Tower%2C_Minato.jpg',
    caption: '도쿄 타워',
    author: 'David Kernan',
    license: 'CC BY 4.0',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Tokyo_Tower,_Minato.jpg',
  },
  [DESTINATION_CODE.OSAKA]: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Osaka_Castle_02bs3200.jpg/960px-Osaka_Castle_02bs3200.jpg',
    caption: '오사카성',
    author: '663highland',
    license: 'CC BY 2.5',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Osaka_Castle_02bs3200.jpg',
  },
  [DESTINATION_CODE.FUKUOKA]: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Fukuoka_in_the_night.jpg/960px-Fukuoka_in_the_night.jpg',
    caption: '후쿠오카 야경',
    author: 'Ningyou',
    license: 'Public domain',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Fukuoka_in_the_night.jpg',
  },
  [DESTINATION_CODE.SHANGHAI]: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/2010_Shanghai_Bund%2C_Viewed_from_Oriental_Pearl_Tower_01.jpg/960px-2010_Shanghai_Bund%2C_Viewed_from_Oriental_Pearl_Tower_01.jpg',
    caption: '상하이 와이탄',
    author: 'Gary Lee Todd',
    license: 'CC0',
    sourcePage:
      'https://commons.wikimedia.org/wiki/File:2010_Shanghai_Bund,_Viewed_from_Oriental_Pearl_Tower_01.jpg',
  },
  [DESTINATION_CODE.TAIPEI]: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/Taipei_city_skyline_20140721.jpg/960px-Taipei_city_skyline_20140721.jpg',
    caption: '타이베이 스카이라인',
    author: 'Wikimedia Commons',
    license: 'CC0',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Taipei_city_skyline_20140721.jpg',
  },
  [DESTINATION_CODE.HONG_KONG]: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/International_Commerce_Centre_on_Victoria_Harbour.jpg/960px-International_Commerce_Centre_on_Victoria_Harbour.jpg',
    caption: '홍콩 빅토리아 하버',
    author: 'Wilfredor',
    license: 'CC0',
    sourcePage:
      'https://commons.wikimedia.org/wiki/File:International_Commerce_Centre_on_Victoria_Harbour.jpg',
  },
  [DESTINATION_CODE.PARIS]: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f0/Eiffel_Tower_as_seen_from_Champ-de-Mars%2C_8_July_2015.jpg/960px-Eiffel_Tower_as_seen_from_Champ-de-Mars%2C_8_July_2015.jpg',
    caption: '파리 에펠탑',
    author: 'Wikimedia Commons',
    license: 'CC0',
    sourcePage:
      'https://commons.wikimedia.org/wiki/File:Eiffel_Tower_as_seen_from_Champ-de-Mars,_8_July_2015.jpg',
  },
  [DESTINATION_CODE.NICE]: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cc/Nizza_Engelsbucht.JPG/960px-Nizza_Engelsbucht.JPG',
    caption: '니스 천사의 만',
    author: 'Wikimedia Commons',
    license: 'CC BY-SA 3.0',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Nizza_Engelsbucht.JPG',
  },
  [DESTINATION_CODE.ROME]: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/Colosseum_of_Rome%2C_Italy.jpg/960px-Colosseum_of_Rome%2C_Italy.jpg',
    caption: '로마 콜로세움',
    author: 'Wilfredor',
    license: 'CC0',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Colosseum_of_Rome,_Italy.jpg',
  },
  [DESTINATION_CODE.MILAN]: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Milano%2C_Duomo_with_Milan_Cathedral_and_Galleria_Vittorio_Emanuele_II%2C_2016.jpg/960px-Milano%2C_Duomo_with_Milan_Cathedral_and_Galleria_Vittorio_Emanuele_II%2C_2016.jpg',
    caption: '밀라노 두오모',
    author: 'Steffen Schmitz',
    license: 'CC BY-SA 4.0',
    sourcePage:
      'https://commons.wikimedia.org/wiki/File:Milano,_Duomo_with_Milan_Cathedral_and_Galleria_Vittorio_Emanuele_II,_2016.jpg',
  },
  [DESTINATION_CODE.VENICE]: {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/View_of_the_Grand_Canal_from_Rialto_to_Ca%27Foscari.jpg/960px-View_of_the_Grand_Canal_from_Rialto_to_Ca%27Foscari.jpg",
    caption: '베네치아 대운하',
    author: 'Didier Descouens',
    license: 'CC BY-SA 4.0',
    sourcePage:
      "https://commons.wikimedia.org/wiki/File:View_of_the_Grand_Canal_from_Rialto_to_Ca'Foscari.jpg",
  },
  [DESTINATION_CODE.CEBU]: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/76/Lambug_beach%2C_Badian%2C_Cebu%2C_Philippines_-_Flickr.jpg/960px-Lambug_beach%2C_Badian%2C_Cebu%2C_Philippines_-_Flickr.jpg',
    caption: '세부 람부그 비치',
    author: 'Su--May',
    license: 'CC BY 2.0',
    sourcePage:
      'https://commons.wikimedia.org/wiki/File:Lambug_beach,_Badian,_Cebu,_Philippines_-_Flickr.jpg',
  },
};

/**
 * 목적지 코드로 랜드마크 사진을 찾는다.
 *
 * 목록에 없는 목적지(직접 입력)면 null 이다. 쓰는 쪽이 대체 화면을 그린다.
 */
export function destinationPhoto(
  code: DestinationCode | null | undefined,
): DestinationPhoto | null {
  if (!code) return null;
  return PHOTOS[code] ?? null;
}

/**
 * 출처 표시가 필요할 때 쓸 전체 목록.
 * 지금은 쓰는 화면이 없다. 라이선스 표시 방식이 정해지면 여기서 가져다 쓴다.
 */
export const DESTINATION_PHOTO_CREDITS: readonly DestinationPhoto[] = Object.values(PHOTOS);
