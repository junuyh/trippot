// ============================================================================
// GROUP-01 "TripPot 모임통장 카드" 색 테마 (2026-09-13)
//
// 모임 목록 카드를 실물 금융 카드처럼 그린다. 여권(마이페이지)이 아니라 **카드**다.
// 카드마다 다른 색을 입혀 목록에서 한 장 한 장이 구분되게 한다.
//
// ── 테마 배정 규칙 ──────────────────────────────────────────────────────────
//   · 정해진 세트(6개) 중 하나를 **카드 key 로 고정** 배정한다. 랜덤이 아니다.
//     같은 모임은 앱을 껐다 켜도, 정렬이 바뀌어도 늘 같은 색이다.
//   · PERSONAL(개인 여행) 카드는 Lavender 고정. 내 여권(마이페이지)과 같은 계열이라
//     "내 것" 으로 읽힌다. 실제 모임은 나머지 5개에서 groupId 해시로 고른다.
//   · DB 에 저장하지 않는다. 나중에 사용자가 직접 고르는 기능이 생기면 그 값이
//     이 함수 결과를 덮으면 된다.
//
// ⚠️ components/mypage/passport.tsx 를 가져다 쓰지 않는다. 폴더 경계도 다르고,
//    여권(종이)과 카드(플라스틱)는 다른 물건이라 같은 색을 쓰면 안 된다.
// ⚠️ 실제 카드번호 · VALID THRU · 칩 · NFC 는 그리지 않는다. 금융 카드인 척하지 않는다.
// ============================================================================
import type { GroupTravelCardData } from './types';

export type GroupCardTheme = {
  /** 이름. 디버깅·나중에 사용자 선택 UI 에 쓴다 */
  name: string;
  /** 바탕 그라데이션 시작(왼쪽 위) · 끝(오른쪽 아래). 뮤트 파스텔 */
  paperStart: string;
  paperEnd: string;
  /** 모임명 · 여행지 · 값 */
  ink: string;
  /** 라벨 · 날짜 · 보조 글자 */
  secondary: string;
  /** 브랜드 글자 · CREATED 값 · 선택 테두리 */
  accent: string;
  /** 안쪽 구분선 */
  rule: string;
  /** 배경 장식(항로 · 도장) */
  pattern: string;
  /** 편집 모드 선택 안 됨 원 */
  unselected: string;
};

const LAVENDER: GroupCardTheme = {
  name: 'lavender',
  paperStart: '#EFECF9',
  paperEnd: '#E1DCF3',
  ink: '#2B2757',
  secondary: '#7A75A0',
  accent: '#4B3F8F',
  rule: '#D3CEE8',
  pattern: '#5B5490',
  unselected: '#B9B4D2',
};

/** 실제 모임이 나눠 갖는 테마. Lavender 는 개인 여행 전용이라 여기 없다. */
const GROUP_THEMES: GroupCardTheme[] = [
  {
    name: 'mint',
    paperStart: '#E8F4EF',
    paperEnd: '#D6EAE1',
    ink: '#1F3D34',
    secondary: '#6C8C82',
    accent: '#2F6B5A',
    rule: '#C7DED4',
    pattern: '#3E8A74',
    unselected: '#AFC9BF',
  },
  {
    name: 'sky',
    paperStart: '#E7EFF9',
    paperEnd: '#D5E3F4',
    ink: '#1E3350',
    secondary: '#6C819C',
    accent: '#2F5E96',
    rule: '#C8D7EA',
    pattern: '#3F76B5',
    unselected: '#AFC0D8',
  },
  {
    name: 'rose',
    paperStart: '#F9ECEF',
    paperEnd: '#F0DCE2',
    ink: '#4A2530',
    secondary: '#A07684',
    accent: '#9A4A5F',
    rule: '#E8CCD4',
    pattern: '#B36377',
    unselected: '#D7B8C1',
  },
  {
    name: 'sand',
    paperStart: '#F7F1E6',
    paperEnd: '#ECE2D0',
    ink: '#3F3225',
    secondary: '#9A8A72',
    accent: '#8A6A3E',
    rule: '#E3D8C4',
    pattern: '#A88553',
    unselected: '#D2C5AE',
  },
  {
    name: 'indigo',
    paperStart: '#E8EAF7',
    paperEnd: '#D7DBF0',
    ink: '#232A5C',
    secondary: '#6F76A2',
    accent: '#3A4590',
    rule: '#CBCFE8',
    pattern: '#4A569E',
    unselected: '#B3B9D8',
  },
];

/** 문자열 → 작은 정수. 같은 입력이면 늘 같은 값. (djb2) */
function hashString(value: string): number {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** 카드가 쓸 테마. PERSONAL 은 Lavender 고정, GROUP 은 groupId 로 고정 배정. */
export function pickGroupCardTheme(card: GroupTravelCardData): GroupCardTheme {
  if (card.kind === 'PERSONAL') return LAVENDER;
  return GROUP_THEMES[hashString(card.groupId) % GROUP_THEMES.length];
}

/** 장식 위치를 조금씩 다르게 할 때 쓰는 0…N 인덱스. 테마와 같은 규칙으로 고정된다. */
export function pickGroupCardVariant(card: GroupTravelCardData, variants: number): number {
  if (card.kind === 'PERSONAL') return 0;
  // 테마 인덱스와 다른 자리(÷ 7)를 써서 같은 테마끼리도 장식이 조금 달라진다.
  return Math.floor(hashString(card.groupId) / 7) % variants;
}
