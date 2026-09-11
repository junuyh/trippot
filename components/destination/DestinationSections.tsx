// ============================================================================
// 여행지 상세(DEST-01) — 작은 조각들 (2026-09-11)
//
//   SectionHeading        ▎OO는 이런 여행지예요!     ← ▎가 국가색 짧은 라인
//   HighlightRow          [추천 체류 기간][여행비 가이드][추천 여행 시기]
//   RecommendedForSection ✓ 맛있는 음식을 즐기는 미식 여행자
//
// ⚠️ 이 조각들에서 국가색이 칠해지는 곳은 **세 군데뿐**이다.
//    섹션 제목 앞 짧은 라인 · 칸 안의 아이콘과 주요 값 · 체크 아이콘.
//    나머지는 흰 바탕에 딥네이비 글자다. (tokens.ts 머리말)
// ============================================================================
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { CAPTION, INK, LINE, RADIUS, softer, TITLE } from './tokens';

/** 섹션 제목. 앞의 짧은 세로 라인만 국가색이다. */
export function SectionHeading({
  title,
  accent,
  right,
}: {
  title: string;
  accent: string;
  /** 오른쪽에 붙는 것. '전체보기' 같은 링크가 들어온다. */
  right?: React.ReactNode;
}) {
  return (
    <View className="mb-3 flex-row items-center justify-between">
      <View className="flex-1 flex-row items-center">
        <View style={{ width: 3, height: 15, borderRadius: 2, backgroundColor: accent }} />
        {/* 제목 단은 여행 준비 홈 카드 제목과 같다. (tokens.TITLE) */}
        <Text numberOfLines={1} style={{ marginLeft: 8, ...TITLE }}>
          {title}
        </Text>
      </View>
      {right}
    </View>
  );
}

/** 값 세 칸. 아이콘과 값만 국가색이고 칸 바탕은 흰색이다. */
export function HighlightRow({
  accent,
  accentSoft,
  stayLabel,
  budgetLabel,
  seasonLabel,
}: {
  accent: string;
  accentSoft: string;
  stayLabel: string;
  budgetLabel: string;
  seasonLabel: string;
}) {
  const items = [
    { icon: 'calendar-outline' as const, caption: '추천 체류 기간', value: stayLabel },
    { icon: 'wallet-outline' as const, caption: '여행비 가이드', value: budgetLabel },
    { icon: 'sunny-outline' as const, caption: '추천 여행 시기', value: seasonLabel },
  ];

  return (
    <View className="flex-row" style={{ gap: 8 }}>
      {items.map((item) => (
        <View
          key={item.caption}
          className="flex-1 items-center"
          style={{
            borderWidth: 1,
            // 가운데 예산 칸만 국가색 옅은 톤이다. 세 칸이 다 희면 줄 전체가
            // 비어 보이고, 셋 다 색이면 어디를 봐야 하는지 알 수 없다.
            borderColor: item.caption === '여행비 가이드' ? softer(accentSoft) : LINE,
            backgroundColor: item.caption === '여행비 가이드' ? softer(accentSoft) : '#FFFFFF',
            borderRadius: RADIUS.card,
            paddingVertical: 14,
            paddingHorizontal: 8,
          }}
        >
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: item.caption === '여행비 가이드' ? '#FFFFFF' : accentSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name={item.icon} size={15} color={accent} />
          </View>
          <Text style={{ marginTop: 8, fontSize: 10.5, color: CAPTION }}>{item.caption}</Text>
          <Text
            numberOfLines={2}
            style={{
              marginTop: 3,
              fontSize: 12.5,
              lineHeight: 17,
              // 핵심 숫자만 굵게. 세 칸 중 가운데(예산)는 국가색이다.
              fontWeight: '700',
              letterSpacing: -0.4,
              textAlign: 'center',
              color: item.caption === '여행비 가이드' ? accent : INK,
            }}
          >
            {item.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** 이런 분들께 추천해요. 체크 아이콘만 국가색이다. */
export function RecommendedForSection({
  items,
  accent,
  accentSoft,
}: {
  items: readonly string[];
  accent: string;
  accentSoft: string;
}) {
  if (items.length === 0) return null;

  return (
    /*
      ⚠️ 바탕은 국가색 옅은 톤이되 **글자는 잉크색**이다. (2026-09-11)
         처음에 옅은 회색(#f4f6f8) 위에 회색 글자(#8b94a2)를 올려 읽기 어려웠다.
         그래서 바탕을 뺐더니 이번엔 화면이 통째로 허옇게 보였다.
         고칠 것은 바탕이 아니라 **글자색**이었다 — 옅은 색 위에 연한 회색 글자를
         올리지 않는다. 이 규칙만 지키면 색을 넣어도 읽기 어렵지 않다.
    */
    <View
      style={{
        // 넓은 칸이라 primarySoft 를 그대로 쓰면 색이 세다. (tokens.softer)
        backgroundColor: softer(accentSoft),
        borderRadius: RADIUS.card,
        paddingVertical: 15,
        paddingHorizontal: 14,
        gap: 12,
      }}
    >
      {items.map((item) => (
        <View key={item} className="flex-row items-center">
          <View
            style={{
              width: 18,
              height: 18,
              borderRadius: 9,
              backgroundColor: accent,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="checkmark" size={11} color="#FFFFFF" />
          </View>
          <Text
            style={{ marginLeft: 10, flex: 1, fontSize: 13.5, lineHeight: 20, color: INK }}
          >
            {item}
          </Text>
        </View>
      ))}
    </View>
  );
}
