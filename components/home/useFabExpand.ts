// 스크롤 위치로 CreateTripFab 을 접을지 펼지 정한다.
//
// 기존 홈(HomeView)과 신규 사용자 홈(HomeStates)이 같은 규칙을 써야 해서
// 한 곳에 둔다. 두 화면에서 접히는 시점이 다르면 같은 버튼으로 보이지 않는다.
//
// ⚠️ 접는 기준과 펴는 기준을 다르게 뒀다(24 / 8). 하나로 두면 그 값 근처에서
//    손가락이 조금만 흔들려도 버튼이 폈다 접혔다 떨린다.
import { useState } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

/** 이만큼 내리면 접는다. */
const COLLAPSE_AT = 24;
/** 이만큼까지 올라오면 다시 편다. */
const EXPAND_AT = 8;

export function useFabExpand() {
  const [expanded, setExpanded] = useState(true);

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const y = e.nativeEvent.contentOffset.y;
    // 값이 그대로면 React 가 리렌더를 건너뛴다.
    setExpanded((prev) => (prev ? y <= COLLAPSE_AT : y <= EXPAND_AT));
  }

  return { expanded, onScroll };
}
