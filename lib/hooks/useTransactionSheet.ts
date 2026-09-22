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
import { useCallback, useEffect, useMemo, useState } from "react";

import { track } from "@/lib/analytics/track";
import { EVENTS } from "@/lib/analytics/events";
import { sortPlansByMatch } from "@/lib/budget/planMatch";
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

/** 시트 안 안내가 떠 있는 시간 */
const NOTICE_MS = 3500;

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
  /**
   * 참여자 id → 이름. 모임 여행에서만 넘긴다. 거래를 적은 사람 이름을 붙이는 데 쓴다.
   *
   * ⚠️ 화면이 한 번만 읽어서 넘긴다. 거래마다 조회하지 않는다.
   */
  memberNameById?: Map<string, string>;
};

export function useTransactionSheet({
  onChanged,
  tripStatus,
  categories,
  planItems,
  tripId = null,
  onNotice,
  memberNameById,
}: TransactionSheetInput) {
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [mode, setMode] = useState<TransactionSheetMode>("detail");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * 시트 안에서 잠깐 보였다 사라지는 안내. 누른 것에 대한 즉답이다.
   *
   * ⚠️ 화면의 토스트(onNotice)를 쓰지 않는다. 이 시트는 Modal 이라 화면에
   *    붙은 토스트는 시트 뒤에 가려 보이지 않는다. 시트가 열린 채로 답해야
   *    하는 말은 시트 안에 적는다. (2026-09-22 — 환불 대기 거래의 '확인 완료')
   */
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

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

  /**
   * 이 거래를 붙일 수 있는 계획. **같은 카테고리만** 본다.
   *
   * ⚠️ 이름이 맞을 법한 것을 위로 올린다. (2026-09-22 — 거래 상세 화면과 같게)
   *    matchScore > 0 이면 시트가 '추천' 을 붙인다. 순서를 바꿀 뿐 연결은
   *    사용자가 누른다. (CLAUDE.md 3장)
   */
  const planCandidates = useMemo(() => {
    if (!transaction?.budget_category_id) return [];
    const sameCategory = planItems.filter(
      (item) => item.budget_category_id === transaction.budget_category_id,
    );
    return sortPlansByMatch(sameCategory, transaction.name).map(
      ({ plan, score }) => ({ ...plan, matchScore: score }),
    );
  }, [planItems, transaction]);

  /** 연결된 계획 이름. 없으면 null */
  const linkedPlanName = transaction?.budget_plan_item_id
    ? (planItems.find((item) => item.id === transaction.budget_plan_item_id)
        ?.name ?? "계획에 연결됨")
    : null;

  /**
   * 이 거래를 적은 사람. 모임 여행이 아니거나 옛 기록·계좌 거래면 null.
   * ⚠️ 이름을 모르면(나간 사람 등) 지어내지 않고 null 로 둔다.
   */
  const authorName =
    transaction?.created_by_user_id && memberNameById
      ? (memberNameById.get(transaction.created_by_user_id) ?? null)
      : null;

  const open = useCallback((next: Transaction) => {
    setTransaction(next);
    setMode("detail");
    setError(null);
    setNotice(null);
  }, []);

  const close = useCallback(() => {
    setTransaction(null);
    setMode("detail");
    setError(null);
    setNotice(null);
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
        /*
          ⚠️ 카테고리가 그대로면 계획 연결도 그대로 둔다. (2026-09-22)
             budgetItemId 를 안 넘기면 null 로 덮여 연결이 풀리고 계획의
             실제 금액이 0 이 됐다. 옮겼을 때만 푼다 — 옮긴 카테고리의
             계획이 아니게 되므로.
        */
        budgetItemId:
          pickedCategoryId === transaction.budget_category_id
            ? transaction.budget_plan_item_id
            : null,
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

  /**
   * 자동 분류가 맞다고 확인한다. 카테고리가 없으면 먼저 정해야 한다.
   *
   * ⚠️ 환불 대기 거래는 여기서 끝나지 않는다. (2026-09-22 테스트)
   *    '확인 필요' 인 이유가 분류가 아니라 환불이라, 분류를 확정해도 목록에서
   *    빠지지 않는다. 전에는 눌러도 아무 변화가 없어 고장처럼 보였다.
   *    저장하지 않고 왜 남는지만 시트 안에 잠깐 적는다.
   *
   * ⚠️ **계획 연결을 그대로 넘긴다.** budgetItemId 를 빼면 null 로 덮여
   *    연결이 풀리고 계획 실제 금액이 0 이 됐다. (2026-09-22 테스트 — '확인 완료'
   *    를 누르면 연결이 사라지던 것)
   */
  const confirmReview = useCallback(async () => {
    if (!transaction || busy) return;
    if (reason === "REFUND_PENDING") {
      setNotice(
        "환불 대기 중인 거래예요. 환불이 끝나면 확인 필요에서 사라져요.",
      );
      return;
    }
    if (!transaction.budget_category_id) {
      setError("먼저 카테고리를 정해 주세요.");
      return;
    }
    setBusy(true);
    try {
      const next = await updateTransactionMapping(transaction.id, {
        categoryId: transaction.budget_category_id,
        budgetItemId: transaction.budget_plan_item_id,
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
  }, [busy, onChanged, onNotice, reason, transaction]);

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
    authorName,
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
    notice,
    busy,
  };
}

export type TransactionSheetController = ReturnType<typeof useTransactionSheet>;
