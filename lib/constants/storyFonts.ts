// ============================================================================
// 여행 기록 스토리 이미지에서 고를 수 있는 폰트 (2026-09-08)
//
// 인스타그램 스토리의 글꼴 고르기처럼 도시명·멤버 이름의 글꼴을 바꾼다.
// 전부 Google Fonts 의 OFL(SIL Open Font License) 폰트라 상업 서비스에 써도 된다.
// 패키지는 @expo-google-fonts/* 이고, 로딩은 lib/hooks/useStoryFonts 가 한다.
//
// ⚠️ 한글 이름이 들어가므로 한글 폰트를 반드시 섞는다. 영문 전용 폰트는 한글을
//    시스템 폰트로 떨어뜨려서 도시명(영문)과 이름(한글)이 다른 글꼴이 된다.
//    그래서 각 폰트에 hangul 을 적어 두고, 고르는 화면에서 표시해 준다.
//
// ⚠️ 커스텀 폰트에는 fontWeight · fontStyle 을 주지 않는다. iOS 는 그 굵기가 없는
//    폰트에 fontWeight 를 주면 시스템 폰트로 되돌아간다. 굵기는 파일 이름에 있다.
//
// 목록에 추가하려면: pnpm add @expo-google-fonts/<name> → 여기 한 줄 →
// useStoryFonts 의 로딩 맵에 한 줄.
// ============================================================================

export type StoryFont = {
  id: string;
  /** 고르기 칩에 보여줄 이름 */
  label: string;
  /** fontFamily 로 넘길 값. undefined 면 시스템 폰트(굵은 이탤릭) */
  family: string | undefined;
  /** 한글 글리프가 있는가 */
  hangul: boolean;
};

export const STORY_FONTS: readonly StoryFont[] = [
  { id: 'system', label: '기본', family: undefined, hangul: true },
  // ── 영문 디스플레이 ──
  { id: 'bebas', label: 'Bebas', family: 'BebasNeue_400Regular', hangul: false },
  { id: 'anton', label: 'Anton', family: 'Anton_400Regular', hangul: false },
  { id: 'abril', label: 'Abril', family: 'AbrilFatface_400Regular', hangul: false },
  { id: 'playfair', label: 'Playfair', family: 'PlayfairDisplay_700Bold_Italic', hangul: false },
  { id: 'righteous', label: 'Righteous', family: 'Righteous_400Regular', hangul: false },
  // ── 손글씨 ──
  { id: 'pacifico', label: 'Pacifico', family: 'Pacifico_400Regular', hangul: false },
  { id: 'caveat', label: 'Caveat', family: 'Caveat_700Bold', hangul: false },
  { id: 'marker', label: 'Marker', family: 'PermanentMarker_400Regular', hangul: false },
  // ── 한글 ──
  { id: 'blackhan', label: '검은고딕', family: 'BlackHanSans_400Regular', hangul: true },
  { id: 'jua', label: '주아', family: 'Jua_400Regular', hangul: true },
  { id: 'nanumpen', label: '나눔펜', family: 'NanumPenScript_400Regular', hangul: true },
  { id: 'gaegu', label: '개구', family: 'Gaegu_700Bold', hangul: true },
];

export const DEFAULT_STORY_FONT_ID = 'system';

export function storyFont(id: string): StoryFont {
  return STORY_FONTS.find((font) => font.id === id) ?? STORY_FONTS[0];
}
