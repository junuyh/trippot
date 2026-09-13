// ============================================================================
// MY-01 "TripPot 여행 여권" — 여권 내지의 색과 장식 (2026-09-13)
//
// 마이페이지 상단(프로필 + 내 여행)을 실제 여권의 **정보 페이지**처럼 그린다.
// 겉표지가 아니다. 그래서 바탕은 진한 보라가 아니라 아주 연한 라벤더고,
// 포인트만 진한 남보라다.
//
// ⚠️ 실제 여권을 복제하지 않는다. 국가 문장 · 공식 문양 · 여권 번호 체계 ·
//    보안 무늬는 쓰지 않는다. 가져오는 건 "라벨 위 · 값 아래" 배치, 사진 칸,
//    옅은 세계지도, MRZ 모양의 장식 글줄 — 이 넷뿐이다.
//
// ⚠️ 색은 이 화면 전용이다. tailwind palette 에 보라 단계가 없어 여기 상수로만
//    둔다. 숫자 강조는 홈·커뮤니티가 이미 쓰는 TripPot 보라(#6C5CE7)를 그대로 쓴다.
// ============================================================================
import { Platform } from 'react-native';
import Svg, { Path } from 'react-native-svg';

export const PASSPORT = {
  /** 내지 바탕. 아주 연한 라벤더 */
  paper: '#F4F1FB',
  /** 내지 테두리. 있는 듯 없는 듯 */
  edge: '#E3DEF0',
  /** 구분선 · 워터마크 · 사진 칸 테두리 */
  rule: '#DDD8EA',
  /** 제목 · 이름 · 값. 진한 남보라 */
  ink: '#2E2A5E',
  /** 라벨 · 보조 글자. 회보라 */
  label: '#8A84A8',
  /** 숫자 강조. 홈 HOME_ACCENT · 커뮤니티 FREE_TIP 과 같은 TripPot 보라 */
  accent: '#6C5CE7',
  /** 사진 칸 안 기본 아이콘 */
  placeholder: '#C9C3DD',
} as const;

/** MRZ 장식 글줄 글꼴. 새 폰트를 넣지 않고 기기 고정폭을 쓴다. */
export const MRZ_FONT = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

/**
 * 세계지도 워터마크. 대륙을 아주 거칠게 다듬은 실루엣이다.
 *
 * ⚠️ 정확한 지도가 아니다. 여권 내지의 "지도 같은 무늬" 만 흉내 낸다.
 *    실제 여권 지도 · 참고 이미지를 가져오지 않는다. 좌표는 200 × 100.
 * ⚠️ 색 하나 · 낮은 opacity. 글자보다 튀면 실패다.
 */
export function WorldMapWatermark({
  width,
  height,
  color = PASSPORT.ink,
  opacity = 0.04,
}: {
  width: number;
  height: number;
  color?: string;
  opacity?: number;
}) {
  return (
    <Svg width={width} height={height} viewBox="0 0 200 100" pointerEvents="none">
      {/* 그린란드 */}
      <Path d="M60 3 L76 2 L78 8 L70 12 L62 10 Z" fill={color} opacity={opacity} />
      {/* 북아메리카 */}
      <Path
        d="M14 14 L36 8 L54 10 L68 16 L64 26 L56 34 L50 46 L40 54 L32 46 L26 36 L18 28 Z"
        fill={color}
        opacity={opacity}
      />
      {/* 남아메리카 */}
      <Path
        d="M42 56 L56 54 L66 62 L62 76 L54 92 L48 86 L42 70 Z"
        fill={color}
        opacity={opacity}
      />
      {/* 유럽 */}
      <Path d="M84 14 L104 10 L112 18 L106 28 L94 32 L84 26 Z" fill={color} opacity={opacity} />
      {/* 아프리카 */}
      <Path
        d="M88 34 L110 32 L122 46 L116 66 L106 78 L96 72 L88 54 Z"
        fill={color}
        opacity={opacity}
      />
      {/* 아시아 */}
      <Path
        d="M108 8 L150 4 L180 12 L186 26 L168 36 L152 44 L136 42 L120 34 L112 22 Z"
        fill={color}
        opacity={opacity}
      />
      {/* 오세아니아 */}
      <Path d="M150 62 L172 60 L182 72 L172 84 L156 82 L146 72 Z" fill={color} opacity={opacity} />
    </Svg>
  );
}
