import { Ionicons } from '@expo/vector-icons';
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
 * 오른쪽 끝에 chevron 을 둔다. (2026-09-13)
 *    같은 화면의 '내 여행' 카드, 개인 여행 상세의 '전체 계좌', 모임 상세의
 *    섹션 제목이 전부 chevron(13 · #C3C9D2)으로 "누르면 이동" 을 말한다.
 *    이 줄만 아무 표시가 없으면 눌리는지 아닌지가 다른 화면과 어긋난다.
 *    아이콘은 글자보다 약하게(faint 보다 옅은 #C3C9D2) 둔다.
 *
 * ⚠️ 터치 영역은 줄 전체다. Pressable 이 줄을 덮고 py-3.5 + lineHeight 19 로
 *    높이 47 을 지킨다.
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
        className="flex-row items-center py-4"
        style={isLast ? undefined : { borderBottomWidth: 1, borderBottomColor: '#E5E8EC' }}
      >
        <Text
          numberOfLines={1}
          className="flex-1 text-pot-ink"
          style={{ fontSize: 13.5, lineHeight: 19 }}
        >
          {label}
        </Text>
        <Ionicons name="chevron-forward" size={14} color="#B6BCC6" />
      </View>
    </Pressable>
  );
}
