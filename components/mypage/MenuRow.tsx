import { Pressable, Text, View } from 'react-native';

type Props = {
  label: string;
  onPress: () => void;
  /** 마지막 항목이면 아래 구분선을 그리지 않는다. */
  isLast?: boolean;
};

/**
 * 메뉴 한 줄. 커뮤니티·설정 섹션이 함께 쓴다.
 *
 * ⚠️ chevron 을 넣지 않는다. 확정된 디자인은 chevron 을 반복 배치하지 않고
 *    row + divider 로 이동 가능함을 표현한다. 오른쪽을 다른 아이콘이나
 *    장식으로 대신 채우지도 않는다.
 *
 * ⚠️ chevron 을 뺐다고 터치 영역을 줄이지 않는다. Pressable 이 줄 전체를
 *    덮고 py-3.5 + lineHeight 19 로 높이 47 을 지킨다.
 *
 * 글자 단·구분선 색·press 는 홈의 '지금 챙겨야 할 것' 행과 같다.
 * (components/home/ActionRequiredSection — 구분선 #F1F3F6 · active:bg-pot-visual)
 *
 * ⚠️ 로그아웃은 이 컴포넌트를 쓰지 않는다. navigation 이 아니라 action 이라
 *    같은 줄 모양에 끼워 넣지 않는다.
 */
export function MenuRow({ label, onPress, isLast = false }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="active:bg-pot-visual"
    >
      <View
        className="py-3.5"
        style={isLast ? undefined : { borderBottomWidth: 1, borderBottomColor: '#F1F3F6' }}
      >
        <Text className="text-pot-ink" style={{ fontSize: 13.5, lineHeight: 19 }}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
