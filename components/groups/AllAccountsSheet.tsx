import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { BottomSheet } from '@/components/ui';
import { institutionName } from '@/lib/constants/bank';

import type { GroupAccountItem } from './types';

type Props = {
  visible: boolean;
  /**
   * 이 모임의 모든 계좌. 준비 중·여행 중·지난 여행을 통틀어 지금 연결된
   * 계좌 전부다. 이미 financial_account_id 기준으로 묶여 있다.
   */
  accounts: GroupAccountItem[];
  onClose: () => void;
  onSelectTrip: (tripId: string) => void;
};

/**
 * 계좌 하나의 보조문구.
 *
 *   준비 중·여행 중에서 쓰는 중  →  `2개 여행에서 사용 중`
 *   지난 여행에만 남아 있음      →  `지난 여행에서 사용`
 *
 * ⚠️ DB 에 새 status 를 만들지 않는다. trips.status 로 센 값(activeTripCount)만
 *    쓴다. (2026-09-09 확정)
 */
function accountCaption(account: GroupAccountItem): string {
  if (account.activeTripCount === 0) return '지난 여행에서 사용';
  return `${account.activeTripCount}개 여행에서 사용 중`;
}

/**
 * 전체 계좌.
 *
 * GROUP 메인은 준비 중·여행 중에서 쓰는 계좌만 보여준다. 지난 여행에만 남은
 * 계좌를 확인할 곳이 없으면 "내 계좌가 어디 갔지" 가 된다. 그래서 여기서
 * **모임의 모든 계좌**를 본다.
 *
 * ⚠️ 새 화면(route)을 만들지 않는다. 계획 추가·지출 입력이 쓰는 공통
 *    BottomSheet 를 그대로 쓴다. 새 라이브러리도 넣지 않는다.
 *
 * ⚠️ **시트를 겹치지 않는다.** 계좌를 눌러 또 다른 시트를 여는 구조를 만들지
 *    않고, 계좌 아래에 연결된 여행을 바로 펼쳐 둔다. 한 번의 탭으로 원하는
 *    여행의 계좌 관리 화면까지 간다.
 *
 * ⚠️ 여행 상태는 `준비 중` · `여행 중` · `지난 여행` 세 가지뿐이다.
 *    `종료` · `결산 완료` 로 나누지 않는다. (format.ts toGroupTripStatusLabel)
 *
 * ⚠️ supabase · track() 을 직접 부르지 않는다. 화면 파일이 부른다. (CLAUDE.md 9장)
 */
export function AllAccountsSheet({ visible, accounts, onClose, onSelectTrip }: Props) {
  return (
    <BottomSheet
      visible={visible}
      title="전체 계좌"
      titleAlign="center"
      // 계좌를 훑어보는 시트라 여행 선택 시트보다 넉넉하게 연다.
      // 넘치면 BottomSheet 안의 ScrollView 가 받는다. (maxHeight 86%)
      minHeight="58%"
      onClose={onClose}
    >
      {accounts.length === 0 ? (
        // ⚠️ 여기에 '계좌 연결하기' 를 두지 않는다. 계좌 연결은 여행별 흐름에서
        //    한다. 모임에는 어느 여행에 연결할지 정할 방법이 없다.
        <View className="py-6">
          <Text className="text-center text-pot-faint" style={{ fontSize: 13 }}>
            이 모임에 연결된 계좌가 없어요.
          </Text>
        </View>
      ) : (
        // 제목과 첫 계좌 사이(mt-5), 계좌 그룹 사이(gap-3).
        // 여기가 넓어야 어느 여행이 어느 계좌인지 갈린다.
        <View className="mt-5 gap-3">
          {accounts.map((account) => (
            /**
             * ⚠️ 계좌 하나를 **하나의 상자**로 묶는다. 전에는 계좌·여행·계좌·
             *    여행 이 그냥 이어져 있어서, 계좌가 둘 이상이면 어느 여행이
             *    어느 계좌에 속하는지 알기 어려웠다. (2026-09-09)
             * ⚠️ 상자를 겹치지 않는다. 안쪽 여행 줄은 카드로 감싸지 않고
             *    divider 로만 나눈다.
             */
            <View
              key={account.accountId}
              className="rounded-2xl border border-pot-line bg-white px-3.5 py-3"
            >
              {/* 계좌 줄. 누르는 자리가 아니다 — 아래 여행 줄이 이동을 맡는다. */}
              <View className="flex-row items-center">
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
                    <Text
                      className={`text-pot-mute ${account.institutionCode ? 'ml-1.5' : ''}`}
                      style={{ fontSize: 13 }}
                    >
                      {account.maskedAccountNumber ?? '계좌번호 없음'}
                    </Text>
                  </View>
                  <Text className="mt-0.5 text-pot-faint" style={{ fontSize: 11 }}>
                    {accountCaption(account)}
                  </Text>
                </View>
              </View>

              {/* 이 계좌가 연결된 여행. 상자 안에 바로 펼쳐 둔다. */}
              <View className="mt-1">
                {account.trips.map((trip, tripIndex) => {
                  const rowClass = `flex-row items-center py-2.5 ${
                    tripIndex === 0 ? 'mt-1.5' : 'border-t border-pot-line'
                  }`;

                  const body = (
                    <>
                      <View className="flex-1 pr-2">
                        <Text
                          numberOfLines={1}
                          className="text-pot-ink"
                          style={{ fontSize: 13.5, lineHeight: 19 }}
                        >
                          {trip.destination ?? '여행'}
                        </Text>
                        <Text className="mt-0.5 text-pot-faint" style={{ fontSize: 11 }}>
                          {trip.statusLabel}
                        </Text>
                      </View>
                      {trip.isParticipant ? (
                        <Ionicons name="chevron-forward" size={14} color="#C3C9D2" />
                      ) : null}
                    </>
                  );

                  // 참가하지 않은 여행은 정보 줄이다. 계좌와의 연결 관계만 보여준다.
                  if (!trip.isParticipant) {
                    return (
                      <View key={trip.tripId} className={rowClass}>
                        {body}
                      </View>
                    );
                  }

                  return (
                    <Pressable
                      key={trip.tripId}
                      accessibilityRole="button"
                      accessibilityLabel={`${trip.destination ?? '여행'} 연결 계좌 확인`}
                      onPress={() => onSelectTrip(trip.tripId)}
                      className={`${rowClass} active:opacity-60`}
                    >
                      {body}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      )}
    </BottomSheet>
  );
}
