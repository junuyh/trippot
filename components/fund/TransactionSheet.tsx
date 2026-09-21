// ============================================================================
// 거래 상세 바텀시트 — 여행자금 · 카테고리 예산이 함께 쓴다
//
// ⚠️ 왜 시트인가 (2026-09-21 2차 테스트)
//    "수기 입출금을 고치려고 거래 상세 화면까지 들어가기엔 화면이 너무 많다.
//     입출금 내역을 누르면 바텀시트로 상세가 뜨고, 수기면 수정 버튼이 보이고,
//     수정도 시트 안에서 끝나게 해 달라" 는 요청이다.
//    목록을 떠나지 않아야 한 건씩 확인하고 고치는 흐름이 끊기지 않는다.
//
// ⚠️ **supabase 도 track 도 부르지 않는다.** (CLAUDE.md 9장)
//    상태와 저장은 lib/hooks/useTransactionSheet.ts 가 맡는다.
//
// ⚠️ 본문은 TransactionDetailBody 를 그대로 쓴다. 전체 내역 화면의 시트와
//    같은 글·같은 줄이어야 한다. 여기서 따로 그리면 두 곳이 갈린다.
// ============================================================================
import { format, parseISO } from "date-fns";
import { Text, View } from "react-native";

import { TransactionDetailBody } from "@/components/fund/TransactionDetailBody";
import { BottomSheet, Button, CurrencyInput, Input } from "@/components/ui";
import type { CountryTheme } from "@/lib/constants/countryTheme";
import {
  TRANSACTION_SOURCE_TYPE,
  type CategoryCode,
  type RefundStatus,
  type TransactionType,
} from "@/lib/constants/status";
import type { TransactionSheetController } from "@/lib/hooks/useTransactionSheet";
import type { BudgetCategory } from "@/lib/supabase/queries/budgets";

type Props = {
  controller: TransactionSheetController;
  theme: CountryTheme;
  /** 카테고리 이름을 붙이는 데 쓴다. 컴포넌트가 예산을 다시 읽지 않는다 */
  categories: BudgetCategory[];
  /** 연결된 계획 이름. 없으면 null */
  planName?: string | null;
  /** 마스킹된 계좌번호. 없으면 null (NFR-002) */
  maskedAccountNumber?: string | null;
  /** 확인이 필요한 이유. 없으면 null */
  reviewNote?: string | null;
};

export function TransactionSheet({
  controller,
  theme,
  categories,
  planName = null,
  maskedAccountNumber = null,
  reviewNote = null,
}: Props) {
  const transaction = controller.transaction;

  return (
    <BottomSheet
      visible={transaction !== null}
      title={controller.editing ? "내용 수정" : "거래 상세"}
      description={
        controller.editing
          ? "직접 적은 거래라 이름과 금액을 고칠 수 있어요. 거래일은 바뀌지 않아요."
          : undefined
      }
      onClose={controller.close}
    >
      {transaction === null ? null : controller.editing ? (
        <View style={{ paddingTop: 12, gap: 12 }}>
          <Input
            label="내용"
            value={controller.draftName}
            onChangeText={controller.setDraftName}
            placeholder="예: 8월 회비"
            maxLength={30}
          />
          <CurrencyInput
            label="금액"
            value={controller.draftAmount}
            onChangeValue={controller.setDraftAmount}
          />
          {controller.error ? (
            <Text style={{ fontSize: 11, color: "#e1394a" }}>
              {controller.error}
            </Text>
          ) : null}
          <View className="flex-row" style={{ gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Button
                label="취소"
                variant="secondary"
                onPress={controller.cancelEdit}
              />
            </View>
            <View style={{ flex: 2 }}>
              <Button
                label="저장"
                loading={controller.busy}
                onPress={() => void controller.save()}
              />
            </View>
          </View>
        </View>
      ) : (
        <View style={{ paddingTop: 8, paddingBottom: 8 }}>
          <TransactionDetailBody
            theme={theme}
            detail={{
              name: transaction.name ?? "이름 없는 거래",
              dateLabel: format(
                parseISO(transaction.occurred_at),
                "yyyy년 M월 d일",
              ),
              amount: transaction.amount,
              fromAccount:
                transaction.source_type !== TRANSACTION_SOURCE_TYPE.MANUAL,
              maskedAccountNumber,
              planName,
              needsReview: reviewNote !== null,
              reviewNote,
              transactionType:
                transaction.transaction_type as TransactionType,
              refundStatus: transaction.refund_status as RefundStatus,
              categoryCode: transaction.budget_category_id
                ? ((categories.find(
                    (c) => c.id === transaction.budget_category_id,
                  )?.category_code as CategoryCode | undefined) ?? null)
                : null,
            }}
            busy={controller.busy}
          />

          {/*
            ⚠️ 직접 적은 거래에만 낸다. 계좌 거래는 실제 결제 기록이라 못 고친다.
               결산이 확정된 여행이면 그 이유를 적는다 — 버튼이 사라진 자리가
               비어 있으면 왜 못 고치는지 알 길이 없다.
          */}
          {controller.canEdit ? (
            <View style={{ marginTop: 14 }}>
              <Button
                label="내용 수정"
                variant="secondary"
                onPress={controller.startEdit}
              />
            </View>
          ) : controller.settled ? (
            <Text
              style={{
                marginTop: 14,
                fontSize: 11,
                lineHeight: 17,
                color: "#858e9c",
              }}
            >
              정산이 확정돼 이 거래는 고칠 수 없어요.
            </Text>
          ) : null}
        </View>
      )}
    </BottomSheet>
  );
}
