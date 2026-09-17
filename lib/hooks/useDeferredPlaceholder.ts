// ============================================================================
// TextInput 플레이스홀더가 첫 그림에서 번지는 것을 피한다 (2026-09-16)
//
// ── 증상 ────────────────────────────────────────────────────────────────────
//
//   플레이스홀더 글자만 흐릿하게 번진다. 같은 화면의 <Text> 는 멀쩡하다.
//   글자 가장자리가 배경에서 글자색까지 내려가는 폭을 재면 이렇다.
//
//     iOS 설정 앱의 "검색"        2px
//     같은 화면의 <Text>          2px
//     우리 TextInput 플레이스홀더  7px   ← 3.5배
//
//   테두리는 칼같이 선명한데(255 → 231 231 231 → 255) 글자만 퍼진다.
//   색은 정확하다 — 가장 진한 픽셀이 placeholderTextColor 그대로다.
//   즉 **위치나 색이 아니라 글자를 그리는 시점**의 문제다.
//
// ── 찾아낸 것 ───────────────────────────────────────────────────────────────
//
//   · 간헐적이다. Fast Refresh 로 다시 그려지면 선명해지고, 새로 마운트하면
//     다시 번진다. 그래서 한때 "고쳐졌다" 고 착각했다.
//   · 우리 그림자 스타일 탓이 아니다 (관련 폴더에 그림자 코드가 없다)
//   · NativeWind 탓이 아니다 (inline style 로 바꿔도 같다)
//   · 신아키텍처(Fabric) 탓만도 아니다 (맨 TextInput 은 2px 로 선명하다)
//   · placeholderTextColor · 제어 여부 · 테두리 · 둥근 모서리 · 패딩 — 전부 무관
//
//   남은 설명은 하나다. **마운트 때 한 번 잘못 래스터화되고 그대로 남는다.**
//   그래서 한 틱 뒤에 값을 넣어 **다시 그리게** 한다. 실제로 2px 로 돌아온다.
//
// ── 한계 ────────────────────────────────────────────────────────────────────
//
// ⚠️ 원인을 고친 게 아니라 다시 그리게 하는 것이다. RN 이나 iOS 가 고쳐지면
//    이 훅을 지우면 된다. 지울 때는 위 측정을 다시 해 보면 된다.
//
// ⚠️ 첫 프레임에는 플레이스홀더가 **비어 있다.** 한 틱이라 눈에 띄지 않지만,
//    스크린샷 테스트를 쓴다면 이 사실을 알고 있어야 한다.
// ============================================================================
import { useEffect, useState } from 'react';

/**
 * 한 틱 뒤에 나타나는 플레이스홀더.
 *
 * ```tsx
 * <TextInput placeholder={useDeferredPlaceholder('도시 이름으로 찾기')} />
 * ```
 */
export function useDeferredPlaceholder(placeholder: string | undefined): string | undefined {
  const [value, setValue] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (placeholder === undefined) {
      setValue(undefined);
      return;
    }
    // ⚠️ 0ms 여도 다음 프레임으로 밀린다. 그게 이 훅의 전부다.
    const timer = setTimeout(() => setValue(placeholder), 0);
    return () => clearTimeout(timer);
  }, [placeholder]);

  return value;
}
