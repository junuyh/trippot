// ============================================================================
// FUND-01 여행자금 / 입출금 관리  ·  /trips/:tripId/funds
//
// 여행자금을 **관리하는** 자리다. 목록만 보는 자리가 아니다. (IA v2 §2-4)
//   ① 현재 여행자금 — 누적 모금액 · 목표 · 앞으로 필요한 금액
//   ② 자금 추가 / 차감          ← 계좌를 연결하지 않은 사용자의 유일한 조정 수단
//   ③ 최근 입출금 10건 (카테고리 구분 없이 최신순)
//   ④ 입출금 전체 내역 → /funds/transactions
//   ⑤ 계좌 연결 / 전환 → FUND-02
//
// ⚠️ 누적 모금액과 현재 잔액을 혼용하지 않는다. (IA v2 §2-4-1)
//    결제로 줄어드는 것은 잔액이지 모은 금액이 아니다.
//
// ⚠️ 자금 추가·차감을 fund_sources.current_amount 직접 수정으로 처리하지 않는다.
//    거래로 남겨야 **언제 얼마를 모았는지**가 남는다. 그게 없으면
//    "하루 얼마씩 모으면 목표에 닿아요" 의 근거도, 결산·개인화에 쓸 데이터도
//    만들어지지 않는다.
//
// 데이터 조회·상태 관리·로그 기록만 한다. UI 는 components/fund/.
// ============================================================================
import { Ionicons } from "@expo/vector-icons";
import { format, parseISO } from "date-fns";
import {
  Stack,
  router,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";

import {
  FundSummaryCard,
  RecentFundList,
  type FundDraft,
} from "@/components/fund";
import { DateRangeCalendar } from "@/components/trip-create";
import {
  BottomSheet,
  Button,
  CurrencyInput,
  EmptyState,
  ErrorState,
  Input,
  Loading,
} from "@/components/ui";
import { SCREENS } from "@/lib/analytics/events";
import { countryTheme } from "@/lib/constants/countryTheme";
import { findDestinationByName } from "@/lib/constants/destinations";
import {
  FUND_SOURCE_TYPE,
  CATEGORY_CODE_LABEL,
  CATEGORY_METHOD,
  TRANSACTION_SOURCE_TYPE,
  TRANSACTION_TYPE,
  type CategoryCode,
  type RefundStatus,
  type TransactionType,
} from "@/lib/constants/status";
import { useScreenView } from "@/lib/hooks/useScreenView";
import {
  getBudgetByTripId,
  getBudgetCategories,
  type BudgetCategory,
  type TripBudget,
} from "@/lib/supabase/queries/budgets";
import { getTravelFund, type FundSource } from "@/lib/supabase/queries/funds";
import {
  createTransaction,
  getFundTotals,
  getTransactions,
  reviewReason,
  type Transaction,
} from "@/lib/supabase/queries/transactions";
import { getTripById, type Trip } from "@/lib/supabase/queries/trips";

/** 허브에 보여줄 최근 내역 건수. 전체는 /funds/transactions 가 담당한다 */
const RECENT_LIMIT = 10;

type FundData = {
  trip: Trip;
  budget: TripBudget | null;
  /** 지출 기록에서 고를 카테고리 목록 */
  categories: BudgetCategory[];
  fund: FundSource | null;
  transactions: Transaction[];
  depositTotal: number;
  withdrawalTotal: number;
};

export default function ScreenFUND01() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  useScreenView(SCREENS.TRANSACTION_LIST);

  const [data, setData] = useState<FundData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    if (!tripId) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setError(false);
    setNotFound(false);

    try {
      const trip = await getTripById(tripId);
      if (!trip) {
        setNotFound(true);
        return;
      }
      const budget = await getBudgetByTripId(trip.id);
      const [categories, fund, transactions, totals] = await Promise.all([
        budget ? getBudgetCategories(budget.id) : Promise.resolve([]),
        getTravelFund(trip.id),
        getTransactions(trip.id, { limit: RECENT_LIMIT }),
        getFundTotals(trip.id),
      ]);
      setData({
        trip,
        budget,
        categories,
        fund,
        transactions,
        depositTotal: totals.depositTotal,
        withdrawalTotal: totals.withdrawalTotal,
      });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tripId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // ── 자금 추가 / 차감 ──────────────────────────────────────────────────
  const [sheetType, setSheetType] = useState<TransactionType | null>(null);
  const [draft, setDraft] = useState<FundDraft>({ name: "", amount: null });
  /** 거래 날짜 'yyyy-MM-dd'. 오늘로 시작한다 */
  const [occurredOn, setOccurredOn] = useState(() =>
    format(new Date(), "yyyy-MM-dd"),
  );
  const [nameError, setNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /** 최근 입출금 필터. 전체 / 입금 / 지출 */
  const [listFilter, setListFilter] = useState<"ALL" | "IN" | "OUT">("ALL");

  /**
   * 지출 기록에서 고른 카테고리. null 이면 안 골랐다는 뜻이다. (시안 v1)
   *
   * ⚠️ 안 고르면 미분류로 남기고 '확인 필요' 로 잡는다. 임의로 하나 고르면
   *    그 카테고리의 실제 사용액이 사용자가 정하지도 않은 근거로 부풀려진다.
   */
  const [draftCategoryId, setDraftCategoryId] = useState<string | null>(null);

  const openSheet = useCallback((type: TransactionType) => {
    setDraft({ name: "", amount: null });
    setOccurredOn(format(new Date(), "yyyy-MM-dd"));
    setDraftCategoryId(null);
    setNameError(null);
    setSheetType(type);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!data || !sheetType || saving) return;
    const name = draft.name.trim();
    if (!name) {
      setNameError("내용을 입력해 주세요.");
      return;
    }
    if (!draft.amount || draft.amount <= 0) {
      setNameError(null);
      return;
    }

    setSaving(true);
    try {
      await createTransaction({
        trip_id: data.trip.id,
        // 직접 입력한 자금 이동이다. 계좌에서 불러온 거래가 아니다.
        source_type: TRANSACTION_SOURCE_TYPE.MANUAL,
        transaction_type: sheetType,
        // 사용자가 고른 날짜다. DB 는 UTC 로 저장하고 화면에서 KST 로 읽는다.
        occurred_at: parseISO(occurredOn).toISOString(),
        name,
        amount: draft.amount,
        /**
         * ⚠️ 입금에는 카테고리를 붙이지 않는다. 예산을 쓴 게 아니라
         *    자금이 들어온 것이다. 붙이면 그 예산의 실제 사용액이 부풀려진다.
         *
         * ⚠️ 지출인데 안 골랐으면 그대로 비워 둔다. 임의로 채우지 않는다.
         *    reviewReason() 이 '미분류' 로 잡아 확인 필요 목록에 올린다.
         */
        budget_category_id:
          sheetType === TRANSACTION_TYPE.WITHDRAWAL ? draftCategoryId : null,
        /**
         * 사용자가 직접 고른 분류다.
         * ⚠️ 안 골랐으면 NONE 이다. 이 칼럼은 not null default 'NONE' 이라
         *    null 을 넣을 수 없다. NONE 은 '아직 분류 안 함' 을 뜻한다.
         */
        category_method: draftCategoryId
          ? CATEGORY_METHOD.USER
          : CATEGORY_METHOD.NONE,
      });
      setSheetType(null);
      await load();
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }, [data, draft, load, saving, sheetType]);

  // ── 파생값 ────────────────────────────────────────────────────────────
  const visibleTransactions = useMemo(() => {
    const rows = data?.transactions ?? [];
    if (listFilter === "ALL") return rows;
    const wanted =
      listFilter === "IN"
        ? TRANSACTION_TYPE.DEPOSIT
        : TRANSACTION_TYPE.WITHDRAWAL;
    return rows.filter((row) => row.transaction_type === wanted);
  }, [data?.transactions, listFilter]);

  const theme = useMemo(
    () =>
      countryTheme(findDestinationByName(data?.trip.destination)?.countryKo),
    [data?.trip.destination],
  );

  if (loading) {
    return (
      <View className="flex-1 bg-white">
        <Stack.Screen options={{ title: "여행자금" }} />
        <Loading message="여행자금을 불러오는 중…" />
      </View>
    );
  }
  if (notFound) {
    return (
      <View className="flex-1 bg-white">
        <Stack.Screen options={{ title: "여행자금" }} />
        <EmptyState
          icon="wallet-outline"
          title="여행을 찾을 수 없어요"
          description="삭제되었거나 접근할 수 없는 여행이에요."
          actionLabel="홈으로"
          onAction={() => router.replace("/")}
        />
      </View>
    );
  }
  if (error || !data) {
    return (
      <View className="flex-1 bg-white">
        <Stack.Screen options={{ title: "여행자금" }} />
        <ErrorState
          message="여행자금을 불러오지 못했어요."
          onRetry={() => void load()}
        />
      </View>
    );
  }

  /**
   * 누적 모금액 = 등록 금액 + 입금 합계. (IA v2 §2-4-1)
   * 결제로 줄지 않는다. 잘못 넣은 입금을 지우면 그때 다시 계산된다.
   */
  const raisedAmount = (data.fund?.current_amount ?? 0) + data.depositTotal;
  /** 현재 잔액 = 누적 모금액 − 출금 합계 */
  const balance = Math.max(0, raisedAmount - data.withdrawalTotal);
  const targetAmount = data.budget?.target_amount ?? 0;
  const connected =
    data.fund?.source_type === FUND_SOURCE_TYPE.MOCK ||
    data.fund?.source_type === FUND_SOURCE_TYPE.ACCOUNT;

  const deposit = sheetType === TRANSACTION_TYPE.DEPOSIT;

  return (
    <View className="flex-1 bg-white">
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 40,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
          />
        }
      >
        <Stack.Screen options={{ title: "여행자금" }} />

        <FundSummaryCard
          theme={theme}
          raisedAmount={raisedAmount}
          balanceAmount={balance}
          targetAmount={targetAmount}
          spentAmount={data.withdrawalTotal}
          onRecordDeposit={() => openSheet(TRANSACTION_TYPE.DEPOSIT)}
          onRecordExpense={() => openSheet(TRANSACTION_TYPE.WITHDRAWAL)}
        />

        {/*
          ── 계좌 연결 / 전환 ──
          ⚠️ 계좌를 연결하지 않은 사용자에게는 **지금 무엇으로 관리 중인지**를
             먼저 말한다. 연결 버튼만 두면 직접 입력이 임시 상태처럼 읽히는데,
             직접 입력 사용자도 동일한 핵심 기능을 쓴다. (CLAUDE.md 3장)
        */}
        {connected ? null : (
          <View
            style={{
              marginTop: 12,
              padding: 13,
              borderRadius: 12,
              backgroundColor: theme.primarySoft,
            }}
          >
            <Text
              style={{ fontSize: 11, fontWeight: "800", color: theme.primary }}
            >
              지금은 직접 입력으로 관리 중이에요
            </Text>
            <Text
              style={{
                marginTop: 5,
                fontSize: 10,
                lineHeight: 16,
                color: "#687281",
              }}
            >
              입금과 지출을 직접 기록하고 있어요. 계좌를 연결하면 거래가
              자동으로 들어와요.
            </Text>
          </View>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={connected ? "연결 계좌 관리" : "계좌 연결하기"}
          onPress={() => router.push(`/trips/${data.trip.id}/funds/connect`)}
          className="active:bg-gray-50"
          style={{
            marginTop: 12,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            padding: 14,
            borderWidth: 1,
            borderColor: "#e8eaee",
            borderRadius: 14,
          }}
        >
          <Ionicons name="card-outline" size={18} color={theme.primary} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, fontWeight: "800", color: "#141b28" }}>
              {connected ? "연결 계좌 관리" : "계좌 연결하기"}
            </Text>
            <Text style={{ marginTop: 3, fontSize: 10, color: "#858e9c" }}>
              {connected
                ? "연결을 해제하면 직접 입력으로 돌아가요."
                : "연결하면 입출금이 자동으로 기록돼요."}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={15} color="#a8afb9" />
        </Pressable>

        {/* ── 최근 입출금 ── */}
        <View style={{ marginTop: 26 }}>
          <View
            className="flex-row items-end justify-between"
            style={{ marginHorizontal: 3, marginBottom: 11 }}
          >
            <Text style={{ fontSize: 17, fontWeight: "800", color: "#141b28" }}>
              최근 입출금
            </Text>
            <Text
              accessibilityRole="button"
              onPress={() =>
                router.push(`/trips/${data.trip.id}/funds/transactions`)
              }
              style={{ fontSize: 10, fontWeight: "600", color: theme.primary }}
            >
              입출금 전체 내역 ›
            </Text>
          </View>

          {/* 전체 / 입금 / 지출. 정렬이 아니라 종류를 고르는 축이다 */}
          <View className="flex-row" style={{ gap: 7, marginBottom: 11 }}>
            {(
              [
                { key: "ALL", label: "전체" },
                { key: "IN", label: "입금" },
                { key: "OUT", label: "지출" },
              ] as const
            ).map((chip) => {
              const active = listFilter === chip.key;
              return (
                <Pressable
                  key={chip.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setListFilter(chip.key)}
                  className="active:opacity-70"
                  style={{
                    paddingHorizontal: 13,
                    paddingVertical: 7,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: active ? theme.primary : "#e8eaee",
                    backgroundColor: active ? theme.primarySoft : "#fff",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: active ? "800" : "500",
                      color: active ? theme.primary : "#7c8695",
                    }}
                  >
                    {chip.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <RecentFundList
            theme={theme}
            transactions={visibleTransactions.map((transaction) => ({
              id: transaction.id,
              name: transaction.name,
              amount: transaction.amount,
              occurredAt: transaction.occurred_at,
              transactionType: transaction.transaction_type as TransactionType,
              refundStatus: transaction.refund_status as RefundStatus,
              // 카테고리 코드는 화면이 붙여 준다. 컴포넌트가 예산을 다시 읽지 않게
              categoryCode: transaction.budget_category_id
                ? ((data.categories.find(
                    (c) => c.id === transaction.budget_category_id,
                  )?.category_code as CategoryCode | undefined) ?? null)
                : null,
              needsReview: reviewReason(transaction) !== null,
            }))}
            onSelect={(transactionId) =>
              router.push(
                `/trips/${data.trip.id}/funds/transactions/${transactionId}`,
              )
            }
          />
        </View>
      </ScrollView>

      {/* ── 자금 추가 / 차감 ── */}
      <BottomSheet
        visible={sheetType !== null}
        title={deposit ? "입금 기록" : "지출 기록"}
        description={
          deposit
            ? "모은 금액을 기록해요. 누적 입금이 늘어나요."
            : "여행에서 쓴 금액이에요. 누적 입금은 줄지 않고 쓸 수 있는 자금만 줄어요."
        }
        onClose={() => setSheetType(null)}
        footer={
          <View className="flex-row gap-2">
            <View style={{ flex: 1 }}>
              <Button
                label="취소"
                variant="secondary"
                onPress={() => setSheetType(null)}
                disabled={saving}
              />
            </View>
            <View style={{ flex: 2 }}>
              <Button
                label="기록하기"
                loading={saving}
                onPress={() => void handleSubmit()}
              />
            </View>
          </View>
        }
      >
        <View style={{ gap: 13, paddingTop: 13 }}>
          <Input
            label="거래명"
            required
            value={draft.name}
            onChangeText={(name) => {
              setDraft({ ...draft, name });
              if (nameError) setNameError(null);
            }}
            placeholder={
              deposit ? "예: 9월 여행적금" : "예: 간사이 왕복 항공권"
            }
            error={nameError}
            maxLength={30}
          />
          <CurrencyInput
            label="금액"
            required
            value={draft.amount}
            onChangeValue={(amount) => setDraft({ ...draft, amount })}
          />

          {/*
            ── 예산 카테고리 ── 지출에만 낸다 (시안 v1)
            ⚠️ 필수가 아니다. 안 고르면 '확인 필요' 로 남기고 나중에 정하게 한다.
               지금 억지로 고르게 하면 아무거나 눌러 넘기고, 그 카테고리의
               실제 사용액이 틀린 채로 결산까지 간다.
          */}
          {!deposit && (data?.categories ?? []).length > 0 ? (
            <View style={{ gap: 7 }}>
              <Text
                style={{ fontSize: 12, fontWeight: "700", color: "#141b28" }}
              >
                예산 카테고리
              </Text>
              <View className="flex-row flex-wrap" style={{ gap: 7 }}>
                {(data?.categories ?? []).map((category) => {
                  const active = draftCategoryId === category.id;
                  return (
                    <Pressable
                      key={category.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      onPress={() =>
                        setDraftCategoryId(active ? null : category.id)
                      }
                      className="active:opacity-70"
                      style={{
                        paddingHorizontal: 11,
                        paddingVertical: 8,
                        borderRadius: 20,
                        borderWidth: 1,
                        borderColor: active ? theme.primary : "#e5e8ec",
                        backgroundColor: active ? theme.primarySoft : "#fff",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: active ? "800" : "400",
                          color: active ? theme.primary : "#687281",
                        }}
                      >
                        {
                          CATEGORY_CODE_LABEL[
                            category.category_code as CategoryCode
                          ]
                        }
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={{ fontSize: 10, color: "#a3a9b3" }}>
                지금 안 골라도 돼요. 나중에 거래 상세에서 정할 수 있어요.
              </Text>
            </View>
          ) : null}

          <View style={{ gap: 7 }}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#141b28" }}>
              날짜
            </Text>
            {/*
              ⚠️ 오늘로 고정하지 않는다. 어제 넣은 돈을 오늘 기록하는 일이
                 흔하고, 날짜가 틀리면 "하루 얼마씩 모으면 되는지" 도 틀어진다.
            */}
            <DateRangeCalendar
              mode="single"
              startDate={occurredOn}
              endDate={occurredOn}
              onChange={(next) => {
                if (next.startDate) setOccurredOn(next.startDate);
              }}
              // 이미 지나간 입금·지출을 기록한다. 과거를 막으면 안 된다.
              disablePast={false}
              showHint={false}
            />
          </View>

          <View
            style={{
              borderRadius: 11,
              backgroundColor: "#f5f6f8",
              padding: 11,
            }}
          >
            <Text style={{ fontSize: 10, lineHeight: 15, color: "#687281" }}>
              {format(parseISO(occurredOn), "M월 d일")} 자로 기록돼요.
              {"\n"}
              {deposit
                ? "잘못 넣었다면 입출금 전체 내역에서 지울 수 있어요."
                : "카테고리는 비어 있어요. 거래 상세에서 지정하면 그 카테고리의 실제 사용액에 반영돼요."}
            </Text>
          </View>
        </View>
      </BottomSheet>
    </View>
  );
}
