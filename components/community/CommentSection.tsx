import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, TextInput, View } from 'react-native';

import { Avatar } from './Avatar';
import { NO_FOCUS_RING } from './inputStyle';
import type { PostCommentItem } from './types';

type Props = {
  comments: PostCommentItem[];
  draft: string;
  onChangeDraft: (value: string) => void;
  onSubmit: () => void;
  /** 저장 중이면 잠근다. 중복 제출 방지. (CLAUDE.md 9장) */
  submitting: boolean;
  /** 실패했을 때 보여줄 문구. 없으면 null. */
  error: string | null;
  onDelete: (commentId: string) => void;
  /** 지우는 중인 댓글. 그 줄만 잠근다. */
  deletingId: string | null;
  maxLength: number;
};

const NUM = { fontVariant: ['tabular-nums' as const] };

/**
 * COMM-02 상세의 댓글. (2026-09-02 추가)
 *
 * 목록과 입력을 한 덩어리로 둔다. 글 아래에 이어 붙는 자리라
 * 따로 화면을 만들지 않는다.
 *
 * ⚠️ 이벤트 로그는 남기지 않는다. events.ts 에 댓글 이벤트가 없고
 *    상수를 임의로 추가하지 않는다. (CLAUDE.md 8장)
 *
 * 데이터만 props 로 받는다. supabase / track() 을 직접 부르지 않는다.
 */
export function CommentSection({
  comments,
  draft,
  onChangeDraft,
  onSubmit,
  submitting,
  error,
  onDelete,
  deletingId,
  maxLength,
}: Props) {
  const canSubmit = draft.trim().length > 0 && !submitting;

  return (
    <View className="mt-5 border-t border-pot-line px-5 pt-5">
      <Text className="font-bold text-pot-ink" style={{ fontSize: 14, ...NUM }}>
        댓글 {comments.length}
      </Text>

      {comments.length === 0 ? (
        <Text className="mt-3 text-pot-faint" style={{ fontSize: 13 }}>
          첫 댓글을 남겨보세요.
        </Text>
      ) : (
        <View className="mt-3 gap-3.5">
          {comments.map((comment) => (
            <View key={comment.commentId} className="flex-row">
              <Avatar imageUrl={comment.authorImageUrl} size={32} />

              <View className="ml-2.5 flex-1">
                <View className="flex-row items-center">
                  <Text className="font-bold text-pot-ink" style={{ fontSize: 13 }} numberOfLines={1}>
                    {comment.authorName ?? '알 수 없음'}
                  </Text>
                  <Text className="ml-2 text-pot-faint" style={{ fontSize: 11.5 }}>
                    {comment.createdLabel}
                  </Text>

                  {comment.mine ? (
                    <>
                      <View className="flex-1" />
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="내 댓글 지우기"
                        disabled={deletingId === comment.commentId}
                        onPress={() => onDelete(comment.commentId)}
                        hitSlop={8}
                        className="active:opacity-60"
                        style={{ opacity: deletingId === comment.commentId ? 0.4 : 1 }}
                      >
                        <Ionicons name="trash-outline" size={14} color="#9AA3AE" />
                      </Pressable>
                    </>
                  ) : null}
                </View>

                <Text className="mt-0.5 text-pot-ink" style={{ fontSize: 13.5, lineHeight: 19 }}>
                  {comment.content}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* 입력 */}
      <View className="mt-5 flex-row items-end">
        <TextInput
          value={draft}
          onChangeText={onChangeDraft}
          editable={!submitting}
          placeholder="댓글을 남겨보세요"
          placeholderTextColor="#9AA3AE"
          multiline
          maxLength={maxLength}
          className="flex-1 rounded-2xl bg-pot-visual px-4 py-3 text-pot-ink"
          style={{ fontSize: 13.5, lineHeight: 19, maxHeight: 110, ...NO_FOCUS_RING }}
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="댓글 등록"
          accessibilityState={{ disabled: !canSubmit, busy: submitting }}
          disabled={!canSubmit}
          onPress={onSubmit}
          className="ml-2 rounded-full bg-brand px-4 py-3 active:bg-brand-pressed"
          style={{ opacity: canSubmit ? 1 : 0.35 }}
        >
          <Text className="font-bold text-white" style={{ fontSize: 13 }}>
            등록
          </Text>
        </Pressable>
      </View>

      <View className="mt-1.5 flex-row justify-between">
        <Text className="text-red-500" style={{ fontSize: 12 }}>
          {error ?? ''}
        </Text>
        <Text className="text-pot-faint" style={{ fontSize: 12, ...NUM }}>
          {draft.length}/{maxLength}
        </Text>
      </View>
    </View>
  );
}
