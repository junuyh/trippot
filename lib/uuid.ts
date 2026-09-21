// UUID v4 만들기.
//
// ⚠️ Hermes 에는 crypto.randomUUID 가 없다. 있으면 그것을 쓰고, 없으면
//    Math.random 으로 만든다. **보안 토큰용이 아니다.** 행 식별자처럼
//    맞히기 어렵기만 하면 되는 곳에만 쓴다.
//
// ⚠️ 왜 앱에서 id 를 만드나 — insert 뒤 `.select()` 로 돌려받을 수 없는 표가
//    있다. financial_accounts 의 SELECT 정책은 "모임원이거나, 그 계좌를
//    가리키는 fund_source 가 있을 것" 인데, 방금 만든 개인 여행 계좌는 둘 다
//    아니다. 넣기는 되는데 돌려받지 못해 연결이 통째로 실패했다. (2026-09-21)
export function createUuidV4(): string {
  const webCrypto = (globalThis as { crypto?: { randomUUID?: () => string } })
    .crypto;
  if (typeof webCrypto?.randomUUID === "function") {
    return webCrypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
