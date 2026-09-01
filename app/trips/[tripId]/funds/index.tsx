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
import { format } from "date-fns";
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
  TRANSACTION_SOURCE_TYPE,
  TRANSACTION_TYPE,
  type TransactionType,
} from "@/lib/constants/status";
import { useScreenView } from "@/lib/hooks/useScreenView";
import {
  getBudgetByTripId,
  type TripBudget,
} from "@/lib/supabase/queries/budgets";
import { getTravelFund, type FundSource } from "@/lib/supabase/queries/funds";
import {
  createTransaction,
  getFundTotals,
  getTransactions,
  type Transaction,
} from "@/lib/supabase/queries/transactions";
import { getTripById, type Trip } from "@/lib/supabase/queries/trips";

/** 허브에 보여줄 최근 내역 건수. 전체는 /funds/transactions 가 담당한다 */
const RECENT_LIMIT = 10;

type FundData = {
  trip: Trip;
  budget: TripBudget | null;
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
      const [budget, fund, transactions, totals] = await Promise.all([
        getBudgetByTripId(trip.id),
        getTravelFund(trip.id),
        getTransactions(trip.id, { limit: RECENT_LIMIT }),
        getFundTotals(trip.id),
      ]);
      setData({
        trip,
        budget,
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
  const [nameError, setNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const openSheet = useCallback((type: TransactionType) => {
    setDraft({ name: "", amount: null });
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
        occurred_at: new Date().toISOString(),
        name,
        amount: draft.amount,
        // ⚠️ 예산 카테고리에 붙이지 않는다.
        //    입금은 자금 유입이라 지출이 아니고, 자금 차감도 여행 지출이 아니다.
        //    카테고리를 붙이면 그 카테고리의 실제 사용액이 부풀려진다.
        budget_category_id: null,
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
          onAdd={() => openSheet(TRANSACTION_TYPE.DEPOSIT)}
          onSubtract={() => openSheet(TRANSACTION_TYPE.WITHDRAWAL)}
        />

        {/* ── 계좌 연결 / 전환 ── */}
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

          <RecentFundList
            theme={theme}
            transactions={data.transactions.map((transaction) => ({
              id: transaction.id,
              name: transaction.name,
              amount: transaction.amount,
              deposit:
                transaction.transaction_type === TRANSACTION_TYPE.DEPOSIT,
              occurredAt: transaction.occurred_at,
            }))}
            onSelect={(transactionId) =>
              router.push(
                `/trips/${data.trip.id}/funds/transactions?transactionId=${transactionId}`,
              )
            }
          />
        </View>
      </ScrollView>

      {/* ── 자금 추가 / 차감 ── */}
      <BottomSheet
        visible={sheetType !== null}
        title={deposit ? "여행자금 추가" : "여행자금 차감"}
        description={
          deposit
            ? "모은 금액을 기록해요. 오늘 날짜로 입금 내역이 남아요."
            : "여행자금에서 뺀 금액이에요. 모은 금액은 줄지 않고 잔액만 줄어요."
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
                label={deposit ? "추가" : "차감"}
                loading={saving}
                onPress={() => void handleSubmit()}
              />
            </View>
          </View>
        }
      >
        <View style={{ gap: 13, paddingTop: 13 }}>
          <Input
            label="내용"
            required
            value={draft.name}
            onChangeText={(name) => {
              setDraft({ ...draft, name });
              if (nameError) setNameError(null);
            }}
            placeholder={deposit ? "예: 9월 적금" : "예: 여행자금에서 인출"}
            error={nameError}
            maxLength={30}
          />
          <CurrencyInput
            label="금액"
            required
            value={draft.amount}
            onChangeValue={(amount) => setDraft({ ...draft, amount })}
          />
          <View
            style={{
              borderRadius: 11,
              backgroundColor: "#f5f6f8",
              padding: 11,
            }}
          >
            <Text style={{ fontSize: 10, lineHeight: 15, color: "#687281" }}>
              {format(new Date(), "M월 d일")} 자로 기록돼요.
              {"\n"}
              {deposit
                ? "잘못 넣었다면 입출금 전체 내역에서 지울 수 있어요."
                : "여행 지출이 아니라 자금 이동이에요. 예산 사용액에는 넣지 않아요."}
            </Text>
          </View>
        </View>
      </BottomSheet>
    </View>
  );
}
