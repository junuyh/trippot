// ============================================================================
// 여행 스토리 이미지 티저 (TRIP-HOME-02, 한 줄 기록 카드 바로 아래)
//
// "이미지 만들기" 라는 글자만으로는 무엇이 만들어지는지 모른다. 그래서 **실제
// 스토리 카드를 작게 그대로 보여준다.** 사진·달력·지도·이름이 이미 채워진 채로
// 비스듬히 놓여 있으면 "이게 내 거구나" 가 먼저 보인다.
//
// ⚠️ 미리보기는 TripStoryCard 그 자체를 축소한 것이다. 따로 그린 그림이 아니라서
//    시트에서 보는 것과 항상 같다. 단, 손이 닿지 않게 pointerEvents 를 끈다.
//
// ⚠️ 이 컴포넌트는 supabase 도 track() 도 부르지 않는다. (CLAUDE.md 9장)
// ============================================================================
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';

import { STORY_HEIGHT, STORY_WIDTH, TripStoryCard } from './TripStoryCard';

/** 미리보기 축소 비율. 카드 높이가 티저 카드 안에 들어오는 크기 */
const PREVIEW_SCALE = 0.3;
const PREVIEW_W = Math.round(STORY_WIDTH * PREVIEW_SCALE);
const PREVIEW_H = Math.round(STORY_HEIGHT * PREVIEW_SCALE);

type CardProps = ComponentProps<typeof TripStoryCard>;

type Props = {
  card: Omit<
    CardProps,
    | 'titleStyle'
    | 'membersStyle'
    | 'onChangeTitleScale'
    | 'onChangeMembersScale'
    | 'selected'
    | 'onSelect'
    | 'mapScale'
    | 'onChangeMapScale'
    | 'onStickerActiveChange'
    | 'onChangeMembersText'
  >;
  onPress: () => void;
};

export function TripStoryTeaser({ card, onPress }: Props) {
  const { theme } = card;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="여행 스토리 이미지 만들기"
      onPress={onPress}
      className="active:opacity-90"
      style={{
        marginTop: 10,
        borderRadius: 18,
        overflow: 'hidden',
        backgroundColor: theme.neutral,
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 14,
      }}
    >
      {/* 배경 장식. 국가색 원을 살짝 깔아 카드가 납작해 보이지 않게 한다 */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          right: -40,
          top: -50,
          width: 180,
          height: 180,
          borderRadius: 90,
          backgroundColor: theme.primary,
          opacity: 0.18,
        }}
      />

      {/* ── 미리보기: 실제 카드를 축소 ── */}
      <View
        pointerEvents="none"
        style={{
          width: PREVIEW_W + 6,
          height: PREVIEW_H + 6,
          padding: 3,
          borderRadius: 10,
          backgroundColor: '#fff',
          transform: [{ rotate: '-5deg' }],
          shadowColor: '#000',
          shadowOpacity: 0.35,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        }}
      >
        <View style={{ width: PREVIEW_W, height: PREVIEW_H, borderRadius: 7, overflow: 'hidden' }}>
          <View
            style={{
              width: STORY_WIDTH,
              height: STORY_HEIGHT,
              transform: [{ scale: PREVIEW_SCALE }],
              transformOrigin: 'top left',
            }}
          >
            <TripStoryCard
              {...card}
              titleStyle={{ scale: 1 }}
              membersStyle={{ scale: 1 }}
              selected={null}
              mapScale={1}
            />
          </View>
        </View>
      </View>

      {/* ── 문구 ── */}
      <View style={{ flex: 1, gap: 4 }}>
        <Text
          style={{
            color: 'rgba(255,255,255,0.6)',
            fontSize: 9,
            fontWeight: '800',
            letterSpacing: 2,
          }}
        >
          TRAVEL STORY
        </Text>
        <Text style={{ color: '#fff', fontSize: 16, lineHeight: 22, fontWeight: '800' }}>
          이번 여행, 스토리 한 장으로{'\n'}남겨볼까요?
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, lineHeight: 16 }}>
          달력·지도·함께 간 사람까지 이미 채워뒀어요. 사진 한 장만 고르면 끝.
        </Text>
        <View
          style={{
            alignSelf: 'flex-start',
            marginTop: 6,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: 12,
            paddingVertical: 7,
            borderRadius: 999,
            backgroundColor: '#fff',
          }}
        >
          <Ionicons name="sparkles" size={12} color={theme.primary} />
          <Text style={{ color: theme.neutral, fontSize: 12, fontWeight: '800' }}>
            이미지 만들기
          </Text>
          <Ionicons name="chevron-forward" size={12} color={theme.neutral} />
        </View>
      </View>
    </Pressable>
  );
}
