// TRIP-03 현재 준비한 여행자금.
//
// ⚠️ 계좌 연결은 필수가 아니다. (POL-FUND-001, AC-01)
//    직접 입력이나 0원으로도 여행 생성이 끝나야 한다. 기본값은 0원이다.
//
// ⚠️ 직접입력 금액과 계좌 잔액을 절대 합산하지 않는다. (CLAUDE.md 3장)
//    항상 하나의 소스만 고른다.
//
// ⚠️ 2026-09-02 · 라디오 3개 → '이미 연결된 계좌' 우선 + 보조 액션으로 바꿨다.
//    (HTML 시안 반영, 요청 §4) 여행자금은 이 화면의 필수 결정이 아니다.
//    3개짜리 라디오를 세워 두면 예산과 같은 무게의 선택처럼 보인다.
//
// ⚠️ 여기서 **신규 계좌 연결을 요구하지 않는다.** 이미 연결된 모임통장만 후보다.
//    새 연결은 여행을 만든 뒤 여행 준비 홈에서 한다.
//
// ⚠️ financial_accounts 는 group_id 만 갖는다. 개인 여행과 신규 모임에는
//    붙을 계좌가 없어 계좌 블록이 아예 나오지 않는다.
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { CurrencyInput } from '@/components/ui';
import { FUND_SOURCE_TYPE, type FundSourceType } from '@/lib/constants/status';
import type { FinancialAccount } from '@/lib/supabase/queries/funds';

type Props = {
  value: FundSourceType;
  onChange: (value: FundSourceType) => void;

  /** 이미 연결된 Mock 계좌. 비어 있으면 계좌 블록을 그리지 않는다 */
  accounts: FinancialAccount[];
  accountsLoading: boolean;
  selectedAccountId: string | null;
  /** 계좌를 여행자금 소스로 삼는다. 소스 전환과 계좌 선택이 한 동작이다 */
  onUseAccount: (accountId: string) => void;

  manualAmount: number | null;
  onChangeManualAmount: (value: number | null) => void;
  manualAmountError?: string | null;

  disabled?: boolean;
};

/** 보조 액션 한 개. 작은 글자 링크다. 라디오처럼 보이면 안 된다. */
function AltAction({
  label,
  active,
  onPress,
  disabled,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      className={`px-1 py-1.5 active:opacity-60 ${disabled ? 'opacity-40' : ''}`}
    >
      <Text
        className={`text-[11px] font-bold ${active ? 'text-blue-600' : 'text-gray-500'}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function FundSourceSelector({
  value,
  onChange,
  accounts,
  accountsLoading,
  selectedAccountId,
  onUseAccount,
  manualAmount,
  onChangeManualAmount,
  manualAmountError = null,
  disabled = false,
}: Props) {
  const hasAccounts = accounts.length > 0;

  return (
    <View>
      {accountsLoading ? (
        <Text className="text-sm text-gray-400">연결된 계좌를 확인하는 중…</Text>
      ) : null}

      {hasAccounts ? (
        <>
          {/*
            ⚠️ 계좌를 가리키는 이름은 financial_accounts 에 있는 값만 쓴다.
               시안의 '카카오뱅크 모임통장' 같은 은행명은 만들지 않는다.
               institution_code 를 은행명으로 바꾸는 매핑이 프로젝트에 없어서
               지어내면 DB 와 화면이 다른 말을 하게 된다.
               (components/groups/types.ts 와 같은 판단)

            ⚠️ NFR-002 — masked_account_number 는 DB 에 이미 마스킹된 값이다.
               그대로 쓰고, 원본 계좌번호는 어디에도 두지 않는다.
          */}
          {accounts.map((account, index) => {
            const using = value === FUND_SOURCE_TYPE.MOCK && selectedAccountId === account.id;
            return (
              <View
                key={account.id}
                className={`flex-row items-center gap-3 rounded-2xl border px-3.5 py-3 ${
                  using ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white'
                } ${index > 0 ? 'mt-2' : ''}`}
              >
                <View
                  className={`h-[34px] w-[34px] items-center justify-center rounded-full ${
                    using ? 'bg-white' : 'bg-blue-50'
                  }`}
                >
                  <Ionicons name="card-outline" size={18} color="#2563eb" />
                </View>

                <View className="min-w-0 flex-1">
                  {/* 계좌를 알아보는 단서는 마스킹된 번호뿐이다. 그게 제목이다 */}
                  <Text numberOfLines={1} className="text-[13px] font-extrabold text-gray-900">
                    {account.masked_account_number ?? '연결된 계좌'}
                  </Text>
                  <Text numberOfLines={1} className="mt-0.5 text-[11px] text-gray-500">
                    잔액 {account.current_balance.toLocaleString('ko-KR')}원
                  </Text>
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: using, disabled: disabled || using }}
                  accessibilityLabel={using ? '이 계좌를 사용 중' : '이 계좌 사용'}
                  disabled={disabled || using}
                  onPress={() => onUseAccount(account.id)}
                  className={`rounded-lg px-2.5 py-2 ${
                    using ? 'bg-white' : 'bg-blue-600 active:bg-blue-700'
                  } ${disabled ? 'opacity-40' : ''}`}
                >
                  <Text
                    className={`text-[11px] font-extrabold ${
                      using ? 'text-blue-600' : 'text-white'
                    }`}
                  >
                    {using ? '사용 중' : '이 계좌 사용'}
                  </Text>
                </Pressable>
              </View>
            );
          })}

          <View className="mt-2.5 flex-row items-center justify-center gap-2">
            <AltAction
              label="금액 직접 입력"
              active={value === FUND_SOURCE_TYPE.MANUAL}
              onPress={() => onChange(FUND_SOURCE_TYPE.MANUAL)}
              disabled={disabled}
            />
            <Text className="text-[10px] text-gray-300">·</Text>
            <AltAction
              label="0원부터 시작"
              active={value === FUND_SOURCE_TYPE.ZERO}
              onPress={() => onChange(FUND_SOURCE_TYPE.ZERO)}
              disabled={disabled}
            />
          </View>
        </>
      ) : (
        <>
          {/* 연결된 계좌가 없다. 여기서 신규 연결을 요구하지 않는다 */}
          <View className="rounded-2xl border border-gray-200 bg-white p-3.5">
            <Text className="text-[13px] font-extrabold text-gray-800">
              아직 모은 금액이 없다면 0원부터 시작해요.
            </Text>
            <Text className="mt-1 text-[11px] leading-[17px] text-gray-500">
              여행을 만든 뒤 모임통장을 연결할 수 있어요.
            </Text>
            <View className="mt-2 self-start">
              <AltAction
                label="모은 금액 직접 입력"
                active
                onPress={() => onChange(FUND_SOURCE_TYPE.MANUAL)}
                disabled={disabled}
              />
            </View>
          </View>

          {value === FUND_SOURCE_TYPE.MANUAL ? (
            <View className="mt-2.5 flex-row items-center justify-center">
              <AltAction
                label="0원부터 시작"
                active={false}
                onPress={() => onChange(FUND_SOURCE_TYPE.ZERO)}
                disabled={disabled}
              />
            </View>
          ) : null}
        </>
      )}

      {/* 직접 입력을 고른 경우에만 입력칸을 펼친다 */}
      {value === FUND_SOURCE_TYPE.MANUAL ? (
        <View className="mt-2.5">
          <CurrencyInput
            value={manualAmount}
            onChangeValue={onChangeManualAmount}
            error={manualAmountError}
            editable={!disabled}
            hint="입력하지 않아도 0원으로 여행을 만들 수 있어요."
          />
        </View>
      ) : null}

      {value === FUND_SOURCE_TYPE.ZERO && hasAccounts ? (
        <Text className="mt-2 text-[11px] leading-4 text-gray-400">
          여행을 만든 뒤에도 계좌나 금액으로 바꿀 수 있어요.
        </Text>
      ) : null}
    </View>
  );
}
