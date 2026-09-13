// ============================================================================
// 여행지 상세(DEST-01) 본문 — 참고 시안 구조 그대로 (2026-09-11 개편)
//
//   여행지 티켓 카드
//   OO는 이런 여행지예요!
//   추천 체류 기간 / 여행비 가이드 / 추천 여행 시기
//   이런 분들께 추천해요
//   여행비 가이드
//   항목별 평균 예산
//   함께 가면 이런 예산이에요
//   OO 관련 커뮤니티
//
// ⚠️ **섹션을 임의로 늘리지 않는다.** 위 목록이 전부다. 여행지마다 'OO' 자리만
//    도시 이름으로 바뀐다.
//
// ⚠️ **국가가 바뀌어도 이 화면은 같은 모양이다.** 바뀌는 것은
//    사진·도시명·국가명·공항 코드·글 내용, 그리고 국가 포인트 컬러뿐이다.
//    일본에서 프랑스로 넘어가도 같은 TripPot 으로 보여야 한다.
//    포인트 컬러가 칠해지는 자리는 tokens.ts 머리말에 적어 두었다.
//
// ⚠️ **여행 만들기 버튼을 두지 않는다.** (2026-09-11)
//    이 화면은 여행지를 '둘러보는' 자리다. 여행 만들기는 홈의 떠 있는
//    버튼(CreateTripFab)과 여행 탭이 맡는다. 둘러보러 들어온 사람에게
//    화면 아래를 계속 차지하는 확정 버튼을 들이밀지 않는다.
//
// 데이터만 props 로 받는다. supabase / track() 을 직접 부르지 않는다. (CLAUDE.md 9장)
// ============================================================================
import { ScrollView, Text, View } from 'react-native';

import {
  formatRangeCompact,
  type DestinationBudgetGuide,
} from '@/lib/destination/budgetGuide';

import { BudgetGuideSection } from './BudgetGuideSection';
import {
  DestinationCommunitySection,
  type DestinationPostItem,
} from './DestinationCommunitySection';
import { HighlightRow, RecommendedForSection, SectionHeading } from './DestinationSections';
import { DestinationTicketCard } from './DestinationTicketCard';
import { HeadcountBudgetSection } from './HeadcountBudgetSection';
import { CAPTION, INK } from './tokens';
import type { DestinationDetailData } from './types';

type Props = {
  destination: DestinationDetailData;
  guide: DestinationBudgetGuide;
  posts: readonly DestinationPostItem[];
  onChangeHeadcount: (next: number) => void;
  onPressPost: (postId: string) => void;
  onPressSeeAllPosts: () => void;
};

/** 좌우 여백. 시안의 밀도를 그대로 따른다. */
const GUTTER = 16;
/** 섹션 사이 간격. */
const GAP = 28;

export function DestinationDetailView({
  destination,
  guide,
  posts,
  onChangeHeadcount,
  onPressPost,
  onPressSeeAllPosts,
}: Props) {
  const accent = destination.theme.primary;
  const accentSoft = destination.theme.primarySoft;

  return (
    <View className="flex-1 bg-white">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: GUTTER,
          paddingTop: 12,
          paddingBottom: 40,
        }}
      >
        <DestinationTicketCard destination={destination} />

        {/* ── OO는 이런 여행지예요! ──────────────────────────────────────── */}
        <View style={{ marginTop: GAP }}>
          <SectionHeading title={`${destination.nameKo}는 이런 여행지예요!`} accent={accent} />
          <Text style={{ fontSize: 14.5, lineHeight: 22, color: CAPTION }}>
            {destination.intro}
          </Text>
        </View>

        {/* ── 값 세 칸 ───────────────────────────────────────────────────── */}
        <View style={{ marginTop: 16 }}>
          <HighlightRow
            accent={accent}
            accentSoft={accentSoft}
            stayLabel={destination.nights}
            /* ⚠️ 여기 금액은 아래 '여행비 가이드' 와 같은 값이다. 두 곳이 다르면
                  어느 쪽이 맞는지 알 수 없다. 같은 guide 에서 나온다.
                  칸이 좁아 짧은 표기를 쓴다. */
            budgetLabel={formatRangeCompact(guide.perPerson)}
            seasonLabel={destination.season}
          />
        </View>

        {/* ── 이런 분들께 추천해요 ───────────────────────────────────────── */}
        <View style={{ marginTop: GAP }}>
          <SectionHeading title="이런 분들께 추천해요" accent={accent} />
          <RecommendedForSection
            items={destination.recommendedFor}
            accent={accent}
            accentSoft={accentSoft}
          />
        </View>

        {/* ── 여행비 가이드 · 항목별 평균 예산 ──────────────────────────── */}
        <View style={{ marginTop: GAP }}>
          <BudgetGuideSection guide={guide} accent={accent} accentSoft={accentSoft} />
        </View>

        {/* ── 함께 가면 이런 예산이에요 ─────────────────────────────────── */}
        <View style={{ marginTop: GAP }}>
          <HeadcountBudgetSection
            guide={guide}
            accent={accent}
            accentSoft={accentSoft}
            onChangeHeadcount={onChangeHeadcount}
          />
        </View>

        {/* ── OO 관련 커뮤니티 ───────────────────────────────────────────── */}
        <View style={{ marginTop: GAP }}>
          <DestinationCommunitySection
            nameKo={destination.nameKo}
            posts={posts}
            accent={accent}
            accentSoft={accentSoft}
            onPressPost={onPressPost}
            onPressSeeAll={onPressSeeAllPosts}
          />
        </View>
      </ScrollView>

    </View>
  );
}

/** 화면 파일이 쓰는 타입을 여기서도 내보낸다. */
export type { DestinationDetailData };
export { INK };
