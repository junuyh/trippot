// 여행 생성 3단계 하단 고정 CTA 바.
//
// components/ui/ 가 아니라 여기 있는 이유는 StepProgress 와 같다.
// 생성 흐름(TRIP-01~03) 전용이다. 다른 화면에서 쓸 일이 생기면 그때 ui/ 로 옮긴다.
// (CLAUDE.md 9장)
//
// 화면은 <View flex-1> 안에 <ScrollView> 와 이 컴포넌트를 형제로 둔다.
// position:absolute 로 띄우지 않는 이유: 본문 위에 겹치면 마지막 입력칸이
// 가려져서 ScrollView 아래쪽에 바 높이만큼 여백을 따로 맞춰 줘야 한다.
// 세로로 쌓으면 그 계산이 필요 없다.
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** 저장 중 중복 제출 방지. Button 이 스피너를 그리고 눌리지 않는다. */
  loading?: boolean;
  /** 버튼 위 보조 문구. 없으면 그리지 않는다. */
  note?: string;
};

export function BottomCta({ label, onPress, disabled = false, loading = false, note }: Props) {
  // 홈 인디케이터가 있는 기기에서 버튼이 인디케이터에 붙지 않게 한다.
  const insets = useSafeAreaInsets();

  return (
    <View
      className="border-t border-gray-200 bg-white px-5 pt-3"
      style={{ paddingBottom: Math.max(insets.bottom, 12) }}
    >
      {note ? (
        <Text className="mb-2.5 text-center text-xs leading-5 text-gray-400">{note}</Text>
      ) : null}

      <Button label={label} onPress={onPress} disabled={disabled} loading={loading} />
    </View>
  );
}
