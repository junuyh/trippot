// ============================================================================
// 트래블 스토리 엽서 그림 등록표 (2026-09-18)
//
// '여행자들은 이렇게 다녀왔어요' 카드 오른쪽에 들어가는 **엽서 한 장짜리 그림**이다.
// 스탬프 · 도시 이름 · 소인선까지 그림 안에 이미 들어 있어서, 카드는 이 그림을
// 그대로 얹기만 한다. (TravelStoryCard 가 그리던 엽서 · 태그 · 스탬프를 대신한다)
//
// ⚠️ 키는 목적지 코드다. (lib/constants/destinations 의 DestinationCode)
//    등록하지 않은 도시(사용자가 직접 입력한 여행지)는 null 이고,
//    카드가 예전처럼 직접 그린 엽서 · 수하물 태그를 쓴다.
//
// ⚠️ 원본은 1122×1402 이고 앱에는 **가로 420px 로 줄여** 넣었다. 카드에서 보이는 크기가
//    130pt 안팎이라 이 정도면 충분하다. 원본 그대로 넣으면 12장에 20MB 가 넘는다.
//    그림을 새로 받으면 같은 크기로 줄여서 넣는다.
//
// ⚠️ require 는 정적 경로만 쓴다. Metro 가 번들에 넣을 파일을 빌드 시점에 정해야 해서
//    `require('...' + code)` 같은 조립은 동작하지 않는다.
// ============================================================================
import type { ImageSourcePropType } from 'react-native';

const PHOTOS: Record<string, ImageSourcePropType> = {
  cebu: require('@/assets/travel-story/cebu.png'),
  da_nang: require('@/assets/travel-story/da_nang.png'),
  fukuoka: require('@/assets/travel-story/fukuoka.png'),
  hong_kong: require('@/assets/travel-story/hong_kong.png'),
  milan: require('@/assets/travel-story/milan.png'),
  nice: require('@/assets/travel-story/nice.png'),
  osaka: require('@/assets/travel-story/osaka.png'),
  // ⚠️ 파리만 원본 비율이 다르다(1199×1312, 다른 도시는 1122×1402).
  //    카드가 resizeMode='contain' 이라 잘리지 않고 맞춰 들어간다.
  paris: require('@/assets/travel-story/paris.png'),
  rome: require('@/assets/travel-story/rome.png'),
  shanghai: require('@/assets/travel-story/shanghai.png'),
  taipei: require('@/assets/travel-story/taipei.png'),
  tokyo: require('@/assets/travel-story/tokyo.png'),
  venice: require('@/assets/travel-story/venice.png'),
};

/** 목적지 코드로 엽서 그림을 찾는다. 없으면 null — 카드가 직접 그린 엽서를 쓴다. */
export function travelStoryPhoto(code: string): ImageSourcePropType | null {
  return PHOTOS[code] ?? null;
}
