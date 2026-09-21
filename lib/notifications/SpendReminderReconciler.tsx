// ============================================================================
// 지출 리마인드 동기화 관찰자 — 앱 전역에서 한 번 붙는다 (2026-09-21)
//
// 로그인 확정 시 1회 + background → active 복귀 시 reconcileSpendReminders(userId).
// 여행 일정 · 멤버십이 다른 기기나 다른 화면에서 바뀌어도 여기서 OS 예약을 지금 DB 에 맞춘다(안전망).
// 일정 저장 · 나가기 직후에는 그 화면이 helper 를 한 번 더 부른다.
// ⚠️ AuthProvider 안쪽. 미리보기(isPreview)는 세션이 없어 아무것도 하지 않는다. 화면을 그리지 않는다. 실패는 삼킨다.
// ============================================================================
import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { useAuth, useCurrentUserId } from '@/lib/auth/AuthProvider';
import { reconcileSpendReminders } from '@/lib/notifications/spendReminder';

export function SpendReminderReconciler() {
  const currentUserId = useCurrentUserId();
  const { isPreview } = useAuth();
  const userId = __DEV__ && isPreview ? null : currentUserId;

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    const run = () => {
      if (alive) reconcileSpendReminders(userId).catch(() => undefined);
    };
    run();
    let previous: AppStateStatus = AppState.currentState;
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active' && previous !== 'active') run();
      previous = next;
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, [userId]);

  return null;
}
