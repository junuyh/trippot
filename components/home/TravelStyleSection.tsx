// ============================================================================
// 1-4. 여행 스타일로 떠나보기 — 기존 사용자 홈 맨 아래 (2026-09-16)
//
//   ┌────────┐ ┌────────┐ ┌────────┐
//   │  (🍴)  │ │  (🏢)  │ │  (👜)  │   ← 흰 타일 · 옅은 회색 동그라미 · 선 아이콘
//   │미식 여행│ │도시 여행│ │쇼핑 여행│
//   │  8곳   │ │  9곳   │ │  4곳   │
//   └────────┘ └────────┘ └────────┘
//
// 누르면 여행지 추천 화면의 '여행 스타일' 탭이 그 스타일을 고른 채 열린다.
//
// ⚠️ **타일마다 다른 파스텔을 쓰지 않는다.** 시안은 분홍 · 민트 · 보라 타일이지만,
//    뜻 없는 색 돌려쓰기는 화면을 알록달록하게만 만든다. (components/home/palette.ts)
//    스타일은 나라가 아니라 국가색도 쓸 수 없어서 무채색 선 아이콘으로 둔다.
//
// ⚠️ 이모지를 쓰지 않는다. 윈도우 · 안드로이드마다 그림이 달라져 한 벌로 보이지 않는다.
//
// ⚠️ 'N곳' 은 실제로 걸리는 여행지 수다. 0곳인 스타일은 화면 파일이 넣지 않는다.
//
// 데이터만 props 로 받는다. supabase / track() 을 직접 부르지 않는다. (CLAUDE.md 9장)
// ============================================================================
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { HOME_CARD_LINE, HOME_RADIUS, HOME_SUBTLE } from './palette';
import { SectionHeader } from './SectionHeader';

export type TravelStyleTile = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  count: number;
};

type Props = {
  tiles: TravelStyleTile[];
  onPressStyle: (key: string) => void;
  onPressSeeAll: () => void;
};

export function TravelStyleSection({ tiles, onPressStyle, onPressSeeAll }: Props) {
  if (tiles.length === 0) return null;

  return (
    <View>
      <SectionHeader title="여행 스타일로 떠나보기" actionLabel="전체 보기" onPressAction={onPressSeeAll} />
      <View className="flex-row flex-wrap" style={{ gap: 8 }}>
        {tiles.map((tile) => (
          <Pressable
            key={tile.key}
            accessibilityRole="button"
            accessibilityLabel={`${tile.label}, 여행지 ${tile.count}곳`}
            onPress={() => onPressStyle(tile.key)}
            className="items-center bg-white active:opacity-80"
            style={{
              // 세 칸. gap 8 두 번을 빼고 나눈다.
              width: '31.6%',
              paddingVertical: 12,
              borderRadius: HOME_RADIUS.card,
              borderWidth: 1,
              borderColor: HOME_CARD_LINE,
            }}
          >
            <View className="h-10 w-10 items-center justify-center rounded-full bg-pot-visual">
              <Ionicons name={tile.icon} size={20} color="#111827" />
            </View>
            <Text className="mt-2 text-pot-ink" style={{ fontSize: 12.5, fontWeight: '700', letterSpacing: -0.3 }}>
              {tile.label}
            </Text>
            <Text style={{ marginTop: 1, fontSize: 10.5, color: HOME_SUBTLE }}>{tile.count}곳</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
