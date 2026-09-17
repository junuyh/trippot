// ============================================================================
// 트래블 스토리 카드의 도시 일러스트 등록표 (2026-09-17)
//
// '여행자들은 이렇게 다녀왔어요' 카드 오른쪽에 들어가는 그림이다.
//
// ⚠️ **사진을 쓰지 않는다.** 플랫 에디토리얼 일러스트다 — 부드러운 파스텔 면 ·
//    얇은 윤곽선 · 적은 디테일. 실사처럼 복잡하지 않고 아이콘처럼 단순하지도 않게.
// ⚠️ **"빈 칸에 랜드마크 선화 하나" 로 그리지 않는다.** 하늘 · 구름 · 땅 · 물 같은
//    면을 먼저 깔고 그 위에 도시를 얹어 한 장의 장면으로 만든다.
//
// 도시를 추가하는 법
//   1. 아래 ART 에 목적지 코드(lib/constants/destinations 의 DestinationCode)로 한 칸 추가
//   2. frame(엽서 · 태그) · 라벨 · 스탬프 색 · Art 를 채운다
//   등록하지 않은 도시는 DefaultScene(그 나라 랜드마크를 얹은 공통 장면)으로 나온다.
//
// ⚠️ 좌표계는 모두 viewBox 120 × 140 이다. 카드가 커지고 작아져도 인상이 같다.
// ============================================================================
import type { ReactElement } from 'react';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

import { LandmarkArt } from '../landmarkScene';
import {
  CebuArt,
  DaNangArt,
  FukuokaArt,
  HongKongArt,
  OsakaArt,
  ParisArt,
  RomeArt,
  ShanghaiArt,
  TaipeiArt,
  TokyoArt,
  VeniceArt,
} from './travelStoryArtCities';

export type TravelStoryArtProps = {
  width: number;
  height: number;
  /** 그 나라 대표색. 공통 장면의 면 색을 여기서 만든다. */
  accent: string;
  /** 공통 장면이 랜드마크를 고를 때 쓴다. */
  countryKo: string | null;
};

export type TravelStoryIllustration = {
  /**
   * 그림을 담는 여행 문서의 모양.
   *   postcard  세로 엽서 — 위 라벨 · 아래 두 줄 라벨 · 스탬프가 왼쪽 위로 걸친다
   *   tag       수하물 태그 — 제목 · 부제 · 키워드 · 옆면 세로 글씨 · 스탬프가 안쪽 오른쪽 위
   */
  frame: 'postcard' | 'tag';
  /** 엽서 위쪽 작은 글씨. "CÔTE D'AZUR" */
  topLabel?: string;
  /** 엽서 아래 두 줄. ["FRENCH", "RIVIERA"] */
  bottomLabel?: readonly string[];
  /** 태그 제목. "MILANO" */
  title?: string;
  /** 태그 부제. "ITALY" */
  subtitle?: string;
  /** 태그 오른쪽 작은 키워드. 3~4개 */
  keywords?: readonly string[];
  /** 태그 뒤 카드의 세로 글씨. "VIA DOLCE VITA" */
  sideLabel?: string;
  /** 스탬프 · 소인 색. 없으면 카드 포인트 색이다. */
  stampColor?: string;
  Art: (props: TravelStoryArtProps) => ReactElement;
};

const VIEW_BOX = '0 0 120 140';

// ── 니스 ────────────────────────────────────────────────────────────────────
// 영국인 산책로의 곡선 해안 · 코발트 바다 · 크림/오렌지 건물 · 야자수 · 작은 구름
//
// ⚠️ 2026-09-17 "일러스트가 너무 단순하다" 는 평을 받아 장면을 채웠다.
//    면(하늘 · 언덕 · 바다 · 모래 · 산책로)은 그대로 두고, 그 위에 **니스에서만 볼 수 있는
//    작은 소품**을 얹었다 — 산책로의 파란 의자 · 가로등 · 줄무늬 파라솔 · 요트 · 언덕 위 빌라와
//    사이프러스 · 덧창 달린 건물 · 갈매기. 선은 여전히 얇고 색은 파스텔 한 벌이다.
function NiceArt({ width, height }: TravelStoryArtProps) {
  // 해안 건물 — 창은 건물마다 같은 규칙으로 찍는다
  const buildings = [
    { x: 50, w: 8, h: 9, c: '#F6E6C6', roof: '#E39A66' },
    { x: 58, w: 7, h: 12, c: '#EFB887', roof: null },
    { x: 65, w: 9, h: 10, c: '#F8EDD8', roof: '#D98458' },
    { x: 74, w: 7, h: 15, c: '#E9A56F', roof: null },
    { x: 81, w: 10, h: 11, c: '#F4DFB6', roof: '#E39A66' },
    { x: 91, w: 8, h: 16, c: '#F7EAD1', roof: null },
    { x: 99, w: 9, h: 12, c: '#EDB07C', roof: '#D98458' },
    { x: 108, w: 12, h: 17, c: '#F5E2BF', roof: null },
  ];
  // 모래사장 위 파라솔 — 해안 곡선을 따라 놓는다
  const umbrellas = [
    { x: 71, y: 121, r: 4.2 },
    { x: 79, y: 106, r: 3.8 },
    { x: 89, y: 94, r: 3.4 },
    { x: 100, y: 85, r: 3 },
  ];
  // 산책로 가로등 · 파란 의자
  const lamps = [
    { x: 95, y: 124 },
    { x: 104, y: 108 },
    { x: 113, y: 97 },
  ];
  const chairs = [
    { x: 91, y: 134 },
    { x: 99.5, y: 118 },
    { x: 108.5, y: 104 },
  ];

  return (
    <Svg width={width} height={height} viewBox={VIEW_BOX} preserveAspectRatio="xMidYMid slice">
      {/* 하늘 */}
      <Rect x={0} y={0} width={120} height={70} fill="#DCEEFB" />
      <Rect x={0} y={0} width={120} height={26} fill="#EAF5FD" />
      {/* 해 */}
      <Circle cx={96} cy={17} r={10} fill="#FFF1C9" opacity={0.7} />
      <Circle cx={96} cy={17} r={6.5} fill="#FFE39B" />
      {/* 구름 */}
      <Ellipse cx={30} cy={20} rx={11} ry={3.6} fill="#FFFFFF" />
      <Ellipse cx={37} cy={17.5} rx={6} ry={3.4} fill="#FFFFFF" />
      <Ellipse cx={24} cy={18.5} rx={4.5} ry={2.6} fill="#FFFFFF" />
      <Ellipse cx={78} cy={31} rx={9} ry={2.8} fill="#FFFFFF" opacity={0.9} />
      <Ellipse cx={83} cy={29.4} rx={4.6} ry={2.4} fill="#FFFFFF" opacity={0.9} />
      {/* 갈매기 */}
      <Path
        d="M52 22 q 2 -2 4 0 q 2 -2 4 0 M 61 29 q 1.5 -1.5 3 0 q 1.5 -1.5 3 0 M 12 34 q 1.4 -1.4 2.8 0 q 1.4 -1.4 2.8 0"
        stroke="#6D88A6"
        strokeWidth={0.6}
        strokeLinecap="round"
        fill="none"
      />

      {/* 먼 산 */}
      <Path d="M0 54 C 18 46 36 47 52 51 C 70 45 92 40 120 47 L120 64 L0 64 Z" fill="#BCD5EA" />
      {/* 언덕 위 빌라 · 사이프러스 */}
      {[
        { x: 8, y: 50 },
        { x: 18, y: 48.5 },
        { x: 32, y: 49.5 },
      ].map((v) => (
        <G key={`villa${v.x}`}>
          <Rect x={v.x} y={v.y} width={5} height={4} fill="#FBF3E4" />
          <Path d={`M${v.x - 0.6} ${v.y} L${v.x + 2.5} ${v.y - 2.2} L${v.x + 5.6} ${v.y} Z`} fill="#E39A66" />
        </G>
      ))}
      {[14, 27, 41, 45].map((x) => (
        <Ellipse key={`cy${x}`} cx={x} cy={51} rx={1.1} ry={3.6} fill="#5E8F6E" />
      ))}
      <Path d="M0 58 C 22 53 44 55 64 57 C 84 53 102 51 120 54 L120 64 L0 64 Z" fill="#A7C6E0" />

      {/* 해안 건물 — 창 · 지붕 */}
      {buildings.map((b) => {
        const top = 64 - b.h;
        const cols = b.w >= 9 ? [b.x + 1.8, b.x + b.w - 3.4] : [b.x + b.w / 2 - 0.8];
        const rows: number[] = [];
        for (let y = top + 2.2; y < 62; y += 3.6) rows.push(y);
        return (
          <G key={b.x}>
            <Rect x={b.x} y={top} width={b.w} height={b.h + 1} fill={b.c} stroke="#D9B98C" strokeWidth={0.3} />
            {b.roof ? (
              <Path d={`M${b.x - 0.4} ${top} L${b.x + b.w / 2} ${top - 2.4} L${b.x + b.w + 0.4} ${top} Z`} fill={b.roof} />
            ) : null}
            {rows.map((y) =>
              cols.map((x) => <Rect key={`${x}-${y}`} x={x} y={y} width={1.6} height={2} fill="#7FA9CF" opacity={0.85} />),
            )}
          </G>
        );
      })}

      {/* 바다 */}
      <Path d="M0 64 L120 64 L120 70 C 96 77 72 96 60 140 L0 140 Z" fill="#2F7DD4" />
      <Path d="M0 64 L120 64 L120 67 C 98 72 76 86 66 104 C 50 96 22 84 0 82 Z" fill="#4C95E0" />
      <Path d="M0 64 H120 V65.4 H0 Z" fill="#8CC3F0" opacity={0.7} />
      {/* 물결 · 반짝임 */}
      <Path
        d="M8 96 q 6 -2 12 0 M 26 112 q 6 -2 12 0 M 12 124 q 5 -1.6 10 0 M 44 90 q 4 -1.4 8 0 M 36 130 q 5 -1.6 10 0 M 4 74 q 4 -1.2 8 0 M 56 78 q 4 -1.2 8 0"
        stroke="#8CC0F0"
        strokeWidth={0.8}
        strokeLinecap="round"
        fill="none"
      />
      <Path d="M20 86 l 1 -1 l 1 1 l -1 1 Z M 50 106 l 1 -1 l 1 1 l -1 1 Z" fill="#FFFFFF" opacity={0.9} />
      {/* 돛단배 두 척 · 요트 */}
      <Path d="M22 76 L22 67 L28 75.5 Z" fill="#FFFFFF" />
      <Path d="M21.4 67.6 L21.4 75.5 L17.6 75.5 Z" fill="#F4F7FB" />
      <Path d="M16.5 76 H29.5 L27.6 78.4 H18.4 Z" fill="#E36A55" />
      <Path d="M44 70.6 L44 65 L47.8 70.2 Z" fill="#FFFFFF" />
      <Path d="M41 70.8 H49 L47.8 72.4 H42.2 Z" fill="#1F4E86" />
      <Path d="M6 90 H17 L15 93 H8 Z" fill="#FFFFFF" />
      <Rect x={9} y={87.4} width={5} height={2.6} rx={0.6} fill="#FFFFFF" />
      <Rect x={10} y={88.2} width={3} height={1} fill="#7FA9CF" />
      <Path d="M5 94.2 q 3 -1 6 0 q 3 1 6 0" stroke="#FFFFFF" strokeWidth={0.5} fill="none" opacity={0.8} />

      {/* 모래사장 */}
      <Path d="M60 140 C 72 96 96 77 120 70 L120 82 C 102 90 86 108 78 140 Z" fill="#F4DFB8" />
      <Path d="M60 140 C 72 96 96 77 120 70" stroke="#FFFFFF" strokeWidth={1.4} fill="none" opacity={0.85} />
      {/* 파라솔 · 수건 */}
      {umbrellas.map((u, i) => (
        <G key={`u${u.x}`}>
          <Rect x={u.x - 2.6} y={u.y + 2.6} width={4.4} height={1.6} rx={0.4} fill={i % 2 ? '#8CC3E8' : '#F2A3A0'} />
          <Path d={`M${u.x} ${u.y} V${u.y + 4.6}`} stroke="#8C6A48" strokeWidth={0.5} />
          <Path d={`M${u.x - u.r} ${u.y} A ${u.r} ${u.r * 0.8} 0 0 1 ${u.x + u.r} ${u.y} Z`} fill="#FFFFFF" />
          <Path
            d={`M${u.x - u.r} ${u.y} A ${u.r} ${u.r * 0.8} 0 0 1 ${u.x - u.r / 3} ${u.y - u.r * 0.78} L${u.x} ${u.y} Z M${u.x + u.r / 3} ${u.y - u.r * 0.78} A ${u.r} ${u.r * 0.8} 0 0 1 ${u.x + u.r} ${u.y} L${u.x} ${u.y} Z`}
            fill="#E8604C"
          />
        </G>
      ))}

      {/* 산책로 */}
      <Path d="M78 140 C 86 108 102 90 120 82 L120 91 C 106 98 94 114 88 140 Z" fill="#E9CFA6" />
      <Path d="M88 140 C 94 114 106 98 120 91 L120 100 C 110 106 100 120 97 140 Z" fill="#AEB8C2" />
      <Path d="M92.5 140 C 97 118 108 103 120 95.5" stroke="#FFFFFF" strokeWidth={0.6} strokeDasharray="2 2" fill="none" />
      {/* 산책로의 파란 의자 (Chaises bleues) */}
      {chairs.map((c) => (
        <G key={`c${c.x}`}>
          <Path d={`M${c.x} ${c.y} h 3.2 v 1.4 h -3.2 Z`} fill="#2F6FB8" />
          <Path d={`M${c.x} ${c.y} v -2.8 h 0.9 v 2.8 Z`} fill="#2F6FB8" />
          <Path d={`M${c.x + 0.3} ${c.y + 1.4} v 1.2 M ${c.x + 2.9} ${c.y + 1.4} v 1.2`} stroke="#1F4E86" strokeWidth={0.4} />
        </G>
      ))}
      {/* 가로등 */}
      {lamps.map((l) => (
        <G key={`l${l.x}`}>
          <Path d={`M${l.x} ${l.y} V${l.y - 9}`} stroke="#4E5B6B" strokeWidth={0.55} />
          <Circle cx={l.x} cy={l.y - 9.6} r={1.1} fill="#FFF3C4" stroke="#4E5B6B" strokeWidth={0.4} />
        </G>
      ))}

      {/* 앞쪽 건물 — 덧창 · 발코니 · 차양 */}
      <Rect x={100} y={104} width={20} height={36} fill="#F7E5C4" stroke="#D9B98C" strokeWidth={0.4} />
      <Path d="M98 104 L110 97 L122 104 Z" fill="#E08E5B" />
      {[110, 119].map((y) =>
        [104, 112].map((x) => (
          <G key={`w${x}-${y}`}>
            <Rect x={x - 1.2} y={y} width={1.2} height={4} fill="#6FA38A" />
            <Rect x={x} y={y} width={3.5} height={4} fill="#9CC3E6" />
            <Rect x={x + 3.5} y={y} width={1.2} height={4} fill="#6FA38A" />
            <Path d={`M${x - 1.2} ${y + 4.4} h 5.9`} stroke="#8C7A66" strokeWidth={0.5} />
          </G>
        )),
      )}
      {/* 1층 카페 차양 */}
      <Path d="M100 128 H120 L119 131.5 H101 Z" fill="#FFFFFF" />
      {[100, 104, 108, 112, 116].map((x) => (
        <Path key={`aw${x}`} d={`M${x} 128 h 2 l -0.2 3.5 h -1.8 Z`} fill="#E8604C" />
      ))}
      <Rect x={103} y={133} width={4} height={7} fill="#B98B5E" />
      <Rect x={110} y={133} width={6} height={4} fill="#9CC3E6" />

      {/* 뒤쪽 작은 야자수 */}
      <Path d="M50 140 C 50.5 130 52 123 55 116" stroke="#8C6A48" strokeWidth={2} strokeLinecap="round" fill="none" />
      <Path d="M55 116 C 50 112 44 113 40 117 C 45 114 50 115 55 117 Z" fill="#3F9464" />
      <Path d="M55 116 C 58 110 63 108 68 110 C 63 111 59 113 55 117 Z" fill="#2F7A51" />
      <Path d="M55 116 C 54 110 55 106 58 104 C 56 108 55.5 112 55.3 117 Z" fill="#4DA573" />
      {/* 야자수 */}
      <Path d="M30 140 C 31 124 33 112 38 100" stroke="#8C6A48" strokeWidth={3.2} strokeLinecap="round" fill="none" />
      <Path d="M31 132 l 3 1 M 32 122 l 3 1 M 34 112 l 3 1" stroke="#6F5337" strokeWidth={0.6} />
      <Path d="M38 100 C 30 94 20 96 14 102 C 22 98 30 99 38 101 Z" fill="#3F9464" />
      <Path d="M38 100 C 34 90 26 86 18 88 C 26 90 32 94 38 101 Z" fill="#2F7A51" />
      <Path d="M38 100 C 42 90 50 86 58 88 C 50 90 44 94 38 101 Z" fill="#3F9464" />
      <Path d="M38 100 C 48 96 58 98 62 104 C 54 100 46 100 38 101 Z" fill="#2F7A51" />
      <Path d="M38 100 C 38 90 42 83 46 80 C 42 86 40 93 38.5 101 Z" fill="#4DA573" />
      <Circle cx={37} cy={102} r={1.4} fill="#7A5A3A" />
      <Circle cx={39.5} cy={102.6} r={1.3} fill="#7A5A3A" />
      {/* 야자수 아래 꽃덤불 */}
      <Ellipse cx={24} cy={138} rx={9} ry={4} fill="#4F9A6B" />
      <Ellipse cx={37} cy={139} rx={7} ry={3.4} fill="#3F8A5C" />
      {[
        [19, 136.5],
        [24, 135.2],
        [28.5, 137],
        [35, 137.4],
        [40, 138],
      ].map(([x, y]) => (
        <Circle key={`f${x}`} cx={x} cy={y} r={0.9} fill="#F48FB1" />
      ))}
    </Svg>
  );
}

// ── 밀라노 ──────────────────────────────────────────────────────────────────
// 두오모 성당 정면 · 아이보리 석재 · 뾰족탑 · 장미창 · 연한 도시 배경
function MilanArt({ width, height }: TravelStoryArtProps) {
  const spires = [24, 31, 38, 45, 75, 82, 89, 96];
  return (
    <Svg width={width} height={height} viewBox={VIEW_BOX} preserveAspectRatio="xMidYMid slice">
      {/* 하늘 */}
      <Rect x={0} y={0} width={120} height={140} fill="#EEF4EC" />
      <Ellipse cx={20} cy={22} rx={10} ry={3} fill="#FFFFFF" />
      <Ellipse cx={100} cy={16} rx={8} ry={2.6} fill="#FFFFFF" />
      {/* 먼 도시 */}
      <Path d="M0 96 L0 80 L10 80 L10 74 L18 74 L18 84 L26 84 L26 96 Z" fill="#DCE7D9" />
      <Path d="M94 96 L94 78 L104 78 L104 70 L112 70 L112 82 L120 82 L120 96 Z" fill="#DCE7D9" />
      {/* 뒤쪽 뾰족탑 */}
      {spires.map((x) => (
        <Path
          key={x}
          d={`M${x - 1.7} 62 L${x} ${x === 45 || x === 75 ? 36 : 44} L${x + 1.7} 62 Z`}
          fill="#EDE2CC"
          stroke="#C8B690"
          strokeWidth={0.45}
        />
      ))}
      {/* 가운데 첨탑과 황금 성모상 */}
      <Path d="M58 58 L60 16 L62 58 Z" fill="#EDE2CC" stroke="#C8B690" strokeWidth={0.45} />
      <Circle cx={60} cy={14.5} r={1.6} fill="#D7B25A" />
      {/* 정면 몸체 */}
      <Rect x={20} y={62} width={80} height={62} fill="#F3EBDA" stroke="#C8B690" strokeWidth={0.6} />
      {/* 박공 */}
      <Path d="M36 62 L60 42 L84 62 Z" fill="#F6EFE2" stroke="#C8B690" strokeWidth={0.6} />
      <Path d="M20 62 L28 55 L36 62 Z M84 62 L92 55 L100 62 Z" fill="#F6EFE2" stroke="#C8B690" strokeWidth={0.5} />
      {/* 기둥선 */}
      {[28, 36, 44, 52, 68, 76, 84, 92].map((x) => (
        <Path key={x} d={`M${x} 62 V124`} stroke="#DCCBA8" strokeWidth={0.5} />
      ))}
      {/* 장미창 */}
      <Circle cx={60} cy={56} r={4.4} fill="#E8DCC4" stroke="#C8B690" strokeWidth={0.5} />
      <Circle cx={60} cy={56} r={1.6} fill="#CFE0EA" />
      {/* 뾰족 창 두 줄 */}
      {[30, 40, 50, 70, 80, 90].map((x) => (
        <Path
          key={`w${x}`}
          d={`M${x - 2.2} 84 V78 Q${x} 74 ${x + 2.2} 78 V84 Z`}
          fill="#D6E3EA"
          stroke="#C8B690"
          strokeWidth={0.35}
        />
      ))}
      {/* 문 다섯 */}
      {[
        { x: 60, w: 11, h: 22 },
        { x: 44, w: 8, h: 16 },
        { x: 76, w: 8, h: 16 },
        { x: 30, w: 7, h: 13 },
        { x: 90, w: 7, h: 13 },
      ].map((d) => (
        <Path
          key={`d${d.x}`}
          d={`M${d.x - d.w / 2} 124 V${124 - d.h + d.w / 2} Q${d.x} ${124 - d.h - d.w / 3} ${d.x + d.w / 2} ${124 - d.h + d.w / 2} V124 Z`}
          fill="#D8C8A8"
          stroke="#BFA97F"
          strokeWidth={0.4}
        />
      ))}
      {/* 광장 */}
      <Rect x={0} y={124} width={120} height={16} fill="#E6DFCF" />
      <Path d="M0 124 H120" stroke="#CFC3A8" strokeWidth={0.6} />
      <Rect x={0} y={132} width={120} height={8} fill="#D6E3D0" />
    </Svg>
  );
}

// ── 공통 장면 (등록하지 않은 도시) ──────────────────────────────────────────
// 하늘 · 해 · 구름 · 언덕 두 겹 위에 그 나라 랜드마크를 얹는다. 색은 그 나라 색 한 벌.
function mix(hex: string, ratio: number): string {
  const value = hex.replace('#', '');
  if (value.length !== 6) return hex;
  const channel = (start: number) =>
    Math.round(255 + (parseInt(value.slice(start, start + 2), 16) - 255) * ratio);
  const to2 = (n: number) => n.toString(16).padStart(2, '0');
  return `#${to2(channel(0))}${to2(channel(2))}${to2(channel(4))}`;
}

function DefaultScene({ width, height, accent, countryKo }: TravelStoryArtProps) {
  const sky = mix(accent, 0.1);
  return (
    <>
      <Svg
        width={width}
        height={height}
        viewBox={VIEW_BOX}
        preserveAspectRatio="xMidYMid slice"
        style={{ position: 'absolute', left: 0, top: 0 }}
      >
        <Rect x={0} y={0} width={120} height={140} fill={sky} />
        <Rect x={0} y={0} width={120} height={34} fill={mix(accent, 0.05)} />
        <Circle cx={92} cy={26} r={9} fill="#FBE6B0" />
        <Ellipse cx={30} cy={22} rx={10} ry={3.2} fill="#FFFFFF" />
        <Ellipse cx={36} cy={19.5} rx={5.5} ry={3} fill="#FFFFFF" />
        <Path d="M0 108 C 24 96 48 98 70 104 C 90 98 106 96 120 100 L120 140 L0 140 Z" fill={mix(accent, 0.2)} />
        <Path d="M0 122 C 30 114 60 116 84 120 C 100 117 112 118 120 120 L120 140 L0 140 Z" fill={mix(accent, 0.3)} />
      </Svg>
      <LandmarkArt
        countryKo={countryKo}
        fill="#FFF9EF"
        line={mix(accent, 0.8)}
        width={width}
        height={height * 0.72}
        style={{ position: 'absolute', left: 0, bottom: height * 0.1 }}
      />
    </>
  );
}

const ART: Record<string, TravelStoryIllustration> = {
  nice: {
    frame: 'postcard',
    topLabel: "CÔTE D'AZUR",
    bottomLabel: ['FRENCH', 'RIVIERA'],
    Art: NiceArt,
  },
  milan: {
    frame: 'tag',
    title: 'MILANO',
    subtitle: 'ITALY',
    keywords: ['ART', 'FASHION', 'CULTURE', 'FOOD'],
    sideLabel: 'VIA DOLCE VITA',
    // 레퍼런스처럼 이탈리아 국기 빨강을 스탬프에만 옅게 쓴다. 카드 포인트 색은 초록 그대로다.
    stampColor: '#C9573F',
    Art: MilanArt,
  },
  // 나머지 도시 그림은 travelStoryArtCities.tsx 에 있다. 엽서 · 태그를 번갈아 써서
  // 가로로 넘길 때 옆 카드와 액자 모양이 겹치지 않게 했다.
  tokyo: {
    frame: 'postcard',
    topLabel: 'TOKYO BAY',
    bottomLabel: ['CITY OF', 'LIGHTS'],
    Art: TokyoArt,
  },
  osaka: {
    frame: 'tag',
    title: 'OSAKA',
    subtitle: 'JAPAN',
    keywords: ['FOOD', 'CASTLE', 'NEON'],
    sideLabel: 'KUIDAORE',
    Art: OsakaArt,
  },
  fukuoka: {
    frame: 'postcard',
    topLabel: 'KYUSHU',
    bottomLabel: ['YATAI', 'NIGHTS'],
    Art: FukuokaArt,
  },
  hong_kong: {
    frame: 'postcard',
    topLabel: 'VICTORIA HARBOUR',
    bottomLabel: ['STAR', 'FERRY'],
    Art: HongKongArt,
  },
  shanghai: {
    frame: 'postcard',
    topLabel: 'THE BUND',
    bottomLabel: ['HUANGPU', 'RIVER'],
    Art: ShanghaiArt,
  },
  taipei: {
    frame: 'tag',
    title: 'TAIPEI',
    subtitle: 'TAIWAN',
    keywords: ['MARKET', 'TEA', 'TEMPLE'],
    sideLabel: 'NIGHT MARKET',
    Art: TaipeiArt,
  },
  paris: {
    frame: 'tag',
    title: 'PARIS',
    subtitle: 'FRANCE',
    keywords: ['ART', 'CAFÉ', 'MUSÉE'],
    sideLabel: 'RIVE GAUCHE',
    Art: ParisArt,
  },
  rome: {
    frame: 'postcard',
    topLabel: 'ROMA',
    bottomLabel: ['CITTÀ', 'ETERNA'],
    Art: RomeArt,
  },
  venice: {
    frame: 'tag',
    title: 'VENEZIA',
    subtitle: 'ITALY',
    keywords: ['CANAL', 'GONDOLA', 'MASK'],
    sideLabel: 'GRAND CANAL',
    Art: VeniceArt,
  },
  cebu: {
    frame: 'postcard',
    topLabel: 'VISAYAS',
    bottomLabel: ['ISLAND', 'HOPPING'],
    Art: CebuArt,
  },
  da_nang: {
    frame: 'tag',
    title: 'DA NANG',
    subtitle: 'VIETNAM',
    keywords: ['BEACH', 'BRIDGE', 'HOI AN'],
    sideLabel: 'MY KHE BEACH',
    Art: DaNangArt,
  },
};

/**
 * 목적지 코드로 일러스트를 찾는다. 등록하지 않은 도시는 공통 장면이다.
 * @param countryNameEn 공통 장면 엽서 위쪽에 쓸 영문 국가명
 * @param cityNameEn    공통 장면 엽서 아래쪽에 쓸 영문 도시명
 */
export function travelStoryIllustration(
  code: string,
  countryNameEn: string,
  cityNameEn: string,
): TravelStoryIllustration {
  return (
    ART[code] ?? {
      frame: 'postcard',
      topLabel: countryNameEn,
      bottomLabel: [cityNameEn],
      Art: DefaultScene,
    }
  );
}
