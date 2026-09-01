// ============================================================================
// FUND-01 여행자금 내역  ·  /trips/:tripId/funds
//
// 계좌 내역처럼 거래를 **날짜별로 묶어** 보여준다.
//   ?categoryId=... 로 들어오면 그 카테고리 지출만 (BUDGET-02 '전체 내역 보기')
//   없으면 이 여행의 전체 입출금
//
// ⚠️ 입금과 출금을 한 목록에 두되 부호로 구분한다.
//    **출금만 예산 실제 사용액에 합산된다.** 입금은 자금 유입이다. (ERD §3)
//
// ⚠️ 거래명은 화면에 보여주되 이벤트 파라미터로 보내지 않는다. (NFR-007)
//
// 거래 상세(FUND-03)는 아직 고도화 단계라 항목을 눌러도 이동하지 않는다.
// (docs/README.md §5 #19)
// ============================================================================
import { format, isSameDay, parseISO } from 'date-fns';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Alert, Modal, Pressable, SectionList, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import type { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import { EmptyState, ErrorState, Loading } from '@/components/ui';
import { SCREENS } from '@/lib/analytics/events';
import { countryTheme } from '@/lib/constants/countryTheme';
import { findDestinationByName } from '@/lib/constants/destinations';
import {
  CATEGORY_CODE_LABEL,
  CATEGORY_METHOD,
  TRANSACTION_TYPE,
  type CategoryCode,
} from '@/lib/constants/status';
import { EVENTS } from '@/lib/analytics/events';
import { track } from '@/lib/analytics/track';
import { CATEGORY_CODE_TO_ANALYTICS, MAPPED_BY } from '@/lib/constants/status';
import { useScreenView } from '@/lib/hooks/useScreenView';
import {
  getBudgetByTripId,
  getBudgetCategories,
  type BudgetCategory,
} from '@/lib/supabase/queries/budgets';
import {
  deleteTransaction,
  getTransactions,
  updateTransactionMapping,
  type Transaction,
} from '@/lib/supabase/queries/transactions';
import { getGroupAccounts } from '@/lib/supabase/queries/funds';
import { getTripById, type Trip } from '@/lib/supabase/queries/trips';

type FundsData = {
  trip: Trip;
  categories: BudgetCategory[];
  transactions: Transaction[];
  /** 마스킹된 계좌번호. 연결 계좌가 없으면 null (NFR-002) */
  maskedAccountNumber: string | null;
};

export default function ScreenFUND01() {
  const { tripId, categoryId } = useLocalSearchParams<{ tripId: string; categoryId?: string }>();

  const [data, setData] = useState<FundsData | null>(null);
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
    setNotFound(false);

    try {
      const trip = await getTripById(tripId);
      if (!trip) {
        setNotFound(true);
        return;
      }
      const budget = await getBudgetByTripId(trip.id);
      const [categories, transactions, accounts] = await Promise.all([
        budget ? getBudgetCategories(budget.id) : Promise.resolve([]),
        getTransactions(trip.id, categoryId ? { categoryId } : undefined),
        trip.group_id ? getGroupAccounts(trip.group_id) : Promise.resolve([]),
      ]);
      setData({
        trip,
        categories,
        transactions,
        maskedAccountNumber: accounts[0]?.masked_account_number ?? null,
      });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [categoryId, tripId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useScreenView(SCREENS.TRANSACTION_LIST);

  // ── 카테고리 변경 ─────────────────────────────────────────────────────
  /** 편집 중인 거래. null 이면 시트를 닫는다 */
  const [editing, setEditing] = useState<Transaction | null>(null);

  /**
   * 행별 Swipeable 참조.
   *
   * 수정·삭제를 누른 뒤 열린 행을 직접 닫는다. 닫지 않으면 시트를 저장하고
   * 돌아와도 '수정 / 삭제' 버튼이 그대로 남아, 사용자가 오른쪽으로 다시
   * 밀어야 원래 화면이 된다. 방금 끝낸 동작의 흔적이 남는 셈이다.
   */
  const swipeRefs = useRef(new Map<string, SwipeableMethods | null>());

  const closeSwipe = useCallback((transactionId: string) => {
    swipeRefs.current.get(transactionId)?.close();
  }, []);
  const [busy, setBusy] = useState(false);

  const handleChangeCategory = useCallback(
    async (nextCategoryId: string) => {
      if (!editing || !data || busy) return;
      setBusy(true);
      try {
        await updateTransactionMapping(editing.id, {
          categoryId: nextCategoryId,
          // 사용자가 직접 고친 분류다. 자동분류 정확도를 재는 기준이 된다
          categoryMethod: CATEGORY_METHOD.USER,
        });

        const nextCode = data.categories.find((c) => c.id === nextCategoryId)?.category_code;
        if (nextCode) {
          // 자동분류가 틀려서 사용자가 고쳤다는 신호다. (docs/06 §7-3)
          track(EVENTS.TRANSACTION_CATEGORY_CORRECTED, {
            trip_id: data.trip.id,
            category: CATEGORY_CODE_TO_ANALYTICS[nextCode as CategoryCode],
            mapped_by: MAPPED_BY.USER,
          });
        }

        setEditing(null);
        await load();
      } catch {
        setError(true);
      } finally {
        setBusy(false);
      }
    },
    [busy, data, editing, load],
  );

  // 삭제는 되돌릴 수 없다. 먼저 확인한다. (NFR-003)
  const handleDelete = useCallback(
    (transaction: Transaction) => {
      Alert.alert(
        '이 거래를 삭제할까요?',
        `${transaction.name ?? '이름 없는 거래'} · ${transaction.amount.toLocaleString('ko-KR')}원`,
        [
          { text: '취소', style: 'cancel' },
          {
            text: '삭제',
            style: 'destructive',
            onPress: () => {
              void deleteTransaction(transaction.id)
                .then(() => load())
                .catch(() => setError(true));
            },
          },
        ],
      );
    },
    [load],
  );

  const theme = useMemo(
    () => countryTheme(findDestinationByName(data?.trip.destination)?.countryKo),
    [data?.trip.destination],
  );

  const categoryLabel = useMemo(() => {
    if (!categoryId || !data) return null;
    const found = data.categories.find((category) => category.id === categoryId);
    return found ? CATEGORY_CODE_LABEL[found.category_code as CategoryCode] : null;
  }, [categoryId, data]);

  // 날짜별로 묶는다. 거래는 이미 occurred_at 내림차순으로 온다.
  const sections = useMemo(() => {
    const byCategory = new Map((data?.categories ?? []).map((c) => [c.id, c.category_code]));
    const groups: { title: string; total: number; data: Transaction[] }[] = [];

    for (const transaction of data?.transactions ?? []) {
      const when = parseISO(transaction.occurred_at);
      const last = groups[groups.length - 1];
      if (last && isSameDay(parseISO(last.data[0].occurred_at), when)) {
        last.data.push(transaction);
      } else {
        groups.push({ title: format(when, 'M월 d일'), total: 0, data: [transaction] });
      }
    }

    // 날짜별 출금 합계. 입금은 자금 유입이라 지출 합계에 넣지 않는다.
    for (const group of groups) {
      group.total = group.data
        .filter((t) => t.transaction_type === TRANSACTION_TYPE.WITHDRAWAL)
        .reduce((sum, t) => sum + t.amount, 0);
    }

    return groups.map((group) => ({
      ...group,
      data: group.data.map((transaction) => ({
        transaction,
        categoryCode: transaction.budget_category_id
          ? ((byCategory.get(transaction.budget_category_id) as CategoryCode | undefined) ?? null)
          : null,
      })),
    }));
  }, [data?.categories, data?.transactions]);

  const title = categoryLabel ? `${categoryLabel} 지출` : '여행자금 내역';

  if (loading) {
    return (
      <View className="flex-1 bg-white">
        <Stack.Screen options={{ title }} />
        <Loading message="내역을 불러오는 중…" />
      </View>
    );
  }
  if (notFound) {
    return (
      <View className="flex-1 bg-white">
        <Stack.Screen options={{ title }} />
        <EmptyState
          icon="receipt-outline"
          title="여행을 찾을 수 없어요"
          actionLabel="홈으로"
          onAction={() => router.replace('/')}
        />
      </View>
    );
  }
  if (error || !data) {
    return (
      <View className="flex-1 bg-white">
        <Stack.Screen options={{ title }} />
        <ErrorState message="내역을 불러오지 못했어요." onRetry={() => void load()} />
      </View>
    );
  }

  if (sections.length === 0) {
    return (
      <View className="flex-1 bg-white">
        <Stack.Screen options={{ title }} />
        <EmptyState
          icon="receipt-outline"
          title="아직 거래 내역이 없어요"
          description="계좌를 연결하거나 지출을 직접 입력하면 여기에 쌓여요."
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen options={{ title }} />

      {/*
        연결 계좌 안내는 여기서만 보여준다.
        카테고리 화면(BUDGET-02)에서는 지출 자체에 집중하도록 숨겼다.
      */}
      {data.maskedAccountNumber ? (
        <View
          className="flex-row items-center gap-2.5"
          style={{ paddingHorizontal: 16, paddingVertical: 13, backgroundColor: '#f5f7fa' }}
        >
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              backgroundColor: '#fff',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="card-outline" size={16} color="#5d6674" />
          </View>
          <View className="flex-1">
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#121a2a' }}>
              연결 계좌 자동 분류
            </Text>
            <Text style={{ fontSize: 9, color: '#7d8797', marginTop: 3 }}>
              {data.maskedAccountNumber}
            </Text>
          </View>
          <View
            style={{ backgroundColor: '#e8f7f0', borderRadius: 20, paddingHorizontal: 7, paddingVertical: 5 }}
          >
            <Text style={{ fontSize: 8, fontWeight: '900', color: '#2d8a63' }}>연결됨</Text>
          </View>
        </View>
      ) : null}

      {/* 밀어서 수정·삭제 */}
      <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
        <Text style={{ fontSize: 10, color: '#a3a9b3' }}>
          왼쪽으로 밀면 카테고리를 바꾸거나 삭제할 수 있어요
        </Text>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.transaction.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <View
            className="flex-row items-center justify-between"
            style={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 }}
          >
            <Text style={{ fontSize: 12, fontWeight: '800', color: '#121a2a' }}>
              {section.title}
            </Text>
            {section.total > 0 ? (
              <Text style={{ fontSize: 11, color: '#8b94a2' }}>
                지출 {section.total.toLocaleString('ko-KR')}원
              </Text>
            ) : null}
          </View>
        )}
        renderItem={({ item }) => {
          const { transaction, categoryCode } = item;
          const deposit = transaction.transaction_type === TRANSACTION_TYPE.DEPOSIT;
          const auto = transaction.category_method === CATEGORY_METHOD.AUTO;

          return (
            <Swipeable
              ref={(node) => {
                // 화면에서 사라진 행의 참조는 지운다. 안 지우면 계속 쌓인다.
                if (node) swipeRefs.current.set(transaction.id, node);
                else swipeRefs.current.delete(transaction.id);
              }}
              overshootRight={false}
              renderRightActions={() => (
                <View className="flex-row">
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="카테고리 변경"
                    onPress={() => {
                      closeSwipe(transaction.id);
                      setEditing(transaction);
                    }}
                    style={{ width: 72, backgroundColor: '#4b5563' }}
                    className="items-center justify-center"
                  >
                    <Ionicons name="pricetag-outline" size={17} color="#fff" />
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800', marginTop: 3 }}>
                      수정
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="거래 삭제"
                    onPress={() => {
                      closeSwipe(transaction.id);
                      handleDelete(transaction);
                    }}
                    style={{ width: 72, backgroundColor: '#e1394a' }}
                    className="items-center justify-center"
                  >
                    <Ionicons name="trash-outline" size={17} color="#fff" />
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800', marginTop: 3 }}>
                      삭제
                    </Text>
                  </Pressable>
                </View>
              )}
            >
            <View
              className="flex-row items-center gap-3"
              style={{
                paddingHorizontal: 16,
                paddingVertical: 13,
                borderTopWidth: 1,
                borderColor: '#f1f3f5',
                backgroundColor: '#fff',
              }}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 11,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: deposit ? '#e8f7f0' : auto ? '#fff0e8' : '#eef2f8',
                }}
              >
                <Ionicons
                  name={deposit ? 'arrow-down' : auto ? 'flash-outline' : 'create-outline'}
                  size={15}
                  color={deposit ? '#2d8a63' : auto ? '#d97a4a' : '#5d6674'}
                />
              </View>

              <View className="flex-1">
                <Text numberOfLines={1} style={{ fontSize: 14, color: '#121a2a' }}>
                  {transaction.name ?? '이름 없는 거래'}
                </Text>
                <Text style={{ fontSize: 10, color: '#8b94a2', marginTop: 3 }}>
                  {[
                    categoryCode ? CATEGORY_CODE_LABEL[categoryCode] : '미분류',
                    auto ? '자동 분류' : '직접 입력',
                  ].join(' · ')}
                </Text>
              </View>

              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '700',
                  color: deposit ? theme.primary : '#121a2a',
                }}
              >
                {deposit ? '+' : '−'}
                {transaction.amount.toLocaleString('ko-KR')}원
              </Text>
            </View>
            </Swipeable>
          );
        }}
      />

      {/* 카테고리 변경 시트 */}
      <Modal
        visible={editing !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setEditing(null)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }}
          onPress={() => setEditing(null)}
        />
        <View
          style={{
            backgroundColor: '#fff',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingHorizontal: 20,
            paddingTop: 20,
            paddingBottom: 34,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '800', color: '#121a2a' }}>
            카테고리 변경
          </Text>
          <Text numberOfLines={1} style={{ fontSize: 12, color: '#8b94a2', marginTop: 4 }}>
            {editing?.name ?? '이름 없는 거래'} ·{' '}
            {(editing?.amount ?? 0).toLocaleString('ko-KR')}원
          </Text>

          <View className="mt-4 flex-row flex-wrap" style={{ gap: 8 }}>
            {(data?.categories ?? []).map((category) => {
              const selected = editing?.budget_category_id === category.id;
              return (
                <Pressable
                  key={category.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  disabled={busy}
                  onPress={() => void handleChangeCategory(category.id)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: selected ? theme.primary : '#e7e9ed',
                    backgroundColor: selected ? theme.primary : '#fff',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: selected ? '800' : '400',
                      color: selected ? theme.onPrimary : '#121a2a',
                    }}
                  >
                    {CATEGORY_CODE_LABEL[category.category_code as CategoryCode]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>
    </View>
  );
}
