// ============================================================================
// 스토리 이미지용 폰트 로더 (lib/constants/storyFonts 와 짝)
//
// ⚠️ 앱 시작 때 부르지 않는다. 열 개 넘는 폰트를 첫 화면에서 받으면 손해다.
//    스토리 시트가 열릴 때 그 안에서만 부른다. expo-font 가 캐시하므로
//    두 번째부터는 바로 끝난다.
//
// ⚠️ 로드 전에도 시트는 뜬다. 아직 안 받은 폰트는 시스템 폰트로 그려지고,
//    받아지면 그때 바뀐다. (useDisplayFont 와 같은 원칙)
// ============================================================================
import { AbrilFatface_400Regular } from '@expo-google-fonts/abril-fatface';
import { Anton_400Regular } from '@expo-google-fonts/anton';
import { BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue';
import { BlackHanSans_400Regular } from '@expo-google-fonts/black-han-sans';
import { Caveat_700Bold } from '@expo-google-fonts/caveat';
import { Gaegu_700Bold } from '@expo-google-fonts/gaegu';
import { Jua_400Regular } from '@expo-google-fonts/jua';
import { NanumPenScript_400Regular } from '@expo-google-fonts/nanum-pen-script';
import { Pacifico_400Regular } from '@expo-google-fonts/pacifico';
import { PermanentMarker_400Regular } from '@expo-google-fonts/permanent-marker';
import { PlayfairDisplay_700Bold_Italic } from '@expo-google-fonts/playfair-display';
import { Righteous_400Regular } from '@expo-google-fonts/righteous';
import { useFonts } from 'expo-font';

/** 전부 받아졌는지. 개별 폰트가 아직이면 시스템 폰트로 그려진다 */
export function useStoryFonts(): boolean {
  const [loaded] = useFonts({
    BebasNeue_400Regular,
    Anton_400Regular,
    AbrilFatface_400Regular,
    PlayfairDisplay_700Bold_Italic,
    Righteous_400Regular,
    Pacifico_400Regular,
    Caveat_700Bold,
    PermanentMarker_400Regular,
    BlackHanSans_400Regular,
    Jua_400Regular,
    NanumPenScript_400Regular,
    Gaegu_700Bold,
  });
  return loaded;
}
