// ============================================================================
// 여행 멤버 초대 — 링크 만들기 · 공유 시트 상태 (2026-09-16)
//
// 초대를 권하는 자리가 둘이다.
//   · 여행 정보 수정 > 여행 멤버 초대하기   (상시)
//   · 여행 홈 첫 진입 모달                  (한 번)
//
// ⚠️ 둘의 **버튼 이름과 하는 일이 같아야 한다.** (2026-09-16 다빈)
//    한쪽은 링크를 복사하고 다른 쪽은 공유 시트를 여는 식으로 갈리면 사용자가
//    같은 기능인 줄 모른다. 그래서 배선을 이 훅 하나로 모았다.
//
// ⚠️ 복사해 넣지 않는다. 이번 프로젝트에서 leaveTrip · CANCEL_PENDING ·
//    buildFundSnapshot 이 두 벌이 되어 한쪽만 고쳐지는 일을 세 번 겪었다.
//
// ⚠️ 이 훅은 **링크와 시트 상태만** 다룬다. 시트를 그리는 것은 화면이 한다.
//    (CLAUDE.md 9장 — app/ 은 데이터·상태, components/ 는 UI)
// ============================================================================
import * as Clipboard from 'expo-clipboard';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Share } from 'react-native';

import {
  buildTripInviteLink,
  buildTripInviteMessage,
  pickTripInviteOpener,
} from '@/lib/invite/tripInviteLink';
import { getOrCreateTripInvite } from '@/lib/supabase/queries/tripInvites';

type Input = {
  tripId: string | null;
  /** 초대 글에 쓸 여행지. 없으면 "여행" */
  destination: string | null;
  /** "9.25–9.27" 같은 기간. 없으면 글에서 뺀다 */
  periodLabel: string | null;
  /**
   * 개발용 미리보기인가. 미리보기에는 Supabase 세션이 없어 서버가 auth.uid() 를
   * 못 본다. RPC 를 부르지 않고 바로 알린다.
   *
   * ⚠️ 미리보기를 위해 RPC·RLS 를 풀거나 가짜 링크를 만들지 않는다.
   */
  isPreview?: boolean;
  /**
   * 링크를 만들기 **전에** 해야 할 일. `false` 를 돌려주면 중단한다.
   *
   * 여행 정보 수정이 여기서 늘린 인원을 먼저 저장한다 — 서버는 저장된 인원으로
   * 수락을 판정하므로, 저장 전 인원으로 링크를 보내면 수락이 막힌다.
   */
  beforeOpen?: () => Promise<boolean>;
};

export function useTripInvite({
  tripId,
  destination,
  periodLabel,
  isPreview = false,
  beforeOpen,
}: Input) {
  const [inviting, setInviting] = useState(false);
  const [open, setOpen] = useState(false);
  /** RPC 가 돌려준 링크. 유효한 게 있으면 같은 값이 다시 온다 (정책 v2 §4-1) */
  const [link, setLink] = useState<string | null>(null);
  /** 초대 글 첫 문장. 열 때마다 새로 고른다 */
  const [opener, setOpener] = useState<string>('');
  const [copied, setCopied] = useState(false);

  /** 초대 글 전문. 공유와 복사가 같은 글을 쓴다 */
  const message = useMemo(
    () =>
      link
        ? buildTripInviteMessage({
            opener,
            destination: destination ?? '여행',
            periodLabel,
            link,
          })
        : '',
    [destination, link, opener, periodLabel],
  );

  /**
   * 링크만 만들어 둔다. 시트를 열지 않는다.
   *
   * 여행 홈 모달이 링크를 **그대로 보여주기** 때문에 띄우기 전에 필요하다.
   * 실패하면 null 이다 — 부르는 쪽이 모달을 아예 안 띄우면 된다.
   *
   * ⚠️ get_or_create 다. 여러 번 불러도 여행당 링크는 하나다. (정책 v2 §4-1)
   */
  const prepareLink = useCallback(async (): Promise<string | null> => {
    if (!tripId || isPreview) return null;
    try {
      const invite = await getOrCreateTripInvite(tripId);
      const url = buildTripInviteLink(invite.token);
      setLink(url);
      setOpener(pickTripInviteOpener());
      setCopied(false);
      return url;
    } catch {
      return null;
    }
  }, [isPreview, tripId]);

  /** 여행 멤버 초대하기. 링크를 만들고 공유 시트를 연다 */
  const startInvite = useCallback(async () => {
    if (inviting || !tripId) return;

    if (isPreview) {
      Alert.alert(
        '개발용 둘러보기에서는 초대 링크를 만들 수 없어요',
        '실제 초대 기능은 카카오 로그인 후 확인할 수 있어요.',
      );
      return;
    }

    setInviting(true);
    try {
      if (beforeOpen && !(await beforeOpen())) return;

      if ((await prepareLink()) === null) {
        Alert.alert(
          '초대 링크를 준비하지 못했어요',
          '이 여행에 참여 중인 멤버만 초대할 수 있어요. 잠시 후 다시 시도해 주세요.',
        );
        return;
      }
      setOpen(true);
    } finally {
      setInviting(false);
    }
  }, [beforeOpen, inviting, isPreview, prepareLink, tripId]);

  /**
   * OS 공유 시트. 카카오톡이든 문자든 사용자가 고른다.
   * ⚠️ 카카오 talk_message API 를 붙이지 않는다. (정책 v2 §13)
   */
  const share = useCallback(async () => {
    if (!message) return;
    try {
      await Share.share({ message });
    } catch {
      // 사용자가 시트를 닫은 것도 여기로 온다. 알리지 않는다.
    }
  }, [message]);

  const copy = useCallback(async () => {
    if (!message) return;
    try {
      await Clipboard.setStringAsync(message);
      setCopied(true);
    } catch {
      Alert.alert('복사하지 못했어요', '잠시 후 다시 시도해 주세요.');
    }
  }, [message]);

  return {
    /** 링크를 만드는 중 */
    inviting,
    /** 공유 시트가 열려 있는가 */
    open,
    /** 만들어진 링크. 없으면 시트를 그리지 않는다 */
    link,
    copied,
    prepareLink,
    startInvite,
    close: useCallback(() => setOpen(false), []),
    share,
    copy,
  };
}
