// ============================================================================
// 국가별 랜드마크 실루엣 — 보딩패스 전면 배경 (스펙 8장)
//
// ⚠️ 장식이다. 공항 코드·도시명·금액·비행 경로보다 먼저 눈에 띄면 안 된다.
//    불투명도는 쓰는 쪽에서 매우 낮게 준다. 여기서는 모양만 정의한다.
//
// ⚠️ 실제 지도를 쓰지 않는다. 전 세계 지도나 한국·일본 지도를 임의의 도형으로
//    그리지도 않는다. 그 나라를 떠올리게 하는 **단순 실루엣**만 둔다.
//
// ⚠️ 뒷면에는 쓰지 않는다. 뒷면은 금액 가독성이 우선이다.
//
// 좌표계는 100 × 60 이고 y = 60 이 지면이다.
// 국가가 늘면 LANDMARK 에 한 줄 추가하면 된다. 없으면 DEFAULT 로 떨어진다.
// ============================================================================

export type Landmark = {
  /** 지면을 y=60 으로 맞춘 좌표계 */
  viewBox: string;
  paths: { d: string; fillRule?: 'evenodd' }[];
  circles?: { cx: number; cy: number; r: number }[];
};

const VIEW_BOX = '0 0 100 60';

/** 일본 — 후지산과 해 */
const JAPAN: Landmark = {
  viewBox: VIEW_BOX,
  paths: [
    {
      // ⚠️ 설선을 같은 색으로 덧그리면 산에 묻혀 보이지 않는다.
      //    evenodd 로 **구멍**을 내야 그 자리가 배경색이 되어 눈처럼 읽힌다.
      fillRule: 'evenodd',
      d: [
        // 능선. 정상 부근을 살짝 눌러 후지산 특유의 완만한 사다리꼴을 만든다
        'M 2 60 L 30 22 Q 34 17 40 17 Q 46 17 50 22 L 78 60 Z',
        // 정상 아래로 흘러내린 눈
        'M 27 28 L 32 24 L 35 27 L 39 22 L 43 27 L 46 24 L 51 28 L 47 32 L 44 29 L 40 33 L 36 29 L 32 32 Z',
      ].join(' '),
    },
  ],
  circles: [{ cx: 82, cy: 18, r: 9 }],
};

/** 프랑스 — 에펠탑 */
const FRANCE: Landmark = {
  viewBox: VIEW_BOX,
  paths: [
    // 두 다리가 안쪽으로 휘어 올라가 첨탑으로 모인다
    {
      d: 'M 32 60 C 40 44 46 30 48 16 L 52 16 C 54 30 60 44 68 60 L 60 60 C 56 46 53 32 50 22 C 47 32 44 46 40 60 Z',
    },
    // 전망대 두 층
    { d: 'M 37 40 L 63 40 L 63 43 L 37 43 Z' },
    { d: 'M 42 28 L 58 28 L 58 31 L 42 31 Z' },
    // 첨탑
    { d: 'M 48.5 16 L 50 4 L 51.5 16 Z' },
  ],
};

/** 이탈리아 — 콜로세움 */
const ITALY: Landmark = {
  viewBox: VIEW_BOX,
  paths: [
    // 바깥 벽에 아치를 뚫는다. evenodd 라 안쪽 subpath 가 구멍이 된다
    {
      fillRule: 'evenodd',
      d: [
        'M 16 60 L 16 28 Q 50 14 84 28 L 84 60 Z',
        'M 22 56 L 22 40 A 5 5 0 0 1 32 40 L 32 56 Z',
        'M 37 56 L 37 36 A 5 5 0 0 1 47 36 L 47 56 Z',
        'M 53 56 L 53 36 A 5 5 0 0 1 63 36 L 63 56 Z',
        'M 68 56 L 68 40 A 5 5 0 0 1 78 40 L 78 56 Z',
      ].join(' '),
    },
  ],
};

/** 중국 — 상하이 동방명주 */
const CHINA: Landmark = {
  viewBox: VIEW_BOX,
  paths: [
    { d: 'M 47 60 L 47 8 L 53 8 L 53 60 Z' },
    // 탑을 받치는 세 다리
    { d: 'M 36 60 L 46 40 L 49 40 L 41 60 Z' },
    { d: 'M 64 60 L 54 40 L 51 40 L 59 60 Z' },
    // 옆으로 낮은 건물 몇 채를 두어 도시처럼 보이게 한다
    { d: 'M 12 60 L 12 38 L 22 38 L 22 60 Z' },
    { d: 'M 74 60 L 74 30 L 82 30 L 82 60 Z' },
    { d: 'M 84 60 L 84 42 L 92 42 L 92 60 Z' },
  ],
  circles: [
    { cx: 50, cy: 36, r: 10 },
    { cx: 50, cy: 17, r: 6.5 },
  ],
};

/** 대만 — 타이베이 101 */
const TAIWAN: Landmark = {
  viewBox: VIEW_BOX,
  paths: [
    { d: 'M 40 60 L 40 46 L 60 46 L 60 60 Z' },
    { d: 'M 44 46 L 44 14 L 56 14 L 56 46 Z' },
    // 위로 갈수록 살짝 벌어지는 마디. 101 의 대나무 모티브다
    { d: 'M 42 44 L 58 44 L 56 39 L 44 39 Z' },
    { d: 'M 42 37 L 58 37 L 56 32 L 44 32 Z' },
    { d: 'M 42 30 L 58 30 L 56 25 L 44 25 Z' },
    { d: 'M 42 23 L 58 23 L 56 18 L 44 18 Z' },
    { d: 'M 48.5 14 L 50 3 L 51.5 14 Z' },
  ],
};

/** 홍콩 — 빅토리아 하버 스카이라인 */
const HONGKONG: Landmark = {
  viewBox: VIEW_BOX,
  paths: [
    { d: 'M 8 60 L 8 42 L 17 42 L 17 60 Z' },
    { d: 'M 19 60 L 19 32 L 27 32 L 27 60 Z' },
    // 사선으로 깎인 머리. 중국은행 타워를 떠올리게 한다
    { d: 'M 29 60 L 29 24 L 37 14 L 37 60 Z' },
    { d: 'M 39 60 L 39 36 L 46 36 L 46 60 Z' },
    // 가운데 첨탑 두 개를 세워 하버 실루엣을 잡는다
    { d: 'M 48 60 L 48 20 L 52 12 L 56 20 L 56 60 Z' },
    { d: 'M 58 60 L 58 38 L 65 38 L 65 60 Z' },
    { d: 'M 67 60 L 67 26 L 71 18 L 75 26 L 75 60 Z' },
    { d: 'M 77 60 L 77 44 L 88 44 L 88 60 Z' },
  ],
};

/** 필리핀 — 야자수와 섬 */
const PHILIPPINES: Landmark = {
  viewBox: VIEW_BOX,
  paths: [
    // 기울어 자란 줄기
    { d: 'M 56 60 Q 60 42 68 28 L 72 30 Q 64 44 62 60 Z' },
    // 잎 다섯 장
    { d: 'M 70 29 Q 56 22 46 26 Q 58 26 70 32 Z' },
    { d: 'M 70 29 Q 62 16 50 13 Q 62 20 69 32 Z' },
    { d: 'M 70 29 Q 74 14 86 10 Q 76 20 73 31 Z' },
    { d: 'M 70 29 Q 84 24 94 28 Q 82 27 71 33 Z' },
    { d: 'M 70 29 Q 80 34 86 44 Q 76 35 70 33 Z' },
    // 낮은 섬 두 개
    { d: 'M 0 60 Q 18 46 36 60 Z' },
    { d: 'M 28 60 Q 42 50 54 60 Z' },
  ],
};

/** 목적지 국가를 모를 때. 특정 나라를 연상시키지 않는 언덕과 해 */
const DEFAULT: Landmark = {
  viewBox: VIEW_BOX,
  paths: [
    { d: 'M 0 60 Q 24 34 48 60 Z' },
    { d: 'M 30 60 Q 60 28 94 60 Z' },
  ],
  circles: [{ cx: 78, cy: 16, r: 8 }],
};

const LANDMARK: Record<string, Landmark> = {
  일본: JAPAN,
  프랑스: FRANCE,
  이탈리아: ITALY,
  중국: CHINA,
  대만: TAIWAN,
  홍콩: HONGKONG,
  필리핀: PHILIPPINES,
};

/**
 * 국가 이름으로 실루엣을 고른다.
 *
 * 등록되지 않은 국가는 DEFAULT 로 떨어진다.
 * 직접 입력 목적지처럼 국가를 모르는 경우도 여기로 온다.
 */
export function countryLandmark(countryKo: string | null | undefined): Landmark {
  if (!countryKo) return DEFAULT;
  return LANDMARK[countryKo] ?? DEFAULT;
}
