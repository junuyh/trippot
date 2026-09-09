// ============================================================================
// 정산 영수증 이미지 (SETTLE-01 · v4 · 2026-09-08)
//
// 카톡·인스타에 올리는 세로 이미지 한 장. react-native-view-shot 이 이
// 컴포넌트를 그대로 캡처한다.
//
// **프린터에서 영수증이 막 뽑혀 나온 장면**이다. 여행이 끝났고, 계산이 끝났고,
// 종이 한 장이 나왔다. "잘 다녀왔다" 는 느낌은 그림이 아니라 이 장면이 낸다.
//
//   위      TRIP COMPLETE · 도시명(디스플레이 폰트) · 기간 · 인원
//   슬롯    은색 프린터 투입구. 종이가 이 밑에서 나온다
//   영수증  머리글 · 선으로 그린 그림 한 장(ReceiptArt) · 이중선 · TOTAL ·
//           목표/남은 금액 · 1인당 · 결과 도장 · 바코드 · 톱니 아랫변
//           (카테고리 나열은 뺐다 — 숫자 여덟 줄보다 그림 한 장이 먼저 읽힌다)
//   아래    @TRIPPOT
//
// 홈의 여행 영수증(TripReceiptCard)과 같은 종이·점선·톱니·등폭 숫자다.
// 색은 거의 없다. 잉크와 회색, 그리고 결과 도장 한 곳(절약 초록 / 초과 국기색).
// 국기 색을 면으로 깔지 않는다. (countryTheme 원칙) 금액은 축약하지 않는다.
//
// v3(게이지·누적 막대·편차 막대·일자별 막대)은 걷어냈다. 두껍고, 그림마다 읽는
// 법이 달랐고, 앱 어디에도 없는 모양이었다.
//
// ⚠️ 이 컴포넌트는 supabase 도 track() 도 부르지 않는다. (CLAUDE.md 9장)
// ⚠️ **캡처 대상이라 화면 밖 요소를 넣지 않는다.** 버튼·스크롤·터치가 들어가면
//    이미지에 눌리지 않는 버튼이 찍힌다. 여기는 보여줄 것만 있다.
// ⚠️ 실제 사용액이 0이면 이 카드를 만들지 않는다. 화면이 그 판단을 한다.
// ============================================================================
import type React from 'react';
import { Platform, Text, View } from 'react-native';
import Svg, { Circle, Defs, G, Line as SvgLine, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { CountryTheme } from '@/lib/constants/countryTheme';
import { countryLandmark } from '@/lib/constants/countryLandmark';
import { CITY_PIN, countryOutline } from '@/lib/constants/countryOutline';
import type { DestinationCode } from '@/lib/constants/destinations';
import { useDisplayFont } from '@/lib/hooks/useDisplayFont';
import { won } from '@/lib/settlement/format';
import { pickReceiptArt, type ReceiptArtVariant } from '@/lib/settlement/receiptArt';
import type { SettlementReport } from '@/lib/settlement/report';

/** 캡처 폭. 기기 배율(3x)로 810px 이다. 높이는 내용에 따르되 9:16 보다 짧지 않다 */
export const SETTLEMENT_CARD_WIDTH = 270;
const MIN_HEIGHT = Math.round((SETTLEMENT_CARD_WIDTH * 16) / 9);
/** 종이 폭. 슬롯보다 좁아야 슬롯에서 나온 것으로 보인다 */
const PAPER_W = 204;
const SLOT_W = 244;
const SLOT_H = 22;
/** 종이 윗부분이 슬롯 안으로 들어가 있는 깊이 */
const SLOT_OVERLAP = 12;
const PAD = 15;

const CANVAS = '#e6e8eb';
const PAPER = '#ffffff';
const LINE = '#d9dee4';
const DASH = '#cfd5dc';
const INK = '#141b28';
const MUTED = '#6f7885';
const FAINT = '#9aa3af';
const SAVED = '#19865f';
const TOOTH = 12;
const TOOTH_H = 7;
/** 등폭 숫자. 자릿수가 줄마다 흔들리면 영수증으로 안 읽힌다 */
const NUM = { fontVariant: ['tabular-nums' as const] };
/** 영수증 프린터 글꼴. 한글은 시스템 글꼴로 떨어진다 */
const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: undefined });

/** 바코드 막대. [막대 폭, 뒤 여백]. 고정 패턴이라 캡처마다 같다 */
const BARS: readonly [number, number][] = [
  [2, 1], [1, 1], [3, 2], [1, 1], [1, 2], [2, 1], [1, 1], [3, 1], [2, 2], [1, 1],
  [1, 1], [2, 2], [3, 1], [1, 1], [2, 1], [1, 2], [1, 1], [3, 1], [1, 2], [2, 1],
  [2, 1], [1, 1], [3, 2], [1, 1], [1, 1], [2, 2], [1, 1], [2, 1], [3, 1], [1, 2],
  [1, 1], [2, 1], [1, 1], [3, 1], [2, 2], [1, 1], [2, 1], [1, 1], [3, 1], [2, 0],
];

/** 톱니 아랫변. 아래로 처진 이빨 */
function toothPath(width: number): string {
  const count = Math.ceil(width / TOOTH);
  const parts = ['M 0,0'];
  for (let i = 0; i < count; i += 1) {
    parts.push(`L ${i * TOOTH + TOOTH / 2},${TOOTH_H}`);
    parts.push(`L ${(i + 1) * TOOTH},0`);
  }
  parts.push(`L ${count * TOOTH},0 Z`);
  return parts.join(' ');
}

/**
 * 영수증 가운데 그림. 선으로만 그린다 (잉크 한 색, 채움 없음).
 * 어떤 그림인지는 lib/settlement/receiptArt 가 여행마다 고정으로 고른다.
 * PDF 명세서도 같은 함수로 같은 그림을 쓴다.
 */
const ART_W = PAPER_W - PAD * 2;
const ART_H = 118;

function ReceiptArt({
  variant,
  countryKo,
  destinationCode,
  airportCode,
}: {
  variant: ReceiptArtVariant;
  countryKo: string | null;
  destinationCode: DestinationCode | null;
  airportCode: string | null;
}) {
  const outline = countryOutline(countryKo);
  const pin = destinationCode ? CITY_PIN[destinationCode] : null;

  let body: React.ReactNode = null;
  if (variant === 'outline' && outline) {
    const [, , vw, vh] = outline.viewBox.split(' ').map(Number);
    // 그림 상자 안에 나라를 통째로 맞춘다. 여백 8%
    const scale = Math.min((ART_W * 0.84) / vw, (ART_H * 0.84) / vh);
    const ox = (ART_W - vw * scale) / 2;
    const oy = (ART_H - vh * scale) / 2;
    body = (
      <Svg width={ART_W} height={ART_H}>
        <G transform={`translate(${ox} ${oy}) scale(${scale})`}>
          {outline.paths.map((d, i) => (
            <Path key={i} d={d} fill="none" stroke={INK} strokeWidth={1.1 / scale} strokeLinejoin="round" />
          ))}
          {pin ? (
            <>
              <Circle cx={pin.x} cy={pin.y} r={5.5 / scale} fill="none" stroke={INK} strokeWidth={1.4 / scale} />
              <Circle cx={pin.x} cy={pin.y} r={2 / scale} fill={INK} />
            </>
          ) : null}
        </G>
      </Svg>
    );
  } else if (variant === 'landmark') {
    const mark = countryLandmark(countryKo);
    // 좌표계 100×60, 지면 y=60. 상자 안에 폭 기준으로 맞춘다
    const scale = Math.min((ART_W * 0.8) / 100, (ART_H * 0.8) / 60);
    const ox = (ART_W - 100 * scale) / 2;
    const oy = (ART_H - 60 * scale) / 2;
    body = (
      <Svg width={ART_W} height={ART_H}>
        <G transform={`translate(${ox} ${oy}) scale(${scale})`}>
          {mark.paths.map((p, i) => (
            <Path key={i} d={p.d} fill="none" stroke={INK} strokeWidth={1.3 / scale} strokeLinejoin="round" />
          ))}
          {mark.circles?.map((c, i) => (
            <Circle key={`c${i}`} cx={c.cx} cy={c.cy} r={c.r} fill="none" stroke={INK} strokeWidth={1.3 / scale} />
          ))}
          <SvgLine x1={-4} y1={60} x2={104} y2={60} stroke={INK} strokeWidth={1.3 / scale} />
        </G>
      </Svg>
    );
  } else {
    // route: 두 점 사이 점선 호, 정점에 비행기
    const y = ART_H * 0.62;
    const x1 = 26;
    const x2 = ART_W - 26;
    const cx = (x1 + x2) / 2;
    const top = ART_H * 0.22;
    body = (
      <View style={{ width: ART_W, height: ART_H }}>
        <Svg width={ART_W} height={ART_H}>
          <Path
            d={`M ${x1} ${y} Q ${cx} ${top - 30} ${x2} ${y}`}
            fill="none"
            stroke={INK}
            strokeWidth={1.2}
            strokeDasharray="4 4"
          />
          <Circle cx={x1} cy={y} r={3.5} fill="none" stroke={INK} strokeWidth={1.4} />
          <Circle cx={x2} cy={y} r={3.5} fill={INK} />
        </Svg>
        <Text style={{ position: 'absolute', left: cx - 9, top: top - 6, fontSize: 16, color: INK }}>✈</Text>
        <Text style={{ position: 'absolute', left: x1 - 14, top: y + 9, width: 28, textAlign: 'center', fontFamily: MONO, fontSize: 9, fontWeight: '700', color: INK }}>ICN</Text>
        <Text style={{ position: 'absolute', left: x2 - 14, top: y + 9, width: 28, textAlign: 'center', fontFamily: MONO, fontSize: 9, fontWeight: '700', color: INK }}>{airportCode ?? '—'}</Text>
      </View>
    );
  }

  if (!body) return null;
  return (
    <View
      style={{
        marginTop: 12,
        width: ART_W,
        height: ART_H,
        borderWidth: 1,
        borderColor: INK,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {body}
    </View>
  );
}

function Dashed() {
  return (
    <View style={{ marginTop: 10, borderTopWidth: 1, borderStyle: 'dashed', borderColor: DASH }} />
  );
}

/** 굵은 선 두 줄. 영수증의 합계 앞 구분선 */
function DoubleRule() {
  return (
    <View style={{ marginTop: 11 }}>
      <View style={{ height: 1.5, backgroundColor: INK }} />
      <View style={{ height: 1, backgroundColor: INK, marginTop: 2 }} />
    </View>
  );
}

/** 영수증 한 줄. 이름은 왼쪽, 금액은 오른쪽 */
function Line({
  emoji,
  label,
  value,
  tone,
  bold,
}: {
  emoji?: string;
  label: string;
  value: string;
  tone?: string;
  bold?: boolean;
}) {
  return (
    <View
      style={{
        marginTop: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 }}>
        {emoji ? <Text style={{ fontSize: 10 }}>{emoji}</Text> : null}
        <Text
          numberOfLines={1}
          style={{ fontSize: 10, fontWeight: bold ? '800' : '500', color: bold ? INK : MUTED }}
        >
          {label}
        </Text>
      </View>
      <Text style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: '700', color: tone ?? INK, ...NUM }}>
        {value}
      </Text>
    </View>
  );
}

type Props = {
  report: SettlementReport;
  theme: CountryTheme;
  /** 국기 이모지. 없으면 지구본 */
  flag: string;
  /** 'TOKYO' */
  nameEn: string;
  /** 국가·도시·공항. 직접 입력 목적지는 null 이라 그림 없이 그린다 */
  countryKo: string | null;
  destinationCode: DestinationCode | null;
  airportCode: string | null;
};

export function SettlementCard({
  report,
  theme,
  flag,
  nameEn,
  countryKo,
  destinationCode,
  airportCode,
}: Props) {
  const { fontFamily: displayFont } = useDisplayFont();
  const withinBudget = report.difference <= 0;
  const resultTone = withinBudget ? SAVED : theme.primary;
  const city = nameEn || report.destination;
  const stay = report.nights > 0 ? `${report.nights}박 ${report.days}일` : null;
  /** 도시명 크기. 긴 이름은 줄인다 (HONG KONG · PHILIPPINES) */
  const cityFont = city.length > 8 ? 46 : city.length > 6 ? 56 : 66;

  return (
    <View
      style={{
        width: SETTLEMENT_CARD_WIDTH,
        minHeight: MIN_HEIGHT,
        backgroundColor: CANVAS,
        alignItems: 'center',
        paddingTop: 30,
        paddingBottom: 22,
      }}
    >
      {/* ── 위: 여행 끝 ────────────────────────────────────────────── */}
      <Text style={{ fontSize: 8, fontWeight: '900', letterSpacing: 2.4, color: MUTED }}>
        TRIP COMPLETE
      </Text>
      <Text
        numberOfLines={1}
        style={{
          marginTop: 6,
          fontFamily: displayFont,
          fontSize: cityFont,
          lineHeight: cityFont,
          letterSpacing: 1,
          color: INK,
        }}
      >
        {city}
      </Text>
      <Text style={{ marginTop: 6, fontSize: 9, letterSpacing: 0.6, color: MUTED, ...NUM }}>
        {flag} {report.periodLabel}
        {stay ? ` · ${stay}` : ''} · {report.headcount}명
      </Text>

      {/* ── 슬롯 + 영수증 ──────────────────────────────────────────── */}
      <View style={{ marginTop: 18, width: SLOT_W, alignItems: 'center' }}>
        {/* 종이. 슬롯보다 먼저 그려서 슬롯 밑으로 들어간다 */}
        <View style={{ width: PAPER_W, marginTop: SLOT_H - SLOT_OVERLAP }}>
          <View
            style={{
              backgroundColor: PAPER,
              paddingHorizontal: PAD,
              paddingTop: SLOT_OVERLAP + 14,
              paddingBottom: 12,
              shadowColor: '#0f172a',
              shadowOpacity: 0.16,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 10 },
              elevation: 4,
            }}
          >
            {/* 머리글 */}
            <Text
              style={{
                textAlign: 'center',
                fontSize: 9,
                fontWeight: '900',
                letterSpacing: 2,
                color: INK,
              }}
            >
              TRIPPOT
            </Text>
            <Text
              style={{
                textAlign: 'center',
                marginTop: 3,
                fontSize: 7.5,
                letterSpacing: 1.6,
                color: FAINT,
              }}
            >
              TRIP RECEIPT
            </Text>
            <Text
              style={{
                textAlign: 'center',
                marginTop: 6,
                fontFamily: MONO,
                fontSize: 7.5,
                color: FAINT,
                ...NUM,
              }}
            >
              {report.periodLabel.replaceAll('.', '/')}
              {report.confirmedLabel ? `  ·  ${report.confirmedLabel.replaceAll('.', '/')} 확정` : ''}
            </Text>

            {/* 그림 */}
            <Dashed />
            <ReceiptArt
              variant={pickReceiptArt(`${report.destination}|${report.startDate ?? ''}`, {
                countryKo,
                destinationCode,
                airportCode,
              })}
              countryKo={countryKo}
              destinationCode={destinationCode}
              airportCode={airportCode}
            />
            <Text
              style={{
                textAlign: 'center',
                marginTop: 8,
                fontSize: 8,
                fontWeight: '800',
                letterSpacing: 1.4,
                color: INK,
              }}
            >
              {city} · {theme.nameEn || 'ABROAD'}
            </Text>
            <Text
              style={{ textAlign: 'center', marginTop: 3, fontSize: 8, letterSpacing: 0.4, color: FAINT, ...NUM }}
            >
              {stay ? `${stay} · ` : ''}{report.headcount}명 · {report.transactions.length}건 결제
            </Text>

            {/* 합계 */}
            <DoubleRule />
            <View
              style={{
                marginTop: 10,
                flexDirection: 'row',
                alignItems: 'baseline',
                justifyContent: 'space-between',
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '900', letterSpacing: 1, color: INK }}>
                TOTAL
              </Text>
              <Text
                style={{
                  fontFamily: MONO,
                  fontSize: 15,
                  fontWeight: '700',
                  letterSpacing: -0.3,
                  color: INK,
                  ...NUM,
                }}
              >
                {won(report.actualAmount)}
              </Text>
            </View>
            <Line label="목표 여행비" value={won(report.targetAmount)} />
            <Line
              label={withinBudget ? '남은 금액' : '초과 금액'}
              value={won(Math.abs(report.difference))}
              tone={report.difference === 0 ? INK : resultTone}
              bold
            />
            {report.headcount > 1 ? (
              <Line label={`1인당 · ${report.headcount}명`} value={won(report.perPersonAmount)} />
            ) : null}

            {/* 결과 도장 */}
            <View style={{ alignItems: 'center', marginTop: 14 }}>
              <View
                style={{
                  paddingHorizontal: 9,
                  paddingVertical: 4,
                  borderWidth: 1.5,
                  borderRadius: 4,
                  borderColor: resultTone,
                  transform: [{ rotate: '-5deg' }],
                }}
              >
                <Text
                  style={{ fontSize: 8.5, fontWeight: '900', letterSpacing: 0.8, color: resultTone }}
                >
                  {report.verdict.title}
                  {withinBudget ? ' ✓' : ''}
                </Text>
              </View>
            </View>

            {/* 바코드 */}
            <View style={{ marginTop: 12, height: 20, flexDirection: 'row' }}>
              {BARS.map(([bar, gap], index) => (
                <View key={index} style={{ flexDirection: 'row', flex: bar + gap }}>
                  <View style={{ flex: bar, backgroundColor: INK }} />
                  {gap > 0 ? <View style={{ flex: gap }} /> : null}
                </View>
              ))}
            </View>
            <Text
              style={{
                textAlign: 'center',
                marginTop: 6,
                fontFamily: MONO,
                fontSize: 7,
                letterSpacing: 1.2,
                color: FAINT,
              }}
            >
              {city} · {report.headcount} TRAVELERS
            </Text>
          </View>

          {/* 찢어낸 아랫변. 그림자 없이 종이색만 */}
          <Svg width={PAPER_W} height={TOOTH_H}>
            <Path d={toothPath(PAPER_W)} fill={PAPER} />
          </Svg>
        </View>

        {/* 프린터 슬롯. 종이 위에 얹힌다 */}
        <View style={{ position: 'absolute', top: 0, left: 0, width: SLOT_W, height: SLOT_H }}>
          <Svg width={SLOT_W} height={SLOT_H}>
            <Defs>
              <LinearGradient id="slot-metal" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#f4f5f7" />
                <Stop offset="0.45" stopColor="#c9ced5" />
                <Stop offset="1" stopColor="#9aa1ab" />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width={SLOT_W} height={SLOT_H} rx={6} fill="url(#slot-metal)" />
            <Rect x={0.5} y={0.5} width={SLOT_W - 1} height={SLOT_H - 1} rx={6} fill="none" stroke="#8f97a2" strokeWidth={1} />
            {/* 투입구 */}
            <Rect
              x={(SLOT_W - PAPER_W) / 2 - 6}
              y={SLOT_H / 2 - 2.5}
              width={PAPER_W + 12}
              height={5}
              rx={2.5}
              fill="#2b3340"
            />
          </Svg>
        </View>
      </View>

      {/* ── 아래: 유입 ────────────────────────────────────────────── */}
      <View style={{ flex: 1 }} />
      <Text
        style={{
          marginTop: 22,
          fontSize: 10,
          fontWeight: '900',
          letterSpacing: 2,
          color: INK,
          textDecorationLine: 'underline',
        }}
      >
        @TRIPPOT
      </Text>
    </View>
  );
}
