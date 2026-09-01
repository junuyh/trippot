// TRIP-HOME 최근 여행자금 내역.
//
// 준비 홈은 요약 화면이다. 전체 목록은 FUND-01(2-4)이 담당한다.
// 여기서는 최근 몇 건만 보여주고 '전체 보기' 로 넘긴다.
//
// ⚠️ 거래명(transactions.name)은 화면에 보여주되 이벤트 파라미터로는 기록하지 않는다.
//    (NFR-007 — 계좌번호·거래명 원문을 로그에 남기지 않는다)
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { Pressable, Text, View } from 'react-native';

import {
  CATEGORY_CODE_LABEL,
  TRANSACTION_TYPE,
  type CategoryCode,
  type TransactionType,
} from '@/lib/constants/status';

export type RecentTransaction = {
  id: string;
  merchantName: string | null;
  amount: number;
  transactionType: TransactionType;
  occurredAt: string;
  /** 연결된 카테고리. 미분류면 null */
  categoryCode: CategoryCode | null;
};

type Props = {
  transactions: RecentTransaction[];
  /**
   * 거래 상세로 이동. **없으면 읽기 전용으로 그린다.**
   *
   * 거래 상세(FUND-03)는 고도화 화면이라 MVP 에서는 갈 곳이 없다.
   * 눌리는 것처럼 보이는데 빈 화면이 뜨는 것보다 아예 안 눌리는 편이 낫다.
   * (docs/04_v3 — FUND-01/02/03 전부 고도화)
   */
  onSelect?: (transactionId: string) => void;
};

export function RecentTransactionList({ transactions, onSelect }: Props) {
  return (
    <View className="overflow-hidden rounded-2xl border border-gray-200">
      {transactions.map((transaction, index) => {
        const deposit = transaction.transactionType === TRANSACTION_TYPE.DEPOSIT;
        const Row = onSelect ? Pressable : View;
        return (
          <Row
            key={transaction.id}
            {...(onSelect
              ? {
                  accessibilityRole: 'button' as const,
                  accessibilityLabel: `${transaction.merchantName ?? '거래'} 상세`,
                  onPress: () => onSelect(transaction.id),
                }
              : {})}
            className={`flex-row items-center justify-between px-4 py-3.5 ${
              onSelect ? 'active:bg-gray-50' : ''
            } ${index > 0 ? 'border-t border-gray-100' : ''}`}
          >
            <View className="flex-1 pr-3">
              <Text numberOfLines={1} className="text-base text-gray-800">
                {transaction.merchantName ?? '이름 없는 거래'}
              </Text>
              <View className="mt-0.5 flex-row items-center gap-1.5">
                <Text className="text-xs text-gray-400">
                  {format(parseISO(transaction.occurredAt), 'M.d')}
                </Text>
                {/*
                  ⚠️ 입금에는 카테고리를 붙이지 않는다. '미분류' 배지도 달지 않는다.
                     입금은 자금이 들어온 것이지 예산을 쓴 게 아니라,
                     분류를 요구하면 사용자는 없는 할 일을 만든다.
                */}
                {deposit ? (
                  <Text className="text-xs text-gray-400">· 자금 입금</Text>
                ) : transaction.categoryCode ? (
                  <Text className="text-xs text-gray-400">
                    · {CATEGORY_CODE_LABEL[transaction.categoryCode]}
                  </Text>
                ) : (
                  <View className="rounded-full bg-amber-50 px-1.5 py-0.5">
                    <Text className="text-[10px] font-medium text-amber-700">미분류</Text>
                  </View>
                )}
              </View>
            </View>

            <View className="flex-row items-center gap-1">
              <Text
                className={`text-base font-semibold ${
                  deposit ? 'text-blue-600' : 'text-gray-900'
                }`}
              >
                {deposit ? '+' : '−'}
                {transaction.amount.toLocaleString('ko-KR')}
              </Text>
              {onSelect ? (
                <Ionicons name="chevron-forward" size={15} color="#d1d5db" />
              ) : null}
            </View>
          </Row>
        );
      })}
    </View>
  );
}
