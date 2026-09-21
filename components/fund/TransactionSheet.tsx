// ============================================================================
// 거래 상세 바텀시트 — 여행자금 · 전체 내역 · 카테고리 예산이 함께 쓴다
//
// ⚠️⚠️ **시트를 새로 열지 않는다. 같은 시트의 내용만 갈아 끼운다.** ⚠️⚠️
//
//    iOS 는 Modal 위에 Modal 을 열면 두 번째가 뜨지 않는다. 예전에는 상세
//    시트에서 '카테고리 변경' 을 누르면 아무 일도 없었고, 그 뒤로는 보이지
//    않는 Modal 이 터치를 먹어 화면 전체가 먹통이 됐다. (2026-09-21 4차)
//    mode 하나로 detail · edit · category · link 를 가른다.
//
// ⚠️ **supabase 도 track 도 부르지 않는다.** (CLAUDE.md 9장)
//    상태와 저장은 lib/hooks/useTransactionSheet.ts 가 맡는다.
//
// ⚠️ 거래 정보 본문은 TransactionDetailBody 를 쓴다. 다른 화면의 상세와 같은
//    글·같은 줄이어야 한다.
// ============================================================================
import { Ionicons } from "@expo/vector-icons";
import { format, parseISO } from "date-fns";
import { Alert, Pressable, Text, View } from "react-native";

import { TransactionDetailBody } from "@/components/fund/TransactionDetailBody";
import { DateRangeCalendar } from "@/components/trip-create";
import { BottomSheet, Button, CurrencyInput, Input } from "@/components/ui";
import { CATEGORY_EMOJI } from "@/lib/constants/categoryEmoji";
import type { CountryTheme } from "@/lib/constants/countryTheme";
import {
  CATEGORY_CODE_LABEL,
  TRANSACTION_SOURCE_TYPE,
  type CategoryCode,
  type RefundStatus,
  type TransactionType,
} from "@/lib/constants/status";
import { reviewReasonNote } from "@/lib/supabase/queries/transactions";
import type { TransactionSheetController } from "@/lib/hooks/useTransactionSheet";

type Props = {
  controller: TransactionSheetController;
  theme: CountryTheme;
  /** 마스킹된 계좌번호. 없으면 null (NFR-002) */
  maskedAccountNumber?: string | null;
};

export function TransactionSheet({
  controller: c,
  theme,
  maskedAccountNumber = null,
}: Props) {
  const tx = c.transaction;

  const title =
    c.mode === "edit"
      ? "내용 수정"
      : c.mode === "category"
        ? "예산 카테고리"
        : c.mode === "link"
          ? `${categoryTag(c)} 세부 계획에 연결`
          : "거래 상세";

  return (
    <BottomSheet visible={tx !== null} title={title} onClose={c.close}>
      {tx === null ? null : (
        <>
          {/*
            어느 모드에서든 **무슨 거래를 다루는 중인지** 위에 둔다.
            계획이 스무 개가 되면 목록만 보고는 알 수 없다.
          */}
          {c.mode === "detail" ? null : (
            <View
              style={{
                marginTop: 12,
                padding: 13,
                borderRadius: 12,
                backgroundColor: "#f5f7f9",
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, color: "#8b94a2" }}>
                  {c.mode === "link" ? "연결할 지출" : "고르는 중인 거래"}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{
                    marginTop: 3,
                    fontSize: 13,
                    fontWeight: "800",
                    color: "#121a2a",
                  }}
                >
                  {tx.name ?? "이름 없는 거래"}
                </Text>
                <Text style={{ marginTop: 2, fontSize: 10, color: "#8b94a2" }}>
                  {format(parseISO(tx.occurred_at), "M월 d일")}
                </Text>
              </View>
              <Text
                style={{ fontSize: 14, fontWeight: "900", color: "#121a2a" }}
              >
                {tx.amount.toLocaleString("ko-KR")}원
              </Text>
            </View>
          )}

          {c.error ? (
            <Text style={{ marginTop: 10, fontSize: 11, color: "#e1394a" }}>
              {c.error}
            </Text>
          ) : null}

          {c.mode === "detail" ? (
            <DetailView c={c} theme={theme} masked={maskedAccountNumber} />
          ) : c.mode === "edit" ? (
            <EditView c={c} />
          ) : c.mode === "category" ? (
            <CategoryView c={c} theme={theme} />
          ) : (
            <LinkView c={c} theme={theme} />
          )}
        </>
      )}
    </BottomSheet>
  );
}

/** 제목에 쓰는 '[식비]'. 카테고리가 없으면 빈 문자열 */
function categoryTag(c: TransactionSheetController): string {
  const code = c.categories.find(
    (cat) => cat.id === c.transaction?.budget_category_id,
  )?.category_code as CategoryCode | undefined;
  return code ? `[${CATEGORY_CODE_LABEL[code]}]` : "";
}

// ── 상세 ───────────────────────────────────────────────────────────────────
function DetailView({
  c,
  theme,
  masked,
}: {
  c: TransactionSheetController;
  theme: CountryTheme;
  masked: string | null;
}) {
  const tx = c.transaction!;
  const code = c.categories.find((cat) => cat.id === tx.budget_category_id)
    ?.category_code as CategoryCode | undefined;

  return (
    <View style={{ paddingTop: 8, paddingBottom: 8 }}>
      <TransactionDetailBody
        theme={theme}
        detail={{
          name: tx.name ?? "이름 없는 거래",
          dateLabel: format(parseISO(tx.occurred_at), "yyyy년 M월 d일"),
          amount: tx.amount,
          fromAccount: tx.source_type !== TRANSACTION_SOURCE_TYPE.MANUAL,
          maskedAccountNumber: masked,
          planName: c.linkedPlanName,
          needsReview: c.reason !== null,
          reviewNote: c.reason !== null ? reviewReasonNote(c.reason) : null,
          transactionType: tx.transaction_type as TransactionType,
          refundStatus: tx.refund_status as RefundStatus,
          categoryCode: code ?? null,
        }}
        busy={c.busy}
      />

      {/*
        ⚠️ 할 수 있는 일을 **전부 여기 모은다.** 예전에는 분류를 고치려면 전체
           내역 화면까지 가야 했고, 그 화면의 시트에서는 수정·삭제가 없었다.
           어디서 열든 같은 일을 할 수 있어야 한다. (2026-09-21 4차)
        ⚠️ 입금에는 카테고리도 계획도 없다. canMap 이 가린다.
      */}
      {c.canMap ? (
        <View className="flex-row" style={{ gap: 8, marginTop: 16 }}>
          <View style={{ flex: 1 }}>
            <Button
              label="카테고리 변경"
              variant="secondary"
              onPress={c.startChangeCategory}
              disabled={c.busy}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              label={c.linkedPlanName ? "연결 해제" : "계획 연결"}
              variant="secondary"
              loading={c.busy}
              onPress={() => {
                if (c.linkedPlanName) {
                  void c.unlink();
                  return;
                }
                c.startLink();
              }}
            />
          </View>
        </View>
      ) : null}

      {/* 수정 · 삭제는 두 칸으로 나란히 둔다 */}
      {c.canEdit ? (
        <View className="flex-row" style={{ gap: 8, marginTop: 8 }}>
          <View style={{ flex: 1 }}>
            <Button
              label="내용 수정"
              variant="secondary"
              onPress={c.startEdit}
              disabled={c.busy}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="이 거래 삭제"
              disabled={c.busy}
              onPress={() =>
                Alert.alert(
                  "이 거래를 지울까요?",
                  "지우면 예산의 실제 사용액에서도 빠져요. 되돌릴 수 없어요.",
                  [
                    { text: "취소", style: "cancel" },
                    {
                      text: "삭제",
                      style: "destructive",
                      onPress: () => void c.remove(),
                    },
                  ],
                )
              }
              className="h-12 flex-row items-center justify-center rounded-xl active:opacity-70"
              style={{
                gap: 5,
                borderWidth: 1,
                borderColor: "#f1c2c7",
                backgroundColor: "#fff6f7",
                opacity: c.busy ? 0.5 : 1,
              }}
            >
              <Ionicons name="trash-outline" size={15} color="#d93346" />
              <Text style={{ fontSize: 13, fontWeight: "800", color: "#d93346" }}>
                이 거래 삭제
              </Text>
            </Pressable>
          </View>
        </View>
      ) : c.settled ? (
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

      {/*
        ⚠️ **맨 아래에 둔다.** (2026-09-21 4차) 고치는 버튼들 사이에 끼어
           있으니 '확인 완료' 가 수정·삭제와 같은 줄의 선택지처럼 보였다.
           이 시트에서 사람이 마지막에 누를 것은 "이대로 맞다" 하나다.
           고치는 일을 먼저 늘어놓고, 끝내는 일을 끝에 둔다.
      */}
      {c.reason !== null && !c.settled ? (
        <View
          style={{
            marginTop: 16,
            paddingTop: 16,
            borderTopWidth: 1,
            borderColor: "#eceef1",
          }}
        >
          <Button
            label="확인 완료"
            loading={c.busy}
            onPress={() => void c.confirmReview()}
          />
        </View>
      ) : null}

    </View>
  );
}

// ── 내용 수정 ───────────────────────────────────────────────────────────────
function EditView({ c }: { c: TransactionSheetController }) {
  return (
    <View style={{ paddingTop: 14, gap: 12 }}>
      <Input
        label="내용"
        value={c.draftName}
        onChangeText={c.setDraftName}
        placeholder="예: 8월 회비"
        maxLength={30}
      />
      <CurrencyInput
        label="금액"
        value={c.draftAmount}
        onChangeValue={c.setDraftAmount}
      />
      <View>
        <Text
          style={{
            fontSize: 12,
            fontWeight: "700",
            color: "#111827",
            marginBottom: 6,
          }}
        >
          거래 날짜
        </Text>
        {/* 이미 일어난 거래라 과거 날짜를 고를 수 있어야 한다 */}
        <DateRangeCalendar
          mode="single"
          disablePast={false}
          startDate={c.draftDate}
          endDate={c.draftDate}
          onChange={(next) => {
            if (next.startDate) c.setDraftDate(next.startDate);
          }}
        />
      </View>
      <Footer
        c={c}
        confirmLabel="저장"
        onConfirm={() => void c.save()}
        disabled={false}
      />
    </View>
  );
}

// ── 카테고리 고르기 ─────────────────────────────────────────────────────────
function CategoryView({
  c,
  theme,
}: {
  c: TransactionSheetController;
  theme: CountryTheme;
}) {
  return (
    <View style={{ paddingTop: 14 }}>
      <View className="flex-row flex-wrap" style={{ gap: 8 }}>
        {c.categories.map((category) => {
          const picked = c.pickedCategoryId === category.id;
          const code = category.category_code as CategoryCode;
          return (
            <Pressable
              key={category.id}
              accessibilityRole="button"
              accessibilityState={{ selected: picked }}
              accessibilityLabel={`${CATEGORY_CODE_LABEL[code]} 고르기`}
              disabled={c.busy}
              onPress={() => c.setPickedCategoryId(category.id)}
              className="flex-row items-center rounded-full active:opacity-70"
              style={{
                gap: 5,
                paddingHorizontal: 13,
                paddingVertical: 9,
                borderWidth: 1,
                borderColor: picked ? theme.primary : "#e5e8ec",
                backgroundColor: picked ? theme.primarySoft : "#fff",
              }}
            >
              <Text style={{ fontSize: 13 }}>{CATEGORY_EMOJI[code]}</Text>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: picked ? "800" : "600",
                  color: picked ? theme.primary : "#5d6674",
                }}
              >
                {CATEGORY_CODE_LABEL[code]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Footer
        c={c}
        confirmLabel="이 카테고리로"
        onConfirm={() => void c.saveCategory()}
        disabled={c.pickedCategoryId === null}
      />
    </View>
  );
}

// ── 계획 고르기 ─────────────────────────────────────────────────────────────
function LinkView({
  c,
  theme,
}: {
  c: TransactionSheetController;
  theme: CountryTheme;
}) {
  if (c.planCandidates.length === 0) {
    return (
      <View style={{ paddingTop: 18 }}>
        <Text style={{ fontSize: 12, lineHeight: 18, color: "#5d6674" }}>
          {c.transaction?.budget_category_id
            ? "이 카테고리에 연결할 세부 계획이 없어요. 예산 상세에서 계획을 먼저 만들어 주세요."
            : "카테고리를 먼저 정해 주세요. 그 카테고리의 계획에만 연결할 수 있어요."}
        </Text>
        <Footer c={c} confirmLabel="" onConfirm={null} disabled />
      </View>
    );
  }

  return (
    <View style={{ paddingTop: 16 }}>
      <View
        style={{
          borderWidth: 1,
          borderColor: "#e5e8ec",
          borderRadius: 13,
          overflow: "hidden",
        }}
      >
        {c.planCandidates.map((item, index) => {
          const picked = c.pickedPlanId === item.id;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityState={{ selected: picked }}
              accessibilityLabel={`${item.name} 계획 고르기`}
              disabled={c.busy}
              onPress={() => c.setPickedPlanId(item.id)}
              className="flex-row items-center active:bg-gray-50"
              style={{
                gap: 10,
                paddingHorizontal: 14,
                paddingVertical: 13,
                borderTopWidth: index === 0 ? 0 : 1,
                borderColor: "#eceef1",
                backgroundColor: picked ? theme.primarySoft : "#fff",
              }}
            >
              <Ionicons
                name={picked ? "radio-button-on" : "radio-button-off"}
                size={17}
                color={picked ? theme.primary : "#c2c8d0"}
              />
              <Text
                numberOfLines={1}
                style={{
                  flex: 1,
                  fontSize: 13,
                  fontWeight: picked ? "800" : "600",
                  color: "#121a2a",
                }}
              >
                {item.name}
              </Text>
              <Text
                style={{ fontSize: 12, fontWeight: "700", color: "#5d6674" }}
              >
                {item.expected_amount.toLocaleString("ko-KR")}원
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Footer
        c={c}
        confirmLabel="이 계획에 연결"
        onConfirm={() => void c.saveLink()}
        disabled={c.pickedPlanId === null}
      />
    </View>
  );
}

/** 취소는 시트를 닫지 않고 **상세로 되돌린다.** 고르다 말았다고 처음부터 하지 않는다 */
function Footer({
  c,
  confirmLabel,
  onConfirm,
  disabled,
}: {
  c: TransactionSheetController;
  confirmLabel: string;
  onConfirm: (() => void) | null;
  disabled: boolean;
}) {
  return (
    <View className="flex-row" style={{ gap: 8, marginTop: 16 }}>
      <View style={{ flex: 1 }}>
        <Button
          label="취소"
          variant="secondary"
          onPress={c.backToDetail}
          disabled={c.busy}
        />
      </View>
      {onConfirm ? (
        <View style={{ flex: 2 }}>
          <Button
            label={confirmLabel}
            loading={c.busy}
            disabled={disabled}
            onPress={onConfirm}
          />
        </View>
      ) : null}
    </View>
  );
}
