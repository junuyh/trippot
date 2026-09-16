// TRIP-01 동행 유형 선택. 개인 / 기존 모임 / 신규 모임.
//
// 선택한 카드가 그 자리에서 펼쳐지고 안에서 이어서 입력한다.
// 카드 아래 별도 영역으로 내리면 무엇에 딸린 입력인지가 흐려진다.
//
// 펼쳐질 내용은 이 컴포넌트가 만들지 않는다. 화면 파일이 만들어 bodies 로 넘긴다.
// UI 컴포넌트는 supabase 와 track() 을 부르지 않는다. (CLAUDE.md 9장)
import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
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
    description: '모임 이름만 정하면 돼요',
    icon: 'add-circle-outline',
  },
];

type Props = {
  value: CompanionType | null;
  onChange: (value: CompanionType) => void;
  /**
   * 선택된 카드 안에 펼쳐 보일 내용.
   * 고른 항목의 것만 그린다. 넘기지 않은 항목은 머리만 있고 펼쳐지지 않는다.
   */
  bodies?: Partial<Record<CompanionType, ReactNode>>;
  /** 저장 중에는 선택을 막는다. */
  disabled?: boolean;
};

export function OwnerTypeSelector({ value, onChange, bodies, disabled = false }: Props) {
  return (
    <View className="gap-2.5">
      {OPTIONS.map((option) => {
        const selected = value === option.value;
        const body = selected ? bodies?.[option.value] : null;

        return (
          <View
            key={option.value}
            className={`overflow-hidden rounded-2xl ${
              selected ? 'border-2 border-blue-600' : 'border border-gray-200'
            } ${disabled ? 'opacity-40' : ''}`}
          >
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled }}
              accessibilityLabel={option.label}
              disabled={disabled}
              onPress={() => onChange(option.value)}
              className={`flex-row items-center gap-3 px-4 py-3.5 ${
                selected ? 'bg-blue-50' : 'bg-white active:bg-gray-50'
              }`}
            >
              <View
                className={`h-10 w-10 items-center justify-center rounded-full ${
                  selected ? 'bg-blue-600' : 'bg-gray-100'
                }`}
              >
                <Ionicons name={option.icon} size={20} color={selected ? '#ffffff' : '#96a0ae'} />
              </View>

              <View className="flex-1">
                <Text
                  className={`text-[15px] font-bold ${selected ? 'text-blue-700' : 'text-gray-900'}`}
                >
                  {option.label}
                </Text>
                <Text className="mt-0.5 text-xs text-gray-500">{option.description}</Text>
              </View>

              {selected ? <Ionicons name="checkmark-circle" size={22} color="#2563eb" /> : null}
            </Pressable>

            {body ? (
              <View className="border-t border-blue-100 bg-white p-4">{body}</View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
