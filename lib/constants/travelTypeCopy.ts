// ============================================================================
// 여행 유형 표현 — 코드 10개에 입히는 문구
//
// ⚠️ 유형 **코드**는 늘리지 않는다. seed 의 travel_types 와
//    lib/constants/status.ts 의 SPENDING_PROFILE_TYPE 이 기준이고,
//    코드를 늘리면 둘 다 바꿔야 한다. (공유 파일 — CLAUDE.md 5장)
//
//    시안의 'TYPE 09 · 야무지게 놀고 야무지게 아끼고' 는 코드가 아니라 표현이다.
//    여기서 균형형(balanced)의 문구로 살렸다.
//
// ⚠️ **지금은 아홉 개 모두 캐릭터가 없다.** 한 장만 있으면 그 하나만 튀어
//    나머지 여덟이 미완성으로 읽힌다. 에셋이 다 오면 그때 한꺼번에 넣는다.
//    (09 캐릭터 PNG 는 assets/characters/ 에 그대로 둔다)
// ============================================================================
import { SPENDING_PROFILE_TYPE, type SpendingProfileType } from '@/lib/constants/status';

export type TravelTypeCopy = {
  /** 시안의 'TYPE 09' 자리. 코드가 아니라 표시용 번호다 */
  no: string;
  /** 두 줄로 끊어 쓰는 제목 */
  headline: string;
  /** 한 줄 설명 */
  description: string;
  /** 캐릭터가 없을 때 쓰는 이모지 */
  emoji: string;
  /** assets/characters/ 아래 이미지. 없으면 null */
  image: number | null;
  hashtags: string[];
};

export const TRAVEL_TYPE_COPY: Record<SpendingProfileType, TravelTypeCopy> = {
  [SPENDING_PROFILE_TYPE.GOURMET]: {
    no: '01',
    headline: '먹는 데는\n아끼지 않아요',
    description: '한 끼를 위해 걸어갈 줄 아는, 미식이 목적인 여행자',
    emoji: '🍣',
    image: null,
    hashtags: ['#먹으러간다', '#한끼는제대로', '#미식여행'],
  },
  [SPENDING_PROFILE_TYPE.LODGING_FOCUSED]: {
    no: '02',
    headline: '잘 자야\n잘 논다',
    description: '숙소가 곧 여행의 절반이라고 믿는 여행자',
    emoji: '🏨',
    image: null,
    hashtags: ['#숙소가반', '#조식포함', '#푹쉬는여행'],
  },
  [SPENDING_PROFILE_TYPE.EXPERIENCE]: {
    no: '03',
    headline: '거기서만\n할 수 있는 걸로',
    description: '가서만 할 수 있는 경험에 예산을 쏟는 여행자',
    emoji: '🎡',
    image: null,
    hashtags: ['#경험에투자', '#여기서만', '#체험여행'],
  },
  [SPENDING_PROFILE_TYPE.SHOPPING]: {
    no: '04',
    headline: '캐리어는\n갈 때보다 무겁게',
    description: '사 올 것을 미리 정해 두고 떠나는 여행자',
    emoji: '🛍️',
    image: null,
    hashtags: ['#쇼핑리스트', '#캐리어무게', '#득템여행'],
  },
  [SPENDING_PROFILE_TYPE.FRUGAL]: {
    no: '05',
    headline: '적게 쓰고\n많이 봤다',
    description: '예산을 남기고도 아쉬움 없이 다녀오는 여행자',
    emoji: '🪙',
    image: null,
    hashtags: ['#가성비여행', '#예산초과없음', '#알뜰여행'],
  },
  [SPENDING_PROFILE_TYPE.BALANCED]: {
    no: '10',
    headline: '야무지게 놀고\n야무지게 아끼고',
    description: '쓸 곳에는 쓰고, 아낄 곳은 정확히 아는 균형 감각 좋은 여행자',
    emoji: '⚖️',
    // 에셋은 assets/characters/09-smart-spender.png 에 있다. 아홉 개가 다
    // 준비되면 그때 함께 연결한다.
    image: null,
    hashtags: ['#쓸땐쓴다', '#균형여행', '#계획대로'],
  },

  [SPENDING_PROFILE_TYPE.BIG_SPENDER]: {
    no: '06',
    headline: '쓸 땐\n쓰는 거지',
    description: '아끼자고 떠난 게 아니라는 걸 아는 여행자',
    emoji: '💸',
    image: null,
    hashtags: ['#쓸땐쓴다', '#후회없이', '#플렉스여행'],
  },
  [SPENDING_PROFILE_TYPE.SPONTANEOUS]: {
    no: '07',
    headline: '일단 가서\n정한다',
    description: '계획표 대신 그날의 기분을 따라가는 여행자',
    emoji: '🎲',
    image: null,
    hashtags: ['#무계획이계획', '#발길닿는대로', '#즉흥여행'],
  },
  [SPENDING_PROFILE_TYPE.PLANNER]: {
    no: '08',
    headline: '적어둔 대로\n다녀왔다',
    description: '세운 예산과 쓴 돈이 거의 같은, 계획이 곧 결과인 여행자',
    emoji: '📋',
    image: null,
    hashtags: ['#계획대로', '#예산적중', '#계획파'],
  },
  [SPENDING_PROFILE_TYPE.EARLY_SAVER]: {
    no: '09',
    headline: '떠나기 전에\n이미 다 모았다',
    description: '출발 한 달 전에 여행자금을 채워 두고 느긋하게 떠나는 여행자',
    emoji: '🐜',
    image: null,
    hashtags: ['#미리미리', '#여행적금', '#출발전완성'],
  },
};
