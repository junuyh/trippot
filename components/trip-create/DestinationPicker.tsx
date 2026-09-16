// TRIP-02 여행지 선택. 지역을 고르면 그 지역의 도시만 펼쳐진다.
//
// 12개를 국가별로 한 번에 늘어놓으면 목적지 하나에 화면 10줄을 쓴다.
// 지역(3) → 도시(최대 5) 두 단계로 줄이면 2줄이면 된다.
//
// ⚠️ 대륙 → 나라 → 도시 3단계는 쓰지 않는다. 12개에 탭 세 번은 과하다.
//    나라는 도시 줄의 **왼쪽 라벨**로만 쓴다. 단계를 늘리지 않는다.
//
// ⚠️ 2026-09-01 · 검색창을 추가했다. (HTML 디자인 반영)
//    원래는 "검색창으로 받지 않는다" 였다. 12개뿐이라 목록에 무엇이 있는지 모른 채
//    검색하다 못 찾고 직접 입력으로 새면 기준 데이터를 못 쓰기 때문이었다.
//    그래서 검색을 **목록을 걷어내지 않는 방식**으로 넣었다.
//      · 검색어가 없으면 지역 칩 + 도시 목록이 그대로 보인다. 검색은 곁다리다.
//
// ⚠️ 2026-09-01 · '찾는 곳이 없나요? 직접 입력' 을 뺐다. **MVP 범위에서 제외한다.**
//    목록에 있는 12개만 고를 수 있다. 기준 데이터가 있는 목적지만 다루면
//    추천 금액이 항상 근거를 갖는다.
//    지역 평균으로 추천하는 경로(BASELINE_ESTIMATE_NOTICE, isCustomDestination,
//    지역 직접 선택)는 draft 와 계산 쪽에 그대로 남아 있다. UI 만 걷어냈다.
//    되돌릴 때는 이 커밋을 참고한다.
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { useDeferredPlaceholder } from '@/lib/hooks/useDeferredPlaceholder';

import {
  DESTINATIONS,
  REGION_LABEL,
  type Destination,
  type DestinationCode,
  type RegionCode,
} from '@/lib/constants/destinations';

const REGIONS = Object.keys(REGION_LABEL) as RegionCode[];

type Props = {
  selectedCode: DestinationCode | null;
  /** 펼쳐 놓을 지역. 아직 안 고르면 null */
  openRegion: RegionCode | null;
  onOpenRegion: (region: RegionCode) => void;

  onSelectDestination: (destination: Destination) => void;
};

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      className={`rounded-full border px-4 py-2.5 ${
        selected ? 'border-brand bg-brand' : 'border-gray-200 bg-white active:bg-gray-50'
      }`}
    >
      <Text className={`text-[13px] font-bold ${selected ? 'text-white' : 'text-gray-600'}`}>
        {label}
      </Text>
    </Pressable>
  );
}

/** 국가 하나 = 한 줄. 라벨은 왼쪽에 고정폭으로 둔다. */
function CountryRow({
  countryKo,
  destinations,
  selectedCode,
  onSelectDestination,
  isFirst,
}: {
  countryKo: string;
  destinations: Destination[];
  selectedCode: DestinationCode | null;
  onSelectDestination: (destination: Destination) => void;
  isFirst: boolean;
}) {
  // 홍콩처럼 나라 이름과 도시 이름이 같으면 라벨이 군더더기다.
  const showLabel = !(destinations.length === 1 && destinations[0].nameKo === countryKo);

  return (
    <View
      className={`flex-row items-start gap-1.5 px-2.5 py-2.5 ${
        isFirst ? '' : 'border-t border-gray-100'
      }`}
    >
      {/*
        홍콩처럼 나라 이름과 도시 이름이 같으면 라벨을 그리지 않는다.
        다만 칸은 비워 둔다. 라벨이 없다고 칸까지 없애면 그 줄의 도시만 왼쪽으로
        튀어나와, 세로로 훑을 때 다른 도시들과 줄이 맞지 않는다.
      */}
      <View className="w-[74px] flex-row items-center gap-1 pt-2.5">
        {showLabel ? (
          <>
            <Text className="text-sm">{destinations[0].flag}</Text>
            <Text className="text-xs font-bold text-gray-500">{countryKo}</Text>
          </>
        ) : null}
      </View>
      <View className="flex-1 flex-row flex-wrap gap-1.5">
        {destinations.map((destination) => (
          <Chip
            key={destination.code}
            label={destination.nameKo}
            selected={selectedCode === destination.code}
            onPress={() => onSelectDestination(destination)}
          />
        ))}
      </View>
    </View>
  );
}

export function DestinationPicker({
  selectedCode,
  openRegion,
  onOpenRegion,
  onSelectDestination,
}: Props) {
  // ⚠️ 첫 그림에서 플레이스홀더가 번진다. 한 틱 뒤에 넣어 다시 그리게 한다.
  const deferredPlaceholder = useDeferredPlaceholder('도시 이름으로 찾기');
  // 검색어는 화면에 올리지 않는다. 저장되지도 기록되지도 않는 표시용 상태다.
  const [query, setQuery] = useState('');
  const trimmedQuery = query.trim();

  // 검색 중에는 지역을 무시하고 12개 전체에서 찾는다.
  // 지역 안에서만 찾으면 '파리' 를 쳤는데 아시아가 열려 있어서 안 나오는 일이 생긴다.
  const countryGroups = useMemo(() => {
    const groups: { countryKo: string; destinations: Destination[] }[] = [];

    for (const destination of DESTINATIONS) {
      if (trimmedQuery) {
        // 나라 이름이 걸리면 그 나라 도시를 전부 보여준다. (HTML 과 같은 규칙)
        const hit =
          destination.countryKo.includes(trimmedQuery) ||
          destination.nameKo.includes(trimmedQuery);
        if (!hit) continue;
      } else if (destination.region !== openRegion) {
        continue;
      }

      const group = groups.find((g) => g.countryKo === destination.countryKo);
      if (group) group.destinations.push(destination);
      else groups.push({ countryKo: destination.countryKo, destinations: [destination] });
    }

    return groups;
  }, [openRegion, trimmedQuery]);

  return (
    <View className="gap-3">
      {/* ── 검색 ── */}
      <View className="justify-center">
        <View className="absolute left-3.5 z-10">
          <Ionicons name="search" size={17} color="#9aa4b2" />
        </View>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={deferredPlaceholder}
          placeholderTextColor="#9ca3af"
          autoCorrect={false}
          accessibilityLabel="여행지 검색"
          className="h-12 rounded-xl border border-gray-200 bg-white pl-10 pr-10 text-sm text-gray-900"
        />
        {trimmedQuery ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="검색어 지우기"
            onPress={() => setQuery('')}
            className="absolute right-2 h-8 w-8 items-center justify-center rounded-full active:bg-gray-100"
          >
            <Ionicons name="close-circle" size={17} color="#9aa4b2" />
          </Pressable>
        ) : null}
      </View>

      {/* ── 지역 ── 검색 중에는 무엇도 선택된 상태로 두지 않는다 ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="-mx-5"
        contentContainerClassName="gap-1.5 px-5"
      >
        {REGIONS.map((region) => (
          <Chip
            key={region}
            label={REGION_LABEL[region]}
            selected={!trimmedQuery && openRegion === region}
            onPress={() => {
              setQuery('');
              onOpenRegion(region);
            }}
          />
        ))}
      </ScrollView>

      {/* ── 도시 ── */}
      {trimmedQuery || openRegion ? (
        <View className="rounded-2xl border border-gray-200 bg-white py-1">
          {countryGroups.length > 0 ? (
            countryGroups.map((group, index) => (
              <CountryRow
                key={group.countryKo}
                countryKo={group.countryKo}
                destinations={group.destinations}
                selectedCode={selectedCode}
                onSelectDestination={onSelectDestination}
                isFirst={index === 0}
              />
            ))
          ) : (
            <View className="items-center gap-2 px-4 py-7">
              <Text className="text-center text-xs leading-5 text-gray-400">
                &lsquo;{trimmedQuery}&rsquo; 는 목록에 없어요.{'\n'}
                위 지역에서 골라보시겠어요?
              </Text>
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}
