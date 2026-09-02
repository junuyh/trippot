// TRIP-02 인원 입력.
// trips.headcount 는 DB CHECK 로 0 이하가 막혀 있다. 화면에서도 1 미만으로 못 내린다.
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

const MIN = 1;
/** 모임 여행이라도 이 이상은 예산 추천의 의미가 흐려진다. 필요하면 조정한다. */
const MAX = 20;

type Props = {
  value: number;
  onChange: (value: number) => void;
  /** 숫자 왼쪽에 붙는 한 줄 설명. 모임 인원에서 자동으로 채웠다는 안내 등 */
  hint?: string;
};

export function HeadcountStepper({ value, onChange, hint }: Props) {
  const canDecrease = value > MIN;
  const canIncrease = value < MAX;

  return (
    <View className="flex-row items-center justify-between rounded-2xl border border-gray-200 px-3.5 py-3">
      <View className="flex-1 pr-3">
        <Text className="text-[13px] font-bold text-gray-900">여행 인원</Text>
        <Text className="mt-1 text-[11px] font-medium text-gray-400">
          {hint ?? '함께 가는 인원을 정해주세요'}
        </Text>
      </View>

      <View className="flex-row items-center gap-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="인원 줄이기"
          accessibilityState={{ disabled: !canDecrease }}
          disabled={!canDecrease}
          onPress={() => onChange(value - 1)}
          className={`h-[34px] w-[34px] items-center justify-center rounded-full border border-gray-200 active:bg-gray-100 ${
            canDecrease ? '' : 'opacity-30'
          }`}
        >
          <Ionicons name="remove" size={18} color="#5c6675" />
        </Pressable>

        <Text className="min-w-[42px] text-center text-base font-black text-gray-900">
          {value}명
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="인원 늘리기"
          accessibilityState={{ disabled: !canIncrease }}
          disabled={!canIncrease}
          onPress={() => onChange(value + 1)}
          className={`h-[34px] w-[34px] items-center justify-center rounded-full border border-gray-200 active:bg-gray-100 ${
            canIncrease ? '' : 'opacity-30'
          }`}
        >
          <Ionicons name="add" size={18} color="#5c6675" />
        </Pressable>
      </View>
    </View>
  );
}
