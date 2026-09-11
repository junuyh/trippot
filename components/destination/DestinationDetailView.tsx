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
//   ───────────────────────────
//   [ OO로 여행 만들기 ]            ← 화면 아래 고정
//
// ⚠️ **섹션을 임의로 늘리지 않는다.** 위 목록이 전부다. 여행지마다 'OO' 자리만
//    도시 이름으로 바뀐다.
//
// ⚠️ **국가가 바뀌어도 이 화면은 같은 모양이다.** 바뀌는 것은
//    사진·도시명·국가명·공항 코드·글 내용, 그리고 국가 포인트 컬러뿐이다.
//    일본에서 프랑스로 넘어가도 같은 TripPot 으로 보여야 한다.
//    포인트 컬러가 칠해지는 자리는 tokens.ts 머리말에 적어 두었다.
//
// ⚠️ 맨 아래 '여행 만들기' 는 화면에 고정한다. 예산과 여행기를 한참 내려본
//    사람이 마음먹었을 때 버튼이 화면 밖에 있으면 안 된다.
//    홈의 떠 있는 버튼(CreateTripFab)과 같은 이유다.
//
// ⚠️ **이 버튼만 국가색 면을 크게 쓴다.** 화면에서 유일한 확정 동작이라
//    여기까지 무채색으로 두면 어디를 눌러야 하는지 알 수 없다. 나머지 국가색은
//    전부 선·아이콘·숫자처럼 좁은 자리다.
//
// 데이터만 props 로 받는다. supabase / track() 을 직접 부르지 않는다. (CLAUDE.md 9장)
// ============================================================================
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { DestinationBudgetGuide } from '@/lib/destination/budgetGuide';

import { BudgetGuideSection } from './BudgetGuideSection';
import {
  DestinationCommunitySection,
  type DestinationPostItem,
} from './DestinationCommunitySection';
import { HighlightRow, RecommendedForSection, SectionHeading } from './DestinationSections';
import { DestinationTicketCard } from './DestinationTicketCard';
import { HeadcountBudgetSection } from './HeadcountBudgetSection';
import { INK, LINE, MUTED, RADIUS } from './tokens';
import type { DestinationDetailData } from './types';

type Props = {
  destination: DestinationDetailData;
  guide: DestinationBudgetGuide;
  posts: readonly DestinationPostItem[];
  onChangeHeadcount: (next: number) => void;
  onPressPost: (postId: string) => void;
  onPressSeeAllPosts: () => void;
  onPressCreateTrip: () => void;
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
  onPressCreateTrip,
}: Props) {
  const insets = useSafeAreaInsets();
  const accent = destination.theme.primary;
  const accentSoft = destination.theme.primarySoft;

  return (
    <View className="flex-1 bg-white">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: GUTTER,
          paddingTop: 12,
          // 아래 고정 버튼에 마지막 내용이 가리지 않게 버튼 높이만큼 비운다.
          paddingBottom: 130,
        }}
      >
        <DestinationTicketCard destination={destination} />

        {/* ── OO는 이런 여행지예요! ──────────────────────────────────────── */}
        <View style={{ marginTop: GAP }}>
          <SectionHeading title={`${destination.nameKo}는 이런 여행지예요!`} accent={accent} />
          <Text style={{ fontSize: 13.5, lineHeight: 22, color: MUTED }}>
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
                  어느 쪽이 맞는지 알 수 없다. 같은 guide 에서 나온다. */
            budgetLabel={`약 ${Math.floor(guide.perPerson.min / 10_000)}만 ~ ${Math.ceil(
              guide.perPerson.max / 10_000,
            )}만원`}
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

      {/* ── 아래 고정 버튼 ─────────────────────────────────────────────── */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: GUTTER,
          paddingTop: 12,
          paddingBottom: Math.max(insets.bottom, 12) + 4,
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: LINE,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${destination.nameKo}로 여행 만들기`}
          onPress={onPressCreateTrip}
          className="items-center justify-center active:opacity-90"
          style={{ height: 52, borderRadius: RADIUS.card, backgroundColor: accent }}
        >
          <Text
            style={{
              fontSize: 15,
              fontWeight: '700',
              letterSpacing: -0.3,
              color: destination.theme.onPrimary,
            }}
          >
            {destination.nameKo}로 여행 만들기
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/** 화면 파일이 쓰는 타입을 여기서도 내보낸다. */
export type { DestinationDetailData };
export { INK };
