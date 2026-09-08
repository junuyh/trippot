// ============================================================================
// 여행 유형별 상징색 + 영문 이름 — 유형 공유 이미지(TYPE-01 스토리 카드) 전용
//
// 홈의 유형 매거진 카드(TravelTypeCard)는 노란 바탕 하나로 고정이다. 그건
// "유형 카드" 라는 표식이라 유형이 바뀌어도 같아야 한다. **공유 이미지는 반대다.**
// 남의 피드에서 한눈에 "쟤는 미식형, 나는 계획파" 가 갈려 보여야 공유가 돈다.
// 그래서 유형마다 색을 준다. (2026-09-08)
//
// 색 고르는 기준
//   · 아홉 개가 서로 헷갈리지 않을 것. 비슷한 계열을 두 유형에 주지 않는다
//   · 유형의 성격이 색으로 읽힐 것 (미식=식욕의 주홍, 절약=지폐의 초록, 통 큰=보라)
//   · 배경 위에 큰 검정/흰 글자가 얹혀도 읽힐 것. ink 는 그 판단의 결과다
//
// ⚠️ 유형 코드는 늘리지 않는다. SPENDING_PROFILE_TYPE 이 기준이고 Record 라서
//    코드가 늘면 여기 누락이 컴파일 에러로 잡힌다.
// ============================================================================
import { SPENDING_PROFILE_TYPE, type SpendingProfileType } from './status';

export type TravelTypeTheme = {
  /** 바탕색 */
  bg: string;
  /** 바탕 위 글자·선 색 */
  ink: string;
  /** 형광펜·스티커·강조 */
  accent: string;
  /** 바탕에 크게 깔리는 영문 이름. 대문자 */
  nameEn: string;
  /** 결과지에 쓰는 짧은 별명. "당신은 ○○○" */
  nickname: string;
  /** 결과지 한 줄 훅. 유형 테스트 결과처럼 도발적으로 */
  hook: string;
};

export const TRAVEL_TYPE_THEME: Record<SpendingProfileType, TravelTypeTheme> = {
  [SPENDING_PROFILE_TYPE.GOURMET]: {
    bg: '#FF6B4A',
    ink: '#1F1410',
    accent: '#FFE7A8',
    nameEn: 'GOURMET',
    nickname: '한 끼에 진심인 사람',
    hook: '숙소는 대충, 저녁은 예약.',
  },
  [SPENDING_PROFILE_TYPE.LODGING_FOCUSED]: {
    bg: '#6D7CFF',
    ink: '#0F1240',
    accent: '#DDE1FF',
    nameEn: 'STAY',
    nickname: '숙소가 반인 사람',
    hook: '침대가 좋으면 여행이 좋다.',
  },
  [SPENDING_PROFILE_TYPE.EXPERIENCE]: {
    bg: '#00B8A9',
    ink: '#06302C',
    accent: '#C8FFF5',
    nameEn: 'EXPERIENCE',
    nickname: '거기서만 되는 걸 하는 사람',
    hook: '사진보다 기억에 돈을 쓴다.',
  },
  [SPENDING_PROFILE_TYPE.SHOPPING]: {
    bg: '#FF5CA8',
    ink: '#3A0A24',
    accent: '#FFE1EF',
    nameEn: 'SHOPPING',
    nickname: '캐리어가 무거워지는 사람',
    hook: '면세점은 통과, 현지 편집숍은 정독.',
  },
  [SPENDING_PROFILE_TYPE.FRUGAL]: {
    bg: '#3DBA5E',
    ink: '#0B2E17',
    accent: '#D7FFE0',
    nameEn: 'FRUGAL',
    nickname: '남기고 오는 사람',
    hook: '예산은 남기고 후회는 안 남긴다.',
  },
  [SPENDING_PROFILE_TYPE.BIG_SPENDER]: {
    bg: '#7B3FE4',
    ink: '#FFFFFF',
    accent: '#F6C945',
    nameEn: 'BIG SPENDER',
    nickname: '쓸 땐 쓰는 사람',
    hook: '아끼려고 온 거 아니잖아.',
  },
  [SPENDING_PROFILE_TYPE.SPONTANEOUS]: {
    bg: '#FFD92F',
    ink: '#111827',
    accent: '#FF6A78',
    nameEn: 'SPONTANEOUS',
    nickname: '일단 가서 정하는 사람',
    hook: '계획표 대신 그날의 기분.',
  },
  [SPENDING_PROFILE_TYPE.PLANNER]: {
    bg: '#1E3A8A',
    ink: '#FFFFFF',
    accent: '#9EE7FF',
    nameEn: 'PLANNER',
    nickname: '적어둔 대로 다녀온 사람',
    hook: '예산과 지출이 소수점까지 만났다.',
  },
  [SPENDING_PROFILE_TYPE.BALANCED]: {
    bg: '#F1EDE4',
    ink: '#1B2540',
    accent: '#FF6A78',
    nameEn: 'BALANCED',
    nickname: '야무진 사람',
    hook: '쓸 데 쓰고 아낄 데 아꼈다. 끝.',
  },
};

export function travelTypeTheme(code: SpendingProfileType): TravelTypeTheme {
  return TRAVEL_TYPE_THEME[code];
}
