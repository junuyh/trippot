// ============================================================================
// 홈 배너 자동 가로 슬라이드 (2026-09-03)
//
// 진행 중인 여행 배너와 지난 여행 배너가 같은 규칙으로 움직이게 한 곳에 모았다.
// 두 곳에 각각 setInterval 을 두면 주기와 멈춤 규칙이 조금씩 달라진다.
//
// ⚠️ 사용자가 손대면 멈춘다. 넘기는 중에 화면이 저절로 움직이면
//    보려던 카드를 놓친다. 손을 뗀 뒤 RESUME_DELAY_MS 동안은 다시 움직이지 않는다.
//
// ⚠️ '동작 줄이기'(iOS 손쉬운 사용 / Android 애니메이션 제거)를 켠 사용자에게는
//    자동으로 움직이지 않는다. 저절로 움직이는 화면은 어지럼증을 유발할 수 있어
//    OS 가 이 설정을 제공한다. 확인이 끝나기 전에는 움직이지 않는 쪽으로 둔다.
//
// ⚠️ 마지막 카드는 count - 1 이 아닐 수 있다. 카드가 화면에 두 장씩 보이면
//    마지막 카드로 스크롤해도 더 갈 곳이 없어 그 자리에서 멈춘다.
//    그래서 어디서 처음으로 돌아갈지를 lastIndex 로 받는다.
// ============================================================================
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView,
} from 'react-native';

/** 한 장이 머무는 시간. 읽을 시간은 되고 지루하지는 않은 값이다. */
const SLIDE_INTERVAL_MS = 4000;
/** 사용자가 손을 뗀 뒤 자동 슬라이드를 다시 켜기까지. */
const RESUME_DELAY_MS = 8000;

type Options = {
  /** 카드 개수. 2장 미만이면 움직이지 않는다. */
  count: number;
  /** 한 칸 이동 거리. 카드 폭 + 간격. */
  step: number;
  /** 여기까지 가면 처음으로 돌아간다. 생략하면 마지막 카드다. */
  lastIndex?: number;
};

export function useAutoCarousel({ count, step, lastIndex }: Options) {
  const ref = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  // 콜백 안에서 최신 값을 읽어야 해서 상태와 별도로 들고 있는다.
  const pageRef = useRef(0);
  const pausedUntilRef = useRef(0);
  // 확인이 끝나기 전에는 움직이지 않는다.
  const [reduceMotion, setReduceMotion] = useState(true);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => {
        if (alive) setReduceMotion(on);
      })
      // 설정을 읽지 못하는 환경이면 평소대로 움직인다.
      .catch(() => {
        if (alive) setReduceMotion(false);
      });

    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      alive = false;
      // 일부 플랫폼은 구독 객체를 돌려주지 않는다.
      sub?.remove?.();
    };
  }, []);

  const end = lastIndex ?? count - 1;

  useEffect(() => {
    if (reduceMotion) return;
    if (count < 2 || step <= 0 || end <= 0) return;

    const timer = setInterval(() => {
      if (Date.now() < pausedUntilRef.current) return;
      const next = pageRef.current >= end ? 0 : pageRef.current + 1;
      pageRef.current = next;
      setPage(next);
      ref.current?.scrollTo({ x: next * step, animated: true });
    }, SLIDE_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [count, step, end, reduceMotion]);

  /** 스크롤 위치에서 현재 장을 다시 계산한다. 손으로 넘겼을 때도 점이 맞는다. */
  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (step <= 0) return;
    const next = Math.round(event.nativeEvent.contentOffset.x / step);
    pageRef.current = next;
    setPage((prev) => (prev === next ? prev : next));
  }

  /** 사용자가 손을 댔다. 잠시 자동 슬라이드를 멈춘다. */
  function handleTouch() {
    pausedUntilRef.current = Date.now() + RESUME_DELAY_MS;
  }

  return { ref, page, handleScroll, handleTouch };
}
