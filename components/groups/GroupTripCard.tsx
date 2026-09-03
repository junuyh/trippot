import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { countryTheme } from '@/lib/constants/countryTheme';
import { findDestinationByName } from '@/lib/constants/destinations';

import { formatDateRange } from './format';
import type { GroupTripItem } from './types';

type Props = {
  trip: GroupTripItem;
  onPress: (tripId: string) => void;
};

/**
 * 3-2. 모임 상세의 여행 카드. 진행 중 / 지난 여행이 같은 모양을 쓴다.
 *
 * 누르면 해당 여행의 준비 홈(2-2)으로 간다. 진행/지난을 여기서 분기하지 않는다.
 * 도착 화면이 trip.status 로 TRIP-HOME-01 / TRIP-HOME-02 를 가른다. (docs/04_v3 §5)
 *
 * ⚠️ 이동 기준은 반드시 tripId 다. 같은 모임에 같은 여행지 여행이 여러 개 있어도
 *    여행지·일정으로는 구분되지 않는다. trips.id 는 uuid PK 라 절대 겹치지 않는다.
 *
 * ⚠️ 국기·국가코드는 새로 판별하지 않는다. 여행 준비 홈이 쓰는 그대로다.
 *      trips.destination(한글 도시명)
 *        → findDestinationByName()  → Destination.flag · countryKo
 *        → countryTheme(countryKo)  → CountryTheme.code ('JP')
 *    도시명으로 국가를 추론하거나 새 매핑을 만들지 않는다.
 *    (app/trips/[tripId]/index.tsx:285-291 과 같은 경로)
 */
export function GroupTripCard({ trip, onPress }: Props) {
  const destination = trip.destination ?? '여행지 미정';

  // 목록에 없는 목적지(직접 입력)면 undefined 다. 그때는 국기 줄을 그리지 않는다.
  const meta = findDestinationByName(trip.destination);
  const code = meta ? countryTheme(meta.countryKo).code : null;
  // countryTheme 은 모르는 나라에 '--' 를 준다. 그건 보여줄 값이 아니다.
  const hasCountry = meta != null && code != null && code !== '--';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${destination} 여행 홈으로 이동`}
      onPress={() => onPress(trip.tripId)}
      className="rounded-2xl bg-white px-4 py-3.5 active:opacity-90"
      style={{
        shadowColor: '#111827',
        shadowOpacity: 0.05,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
      }}
    >
      {/* 본문 + chevron. items-center 라 chevron 이 카드 높이 기준 가운데 온다. */}
      <View className="flex-row items-center">
        <View className="flex-1 pr-2">
          {/*
            도쿄  🇯🇵 JP — 도시가 먼저다. 국가는 그 도시를 설명하는 보조 정보다.
            ⚠️ '·' 로 잇지 않고 gap 으로 띄운다. 가운뎃점은 둘을 같은 무게로
               읽히게 만든다. 여기서는 위계가 다르다.
            ⚠️ gap-8(32) 이다. 10 일 때는 둘이 한 덩어리로 붙어 보여
               국가가 도시명의 일부처럼 읽혔다.
            ⚠️ 도시명이 shrink, 국가는 shrink-0 이다. 긴 목적지가 와도
               국가·chevron 이 밀려나지 않고 도시명만 말줄임된다.
               gap 은 고정이라 폭이 모자라면 도시명 쪽만 줄어든다.
          */}
          <View className="flex-row items-center gap-8">
            <Text
              numberOfLines={1}
              className="shrink font-black text-pot-ink"
              style={{ fontSize: 15, lineHeight: 21, letterSpacing: -0.4 }}
            >
              {destination}
            </Text>

            {hasCountry ? (
              <Text className="shrink-0" style={{ fontSize: 13, lineHeight: 21 }}>
                {`${meta.flag} `}
                <Text className="font-black text-pot-faint" style={{ fontSize: 11.5 }}>
                  {code}
                </Text>
              </Text>
            ) : null}
          </View>

          <Text className="mt-1 text-pot-mute" style={{ fontSize: 12, lineHeight: 17 }}>
            {formatDateRange(trip.startDate, trip.endDate)}
          </Text>
        </View>

        {/*
          누를 수 있는 줄이라는 표시. 홈의 '지금 챙겨야 할 것' 행과 같은 값이다.
          (components/home/ActionRequiredSection — size 14 · #C3C9D2)
          도시·국가보다 약하게 보이도록 색만 옅게 둔다.
        */}
        <Ionicons name="chevron-forward" size={14} color="#C3C9D2" />
      </View>
    </Pressable>
  );
}
