// ============================================================================
// Edge Function 공용 · 호출한 사람 확인
//
// ⚠️ **verify_jwt = true 만으로는 부족하다.**
//    앱에 들어 있는 anon 키 자체가 유효한 JWT 라서 그 검사를 통과한다.
//    APK 를 풀어 anon 키를 꺼내면 로그인 없이 AI 함수를 무한히 부를 수 있고,
//    무료 등급 한도가 바닥나면 테스터 화면에서 AI 기능이 멈춘다.
//    그래서 요청의 토큰으로 **실제 로그인 사용자인지** 한 번 더 확인한다.
//
// ⚠️ 통과하는 호출은 둘뿐이다.
//      user     로그인한 사용자의 access token  → Auth 서버가 사용자를 돌려준다
//      service  service_role 키 그대로           → 캐시 채우기 같은 관리 작업
//    anon 키, 만료된 토큰, 아무 문자열은 전부 null 이다.
//
// ⚠️ Auth 서버에 한 번 더 묻는 비용(수십 ms)을 치른다. 서명만 로컬에서 검사하면
//    로그아웃·탈퇴한 사용자의 토큰이 만료 전까지 계속 통과한다.
//
// ⚠️ 개발용 미리보기(__DEV__ · 세션 없음)는 여기서 막힌다. 앱은 함수가 실패하면
//    카탈로그 값으로 돌아가므로 화면은 깨지지 않는다. AI 결과를 확인하려면
//    카카오로 실제 로그인한다.
// ============================================================================

export type Caller =
  | { kind: "user"; userId: string }
  | { kind: "service" };

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

/** 길이가 같을 때 끝까지 비교한다. 앞글자에서 바로 멈추면 비교 시간으로 키를 추측할 수 있다 */
function sameSecret(a: string, b: string): boolean {
  if (a.length === 0 || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * 요청을 보낸 사람을 확인한다. 확인되지 않으면 null.
 *
 * ⚠️ 실패 사유를 호출한 쪽에 돌려주지 않는다. 무엇이 틀렸는지 알려 주면
 *    토큰을 바꿔 가며 시험하기 쉬워진다.
 */
export async function identifyCaller(request: Request): Promise<Caller | null> {
  const header = request.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;

  if (sameSecret(token, SERVICE_KEY)) return { kind: "service" };

  // anon 키로는 사용자가 없다. Auth 서버까지 갈 필요도 없다.
  if (sameSecret(token, ANON_KEY)) return null;

  if (!SUPABASE_URL || !ANON_KEY) {
    console.error("[auth] SUPABASE_URL 또는 SUPABASE_ANON_KEY 가 없다");
    return null;
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` },
    });
    if (response.ok) {
      const user = (await response.json()) as { id?: unknown };
      return typeof user.id === "string" && user.id.length > 0
        ? { kind: "user", userId: user.id }
        : null;
    }

    /*
      ⚠️⚠️ 2026-09-22 · **대시보드의 service_role 키가 위 비교에 안 걸렸다.**

         워밍업 스크립트에 대시보드(Legacy API keys)의 service_role 을 넣었는데
         401 이 났다. Auth 로그: `/user 403 invalid claim: missing sub claim`.
         사용자가 아닌 JWT(= service_role) 가 맞는데, 이 함수 안의
         SUPABASE_SERVICE_ROLE_KEY 값과 글자가 달라 sameSecret 을 통과하지
         못한 것이다. 새 API 키 체계로 바뀌면서 런타임에 주입되는 값과
         대시보드에 보이는 값이 어긋날 수 있다.

         그래서 **글자 비교로 못 가렸으면 Supabase 에게 직접 묻는다.**
         관리자 API 는 service_role 로만 열린다. 200 이면 service 다.

      ⚠️ 사용자 JWT 가 아니고(sub 없음) JWT 모양일 때만 묻는다. 아무 문자열에
         관리자 API 를 때리지 않는다. anon 은 이미 위에서 걸러졌다.
    */
    if (token.split(".").length === 3) {
      const admin = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1`, {
        headers: { apikey: token, Authorization: `Bearer ${token}` },
      });
      if (admin.ok) return { kind: "service" };
    }
    return null;
  } catch (error) {
    // Auth 서버에 닿지 못하면 통과시키지 않는다. 열어 두는 쪽으로 실패하지 않는다.
    console.error("[auth] 사용자 확인 실패", error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * 확인되지 않은 호출에 돌려줄 응답.
 *
 * ⚠️ 앱은 함수가 2xx 가 아니면 조용히 기본값(카탈로그)으로 돌아간다.
 *    그래서 401 을 줘도 화면은 깨지지 않는다. 앱 코드를 고치지 않는다.
 */
export function unauthorized(cors: Record<string, string>): Response {
  return new Response(JSON.stringify({ error: "AUTH_REQUIRED" }), {
    status: 401,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
