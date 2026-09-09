import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';

import { Button } from '@/components/ui';

type Props = {
  visible: boolean;
  title: string;
  /** 한 줄 설명. 없으면 그리지 않는다. */
  description?: string | null;
  /** 확인 버튼 글자. 예: `삭제` `좋아요 취소` */
  confirmLabel: string;
  /**
   * 되돌릴 수 없는 동작인가.
   *
   * true 면 확인 버튼이 빨강이다. 좋아요 취소처럼 다시 누르면 되는 동작은
   * false 로 두어 삭제와 무게를 구분한다.
   */
  destructive?: boolean;
  /** 처리 중. 두 번 눌러 두 번 실행하는 일을 막는다. */
  busy: boolean;
  /** 실패했을 때 창 안에 그대로 보여준다. */
  error?: string | null;
  /**
   * 취소 버튼을 감춘다. 확인 하나만 남는 **안내 전용** 창이 된다.
   *
   * ⚠️ 기본은 false 라 기존 사용처는 그대로 두 버튼이다.
   * ⚠️ Alert.alert 를 쓰지 않는 이유는 위와 같다 — 웹에서 아무 일도 하지 않는다.
   */
  hideCancel?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

/**
 * MY 커뮤니티 활동이 쓰는 확인창.
 *
 * 세 액션(글 삭제 · 댓글 삭제 · 좋아요 취소)이 같은 확인 UX 를 갖도록 둔다.
 * 짜임과 색은 커뮤니티의 PostDeleteConfirmModal 과 같다 — 같은 앱에서 같은
 * 질문이 다르게 생기지 않도록 맞췄다.
 *
 * ⚠️ 글 삭제는 커뮤니티의 PostDeleteConfirmModal 을 그대로 쓴다. 그쪽은
 *    '달린 댓글도 함께 보이지 않게 됩니다' 처럼 글에만 해당하는 문장을 갖고
 *    있어서, 억지로 이 컴포넌트로 합치면 문구를 넘기는 props 만 늘어난다.
 *
 * ⚠️ Alert.alert 를 쓰지 않는다. react-native-web 의 Alert 는 내용이 빈
 *    함수라 웹에서는 눌러도 아무 일이 없다.
 *    (components/community/PostDeleteConfirmModal 에 같은 기록이 있다)
 *
 * ⚠️ supabase · track() 을 직접 부르지 않는다. 화면 파일이 부른다. (CLAUDE.md 9장)
 */
export function ConfirmModal({
  visible,
  title,
  description,
  confirmLabel,
  destructive = false,
  busy,
  error,
  hideCancel = false,
  onCancel,
  onConfirm,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      // 처리 중에는 뒤로 가기로 창을 닫지 않는다. 요청은 이미 나갔다.
      onRequestClose={busy ? () => {} : onCancel}
    >
      <Pressable
        className="flex-1 items-center justify-center bg-black/40 px-8"
        onPress={busy ? undefined : onCancel}
      >
        {/* 안쪽을 눌렀을 때 창이 닫히지 않게 이벤트를 막는다. */}
        <Pressable className="w-full rounded-2xl bg-white p-5" onPress={() => {}}>
          <Text className="text-lg font-bold leading-7 text-pot-ink">{title}</Text>

          {description ? (
            <Text className="mt-2 text-pot-mute" style={{ fontSize: 13, lineHeight: 19 }}>
              {description}
            </Text>
          ) : null}

          {error ? (
            <Text className="mt-3 text-red-500" style={{ fontSize: 12.5, lineHeight: 18 }}>
              {error}
            </Text>
          ) : null}

          <View className="mt-5 flex-row gap-2">
            {hideCancel ? null : (
              <View className="flex-1">
                <Button label="취소" variant="secondary" onPress={onCancel} disabled={busy} />
              </View>
            )}
            <View className="flex-1">
              {destructive ? (
                // 되돌릴 수 없는 동작. 공용 Button 의 danger 대신 글 삭제 확인창과
                // 같은 색(#EF4444)을 써서 두 창이 같아 보이게 한다.
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={confirmLabel}
                  accessibilityState={{ disabled: busy, busy }}
                  disabled={busy}
                  onPress={onConfirm}
                  className="w-full flex-row items-center justify-center rounded-xl px-5 py-3.5 active:opacity-80"
                  style={{ backgroundColor: '#EF4444', opacity: busy ? 0.5 : 1 }}
                >
                  {busy ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text className="text-base font-semibold text-white">{confirmLabel}</Text>
                  )}
                </Pressable>
              ) : (
                <Button label={confirmLabel} loading={busy} onPress={onConfirm} />
              )}
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
