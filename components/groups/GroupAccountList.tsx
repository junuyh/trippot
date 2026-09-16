import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { institutionName } from '@/lib/constants/bank';

import type { GroupAccountItem } from './types';

type Props = {
  accounts: GroupAccountItem[];
  /**
   * 계좌를 눌렀을 때.
   *
   * 여행이 하나면 그 여행으로 바로 보내고, 둘 이상이면 고르게 한다.
   * 어느 쪽인지는 화면 파일이 정한다. (app/groups/[groupId]/index.tsx)
   */
  onPressAccount: (account: GroupAccountItem) => void;
};

/**
 * 3-2. 연결 계좌. (docs/09_IA_v1.md §3-2)
 *
 * 계좌 연결은 서비스 이용 필수조건이 아니다. 0개가 정상 상태다. (POL-FUND-001)
 *
 * ⚠️ **계좌 하나에 한 줄이다.** 같은 계좌를 여러 여행이 써도 한 번만 그린다.
 *    여행마다 반복하면 계좌가 여러 개인 것처럼 읽힌다. (2026-09-08 확정)
 *
 * ⚠️ **준비 중·여행 중 여행에서 쓰는 계좌만** 온다. 지난 여행에만 연결된
 *    계좌는 여기 없고 '전체 계좌' 시트에서 본다. 거르는 것은 화면 파일이 한다.
 *    (2026-09-09 확정)
 *
 * ⚠️ 계좌를 누르면 **여행이 하나뿐이어도** 시트를 띄운다. 어느 여행의 계좌
 *    화면으로 가는지 보고 나서 이동하게 한다.
 *
 * ⚠️ 잔액은 MVP 에서 표시하지 않는다. 계좌번호는 DB 에 이미 마스킹된 값이
 *    들어 있어 그대로 쓴다. (NFR-002)
 *
 * ⚠️ 은행명은 institutionName() 이 기관 코드에서 만든다. 임의의 은행 이름을
 *    적지 않는다. 모르는 코드면 `기관 090` 처럼 코드를 그대로 보여준다.
 *    (lib/constants/bank.ts — FUND-02 계좌 연결 화면과 같은 매핑)
 */
export function GroupAccountList({ accounts, onPressAccount }: Props) {
  if (accounts.length === 0) {
    /**
     * ⚠️ `연결된 계좌가 없어요.` 는 모임 전체에 계좌가 하나도 없다는 말로
     *    읽힌다. 여기는 **지금 쓰고 있는 계좌**만 보여주는 자리라 지난 여행에만
     *    남은 계좌가 있을 수 있다. 문구를 정확히 한다. (2026-09-09)
     *
     * ⚠️ 글자 한 줄만 두지 않는다. 실제 계좌 카드와 비슷한 크기·radius 의
     *    빈 자리를 두어 '여기에 계좌가 놓인다' 는 것이 보이게 한다.
     *    점선 테두리라 실제 카드와 구분된다. 누르는 자리가 아니다.
     */
    return (
      <View className="flex-row items-center justify-center rounded-2xl border border-dashed border-pot-dash bg-pot-visual px-4 py-5">
        {/* 연결된 계좌 행과 같은 card-outline. 문구와 한 세트로 읽히게 왼쪽에 둔다. (2026-09-17) */}
        <Ionicons name="card-outline" size={17} color="#B6BCC6" />
        <Text className="ml-2 text-pot-faint" style={{ fontSize: 12.5 }}>
          현재 사용 중인 연결 계좌가 없어요.
        </Text>
      </View>
    );
  }

  return (
    // 계좌 카드 사이 간격. 카드마다 테두리가 있어 gap 이 곧 구분선이 된다.
    <View className="gap-2">
      {accounts.map((account) => (
        <Pressable
          key={account.accountId}
          accessibilityRole="button"
          accessibilityLabel={`${
            account.institutionCode ? institutionName(account.institutionCode) : '계좌'
          } 연결 관리`}
          onPress={() => onPressAccount(account)}
          /**
           * ⚠️ 계좌 하나가 하나의 덩어리로 보여야 한다. 전에는 바탕 위에
           *    아이콘과 글자만 놓여 있어서, 계좌가 둘 이상이면 어디까지가 한
           *    계좌인지 알기 어려웠다. 흰 배경 + 얇은 테두리로 묶는다.
           *    그림자는 쓰지 않는다 — 이 화면에 이미 카드가 많다. (2026-09-09)
           * ⚠️ 카드 전체가 누르는 자리다.
           */
          className="flex-row items-center rounded-2xl border border-pot-line bg-white px-3.5 py-3 active:opacity-70"
        >
          {/* 아이콘도 너무 연하면 사라진다. #9ca3af → pot-mute 로 한 단 올렸다. */}
          <Ionicons name="card-outline" size={17} color="#747B88" />

          <View className="ml-2.5 flex-1">
            <View className="flex-row items-center">
              {account.institutionCode ? (
                <Text
                  className="text-pot-ink"
                  style={{ fontSize: 14, fontWeight: '700' }}
                >
                  {institutionName(account.institutionCode)}
                </Text>
              ) : null}
              {/* 계좌번호는 은행명보다 한 단 낮다. */}
              <Text
                className={`text-pot-mute ${account.institutionCode ? 'ml-1.5' : ''}`}
                style={{ fontSize: 13 }}
              >
                {account.maskedAccountNumber ?? '계좌번호 없음'}
              </Text>
            </View>

            {/*
              ⚠️ 보조문구를 `N개 여행에서 사용 중` 하나로 통일한다.
                 (2026-09-09 확정) 여행이 하나뿐일 때만 여행 이름을 쓰면
                 줄마다 형식이 달라져 목록이 들쭉날쭉해진다. 어느 여행인지는
                 눌러서 시트에서 본다.

              ⚠️ N 은 준비 중·여행 중 개수다. 지난 여행은 세지 않는다 —
                 이 문구의 뜻이 '지금 몇 개 여행에서 쓰고 있는지' 이기 때문이다.
            */}
            <Text className="mt-0.5 text-pot-faint" style={{ fontSize: 11 }}>
              {`${account.activeTripCount}개 여행에서 사용 중`}
            </Text>
          </View>

          <Ionicons name="chevron-forward" size={14} color="#C3C9D2" />
        </Pressable>
      ))}
    </View>
  );
}
