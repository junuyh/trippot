import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { BottomSheet } from '@/components/ui';

import { institutionName } from '@/lib/constants/bank';
import type { GroupAccountItem } from './types';

type Props = {
  /** null 이면 닫혀 있다. */
  account: GroupAccountItem | null;
  onClose: () => void;
  onSelectTrip: (tripId: string) => void;
};

/**
 * 이 계좌가 연결된 여행을 보여주고, 어느 여행의 계좌 연결 화면으로 갈지 고른다.
 *
 * ⚠️ 여행이 **하나뿐이어도** 이 시트를 거친다. (2026-09-08 확정)
 *    GROUP 은 계좌 기준 화면이고 계좌 관리는 여행 단위 화면이다. 어느 여행으로
 *    넘어가는지 보지 못한 채 이동하면, 사용자가 의도하지 않은 여행의 계좌를
 *    건드릴 수 있다.
 *
 * ⚠️ 준비 중·여행 중·지난 여행이 모두 올 수 있다. 상태 이름은
 *    TRIP_STATUS_LABEL 을 그대로 쓴다. 새 상태 로직을 만들지 않는다.
 *
 * ⚠️ 새 라이브러리를 넣지 않는다. 계획 추가·지출 입력이 쓰는 공통
 *    BottomSheet 를 그대로 쓴다. (components/ui/BottomSheet)
 *
 * ⚠️ supabase · track() 을 직접 부르지 않는다. 화면 파일이 부른다. (CLAUDE.md 9장)
 */
export function AccountTripPickerSheet({ account, onClose, onSelectTrip }: Props) {
  return (
    <BottomSheet
      visible={account !== null}
      title="이 계좌가 연결된 여행"
      titleAlign="center"
      // 여행이 하나뿐일 때 시트가 납작해 보이지 않을 만큼만 띄운다.
      minHeight="46%"
      onClose={onClose}
    >
      {/*
        ⚠️ 제목과 계좌 정보를 가운데로 모은다. 공통 BottomSheet 의 title 은
           왼쪽 정렬이라, 이 시트에서만 본문 안에 제목을 다시 그리지 않고
           **계좌 블록을 가운데 두어** 시선이 계좌 → 여행 순으로 흐르게 한다.
           공통 BottomSheet 의 title 정렬을 전역으로 바꾸지 않는다. (2026-09-09)
        ⚠️ description 을 쓰지 않는다. 11px 회색이라 계좌가 잘 안 보였다.
      */}
      <View className="mb-6 mt-4 flex-row items-center justify-center">
        {/* GROUP 메인 계좌 카드와 같은 아이콘·같은 색이다. */}
        <Ionicons name="card-outline" size={17} color="#747B88" />
        {account?.institutionCode ? (
          <Text
            className="ml-2 text-pot-ink"
            style={{ fontSize: 15, fontWeight: '700' }}
          >
            {institutionName(account.institutionCode)}
          </Text>
        ) : null}
        <Text
          className={`text-pot-mute ${account?.institutionCode ? 'ml-1.5' : 'ml-2'}`}
          style={{ fontSize: 14 }}
        >
          {account?.maskedAccountNumber ?? '계좌번호 없음'}
        </Text>
      </View>

      <View className="mt-1 rounded-2xl border border-pot-line bg-white px-3.5">
        {(account?.trips ?? []).map((trip, index) => {
          const rowClass = `flex-row items-center py-3.5 ${
            index === 0 ? '' : 'border-t border-pot-line'
          }`;

          const body = (
            <>
              <View className="flex-1 pr-2">
                <Text
                  numberOfLines={1}
                  className="text-pot-ink"
                  style={{ fontSize: 14.5, lineHeight: 20 }}
                >
                  {trip.destination ?? '여행'}
                </Text>
                <Text className="mt-0.5 text-pot-faint" style={{ fontSize: 11.5 }}>
                  {trip.statusLabel}
                </Text>
              </View>

              {/* 참가자만 이동한다. 비참가자에게는 chevron 도 두지 않는다. */}
              {trip.isParticipant ? (
                <Ionicons name="chevron-forward" size={14} color="#C3C9D2" />
              ) : null}
            </>
          );

          /**
           * ⚠️ 내가 참가하지 않은 여행은 **누를 수 없다.** (2026-09-09 확정)
           *    여행 이름·상태와 계좌와의 연결 관계는 그대로 보여준다 —
           *    모임 멤버라면 볼 수 있는 정보다. 다만 그 여행의 계좌 관리
           *    화면으로는 들어가지 않는다.
           * ⚠️ 비활성 버튼을 두지 않는다. 아예 정보 줄로 그린다.
           */
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
    </BottomSheet>
  );
}
