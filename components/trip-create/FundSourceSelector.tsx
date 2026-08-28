// TRIP-03 현재 여행자금 등록.
//
// ⚠️ 계좌 연결은 필수가 아니다. (POL-FUND-001, AC-01)
//    직접 입력이나 0원으로도 여행 생성이 끝나야 한다.
//
// ⚠️ 직접입력 금액과 계좌 잔액을 절대 합산하지 않는다. (CLAUDE.md 3장)
//    항상 하나의 소스만 고른다. 그래서 라디오다.
//
// ⚠️ financial_accounts 는 group_id 만 갖는다. 개인 여행에는 계좌 선택지가
//    아예 나오지 않는다. 신규 모임도 방금 만들어 연결된 계좌가 없다.
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { CurrencyInput } from '@/components/ui';
import { FUND_SOURCE_TYPE, type FundSourceType } from '@/lib/constants/status';
import type { FinancialAccount } from '@/lib/supabase/queries/funds';

type Props = {
  value: FundSourceType | null;
  onChange: (value: FundSourceType) => void;

  /** 연결 가능한 Mock 계좌. 비어 있으면 계좌 선택지를 그리지 않는다 */
  accounts: FinancialAccount[];
  accountsLoading: boolean;
  selectedAccountId: string | null;
  onSelectAccount: (accountId: string) => void;

  manualAmount: number | null;
  onChangeManualAmount: (value: number | null) => void;
  manualAmountError?: string | null;

  disabled?: boolean;
};

export function FundSourceSelector({
  value,
  onChange,
  accounts,
  accountsLoading,
  selectedAccountId,
  onSelectAccount,
  manualAmount,
  onChangeManualAmount,
  manualAmountError = null,
  disabled = false,
}: Props) {
  const options: {
    value: FundSourceType;
    label: string;
    description: string;
    icon: keyof typeof Ionicons.glyphMap;
  }[] = [
    ...(accounts.length > 0
      ? [
          {
            value: FUND_SOURCE_TYPE.MOCK,
            label: '연결된 계좌를 쓸래요',
            description: '계좌 잔액을 현재 여행자금으로 봐요',
            icon: 'card-outline' as const,
          },
        ]
      : []),
    {
      value: FUND_SOURCE_TYPE.MANUAL,
      label: '금액을 직접 입력할래요',
      description: '지금 모아둔 금액을 적어요',
      icon: 'create-outline',
    },
    {
      value: FUND_SOURCE_TYPE.ZERO,
      label: '0원부터 시작할래요',
      description: '아직 모은 금액이 없어요',
      icon: 'flag-outline',
    },
  ];

  return (
    <View className="gap-3">
      {accountsLoading ? (
        <Text className="text-sm text-gray-400">연결된 계좌를 확인하는 중…</Text>
      ) : null}

      {options.map((option) => {
        const selected = value === option.value;
        return (
          <View key={option.value}>
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled }}
              accessibilityLabel={option.label}
              disabled={disabled}
              onPress={() => onChange(option.value)}
              className={`flex-row items-center gap-3 rounded-2xl border px-4 py-4 ${
                selected
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 bg-white active:bg-gray-50'
              } ${disabled ? 'opacity-40' : ''}`}
            >
              <View
                className={`h-10 w-10 items-center justify-center rounded-full ${
                  selected ? 'bg-blue-600' : 'bg-gray-100'
                }`}
              >
                <Ionicons name={option.icon} size={20} color={selected ? '#ffffff' : '#6b7280'} />
              </View>
              <View className="flex-1">
                <Text
                  className={`text-base font-semibold ${
                    selected ? 'text-blue-700' : 'text-gray-900'
                  }`}
                >
                  {option.label}
                </Text>
                <Text className="mt-0.5 text-xs text-gray-500">{option.description}</Text>
              </View>
              {selected ? <Ionicons name="checkmark-circle" size={22} color="#2563eb" /> : null}
            </Pressable>

            {/* 계좌 목록 — NFR-002 계좌번호는 마스킹된 값만 보여준다 */}
            {selected && option.value === FUND_SOURCE_TYPE.MOCK ? (
              <View className="mt-2 gap-2">
                {accounts.map((account) => {
                  const accountSelected = selectedAccountId === account.id;
                  return (
                    <Pressable
                      key={account.id}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: accountSelected, disabled }}
                      accessibilityLabel={account.masked_account_number ?? '계좌'}
                      disabled={disabled}
                      onPress={() => onSelectAccount(account.id)}
                      className={`flex-row items-center justify-between rounded-xl border px-4 py-3 ${
                        accountSelected
                          ? 'border-blue-600 bg-blue-50'
                          : 'border-gray-200 bg-white active:bg-gray-50'
                      }`}
                    >
                      <View>
                        <Text className="text-sm text-gray-800">
                          {account.masked_account_number ?? '계좌'}
                        </Text>
                        <Text className="mt-0.5 text-xs text-gray-500">
                          잔액 {account.current_balance.toLocaleString('ko-KR')}원
                        </Text>
                      </View>
                      {accountSelected ? (
                        <Ionicons name="checkmark-circle" size={18} color="#2563eb" />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {selected && option.value === FUND_SOURCE_TYPE.MANUAL ? (
              <View className="mt-2">
                <CurrencyInput
                  value={manualAmount}
                  onChangeValue={onChangeManualAmount}
                  error={manualAmountError}
                  editable={!disabled}
                  hint="나중에 계좌로 바꾸면 이 금액은 계좌 잔액으로 대체돼요."
                />
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
