// ============================================================================
// 결산 카드 (SETTLE-01 · B안)
//
// 카톡·인스타에 올리는 세로 이미지 한 장. react-native-view-shot 이 이
// 컴포넌트를 그대로 캡처한다.
//
// ⚠️ 이 컴포넌트는 supabase 도 track() 도 부르지 않는다. (CLAUDE.md 9장)
//
// ⚠️ **캡처 대상이라 화면 밖 요소를 넣지 않는다.** 버튼·스크롤·터치가 들어가면
//    이미지에 눌리지 않는 버튼이 찍힌다. 여기는 보여줄 것만 있다.
//
// ⚠️ 여행 홈의 수하물 태그와 같은 톤을 쓴다. 공유된 이미지를 본 사람이
//    앱에 들어왔을 때 같은 서비스로 읽혀야 한다.
//
// ⚠️ 실제 사용액이 0이면 이 카드를 만들지 않는다. 화면이 그 판단을 한다.
//    "안 쓴 것" 과 "아직 안 적은 것" 은 다르다.
// ============================================================================
import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import type { CountryTheme } from '@/lib/constants/countryTheme';
import type { SettlementReport } from '@/lib/settlement/report';
import { toDonutSlices } from '@/lib/settlement/reportChart';

type Props = {
  report: SettlementReport;
  theme: CountryTheme;
  /** 국기 이모지. 없으면 지구본 */
  flag: string;
  /** 'OSAKA' */
  nameEn: string;
};

function won(value: number): string {
  return `${value.toLocaleString('ko-KR')}원`;
}

/** 175만 처럼 줄인다. 카드에서는 자릿수보다 크기 비교가 중요하다 */
function short(value: number): string {
  if (value >= 100_000_000) return `${(value / 100_000_000).toFixed(1)}억`;
  if (value >= 10_000) return `${Math.round(value / 10_000).toLocaleString('ko-KR')}만`;
  return value.toLocaleString('ko-KR');
}

/** 도넛 반지름과 둘레. stroke-dasharray 로 조각을 자른다 */
const R = 37;
const C = 2 * Math.PI * R;

export function SettlementCard({ report, theme, flag, nameEn }: Props) {
  const saved = report.difference < 0;
  const slices = toDonutSlices(report.categories, theme.primary).map((slice) => ({
    ...slice,
    actualAmountLabel: slice.amount,
  }));

  return (
    <View className="w-[320px] overflow-hidden rounded-3xl bg-white">
      {/* ── 머리 ─────────────────────────────────────────────────────── */}
      <View className="px-6 pb-5 pt-6" style={{ backgroundColor: theme.neutral }}>
        <View className="flex-row items-center justify-between">
          <Text className="text-[9px] font-black tracking-[1.5px] text-white/60">
            TRIPPOT · TRIP RECEIPT
          </Text>
          <Text className="text-[11px]">{flag}</Text>
        </View>

        <Text className="mt-3 text-[34px] font-black leading-9 text-white">
          {nameEn}
        </Text>
        <Text className="mt-1 text-[11px] text-white/60">
          {report.periodLabel} · {report.nights}박 {report.days}일 · {report.headcount}명
        </Text>
      </View>

      {/* ── 유형 ─────────────────────────────────────────────────────── */}
      {report.typeLabel ? (
        <View
          className="items-center px-6 py-4"
          style={{ backgroundColor: theme.primarySoft }}
        >
          <Text className="text-[10px] text-gray-500">우리 여행은</Text>
          <Text
            className="mt-1 text-[22px] font-black"
            style={{ color: theme.primary }}
          >
            {report.typeLabel}
          </Text>
          {report.typeSummary ? (
            <Text className="mt-1 text-center text-[10px] leading-4 text-gray-500">
              {report.typeSummary}
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* ── 금액 ─────────────────────────────────────────────────────── */}
      <View className="items-center px-6 pt-6">
        <Text className="text-[10px] text-gray-400">실제 사용액</Text>
        <Text
          className="mt-1 text-[32px] font-black"
          style={{ color: theme.neutral, fontVariant: ['tabular-nums'] }}
        >
          {won(report.actualAmount)}
        </Text>
        <Text
          className="mt-1.5 text-[12px] font-bold"
          style={{ color: saved ? theme.primary : '#d92d20' }}
        >
          예산보다 {won(Math.abs(report.difference))} {saved ? '아꼈어요' : '더 썼어요'}
        </Text>
        <Text className="mt-1 text-[10px] text-gray-400">
          1인당 {won(report.perPersonAmount)}
        </Text>
      </View>

      {/* ── 어디에 썼나 ──────────────────────────────────────────────
          숫자만 늘어놓으면 안 읽힌다. 비중을 도넛으로 먼저 보이고 금액을 옆에 둔다.

          ⚠️ 조각은 **금액 순**이라 색이 곧 크기를 뜻한다. 서로 다른 색조를
             쓰지 않고 국기색 한 색조의 단계를 쓴다. (sequential)
          ⚠️ 옅은 조각은 흰 바탕에서 대비가 3:1 미만이다. 그래서 조각마다
             이름과 금액을 **직접 적는다.** 색만으로 구분하게 두지 않는다.
      */}
      {slices.length > 0 ? (
        <View className="mt-5 flex-row items-center gap-4 px-6">
          <Svg width={92} height={92} viewBox="0 0 92 92">
            <Svg x={0} y={0} rotation={-90} originX={46} originY={46}>
              {slices.map((slice, index) => {
                const length = Math.max(0, C * slice.ratio - 2);
                const offset = slices
                  .slice(0, index)
                  .reduce((sum, s2) => sum + C * s2.ratio, 0);
                return (
                  <Circle
                    key={slice.label}
                    cx={46}
                    cy={46}
                    r={R}
                    fill="none"
                    stroke={slice.color}
                    strokeWidth={18}
                    strokeDasharray={`${length} ${C - length}`}
                    strokeDashoffset={-offset}
                  />
                );
              })}
            </Svg>
          </Svg>

          <View className="flex-1 gap-1.5">
            {slices.map((slice) => (
              <View key={slice.label} className="flex-row items-center gap-1.5">
                <View
                  className="h-2 w-2 rounded-sm"
                  style={{ backgroundColor: slice.color }}
                />
                <Text className="flex-1 text-[11px] text-gray-700" numberOfLines={1}>
                  {slice.label}
                </Text>
                <Text className="text-[10px] text-gray-400">
                  {Math.round(slice.ratio * 100)}%
                </Text>
                <Text
                  className="w-[42px] text-right text-[11px] font-bold text-gray-900"
                  style={{ fontVariant: ['tabular-nums'] }}
                >
                  {short(slice.actualAmountLabel)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* ── 톱니 절취선 ──────────────────────────────────────────────── */}
      <View className="mt-6 flex-row justify-between px-3">
        {Array.from({ length: 22 }).map((_, index) => (
          <View key={index} className="h-1 w-2 rounded-sm bg-gray-200" />
        ))}
      </View>

      <View className="items-center px-6 pb-6 pt-4">
        <Text className="text-[9px] tracking-[1px] text-gray-300">
          TRIPPOT TRIP RECEIPT
        </Text>
      </View>
    </View>
  );
}
