// ============================================================================
// In-app Banner 관찰자 — 새 DB 알림을 앱 사용 중에 즉시 알린다 (docs/14_알림센터_v1.md §8)
//
// 앱 전역에서 **한 번만** 붙는다. (app/_layout.tsx · AuthProvider 안쪽 · 화면 위에 겹침)
//
// 두 경로로 새 알림을 안다.
//   1. Realtime  public.notifications INSERT (user_id = 나) — Supabase postgres_changes 구독.
//                (migration 20260916000001 ⑩ 이 publication 에 표를 넣었다)
//   2. 보완      앱을 켰을 때 · background → foreground 로 돌아왔을 때 안 읽은 알림을 다시 본다.
//                Realtime 이 끊겼거나 앱이 꺼져 있던 동안의 알림을 잡는다. 최신 1건만.
//
// 세션 dedupe (docs/14 §8)
//   보여준 알림 id 를 메모리 Set 에 둔다. 같은 프로세스에서 같은 알림을 두 번 띄우지 않는다.
//   프로세스가 완전히 꺼지면 Set 도 사라진다 → 여전히 안 읽은 알림은 다음 실행에서 한 번 더 뜬다.
//   Set 을 DB · AsyncStorage 에 저장하지 않는다.
//
// Banner ≠ 읽음. 배너가 떴다고 read_at 을 찍지 않는다. [확인] → 상세 진입 → 거기서 읽음.
//
// 예외 (docs/14 §8)
//   INVITE_RECEIVED 는 사용자가 초대 링크를 여는 순간 만들어진다. 그때 이미 초대 화면을 보고
//   있으므로 /invite/* 위에서는 배너를 생략하고 Set 에만 넣는다. 알림센터에는 남는다.
//   같은 알림의 상세를 보고 있을 때도 생략한다.
//
// ⚠️ Remote Push 를 여기서 다루지 않는다. PR #97 PushInboxObserver 와 독립이다.
//    나중에 Push 를 눌러 앱을 열면 그 경로가 상세로 보내며 markBannerShown() 을 불러 이 배너를
//    막을 수 있도록 Set 을 밖으로 열어 둔다.
// ⚠️ 개발용 미리보기(isPreview)에서는 아무것도 하지 않는다. 세션이 없어 RLS 가 잠기면 막힌다.
// ⚠️ 실패는 전부 삼킨다. 알림 때문에 앱이 죽지 않는다.
// ============================================================================
import { router, usePathname } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import type { RealtimeChannel } from '@supabase/supabase-js';

import { NotificationBanner } from '@/components/ui';
import { useAuth, useCurrentUserId } from '@/lib/auth/AuthProvider';
import { NOTIFICATION_TYPE } from '@/lib/constants/status';
import { supabase } from '@/lib/supabase/client';
import { getUnreadNotifications, type Notification } from '@/lib/supabase/queries/notifications';

/** 이번 프로세스에서 배너로 보여준(또는 보여줄 필요가 없던) 알림 id. 모듈 수준 = 앱 세션 수명. */
const shownInSession = new Set<string>();

/** 다른 경로(Push 탭 등)가 같은 알림의 배너를 막고 싶을 때. */
export function markBannerShown(notificationId: string): void {
  shownInSession.add(notificationId);
}

/** 배너가 떠 있는 시간. 지나면 조용히 사라진다(읽음 아님). */
const AUTO_HIDE_MS = 6000;

/** Realtime payload.new 가 정말 알림 행인지. 형태를 믿지 않는다. */
function isNotificationRow(value: unknown): value is Notification {
  if (value === null || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === 'string' &&
    typeof row.user_id === 'string' &&
    typeof row.type === 'string' &&
    typeof row.title === 'string' &&
    typeof row.created_at === 'string'
  );
}

export function NotificationBannerObserver() {
  const currentUserId = useCurrentUserId();
  const { isPreview, session } = useAuth();
  /**
   * Realtime 인증에 쓸 현재 access token. (2026-09-16 2계정 E2E 결함 수정)
   * 앱이 켜진 채 로그인한 사용자는 채널을 만드는 순간 Realtime 소켓이 아직 이전/anon 토큰을
   * 들고 있을 수 있어 join 이 RLS 에서 거절되고 구독이 생기지 않았다(B 계정 재현). 그래서
   * 채널을 만들기 **전에** 이 토큰을 Realtime 에 명시적으로 넘긴다. 토큰이 갱신되면 채널도 다시 만든다.
   * ⚠️ 토큰 값을 로그에 찍지 않는다.
   */
  const accessToken = session?.access_token ?? null;
  // 개발용 미리보기는 실제 세션이 없다. Realtime 도 unread 조회도 하지 않는다(RLS 대비).
  // 실제 카카오 로그인 사용자만 구독한다.
  const userId = __DEV__ && isPreview ? null : currentUserId;
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const [current, setCurrent] = useState<Notification | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  };

  /** 지금 이 알림을 배너로 띄울지. 띄우든 안 띄우든 Set 에는 넣는다(같은 세션에서 다시 안 뜬다). */
  const offer = useCallback((row: Notification) => {
    if (shownInSession.has(row.id)) return;
    shownInSession.add(row.id);

    const path = pathnameRef.current ?? '';
    // 초대 화면을 보는 중에 생긴 INVITE_RECEIVED — 같은 내용을 위에 또 띄우지 않는다.
    if (row.type === NOTIFICATION_TYPE.INVITE_RECEIVED && path.startsWith('/invite/')) return;
    // 이미 그 알림의 상세를 보고 있다.
    if (path === `/me/notifications/${row.id}`) return;

    clearTimer();
    setCurrent(row);
    hideTimer.current = setTimeout(() => setCurrent(null), AUTO_HIDE_MS);
  }, []);

  /** 보완 경로 — 안 읽은 것 중 이번 세션에 안 보여준 최신 1건만. 여러 개를 연달아 띄우지 않는다. */
  const offerLatestUnread = useCallback(
    async (uid: string) => {
      try {
        const unread = await getUnreadNotifications(uid, 5);
        const next = unread.find((row) => !shownInSession.has(row.id));
        if (next) offer(next);
      } catch {
        // 네트워크 등. 배너는 보너스다. 조용히 넘어간다.
      }
    },
    [offer],
  );

  // 1. Realtime 구독 — 사용자 1명당 채널 1개. 로그아웃·계정 전환·토큰 갱신 시 정리하고 다시 만든다.
  //    순서: 현재 세션 토큰을 Realtime 에 반영(setAuth) → 채널 생성 → subscribe → 상태 확인.
  //    SUBSCRIBED 가 아니면(CHANNEL_ERROR · TIMED_OUT) 2초 뒤 **한 번만** 다시 만든다. 무한 재시도 없음.
  useEffect(() => {
    if (!userId || !accessToken) return;
    let alive = true;
    let channel: RealtimeChannel | null = null;
    let retried = false;

    const start = async () => {
      try {
        await supabase.realtime.setAuth(accessToken);
      } catch {
        // 인증 반영에 실패해도 구독은 시도한다. 실패하면 아래 상태 콜백이 잡는다.
      }
      if (!alive) return;

      channel = supabase
        .channel(`notifications:${userId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
          (payload) => {
            if (!alive) return;
            const row: unknown = payload.new;
            if (isNotificationRow(row) && row.user_id === userId && row.read_at === null) offer(row);
          },
        )
        .subscribe((status) => {
          if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && !retried && alive) {
            retried = true;
            setTimeout(() => {
              if (!alive) return;
              if (channel) {
                void supabase.removeChannel(channel);
                channel = null;
              }
              void start();
            }, 2000);
          }
        });
    };

    void start();

    return () => {
      alive = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [userId, accessToken, offer]);

  // 2. 앱 시작(로그인 확정) 시 1회 + background/inactive → active 복귀 시.
  useEffect(() => {
    if (!userId) return;
    void offerLatestUnread(userId);

    let previous: AppStateStatus = AppState.currentState;
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active' && previous !== 'active') void offerLatestUnread(userId);
      previous = next;
    });
    return () => sub.remove();
  }, [userId, offerLatestUnread]);

  // 로그아웃하면 떠 있던 배너도 내린다.
  useEffect(() => {
    if (!userId) {
      clearTimer();
      setCurrent(null);
    }
  }, [userId]);

  useEffect(() => clearTimer, []);

  if (!userId || !current) return null;

  const notification = current;
  return (
    <NotificationBanner
      title={notification.title}
      body={notification.body}
      onConfirm={() => {
        clearTimer();
        setCurrent(null);
        // 상세가 읽음 처리한다. (docs/14 §7)
        router.push({
          pathname: '/me/notifications/[notificationId]',
          params: { notificationId: notification.id, source: 'db' },
        });
      }}
      onDismiss={() => {
        clearTimer();
        setCurrent(null);
      }}
    />
  );
}
