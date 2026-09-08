import { Ionicons } from '@expo/vector-icons';
import { useRef, type ReactNode } from 'react';
import { Pressable, Text } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import type { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

/** 오른쪽에서 나오는 액션 한 칸의 너비. NotificationList 와 같은 값이다. */
const ACTION_WIDTH = 68;

type Props = {
  /** 액션 버튼에 쓰는 글자. 예: `삭제` `좋아요 취소` */
  label: string;
  /** 스크린리더가 읽을 문장. 예: `제주 3박 4일 삭제` */
  accessibilityLabel: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** 버튼 배경. 되돌릴 수 없는 삭제는 빨강, 되돌릴 수 있는 동작은 회색. */
  color: string;
  onPress: () => void;
  children: ReactNode;
};

/**
 * 왼쪽으로 밀면 오른쪽에서 액션 하나가 나오는 줄.
 *
 * MY 커뮤니티 활동 세 목록(작성한 게시글 · 작성한 댓글 · 좋아요)이 같은
 * 인터랙션을 쓰도록 여기 한 벌만 둔다.
 *
 * ⚠️ 새 라이브러리를 넣지 않는다. NotificationList 가 이미 쓰고 있는
 *    react-native-gesture-handler 의 Swipeable 그대로다.
 *    (expo-router 가 gesture-handler 를 의존으로 갖고 있다)
 *
 * ⚠️ 액션을 누르면 열린 스와이프를 먼저 닫는다. 열어 둔 채로 목록에서 줄을
 *    빼면 다음 줄이 밀린 상태로 그려진다.
 *
 * ⚠️ supabase · track() 을 직접 부르지 않는다. 화면 파일이 부른다. (CLAUDE.md 9장)
 */
export function SwipeToAction({
  label,
  accessibilityLabel,
  icon,
  color,
  onPress,
  children,
}: Props) {
  const ref = useRef<SwipeableMethods | null>(null);

  return (
    <Swipeable
      // ⚠️ ref={ref} 로 직접 넘기지 않는다. Swipeable 의 ref 타입은 클래스
      //    인스턴스라 SwipeableMethods 와 맞지 않는다. 콜백으로 받으면
      //    실제로 오는 값(닫기 메서드를 가진 객체)을 그대로 담을 수 있다.
      //    (components/mypage/NotificationList 가 쓰는 방식과 같다)
      ref={(node) => {
        ref.current = node;
      }}
      overshootRight={false}
      renderRightActions={() => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          onPress={() => {
            ref.current?.close();
            onPress();
          }}
          style={{
            width: ACTION_WIDTH,
            backgroundColor: color,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={icon} size={16} color="#fff" />
          <Text
            numberOfLines={2}
            style={{
              marginTop: 3,
              fontSize: 11,
              fontWeight: '800',
              color: '#fff',
              textAlign: 'center',
            }}
          >
            {label}
          </Text>
        </Pressable>
      )}
    >
      {children}
    </Swipeable>
  );
}
