// TRIP-01 과거 데이터 반영 여부.
//
// 결산이 확정된 과거 여행이 1건 이상일 때만 보여준다. 0 건이면 화면이 이 블록을
// 그리지 않는다. (IA §2-1, REQ-INSIGHT-001)
//
// 개인 여행에도 똑같이 물어본다. 개인은 '본인 1명인 소유 단위'이지 다르게
// 취급하는 대상이 아니다. (docs/README.md §5 #16)
//
// 개인 데이터는 개인에, 모임 데이터는 해당 모임에만 누적한다. 승계는 없다.
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

type Props = {
  /** 결산 완료된 과거 여행 수. 근거로 화면에 그대로 보여준다 */
  pastTripCount: number;
  /** null 이면 아직 고르지 않은 상태 */
  value: boolean | null;
  onChange: (applied: boolean) => void;
  disabled?: boolean;
};

const CHOICES: { value: boolean; label: string; description: string }[] = [
  {
    value: true,
    label: '반영할래요',
    description: '지난 여행의 소비 패턴을 예산 추천에 씁니다',
  },
  {
    value: false,
    label: '이번엔 빼주세요',
    description: '기본 추천으로만 계산합니다',
  },
];

export function PastDataChoice({ pastTripCount, value, onChange, disabled = false }: Props) {
  return (
    <View className="gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
      <View className="flex-row items-start gap-2">
        <Ionicons name="bulb-outline" size={18} color="#2563eb" />
        <View className="flex-1">
          <Text className="text-sm font-semibold text-gray-900">
            지난 여행 데이터를 반영할까요?
          </Text>
          <Text className="mt-0.5 text-xs text-gray-500">
            결산을 마친 여행 {pastTripCount}건이 있어요.
          </Text>
        </View>
      </View>

      <View className="flex-row gap-2">
        {CHOICES.map((choice) => {
          const selected = value === choice.value;
          return (
            <Pressable
              key={String(choice.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled }}
              accessibilityLabel={choice.label}
              disabled={disabled}
              onPress={() => onChange(choice.value)}
              className={`flex-1 rounded-xl border px-3 py-3 ${
                selected
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 bg-white active:bg-gray-100'
              } ${disabled ? 'opacity-40' : ''}`}
            >
              <Text
                className={`text-sm font-semibold ${selected ? 'text-blue-700' : 'text-gray-800'}`}
              >
                {choice.label}
              </Text>
              <Text className="mt-0.5 text-xs leading-4 text-gray-500">{choice.description}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
