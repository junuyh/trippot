// 여행 준비 홈(TRIP-HOME-01/02) 전용 컴포넌트 진입점.
//
// ⚠️ 2026-09-02 · 시안 v4 로 준비 홈 구조를 단순화하면서
//    JourneySteps(여정 단계) · VaultGrid(가상 여행 금고) · RecentTransactionList
//    는 화면에서 내렸다. 파일은 남겨 둔다 — 금고 배분 기준이 정해지면
//    VaultGrid 는 그대로 돌아올 자리가 있고, 지우면 다시 만들어야 한다.
export { BaggageTagCard } from "./BaggageTagCard";
export { CategoryGrid, type GridCategory } from "./CategoryGrid";
export { FundManagerCard } from "./FundManagerCard";
export { JourneySteps } from "./JourneySteps";
export {
  RecentTransactionList,
  type RecentTransaction,
} from "./RecentTransactionList";
// ⚠️ 2026-09-03 · 시안 v4(수하물 태그)로 바뀌면서 TravelTicketCard 는
//    화면에서 내렸다. 위 JourneySteps 와 같은 이유로 파일은 남겨 둔다.
export { TravelTicketCard } from "./TravelTicketCard";
export { TripGuideCards } from "./TripGuideCards";
export { TripSettingsButton } from "./TripSettingsButton";
export { TripSettingsSheet } from "./TripSettingsSheet";
export { VaultGrid, type VaultCategory } from "./VaultGrid";
