// TRIP-01 과거 데이터 반영 여부.
//
// 결산이 확정된 과거 여행이 1건 이상일 때만 보여준다. 0 건이면 화면이 이 블록을
// 그리지 않는다. (IA §2-1, REQ-INSIGHT-001)
//
// 개인 여행에도 똑같이 물어본다. 개인은 '본인 1명인 소유 단위'이지 다르게
// 취급하는 대상이 아니다. (docs/README.md §5 #16)
//
// 개인 데이터는 개인에, 모임 데이터는 해당 모임에만 누적한다. 승계는 없다.
//
// ⚠️ 2026-09-01 · 2택 필수 선택 → 기본 ON 토글로 바꿨다. (안 2 · L 승인)
//    토글은 만지지 않고 지나갈 수 있어서, 여기 onChange 만으로는 로그가 남지
//    않는 사용자가 생긴다. 그래서 PAST_DATA_APPLY_SELECTED 는 이 컴포넌트가
//    아니라 화면 파일이 '다음' 시점에 기록한다. 자세한 이유는 owner.tsx 참조.
import { Pressable, Text, View } from 'react-native';

type Props = {
  /** 결산 완료된 과거 여행 수. 근거로 화면에 그대로 보여준다 */
  pastTripCount: number;
  /** 기본값은 true 다. null 은 아직 판정 전이라는 뜻이고 화면에서는 켜진 걸로 본다 */
  value: boolean | null;
  onChange: (applied: boolean) => void;
  disabled?: boolean;
};

export function PastDataChoice({ pastTripCount, value, onChange, disabled = false }: Props) {
  const on = value !== false;

  return (
    <View>
      <View className="flex-row items-center gap-3">
        <Text className="flex-1 text-sm font-bold text-gray-900">
          지난 여행을 예산에 반영
        </Text>

        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: on, disabled }}
          accessibilityLabel="지난 여행 데이터 반영"
          disabled={disabled}
          onPress={() => onChange(!on)}
          className={`h-7 w-[46px] justify-center rounded-full px-[3px] ${
            on ? 'bg-blue-600' : 'bg-gray-300'
          } ${disabled ? 'opacity-40' : ''}`}
        >
          <View className={`h-[21px] w-[21px] rounded-full bg-white ${on ? 'self-end' : 'self-start'}`} />
        </Pressable>
      </View>

      <Text className="mt-2 text-xs leading-5 text-gray-500">
        결산을 마친 여행 {pastTripCount}건의 소비 패턴을 이번 추천에 반영해요.
        {'\n'}
        끄면 여행지 기본 추천으로만 계산해요.
      </Text>
    </View>
  );
}
