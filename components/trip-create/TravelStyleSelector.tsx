// TRIP-02 여행 스타일 선택.
//
// 라벨만으로는 '편하게' 와 '아낌없이' 가 금액으로 얼마나 벌어지는지 알 수 없다.
// TRAVEL_STYLE_DESCRIPTION 을 항상 함께 보여준다. (lib/constants/status.ts)
//
// 이 값이 예산 추천 배수의 기준이 된다. (lib/constants/budgetMultiplier.ts)
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import {
  TRAVEL_STYLE,
  TRAVEL_STYLE_DESCRIPTION,
  TRAVEL_STYLE_LABEL,
  type TravelStyle,
} from '@/lib/constants/status';

const ORDER: TravelStyle[] = [
  TRAVEL_STYLE.BUDGET,
  TRAVEL_STYLE.STANDARD,
  TRAVEL_STYLE.COMFORT,
  TRAVEL_STYLE.LUXURY,
];

type Props = {
  value: TravelStyle | null;
  onChange: (value: TravelStyle) => void;
};

export function TravelStyleSelector({ value, onChange }: Props) {
  return (
    <View className="gap-2">
      {ORDER.map((style) => {
        const selected = value === style;
        return (
          <Pressable
            key={style}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={TRAVEL_STYLE_LABEL[style]}
            onPress={() => onChange(style)}
            className={`flex-row items-center justify-between rounded-xl border px-4 py-3.5 ${
              selected ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white active:bg-gray-50'
            }`}
          >
            <View className="flex-1">
              <Text
                className={`text-base font-semibold ${
                  selected ? 'text-blue-700' : 'text-gray-900'
                }`}
              >
                {TRAVEL_STYLE_LABEL[style]}
              </Text>
              <Text className="mt-0.5 text-xs text-gray-500">
                {TRAVEL_STYLE_DESCRIPTION[style]}
              </Text>
            </View>
            {selected ? <Ionicons name="checkmark-circle" size={20} color="#2563eb" /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}
