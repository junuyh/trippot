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
//    커뮤니티 표지까지 같이 바뀌고 담당도 다르다. (CLAUDE.md 13장)
//
// ⚠️ **원격 URL 이 아니라 앱에 넣은 파일이다.** (2026-09-08 교체)
//    전에는 위키미디어 URL 을 그대로 불러왔다. 사람이 직접 고른 사진으로
//    바꾸면서 assets/destinations/ 에 넣었다. 광고 배너라 네트워크가 느리거나
//    끊겨도 반드시 떠야 한다. 원본은 긴 변 1280px · 품질 82 로 줄여 넣었다
//    (13장 합계 3.3MB). 카드 폭이 343pt 라 3배 화면에서도 충분하다.
//
// ⚠️ **주소는 require 한 결과에서 뽑는다.**
//    DestinationBanner 가 photoUrl 을 문자열로 받기 때문이다. 그 컴포넌트는
//    준비 중인 여행 카드도 함께 쓰므로 건드리지 않는다.
//
//    ⚠️ react-native 의 Image.resolveAssetSource 를 쓰면 안 된다.
//       **웹(react-native-web)에는 그 함수가 없다.** 앱이 시작하자마자
//       "Image.default.resolveAssetSource is not a function" 으로 죽는다.
//       expo-asset 의 Asset.fromModule 은 웹·네이티브 양쪽에서 동작한다.
//
// ⚠️ **[Release Blocker] 사진 출처와 라이선스가 기록돼 있지 않다.**
//    전 버전은 위키미디어라 저작자·라이선스를 함께 적어 뒀는데, 이번 사진들은
//    받은 파일이라 출처를 알 수 없다. 상업적 사용이 가능한 사진인지 확인하고
//    여기에 적어야 한다. 광고성으로 쓰는 자리라 더 급하다.
// ============================================================================
import { Asset } from 'expo-asset';

import { DESTINATION_CODE, type DestinationCode } from './destinations';

export type HeroPhoto = {
  /** 번들에 들어간 파일의 주소. */
  url: string;
  /** 무엇을 찍은 사진인가. 검수·출처 표시에 쓴다. */
  caption: string;
  /**
   * 가로÷세로. 파일에서 읽어 자동으로 채운다.
   *
   * 카드가 343:300(≈1.14)이라 이 값이 크게 벗어나면 잘림이 심하다.
   * 손으로 적지 않는다 — 사진을 바꿨는데 숫자만 남으면 거짓말이 된다.
   */
  ratio: number;
};

/** require 한 이미지에서 주소와 비율을 뽑는다. */
function fromAsset(mod: number, caption: string): HeroPhoto {
  const asset = Asset.fromModule(mod);
  // width·height 는 플랫폼에 따라 null 로 올 수 있다. 그때는 카드 비율로 둔다.
  const usable = asset.width != null && asset.height != null && asset.height > 0;
  return {
    url: asset.uri,
    caption,
    ratio: usable ? asset.width! / asset.height! : 1,
  };
}

const HERO_PHOTOS: Partial<Record<DestinationCode, HeroPhoto>> = {
  // ── 일본 ──
  [DESTINATION_CODE.TOKYO]: fromAsset(
    require('@/assets/destinations/tokyo.jpg'),
    '시부야 스크램블 교차로',
  ),
  [DESTINATION_CODE.OSAKA]: fromAsset(
    require('@/assets/destinations/osaka.jpg'),
    '도톤보리 야경 — 네온사인 거리',
  ),
  [DESTINATION_CODE.FUKUOKA]: fromAsset(
    require('@/assets/destinations/fukuoka.jpg'),
    '나카스 강변 야경',
  ),

  // ── 중국 ──
  [DESTINATION_CODE.SHANGHAI]: fromAsset(
    require('@/assets/destinations/shanghai.jpg'),
    '와이탄에서 본 푸둥 스카이라인',
  ),

  // ── 대만 ──
  [DESTINATION_CODE.TAIPEI]: fromAsset(
    require('@/assets/destinations/taipei.jpg'),
    '타이베이 101 야경',
  ),

  // ── 홍콩 ──
  [DESTINATION_CODE.HONG_KONG]: fromAsset(
    require('@/assets/destinations/hongkong.jpg'),
    '빅토리아 하버 야경',
  ),

  // ── 프랑스 ──
  [DESTINATION_CODE.PARIS]: fromAsset(
    require('@/assets/destinations/paris.jpg'),
    '센강과 에펠탑',
  ),
  [DESTINATION_CODE.NICE]: fromAsset(
    require('@/assets/destinations/nice.jpg'),
    '코트다쥐르 해안선',
  ),

  // ── 이탈리아 ──
  [DESTINATION_CODE.ROME]: fromAsset(
    require('@/assets/destinations/rome.jpg'),
    '푸른 시간의 콜로세움',
  ),
  [DESTINATION_CODE.MILAN]: fromAsset(
    require('@/assets/destinations/milan.jpg'),
    '노을 진 밀라노 두오모 광장',
  ),
  [DESTINATION_CODE.VENICE]: fromAsset(
    require('@/assets/destinations/venice.jpg'),
    '대운하와 곤돌라',
  ),

  // ── 필리핀 ──
  [DESTINATION_CODE.CEBU]: fromAsset(
    require('@/assets/destinations/cebu.jpg'),
    '에메랄드빛 바다와 화이트 비치',
  ),

  // ── 베트남 ──
  [DESTINATION_CODE.DA_NANG]: fromAsset(
    require('@/assets/destinations/danang.jpg'),
    '용다리와 해안 야경',
  ),
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
