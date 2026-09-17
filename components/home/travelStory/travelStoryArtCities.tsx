// ============================================================================
// 트래블 스토리 카드 — 도시별 플랫 일러스트 (니스 · 밀라노 외 11곳) (2026-09-17)
//
// 니스 · 밀라노(travelStoryArt.tsx)와 같은 문법으로 그린다.
//   · 하늘 → 먼 배경 → 랜드마크 → 앞쪽 소품 → 땅/물 순서로 면을 쌓는다
//   · 부드러운 파스텔 면 + 얇은 윤곽선(0.3~0.6) · 디테일은 알아볼 만큼만
//   · 그라디언트 · 그림자 · 이모지 · 사진을 쓰지 않는다
//
// ⚠️ 좌표계는 viewBox 120 × 140 이다. (travelStoryArt 와 같다)
// ⚠️ 그리는 순서가 곧 앞뒤다. 배열 순서를 바꾸면 겹침이 달라진다.
// ============================================================================
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';

import type { TravelStoryArtProps } from './travelStoryArt';

const VIEW_BOX = '0 0 120 140';

function Frame({ width, height, children }: { width: number; height: number; children: React.ReactNode }) {
  return (
    <Svg width={width} height={height} viewBox={VIEW_BOX} preserveAspectRatio="xMidYMid slice">
      {children}
    </Svg>
  );
}

/** 작은 구름 하나. */
function Cloud({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <>
      <Ellipse cx={x} cy={y} rx={10 * s} ry={3.2 * s} fill="#FFFFFF" />
      <Ellipse cx={x + 5 * s} cy={y - 2.4 * s} rx={5.5 * s} ry={3 * s} fill="#FFFFFF" />
    </>
  );
}

/** 둥근 나무. 공원 · 가로수 · 벚꽃에 쓴다. */
function Tree({ x, y, r, leaf, trunk = '#8C6A55' }: { x: number; y: number; r: number; leaf: string; trunk?: string }) {
  return (
    <>
      <Rect x={x - 0.9} y={y} width={1.8} height={r * 1.4} fill={trunk} />
      <Circle cx={x} cy={y} r={r} fill={leaf} />
      <Circle cx={x - r * 0.55} cy={y + r * 0.3} r={r * 0.7} fill={leaf} />
      <Circle cx={x + r * 0.55} cy={y + r * 0.3} r={r * 0.7} fill={leaf} />
    </>
  );
}

/** 물결 몇 줄. */
function Ripples({ lines, color }: { lines: [number, number, number][]; color: string }) {
  return (
    <>
      {lines.map(([x, y, w]) => (
        <Path
          key={`${x}-${y}`}
          d={`M${x} ${y} q ${w / 4} -1.6 ${w / 2} 0 t ${w / 2} 0`}
          stroke={color}
          strokeWidth={0.8}
          fill="none"
          strokeLinecap="round"
        />
      ))}
    </>
  );
}

// ── 도쿄 — 도쿄타워 · 후지산 · 빌딩 · 벚꽃 ──────────────────────────────────
export function TokyoArt({ width, height }: TravelStoryArtProps) {
  return (
    <Frame width={width} height={height}>
      <Rect x={0} y={0} width={120} height={140} fill="#EAF2FA" />
      <Rect x={0} y={60} width={120} height={40} fill="#F9E6DE" />
      <Cloud x={20} y={20} />
      {/* 후지산 */}
      <Path d="M0 100 L26 70 Q31 64 36 70 L66 100 Z" fill="#C8D5E6" />
      <Path d="M20 77 L26 70 Q31 64 36 70 L42 77 L37 75 L32 79 L27 75 Z" fill="#FFFFFF" />
      {/* 빌딩 */}
      {[
        [50, 82, 10], [60, 74, 8], [94, 70, 9], [103, 80, 8], [111, 76, 9],
      ].map(([x, top, w]) => (
        <Rect key={x} x={x} y={top} width={w} height={124 - top} fill="#D4DEEA" stroke="#BBC8D8" strokeWidth={0.3} />
      ))}
      {/* 도쿄타워 */}
      <Path d="M68 124 L77 58 L79 58 L88 124 Z" fill="#E45A4D" stroke="#B8392E" strokeWidth={0.4} />
      <Path d="M72.6 96 L83.4 96 L84.2 102 L71.8 102 Z" fill="#FFFFFF" />
      <Path d="M75.4 74 L80.6 74 L81 78 L75 78 Z" fill="#FFFFFF" />
      <Rect x={70.5} y={83} width={15} height={4.2} rx={0.8} fill="#F4F6F8" stroke="#B8392E" strokeWidth={0.4} />
      <Rect x={74} y={66} width={8} height={2.8} rx={0.6} fill="#F4F6F8" stroke="#B8392E" strokeWidth={0.35} />
      <Path d="M78 58 V36" stroke="#E45A4D" strokeWidth={1.1} />
      <Path d="M72 114 L84 104 M84 114 L72 104 M73.5 92 L82.5 88 M82.5 92 L73.5 88" stroke="#B8392E" strokeWidth={0.3} />
      <Path d="M70 124 Q78 112 86 124" fill="#EAF2FA" />
      {/* 땅 · 벚꽃 */}
      <Rect x={0} y={124} width={120} height={16} fill="#DCE5EE" />
      <Tree x={18} y={116} r={6} leaf="#F6C6D1" />
      <Tree x={104} y={118} r={5} leaf="#F3B3C4" />
    </Frame>
  );
}

// ── 오사카 — 오사카성 · 석벽 · 벚꽃 · 해자 ─────────────────────────────────
export function OsakaArt({ width, height }: TravelStoryArtProps) {
  const roof = '#5E9C86';
  const gold = '#D9B35B';
  return (
    <Frame width={width} height={height}>
      <Rect x={0} y={0} width={120} height={140} fill="#EDF4FA" />
      <Cloud x={92} y={22} />
      {/* 석벽 */}
      <Path d="M22 122 L32 98 L88 98 L98 122 Z" fill="#D2CABB" stroke="#B3A993" strokeWidth={0.5} />
      <Path d="M28 110 H92 M25 116 H95 M30 104 H90" stroke="#BDB39E" strokeWidth={0.35} />
      {/* 1층 */}
      <Rect x={38} y={84} width={44} height={14} fill="#FFFFFF" stroke="#C9CFD6" strokeWidth={0.5} />
      {[42, 50, 58, 66, 74].map((x) => (
        <Rect key={x} x={x} y={88} width={3.4} height={4} fill="#43566A" />
      ))}
      <Path d="M30 86 L60 75 L90 86 Z" fill={roof} stroke="#4B8270" strokeWidth={0.4} />
      {/* 2층 */}
      <Rect x={44} y={66} width={32} height={11} fill="#FFFFFF" stroke="#C9CFD6" strokeWidth={0.5} />
      {[49, 57, 65].map((x) => (
        <Rect key={x} x={x} y={69.5} width={3.2} height={3.6} fill="#43566A" />
      ))}
      <Path d="M37 68 L60 58 L83 68 Z" fill={roof} stroke="#4B8270" strokeWidth={0.4} />
      {/* 3층 */}
      <Rect x={50} y={50} width={20} height={10} fill="#FFFFFF" stroke="#C9CFD6" strokeWidth={0.5} />
      <Path d="M44 52 L60 41 L76 52 Z" fill={roof} stroke="#4B8270" strokeWidth={0.4} />
      <Circle cx={45} cy={51.5} r={1.1} fill={gold} />
      <Circle cx={75} cy={51.5} r={1.1} fill={gold} />
      <Circle cx={60} cy={40.5} r={1.2} fill={gold} />
      {/* 벚꽃 */}
      <Tree x={14} y={104} r={7} leaf="#F6C7D2" />
      <Tree x={106} y={106} r={6.5} leaf="#F3B6C6" />
      {/* 해자 */}
      <Rect x={0} y={122} width={120} height={18} fill="#BFD9EE" />
      <Ripples lines={[[14, 130, 14], [58, 134, 16], [92, 129, 12]]} color="#E6F1FA" />
    </Frame>
  );
}

// ── 후쿠오카 — 후쿠오카타워 · 바다 · 야타이 ─────────────────────────────────
export function FukuokaArt({ width, height }: TravelStoryArtProps) {
  return (
    <Frame width={width} height={height}>
      <Rect x={0} y={0} width={120} height={140} fill="#E4F1FA" />
      <Cloud x={24} y={24} />
      <Circle cx={100} cy={22} r={7} fill="#FBE6B0" />
      {/* 바다 */}
      <Path d="M0 96 L120 96 L120 140 L0 140 Z" fill="#4E97DA" />
      <Ripples lines={[[60, 110, 14], [88, 120, 16], [66, 130, 12]]} color="#A9D0F1" />
      {/* 모래사장 */}
      <Path d="M0 108 C 30 104 46 112 56 140 L0 140 Z" fill="#F2DEB6" />
      {/* 후쿠오카타워 */}
      <Path d="M82 100 L86 30 L90 100 Z" fill="#A5C4DC" stroke="#7FA3C0" strokeWidth={0.45} />
      {[44, 54, 64, 74, 84, 94].map((y) => (
        <Path key={y} d={`M${86 - (y - 30) * 0.057} ${y} H${86 + (y - 30) * 0.057}`} stroke="#E4F0F8" strokeWidth={0.5} />
      ))}
      <Path d="M86 30 V18" stroke="#7FA3C0" strokeWidth={0.8} />
      <Rect x={78} y={96} width={16} height={4} fill="#DCE6EE" stroke="#A9BBCB" strokeWidth={0.3} />
      {/* 야타이 */}
      <Rect x={14} y={106} width={34} height={18} fill="#C79A6C" stroke="#9E7650" strokeWidth={0.4} />
      <Path d="M10 106 L52 106 L48 98 L14 98 Z" fill="#E4574B" />
      {[18, 26, 34, 42].map((x) => (
        <Path key={x} d={`M${x} 98 L${x - 1} 106`} stroke="#FFFFFF" strokeWidth={2.4} />
      ))}
      <Rect x={16} y={106} width={30} height={5} fill="#F3EEE6" />
      <Circle cx={50} cy={112} r={3} fill="#E4574B" />
      <Rect x={49.5} y={115} width={1} height={3} fill="#D9B35B" />
      <Rect x={12} y={124} width={40} height={2} fill="#9E7650" />
    </Frame>
  );
}

// ── 상하이 — 동방명주 · 푸동 스카이라인 · 황푸강 ───────────────────────────
export function ShanghaiArt({ width, height }: TravelStoryArtProps) {
  return (
    <Frame width={width} height={height}>
      <Rect x={0} y={0} width={120} height={140} fill="#F1EEF7" />
      <Rect x={0} y={54} width={120} height={50} fill="#FBE8E2" />
      {/* 상하이타워 · 진마오 · SWFC */}
      <Path d="M96 104 L98 34 Q101 30 104 36 L106 104 Z" fill="#A9BCD3" stroke="#8EA4BF" strokeWidth={0.4} />
      <Path d="M108 104 V62 L110 58 V50 L112 46 L114 50 V58 L116 62 V104 Z" fill="#BCCADB" stroke="#9EB0C6" strokeWidth={0.4} />
      <Path d="M78 104 L80 44 L90 44 L92 104 Z" fill="#B6C6D8" stroke="#9EB0C6" strokeWidth={0.4} />
      <Rect x={82} y={47} width={6} height={4} rx={1.2} fill="#F1EEF7" />
      {/* 동방명주 */}
      <Path d="M36 104 L46 78 M60 104 L50 78 M48 104 V80" stroke="#B5B9C6" strokeWidth={1.4} />
      <Rect x={46.6} y={40} width={2.8} height={56} fill="#C9CDD6" />
      <Circle cx={48} cy={84} r={9} fill="#E78CA3" stroke="#C86D86" strokeWidth={0.5} />
      <Circle cx={48} cy={58} r={5.6} fill="#E78CA3" stroke="#C86D86" strokeWidth={0.5} />
      <Circle cx={48} cy={42} r={2.8} fill="#E78CA3" stroke="#C86D86" strokeWidth={0.4} />
      <Path d="M48 39 V22" stroke="#B5B9C6" strokeWidth={0.8} />
      <Path d="M40 84 H56 M43.5 58 H52.5" stroke="#F7C4D1" strokeWidth={0.6} />
      {/* 앞 건물 */}
      {[[4, 88, 12], [16, 92, 10], [62, 90, 12]].map(([x, top, w]) => (
        <Rect key={x} x={x} y={top} width={w} height={104 - top} fill="#D6DDE8" stroke="#BCC6D4" strokeWidth={0.3} />
      ))}
      {/* 강 · 와이탄 둑 */}
      <Rect x={0} y={104} width={120} height={36} fill="#5F91C8" />
      <Ripples lines={[[10, 114, 16], [50, 122, 18], [86, 116, 14], [30, 132, 14]]} color="#A8C6E6" />
      <Rect x={0} y={134} width={120} height={6} fill="#EFE3CF" />
    </Frame>
  );
}

// ── 타이베이 — 타이베이 101 · 산 · 등불 · 사원 지붕 ─────────────────────────
export function TaipeiArt({ width, height }: TravelStoryArtProps) {
  const segments = [0, 1, 2, 3, 4, 5, 6, 7];
  return (
    <Frame width={width} height={height}>
      <Rect x={0} y={0} width={120} height={140} fill="#EAF2FA" />
      <Cloud x={96} y={26} s={0.9} />
      {/* 산 */}
      <Path d="M0 96 C 22 70 44 74 64 86 C 84 72 104 70 120 80 L120 124 L0 124 Z" fill="#C3DCC7" />
      <Path d="M0 106 C 28 92 52 96 72 102 C 92 94 108 94 120 98 L120 124 L0 124 Z" fill="#A8CBB3" />
      {/* 101 */}
      <Rect x={64} y={100} width={16} height={24} fill="#8DB6A6" stroke="#6E9A89" strokeWidth={0.45} />
      {segments.map((i) => {
        const bottom = 100 - i * 7;
        return (
          <Path
            key={i}
            d={`M65 ${bottom} L63 ${bottom - 7} L81 ${bottom - 7} L79 ${bottom} Z`}
            fill={i % 2 === 0 ? '#9CC1B2' : '#8DB6A6'}
            stroke="#6E9A89"
            strokeWidth={0.4}
          />
        );
      })}
      <Rect x={68} y={38} width={8} height={6} fill="#9CC1B2" stroke="#6E9A89" strokeWidth={0.4} />
      <Path d="M72 38 V22" stroke="#6E9A89" strokeWidth={0.9} />
      {/* 등불 */}
      <Path d="M0 10 Q 26 22 52 12" stroke="#B5A48A" strokeWidth={0.5} fill="none" />
      {[[12, 19], [26, 22], [40, 19]].map(([x, y]) => (
        <Ellipse key={x} cx={x} cy={y} rx={3} ry={3.8} fill="#E05A4C" stroke="#B8402F" strokeWidth={0.35} />
      ))}
      {/* 사원 지붕 */}
      <Rect x={8} y={112} width={36} height={12} fill="#F1E1C6" stroke="#CDB58E" strokeWidth={0.4} />
      <Path d="M2 112 Q 26 102 50 112 L46 108 Q 26 100 6 108 Z" fill="#D9573F" />
      <Path d="M4 108 Q 26 98 48 108" stroke="#E7B94F" strokeWidth={1} fill="none" />
      <Rect x={20} y={116} width={12} height={8} fill="#C9573F" />
      <Rect x={0} y={124} width={120} height={16} fill="#DCE6DF" />
    </Frame>
  );
}

// ── 홍콩 — 빅토리아 하버 · 빌딩숲 · 붉은 돛 정크선 ─────────────────────────
export function HongKongArt({ width, height }: TravelStoryArtProps) {
  return (
    <Frame width={width} height={height}>
      <Rect x={0} y={0} width={120} height={140} fill="#EAF1F8" />
      <Cloud x={26} y={18} s={0.9} />
      {/* 빅토리아 피크 */}
      <Path d="M0 82 C 20 52 46 50 66 66 C 84 52 104 54 120 66 L120 106 L0 106 Z" fill="#AFC9B9" />
      {/* 빌딩숲 */}
      {[
        [6, 78, 8, '#C9D6E3'], [14, 72, 7, '#B8C8D9'], [21, 84, 8, '#D3DDE8'],
        [36, 40, 9, '#A3B6CC'], [45, 74, 7, '#C9D6E3'], [52, 56, 10, '#B0C1D4'],
        [62, 80, 8, '#D3DDE8'], [70, 66, 8, '#BDCBDC'], [78, 76, 9, '#C9D6E3'],
        [87, 60, 8, '#AFC0D3'], [95, 82, 8, '#D3DDE8'], [103, 70, 9, '#BDCBDC'], [112, 80, 8, '#C9D6E3'],
      ].map(([x, top, w, c]) => (
        <Rect key={x} x={x as number} y={top as number} width={w as number} height={106 - (top as number)} fill={c as string} stroke="#9FB2C7" strokeWidth={0.25} />
      ))}
      {/* 중국은행 타워 X 무늬 */}
      <Path d="M52 56 L62 66 M62 56 L52 66 M52 66 L62 76 M62 66 L52 76" stroke="#EAF1F8" strokeWidth={0.6} />
      <Path d="M40.5 40 V28" stroke="#8EA4BF" strokeWidth={0.7} />
      {/* 항구 */}
      <Rect x={0} y={106} width={120} height={34} fill="#3F80C5" />
      <Ripples lines={[[60, 116, 16], [88, 128, 18], [70, 134, 12]]} color="#8DB9E6" />
      {/* 정크선 */}
      <Path d="M10 124 Q 26 130 44 124 L40 130 H14 Z" fill="#7A5A3A" />
      <Path d="M26 124 V96" stroke="#5C4128" strokeWidth={0.8} />
      <Path d="M26 98 Q 38 104 40 122 L26 122 Z" fill="#D9533F" stroke="#B23F2E" strokeWidth={0.4} />
      <Path d="M26 104 L37 107 M26 110 L39 113 M26 116 L40 118" stroke="#F0A08F" strokeWidth={0.4} />
      <Path d="M26 102 Q 18 106 16 120 L26 120 Z" fill="#D9533F" stroke="#B23F2E" strokeWidth={0.4} />
    </Frame>
  );
}

// ── 파리 — 에펠탑 · 오스만 건물 · 센강 다리 · 가로수 ────────────────────────
export function ParisArt({ width, height }: TravelStoryArtProps) {
  const iron = '#A88A6B';
  return (
    <Frame width={width} height={height}>
      <Rect x={0} y={0} width={120} height={140} fill="#EAF1FB" />
      <Cloud x={22} y={22} />
      <Cloud x={94} y={34} s={0.8} />
      {/* 오스만 건물 */}
      {[[0, 88, 22], [96, 84, 24]].map(([x, top, w]) => (
        <Rect key={x} x={x} y={top} width={w} height={116 - top} fill="#F2E8D6" stroke="#D9C9AA" strokeWidth={0.4} />
      ))}
      <Path d="M0 88 L4 82 H18 L22 88 Z M96 84 L100 78 H116 L120 84 Z" fill="#A9B5C6" />
      {[4, 12, 100, 108].map((x) => (
        <Rect key={x} x={x} y={94} width={4} height={6} fill="#B9CBDC" />
      ))}
      {/* 에펠탑 */}
      <Path d="M42 116 C 50 98 54 86 57 70 L63 70 C 66 86 70 98 78 116 L71 116 C 66 104 63 98 60 96 C 57 98 54 104 49 116 Z" fill={iron} stroke="#8A6F53" strokeWidth={0.4} />
      <Rect x={52} y={88} width={16} height={3} fill="#B79A7B" stroke="#8A6F53" strokeWidth={0.35} />
      <Rect x={55} y={68} width={10} height={2.6} fill="#B79A7B" stroke="#8A6F53" strokeWidth={0.35} />
      <Path d="M57 68 L60 30 L63 68 Z" fill={iron} stroke="#8A6F53" strokeWidth={0.35} />
      <Path d="M60 30 V22" stroke="#8A6F53" strokeWidth={0.7} />
      <Path d="M56 80 L64 76 M64 80 L56 76 M58.5 60 L61.5 50 M61.5 60 L58.5 50" stroke="#8A6F53" strokeWidth={0.3} />
      {/* 가로수 */}
      <Tree x={30} y={108} r={5.5} leaf="#9CC49A" />
      <Tree x={90} y={108} r={5.5} leaf="#8FBA8E" />
      {/* 센강 · 다리 */}
      <Rect x={0} y={116} width={120} height={24} fill="#9CC3E6" />
      <Path d="M0 116 H120 V120 Q 100 120 96 132 H86 Q 82 120 60 120 Q 38 120 34 132 H24 Q 20 120 0 120 Z" fill="#EFE6D2" stroke="#D5C6A6" strokeWidth={0.4} />
      <Ripples lines={[[40, 136, 12], [74, 136, 12]]} color="#D6E8F6" />
    </Frame>
  );
}

// ── 로마 — 콜로세움 · 사이프러스 · 우산소나무 ──────────────────────────────
export function RomeArt({ width, height }: TravelStoryArtProps) {
  const stone = '#E9C99A';
  const arch = '#C79B64';
  return (
    <Frame width={width} height={height}>
      <Rect x={0} y={0} width={120} height={140} fill="#F6F0E4" />
      <Circle cx={94} cy={24} r={8} fill="#FBDDA4" />
      <Cloud x={24} y={24} s={0.9} />
      {/* 우산소나무 */}
      <Rect x={98} y={74} width={1.8} height={40} fill="#7A5A3A" />
      <Ellipse cx={99} cy={72} rx={15} ry={5.5} fill="#6E9B63" />
      {/* 콜로세움 */}
      <Path d="M14 118 L14 70 Q 60 56 106 70 L106 118 Z" fill={stone} stroke="#C9A06A" strokeWidth={0.6} />
      <Path d="M88 64 L96 70 L106 66 L106 76 L88 72 Z" fill="#F6F0E4" />
      <Path d="M14 84 Q 60 72 106 84 M14 100 Q 60 90 106 100" stroke="#C9A06A" strokeWidth={0.5} fill="none" />
      {[0, 1, 2].map((row) =>
        [0, 1, 2, 3, 4, 5, 6].map((col) => {
          const x = 18 + col * 12.4;
          const baseY = row === 0 ? 82 : row === 1 ? 98 : 116;
          const lift = Math.abs(col - 3) * (row === 0 ? 1.2 : row === 1 ? 1 : 0.6);
          const top = baseY - 9 + lift;
          return (
            <Path
              key={`${row}-${col}`}
              d={`M${x} ${baseY + lift} V${top + 3} Q${x + 3} ${top - 1} ${x + 6} ${top + 3} V${baseY + lift} Z`}
              fill={arch}
            />
          );
        }),
      )}
      {/* 사이프러스 */}
      <Ellipse cx={8} cy={100} rx={4} ry={16} fill="#5E8F5A" />
      <Ellipse cx={112} cy={104} rx={3.6} ry={13} fill="#557F52" />
      <Rect x={0} y={118} width={120} height={22} fill="#E7DBC4" />
      <Path d="M0 126 H120" stroke="#D6C6A6" strokeWidth={0.5} />
    </Frame>
  );
}

// ── 베니스 — 운하 · 알록달록한 집 · 곤돌라 · 줄무늬 말뚝 ───────────────────
export function VeniceArt({ width, height }: TravelStoryArtProps) {
  const left = [
    { x: 0, top: 56, w: 16, c: '#E9A27E' },
    { x: 16, top: 64, w: 14, c: '#EFCB86' },
    { x: 30, top: 60, w: 12, c: '#EDB6A8' },
  ];
  const right = [
    { x: 80, top: 62, w: 14, c: '#F1E3C8' },
    { x: 94, top: 54, w: 14, c: '#E29A73' },
    { x: 108, top: 60, w: 12, c: '#EBC47A' },
  ];
  return (
    <Frame width={width} height={height}>
      <Rect x={0} y={0} width={120} height={140} fill="#EDF5F7" />
      <Cloud x={60} y={22} />
      {/* 종탑 */}
      <Rect x={54} y={40} width={10} height={60} fill="#C98A6A" stroke="#A96D50" strokeWidth={0.4} />
      <Path d="M52 40 L59 28 L66 40 Z" fill="#6F9B8C" />
      <Rect x={56.5} y={44} width={5} height={6} fill="#F1E3C8" />
      {[...left, ...right].map((h) => (
        <Rect key={h.x} x={h.x} y={h.top} width={h.w} height={100 - h.top} fill={h.c} stroke="#C9A98A" strokeWidth={0.35} />
      ))}
      {[...left, ...right].map((h) =>
        [0, 1].map((i) => (
          <Path
            key={`${h.x}-${i}`}
            d={`M${h.x + 3} ${h.top + 10 + i * 12} V${h.top + 6 + i * 12} Q${h.x + h.w / 2} ${h.top + 2 + i * 12} ${h.x + h.w - 3} ${h.top + 6 + i * 12} V${h.top + 10 + i * 12} Z`}
            fill="#7FB0C4"
          />
        )),
      )}
      {/* 운하 */}
      <Path d="M0 100 H120 V140 H0 Z" fill="#4E9BB8" />
      <Ripples lines={[[8, 112, 14], [72, 118, 16], [36, 130, 18], [94, 132, 14]]} color="#A6D2E0" />
      {/* 말뚝 */}
      {[[20, 96], [26, 98]].map(([x, top]) => (
        <Rect key={x} x={x} y={top} width={2} height={18} fill="#FFFFFF" stroke="#3D6FA8" strokeWidth={0.4} />
      ))}
      <Path d="M20 100 h2 M20 106 h2 M26 102 h2 M26 108 h2" stroke="#3D6FA8" strokeWidth={1.4} />
      {/* 곤돌라 */}
      <Path d="M44 124 Q 70 132 100 118 Q 96 126 70 130 Q 52 130 44 124 Z" fill="#2F3440" />
      <Path d="M84 122 V104" stroke="#2F3440" strokeWidth={1.1} />
      <Circle cx={84} cy={101} r={2} fill="#2F3440" />
      <Path d="M84 108 L94 128" stroke="#8C6A48" strokeWidth={0.8} />
    </Frame>
  );
}

// ── 세부 — 에메랄드 바다 · 작은 섬 · 야자수 · 방카배 ───────────────────────
export function CebuArt({ width, height }: TravelStoryArtProps) {
  return (
    <Frame width={width} height={height}>
      <Rect x={0} y={0} width={120} height={140} fill="#E2F4FA" />
      <Circle cx={96} cy={22} r={8} fill="#FBE6B0" />
      <Cloud x={28} y={22} />
      {/* 먼 바다 · 섬 */}
      <Rect x={0} y={70} width={120} height={70} fill="#3FB0C8" />
      <Path d="M58 72 C 70 58 90 56 104 62 C 110 65 116 68 120 72 Z" fill="#7DBB8C" />
      <Path d="M0 90 H120 V140 H0 Z" fill="#63C6D6" />
      <Path d="M0 110 C 40 104 70 110 120 106 V140 H0 Z" fill="#8FDADF" />
      {/* 모래 */}
      <Path d="M0 118 C 24 112 44 122 60 140 H0 Z" fill="#F4E7C5" />
      {/* 야자수 */}
      <Path d="M20 138 C 22 122 26 110 34 98" stroke="#8C6A48" strokeWidth={3} strokeLinecap="round" fill="none" />
      <Path d="M34 98 C 26 92 16 94 10 100 C 18 96 26 97 34 99 Z" fill="#3F9464" />
      <Path d="M34 98 C 30 88 22 84 14 86 C 22 88 28 92 34 99 Z" fill="#2F7A51" />
      <Path d="M34 98 C 38 88 46 84 54 86 C 46 88 40 92 34 99 Z" fill="#3F9464" />
      <Path d="M34 98 C 44 94 54 96 58 102 C 50 98 42 98 34 99 Z" fill="#2F7A51" />
      {/* 방카배 */}
      <Path d="M70 102 Q 86 108 104 102 L100 108 H74 Z" fill="#FFFFFF" stroke="#8FB7C4" strokeWidth={0.5} />
      <Path d="M68 106 H106 M76 102 L70 106 M98 102 L104 106" stroke="#B08A5E" strokeWidth={0.8} />
      <Path d="M76 102 V94 H98 V102" stroke="#B08A5E" strokeWidth={0.5} fill="none" />
      <Rect x={76} y={94} width={22} height={3} fill="#F2C94C" />
    </Frame>
  );
}

// ── 다낭 — 용다리 · 호이안 등불 · 해변 ─────────────────────────────────────
export function DaNangArt({ width, height }: TravelStoryArtProps) {
  const gold = '#E7B84A';
  return (
    <Frame width={width} height={height}>
      <Rect x={0} y={0} width={120} height={140} fill="#F6EFE5" />
      <Cloud x={92} y={30} s={0.9} />
      {/* 산 */}
      <Path d="M0 84 C 24 64 50 66 70 76 C 90 64 108 66 120 72 L120 96 L0 96 Z" fill="#C6D7C4" />
      {/* 강 */}
      <Rect x={0} y={96} width={120} height={44} fill="#6FA6D2" />
      <Ripples lines={[[10, 124, 14], [56, 132, 16], [90, 126, 14]]} color="#B5D3EC" />
      {/* 용다리 */}
      <Rect x={0} y={100} width={120} height={4} fill="#A9B4BF" />
      {[20, 50, 80, 110].map((x) => (
        <Rect key={x} x={x - 1.5} y={104} width={3} height={14} fill="#A9B4BF" />
      ))}
      <Path
        d="M8 100 C 16 76 30 76 38 100 C 46 76 60 76 68 100 C 76 76 90 76 98 100 C 102 88 108 86 114 92"
        stroke={gold}
        strokeWidth={3.2}
        fill="none"
        strokeLinecap="round"
      />
      <Path d="M8 100 C 4 94 2 90 -2 90 M8 100 L2 102" stroke={gold} strokeWidth={2.4} strokeLinecap="round" />
      <Circle cx={2} cy={91} r={1.6} fill="#D9573F" />
      {/* 호이안 등불 */}
      <Path d="M0 10 Q 30 22 60 12" stroke="#B5A48A" strokeWidth={0.5} fill="none" />
      {[
        [12, 18, '#E05A4C'],
        [28, 22, '#F2B84B'],
        [44, 19, '#E05A4C'],
      ].map(([x, y, c]) => (
        <Ellipse key={x as number} cx={x as number} cy={y as number} rx={3.2} ry={4} fill={c as string} stroke="#B8402F" strokeWidth={0.35} />
      ))}
      {/* 해변 */}
      <Path d="M60 140 C 76 128 98 124 120 126 V140 Z" fill="#F4E3BF" />
    </Frame>
  );
}
