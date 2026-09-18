// ============================================================================
// 온보딩 페이지 — TripPot 둘러보기 (2026-09-17)
//
//   ▬▬ ▬▬ ▭▭ ▭▭                     닫기   ← 진행 표시 · 언제든 나간다
//   ┌──────────────────────────┐
//   │ 01 · PLAN                │          ← 한 장씩 넘긴다 (OnboardingCard)
//  (<)  실제 페이지를 줄인 화면  (>)        ← 양쪽 이전 · 다음 화살표
//   └──────────────────────────┘
//                  마지막 장에만 [ 첫 여행 만들기 → ]   ← 아래 '다음' 버튼은 없다
//
// 홈 캐러셀에서 옮겨 왔다. 홈에는 들어가기 카드(OnboardingEntryCard)만 남는다.
//
// 기준 (다른 앱 · NN/g 사례 조사)
//   · 넘기는 설명은 대부분 건너뛴다 → **모든 장에서 닫기**가 보인다
//   · 끝이 보여야 끝까지 본다 → 위에 네 칸 진행 표시
//   · 설명이 행동으로 이어져야 한다 → 마지막 장 버튼이 '첫 여행 만들기'
//
// ⚠️ **핵심 루프 4칸을 빼지 않는다.** (CLAUDE.md 2장 계획 → 준비 → 소비 → 결산 → 개인화)
//    특히 NEXT TRIP 은 이 서비스가 가계부와 다른 이유다.
// ⚠️ **실제로 있는 화면만 보여준다.** 환율 · 실제 계좌 연동 · 영수증 스캔처럼 없는
//    기능을 미리보기에 그리지 않는다. (CLAUDE.md 3장 · 11장)
// ⚠️ 숫자는 소개용 예시이고 카드마다 '예시 화면' 이라고 적는다.
//
// 데이터만 props 로 받는다. supabase / track() 을 직접 부르지 않는다. (CLAUDE.md 9장)
// ============================================================================
import { Ionicons } from '@expo/vector-icons';
import { useRef, useState, type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BRAND } from '@/lib/constants/brandColor';

import { HOME_CAPTION } from '../palette';
import { CARD_PADDING, OnboardingCard, STAGE_PADDING } from './OnboardingCard';
import {
  FundPreview,
  NextTripPreview,
  PlanPreview,
  RecordPreview,
  type PreviewSize,
} from './onboardingPreviews';

type Props = {
  /** '첫 여행 만들기'. 여행 만들기 흐름으로 보낸다. */
  onCreateTrip: () => void;
  /** '닫기'. 온보딩을 닫는다. */
  onClose: () => void;
};

/** 페이지 좌우 여백. */
const SIDE = 16;
/** 이전 · 다음 화살표 버튼 지름. */
const ARROW_SIZE = 36;
/**
 * 장마다 카드 아래에 두는 여백. 마지막 장에 떠 있는 '첫 여행 만들기' 버튼
 * (버튼 52 + 위아래 여백 28)이 카드 끝을 가리지 않을 만큼이다.
 */
const CTA_SPACE = 88;

/** 카드 옆에 떠 있는 동그란 화살표 버튼. 카드 가장자리에 반쯤 걸친다. */
function ArrowButton({
  side,
  top,
  onPress,
}: {
  side: 'left' | 'right';
  top: number;
  onPress: () => void;
}) {
  const left = side === 'left';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={left ? '이전' : '다음'}
      onPress={onPress}
      hitSlop={8}
      className="items-center justify-center active:opacity-70"
      style={{
        position: 'absolute',
        top,
        [side]: SIDE - ARROW_SIZE / 2 + 2,
        width: ARROW_SIZE,
        height: ARROW_SIZE,
        borderRadius: ARROW_SIZE / 2,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        shadowColor: '#1b2540',
        shadowOpacity: 0.12,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 3,
      }}
    >
      <Ionicons name={left ? 'chevron-back' : 'chevron-forward'} size={20} color={BRAND.primary} />
    </Pressable>
  );
}

type Slide = {
  step: string;
  label: string;
  title: string;
  description: string;
  preview: (size: PreviewSize) => ReactNode;
};

/** 고정된 소개라 화면 파일이 넘길 데이터가 아니다. 이 파일에 둔다. */
const SLIDES: Slide[] = [
  {
    step: '01',
    label: 'PLAN',
    title: '필요한 여행비부터 계획해요',
    description: '여행지와 일정에 맞춰 항공·숙소·식비 등 필요한 예산을 먼저 잡아요.',
    preview: (size) => <PlanPreview size={size} />,
  },
  {
    step: '02',
    label: 'FUND',
    title: '여행자금이 얼마나 준비됐는지',
    description: '목표 여행비와 현재 준비 금액을 비교하고 앞으로 얼마나 더 필요한지 확인해요.',
    preview: (size) => <FundPreview size={size} />,
  },
  {
    step: '03',
    label: 'RECORD',
    title: '여행하면서 실제 지출을 기록해요',
    description: '쓴 금액과 카테고리를 적으면 예산의 실제 사용액에 바로 반영돼요.',
    preview: (size) => <RecordPreview size={size} />,
  },
  {
    step: '04',
    label: 'NEXT TRIP',
    title: '이번 여행이 다음 여행의 기준이 돼요',
    description: '여행이 끝나면 나의 여행자 유형이 나오고, 이 기록으로 다음 예산을 추천해요.',
    preview: (size) => <NextTripPreview size={size} />,
  },
];

export function OnboardingView({ onCreateTrip, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  /** 넘기는 칸의 실제 높이. 장마다 세로 스크롤 칸의 높이로 쓴다. */
  const [pagerHeight, setPagerHeight] = useState(0);

  const cardWidth = Math.max(0, width - SIDE * 2);
  const previewSize: PreviewSize = {
    width: Math.max(0, cardWidth - CARD_PADDING * 2 - STAGE_PADDING * 2),
  };
  const isLast = page === SLIDES.length - 1;

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width <= 0) return;
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    const clamped = Math.min(SLIDES.length - 1, Math.max(0, next));
    if (clamped !== page) setPage(clamped);
  };

  const handleLayout = (event: LayoutChangeEvent) => {
    setPagerHeight(Math.round(event.nativeEvent.layout.height));
  };

  /** 그 장으로 넘긴다. 범위 밖이면 아무것도 하지 않는다. */
  function goTo(index: number) {
    if (index < 0 || index > SLIDES.length - 1) return;
    scrollRef.current?.scrollTo({ x: index * width, animated: true });
    setPage(index);
  }

  function handleNext() {
    if (isLast) {
      onCreateTrip();
      return;
    }
    goTo(page + 1);
  }

  return (
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top }}>
      {/* ── 진행 표시 · 닫기 ─────────────────────────────────────────────── */}
      <View className="flex-row items-center" style={{ height: 52, paddingHorizontal: SIDE }}>
        <View
          className="flex-1 flex-row"
          style={{ gap: 4, marginRight: 16 }}
          accessibilityLabel={`${SLIDES.length}단계 중 ${page + 1}단계`}
        >
          {SLIDES.map((slide, index) => (
            <View
              key={slide.label}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                backgroundColor: index <= page ? BRAND.primary : '#E5E7EB',
              }}
            />
          ))}
        </View>
        {/* 2026-09-17 '건너뛰기' → '닫기'. 홈에서 궁금해서 들어온 페이지라 건너뛸 흐름이 없다 */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="닫기"
          onPress={onClose}
          hitSlop={12}
          className="active:opacity-60"
        >
          <Text style={{ fontSize: 14, fontWeight: '600', color: HOME_CAPTION }}>닫기</Text>
        </Pressable>
      </View>

      {/*
        ── 한 장씩 넘기는 카드 ──
        ⚠️ 2026-09-17 위에 있던 '여행 준비부터 다음 여행까지' 소개 문구를 뺐다.
           카드마다 제목 · 설명이 있어 겹쳤고, 미리보기가 그만큼 아래로 밀렸다.
      */}
      <View className="flex-1" style={{ marginTop: 4 }} onLayout={handleLayout}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {/*
            ⚠️ 미리보기를 자르지 않아서 장이 화면보다 길 수 있다(여행 유형 + 영수증).
               그래서 장마다 세로로 스크롤한다. 가로(장 넘기기)와 방향이 달라 서로 막지 않는다.
          */}
          {SLIDES.map((slide) => (
            <ScrollView
              key={slide.label}
              style={{ width, height: pagerHeight || undefined }}
              contentContainerStyle={{ paddingHorizontal: SIDE, paddingBottom: CTA_SPACE + insets.bottom }}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
              <OnboardingCard
                step={slide.step}
                label={slide.label}
                title={slide.title}
                description={slide.description}
                previewWidget={slide.preview(previewSize)}
                width={cardWidth}
              />
            </ScrollView>
          ))}
        </ScrollView>

        {/*
          ── 이전 · 다음 화살표 ── 카드 양쪽 가운데 (2026-09-18)
          손가락으로 넘길 수 있다는 걸 모르는 사람도 장을 오갈 수 있게 한다.
          ⚠️ 첫 장에는 이전, 마지막 장에는 다음이 없다. 눌러도 갈 곳이 없는 버튼을 두지 않는다.
             마지막 장의 다음 행동은 아래 '첫 여행 만들기' 버튼이다.
          ⚠️ 화살표 세로 위치는 카드 칸 전체(아래 여백 포함)의 가운데다.
          ⚠️ 장 안의 세로 스크롤과 따로 떠 있어서, 내려도 화살표는 제자리에 있다.
        */}
        {pagerHeight > 0 && page > 0 ? (
          <ArrowButton side="left" top={pagerHeight / 2 - ARROW_SIZE / 2} onPress={() => goTo(page - 1)} />
        ) : null}
        {pagerHeight > 0 && !isLast ? (
          <ArrowButton side="right" top={pagerHeight / 2 - ARROW_SIZE / 2} onPress={() => goTo(page + 1)} />
        ) : null}
      </View>

      {/*
        ── 첫 여행 만들기 ── 마지막 장에서만 (2026-09-18)
        ⚠️ 아래 '다음' 버튼을 뺐다. 장 넘기기는 양쪽 화살표가 맡는다.
        ⚠️ 마지막 장의 '첫 여행 만들기' 는 남긴다. 온보딩을 보고 바로 여행을 만들러 가는
           유일한 길이다. (홈 FAB 로 돌아가지 않아도 되게)
        ⚠️ 카드 아래에 떠 있다. 자리를 따로 잡으면 마지막 장에서만 카드 칸이 줄어
           화살표 위치가 튄다. 대신 장마다 아래 여백(CTA_SPACE)을 둬서 카드를 가리지 않는다.
      */}
      {isLast ? (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: SIDE,
            paddingTop: 12,
            paddingBottom: insets.bottom + 16,
            backgroundColor: 'rgba(255,255,255,0.96)',
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="첫 여행 만들기"
            onPress={handleNext}
            className="w-full flex-row items-center justify-center rounded-xl bg-brand py-3.5 active:bg-brand-pressed"
          >
            <Text className="text-base font-semibold text-white">첫 여행 만들기</Text>
            <Ionicons name="arrow-forward" size={17} color="#FFFFFF" style={{ marginLeft: 6 }} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
