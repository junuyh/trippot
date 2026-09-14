// ============================================================================
// MY-01 화면이 그리는 데이터 모양
//
// DB 행을 그대로 넘기지 않고 이 모양으로 바꿔서 넘긴다.
// UI 컴포넌트는 supabase / track() 을 직접 부르지 않는다. (CLAUDE.md 9장)
// ============================================================================

/** 5-1 프로필. IA 가 정의한 사진·이름·연결된 로그인 계정에 대응한다. */
export type MyProfile = {
  name: string;
  /*
   * ⚠️ 로그인 방식(`카카오 로그인`)을 여기에 다시 담지 않는다.
   *    MY 메인은 로그인 방식을 표시하지 않는다는 것이 확정된 UX 정책이다.
   *    (2026-09-10) 그 정보는 **계정 관리 화면에서만** 보여준다.
   *    (app/me/account.tsx · components/mypage/AccountView.tsx)
   */
  /** null 이면 기본 아이콘을 쓴다. 새 이미지 에셋을 추가하지 않는다. */
  profileImageUrl: string | null;
  /**
   * TripPot 사용자 행이 생긴 날(users.created_at · ISO). 여권의 MEMBER SINCE.
   * ⚠️ 카카오 가입일 · 첫 여행일이 아니다. 없으면 null → '—'.
   */
  memberSince: string | null;
};

/** 5-2 내 여행 요약. 목록이 아니라 개수만 보여준다. */
/**
 * ⚠️ 준비 중과 여행 중을 나눈다. 전에는 'ongoing' 하나로 묶여 있었는데,
 *    /me/trips 가 이미 세 갈래(planning · traveling · past)로 나뉘어 있어
 *    카드가 두 개면 눌렀을 때 어느 탭으로 갈지가 애매했다.
 *    (components/my/types.ts 의 MyTripFilter 와 같은 갈래다)
 */
export type MyTripCounts = {
  /** PLANNING */
  planning: number;
  /** TRAVELING */
  traveling: number;
  /** ENDED · SETTLED */
  past: number;
};

/**
 * 알림 목록 한 줄. (2026-09-14)
 *
 * 두 출처를 한 목록으로 보여주기 위한 화면용 모양이다.
 *   db    public.notifications 행           (created_at → createdAt · read_at → readAt)
 *   push  기기에 도착해 보관한 알림           (receivedAt → createdAt)
 * 사용자는 출처를 구분해서 볼 필요가 없다. 배지를 붙이지 않는다.
 * 읽음·삭제만 출처에 따라 다른 함수로 간다. (app/me/notifications.tsx)
 */
export type NotificationListItem = {
  source: 'db' | 'push';
  id: string;
  title: string;
  body: string | null;
  /** ISO. 정렬 기준. */
  createdAt: string;
  readAt: string | null;
};
