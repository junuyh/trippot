// TRIP-03 현재 준비한 여행자금.
//
// ⚠️ 계좌 연결은 필수가 아니다. (POL-FUND-001, AC-01)
//    직접 입력이나 0원으로도 여행 생성이 끝나야 한다.
//
// ⚠️ 직접입력 금액과 계좌 잔액을 절대 합산하지 않는다. (CLAUDE.md 3장)
//    항상 하나의 소스만 고른다. 이제 선택 UI 가 그걸 구조로 보장한다 —
//    셋 중 하나만 켜지므로 합산할 수 있는 상태가 아예 만들어지지 않는다.
//
// ⚠️ 2026-09-03 · 선택지 3개로 되돌렸다.
//    2026-09-02 에 '연결된 계좌 우선 + 보조 액션' 으로 바꿨던 이유는
//    "3개짜리 라디오를 세우면 예산과 같은 무게로 보인다" 였다. 그 걱정은
//    맞았지만 원인은 개수가 아니라 크기였다. 카드 3장을 쌓지 않고 한 테두리
//    안에 얇은 행 3개로 두면 무게가 생기지 않는다.
//
//    되돌린 이유는 두 가지다.
//      · 계좌 유무에 따라 UI 가 두 벌이었다. 같은 질문에 답하는데 생김새가 달랐다.
//      · 보조 액션이 11px 회색 링크라 사실상 보이지 않았다. '금액 직접 입력' 을
//        찾지 못한 사용자가 "뭘 어쩌라는 건지 모르겠다" 에서 막혔다.
//
// ⚠️ 여기서 **신규 계좌 연결을 요구하지 않는다.** 이미 연결된 모임통장만 후보다.
//    새 연결은 여행을 만든 뒤 여행 홈에서 한다. 그래서 하단 안내는 계좌 유무와
//    무관하게 항상 남긴다. 실제로 사용자가 갖는 질문이다.
//
// ⚠️ financial_accounts 는 group_id 만 갖는다. 개인 여행과 신규 모임에는
//    붙을 계좌가 없어 '연결된 계좌' 행 자체가 나오지 않는다.
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { CurrencyInput } from '@/components/ui';
import { institutionName } from '@/lib/constants/bank';
import { FUND_SOURCE_TYPE, type FundSourceType } from '@/lib/constants/status';
import { BRAND } from '@/lib/constants/brandColor';
import type { FinancialAccount } from '@/lib/supabase/queries/funds';

type Props = {
  value: FundSourceType;
  onChange: (value: FundSourceType) => void;

  /** 이미 연결된 Mock 계좌. 비어 있으면 '연결된 계좌' 행을 그리지 않는다 */
  accounts: FinancialAccount[];
  accountsLoading: boolean;
  selectedAccountId: string | null;
  /** 여러 계좌 중 하나를 고른다. 소스 전환은 onChange 가 담당한다 */
  onSelectAccount: (accountId: string) => void;

  manualAmount: number | null;
  onChangeManualAmount: (value: number | null) => void;
  manualAmountError?: string | null;

  disabled?: boolean;
};

/** 선택 상태 표시. 골라진 것에만 파란 체크가 찍힌다. */
function CheckMark({ selected }: { selected: boolean }) {
  return (
    <View
      className={`h-5 w-5 items-center justify-center rounded-full ${
        selected ? 'bg-brand' : 'border border-gray-300 bg-white'
      }`}
    >
      {selected ? <Ionicons name="checkmark" size={12} color="#ffffff" /> : null}
    </View>
  );
}

/**
 * 선택지 한 행.
 *
 * 계좌 카드(2026-09-02)와 같은 언어를 쓴다 — 34px 원형 아이콘, 골라지면 행이
 * 파랗게 바뀐다. 카드로 띄우지 않고 한 테두리 안에 쌓아서 예산 구성만큼
 * 무거워 보이지 않게 한다.
 */
function OptionRow({
  icon,
  label,
  hint,
  selected,
  first,
  disabled,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint: string;
  selected: boolean;
  first: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={`${label} — ${hint}`}
      disabled={disabled}
      onPress={onPress}
      className={`flex-row items-center gap-3 px-3.5 py-3 ${
        first ? '' : 'border-t border-gray-100'
      } ${selected ? 'bg-brand-soft' : 'bg-white active:bg-gray-50'} ${
        disabled ? 'opacity-40' : ''
      }`}
    >
      <View
        className={`h-[34px] w-[34px] items-center justify-center rounded-full ${
          selected ? 'bg-white' : 'bg-brand-soft'
        }`}
      >
        <Ionicons name={icon} size={18} color={BRAND.primary} />
      </View>

      <View className="min-w-0 flex-1">
        <Text
          numberOfLines={1}
          className={`text-[13px] font-extrabold ${selected ? 'text-brand' : 'text-gray-900'}`}
        >
          {label}
        </Text>
        <Text numberOfLines={1} className="mt-0.5 text-[11px] text-gray-500">
          {hint}
        </Text>
      </View>

      <CheckMark selected={selected} />
    </Pressable>
  );
}

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
  const hasAccounts = accounts.length > 0;
  const usingAccount = value === FUND_SOURCE_TYPE.MOCK;
  const usingManual = value === FUND_SOURCE_TYPE.MANUAL;

  return (
    <View>
      {accountsLoading ? (
        <Text className="mb-2 text-sm text-gray-400">연결된 계좌를 확인하는 중…</Text>
      ) : null}

      <View className="overflow-hidden rounded-2xl border border-gray-200">
        {/* ── ① 연결된 계좌 ── 붙을 계좌가 없으면 행 자체가 없다 ── */}
        {hasAccounts ? (
          <>
            <OptionRow
              icon="card-outline"
              label="연결된 계좌"
              hint={
                accounts.length > 1
                  ? `모임통장 ${accounts.length}개 중에서 고를 수 있어요`
                  : '모임통장 잔액을 그대로 써요'
              }
              selected={usingAccount}
              first
              disabled={disabled}
              onPress={() => onChange(FUND_SOURCE_TYPE.MOCK)}
            />

            {/*
              계좌 목록은 '연결된 계좌' 를 골랐을 때만 펼친다. 예산 구성의
              아코디언과 같은 패턴이라 한 화면에서 배울 것이 하나다.

              ⚠️ NFR-002 — masked_account_number 는 DB 에 이미 마스킹된 값이다.
                 그대로 쓰고, 원본 계좌번호는 어디에도 두지 않는다.

              ⚠️ 기관명은 institutionName() 으로 만든다. FUND-02 와 같은 함수를
                 써야 한다. 같은 계좌가 화면마다 다른 이름으로 보이면 사용자는
                 다른 계좌라고 읽는다.
            */}
            {usingAccount ? (
              <View className="gap-1.5 bg-brand-soft px-3.5 pb-3.5">
                {accounts.map((account) => {
                  const picked = selectedAccountId === account.id;
                  return (
                    <Pressable
                      key={account.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: picked, disabled }}
                      accessibilityLabel={`${institutionName(account.institution_code)} ${
                        account.masked_account_number ?? '계좌'
                      }`}
                      disabled={disabled}
                      onPress={() => onSelectAccount(account.id)}
                      className={`flex-row items-center gap-2.5 rounded-xl border bg-white px-3 py-2.5 ${
                        picked ? 'border-brand' : 'border-gray-200 active:bg-gray-50'
                      }`}
                    >
                      <View className="min-w-0 flex-1">
                        <Text
                          numberOfLines={1}
                          className="text-[12.5px] font-extrabold text-gray-900"
                        >
                          {institutionName(account.institution_code)}
                        </Text>
                        <Text numberOfLines={1} className="mt-0.5 text-[11px] text-gray-500">
                          {account.masked_account_number ?? '계좌'} · 잔액{' '}
                          {account.current_balance.toLocaleString('ko-KR')}원
                        </Text>
                      </View>
                      <CheckMark selected={picked} />
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </>
        ) : null}

        {/* ── ② 금액 직접 입력 ── */}
        <OptionRow
          icon="wallet-outline"
          label="금액 직접 입력"
          hint="이미 모아 둔 금액을 적어요"
          selected={usingManual}
          first={!hasAccounts}
          disabled={disabled}
          onPress={() => onChange(FUND_SOURCE_TYPE.MANUAL)}
        />

        {usingManual ? (
          <View className="bg-brand-soft px-3.5 pb-3.5">
            <CurrencyInput
              value={manualAmount}
              onChangeValue={onChangeManualAmount}
              error={manualAmountError}
              editable={!disabled}
              hint="입력하지 않아도 0원으로 여행을 만들 수 있어요."
            />
          </View>
        ) : null}

        {/* ── ③ 0원으로 시작 ── 아무것도 하지 않는 것도 하나의 선택이다 ── */}
        <OptionRow
          icon="time-outline"
          label="0원으로 시작"
          hint="여행을 만든 뒤에 정해도 돼요"
          selected={value === FUND_SOURCE_TYPE.ZERO}
          first={false}
          disabled={disabled}
          onPress={() => onChange(FUND_SOURCE_TYPE.ZERO)}
        />
      </View>

      <Text className="mt-2 text-[11px] leading-4 text-gray-400">
        여행을 만든 뒤 여행 홈에서 모임통장을 연결할 수 있어요.
      </Text>
    </View>
  );
}
