// ============================================================================
// 항로 진행선 — 준비율을 비행기 위치로 보여준다 (2026-09-03)
//
// 여행 준비 홈(components/trip-home/TravelTicketCard)의 규칙을 그대로 가져왔다.
//   "비행기 위치 = 누적 모금액 ÷ 목표 여행비"
// 홈에서도 같은 그림으로 같은 값을 보여줘야 두 화면이 한 서비스로 읽힌다.
// 막대 그래프로 그리면 홈만 금융 앱 화면이 된다.
//
// ⚠️ 목표가 없으면(rate === null) 비행기를 출발점에 두고 선을 전부 점선으로 둔다.
//    0% 와 '목표 미설정' 은 다른 상태다. 0% 로 그리면 목표를 정한 사람처럼 보인다.
//
// ⚠️ 사진 위에 얹히므로 흰색만 쓴다. 지나온 구간은 실선, 남은 구간은 점선이다.
// ============================================================================
import { View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

type Props = {
  /** 준비율(%). 목표를 정하지 않았으면 null. */
  rate: number | null;
  /** 선 전체 폭. 카드 폭에서 좌우 여백을 뺀 값을 넘긴다. */
  width: number;
};

/** 비행기 아이콘이 놓일 자리를 남기려고 선 양 끝을 조금 줄인다. */
const PLANE = 13;
const STROKE = '#FFFFFF';

export function RouteProgress({ rate, width }: Props) {
  if (width <= 0) return null;

  const ratio = rate === null ? 0 : Math.min(100, Math.max(0, rate)) / 100;
  // 비행기가 선 밖으로 나가지 않도록 양 끝에 반 칸씩 남긴다.
  const travel = Math.max(0, width - PLANE);
  const planeX = travel * ratio;

  return (
    <View style={{ width, height: PLANE }}>
      <Svg width={width} height={PLANE}>
        {/* 남은 구간 — 점선 */}
        <Line
          x1={planeX + PLANE / 2}
          y1={PLANE / 2}
          x2={width}
          y2={PLANE / 2}
          stroke={STROKE}
          strokeOpacity={0.5}
          strokeWidth={1.4}
          strokeDasharray="2.5 3"
          strokeLinecap="round"
        />

        {/* 지나온 구간 — 실선 */}
        {planeX > 0 ? (
          <Line
            x1={0}
            y1={PLANE / 2}
            x2={planeX}
            y2={PLANE / 2}
            stroke={STROKE}
            strokeOpacity={0.95}
            strokeWidth={1.8}
            strokeLinecap="round"
          />
        ) : null}

        {/* 출발점 */}
        <Circle cx={1.6} cy={PLANE / 2} r={1.8} fill={STROKE} fillOpacity={0.95} />

        {/* 비행기. 24 좌표계를 PLANE 크기로 줄여 옮긴다. */}
        <Path
          d="M 2 12 L 22 3 L 15 21 L 11.5 13.8 Z"
          fill={STROKE}
          transform={`translate(${planeX}, 0) scale(${PLANE / 24})`}
        />
      </Svg>
    </View>
  );
}
