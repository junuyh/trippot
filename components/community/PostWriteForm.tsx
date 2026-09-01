import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/ui';

type TypeOption = { value: string; label: string };

type Props = {
  typeOptions: TypeOption[];
  postType: string;
  onChangeType: (value: string) => void;

  title: string;
  onChangeTitle: (value: string) => void;

  content: string;
  onChangeContent: (value: string) => void;

  /** 필드별 오류. 없으면 null. */
  titleError: string | null;
  contentError: string | null;
  /** 저장 실패 같은 화면 전체 오류. */
  submitError: string | null;

  /** 저장 중이면 버튼이 잠기고 스피너가 뜬다. (중복 제출 방지) */
  submitting: boolean;
  onSubmit: () => void;
};

/**
 * COMM-04 게시글 / 팁 작성 폼. (docs/09_IA_v1.md §4-5)
 *
 * ⚠️ 유료 팁은 유형 선택지에 없다. 2026-08-31 팀 결정으로 유료 기능을 뺐다.
 * ⚠️ '여행 유형 공유'(TYPE_SHARE)도 없다. 그 글은 여행 유형 결과(TYPE-01)에서
 *    나와야 하는데 그 화면이 고도화이고 유형 목록도 미확정이다.
 * ⚠️ 임시저장(DRAFT)은 두지 않았다. 화면 목록에 없는 기능이다.
 *
 * 데이터만 props 로 받는다. supabase / track() 을 직접 부르지 않는다. (CLAUDE.md 9장)
 */
export function PostWriteForm({
  typeOptions,
  postType,
  onChangeType,
  title,
  onChangeTitle,
  content,
  onChangeContent,
  titleError,
  contentError,
  submitError,
  submitting,
  onSubmit,
}: Props) {
  return (
    <ScrollView
      className="flex-1 bg-pot-visual"
      contentContainerClassName="px-5 pb-12 pt-5"
      keyboardShouldPersistTaps="handled"
    >
      {/* 유형 */}
      <Text className="mb-2 font-bold text-pot-ink" style={{ fontSize: 13 }}>
        어떤 글인가요
      </Text>
      <View className="flex-row gap-2">
        {typeOptions.map((option) => {
          const active = option.value === postType;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              disabled={submitting}
              onPress={() => onChangeType(option.value)}
              className={`rounded-full px-4 py-2.5 ${active ? 'bg-pot-ink' : 'bg-white'}`}
            >
              <Text
                className={`font-bold ${active ? 'text-white' : 'text-pot-mute'}`}
                style={{ fontSize: 13 }}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* 제목 */}
      <Text className="mb-2 mt-6 font-bold text-pot-ink" style={{ fontSize: 13 }}>
        제목 <Text className="text-pot-faint">*</Text>
      </Text>
      <TextInput
        value={title}
        onChangeText={onChangeTitle}
        editable={!submitting}
        placeholder="어떤 이야기인지 한 줄로 적어주세요"
        placeholderTextColor="#9AA3AE"
        maxLength={80}
        className={`rounded-xl bg-white px-4 py-3.5 text-pot-ink ${titleError ? 'border border-red-400' : ''}`}
        style={{ fontSize: 15 }}
      />
      <View className="mt-1.5 flex-row justify-between">
        <Text className="text-red-500" style={{ fontSize: 12 }}>
          {titleError ?? ''}
        </Text>
        <Text className="text-pot-faint" style={{ fontSize: 12 }}>
          {title.length}/80
        </Text>
      </View>

      {/* 내용 */}
      <Text className="mb-2 mt-4 font-bold text-pot-ink" style={{ fontSize: 13 }}>
        내용 <Text className="text-pot-faint">*</Text>
      </Text>
      <TextInput
        value={content}
        onChangeText={onChangeContent}
        editable={!submitting}
        placeholder={'다녀온 여행에서 알게 된 걸 적어주세요.\n금액이나 실제 경험이 있으면 더 도움이 돼요.'}
        placeholderTextColor="#9AA3AE"
        multiline
        textAlignVertical="top"
        maxLength={2000}
        className={`rounded-xl bg-white px-4 py-3.5 text-pot-ink ${contentError ? 'border border-red-400' : ''}`}
        style={{ fontSize: 15, lineHeight: 23, minHeight: 200 }}
      />
      <View className="mt-1.5 flex-row justify-between">
        <Text className="text-red-500" style={{ fontSize: 12 }}>
          {contentError ?? ''}
        </Text>
        <Text className="text-pot-faint" style={{ fontSize: 12 }}>
          {content.length}/2000
        </Text>
      </View>

      {submitError ? (
        <Text className="mt-4 text-center text-red-500" style={{ fontSize: 13 }}>
          {submitError}
        </Text>
      ) : null}

      <View className="mt-7">
        <Button label="게시하기" loading={submitting} onPress={onSubmit} />
      </View>
    </ScrollView>
  );
}
