// ============================================================================
// 여행 유형 공유 이미지 (TYPE-01 스토리 카드, 9:16) — 여행자 신분증 컨셉
//
// "나는 어떤 여행자?" 결과지를 **TRAVELER ID 카드**로 만든다. (2026-09-08 v2)
// v1 은 큰 글자 포스터였는데 락 페스티벌 포스터처럼 보였다. 이 앱은 보딩패스·
// 영수증·여권 도장의 언어를 쓴다. 유형 결과도 그 언어로 낸다: 색 바탕 위에
// 흰 ID 카드 한 장. 사진칸(이모지), 항목(유형·별명·여행지), 영수증 줄, 바코드,
// VERIFIED 도장. 요즘 공유되는 "○○ 신분증" 결과 형식이라 보는 사람도 익숙하다.
//
//   · 유형마다 바탕색이 다르다 (lib/constants/travelTypeTheme). 색만 봐도 유형이 갈린다
//   · 카드는 흰색 고정. 어떤 바탕이든 글자가 읽힌다
//   · 흐리게(opacity) 처리한 글자를 두지 않는다. 폰에서 작게 볼 때 전부 사라진다
//   · 카드 안 영수증 줄(예산 정확도 · 최대 지출 · 절약 1위)이 여행 금융
//     서비스라는 걸 드러낸다. 다른 유형 테스트에는 없는 것
//   · 마지막 줄이 유입 장치: "나는 어떤 여행자? → @TRIPPOT"
//
// ⚠️ 숫자는 전부 화면이 넘겨준다. 여기서 다시 계산하지 않는다.
// ⚠️ 이 컴포넌트는 supabase 도 track() 도 부르지 않는다. (CLAUDE.md 9장)
// ⚠️ 잠정 결과는 이 카드로 만들지 않는다. 화면이 확정된 유형에만 시트를 연다.
// ============================================================================
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg';

import type { SpendingProfileType } from '@/lib/constants/status';
import { SPENDING_PROFILE_TYPE_LABEL } from '@/lib/constants/status';
import { TRAVEL_TYPE_COPY } from '@/lib/constants/travelTypeCopy';
import { travelTypeTheme } from '@/lib/constants/travelTypeTheme';

/** 미리보기 가로. 세로는 9:16. 캡처는 기기 배율(3x)로 810×1440 이다 */
export const TYPE_STORY_WIDTH = 270;
export const TYPE_STORY_HEIGHT = Math.round((TYPE_STORY_WIDTH * 16) / 9);

/** 열 유형 중 몇 번째인지 표시할 때 쓰는 총 개수 */
const TYPE_COUNT = 10;
const CARD_W = TYPE_STORY_WIDTH - 40;
const INK = '#141b28';
const MUTED = '#6b7280';
/** 균형형은 바탕이 아이보리라 바탕색을 강조색으로 못 쓴다. 그때의 대체색 */
const IVORY_BG = '#F1EDE4';
const IVORY_ACCENT = '#FF6A78';

/** 바코드 막대 폭. 고정 패턴이라 캡처마다 같다 */
const BARS = [2, 1, 3, 1, 1, 2, 1, 3, 2, 1, 1, 2, 3, 1, 2, 1, 1, 3, 1, 2, 2, 1, 3, 1, 1, 2, 1, 2, 3, 1, 1, 2];

type Props = {
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
};

export function TypeStoryCard({
  code,
  accuracyBp,
  destinationEn,
  periodLabel,
  topSpentLabel,
  topSavedLabel,
}: Props) {
  const theme = travelTypeTheme(code);
  const copy = TRAVEL_TYPE_COPY[code];
  const label = SPENDING_PROFILE_TYPE_LABEL[code];
  const accuracy = (accuracyBp / 100).toFixed(1).replace(/\.0$/, '');
  const idNumber = `TP-${copy.no}-${theme.nameEn.replace(/\s+/g, '')}`;
  /** 카드 안에서 유형색으로 강조할 때 쓰는 색 */
  const stampColor = theme.bg === IVORY_BG ? IVORY_ACCENT : theme.bg;

  return (
    <View
      style={{
        width: TYPE_STORY_WIDTH,
        height: TYPE_STORY_HEIGHT,
        backgroundColor: theme.bg,
        overflow: 'hidden',
      }}
    >
      {/* 도트 바탕. 홈의 유형 카드와 같은 질감이라 "같은 브랜드" 로 읽힌다 */}
      <Svg
        width={TYPE_STORY_WIDTH}
        height={TYPE_STORY_HEIGHT}
        style={{ position: 'absolute', inset: 0 }}
        pointerEvents="none"
      >
        <Defs>
          <Pattern id="type-story-dots" width={14} height={14} patternUnits="userSpaceOnUse">
            <Circle cx={1.2} cy={1.2} r={1.2} fill={theme.ink} opacity={0.14} />
          </Pattern>
        </Defs>
        <Rect width={TYPE_STORY_WIDTH} height={TYPE_STORY_HEIGHT} fill="url(#type-story-dots)" />
      </Svg>

      {/* ── 머리 ─────────────────────────────────────────────────── */}
      <View
        style={{
          position: 'absolute',
          top: 20,
          left: 20,
          right: 20,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Text style={{ fontSize: 9, fontWeight: '900', letterSpacing: 1.5, color: theme.ink }}>
          TRIPPOT · TRAVEL TYPE
        </Text>
        <Text style={{ fontSize: 9, fontWeight: '900', letterSpacing: 1, color: theme.ink }}>
          NO. {copy.no} / {String(TYPE_COUNT).padStart(2, '0')}
        </Text>
      </View>

      {/* ── 제목: 결과 한 줄 ─────────────────────────────────────── */}
      <View style={{ position: 'absolute', top: 48, left: 20, right: 20 }}>
        <Text style={{ fontSize: 11, fontWeight: '800', color: theme.ink }}>
          나의 여행자 유형은
        </Text>
        <Text
          style={{
            marginTop: 2,
            fontSize: 26,
            lineHeight: 32,
            fontWeight: '900',
            letterSpacing: -0.5,
            color: theme.ink,
          }}
          numberOfLines={2}
        >
          {copy.headline}
        </Text>
      </View>

      {/* ── 신분증 ───────────────────────────────────────────────── */}
      <View
        style={{
          position: 'absolute',
          top: 136,
          left: 20,
          width: CARD_W,
          borderRadius: 14,
          backgroundColor: '#fff',
          overflow: 'hidden',
          transform: [{ rotate: '-2deg' }],
          shadowColor: '#000',
          shadowOpacity: 0.25,
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
            backgroundColor: INK,
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
          <Text style={{ fontSize: 8, fontWeight: '700', letterSpacing: 1, color: '#fff' }}>
            {idNumber}
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

        {/* 바코드 */}
        <View style={{ paddingHorizontal: 12, paddingBottom: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 1.5, height: 18 }}>
            {BARS.map((width, index) => (
              <View key={index} style={{ width, height: 18, backgroundColor: INK }} />
            ))}
          </View>
          <Text style={{ marginTop: 3, fontSize: 6.5, letterSpacing: 2, color: MUTED }}>
            {idNumber} · ISSUED BY TRIPPOT
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

      {/* ── 한 줄 훅 + 해시태그 ─────────────────────────────────── */}
      <View style={{ position: 'absolute', left: 20, right: 20, bottom: 62 }}>
        <Text style={{ fontSize: 15, lineHeight: 21, fontWeight: '900', color: theme.ink }}>
          “{theme.hook}”
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
          {copy.hashtags.map((tag) => (
            <View
              key={tag}
              style={{
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 999,
                backgroundColor: 'rgba(255,255,255,0.92)',
              }}
            >
              <Text style={{ fontSize: 9.5, fontWeight: '800', color: INK }}>{tag}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── 유입 장치 ───────────────────────────────────────────────── */}
      <View
        style={{
          position: 'absolute',
          left: 20,
          right: 20,
          bottom: 20,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text style={{ fontSize: 12, fontWeight: '900', color: theme.ink }}>
          나는 어떤 여행자일까? →
        </Text>
        <Text style={{ fontSize: 12, fontWeight: '900', letterSpacing: 1.5, color: theme.ink }}>
          @TRIPPOT
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
          color: INK,
        }}
        numberOfLines={lines}
      >
        {value}
      </Text>
    </View>
  );
}

function Stat({ label, value, color = INK }: { label: string; value: string; color?: string }) {
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
