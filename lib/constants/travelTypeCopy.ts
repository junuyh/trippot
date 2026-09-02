// ============================================================================
// 여행 유형 표현 — 코드 6개에 입히는 문구
//
// ⚠️ 유형 **코드**는 늘리지 않는다. seed 의 travel_types 와
//    lib/constants/status.ts 의 SPENDING_PROFILE_TYPE 이 기준이고,
//    코드를 늘리면 둘 다 바꿔야 한다. (공유 파일 — CLAUDE.md 5장)
//
//    시안의 'TYPE 09 · 야무지게 놀고 야무지게 아끼고' 는 코드가 아니라 표현이다.
//    여기서 균형형(balanced)의 문구로 살렸다.
//
// ⚠️ 캐릭터 이미지는 지금 균형형 한 장뿐이다.
//    나머지 다섯은 이모지로 대신하고, 에셋이 오면 image 에 넣는다.
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
    no: '09',
    headline: '야무지게 놀고\n야무지게 아끼고',
    description: '쓸 곳에는 쓰고, 아낄 곳은 정확히 아는 균형 감각 좋은 여행자',
    emoji: '⚖️',
    // 전달받은 캐릭터. PNG 를 base64 로 감싼 SVG 였던 것을 벗겨 줄였다
    image: require('@/assets/characters/09-smart-spender.png'),
    hashtags: ['#쓸땐쓴다', '#균형여행', '#계획대로'],
  },
};
