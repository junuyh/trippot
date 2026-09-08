// ============================================================================
// 여행자 신분증 (TRAVELER ID) — 여행 유형을 보여주는 공통 카드
//
// 세 곳이 같은 카드를 쓴다. 어디서 봐도 같은 얼굴이어야 "내 유형" 으로 기억된다.
//   · TRIP-HOME-02 홈의 유형 카드 (TravelTypeCard)
//   · TYPE-01 오버레이 상단 (TypeResultOverlay)
//   · 공유 이미지 (TypeStoryCard)
//
// 흰 카드 고정. 어떤 유형색 바탕 위에서도 글자가 읽힌다.
// 사진칸(이모지) · 항목(유형·별명·여행지) · 영수증 줄 · 바코드 · VERIFIED 도장.
// 바코드는 카드 하단에 가로로 꽉 채운다. 짧게 한쪽에 두면 어정쩡해 보인다.
// 일련번호(TP-01-…)는 뺐다. 의미 없는 문자열이 두 번 찍혀 있었다. (2026-09-08)
// 영수증 줄이 여행 금융 서비스라는 걸 드러낸다. 다른 유형 테스트에는 없는 것.
//
// ⚠️ 숫자는 전부 부모가 넘겨준다. 여기서 다시 계산하지 않는다.
// ⚠️ 이 컴포넌트는 supabase 도 track() 도 부르지 않는다. (CLAUDE.md 9장)
// ============================================================================
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import type { SpendingProfileType } from '@/lib/constants/status';
import { SPENDING_PROFILE_TYPE_LABEL } from '@/lib/constants/status';
import { TRAVEL_TYPE_COPY } from '@/lib/constants/travelTypeCopy';
import { travelTypeTheme } from '@/lib/constants/travelTypeTheme';

export const ID_CARD_INK = '#141b28';
const MUTED = '#6b7280';
/** 균형형은 바탕이 아이보리라 바탕색을 강조색으로 못 쓴다. 그때의 대체색 */
const IVORY_BG = '#F1EDE4';
const IVORY_ACCENT = '#FF6A78';

/**
 * 바코드 막대. [막대 폭, 뒤 여백] 비율. 카드 폭에 맞춰 flex 로 늘어난다.
 * 고정 패턴이라 캡처마다 같다.
 */
const BARS: readonly [number, number][] = [
  [2, 1], [1, 1], [3, 2], [1, 1], [1, 2], [2, 1], [1, 1], [3, 1], [2, 2], [1, 1],
  [1, 1], [2, 2], [3, 1], [1, 1], [2, 1], [1, 2], [1, 1], [3, 1], [1, 2], [2, 1],
  [2, 1], [1, 1], [3, 2], [1, 1], [1, 1], [2, 2], [1, 1], [2, 1], [3, 1], [1, 2],
  [1, 1], [2, 1], [1, 1], [3, 1], [2, 2], [1, 1], [2, 1], [1, 1], [3, 1], [2, 0],
];

export type TypeIdCardProps = {
  code: SpendingProfileType;
  /** 예산 정확도. basis point. 9800 = 98% */
  accuracyBp: number;
  /** 영문 도시명. 없으면 '' */
  destinationEn: string;
  /** "2026.05.14 – 05.17" 같은 기간 문구. 없으면 null */
  periodLabel: string | null;
  /** 가장 많이 쓴 카테고리. 없으면 null */
  topSpentLabel: string | null;
  /** 가장 많이 아낀 카테고리. 없으면 null */
  topSavedLabel: string | null;
  /** 살짝 기울여 얹은 느낌. 공유 이미지에서 켠다 */
  tilted?: boolean;
};

export function TypeIdCard({
  code,
  accuracyBp,
  destinationEn,
  periodLabel,
  topSpentLabel,
  topSavedLabel,
  tilted = false,
}: TypeIdCardProps) {
  const theme = travelTypeTheme(code);
  const copy = TRAVEL_TYPE_COPY[code];
  const label = SPENDING_PROFILE_TYPE_LABEL[code];
  const accuracy = (accuracyBp / 100).toFixed(1).replace(/\.0$/, '');
  /** 카드 안에서 유형색으로 강조할 때 쓰는 색 */
  const stampColor = theme.bg === IVORY_BG ? IVORY_ACCENT : theme.bg;

  return (
    <View
      style={{
        borderRadius: 14,
        backgroundColor: '#fff',
        overflow: 'hidden',
        transform: tilted ? [{ rotate: '-2deg' }] : undefined,
        shadowColor: '#000',
        shadowOpacity: 0.22,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 8 },
        elevation: 8,
      }}
    >
      {/* 카드 머리띠 */}
      <View
        style={{
          height: 26,
          paddingHorizontal: 12,
          backgroundColor: ID_CARD_INK,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Ionicons name="airplane" size={10} color="#fff" />
          <Text style={{ fontSize: 8, fontWeight: '900', letterSpacing: 1.5, color: '#fff' }}>
            TRAVELER ID
          </Text>
        </View>
        <Text style={{ fontSize: 8, fontWeight: '900', letterSpacing: 2, color: '#fff' }}>
          TRIPPOT
        </Text>
      </View>

      <View style={{ padding: 12, flexDirection: 'row', gap: 12 }}>
        {/* 사진칸 */}
        <View style={{ alignItems: 'center', gap: 4 }}>
          <View
            style={{
              width: 64,
              height: 78,
              borderRadius: 8,
              backgroundColor: theme.accent,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: '#e5e7eb',
            }}
          >
            <Text style={{ fontSize: 36 }}>{copy.emoji}</Text>
          </View>
          <Text style={{ fontSize: 7, fontWeight: '800', letterSpacing: 1, color: MUTED }}>
            {theme.nameEn}
          </Text>
        </View>

        {/* 항목 */}
        <View style={{ flex: 1, gap: 6 }}>
          <Field label="TYPE" value={label} big />
          <Field label="NICKNAME" value={theme.nickname} />
          <Field
            label="TRIP"
            value={[destinationEn, periodLabel].filter(Boolean).join('\n') || '—'}
            lines={2}
          />
        </View>
      </View>

      {/* 영수증 줄 */}
      <View
        style={{
          marginHorizontal: 12,
          borderTopWidth: 1,
          borderColor: '#e5e7eb',
          borderStyle: 'dashed',
          paddingVertical: 8,
          flexDirection: 'row',
        }}
      >
        <Stat label="예산 정확도" value={`${accuracy}%`} color={stampColor} />
        <StatDivider />
        <Stat label="최대 지출" value={topSpentLabel ?? '—'} />
        <StatDivider />
        <Stat label="절약 1위" value={topSavedLabel ?? '—'} />
      </View>

      {/* 바코드. 카드 폭에 맞춰 가로로 꽉 채운다 */}
      <View style={{ paddingHorizontal: 12, paddingBottom: 10, paddingTop: 2 }}>
        <View style={{ flexDirection: 'row', height: 22 }}>
          {BARS.map(([bar, gap], index) => (
            <View key={index} style={{ flexDirection: 'row', flex: bar + gap }}>
              <View style={{ flex: bar, backgroundColor: ID_CARD_INK }} />
              <View style={{ flex: gap }} />
            </View>
          ))}
        </View>
        <Text
          style={{
            marginTop: 4,
            fontSize: 6.5,
            letterSpacing: 2,
            color: MUTED,
            textAlign: 'center',
          }}
        >
          ISSUED BY TRIPPOT · TRAVEL TYPE NO. {copy.no}
        </Text>
      </View>

      {/* VERIFIED 도장 */}
      <View
        style={{
          position: 'absolute',
          right: 10,
          top: 34,
          paddingHorizontal: 7,
          paddingVertical: 3,
          borderRadius: 4,
          borderWidth: 1.5,
          borderColor: stampColor,
          transform: [{ rotate: '12deg' }],
        }}
      >
        <Text style={{ fontSize: 7, fontWeight: '900', letterSpacing: 1, color: stampColor }}>
          VERIFIED ✓
        </Text>
      </View>
    </View>
  );
}

function Field({
  label,
  value,
  big = false,
  lines = 1,
}: {
  label: string;
  value: string;
  big?: boolean;
  lines?: number;
}) {
  return (
    <View>
      <Text style={{ fontSize: 6.5, fontWeight: '800', letterSpacing: 1, color: MUTED }}>{label}</Text>
      <Text
        style={{
          marginTop: 1,
          fontSize: big ? 15 : 10,
          lineHeight: big ? 19 : 14,
          fontWeight: big ? '900' : '700',
          color: ID_CARD_INK,
        }}
        numberOfLines={lines}
      >
        {value}
      </Text>
    </View>
  );
}

function Stat({ label, value, color = ID_CARD_INK }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 1 }}>
      <Text style={{ fontSize: 7, fontWeight: '700', color: MUTED }}>{label}</Text>
      <Text style={{ fontSize: 12, fontWeight: '900', color }} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function StatDivider() {
  return <View style={{ width: 1, backgroundColor: '#e5e7eb', marginVertical: 2 }} />;
}
