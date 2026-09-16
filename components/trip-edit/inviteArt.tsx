// ============================================================================
// '여행 멤버' 카드의 편지 그림 (2026-09-16)
//
// 초대를 글자로만 설명하면 카드가 설정 목록처럼 읽힌다. 비행기가 든 편지 한 장이
// "사람을 부르는 자리" 라고 먼저 말한다.
//
// ⚠️ 색은 앱이 이미 쓰는 TripPot 보라 하나와 그 옅은 톤뿐이다.
//    (components/home/palette.ts HOME_ACCENT) 여기서 새 색을 만들지 않는다.
//
// ⚠️ 좌표계는 120 × 96 이다. 카드 오른쪽 여백에 들어가는 크기라 그 안에서 끝낸다.
//
// ⚠️ 글자를 넣지 않는다. 그림이 문구를 되풀이하면 읽을 것이 두 벌이 된다.
// ============================================================================
import type { StyleProp, ViewStyle } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";

/** TripPot 보라. components/home/palette.ts 와 같은 값 */
const ACCENT = "#6C5CE7";
const SOFT = "#D9D3F8";
const PALE = "#EDEAFC";
const PAPER = "#FBFAFE";

type Props = {
  width?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
  /** 초대가 꺼져 있으면 채도를 뺀다. 카드 전체가 쉬는 것으로 읽힌다 */
  muted?: boolean;
};

export function InviteArt({ width = 120, height = 96, style, muted = false }: Props) {
  const accent = muted ? "#C3C7CE" : ACCENT;
  const soft = muted ? "#E3E5E9" : SOFT;
  const pale = muted ? "#F0F1F3" : PALE;

  return (
    <Svg width={width} height={height} viewBox="0 0 120 96" style={style}>
      {/* 구름 — 편지 뒤에서 살짝 보인다 */}
      <Circle cx="92" cy="26" r="13" fill={soft} opacity={0.75} />
      <Circle cx="107" cy="30" r="9" fill={soft} opacity={0.75} />
      <Rect x="90" y="28" width="26" height="11" rx="5.5" fill={soft} opacity={0.75} />

      {/* 반짝임 — 편지가 막 열린 느낌 */}
      <Path
        d="M24 28 L18 22"
        stroke={accent}
        strokeWidth="4.5"
        strokeLinecap="round"
        opacity={0.85}
      />
      <Path
        d="M30 20 L28 12"
        stroke={accent}
        strokeWidth="4.5"
        strokeLinecap="round"
        opacity={0.55}
      />

      {/* 편지 뒷면 */}
      <Path
        d="M26 44 h68 a6 6 0 0 1 6 6 v30 a6 6 0 0 1 -6 6 h-68 a6 6 0 0 1 -6 -6 v-30 a6 6 0 0 1 6 -6 z"
        fill={pale}
      />

      {/* 안에서 올라온 편지지 */}
      <Rect x="34" y="24" width="52" height="42" rx="6" fill={PAPER} />

      {/* 종이비행기 — 초대가 날아간다 */}
      <Path d="M80 31 L46 42 L60 47.5 L66 56 L70 46 Z" fill={accent} />
      {/* 접힌 선. 없으면 납작한 삼각형으로만 읽힌다 */}
      <Path
        d="M80 31 L60 47.5"
        stroke={PAPER}
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity={0.9}
      />
      {/* 밑줄 — 편지에 적힌 한 줄 */}
      <Rect x="44" y="56" width="32" height="4.5" rx="2.25" fill={accent} opacity={0.55} />

      {/* 편지 앞면(덮개) — 편지지를 반쯤 가린다 */}
      <Path
        d="M20 50 l38 24 a6 6 0 0 0 6.5 0 L100 50 v30 a6 6 0 0 1 -6 6 h-68 a6 6 0 0 1 -6 -6 z"
        fill={soft}
      />
    </Svg>
  );
}
