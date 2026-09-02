// ============================================================================
// MY-01 화면이 그리는 데이터 모양
//
// DB 행을 그대로 넘기지 않고 이 모양으로 바꿔서 넘긴다.
// UI 컴포넌트는 supabase / track() 을 직접 부르지 않는다. (CLAUDE.md 9장)
// ============================================================================

/** 5-1 프로필. IA 가 정의한 사진·이름·연결된 로그인 계정에 대응한다. */
export type MyProfile = {
  name: string;
  /**
   * 연결된 로그인 계정 표시. 예: `카카오 로그인`
   *
   * ⚠️ 계정 **식별자를 담지 않는다.** auth_provider_user_id 는 `kakao_1001` 같은
   *    내부 연동 ID 라 사용자가 알아볼 수 없고, 화면에 노출해서도 안 된다.
   *    users 에 email 칼럼도 없다. 그래서 어떤 계정으로 로그인했는지만 알려준다.
   *
   * ⚠️ TODO: 실제 Kakao Auth 가 붙고 사용자에게 보여줄 계정 정보(닉네임·이메일 등)
   *    정책이 확정되면 그 값으로 교체한다. 그때까지 임의의 ID·email 을 만들지 않는다.
   *
   * 알 수 없으면 null 이고, 화면은 그 줄을 그리지 않는다.
   */
  accountLabel: string | null;
  /** null 이면 기본 아이콘을 쓴다. 새 이미지 에셋을 추가하지 않는다. */
  profileImageUrl: string | null;
};

/** 5-2 내 여행 요약. 목록이 아니라 개수만 보여준다. */
export type MyTripCounts = {
  /** PLANNING · TRAVELING */
  ongoing: number;
  /** ENDED · SETTLED */
  past: number;
};
