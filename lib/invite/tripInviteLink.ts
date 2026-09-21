// ============================================================================
// 여행 초대 링크 · 초대 메시지 (INV-01 공유)
//
// 기준: docs/10_여행초대정책_v2.md §5 · §13
//
// 링크
//   https://trippot-web.pages.dev/invite/#{token}  (2026-09-21 · 착륙 페이지)
//   token 은 서버가 만든 값을 그대로 싣는다. (queries/tripInvites)
//
//   ⚠️ 이전에는 expo-linking 이 실행 환경을 보고 주소를 정했다
//      (APK → trippot://…, Expo Go → exp://…). 그래서 **만든 쪽과 여는 쪽의 앱
//      종류가 같아야만** 열렸다. APK 로 만든 링크는 아이폰 Expo Go 에서 "유효하지
//      않은 주소" 가 됐다. (2026-09-17 테스트)
//      지금은 https 착륙 페이지 하나를 보내고, 받는 사람이 페이지에서 자기 환경
//      버튼(TripPot 앱 / Expo Go / 개발 서버)을 골라 연다. 페이지 원본은 web/invite/.
//   ⚠️ token 은 ?t= 가 아니라 # 뒤에 둔다. fragment 는 서버로 가지 않아 호스팅
//      기록에 남지 않는다. 페이지는 token 을 저장하지 않는다.
//   ⚠️ 앱 안에서 링크를 여는 경로(app/invite/[token].tsx · trippot://invite/{token})
//      는 그대로다. 페이지의 버튼이 그 주소로 보낸다.
//   [Future] 도메인 + 유료 애플 계정이 생기면 유니버설 링크/앱 링크로 바꿔
//      앱이 있을 때 버튼 없이 바로 열리게 한다. 주소 형태는 그대로 쓸 수 있다.
//
// 메시지
//   기존 11종(lib/invite/inviteLink.ts)의 **첫 문장만** 골라 쓴다. 원본은 건드리지
//   않는다. 나머지 줄은 여기서 새로 쓴다 — 11종의 본문에는 "링크를 눌러 들어와
//   주세요" 처럼 승인 절차 없이 참여가 끝나는 것으로 읽히는 문장이 있어서다.
//
//   최신 메시지가 반드시 담는 것 (§13)
//     · 여행 초대다
//     · 링크에서 **참가를 요청**한다
//     · **여행장이 수락**하면 참여가 확정된다
//     · 링크는 **7일** 유효
//
//   {모임명} 은 넣지 않는다. 승인 과정에서 새 모임으로 분리될 수 있어(§9-4)
//   메시지에 적힌 모임 이름이 결과와 달라질 수 있다.
//
// ⚠️ 순수 함수. 네트워크도 스토리지도 없다.
// ============================================================================
import { INVITE_TEMPLATES } from '@/lib/invite/inviteLink';

/**
 * 초대 착륙 페이지 주소. 저장소 web/invite/ 가 Cloudflare Pages 로 배포된 것.
 * 도메인이 바뀌면 여기 한 곳만 고친다. 끝에 / 를 붙이지 않는다.
 */
export const TRIP_INVITE_WEB_BASE = 'https://trippot-web.pages.dev/invite';

/**
 * 초대를 받은 사람에게 보내는 주소. 착륙 페이지 → 환경별 버튼 → app/invite/[token].tsx
 *
 * 예) https://trippot-web.pages.dev/invite/#ad90c6…ff3
 */
export function buildTripInviteLink(token: string): string {
  return `${TRIP_INVITE_WEB_BASE}/#${encodeURIComponent(token)}`;
}

/**
 * 11종 중 첫 문장이 여행 기준이고 {모임명} 이 없는 것.
 * (0-based · 2026-09-10 선별: 2 · 4 · 8 · 11번)
 *
 * ⚠️ 원본 배열의 순서가 바뀌면 이 번호도 바뀐다. 그래서 아래 pickOpener 가
 *    실제로 {모임명} 이 없는지 한 번 더 확인하고, 아니면 기본 문장으로 간다.
 */
const OPENER_TEMPLATE_INDEXES = [1, 3, 7, 10] as const;

const FALLBACK_OPENER = '✈️ {여행명} 여행에 초대됐어요!';

/** 첫 문장 하나를 고른다. 시트를 열 때 한 번 뽑아 공유·복사가 같은 글을 쓰게 한다 */
export function pickTripInviteOpener(): string {
  const index =
    OPENER_TEMPLATE_INDEXES[Math.floor(Math.random() * OPENER_TEMPLATE_INDEXES.length)];
  const firstLine = INVITE_TEMPLATES[index]?.split('\n')[0]?.trim() ?? '';
  // 원본이 바뀌어 모임명이 끼어들면 쓰지 않는다
  if (firstLine === '' || firstLine.includes('{모임명}')) return FALLBACK_OPENER;
  return firstLine;
}

/**
 * 카카오톡·문자에 그대로 붙여 넣는 초대 글.
 *
 * @param opener pickTripInviteOpener() 가 고른 첫 문장. 자리표시자 {여행명} 을 채운다
 */
export function buildTripInviteMessage(input: {
  opener: string;
  destination: string;
  periodLabel: string | null;
  link: string;
}): string {
  const opener = input.opener.replaceAll('{여행명}', input.destination);
  const period = input.periodLabel ? `${input.destination} · ${input.periodLabel}` : input.destination;

  return [
    opener,
    '',
    period,
    'TripPot에서 여행비를 함께 정하고 준비 현황을 한눈에 봐요.',
    '',
    '여행 정보를 확인하고 참여 의사를 보내주세요.',
    '여행장이 수락하면 참여가 확정돼요.',
    '',
    '초대 링크는 7일 동안 쓸 수 있어요.',
    input.link,
  ].join('\n');
}
