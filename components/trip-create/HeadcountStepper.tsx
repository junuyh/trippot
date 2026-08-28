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
  /** 모임 동행자 수에서 계산한 기본값임을 알릴 때 쓴다 */
  hint?: string;
};

export function HeadcountStepper({ value, onChange, hint }: Props) {
  const canDecrease = value > MIN;
  const canIncrease = value < MAX;

  return (
    <View>
      <View className="flex-row items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-2.5">
        <Text className="text-base text-gray-800">{value}명</Text>

        <View className="flex-row items-center gap-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="인원 줄이기"
            accessibilityState={{ disabled: !canDecrease }}
            disabled={!canDecrease}
            onPress={() => onChange(value - 1)}
            className={`h-10 w-10 items-center justify-center rounded-full bg-gray-100 active:bg-gray-200 ${
              canDecrease ? '' : 'opacity-30'
            }`}
          >
            <Ionicons name="remove" size={20} color="#374151" />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="인원 늘리기"
            accessibilityState={{ disabled: !canIncrease }}
            disabled={!canIncrease}
            onPress={() => onChange(value + 1)}
            className={`h-10 w-10 items-center justify-center rounded-full bg-gray-100 active:bg-gray-200 ${
              canIncrease ? '' : 'opacity-30'
            }`}
          >
            <Ionicons name="add" size={20} color="#374151" />
          </Pressable>
        </View>
      </View>

      {hint ? <Text className="mt-1.5 text-xs text-gray-400">{hint}</Text> : null}
    </View>
  );
}
