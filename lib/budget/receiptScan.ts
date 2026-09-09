// ============================================================================
// 영수증 읽기 결과 검증 (순수)
//
// Edge Function(receipt-scan)이 돌려준 값을 앱이 믿기 전에 한 번 더 본다.
// (CLAUDE.md 10장 — 구조화 응답은 타입·필수 필드를 검증한 뒤 쓴다)
//
// ⚠️ 여기서 DB 에 쓰지 않는다. 폼에 채울 값을 만들 뿐이고 저장은 사용자가 한다.
// ⚠️ 금액은 정수 원 단위로만 폼에 들어간다. 외화면 환산 추정치를 쓰되
//    "환산 확인" 표시를 붙인다. 환율 변환은 [Future]. (CLAUDE.md 3장)
// ============================================================================
import { CATEGORY_CODE, type CategoryCode } from "@/lib/constants/status";

export type ReceiptItem = { name: string; amount: number | null };

export type ReceiptScanResult = {
  merchant: string | null;
  /** 영수증에 찍힌 통화 그대로 */
  total: number;
  currency: string;
  /** 외화일 때 모델의 원화 추정. KRW 면 null */
  totalKrwEstimate: number | null;
  /** 'YYYY-MM-DD' */
  date: string | null;
  categoryCode: CategoryCode | null;
  /** 0~100 */
  confidence: number;
  items: ReceiptItem[];
};

const CODES = new Set<string>(Object.values(CATEGORY_CODE));

export function sanitizeReceipt(raw: unknown): ReceiptScanResult | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const total = Number(r.total);
  if (!Number.isFinite(total) || total <= 0) return null;

  const currency =
    typeof r.currency === "string" && /^[A-Z]{3}$/.test(r.currency) ? r.currency : "KRW";
  const krw = Number(r.totalKrwEstimate);
  const code = typeof r.categoryCode === "string" && CODES.has(r.categoryCode) ? (r.categoryCode as CategoryCode) : null;
  const confidence = typeof r.confidence === "number" ? Math.max(0, Math.min(100, Math.round(r.confidence))) : 50;
  const items: ReceiptItem[] = Array.isArray(r.items)
    ? r.items
        .filter((it): it is { name: string; amount?: unknown } => Boolean(it) && typeof (it as { name?: unknown }).name === "string")
        .slice(0, 5)
        .map((it) => ({ name: it.name, amount: Number.isFinite(Number(it.amount)) ? Number(it.amount) : null }))
    : [];

  return {
    merchant: typeof r.merchant === "string" && r.merchant.trim() ? r.merchant.trim() : null,
    total: Math.round(total),
    currency,
    totalKrwEstimate: currency !== "KRW" && Number.isFinite(krw) && krw > 0 ? Math.round(krw) : null,
    date: typeof r.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : null,
    categoryCode: code,
    confidence,
    items,
  };
}

/** 폼의 금액 칸에 넣을 원화 정수. 외화인데 추정도 없으면 null (사용자가 적는다) */
export function receiptAmountKrw(receipt: ReceiptScanResult): number | null {
  if (receipt.currency === "KRW") return receipt.total;
  return receipt.totalKrwEstimate;
}

/** '¥2,380 · 원화 환산은 확인해 주세요' 같은 안내. KRW 면 null */
export function receiptCurrencyNote(receipt: ReceiptScanResult): string | null {
  if (receipt.currency === "KRW") return null;
  return `${receipt.currency} ${receipt.total.toLocaleString("ko-KR")} 로 찍힌 영수증이에요. 원화 금액은 대략 환산한 값이라 확인해 주세요.`;
}
