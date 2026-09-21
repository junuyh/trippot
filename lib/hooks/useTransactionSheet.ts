// ============================================================================
// 거래 상세 바텀시트 — 상태와 저장
//
// ⚠️⚠️ **시트 하나 안에서 화면만 바꾼다.** ⚠️⚠️
//
//    iOS 는 Modal 이 열려 있는 동안 다른 Modal 을 열면 두 번째가 뜨지 않는다.
//    그래서 상세 시트에서 '카테고리 변경' 을 누르면 아무 일도 없었고, 그 뒤로는
//    보이지 않는 Modal 이 터치를 먹어 화면 전체가 먹통이 됐다. (2026-09-21 4차)
//
//    시트를 새로 열지 않고 **같은 시트의 내용만 갈아 끼운다.** mode 가 그것이다.
//      detail    거래 정보 + 할 수 있는 일
//      edit      이름·금액·날짜 고치기 (직접 적은 거래만)
//      category  예산 카테고리 고르기
//      link      세부 계획 고르기
//
// ⚠️ UI 는 components/fund/TransactionSheet.tsx 가 그린다. 그쪽은 supabase 를
//    부르지 않는다. (CLAUDE.md 9장) 조회·저장은 전부 여기서 한다.
//
// ⚠️ 저장이 끝나면 onChanged() 를 부른다. 목록을 다시 읽는 건 화면의 몫이다.
// ============================================================================
import { useCallback, useMemo, useState } from "react";

import { track } from "@/lib/analytics/track";
import { EVENTS } from "@/lib/analytics/events";
import {
  CATEGORY_CODE_TO_ANALYTICS,
  CATEGORY_METHOD,
  MAPPED_BY,
  TRANSACTION_SOURCE_TYPE,
  TRANSACTION_TYPE,
  TRIP_STATUS,
  type CategoryCode,
} from "@/lib/constants/status";
import type { BudgetCategory, BudgetPlanItem } from "@/lib/supabase/queries/budgets";
import {
  deleteTransaction,
  linkTransactionToPlanItem,
  reviewReason,
  updateManualTransaction,
  updateTransactionMapping,
  type Transaction,
} from "@/lib/supabase/queries/transactions";

export type TransactionSheetMode = "detail" | "edit" | "category" | "link";

export type TransactionSheetInput = {
  /** 저장이 끝난 뒤 목록을 다시 읽는다 */
  onChanged: () => void | Promise<void>;
  /** 결산이 확정된 여행이면 아무것도 고칠 수 없다. (IA v2 §2-6-3) */
  tripStatus: string | null | undefined;
  /** 카테고리 고르기에 쓴다 */
  categories: BudgetCategory[];
  /** 계획 연결 후보. 같은 카테고리 것만 추려서 쓴다 */
  planItems: BudgetPlanItem[];
  /** 로그에 붙일 여행 id */
  tripId?: string | null;
  /** 결과를 알리는 짧은 문구. 화면이 토스트로 띄운다 */
  onNotice?: (message: string) => void;
};

export function useTransactionSheet({
  onChanged,
  tripStatus,
  categories,
  planItems,
  tripId = null,
  onNotice,
}: TransactionSheetInput) {
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [mode, setMode] = useState<TransactionSheetMode>("detail");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 수정 초안
  const [draftName, setDraftName] = useState("");
  const [draftAmount, setDraftAmount] = useState<number | null>(null);
  /** 'yyyy-MM-dd' */
  const [draftDate, setDraftDate] = useState("");
  // 고르는 중인 값
  const [pickedCategoryId, setPickedCategoryId] = useState<string | null>(null);
  const [pickedPlanId, setPickedPlanId] = useState<string | null>(null);

  const settled = tripStatus === TRIP_STATUS.SETTLED;
  const deposit = transaction?.transaction_type === TRANSACTION_TYPE.DEPOSIT;

  /**
   * 이름·금액·날짜를 고칠 수 있는가.
   *
   * ⚠️ **직접 적은 거래만.** 계좌에서 들어온 거래는 실제 결제 기록이라
   *    앱에서 금액을 바꾸면 계좌 내역과 어긋난다.
   */
  const canEdit =
    !settled && transaction?.source_type === TRANSACTION_SOURCE_TYPE.MANUAL;

  /**
   * 카테고리·계획을 손볼 수 있는가.
   *
   * ⚠️ **입금에는 카테고리도 계획도 없다.** 예산을 쓴 게 아니라 자금이 들어온
   *    것이다. 붙이면 그 예산의 실제 사용액이 부풀려진다.
   * ⚠️ 계좌 거래도 분류는 고칠 수 있다. 금액과 달리 분류는 우리가 추측한 값이다.
   */
  const canMap = !settled && !deposit && transaction !== null;

  /** 확인이 필요한 이유. 없으면 null */
  const reason = transaction ? reviewReason(transaction) : null;

  /** 이 거래를 붙일 수 있는 계획. **같은 카테고리만** 본다 */
  const planCandidates = useMemo(() => {
    if (!transaction?.budget_category_id) return [];
    return planItems.filter(
      (item) => item.budget_category_id === transaction.budget_category_id,
    );
  }, [planItems, transaction]);

  /** 연결된 계획 이름. 없으면 null */
  const linkedPlanName = transaction?.budget_plan_item_id
    ? (planItems.find((item) => item.id === transaction.budget_plan_item_id)
        ?.name ?? "계획에 연결됨")
    : null;

  const open = useCallback((next: Transaction) => {
    setTransaction(next);
    setMode("detail");
    setError(null);
  }, []);

  const close = useCallback(() => {
    setTransaction(null);
    setMode("detail");
    setError(null);
  }, []);

  /** 상세로 돌아간다. 고르던 값은 버린다 */
  const backToDetail = useCallback(() => {
    setMode("detail");
    setError(null);
    setPickedCategoryId(null);
    setPickedPlanId(null);
  }, []);

  /*
    ⚠️ 카테고리도 함께 들고 들어간다. (2026-09-21 4차)
       금액과 카테고리를 같이 고치려면 '내용 수정' 한 번, '카테고리 변경'
       한 번 — 두 번 저장해야 했다. 지출을 처음 적을 때는 한 화면에서
       다 받으면서, 고칠 때만 둘로 갈라 놓을 이유가 없다.
  */
  const startEdit = useCallback(() => {
    if (!transaction) return;
    setDraftName(transaction.name ?? "");
    setDraftAmount(transaction.amount);
    setDraftDate(transaction.occurred_at.slice(0, 10));
    setPickedCategoryId(transaction.budget_category_id);
    setError(null);
    setMode("edit");
  }, [transaction]);

  const startChangeCategory = useCallback(() => {
    if (!transaction) return;
    setPickedCategoryId(transaction.budget_category_id);
    setError(null);
    setMode("category");
  }, [transaction]);

  const startLink = useCallback(() => {
    if (!transaction) return;
    setPickedPlanId(transaction.budget_plan_item_id);
    setError(null);
    setMode("link");
  }, [transaction]);

  /**
   * 이름·금액·거래일 저장.
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
      let next = await updateManualTransaction(transaction.id, {
        name: draftName.trim() === "" ? null : draftName.trim(),
        amount,
        occurredAt: `${draftDate}T12:00:00+09:00`,
      });
      /*
        카테고리를 함께 고쳤으면 이어서 반영한다.
        ⚠️ 바뀌지 않았으면 부르지 않는다. 이 호출은 계획 연결을 푼다
           (옮긴 카테고리의 계획이 아니게 되므로). 그대로인 거래의 연결까지
           풀어 버리면 사용자는 건드린 적 없는 것을 잃는다.
      */
      if (canMap && pickedCategoryId !== transaction.budget_category_id) {
        next = await updateTransactionMapping(transaction.id, {
          categoryId: pickedCategoryId,
          categoryMethod: CATEGORY_METHOD.USER,
        });
        const code = categories.find((c) => c.id === pickedCategoryId)
          ?.category_code as CategoryCode | undefined;
        if (code) {
          track(EVENTS.TRANSACTION_CATEGORY_CORRECTED, {
            trip_id: tripId,
            category: CATEGORY_CODE_TO_ANALYTICS[code],
            mapped_by: MAPPED_BY.USER,
          });
        }
      }
      setTransaction(next);
      setMode("detail");
      await onChanged();
      onNotice?.("수정했어요");
    } catch {
      setError("저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }, [
    busy,
    canMap,
    categories,
    draftAmount,
    draftDate,
    draftName,
    onChanged,
    onNotice,
    pickedCategoryId,
    transaction,
    tripId,
  ]);

  /**
   * 예산 카테고리를 바꾼다.
   *
   * ⚠️ category_method 를 USER 로 남긴다. 자동분류가 틀려서 사용자가 고쳤다는
   *    신호이고, 자동분류 정확도를 재는 기준이 된다. (docs/06 §7-3)
   */
  const saveCategory = useCallback(async () => {
    if (!transaction || busy || !pickedCategoryId) return;
    setBusy(true);
    try {
      const next = await updateTransactionMapping(transaction.id, {
        categoryId: pickedCategoryId,
        categoryMethod: CATEGORY_METHOD.USER,
      });
      const code = categories.find((c) => c.id === pickedCategoryId)
        ?.category_code as CategoryCode | undefined;
      if (code) {
        track(EVENTS.TRANSACTION_CATEGORY_CORRECTED, {
          trip_id: tripId,
          category: CATEGORY_CODE_TO_ANALYTICS[code],
          mapped_by: MAPPED_BY.USER,
        });
      }
      setTransaction(next);
      setMode("detail");
      setPickedCategoryId(null);
      await onChanged();
      onNotice?.("카테고리를 바꿨어요");
    } catch {
      setError("카테고리를 저장하지 못했어요.");
    } finally {
      setBusy(false);
    }
  }, [
    busy,
    categories,
    onChanged,
    onNotice,
    pickedCategoryId,
    transaction,
    tripId,
  ]);

  /** 고른 계획에 붙인다. 한 계획에 여러 지출이 붙는 것은 막지 않는다 */
  const saveLink = useCallback(async () => {
    if (!transaction || busy || !pickedPlanId) return;
    setBusy(true);
    try {
      await linkTransactionToPlanItem(transaction.id, pickedPlanId);
      setTransaction({ ...transaction, budget_plan_item_id: pickedPlanId });
      setMode("detail");
      setPickedPlanId(null);
      await onChanged();
      onNotice?.("계획에 연결했어요");
    } catch {
      setError("연결하지 못했어요.");
    } finally {
      setBusy(false);
    }
  }, [busy, onChanged, onNotice, pickedPlanId, transaction]);

  /** 계획 연결을 푼다. ⚠️ 푸는 곳은 여기뿐이다 (스펙 9장) */
  const unlink = useCallback(async () => {
    if (!transaction || busy) return;
    setBusy(true);
    try {
      const next = await updateTransactionMapping(transaction.id, {
        categoryId: transaction.budget_category_id,
        budgetItemId: null,
        categoryMethod: transaction.category_method,
      });
      setTransaction(next);
      await onChanged();
      onNotice?.("계획 연결을 풀었어요");
    } catch {
      setError("연결을 풀지 못했어요.");
    } finally {
      setBusy(false);
    }
  }, [busy, onChanged, onNotice, transaction]);

  /** 자동 분류가 맞다고 확인한다. 카테고리가 없으면 먼저 정해야 한다 */
  const confirmReview = useCallback(async () => {
    if (!transaction || busy) return;
    if (!transaction.budget_category_id) {
      setError("먼저 카테고리를 정해 주세요.");
      return;
    }
    setBusy(true);
    try {
      const next = await updateTransactionMapping(transaction.id, {
        categoryId: transaction.budget_category_id,
        categoryMethod: CATEGORY_METHOD.USER,
      });
      setTransaction(next);
      await onChanged();
      onNotice?.("거래 분류를 확인했어요");
    } catch {
      setError("저장하지 못했어요.");
    } finally {
      setBusy(false);
    }
  }, [busy, onChanged, onNotice, transaction]);

  /**
   * 거래를 지운다.
   *
   * ⚠️ 물리 삭제가 아니라 deleted_at 을 채운다. 실제로 일어난 거래를 지우면
   *    나중에 계좌 내역과 대조할 수 없다. 확인은 화면이 받는다.
   */
  const remove = useCallback(async () => {
    if (!transaction || busy) return;
    setBusy(true);
    try {
      await deleteTransaction(transaction.id);
      setTransaction(null);
      setMode("detail");
      await onChanged();
      onNotice?.("거래를 지웠어요");
    } catch {
      setError("삭제하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }, [busy, onChanged, onNotice, transaction]);

  return {
    transaction,
    mode,
    open,
    close,
    backToDetail,
    // 할 수 있는 일
    canEdit,
    canMap,
    settled,
    reason,
    planCandidates,
    linkedPlanName,
    categories,
    // 수정
    startEdit,
    draftName,
    setDraftName,
    draftAmount,
    setDraftAmount,
    draftDate,
    setDraftDate,
    save,
    // 카테고리
    startChangeCategory,
    pickedCategoryId,
    setPickedCategoryId,
    saveCategory,
    // 계획
    startLink,
    pickedPlanId,
    setPickedPlanId,
    saveLink,
    unlink,
    // 그 밖
    confirmReview,
    remove,
    error,
    busy,
  };
}

export type TransactionSheetController = ReturnType<typeof useTransactionSheet>;
