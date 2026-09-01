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
//      · 결과가 없을 때 막다른 길로 두지 않고 직접 입력으로 바로 잇는다.
//
// 직접 입력이면 기준 데이터가 없으므로 **지역을 함께 받는다.**
// '다낭' → southeast_asia 같은 문자열 매칭은 하지 않는다. (docs/README.md §5 #12)
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { Input } from '@/components/ui';
import {
  BASELINE_ESTIMATE_NOTICE,
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

  isCustom: boolean;
  customName: string;
  customRegion: RegionCode | null;
  onSelectDestination: (destination: Destination) => void;
  onStartCustom: () => void;
  onChangeCustomName: (value: string) => void;
  onBlurCustomName: () => void;
  onSelectRegion: (region: RegionCode) => void;
  customNameError?: string | null;
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
        selected ? 'border-blue-600 bg-blue-600' : 'border-gray-200 bg-white active:bg-gray-50'
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
      {/* 홍콩처럼 라벨이 없는 줄은 칸을 비워 두지 않는다. 도시가 왼쪽부터 시작한다. */}
      {showLabel ? (
        <View className="w-[74px] flex-row items-center gap-1 pt-2.5">
          <Text className="text-sm">{destinations[0].flag}</Text>
          <Text className="text-xs font-bold text-gray-500">{countryKo}</Text>
        </View>
      ) : null}
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
  isCustom,
  customName,
  customRegion,
  onSelectDestination,
  onStartCustom,
  onChangeCustomName,
  onBlurCustomName,
  onSelectRegion,
  customNameError = null,
}: Props) {
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
          placeholder="도시 이름으로 찾기"
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
            selected={!isCustom && !trimmedQuery && openRegion === region}
            onPress={() => {
              setQuery('');
              onOpenRegion(region);
            }}
          />
        ))}
      </ScrollView>

      {/* ── 도시 ── */}
      {!isCustom && (trimmedQuery || openRegion) ? (
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
            // 막다른 길로 두지 않는다. 검색해서 못 찾은 사람이 갈 곳은 직접 입력이다.
            <View className="items-center gap-3 px-4 py-7">
              <Text className="text-center text-xs leading-5 text-gray-400">
                &lsquo;{trimmedQuery}&rsquo; 는 목록에 없어요.{'\n'}
                직접 입력하면 지역 평균으로 추천해 드려요.
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="직접 입력하기"
                onPress={() => {
                  setQuery('');
                  onStartCustom();
                }}
                className="rounded-xl bg-gray-100 px-4 py-2.5 active:bg-gray-200"
              >
                <Text className="text-[13px] font-bold text-gray-700">직접 입력하기</Text>
              </Pressable>
            </View>
          )}
        </View>
      ) : null}

      {/* ── 직접 입력 ── */}
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ selected: isCustom }}
        accessibilityLabel="찾는 곳이 없나요? 직접 입력"
        onPress={onStartCustom}
        className={`flex-row items-center gap-2 rounded-xl border px-4 py-3 ${
          isCustom ? 'border-blue-600 bg-blue-50' : 'border-dashed border-gray-300 active:bg-gray-50'
        }`}
      >
        <Ionicons
          name={isCustom ? 'checkmark-circle' : 'add'}
          size={18}
          color={isCustom ? '#2563eb' : '#6b7280'}
        />
        <Text className={`text-sm ${isCustom ? 'font-semibold text-blue-700' : 'text-gray-600'}`}>
          찾는 곳이 없나요? 직접 입력
        </Text>
      </Pressable>

      {isCustom ? (
        <View className="gap-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <Input
            label="여행지"
            required
            value={customName}
            onChangeText={onChangeCustomName}
            onBlur={onBlurCustomName}
            placeholder="예: 다낭"
            error={customNameError}
            maxLength={20}
            returnKeyType="done"
          />

          <View>
            <Text className="mb-1.5 text-sm font-medium text-gray-700">
              어느 지역인가요? <Text className="text-red-500">*</Text>
            </Text>
            <Text className="mb-2 text-xs text-gray-400">
              지역을 알아야 평균 물가로 예산을 추천할 수 있어요.
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {REGIONS.map((region) => (
                <Chip
                  key={region}
                  label={REGION_LABEL[region]}
                  selected={customRegion === region}
                  onPress={() => onSelectRegion(region)}
                />
              ))}
            </View>
          </View>

          {/* NFR-004 — 추천이 추정치임을 화면에 표시한다 */}
          <View className="flex-row items-start gap-1.5 rounded-xl bg-amber-50 px-3 py-2.5">
            <Ionicons name="information-circle-outline" size={16} color="#d97706" />
            <Text className="flex-1 text-xs leading-4 text-amber-700">
              {BASELINE_ESTIMATE_NOTICE}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}
