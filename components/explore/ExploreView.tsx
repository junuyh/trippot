// ============================================================================
// 여행지 추천 화면 본문 — /destinations (2026-09-16)
//
//   [지금 가기 좋아요] [여행 스타일] [여행 기간]
//   ─ 지금 가기 좋아요 ─  배너 세 장 → 지금 떠나기 좋은 해외여행지 격자
//                         → 다른 계절에 더 좋은 곳 격자
//   ─ 여행 스타일 ─       스타일 칩 → 그 스타일 여행지 격자
//   ─ 여행 기간 ─         기간 칩 → 그 기간 여행지 격자
//
// 카드를 누르면 여행지 상세(DEST-01)로 간다. 이동은 화면 파일이 한다.
//
// ⚠️ 검색 버튼을 두지 않는다. 시안에는 있지만 여행지가 13곳이라 검색할 만큼
//    많지 않고, 검색 화면도 없다. 누르면 아무 일도 없는 버튼을 만들지 않는다. [검토 필요]
//
// 데이터만 props 로 받는다. supabase / track() 을 직접 부르지 않는다. (CLAUDE.md 9장)
// ============================================================================
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';

import { ExploreDestinationCard } from './ExploreDestinationCard';
import { ExploreHeroCarousel } from './ExploreHeroCarousel';
import type { ExploreCardData, ExploreChip, ExploreHeroData, ExploreTab } from './types';

type Props = {
  tab: ExploreTab;
  onChangeTab: (tab: ExploreTab) => void;

  /** 지금 가기 좋아요 탭 */
  hero: ExploreHeroData[];
  nowItems: ExploreCardData[];
  laterItems: ExploreCardData[];
  /** '9월' — 섹션 제목에 쓴다 */
  monthLabel: string;

  /** 여행 스타일 · 여행 기간 탭의 칩과 선택값, 그 결과 */
  chips: ExploreChip[];
  selectedChip: string;
  onChangeChip: (key: string) => void;
  chipItems: ExploreCardData[];

  onPressDestination: (code: string) => void;
};

const TABS: { key: ExploreTab; label: string }[] = [
  { key: 'now', label: '지금 가기 좋아요' },
  { key: 'style', label: '여행 스타일' },
  { key: 'days', label: '여행 기간' },
];

const SCREEN_PADDING = 16;
const GRID_GAP = 10;

export function ExploreView({
  tab,
  onChangeTab,
  hero,
  nowItems,
  laterItems,
  monthLabel,
  chips,
  selectedChip,
  onChangeChip,
  chipItems,
  onPressDestination,
}: Props) {
  const { width } = useWindowDimensions();
  const innerWidth = Math.max(0, width - SCREEN_PADDING * 2);
  const cardWidth = Math.floor((innerWidth - GRID_GAP) / 2);

  return (
    <View className="flex-1 bg-white">
      {/* 탭. 검은 알약이 선택이다. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ paddingHorizontal: SCREEN_PADDING, paddingVertical: 10, gap: 8 }}
      >
        {TABS.map((item) => {
          const selected = item.key === tab;
          return (
            <Pressable
              key={item.key}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => onChangeTab(item.key)}
              className={`rounded-full px-4 py-2 ${selected ? 'bg-brand' : 'border border-pot-line bg-white'}`}
            >
              <Text
                style={{ fontSize: 13, fontWeight: selected ? '800' : '600' }}
                className={selected ? 'text-white' : 'text-pot-ink'}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: SCREEN_PADDING, paddingTop: 6, paddingBottom: 48 }}>
        {tab === 'now' ? (
          <>
            <ExploreHeroCarousel items={hero} width={innerWidth} onPress={onPressDestination} />

            <Section title={`${monthLabel}에 떠나기 좋은 해외여행지`} first={hero.length === 0}>
              <Grid items={nowItems} cardWidth={cardWidth} onPress={onPressDestination} />
            </Section>

            {laterItems.length > 0 ? (
              <Section title="다른 계절에 더 좋아요">
                <Grid items={laterItems} cardWidth={cardWidth} onPress={onPressDestination} />
              </Section>
            ) : null}
          </>
        ) : (
          <>
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {chips.map((chip) => {
                const selected = chip.key === selectedChip;
                return (
                  <Pressable
                    key={chip.key}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => onChangeChip(chip.key)}
                    className={`rounded-full px-3.5 py-1.5 ${selected ? 'bg-brand' : 'bg-pot-visual'}`}
                  >
                    <Text
                      style={{ fontSize: 12.5, fontWeight: selected ? '800' : '600' }}
                      className={selected ? 'text-white' : 'text-pot-mute'}
                    >
                      {chip.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Section title={`${chipItems.length}곳을 골랐어요`}>
              <Grid items={chipItems} cardWidth={cardWidth} onPress={onPressDestination} />
            </Section>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Section({ title, first = false, children }: { title: string; first?: boolean; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: first ? 4 : 24 }}>
      <Text
        className="text-pot-ink"
        style={{ marginBottom: 10, fontSize: 16, lineHeight: 21, fontWeight: '700', letterSpacing: -0.4 }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

function Grid({
  items,
  cardWidth,
  onPress,
}: {
  items: ExploreCardData[];
  cardWidth: number;
  onPress: (code: string) => void;
}) {
  if (items.length === 0) {
    return (
      <View className="items-center rounded-2xl border border-dashed border-pot-dash px-4 py-8">
        <Text className="text-pot-mute" style={{ fontSize: 13 }}>
          조건에 맞는 여행지가 아직 없어요.
        </Text>
      </View>
    );
  }
  return (
    <View className="flex-row flex-wrap" style={{ gap: GRID_GAP }}>
      {items.map((item) => (
        <ExploreDestinationCard key={item.code} item={item} width={cardWidth} onPress={onPress} />
      ))}
    </View>
  );
}
