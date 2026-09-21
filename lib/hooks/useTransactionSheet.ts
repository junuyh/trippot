// ============================================================================
// 거래 상세 바텀시트 — 상태와 저장
//
// ⚠️ 왜 훅인가 (2026-09-21 2차 테스트)
//    "수기 입출금을 고치려고 거래 상세 화면까지 들어가기엔 화면이 너무 많다.
//     입출금 내역을 누르면 바텀시트로 상세가 뜨고 거기서 바로 고치게 해 달라"
//    는 요청이다. 그 시트를 여행자금(FUND-01) · 전체 내역 · 카테고리 예산
//    **세 곳**이 쓴다. 상태와 저장을 세 번 적으면 세 곳이 갈린다.
//
// ⚠️ UI 는 components/fund/TransactionSheet.tsx 가 그린다. 그쪽은 supabase 를
//    부르지 않는다. (CLAUDE.md 9장) 조회·저장은 전부 여기서 한다.
//
// ⚠️ 저장이 끝나면 onChanged() 를 부른다. 목록을 다시 읽는 건 화면의 몫이다.
//    훅이 남의 화면 데이터를 고치지 않는다.
// ============================================================================
import { useCallback, useState } from "react";

import { TRANSACTION_SOURCE_TYPE, TRIP_STATUS } from "@/lib/constants/status";
import {
  deleteTransaction,
  updateManualTransaction,
  type Transaction,
} from "@/lib/supabase/queries/transactions";

export type TransactionSheetInput = {
  /** 저장이 끝난 뒤 목록을 다시 읽는다 */
  onChanged: () => void | Promise<void>;
  /** 결산이 확정된 여행이면 고칠 수 없다. (IA v2 §2-6-3) */
  tripStatus: string | null | undefined;
};

export function useTransactionSheet({
  onChanged,
  tripStatus,
}: TransactionSheetInput) {
  /** 시트에 띄운 거래. null 이면 닫힌 상태 */
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftAmount, setDraftAmount] = useState<number | null>(null);
  /** 'yyyy-MM-dd'. 달력에서 고른 거래일 */
  const [draftDate, setDraftDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const settled = tripStatus === TRIP_STATUS.SETTLED;

  /**
   * 고칠 수 있는 거래인가.
   *
   * ⚠️ **직접 적은 거래만.** 계좌에서 들어온 거래는 실제 결제 기록이라
   *    앱에서 금액을 바꾸면 계좌 내역과 어긋난다.
   * ⚠️ 결산이 확정된 여행은 아무것도 못 고친다. 이미 남은 스냅샷과 틀어진다.
   */
  const canEdit =
    !settled &&
    transaction?.source_type === TRANSACTION_SOURCE_TYPE.MANUAL;

  const open = useCallback((next: Transaction) => {
    setTransaction(next);
    setEditing(false);
    setError(null);
  }, []);

  const close = useCallback(() => {
    setTransaction(null);
    setEditing(false);
    setError(null);
  }, []);

  /** 수정 폼을 연다. 지금 값을 초안에 담는다 */
  const startEdit = useCallback(() => {
    if (!transaction) return;
    setDraftName(transaction.name ?? "");
    setDraftAmount(transaction.amount);
    setDraftDate(transaction.occurred_at.slice(0, 10));
    setError(null);
    setEditing(true);
  }, [transaction]);

  const cancelEdit = useCallback(() => {
    setEditing(false);
    setError(null);
  }, []);

  /**
   * 이름·금액·거래일을 저장한다.
   *
   * ⚠️ 거래일은 **정오로 저장한다.** date 만 받아 자정으로 넣으면 시간대
   *    경계에서 하루가 밀린다. 지출 직접 입력이 쓰는 방식과 같다.
   */
  const save = useCallback(async () => {
    if (!transaction || busy) return;
    const amount = draftAmount ?? 0;
    if (amount <= 0) {
      setError("금액을 1원 이상 넣어 주세요.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draftDate)) {
      setError("거래일을 골라 주세요.");
      return;
    }
    setBusy(true);
    try {
      const next = await updateManualTransaction(transaction.id, {
        name: draftName.trim() === "" ? null : draftName.trim(),
        amount,
        occurredAt: `${draftDate}T12:00:00+09:00`,
      });
      setTransaction(next);
      setEditing(false);
      await onChanged();
    } catch {
      setError("저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }, [busy, draftAmount, draftDate, draftName, onChanged, transaction]);

  /**
   * 거래를 지운다.
   *
   * ⚠️ 물리 삭제가 아니라 deleted_at 을 채운다. 실제로 일어난 거래를 지우면
   *    나중에 계좌 내역과 대조할 수 없다. (queries/transactions)
   * ⚠️ 지운 뒤 카테고리·계획의 실제 금액이 다시 계산된다. 목록도 다시 읽는다.
   * ⚠️ 확인은 부르는 화면이 받는다. 훅이 Alert 를 띄우지 않는다.
   */
  const remove = useCallback(async () => {
    if (!transaction || busy) return;
    setBusy(true);
    try {
      await deleteTransaction(transaction.id);
      setTransaction(null);
      setEditing(false);
      await onChanged();
    } catch {
      setError("삭제하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }, [busy, onChanged, transaction]);

  return {
    transaction,
    open,
    close,
    canEdit,
    settled,
    editing,
    startEdit,
    cancelEdit,
    draftName,
    setDraftName,
    draftAmount,
    setDraftAmount,
    draftDate,
    setDraftDate,
    remove,
    error,
    busy,
    save,
  };
}

export type TransactionSheetController = ReturnType<typeof useTransactionSheet>;
