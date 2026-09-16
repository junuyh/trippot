// ============================================================================
// GROUP-01 "TripPot 모임통장 카드" 색 테마 (2026-09-13)
//
// 모임 목록 카드를 실물 금융 카드처럼 그린다. 여권(마이페이지)이 아니라 **카드**다.
// 카드마다 다른 색을 입혀 목록에서 한 장 한 장이 구분되게 한다.
//
// ── 테마 배정 규칙 (2026-09-14 · 총 7종) ───────────────────────────────────
//   · PERSONAL(개인 여행) 카드는 **Lavender Air 1종 고정**.
//     내 여권(마이페이지)과 같은 계열이라 "내 것" 으로 읽힌다.
//   · 실제 모임은 **GROUP 전용 6종**(Mint Journey · Sky Route · Sunset Rose · Sand Dune ·
//     Night Indigo · Terracotta Route)을 **겹치지 않게 순서대로** 받는다.
//       모임을 created_at ASC → groupId ASC 로 세운 "안정 순서" 에서
//       0번째 = mint, 1번째 = sky, … 5번째 = terracotta, 6번째 = 다시 mint.
//     그래서 개인 카드 1장 + 모임 6장까지는 7색이 전부 다르고, 7번째 모임부터 순환한다.
//   · ⚠️ 해시 % 6 을 폐기했다. 모임이 두세 개뿐인데도 충돌로 같은 색이 나왔다.
//   · ⚠️ 화면 정렬(최근 여행순 · 사용자 지정순)과 무관하다. 색은 안정 순서로만 정한다.
//     정렬을 바꿔도, 화면에 다시 들어와도, 앱을 껐다 켜도 같은 모임은 같은 색이다.
//     created_at 오름차순이라 새 모임이 생겨도 기존 모임의 자리가 밀리지 않는다.
//   · 두 풀은 겹치지 않는다 — Lavender 는 모임에 나오지 않는다.
//   · 이름(name)은 개발용 토큰이다. 화면에 보여주지 않는다.
//   · DB 에 저장하지 않는다. 나중에 사용자가 직접 고르는 기능(groups.theme_key 같은
//     명시 컬럼)이 생기면 그 값이 이 배정을 덮으면 된다. [검토 필요]
//
// ⚠️ components/mypage/passport.tsx 를 가져다 쓰지 않는다. 폴더 경계도 다르고,
//    여권(종이)과 카드(플라스틱)는 다른 물건이라 같은 색을 쓰면 안 된다.
// ⚠️ 실제 카드번호 · VALID THRU · 칩 · NFC 는 그리지 않는다. 금융 카드인 척하지 않는다.
// ============================================================================
import { groupTravelCardKey, type GroupTravelCardData } from './types';

export type GroupCardTheme = {
  /** 이름. 디버깅·나중에 사용자 선택 UI 에 쓴다 */
  name: string;
  /** 바탕 그라데이션 시작(왼쪽 위) · 끝(오른쪽 아래). 같은 hue 의 soft~medium tint (2026-09-17 한 단계 진하게 · accent 쪽 12~14% 블렌드) */
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

/** Lavender Air — 개인 여행 전용. */
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

/**
 * 실제 모임이 나눠 갖는 6종. Lavender 는 개인 여행 전용이라 여기 없다.
 *   mint = Mint Journey · sky = Sky Route · rose = Sunset Rose · sand = Sand Dune ·
 *   indigo = Night Indigo · terracotta = Terracotta Route
 * ⚠️ 순서를 바꾸면 기존 모임의 색이 바뀐다. 끝에만 붙인다.
 */
const GROUP_THEMES: GroupCardTheme[] = [
  {
    name: 'mint',
    paperStart: '#D2E4DD',
    paperEnd: '#BFD8CE',
    ink: '#1F3D34',
    secondary: '#6C8C82',
    accent: '#2F6B5A',
    rule: '#C7DED4',
    pattern: '#3E8A74',
    unselected: '#AFC9BF',
  },
  {
    name: 'sky',
    paperStart: '#D1DEED',
    paperEnd: '#BED0E7',
    ink: '#1E3350',
    secondary: '#6C819C',
    accent: '#2F5E96',
    rule: '#C8D7EA',
    pattern: '#3F76B5',
    unselected: '#AFC0D8',
  },
  {
    name: 'rose',
    paperStart: '#EED9DE',
    paperEnd: '#E4C8D0',
    ink: '#4A2530',
    secondary: '#A07684',
    accent: '#9A4A5F',
    rule: '#E8CCD4',
    pattern: '#B36377',
    unselected: '#D7B8C1',
  },
  {
    name: 'sand',
    paperStart: '#EAE1D2',
    paperEnd: '#DED1BC',
    ink: '#3F3225',
    secondary: '#9A8A72',
    accent: '#8A6A3E',
    rule: '#E3D8C4',
    pattern: '#A88553',
    unselected: '#D2C5AE',
  },
  {
    name: 'indigo',
    paperStart: '#D3D6EB',
    paperEnd: '#C1C6E3',
    ink: '#232A5C',
    secondary: '#6F76A2',
    accent: '#3A4590',
    rule: '#CBCFE8',
    pattern: '#4A569E',
    unselected: '#B3B9D8',
  },
  {
    // Terracotta Route — 따뜻한 벽돌 · 살구 · 브라운. 석양 진 오래된 골목.
    // rose(핑크) · sand(베이지) 사이가 아니라 그 옆의 **주황빛 갈색** 이다.
    // 쨍한 주황이 아니라 채도를 낮춘 벽돌색. 잉크는 가지색 섞인 진갈색.
    name: 'terracotta',
    paperStart: '#EED7CB',
    paperEnd: '#E3C0AE',
    ink: '#4A2C26',
    secondary: '#A47B6B',
    accent: '#9B5A3F',
    rule: '#E7CDBF',
    pattern: '#B9744F',
    unselected: '#D8B7A5',
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

/**
 * 모임 6색 배정의 **단일 기준** — 목록(GROUP-01)과 상세(GROUP-02)가 같은 함수를 쓴다. (2026-09-17)
 * 입력은 내가 속한 모임 전체(created_at · groupId). 안정 순서(created_at ASC → groupId ASC)로
 * 0번째 = mint … 5번째 = terracotta, 이후 순환. 화면 정렬 · 진입 경로와 무관하게 같은 모임 = 같은 색.
 * ⚠️ 상세에서 다시 계산할 때도 반드시 **전체 목록**을 넣는다. 한 모임만 넣으면 항상 mint 가 된다.
 */
export function assignGroupThemesByOrder(
  groups: { groupId: string; createdAt: string }[],
): Map<string, GroupCardTheme> {
  const themes = new Map<string, GroupCardTheme>();
  [...groups]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.groupId.localeCompare(b.groupId))
    .forEach((group, index) => {
      themes.set(group.groupId, GROUP_THEMES[index % GROUP_THEMES.length]);
    });
  return themes;
}

/**
 * 목록 전체의 테마 배정. key = groupTravelCardKey(card).
 *
 * PERSONAL → Lavender Air. GROUP → created_at ASC · groupId ASC 순서로 6색을 한 번씩,
 * 7번째부터 순환. 화면 정렬과 무관하게 같은 입력이면 같은 결과다.
 *
 * ⚠️ 카드 하나만 보고는 못 정한다. 겹치지 않으려면 목록 전체가 필요하다.
 *    그래서 GroupTravelCardList 가 한 번 계산해 카드에 내려준다.
 */
export function assignGroupCardThemes(
  cards: GroupTravelCardData[],
): Map<string, GroupCardTheme> {
  const themes = new Map<string, GroupCardTheme>();

  const byGroupId = assignGroupThemesByOrder(
    cards
      .filter((card): card is Extract<GroupTravelCardData, { kind: 'GROUP' }> => card.kind === 'GROUP')
      .map((card) => ({ groupId: card.groupId, createdAt: card.createdAt })),
  );
  for (const card of cards) {
    if (card.kind === 'GROUP') {
      const theme = byGroupId.get(card.groupId);
      if (theme) themes.set(groupTravelCardKey(card), theme);
    }
  }

  for (const card of cards) {
    if (card.kind === 'PERSONAL') themes.set(groupTravelCardKey(card), LAVENDER);
  }

  return themes;
}

/** Map 에 없을 때의 안전값. 목록을 거치지 않고 카드를 그리는 경우는 없지만 타입상 둔다. */
export const FALLBACK_GROUP_CARD_THEME: GroupCardTheme = LAVENDER;

/** 장식 위치를 조금씩 다르게 할 때 쓰는 0…N 인덱스. 테마와 같은 규칙으로 고정된다. */
export function pickGroupCardVariant(card: GroupTravelCardData, variants: number): number {
  if (card.kind === 'PERSONAL') return 0;
  // 테마 인덱스와 다른 자리(÷ 7)를 써서 같은 테마끼리도 장식이 조금 달라진다.
  return Math.floor(hashString(card.groupId) / 7) % variants;
}
