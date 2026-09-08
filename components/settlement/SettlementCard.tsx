// ============================================================================
// 결산 카드 (SETTLE-01 · v3 · 2026-09-08)
//
// 카톡·인스타에 올리는 세로 이미지 한 장. react-native-view-shot 이 이
// 컴포넌트를 그대로 캡처한다.
//
// v2 는 총액 + 도넛이었다. 도넛은 조각 각도를 눈으로 비교해야 해서 한눈에
// 안 읽혔고, 나머지는 여섯 자리 숫자였다. v3 는 **읽는 순서**로 다시 짰다.
//   ① 결론 한 문장 + 총액 + 사용률 게이지
//   ② 1인당 · 하루 · 1인 하루
//   ③ 어디에 썼나 (가로 누적 막대)
//   ④ 계획과 얼마나 달랐나 (좌우 막대, 상위 4개)
//   ⑤ 언제 썼나 (일자별 막대)
// 숫자는 총액 한 곳만 원 단위고 나머지는 만원이다.
//
// ⚠️ 이 컴포넌트는 supabase 도 track() 도 부르지 않는다. (CLAUDE.md 9장)
// ⚠️ **캡처 대상이라 화면 밖 요소를 넣지 않는다.** 버튼·스크롤·터치가 들어가면
//    이미지에 눌리지 않는 버튼이 찍힌다. 여기는 보여줄 것만 있다.
// ⚠️ 여행 유형 신분증(TypeIdCard)·수하물 태그와 같은 톤을 쓴다. 공유된 이미지를
//    본 사람이 앱에 들어왔을 때 같은 서비스로 읽혀야 한다.
// ⚠️ 실제 사용액이 0이면 이 카드를 만들지 않는다. 화면이 그 판단을 한다.
// ============================================================================
import { Text, View } from 'react-native';

import type { CountryTheme } from '@/lib/constants/countryTheme';
import { manwon } from '@/lib/settlement/format';
import type { SettlementReport } from '@/lib/settlement/report';
import { toDonutSlices } from '@/lib/settlement/reportChart';

import { CategoryDeviationChart } from './CategoryDeviationChart';
import { DailySpendChart } from './DailySpendChart';
import { SpendCompositionBar } from './SpendCompositionBar';

const INK = '#121a2a';
const SAVED = '#18865e';
const OVER = '#d64550';
const MUTED = '#8b94a2';

type Props = {
  report: SettlementReport;
  theme: CountryTheme;
  /** 국기 이모지. 없으면 지구본 */
  flag: string;
  /** 'OSAKA' */
  nameEn: string;
};

export function SettlementCard({ report, theme, flag, nameEn }: Props) {
  const tone = report.verdict.tone === 'saved' ? SAVED : report.verdict.tone === 'over' ? OVER : INK;
  const slices = toDonutSlices(report.categories, theme.primary);
  const over = report.usageRateBp > 10000;
  const targetRatio = over ? 10000 / report.usageRateBp : 1;
  const fillRatio = over ? 1 : report.usageRateBp / 10000;
  const rate = (report.usageRateBp / 100).toFixed(1).replace(/\.0$/, '');
  const deviations = report.byDeviation.map((c) => ({
    categoryId: null,
    categoryCode: c.categoryCode,
    plannedAmount: c.plannedAmount,
    actualAmount: c.actualAmount,
  }));
  const showDaily = report.dailySpends.some((b) => b.amount > 0);

  return (
    <View className="w-[320px] overflow-hidden rounded-3xl bg-white">
      {/* ── 머리 ─────────────────────────────────────────────────────── */}
      <View className="px-6 pb-5 pt-6" style={{ backgroundColor: theme.neutral }}>
        <View className="flex-row items-center justify-between">
          <Text className="text-[9px] font-black tracking-[1.5px] text-white/60">
            TRIPPOT · TRIP REPORT
          </Text>
          <Text className="text-[11px]">{flag}</Text>
        </View>
        <Text className="mt-3 text-[34px] font-black leading-9 text-white">{nameEn}</Text>
        <Text className="mt-1 text-[11px] text-white/60">
          {report.periodLabel} · {report.nights}박 {report.days}일 · {report.headcount}명
        </Text>
      </View>

      {/* ── ① 결론 + 총액 + 게이지 ─────────────────────────────────── */}
      <View className="px-6 pt-5">
        <Text style={{ fontSize: 17, fontWeight: '900', color: tone }}>{report.verdict.title}</Text>
        <Text
          style={{
            marginTop: 4,
            fontSize: 30,
            lineHeight: 36,
            fontWeight: '900',
            letterSpacing: -1,
            color: INK,
            fontVariant: ['tabular-nums'],
          }}
        >
          {report.actualAmount.toLocaleString('ko-KR')}
          <Text style={{ fontSize: 13, fontWeight: '800', letterSpacing: 0 }}>원</Text>
        </Text>
        <Text style={{ marginTop: 2, fontSize: 11, color: MUTED }}>
          목표 {manwon(report.targetAmount)}
          {report.difference !== 0 ? (
            <Text style={{ fontWeight: '800', color: tone }}>
              {'  '}
              {report.difference < 0
                ? `${manwon(-report.difference)} 남김`
                : `${manwon(report.difference)} 초과`}
            </Text>
          ) : null}
        </Text>

        <View style={{ marginTop: 12 }}>
          <View style={{ height: 9, borderRadius: 5, backgroundColor: '#eef0f3', overflow: 'hidden' }}>
            <View
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: `${fillRatio * 100}%`,
                borderRadius: 5,
                backgroundColor: over ? OVER : tone,
              }}
            />
            {over ? (
              <View
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${targetRatio * 100}%`,
                  borderRadius: 5,
                  backgroundColor: INK,
                }}
              />
            ) : null}
          </View>
          <View
            style={{
              position: 'absolute',
              top: -3,
              left: `${targetRatio * 100}%`,
              marginLeft: -1,
              width: 2,
              height: 15,
              backgroundColor: INK,
              borderRadius: 1,
            }}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 }}>
            <Text style={{ fontSize: 9, fontWeight: '800', color: tone }}>예산의 {rate}% 사용</Text>
            <Text style={{ fontSize: 9, color: MUTED }}>목표 100%</Text>
          </View>
        </View>

        {/* ── ② 나눠 보기 ───────────────────────────────────────────── */}
        <View
          style={{
            marginTop: 14,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: '#eef0f3',
            flexDirection: 'row',
          }}
        >
          <Stat label="1인당 지출" value={manwon(report.perPersonAmount)} />
          <Stat label="일평균 지출" value={manwon(report.perDayAmount)} divider />
          <Stat label="1인 일평균" value={manwon(report.perPersonPerDayAmount)} divider />
        </View>
      </View>

      {/* ── ③ 어디에 썼나 ────────────────────────────────────────────── */}
      {slices.length > 0 ? (
        <View className="px-6 pt-5">
          <SectionLabel title="지출 구성" hint="카테고리별 비중" />
          <SpendCompositionBar slices={slices} embedded />
        </View>
      ) : null}

      {/* ── ④ 계획과 얼마나 달랐나 ───────────────────────────────────── */}
      {deviations.length > 0 ? (
        <View className="px-6 pt-5">
          <SectionLabel title="계획 대비 편차" hint="편차가 큰 순 · 상위 4개" />
          <CategoryDeviationChart categories={deviations} embedded limit={4} />
        </View>
      ) : null}

      {/* ── ⑤ 언제 썼나 ─────────────────────────────────────────────── */}
      {showDaily ? (
        <View className="px-6 pt-4">
          <SectionLabel title="일자별 지출" hint="여행 전 결제 포함" />
          <DailySpendChart theme={theme} buckets={report.dailySpends} embedded />
        </View>
      ) : null}

      {/* ── 톱니 절취선 ──────────────────────────────────────────────── */}
      <View className="mt-6 flex-row justify-between px-3">
        {Array.from({ length: 22 }).map((_, index) => (
          <View key={index} className="h-1 w-2 rounded-sm bg-gray-200" />
        ))}
      </View>
      <View className="flex-row items-center justify-between px-6 pb-6 pt-4">
        <Text className="text-[9px] tracking-[1px] text-gray-300">
          {report.confirmedLabel ? `확정 ${report.confirmedLabel}` : '확정 시점의 기록'}
        </Text>
        <Text className="text-[9px] tracking-[1px] text-gray-300">TRIPPOT TRIP REPORT</Text>
      </View>
    </View>
  );
}

function SectionLabel({ title, hint }: { title: string; hint: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 }}>
      <Text style={{ fontSize: 12, fontWeight: '900', color: INK }}>{title}</Text>
      <Text style={{ fontSize: 9, color: MUTED }}>{hint}</Text>
    </View>
  );
}

function Stat({ label, value, divider }: { label: string; value: string; divider?: boolean }) {
  return (
    <View
      style={{
        flex: 1,
        paddingLeft: divider ? 10 : 0,
        borderLeftWidth: divider ? 1 : 0,
        borderLeftColor: '#eef0f3',
      }}
    >
      <Text style={{ fontSize: 9, color: MUTED }}>{label}</Text>
      <Text numberOfLines={1} style={{ marginTop: 3, fontSize: 13, fontWeight: '900', color: INK }}>
        {value}
      </Text>
    </View>
  );
}
