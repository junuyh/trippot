// TRIP-02 여행지 선택. 지역을 고르면 그 지역의 도시만 펼쳐진다.
//
// 12개를 국가별로 한 번에 늘어놓으면 목적지 하나에 화면 10줄을 쓴다.
// 지역(4) → 도시(최대 5) 두 단계로 줄이면 2줄이면 된다.
//
// ⚠️ 검색창으로 받지 않는다. 12개뿐이라 사용자가 목록에 무엇이 있는지 모른 채
//    검색을 하게 되고, 있는 목적지를 못 찾아 직접 입력으로 새면 기준 데이터를
//    쓰지 못한다. 목록에 있는 곳으로 유도해야 추천이 정확해진다.
//
// ⚠️ 대륙 → 나라 → 도시 3단계도 쓰지 않는다. 12개에 탭 세 번은 과하다.
//
// 직접 입력이면 기준 데이터가 없으므로 **지역을 함께 받는다.**
// '다낭' → southeast_asia 같은 문자열 매칭은 하지 않는다. (docs/README.md §5 #12)
import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

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
      <Text className={`text-sm ${selected ? 'font-semibold text-white' : 'text-gray-800'}`}>
        {label}
      </Text>
    </Pressable>
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
  // 국가로 한 번 더 묶지 않는다. 아시아는 4개국에 6개 도시가 걸쳐 있어
  // 국가 라벨을 붙이면 줄 수가 다시 늘어난다. 12개 다 알 만한 도시라
  // 도시명만으로 충분하다.
  const cities = useMemo(
    () => (openRegion ? DESTINATIONS.filter((d) => d.region === openRegion) : []),
    [openRegion],
  );

  return (
    <View className="gap-3">
      {/* ── 1단계: 지역 ── */}
      <View className="flex-row flex-wrap gap-2">
        {REGIONS.map((region) => (
          <Chip
            key={region}
            label={REGION_LABEL[region]}
            selected={!isCustom && openRegion === region}
            onPress={() => onOpenRegion(region)}
          />
        ))}
      </View>

      {/* ── 2단계: 도시 ── */}
      {!isCustom && openRegion ? (
        <View className="flex-row flex-wrap gap-2 rounded-2xl border border-gray-100 bg-gray-50 p-3">
          {cities.map((destination) => (
            <Chip
              key={destination.code}
              label={destination.nameKo}
              selected={selectedCode === destination.code}
              onPress={() => onSelectDestination(destination)}
            />
          ))}
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
          name={isCustom ? 'checkmark-circle' : 'search-outline'}
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
