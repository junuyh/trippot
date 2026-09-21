// ============================================================================
// FUND-02 계좌 연결 / 전환  ·  /trips/:tripId/funds/connect
//
// 수기 → 계좌 전환. (CLAUDE.md 3장)
//
//   초기화 안내 → 사용자 확인 → 기존 수기 금액 제외 → 계좌 잔액으로 대체
//
// ⚠️ **직접입력 금액과 연결계좌 잔액을 절대 합산하지 않는다.**
//    현재 여행자금은 항상 단일 소스(계좌 또는 수기) 기준이다.
//
// ⚠️ 되돌릴 수 없는 동작이라 확인을 받는다. 그리고 **무엇이 사라지는지**를
//    금액으로 보여준다. '초기화됩니다' 같은 말만 던지면 사용자는 무엇을
//    잃는지 모른 채 결정하게 된다.
//
// ⚠️ MVP 금융 데이터는 전부 Supabase Mock 이다. 실제 금융기관 API 를
//    호출하지 않는다. (CLAUDE.md 1장/11장)
//
// TODO: 이 화면은 lib/analytics/events.ts 의 SCREENS 에 값이 없어
//       useScreenView 를 부르지 않는다. docs/06 §7-0 참조.
//       docs/06 을 v3 로 갱신한 뒤 추가한다. 임의로 만들지 않는다.
// ============================================================================
import { Ionicons } from "@expo/vector-icons";
import {
  Stack,
  router,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { TripHomeButton } from "@/components/navigation/TripHomeButton";
import { ConfirmModal } from "@/components/mypage";
import { isTripEnded } from "@/lib/trip/tripStatus";
import {
  BottomSheet,
  Button,
  EmptyState,
  ErrorState,
  Loading, HeaderBackButton } from "@/components/ui";
import { EVENTS } from "@/lib/analytics/events";
import { track } from "@/lib/analytics/track";
import { institutionName } from "@/lib/constants/bank";
import { countryTheme } from "@/lib/constants/countryTheme";
import { findDestinationByName } from "@/lib/constants/destinations";
import { FUND_SOURCE_TYPE } from "@/lib/constants/status";
import {
  MOCK_BANK,
  connectMockAccount,
  convertToAccount,
  disconnectAccount,
  getGroupAccounts,
  getPreviouslyLinkedAccount,
  getTravelFund,
  type FinancialAccount,
  type FundSource,
  type PreviouslyLinkedAccount,
} from "@/lib/supabase/queries/funds";
import { getFundTotals } from "@/lib/supabase/queries/transactions";
import { getTripById, type Trip } from "@/lib/supabase/queries/trips";
import { useTripContext } from '@/lib/hooks/useTripContext';

type ConnectData = {
  trip: Trip;
  fund: FundSource | null;
  accounts: FinancialAccount[];
  /**
   * 같은 모임의 지난 여행이 연결했던 계좌. 없으면 null.
   * 연결 전 화면에서 "같은 계좌로 연결할까요?" 안내에 쓴다.
   */
  previous: PreviouslyLinkedAccount | null;
  /** 지금까지 수기로 넣은 입금 합계. 전환하면 사라진다 */
  depositTotal: number;
};

function won(value: number): string {
  return `${value.toLocaleString("ko-KR")}원`;
}

export default function ScreenFUND02() {
  const { tripId, fromGroupId } = useLocalSearchParams<{
    tripId: string;
    /** 모임 상세에서 들어온 경우에만 있다. 아래 backHref 주석 참고. */
    fromGroupId?: string;
  }>();

  /**
   * 뒤로가기 동작.
   *
   * ⚠️ 두 진입 경로의 성질이 다르다.
   *
   *   여행 자금에서 들어옴  parentHref → dismissTo. 어떤 경로로 왔든 그 여행의
   *                        자금 화면으로 간다. 지금까지와 똑같다.
   *
   *   모임 상세에서 들어옴  parentHref 를 **주지 않는다.** 그러면
   *                        HeaderBackButton 이 router.back() 으로 스택을 한 칸
   *                        되돌린다. 모임 상세에서 push 로 들어왔으므로 그
   *                        화면이 바로 아래에 그대로 있다. dismissTo 로 경로를
   *                        새로 지정하면 같은 화면을 다시 세우게 되어 전환이
   *                        덜컹거린다. (2026-09-09)
   *                        돌아갈 히스토리가 없는 경우(딥링크 등)만
   *                        fallbackHref 로 그 모임에 내려놓는다.
   *
   * ⚠️ 값을 그대로 경로에 끼우지 않는다. 문자열이고 비어 있지 않을 때만 쓴다.
   *    바깥 URL 로 나갈 수 있는 자유 입력은 받지 않는다.
   */
  const fromGroup =
    typeof fromGroupId === 'string' && fromGroupId !== '' ? fromGroupId : null;

  const backProps = fromGroup
    ? { fallbackHref: `/groups/${fromGroup}` }
    : { parentHref: `/trips/${tripId}/funds` };
  // 이 화면의 모든 이벤트에 trip_id 를 붙인다. (docs/06 v4 §5)
  useTripContext(tripId);

  const [data, setData] = useState<ConnectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    if (!tripId) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setError(false);
    try {
      const trip = await getTripById(tripId);
      if (!trip) {
        setNotFound(true);
        return;
      }
      const [fund, accounts, previous, totals] = await Promise.all([
        getTravelFund(trip.id),
        // 계좌는 모임 자산이다. 개인 여행에는 붙을 계좌가 없다.
        trip.group_id ? getGroupAccounts(trip.group_id) : Promise.resolve([]),
        // 지난 여행이 붙였던 계좌. 못 읽어도 화면은 떠야 한다.
        trip.group_id
          ? getPreviouslyLinkedAccount(trip.group_id, trip.id).catch(() => null)
          : Promise.resolve(null),
        getFundTotals(trip.id),
      ]);
      setData({ trip, fund, accounts, previous, depositTotal: totals.depositTotal });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // ── 전환 ──────────────────────────────────────────────────────────────
  /** 초기화 안내를 띄운 계좌. null 이면 안내를 닫은 상태 */
  const [pending, setPending] = useState<FinancialAccount | null>(null);
  const [busy, setBusy] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  /*
    연결 해제 확인 모달. (NFR-003 · 2026-09-21)
    되돌릴 수 없는 동작인데 버튼 한 번에 바로 풀렸다. 결산 확정·전환·나가기처럼
    한 번 묻고, 무엇이 남고 무엇이 바뀌는지를 적는다.
  */
  const [disconnectConfirmOpen, setDisconnectConfirmOpen] = useState(false);
  /** 은행 고르기 시트 */
  const [bankOpen, setBankOpen] = useState(false);
  const [linking, setLinking] = useState(false);

  const manualAmount =
    (data?.fund?.current_amount ?? 0) + (data?.depositTotal ?? 0);

  /** 계좌를 골라 초기화 안내를 연다 */
  const handleSelect = useCallback(
    (account: FinancialAccount) => {
      setPending(account);
      track(EVENTS.FUND_CONVERSION_STARTED, {
        current_manual_amount: manualAmount,
      });
    },
    [manualAmount],
  );

  /**
   * 안내를 닫는다. **거절도 기록한다.**
   * 초기화 안내에서 이탈률이 높으면 문구가 사용자를 겁준 것이다. (docs/06 §7-4)
   */
  const handleDismiss = useCallback(() => {
    setPending(null);
    track(EVENTS.FUND_CONVERSION_CONFIRMED, { agreed: false });
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!data || !pending || busy) return;
    setBusy(true);
    track(EVENTS.FUND_CONVERSION_CONFIRMED, { agreed: true });

    try {
      await convertToAccount(data.trip.id, pending.id);
      track(EVENTS.FUND_CONVERSION_COMPLETED, { result: "success" });
      setPending(null);
      // 자금 화면으로 돌려보낸다. 바뀐 금액을 바로 확인하게 한다.
      // ⚠️ replace 가 아니라 dismissTo 다. 자금 화면은 이미 스택 아래에 있다.
      //    replace 로 하나 더 얹으면 자금 화면이 두 벌이 되어, 거기서 뒤로가기를
      //    누르면 같은 자금 화면이 또 나온다. (2026-09-09)
      router.dismissTo(`/trips/${data.trip.id}/funds` as never);
    } catch {
      track(EVENTS.FUND_CONVERSION_COMPLETED, { result: "fail" });
      setError(true);
    } finally {
      setBusy(false);
    }
  }, [busy, data, pending]);

  /**
   * 새 계좌를 연결한다. (시연용 Mock)
   *
   * ⚠️ 실제 오픈뱅킹 인증이 아니다. 은행을 고르면 준비된 계좌가 조회된 것처럼
   *    나오고, 누르면 연결과 동시에 그 계좌의 결제 1건이 따라 들어온다.
   */
  const handleConnectBank = useCallback(async () => {
    if (!data || linking) return;
    setLinking(true);
    track(EVENTS.FUND_CONVERSION_CONFIRMED, { agreed: true });
    try {
      await connectMockAccount(data.trip.id, data.trip.group_id);
      track(EVENTS.FUND_CONVERSION_COMPLETED, { result: "success" });
      setBankOpen(false);
      router.dismissTo(`/trips/${data.trip.id}/funds` as never);
    } catch {
      track(EVENTS.FUND_CONVERSION_COMPLETED, { result: "fail" });
      setError(true);
    } finally {
      setLinking(false);
    }
  }, [data, linking]);

  const handleDisconnect = useCallback(async () => {
    if (!data || disconnecting) return;
    setDisconnecting(true);
    try {
      await disconnectAccount(data.trip.id);
      setDisconnectConfirmOpen(false);
      router.dismissTo(`/trips/${data.trip.id}/funds` as never);
    } catch {
      setDisconnectConfirmOpen(false);
      setError(true);
    } finally {
      setDisconnecting(false);
    }
  }, [data, disconnecting]);

  const theme = useMemo(
    () =>
      countryTheme(findDestinationByName(data?.trip.destination)?.countryKo),
    [data?.trip.destination],
  );

  // ── 4상태 ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View className="flex-1 bg-white">
        <Stack.Screen options={{
          headerLeft: () => (
            <HeaderBackButton {...backProps} />
          ),
          headerRight: () => <TripHomeButton tripId={tripId as string} ended={isTripEnded(data?.trip.status)} />, title: "계좌 연결" }} />
        <Loading message="계좌 정보를 불러오는 중…" />
      </View>
    );
  }
  if (notFound) {
    return (
      <View className="flex-1 bg-white">
        <Stack.Screen options={{
          headerLeft: () => (
            <HeaderBackButton {...backProps} />
          ),
          headerRight: () => <TripHomeButton tripId={tripId as string} ended={isTripEnded(data?.trip.status)} />, title: "계좌 연결" }} />
        <EmptyState
          icon="card-outline"
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
        <Stack.Screen options={{
          headerLeft: () => (
            <HeaderBackButton {...backProps} />
          ),
          headerRight: () => <TripHomeButton tripId={tripId as string} ended={isTripEnded(data?.trip.status)} />, title: "계좌 연결" }} />
        <ErrorState
          message="계좌 정보를 불러오지 못했어요."
          onRetry={() => void load()}
        />
      </View>
    );
  }

  const connected =
    data.fund?.source_type === FUND_SOURCE_TYPE.ACCOUNT ||
    data.fund?.source_type === FUND_SOURCE_TYPE.MOCK;
  const linked =
    data.accounts.find((a) => a.id === data.fund?.financial_account_id) ?? null;

  return (
    <View className="flex-1 bg-white">
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 18,
          paddingBottom: 40,
        }}
      >
        <Stack.Screen
          options={{
          headerLeft: () => (
            <HeaderBackButton {...backProps} />
          ),
          headerRight: () => <TripHomeButton tripId={tripId as string} ended={isTripEnded(data?.trip.status)} />, title: connected ? "연결 계좌 관리" : "계좌 연결" }}
        />

        {/* ── 지금 방식 ── */}
        <View
          style={{
            borderWidth: 1,
            borderColor: "#e8eaee",
            borderRadius: 16,
            padding: 16,
            gap: 4,
          }}
        >
          <Text style={{ fontSize: 10, color: "#858e9c" }}>
            지금 여행자금 관리 방식
          </Text>
          <Text style={{ fontSize: 17, fontWeight: "800", color: "#141b28" }}>
            {connected ? "연결 계좌 기준" : "직접 입력 기준"}
          </Text>
          <Text
            style={{
              marginTop: 2,
              fontSize: 12,
              fontWeight: "700",
              color: theme.primary,
            }}
          >
            {won(manualAmount)}
          </Text>
          <Text
            style={{
              marginTop: 6,
              fontSize: 11,
              lineHeight: 17,
              color: "#7c8695",
            }}
          >
            {connected
              ? `${linked?.masked_account_number ?? "연결된 계좌"} 의 잔액을 그대로 씁니다.`
              : "직접 넣은 금액으로 관리하고 있어요. 계좌를 연결하면 잔액이 자동으로 반영돼요."}
          </Text>
        </View>

        {/*
          ── 연결 전 ──
          ⚠️ 모임 계좌 목록을 늘어놓지 않는다. 아직 이 여행에 붙지 않은 계좌가
             "연결할 계좌" 아래 잔액과 함께 서 있으면 이미 연결된 것으로 읽힌다.
             (2026-09-09 · 사용자도 착각했다)
             지난 여행이 붙였던 계좌가 있으면 그것 하나만 "같은 계좌로 연결할까요?"
             로 권하고, 없으면 연결 버튼만 둔다.
        */}
        {!connected && data.previous ? (
          <View
            style={{
              marginTop: 22,
              borderWidth: 1,
              borderColor: "#e8eaee",
              borderRadius: 16,
              padding: 16,
              gap: 12,
            }}
          >
            <View>
              <Text style={{ fontSize: 9, fontWeight: "900", letterSpacing: 1.2, color: "#a8afb9" }}>
                LAST TRIP ACCOUNT
              </Text>
              <Text style={{ marginTop: 6, fontSize: 15, fontWeight: "800", color: "#141b28" }}>
                지난 여행에서 연결한 계좌가 있어요
              </Text>
              <Text style={{ marginTop: 4, fontSize: 12, lineHeight: 18, color: "#7c8695" }}>
                {data.previous.tripDestination
                  ? `${data.previous.tripDestination} 여행에서 썼던 계좌예요. `
                  : ""}
                같은 계좌로 연결할까요?
              </Text>
            </View>

            <View
              className="flex-row items-center"
              style={{
                gap: 12,
                padding: 13,
                borderRadius: 12,
                backgroundColor: "#f5f6f8",
              }}
            >
              <Ionicons name="card-outline" size={20} color="#5d6674" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: "800", color: "#141b28" }}>
                  {institutionName(data.previous.account.institution_code)}
                </Text>
                {/* 마스킹된 번호만 다룬다 (NFR-002) */}
                <Text style={{ marginTop: 3, fontSize: 11, color: "#858e9c" }}>
                  {data.previous.account.masked_account_number}
                </Text>
              </View>
            </View>

            <Button
              label="같은 계좌로 연결하기"
              onPress={() => handleSelect(data.previous!.account)}
            />
          </View>
        ) : null}

        {/* ── 연결 후: 지금 붙어 있는 계좌 하나만 ── */}
        {connected ? (
          <>
            <Text style={{ marginTop: 26, fontSize: 17, fontWeight: "800", color: "#141b28" }}>
              연결된 계좌
            </Text>
            {linked ? (
              <View
                style={{
                  marginTop: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  padding: 15,
                  borderWidth: 1,
                  borderColor: theme.primary,
                  backgroundColor: theme.primarySoft,
                  borderRadius: 14,
                }}
              >
                <Ionicons name="card-outline" size={20} color={theme.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: "800", color: "#141b28" }}>
                    {institutionName(linked.institution_code)}
                  </Text>
                  <Text style={{ marginTop: 3, fontSize: 11, color: "#858e9c" }}>
                    {linked.masked_account_number}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ fontSize: 13, fontWeight: "800", color: "#141b28" }}>
                    {won(linked.current_balance)}
                  </Text>
                  <Text style={{ marginTop: 3, fontSize: 10, fontWeight: "800", color: theme.primary }}>
                    연결됨
                  </Text>
                </View>
              </View>
            ) : (
              <View style={{ marginTop: 12, borderRadius: 14, backgroundColor: "#f5f6f8", padding: 16 }}>
                <Text style={{ fontSize: 12, lineHeight: 18, color: "#5d6674" }}>
                  연결된 계좌 정보를 찾지 못했어요. 연결을 해제하고 다시 붙여 주세요.
                </Text>
              </View>
            )}
          </>
        ) : null}

        {/*
          ── 새 계좌 연결 ──
          ⚠️ 개인 여행에도 열어 둔다. 계좌는 모임 자산이라는 원칙은 그대로지만,
             연결 자체를 여기서 시작할 수 있어야 사용자가 모임 화면까지
             찾아가지 않는다. (시연 범위)
        */}
        {!connected ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={data.previous ? "다른 계좌 연결하기" : "계좌 연결하기"}
            onPress={() => setBankOpen(true)}
            className="flex-row items-center active:bg-gray-50"
            style={{
              gap: 12,
              marginTop: data.previous ? 12 : 22,
              padding: 15,
              borderWidth: 1,
              borderStyle: "dashed",
              borderColor: "#c8ced6",
              borderRadius: 14,
            }}
          >
            <Ionicons name="add-circle-outline" size={20} color={theme.primary} />
            <View style={{ flex: 1 }}>
              <Text
                style={{ fontSize: 13, fontWeight: "800", color: "#141b28" }}
              >
                {data.previous ? "다른 계좌 연결하기" : "계좌 연결하기"}
              </Text>
              <Text style={{ marginTop: 3, fontSize: 11, color: "#858e9c" }}>
                연결하면 이미 결제된 내역도 함께 들어와요
              </Text>
            </View>
            <Text style={{ fontSize: 15, color: "#c2c8d0" }}>›</Text>
          </Pressable>
        ) : null}

        {connected ? (
          <View style={{ marginTop: 22, gap: 10 }}>
            <Text style={{ fontSize: 11, lineHeight: 17, color: "#858e9c" }}>
              연결을 해제하면 지금 잔액을 그대로 이어받아 직접 입력으로
              돌아가요. 모은 금액이 사라지지 않아요.
            </Text>
            <Button
              label="연결 해제"
              variant="secondary"
              loading={disconnecting}
              onPress={() => setDisconnectConfirmOpen(true)}
            />
          </View>
        ) : null}

        <Text
          style={{
            marginTop: 24,
            fontSize: 10,
            lineHeight: 16,
            color: "#a8afb9",
          }}
        >
          지금은 준비된 예시 계좌로 동작해요. 실제 금융기관 연결은 이후에
          붙습니다.
        </Text>
      </ScrollView>

      {/*
        ── 은행 고르기 ── (시연용 Mock)
        ⚠️ 실제 기관 인증이 아니다. 은행을 고르면 준비된 계좌가 조회된 것처럼
           나오고, 누르면 연결된다. 실서비스에서는 이 자리가 기관 인증 화면이다.
      */}
      <BottomSheet
        visible={bankOpen}
        title="계좌 연결"
        description="연결할 은행을 고르면 계좌를 찾아드려요."
        onClose={() => setBankOpen(false)}
      >
        <View style={{ paddingTop: 14, gap: 10 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${institutionName(MOCK_BANK.institutionCode)} ${MOCK_BANK.accountName} 연결하기`}
            disabled={linking}
            onPress={() => void handleConnectBank()}
            className="flex-row items-center active:bg-gray-50"
            style={{
              gap: 12,
              padding: 15,
              borderWidth: 1,
              borderColor: "#e8eaee",
              borderRadius: 14,
              opacity: linking ? 0.6 : 1,
            }}
          >
            <View
              className="items-center justify-center"
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: "#e8f3ff",
              }}
            >
              <Ionicons name="wallet-outline" size={19} color="#1868d6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{ fontSize: 13, fontWeight: "800", color: "#141b28" }}
              >
                {institutionName(MOCK_BANK.institutionCode)}
              </Text>
              <Text style={{ marginTop: 3, fontSize: 11, color: "#5d6674" }}>
                {MOCK_BANK.accountName}
              </Text>
              <Text style={{ marginTop: 2, fontSize: 10, color: "#a8afb9" }}>
                {MOCK_BANK.maskedAccountNumber}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text
                style={{ fontSize: 14, fontWeight: "900", color: "#141b28" }}
              >
                {won(MOCK_BANK.balance)}
              </Text>
              <Text
                style={{
                  marginTop: 3,
                  fontSize: 10,
                  fontWeight: "800",
                  color: theme.primary,
                }}
              >
                {linking ? "연결하는 중…" : "연결하기"}
              </Text>
            </View>
          </Pressable>

          <View
            style={{
              borderRadius: 12,
              backgroundColor: "#f5f6f8",
              padding: 13,
            }}
          >
            <Text style={{ fontSize: 11, lineHeight: 17, color: "#5d6674" }}>
              연결하면 이 계좌의 결제 내역이 여행 지출로 들어와요. 카테고리는
              자동으로 분류하고, 확신이 낮은 건 확인을 요청해요.
            </Text>
          </View>
        </View>
      </BottomSheet>

      {/*
        ── 초기화 안내 ── (CLAUDE.md 3장)
        되돌릴 수 없으므로 **무엇이 사라지는지 금액으로** 보여주고 확인을 받는다.
      */}
      <BottomSheet
        visible={pending !== null}
        title="직접 입력한 금액은 사라져요"
        description="계좌를 연결하면 여행자금을 계좌 잔액 하나로만 관리해요. 두 금액을 합치지 않아요."
        onClose={handleDismiss}
        footer={
          <View className="flex-row gap-2">
            <View style={{ flex: 1 }}>
              <Button
                label="그만두기"
                variant="secondary"
                onPress={handleDismiss}
                disabled={busy}
              />
            </View>
            <View style={{ flex: 2 }}>
              <Button
                label="연결하고 대체하기"
                loading={busy}
                onPress={() => void handleConfirm()}
              />
            </View>
          </View>
        }
      >
        {pending ? (
          <View style={{ paddingTop: 14, gap: 11 }}>
            <View
              className="flex-row items-center justify-between"
              style={{
                padding: 14,
                borderRadius: 12,
                backgroundColor: "#f5f6f8",
              }}
            >
              <Text style={{ fontSize: 12, color: "#5d6674" }}>
                지금 직접 입력한 금액
              </Text>
              <Text
                style={{ fontSize: 14, fontWeight: "800", color: "#98a0ab" }}
              >
                {won(manualAmount)}
              </Text>
            </View>

            <View className="items-center">
              <Ionicons name="arrow-down" size={16} color="#a8afb9" />
            </View>

            <View
              className="flex-row items-center justify-between"
              style={{
                padding: 14,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: theme.primary,
                backgroundColor: theme.primarySoft,
              }}
            >
              <Text style={{ fontSize: 12, color: "#5d6674" }}>
                {institutionName(pending.institution_code)} 잔액
              </Text>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "900",
                  color: theme.primary,
                }}
              >
                {won(pending.current_balance)}
              </Text>
            </View>

            <Text style={{ fontSize: 11, lineHeight: 17, color: "#7c8695" }}>
              직접 넣어 둔 입금 기록도 함께 정리돼요. 실제로 쓴 지출 내역은
              그대로 남아 예산과 결산에 계속 반영됩니다.
            </Text>
          </View>
        ) : null}
      </BottomSheet>

      {/* 연결 해제 확인. 잔액은 직접 입력으로 이어받는다는 것을 함께 적는다. */}
      <ConfirmModal
        visible={disconnectConfirmOpen}
        title="계좌 연결을 해제할까요?"
        description="지금 잔액은 직접 입력 금액으로 그대로 이어받아요. 해제한 뒤에는 계좌 거래가 더 이상 들어오지 않아요."
        confirmLabel="연결 해제"
        destructive
        busy={disconnecting}
        onCancel={() => setDisconnectConfirmOpen(false)}
        onConfirm={() => void handleDisconnect()}
      />
    </View>
  );
}
