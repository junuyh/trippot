// TRIP-02 여행지 선택. 12개 목록을 국가별로 묶어 보여주고, 없으면 직접 입력한다.
//
// 자유 텍스트만 받으면 목적지별 물가를 반영할 수 없어 추천이 뭉뚱그려진다.
// 그래서 목록 선택이 기본이다. (docs/README.md §5 #9)
//
// 직접 입력이면 기준 데이터가 없으므로 **지역을 함께 받는다.**
// '다낭' → southeast_asia 같은 문자열 매칭은 하지 않는다. (§5 #12)
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { Input } from '@/components/ui';
import {
  BASELINE_ESTIMATE_NOTICE,
  DESTINATIONS_BY_COUNTRY,
  REGION_LABEL,
  type Destination,
  type DestinationCode,
  type RegionCode,
} from '@/lib/constants/destinations';

type Props = {
  selectedCode: DestinationCode | null;
  isCustom: boolean;
  customName: string;
  customRegion: RegionCode | null;
  onSelectDestination: (destination: Destination) => void;
  onStartCustom: () => void;
  onChangeCustomName: (value: string) => void;
  onSelectRegion: (region: RegionCode) => void;
  /** 직접 입력 목적지명 검증 실패 메시지 */
  customNameError?: string | null;
};

export function DestinationPicker({
  selectedCode,
  isCustom,
  customName,
  customRegion,
  onSelectDestination,
  onStartCustom,
  onChangeCustomName,
  onSelectRegion,
  customNameError = null,
}: Props) {
  return (
    <View className="gap-4">
      {DESTINATIONS_BY_COUNTRY.map((group) => (
        <View key={group.countryKo}>
          <Text className="mb-1.5 text-xs font-semibold text-gray-500">
            {group.countryKo}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {group.destinations.map((destination) => {
              const selected = !isCustom && selectedCode === destination.code;
              return (
                <Pressable
                  key={destination.code}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={destination.nameKo}
                  onPress={() => onSelectDestination(destination)}
                  className={`rounded-full border px-4 py-2.5 ${
                    selected
                      ? 'border-blue-600 bg-blue-600'
                      : 'border-gray-200 bg-white active:bg-gray-50'
                  }`}
                >
                  <Text
                    className={`text-sm ${
                      selected ? 'font-semibold text-white' : 'text-gray-800'
                    }`}
                  >
                    {destination.nameKo}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}

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
              {(Object.keys(REGION_LABEL) as RegionCode[]).map((region) => {
                const selected = customRegion === region;
                return (
                  <Pressable
                    key={region}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={REGION_LABEL[region]}
                    onPress={() => onSelectRegion(region)}
                    className={`rounded-full border px-4 py-2 ${
                      selected
                        ? 'border-blue-600 bg-blue-600'
                        : 'border-gray-200 bg-white active:bg-gray-100'
                    }`}
                  >
                    <Text
                      className={`text-sm ${
                        selected ? 'font-semibold text-white' : 'text-gray-800'
                      }`}
                    >
                      {REGION_LABEL[region]}
                    </Text>
                  </Pressable>
                );
              })}
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
