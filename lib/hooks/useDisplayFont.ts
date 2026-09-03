// ============================================================================
// 디스플레이 폰트(Bebas Neue) 로더
//
// 수하물 태그의 영문 도시명·공항 코드에 쓰는 콘덴스드 폰트다. (시안 v4)
// 시스템 폰트로는 글자가 넓어져 긴 도시명이 두 줄로 넘어가고,
// 공항 코드 배지 안이 글자로 꽉 차지 않는다.
//
// ⚠️ 루트 레이아웃에서 앱 시작을 막지 않는다.
//    폰트 하나 때문에 첫 화면 전체가 늦게 뜨면 손해가 더 크다.
//    로드 전에는 폴백 스타일로 그리고, 로드되면 그때 바뀐다.
//
// ⚠️ expo-font 가 내부에서 캐시하므로 여러 컴포넌트가 불러도 한 번만 받는다.
// ============================================================================
import { BebasNeue_400Regular, useFonts } from "@expo-google-fonts/bebas-neue";
import { Platform } from "react-native";

export const DISPLAY_FONT = "BebasNeue_400Regular";

/**
 * 두 플랫폼에 기본 탑재된 콘덴스드 계열.
 *
 * 두 곳에 쓴다.
 *   ① Bebas Neue 를 아직 못 받았을 때의 폴백
 *   ② 굵기가 필요한 숫자. Bebas 는 굵기가 하나뿐이라 큰 금액이 얇아 보인다.
 *      이쪽은 굵기를 줄 수 있어 콘덴스드이면서도 무게가 남는다.
 */
export const CONDENSED_FONT = Platform.select({
  ios: "AvenirNextCondensed-Bold",
  android: "sans-serif-condensed",
  default: undefined,
});

/** 실제로 적용할 fontFamily 를 돌려준다. 로드 전에는 폴백이다. */
export function useDisplayFont(): { fontFamily: string | undefined; loaded: boolean } {
  const [loaded] = useFonts({ BebasNeue_400Regular });
  return { fontFamily: loaded ? DISPLAY_FONT : CONDENSED_FONT, loaded };
}
