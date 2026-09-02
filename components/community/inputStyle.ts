import type { TextStyle } from 'react-native';

/**
 * 웹에서 입력창을 누르면 생기는 파란 테두리를 없앤다.
 *
 * 브라우저가 focus 에 기본으로 그리는 outline 이다. iOS·안드로이드 앱에는
 * 없는 속성이라 화면에 아무 영향이 없다. 웹으로 확인할 때만 보이는 차이다.
 *
 * ⚠️ outlineStyle 은 react-native-web 전용이라 RN 타입에 없다. 그래서 캐스팅한다.
 *    타입만 우회하는 것이고 실제 값은 웹에서 그대로 쓰인다.
 */
export const NO_FOCUS_RING = { outlineStyle: 'none' } as unknown as TextStyle;
