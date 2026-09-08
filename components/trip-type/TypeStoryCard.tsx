// ============================================================================
// 여행 유형 공유 이미지 (TYPE-01 스토리 카드, 9:16)
//
// "나는 어떤 여행자?" 유형 테스트 결과지처럼 만든다. 남의 피드에서 보고
// "나도 해볼래" 가 나와야 하는 이미지다. 그래서
//   · 유형마다 바탕색이 다르다 (lib/constants/travelTypeTheme). 색만 봐도 유형이 갈린다
//   · 캐릭터 없이 **큰 글자**가 주인공이다. 헤드라인 두 줄 + 형광펜
//   · 바탕에 영문 유형명을 크게 깔아 질감을 만든다 (GOURMET GOURMET …)
//   · 아래는 영수증 한 줄: 예산 정확도 · 최대 지출 · 절약 1위.
//     여행 금융 서비스라는 게 드러나는 자리다. 다른 유형 테스트에는 없는 것
//   · 마지막 줄이 유입 장치: "나는 어떤 여행자? → @TRIPPOT"
//
// ⚠️ 숫자는 전부 화면이 넘겨준다. 여기서 다시 계산하지 않는다.
// ⚠️ 이 컴포넌트는 supabase 도 track() 도 부르지 않는다. (CLAUDE.md 9장)
// ⚠️ 잠정 결과는 이 카드로 만들지 않는다. 화면이 확정된 유형에만 시트를 연다.
// ============================================================================
import { Text, View } from 'react-native';
import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg';

import type { SpendingProfileType } from '@/lib/constants/status';
import { SPENDING_PROFILE_TYPE_LABEL } from '@/lib/constants/status';
import { TRAVEL_TYPE_COPY } from '@/lib/constants/travelTypeCopy';
import { travelTypeTheme } from '@/lib/constants/travelTypeTheme';

/** 미리보기 가로. 세로는 9:16. 캡처는 기기 배율(3x)로 810×1440 이다 */
export const TYPE_STORY_WIDTH = 270;
export const TYPE_STORY_HEIGHT = Math.round((TYPE_STORY_WIDTH * 16) / 9);

/** 아홉 유형 중 몇 번째인지 표시할 때 쓰는 총 개수 */
const TYPE_COUNT = 9;

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
  const headlineLines = copy.headline.split('\n');
  const inkIsLight = theme.ink === '#FFFFFF';
  /** 바탕이 어두우면 스티커·영수증은 흰 종이, 밝으면 잉크색 종이로 뒤집는다 */
  const paper = inkIsLight ? '#FFFFFF' : theme.ink;
  const onPaper = inkIsLight ? theme.bg : theme.bg;

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

      {/*
        바탕에 크게 깐 영문 유형명. 세 줄을 어긋나게 쌓아 포스터 질감을 만든다.
        ⚠️ 장식이다. 헤드라인보다 먼저 읽히면 안 되므로 아주 옅게 둔다.
      */}
      <View pointerEvents="none" style={{ position: 'absolute', left: -20, top: 132, gap: -18 }}>
        {[0, 1, 2].map((row) => (
          <Text
            key={row}
            numberOfLines={1}
            style={{
              fontSize: 64,
              lineHeight: 66,
              fontWeight: '900',
              fontStyle: 'italic',
              letterSpacing: -2,
              color: theme.ink,
              opacity: 0.07,
              marginLeft: row * 26,
              width: 600,
            }}
          >
            {`${theme.nameEn}  ${theme.nameEn}`}
          </Text>
        ))}
      </View>

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
          TRIPPOT TRAVEL TYPE
        </Text>
        <View
          style={{
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 999,
            borderWidth: 1.5,
            borderColor: theme.ink,
          }}
        >
          <Text style={{ fontSize: 9, fontWeight: '900', letterSpacing: 1, color: theme.ink }}>
            TYPE {copy.no} / {String(TYPE_COUNT).padStart(2, '0')}
          </Text>
        </View>
      </View>

      {/* ── 결과 스티커. 기울여서 붙인 느낌 ─────────────────────────── */}
      <View
        style={{
          position: 'absolute',
          top: 56,
          left: 20,
          transform: [{ rotate: '-4deg' }],
          backgroundColor: paper,
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: 4,
        }}
      >
        <Text style={{ fontSize: 10, fontWeight: '900', color: onPaper, letterSpacing: 0.5 }}>
          나의 여행 유형은
        </Text>
      </View>

      {/* ── 헤드라인 + 형광펜 ───────────────────────────────────────── */}
      <View style={{ position: 'absolute', top: 96, left: 20, right: 20 }}>
        {headlineLines.map((line, index) => (
          <View key={index} style={{ alignSelf: 'flex-start', marginTop: index === 0 ? 0 : 2 }}>
            {/* 형광펜: 글자 아래쪽 절반에 깐다 */}
            <View
              style={{
                position: 'absolute',
                left: -4,
                right: -4,
                bottom: 4,
                height: 16,
                backgroundColor: theme.accent,
                opacity: 0.9,
                transform: [{ rotate: '-1deg' }],
              }}
            />
            <Text
              style={{
                fontSize: 34,
                lineHeight: 42,
                fontWeight: '900',
                letterSpacing: -1,
                color: theme.ink,
              }}
            >
              {line}
            </Text>
          </View>
        ))}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}>
          <Text style={{ fontSize: 22 }}>{copy.emoji}</Text>
          <View>
            <Text style={{ fontSize: 14, fontWeight: '900', color: theme.ink }}>
              {label} · {theme.nickname}
            </Text>
            <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: theme.ink, opacity: 0.7 }}>
              {theme.nameEn} TRAVELER
            </Text>
          </View>
        </View>

        <Text
          style={{
            marginTop: 12,
            fontSize: 13,
            lineHeight: 19,
            fontWeight: '700',
            color: theme.ink,
            opacity: 0.85,
          }}
        >
          {theme.hook}
        </Text>
        <Text
          style={{ marginTop: 4, fontSize: 11, lineHeight: 16, color: theme.ink, opacity: 0.7 }}
        >
          {copy.description}
        </Text>
      </View>

      {/* ── 영수증 한 줄. 여행 금융 서비스라는 게 드러나는 자리 ─────── */}
      <View
        style={{
          position: 'absolute',
          left: 20,
          right: 20,
          bottom: 104,
          backgroundColor: paper,
          borderRadius: 12,
          paddingVertical: 12,
          paddingHorizontal: 14,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ fontSize: 8, fontWeight: '900', letterSpacing: 1.5, color: onPaper }}>
            {destinationEn ? `${destinationEn} · RECEIPT` : 'RECEIPT'}
          </Text>
          {periodLabel ? (
            <Text style={{ fontSize: 8, fontWeight: '700', letterSpacing: 0.5, color: onPaper, opacity: 0.8 }}>
              {periodLabel}
            </Text>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row' }}>
          <ReceiptCell label="예산 정확도" value={`${accuracy}%`} color={onPaper} />
          <ReceiptDivider color={onPaper} />
          <ReceiptCell label="최대 지출" value={topSpentLabel ?? '—'} color={onPaper} />
          <ReceiptDivider color={onPaper} />
          <ReceiptCell label="절약 1위" value={topSavedLabel ?? '—'} color={onPaper} />
        </View>
      </View>

      {/* ── 해시태그 ────────────────────────────────────────────────── */}
      <View
        style={{
          position: 'absolute',
          left: 20,
          right: 20,
          bottom: 66,
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 5,
        }}
      >
        {copy.hashtags.map((tag) => (
          <View
            key={tag}
            style={{
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: theme.ink,
            }}
          >
            <Text style={{ fontSize: 9, fontWeight: '800', color: theme.ink }}>{tag}</Text>
          </View>
        ))}
      </View>

      {/* ── 유입 장치 ───────────────────────────────────────────────── */}
      <View
        style={{
          position: 'absolute',
          left: 20,
          right: 20,
          bottom: 22,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text style={{ fontSize: 11, fontWeight: '900', color: theme.ink }}>
          나는 어떤 여행자일까? →
        </Text>
        <Text style={{ fontSize: 11, fontWeight: '900', letterSpacing: 1.5, color: theme.ink }}>
          @TRIPPOT
        </Text>
      </View>
    </View>
  );
}

function ReceiptCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <Text style={{ fontSize: 8, color, opacity: 0.7 }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: '900', color }} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function ReceiptDivider({ color }: { color: string }) {
  return <View style={{ width: 1, backgroundColor: color, opacity: 0.2, marginVertical: 2 }} />;
}
