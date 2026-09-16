// ============================================================================
// Edge Function · withdrawal-cleanup
// 회원 최종 탈퇴 — MY 프로필 이미지 **실제 파일** 정리 + 30일 지난 신청의 최종 처리
//   (docs/15_회원탈퇴정책_v1.md · migration 20260917000001)
//
//   ① 30일이 지난 탈퇴 신청 계정(아직 처리 전 + 이미 DB cron 이 처리한 tombstone 포함)을 찾는다
//   ② 그 계정의 profile-images/{uid}/* 를 **Storage API** 로 지운다
//      (SQL 로 storage.objects 를 지우면 메타 행만 사라지고 파일이 남는다 — 그래서 여기서 한다)
//   ③ public.finalize_withdrawals() 를 불러 권한 제거 · 비식별화 · auth 삭제를 마무리한다
//
// ⚠️ 호출은 service_role 토큰으로만 통과한다 (_shared/auth.ts identifyCaller → "service").
//    앱(anon · 사용자 토큰)은 401. 클라이언트는 service_role 을 갖지 않는다.
// ⚠️ MY 프로필 이미지만 지운다. community-images · brand-assets · 여행/모임 자산은 건드리지 않는다.
// ⚠️ 멱등이다. 이미 비어 있는 폴더 · 이미 처리된 계정은 건너뛴다. 하루 몇 번을 불러도 같다.
//
// 스케줄 (외부 설정 · 사람이 직접): Supabase Dashboard → Integrations → Cron → 이 함수를 하루 1회
//   POST https://<project-ref>.supabase.co/functions/v1/withdrawal-cleanup
//   Authorization: Bearer <service_role key>
//   pg_net 이 없어 DB cron 에서 직접 부를 수 없다. DB cron(account_withdrawal_finalize) 은 그대로 돌고,
//   이 함수는 그보다 먼저 파일을 지우거나(권장) 나중에 남은 파일을 지운다.
// 배포 (사람이 직접 실행)
//   npx supabase functions deploy withdrawal-cleanup
// ============================================================================
import { createClient } from "npm:@supabase/supabase-js@2";

import { identifyCaller, unauthorized } from "../_shared/auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const BUCKET = "profile-images";
/** 서버 함수와 같은 값. (public.request_withdrawal · finalize_withdrawals) */
const GRACE_DAYS = 30;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

/** 폴더 안 파일을 전부 지운다. 지운 개수를 돌려준다. (하위 폴더는 쓰지 않는 구조라 1단계만 본다) */
async function removeProfileFolder(
  client: ReturnType<typeof createClient>,
  userId: string,
): Promise<number> {
  const { data: files, error: listError } = await client.storage.from(BUCKET).list(userId, {
    limit: 1000,
  });
  if (listError) throw listError;
  const paths = (files ?? []).map((file) => `${userId}/${file.name}`);
  if (paths.length === 0) return 0;

  const { error: removeError } = await client.storage.from(BUCKET).remove(paths);
  if (removeError) throw removeError;
  return paths.length;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const caller = await identifyCaller(request);
  if (!caller || caller.kind !== "service") return unauthorized(CORS);

  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("[withdrawal-cleanup] SUPABASE_URL 또는 SERVICE_ROLE_KEY 가 없다");
    return json({ error: "MISCONFIGURED" }, 500);
  }

  const client = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - GRACE_DAYS);

  // 30일이 지난 신청 전부. deleted_at 이 이미 찍힌 tombstone 도 포함한다 —
  // DB cron 이 먼저 처리했더라도 파일은 남아 있을 수 있다.
  const { data: users, error } = await client
    .from("users")
    .select("id")
    .not("withdrawal_requested_at", "is", null)
    .lte("withdrawal_requested_at", cutoff.toISOString());
  if (error) {
    console.error("[withdrawal-cleanup] 대상 조회 실패", error.message);
    return json({ error: "QUERY_FAILED" }, 500);
  }

  let removedFiles = 0;
  const failed: string[] = [];
  for (const row of users ?? []) {
    try {
      removedFiles += await removeProfileFolder(client, row.id);
    } catch (e) {
      // 한 계정의 파일 삭제가 실패해도 나머지는 계속한다. 다음 실행에서 다시 시도된다.
      console.error("[withdrawal-cleanup] 파일 삭제 실패", row.id, e instanceof Error ? e.message : e);
      failed.push(row.id);
    }
  }

  // 파일을 지운 뒤 DB 최종 처리. 이미 처리된 계정은 함수가 스스로 건너뛴다(0건).
  const { data: finalized, error: finalizeError } = await client.rpc("finalize_withdrawals");
  if (finalizeError) {
    console.error("[withdrawal-cleanup] finalize 실패", finalizeError.message);
    return json({ candidates: users?.length ?? 0, removedFiles, failed, finalized: null, error: "FINALIZE_FAILED" }, 500);
  }

  return json({ candidates: users?.length ?? 0, removedFiles, failed, finalized });
});
