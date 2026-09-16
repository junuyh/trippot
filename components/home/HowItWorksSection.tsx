// ============================================================================
// 신규 사용자 홈 — TripPot 이 무엇을 해주는 앱인지 알려주는 칸 (2026-09-16)
//
//   TripPot은 이렇게 도와줘요
//   ┌──────────────────────────────────────────────┐
//   │ ① (계산기) 여행지와 일정만 정하면              │
//   │            항목별 예산을 잡아드려요            │
//   ├──────────────────────────────────────────────┤
//   │ ② (저금통) 여행 금고에 목표만큼 모아요          │
//   ├──────────────────────────────────────────────┤
//   │ ③ (그래프) 다녀오면 계획과 실제를 비교해요      │
//   └──────────────────────────────────────────────┘
//
// 왜 넣었나 — 이 화면은 여행이 하나도 없는 사람이 본다. 추천 여행지가 "어디 가지?"
// 에는 답하지만 "이 앱이 나에게 무엇을 해주나" 에는 아무도 답하지 않았다.
//
// ⚠️ **기능 목록이 아니라 여행 한 번의 흐름이다.** CLAUDE.md 2장의 핵심 루프
//    (계획 → 준비 → 소비 → 결산 → 개인화)를 세 단계로 줄인 것이다.
//    특히 ③의 '다음 여행에 반영' 을 빼지 않는다. 그 줄이 빠지면 이 서비스가
//    가계부·예산 앱과 무엇이 다른지 화면 어디에도 남지 않는다.
//
// ⚠️ **실제로 만들어진 MVP 화면만 적는다.** 환율 변환 · 실제 금융기관 연동 ·
//    영수증 스캔처럼 아직 없는 것을 여기에 쓰지 않는다. (CLAUDE.md 11장 · 3장)
//      ① 여행 만들기 예산 추천 (TRIP-01~03)
//      ② 여행 준비 홈 가상 여행 금고 · 모임원 납부 (TRIP-HOME-01 · CONTRIB-01)
//      ③ 여행 결산 → 다음 여행 개인화 (SETTLE-01)
//
// ⚠️ **금액을 쓰지 않는다.** 예시 금액이라도 홈에 숫자가 오르면 홈이
//    "얼마 있지?" 에 답하기 시작한다. (CLAUDE.md 2장 · components/home/types.ts)
//
// ⚠️ 이모지를 쓰지 않는다. 기기마다 그림이 달라 한 벌로 보이지 않는다.
//    (components/home/TravelStyleSection 과 같은 이유)
//
// 데이터만 props 로 받는다. supabase / track() 을 직접 부르지 않는다. (CLAUDE.md 9장)
// ============================================================================
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { HOME_CAPTION, HOME_CARD_LINE, HOME_RADIUS, HOME_SUBTLE } from './palette';
import { SectionHeader } from './SectionHeader';

type Step = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
};

/**
 * 세 단계. 문구는 이 파일에 둔다 — 화면 파일이 넘길 데이터가 아니라 고정된 소개다.
 * (조회 결과가 아니므로 props 로 올리면 화면 파일만 길어진다)
 */
const STEPS: Step[] = [
  {
    icon: 'calculator-outline',
    title: '여행지와 일정만 정하면',
    body: '항공·숙소·식비까지 항목별 예산을 잡아드려요.',
  },
  {
    icon: 'wallet-outline',
    title: '여행 금고에 목표만큼 모아요',
    body: '모은 돈이 얼마나 찼는지 보이고, 모임 여행이면 누가 냈는지도 함께 봐요.',
  },
  {
    icon: 'stats-chart-outline',
    title: '다녀오면 계획과 실제를 비교해요',
    body: '이번 여행에서 얼마나 썼는지가 다음 여행 예산 추천에 반영돼요.',
  },
];

export function HowItWorksSection() {
  return (
    <View>
      <SectionHeader title="TripPot은 이렇게 도와줘요" />

      <View
        className="bg-white"
        style={{ borderRadius: HOME_RADIUS.card, borderWidth: 1, borderColor: HOME_CARD_LINE }}
      >
        {STEPS.map((step, index) => (
          <View
            key={step.title}
            className="flex-row items-start"
            style={{
              paddingHorizontal: 14,
              paddingVertical: 13,
              // 칸 사이 구분선. 맨 위에는 긋지 않는다.
              borderTopWidth: index === 0 ? 0 : 1,
              borderTopColor: HOME_CARD_LINE,
            }}
          >
            <View className="h-9 w-9 items-center justify-center rounded-full bg-pot-visual">
              <Ionicons name={step.icon} size={18} color="#111827" />
            </View>

            <View className="ml-3 flex-1">
              <View className="flex-row items-center">
                {/* 번호. 순서가 있는 흐름이라는 걸 이 숫자가 말한다 */}
                <Text style={{ fontSize: 10.5, fontWeight: '800', color: HOME_SUBTLE }}>
                  STEP {index + 1}
                </Text>
              </View>
              <Text
                className="text-pot-ink"
                style={{ marginTop: 2, fontSize: 13.5, fontWeight: '700', letterSpacing: -0.3 }}
              >
                {step.title}
              </Text>
              <Text style={{ marginTop: 3, fontSize: 12, lineHeight: 17.5, color: HOME_CAPTION }}>
                {step.body}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
