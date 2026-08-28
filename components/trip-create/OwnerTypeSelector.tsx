// TRIP-01 동행 유형 선택. 개인 / 기존 모임 / 신규 모임.
//
// UI 만 담당한다. supabase 와 track() 을 부르지 않는다. (CLAUDE.md 9장)
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { COMPANION_TYPE, type CompanionType } from '@/lib/constants/status';

const OPTIONS: {
  value: CompanionType;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    value: COMPANION_TYPE.PERSONAL,
    label: '혼자 가요',
    description: '나만의 여행을 계획해요',
    icon: 'person-outline',
  },
  {
    value: COMPANION_TYPE.EXISTING_GROUP,
    label: '기존 모임과 가요',
    description: '함께 여행했던 모임을 불러와요',
    icon: 'people-outline',
  },
  {
    value: COMPANION_TYPE.NEW_GROUP,
    label: '새 모임을 만들어요',
    description: '모임 이름과 함께 갈 사람을 정해요',
    icon: 'add-circle-outline',
  },
];

type Props = {
  value: CompanionType | null;
  onChange: (value: CompanionType) => void;
  /** 저장 중에는 선택을 막는다. */
  disabled?: boolean;
};

export function OwnerTypeSelector({ value, onChange, disabled = false }: Props) {
  return (
    <View className="gap-3">
      {OPTIONS.map((option) => {
        const selected = value === option.value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled }}
            accessibilityLabel={option.label}
            disabled={disabled}
            onPress={() => onChange(option.value)}
            className={`flex-row items-center gap-3 rounded-2xl border px-4 py-4 ${
              selected ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white active:bg-gray-50'
            } ${disabled ? 'opacity-40' : ''}`}
          >
            <View
              className={`h-10 w-10 items-center justify-center rounded-full ${
                selected ? 'bg-blue-600' : 'bg-gray-100'
              }`}
            >
              <Ionicons name={option.icon} size={20} color={selected ? '#ffffff' : '#6b7280'} />
            </View>

            <View className="flex-1">
              <Text
                className={`text-base font-semibold ${selected ? 'text-blue-700' : 'text-gray-900'}`}
              >
                {option.label}
              </Text>
              <Text className="mt-0.5 text-xs text-gray-500">{option.description}</Text>
            </View>

            {selected ? <Ionicons name="checkmark-circle" size={22} color="#2563eb" /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}
