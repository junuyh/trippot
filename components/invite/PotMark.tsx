// ============================================================================
// 초대 화면의 저금통 그림.
//
// INV-02(초대 확인)와 INV-03(대기)에서 쓴다. 두 화면은 링크만 있으면 열리는
// 화면이라 여행 데이터를 거의 못 보여준다. 빈 화면이 되지 않게 그림이 자리를
// 채우고, 색으로 상태를 구분한다.
//
//   live     파란 저금통 + 동전   초대가 살아 있다
//   waiting  회색 저금통 + 시계   수락을 기다린다
//
// ⚠️ react-native-svg 는 이미 의존성에 있다 (15.12.1). 새로 넣지 않았다.
// ============================================================================
import Svg, { Circle, Ellipse, G, Path, Rect } from "react-native-svg";

type Props = {
  variant: "live" | "waiting";
  size?: number;
};

export function PotMark({ variant, size = 104 }: Props) {
  const live = variant === "live";
  const body = live ? "#2563eb" : "#C9D4E8";
  const lid = live ? "#3b82f6" : "#DCE4F2";
  const slot = live ? "#0034A8" : "#A6B4CC";

  return (
    <Svg width={size} height={size} viewBox="0 0 112 112">
      <Ellipse cx="56" cy="99" rx="30" ry="6" fill="#2563eb" opacity={0.1} />
      <Path
        d="M24 52c0-15 14-26 32-26s32 11 32 26v20c0 10-8 18-18 18H42c-10 0-18-8-18-18V52z"
        fill={body}
      />
      <Path d="M24 52c0-15 14-26 32-26s32 11 32 26v6H24v-6z" fill={lid} />
      <Rect x="44" y="42" width="24" height="6" rx="3" fill={slot} />

      <Circle cx="42" cy="68" r="4.5" fill="#fff" />
      <Circle cx="70" cy="68" r="4.5" fill="#fff" />

      {live ? (
        <>
          <Circle cx="42.5" cy="69" r="2.2" fill="#0034A8" />
          <Circle cx="70.5" cy="69" r="2.2" fill="#0034A8" />
          <Path d="M50 79q6 5 12 0" stroke="#fff" strokeWidth={3} strokeLinecap="round" fill="none" />
          {/* 동전 — 초대가 살아 있다 */}
          <G>
            <Circle cx="56" cy="18" r="10" fill="#FFC53D" />
            <Path
              d="M52.5 18h7M56 14.5v7"
              stroke="#8A5A00"
              strokeWidth={2.4}
              strokeLinecap="round"
            />
          </G>
        </>
      ) : (
        <>
          {/* 감은 눈 + 시계 — 기다리는 중 */}
          <Path
            d="M39 69h7M67 69h7"
            stroke="#8B95A1"
            strokeWidth={2.4}
            strokeLinecap="round"
          />
          <Path d="M50 80h12" stroke="#fff" strokeWidth={3} strokeLinecap="round" />
          <G>
            <Circle cx="86" cy="30" r="13" fill="#FFC53D" />
            <Path
              d="M86 23.5V30l4.5 3"
              stroke="#8A5A00"
              strokeWidth={2.6}
              strokeLinecap="round"
              fill="none"
            />
          </G>
        </>
      )}
    </Svg>
  );
}
