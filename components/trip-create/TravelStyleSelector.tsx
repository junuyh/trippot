// 여행 스타일 선택. 3단계 세그먼트.
//
// 라벨만으로는 단계 사이의 차이를 알 수 없어서
// TRAVEL_STYLE_DESCRIPTION 을 고른 단계 아래에 항상 함께 보여준다.
// (lib/constants/status.ts)
//
// ⚠️ 2026-09-01 · 카드 4개 → 세그먼트 3개로 바꿨다. (HTML 디자인 반영, L 승인)
//    빠진 값은 luxury 다. 이유는 status.ts 의 TRAVEL_STYLE_LABEL 주석 참조.
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
];

type Props = {
  value: TravelStyle | null;
  onChange: (value: TravelStyle) => void;
  disabled?: boolean;
};

export function TravelStyleSelector({ value, onChange, disabled = false }: Props) {
  return (
    <View>
      <View
        className={`flex-row gap-1.5 rounded-2xl bg-gray-100 p-1.5 ${
          disabled ? 'opacity-40' : ''
        }`}
      >
        {ORDER.map((style) => {
          const selected = value === style;
          return (
            <Pressable
              key={style}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled }}
              accessibilityLabel={TRAVEL_STYLE_LABEL[style]}
              disabled={disabled}
              onPress={() => onChange(style)}
              className={`flex-1 items-center justify-center rounded-xl py-2.5 ${
                selected ? 'bg-white' : ''
              }`}
            >
              <Text
                className={`text-xs font-bold ${selected ? 'text-blue-600' : 'text-gray-500'}`}
              >
                {TRAVEL_STYLE_LABEL[style]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/*
        고르기 전에도 자리를 비워 두지 않는다. 아래 내용이 위아래로 밀리면
        무엇 때문에 움직였는지 알기 어렵다.
      */}
      <Text className="mt-2.5 text-[11px] leading-4 text-gray-500">
        {value ? (
          <>
            <Text className="font-bold text-blue-600">{TRAVEL_STYLE_LABEL[value]}</Text>
            <Text> · {TRAVEL_STYLE_DESCRIPTION[value]}</Text>
          </>
        ) : (
          '어느 쪽에 가까운지 골라주세요. 숙소와 식사 수준으로 추천 금액이 달라져요.'
        )}
      </Text>
    </View>
  );
}
