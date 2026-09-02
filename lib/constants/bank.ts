// 금융기관 코드 → 표시 이름.
//
// financial_accounts.institution_code 는 금융결제원 기관 코드다.
// 화면에 코드를 그대로 보여주면 사용자는 '090' 이 어디인지 모른다.
//
// ⚠️ MVP 금융 데이터는 전부 Supabase Mock 이다. (CLAUDE.md 11장)
//    실서비스에서는 기관 목록을 API 로 받아 이 표를 대체한다.
export const INSTITUTION_NAME: Record<string, string> = {
  "004": "KB국민은행",
  "011": "NH농협은행",
  "020": "우리은행",
  "081": "하나은행",
  "088": "신한은행",
  "090": "카카오뱅크",
  "089": "케이뱅크",
  "092": "토스뱅크",
};

/** 코드를 모르면 코드를 그대로 보여준다. 빈칸보다 낫다 */
export function institutionName(code: string | null | undefined): string {
  if (!code) return "연결 계좌";
  return INSTITUTION_NAME[code] ?? `기관 ${code}`;
}
