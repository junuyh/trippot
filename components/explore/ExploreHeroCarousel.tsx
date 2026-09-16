// ============================================================================
// 여행지 추천 맨 위 배너 — 지금 계절에 가기 좋은 여행지 세 곳 (2026-09-16)
//
//   ╭──────────────────────────────────────────────╮ 1/3
//   │ ╭──────────────────────────────────────────╮ │
//   │ │ 선선한 바람 따라                           │ │
//   │ │ 9월의 도쿄                 🗼 랜드마크 선그림│ │
//   │ │ 가까운 거리에 볼거리가 가득한,              │ │
//   │ │ 도쿄 둘러보기 →                           │ │
//   │ ╰──────────────────────────────────────────╯ │
//   ╰──────────────────────────────────────────────╯
//    ↑ 국가색 면 + 액자 테두리 = 큰 여행 포스터
//
// ⚠️ 사진 배너가 아니다. 국가색 면 · 액자 테두리 · 펜 드로잉으로 그린 포스터다.
//
// ⚠️ **항로 점선 · 공항 코드 · 국기색 띠를 쓰지 않는다.** (2026-09-16)
//    그것들은 내 여행 카드(보딩패스 · 러기지 태그 · 여행지 상세 티켓)의 말이라,
//    추천 배너가 쓰면 내 여행과 구별되지 않는다.
//    규칙표는 components/home/DestinationSuggestCard 머리말에 있다.
//
// ⚠️ **저절로 넘어가지 않는다.** 홈의 지난 여행 목록과 같은 이유다.
//    읽는 중에 화면이 밀리면 보려던 곳을 놓친다. 손으로 넘긴다.
//
// 데이터만 props 로 받는다. supabase / track() 을 직접 부르지 않는다. (CLAUDE.md 9장)
// ============================================================================
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { LandmarkArt } from '@/components/home/landmarkScene';

import { pastel } from './pastel';
import type { ExploreHeroData } from './types';

type Props = {
  items: ExploreHeroData[];
  width: number;
  onPress: (code: string) => void;
};

const INK = '#111827';
const BODY = '#596272';
const LABEL = '#8b95a4';
const HEIGHT = 176;
const RADIUS = 18;
/** 포스터 바깥 여백. 이 여백이 있어야 안쪽 테두리가 액자처럼 보인다. */
const FRAME_PAD = 9;

export function ExploreHeroCarousel({ items, width, onPress }: Props) {
  const [page, setPage] = useState(0);

  if (items.length === 0) return null;

  function handleScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.round(event.nativeEvent.contentOffset.x / Math.max(1, width));
    setPage(Math.min(items.length - 1, Math.max(0, next)));
  }

  return (
    <View>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        // 웹은 momentum 이벤트가 없어 스크롤 끝에서 한 번 더 본다.
        onScrollEndDrag={handleScrollEnd}
        style={{ width, borderRadius: RADIUS }}
      >
        {items.map((item) => {
          const accent = item.theme.primary;
          const bg = pastel(accent, 0.08);
          return (
            <Pressable
              key={item.code}
              accessibilityRole="button"
              accessibilityLabel={`${item.title}. ${item.nameKo} 둘러보기`}
              onPress={() => onPress(item.code)}
              className="active:opacity-90"
              style={{
                width,
                height: HEIGHT,
                borderRadius: RADIUS,
                overflow: 'hidden',
                backgroundColor: bg,
                padding: FRAME_PAD,
              }}
            >
              <View
                className="flex-1"
                style={{
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: pastel(accent, 0.32),
                  paddingHorizontal: 14,
                  paddingVertical: 13,
                  overflow: 'hidden',
                }}
              >
                <LandmarkArt
                  countryKo={item.countryKo}
                  fill={bg}
                  line={pastel(accent, 0.55)}
                  width={width * 0.52}
                  height={HEIGHT * 0.62}
                  style={{ position: 'absolute', right: 6, bottom: 6 }}
                />

                {/* 포스터 머리. 추천 여행지 카드의 'VISIT' 과 같은 자리다 */}
                <Text
                  pointerEvents="none"
                  style={{ fontSize: 10, fontWeight: '800', letterSpacing: 3, color: LABEL }}
                >
                  VISIT
                </Text>

                <Text style={{ marginTop: 10, fontSize: 13, fontWeight: '600', color: BODY }}>
                  {item.lead}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{ marginTop: 2, fontSize: 25, lineHeight: 31, fontWeight: '900', letterSpacing: -0.8, color: INK }}
                >
                  {item.title}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{ marginTop: 4, maxWidth: width * 0.5, fontSize: 12, color: BODY }}
                >
                  {item.blurb.split('\n')[0]}
                </Text>

                <View className="flex-1" />
                {/* 표시일 뿐 따로 누를 수 없다. 배너 전체가 누름 영역이다. */}
                <View className="flex-row items-center" pointerEvents="none">
                  <Text style={{ fontSize: 12, fontWeight: '800', color: accent }}>
                    {item.nameKo} 둘러보기
                  </Text>
                  <Ionicons name="arrow-forward" size={12} color={accent} style={{ marginLeft: 3 }} />
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {items.length > 1 ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            right: FRAME_PAD + 10,
            top: 12,
            borderRadius: 999,
            paddingHorizontal: 8,
            paddingVertical: 2,
            backgroundColor: 'rgba(17,24,39,0.55)',
          }}
        >
          <Text style={{ fontSize: 10.5, fontWeight: '700', color: '#FFFFFF' }}>
            {page + 1}/{items.length}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
