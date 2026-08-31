// BUDGET-02 실제 지출.
// HTML 시안(.spend-card)의 구조를 옮겼다. 연결 계좌 헤더 + 거래 목록 + 직접 입력
//
// ⚠️ 자동 분류(AUTO)와 직접 입력(USER)을 화면에서 구분한다.
//    이 구분으로 자동분류 로직의 품질을 잰다. (docs/06 §7-3)
//
// ⚠️ 계좌번호는 마스킹된 값만 받는다. (NFR-002)
//    거래명은 화면에 보여주되 이벤트 파라미터로는 보내지 않는다. (NFR-007)
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { DateRangeCalendar } from '@/components/trip-create';

import { Button, CurrencyInput, Input } from '@/components/ui';
import type { CountryTheme } from '@/lib/constants/countryTheme';

export type ExpenseItem = {
  id: string;
  name: string;
  amount: number;
  occurredAt: string;
  /** true 면 연결 계좌에서 자동 분류된 거래 */
  auto: boolean;
};

/** 지출 입력값. occurredOn 은 'yyyy-MM-dd', 기본은 오늘이다 */
export type ExpenseDraft = { name: string; amount: number | null; occurredOn: string };

type Props = {
  expenses: ExpenseItem[];
  theme: CountryTheme;
  /** 연결 계좌가 있으면 마스킹된 번호. 없으면 null */
  maskedAccountNumber: string | null;

  adding: boolean;
  draft: ExpenseDraft;
  nameError: string | null;
  onStartAdd: () => void;
  onChangeDraft: (draft: ExpenseDraft) => void;
  onCancelAdd: () => void;
  onConfirmAdd: () => void;
  /** 더 있는 거래가 있으면 전체 내역으로 보낸다 */
  onPressMore?: () => void;
};

export function ExpenseCard({
  expenses,
  theme,
  maskedAccountNumber,
  adding,
  draft,
  nameError,
  onStartAdd,
  onChangeDraft,
  onCancelAdd,
  onConfirmAdd,
  onPressMore,
}: Props) {
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  return (
    <View
      style={{ borderWidth: 1, borderColor: '#e7e9ed', borderRadius: 15, overflow: 'hidden' }}
    >
      {/* 연결 계좌 */}
      {maskedAccountNumber ? (
        <View
          className="flex-row items-center gap-2.5"
          style={{ padding: 13, backgroundColor: '#f5f7fa' }}
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
              {maskedAccountNumber}
            </Text>
          </View>
          <View style={{ backgroundColor: '#e8f7f0', borderRadius: 20, paddingHorizontal: 7, paddingVertical: 5 }}>
            <Text style={{ fontSize: 8, fontWeight: '900', color: '#2d8a63' }}>연결됨</Text>
          </View>
        </View>
      ) : null}

      {/* 거래 목록 */}
      {expenses.length > 0 ? (
        expenses.map((expense, index) => (
          <View
            key={expense.id}
            className="flex-row items-center gap-2.5"
            style={{
              padding: 14,
              borderTopWidth: index === 0 && !maskedAccountNumber ? 0 : 1,
              borderColor: '#e7e9ed',
            }}
          >
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                backgroundColor: expense.auto ? '#fff0e8' : '#eef2f8',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons
                name={expense.auto ? 'flash-outline' : 'create-outline'}
                size={15}
                color={expense.auto ? '#d97a4a' : '#5d6674'}
              />
            </View>
            <View className="flex-1">
              <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '700', color: '#121a2a' }}>
                {expense.name}
              </Text>
              <Text style={{ fontSize: 9, color: '#7d8797', marginTop: 3 }}>
                {format(parseISO(expense.occurredAt), 'M월 d일')} ·{' '}
                {expense.auto ? '연결 계좌' : '직접 입력'}
              </Text>
            </View>
            <View className="items-end">
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#121a2a' }}>
                {expense.amount.toLocaleString('ko-KR')}원
              </Text>
              {expense.auto ? (
                <Text style={{ fontSize: 8, color: '#2d8a63', marginTop: 2 }}>자동 분류</Text>
              ) : null}
            </View>
          </View>
        ))
      ) : (
        <View style={{ padding: 20, borderTopWidth: maskedAccountNumber ? 1 : 0, borderColor: '#e7e9ed' }}>
          <Text style={{ fontSize: 11, color: '#7d8797', textAlign: 'center' }}>
            아직 이 카테고리의 지출이 없어요.
          </Text>
        </View>
      )}

      {/* 더보기 — 최근 몇 건만 보여주고 전체는 내역 화면으로 */}
      {onPressMore ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="지출 전체 내역 보기"
          onPress={onPressMore}
          style={{ padding: 13, borderTopWidth: 1, borderColor: '#e7e9ed', backgroundColor: '#fff' }}
          className="flex-row items-center justify-center active:bg-gray-50"
        >
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#5d6674' }}>
            전체 내역 보기
          </Text>
          <Ionicons name="chevron-forward" size={13} color="#8b94a2" />
        </Pressable>
      ) : null}

      {/* 직접 입력 */}
      {adding ? (
        <View style={{ padding: 13, backgroundColor: '#f7f8fa', borderTopWidth: 1, borderColor: '#e7e9ed', gap: 8 }}>
          <Input
            value={draft.name}
            onChangeText={(name) => onChangeDraft({ ...draft, name })}
            placeholder="지출 항목"
            error={nameError}
            maxLength={30}
            autoFocus
          />
          <CurrencyInput
            value={draft.amount}
            onChangeValue={(amount) => onChangeDraft({ ...draft, amount })}
            placeholder="금액"
          />

          {/* 날짜 — 기본은 오늘, 눌러서 바꾼다 */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="지출 날짜 선택"
            accessibilityState={{ expanded: datePickerOpen }}
            onPress={() => setDatePickerOpen((prev) => !prev)}
            className="flex-row items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 active:bg-gray-50"
          >
            <Text style={{ fontSize: 13, color: '#121a2a' }}>
              {format(parseISO(draft.occurredOn), 'yyyy년 M월 d일')}
            </Text>
            <Ionicons
              name={datePickerOpen ? 'chevron-up' : 'calendar-outline'}
              size={15}
              color="#8b94a2"
            />
          </Pressable>

          {datePickerOpen ? (
            <DateRangeCalendar
              mode="single"
              // 지출은 이미 쓴 돈이라 과거 날짜를 골라야 한다
              disablePast={false}
              startDate={draft.occurredOn}
              endDate={draft.occurredOn}
              onChange={(next) => {
                if (next.startDate) onChangeDraft({ ...draft, occurredOn: next.startDate });
                setDatePickerOpen(false);
              }}
            />
          ) : null}
          <View className="flex-row justify-end gap-2">
            <Button label="취소" variant="secondary" fullWidth={false} onPress={onCancelAdd} />
            <Button label="입력" fullWidth={false} onPress={onConfirmAdd} />
          </View>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="지출 직접 입력"
          onPress={onStartAdd}
          style={{ padding: 13, borderTopWidth: 1, borderColor: '#e7e9ed', backgroundColor: '#fff' }}
          className="active:bg-gray-50"
        >
          <Text style={{ fontSize: 11, fontWeight: '900', color: theme.primary, textAlign: 'center' }}>
            ＋ 지출 직접 입력
          </Text>
        </Pressable>
      )}
    </View>
  );
}
