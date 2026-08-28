// ============================================================================
// 여행 생성 3단계(TRIP-01 → 02 → 03) 입력값 보관
//
// ⚠️ 단계마다 DB 에 쓰지 않는다. 전부 여기 모았다가 TRIP-03 완료 시 한 번에 저장한다.
//
//    중간에 이탈한 사용자의 빈 PLANNING 여행이 쌓이면
//    trip_created(Activation 지표)의 분모가 오염된다.
//    "여행을 만들기 시작한 사람" 과 "여행을 만든 사람" 이 구분되지 않는다.
//
//    이 Context 가 살아 있는 범위는 app/trips/new/_layout.tsx 안뿐이다.
//    생성 흐름을 벗어나면 draft 는 사라진다. 임시저장은 [Future] 다.
// ============================================================================
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import type { DestinationCode, RegionCode } from '@/lib/constants/destinations';
import type { CompanionType, EntryPoint, TravelStyle } from '@/lib/constants/status';

/**
 * 생성 흐름에서 모으는 값.
 *
 * TRIP-03 필드는 해당 화면을 만들 때 추가한다.
 * 지금 빈 껍데기를 미리 만들어 두지 않는다. (CLAUDE.md 9장)
 */
export type TripDraft = {
  // ── TRIP-01 ──────────────────────────────────────────────────────────
  /** 퍼널 시작점. 진입 param 이 없으면 'home'. (docs/README.md §5 #17) */
  entryPoint: EntryPoint;
  companionType: CompanionType | null;
  /** 기존 모임을 골랐을 때만 채워진다 */
  groupId: string | null;
  /** 신규 모임을 골랐을 때만 채워진다. 모임 생성은 TRIP-03 에서 한다 */
  newGroupName: string | null;
  /**
   * 동행자 이름. trip_members.display_name 으로 저장한다.
   * 본인은 포함하지 않는다. (docs/README.md §5 #15)
   */
  companionNames: string[];
  /** 과거 데이터 반영 여부. 물어보지 않았으면 null */
  applyPastData: boolean | null;
  /** 결산 완료된 과거 여행 수. 0 이면 반영 여부를 묻지 않는다 */
  pastTripCount: number;
  /**
   * 고른 기존 모임의 참여 멤버 수. TRIP-02 인원 기본값으로 쓴다.
   * 기존 모임이 아니면 0 이다.
   */
  groupMemberCount: number;

  // ── TRIP-02 ──────────────────────────────────────────────────────────
  /** 목록에서 고른 목적지. 직접 입력이면 null */
  destinationCode: DestinationCode | null;
  /** trips.destination(text) 에 저장할 한글명. 목록/직접입력 둘 다 여기 담긴다 */
  destinationName: string | null;
  /**
   * 기준 금액을 찾을 지역.
   * 목록 선택이면 그 목적지의 region, 직접 입력이면 사용자가 고른 값이다.
   * 직접 입력 목적지의 지역을 문자열로 추정하지 않는다. (docs/README.md §5 #12)
   */
  region: RegionCode | null;
  /** true 면 기준 데이터가 없어 지역 평균으로 추천한다 (NFR-004 안내 문구 노출) */
  isCustomDestination: boolean;
  /** 'YYYY-MM-DD'. trips.start_date 는 date 타입이라 시각을 담지 않는다 */
  startDate: string | null;
  endDate: string | null;
  /** trips.headcount. DB CHECK 로 0 이하가 막혀 있다 */
  headcount: number;
  travelStyle: TravelStyle | null;
};

const INITIAL_DRAFT: TripDraft = {
  entryPoint: 'home',
  companionType: null,
  groupId: null,
  newGroupName: null,
  companionNames: [],
  applyPastData: null,
  pastTripCount: 0,
  groupMemberCount: 0,

  destinationCode: null,
  destinationName: null,
  region: null,
  isCustomDestination: false,
  startDate: null,
  endDate: null,
  headcount: 1,
  travelStyle: null,
};

type TripDraftContextValue = {
  draft: TripDraft;
  /** 넘긴 필드만 덮어쓴다. */
  patchDraft: (patch: Partial<TripDraft>) => void;
  resetDraft: () => void;
};

const TripDraftContext = createContext<TripDraftContextValue | null>(null);

export function TripDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<TripDraft>(INITIAL_DRAFT);

  const patchDraft = useCallback((patch: Partial<TripDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetDraft = useCallback(() => setDraft(INITIAL_DRAFT), []);

  const value = useMemo(
    () => ({ draft, patchDraft, resetDraft }),
    [draft, patchDraft, resetDraft],
  );

  return <TripDraftContext.Provider value={value}>{children}</TripDraftContext.Provider>;
}

/** app/trips/new/* 안에서만 쓴다. 바깥에서 부르면 던진다. */
export function useTripDraft(): TripDraftContextValue {
  const context = useContext(TripDraftContext);
  if (!context) {
    throw new Error('useTripDraft 는 TripDraftProvider(app/trips/new/_layout.tsx) 안에서만 쓴다.');
  }
  return context;
}
