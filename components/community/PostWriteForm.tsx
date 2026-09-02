import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { NO_FOCUS_RING } from './inputStyle';

// ⚠️ components/ui/Button 을 쓰지 않는다. 공용 Button 의 primary 가 bg-blue-600 이고
//    그 파일은 [공유] 라 고치면 25개 화면 버튼이 전부 바뀐다.
//    버튼 검은색 통일이 팀 전체로 확정되면 공용 Button 을 고치고 이 버튼을 지운다.
//    (components/home/HomeButton.tsx 도 같은 이유로 따로 있다)

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

  /** 고른 사진들의 기기 내 경로. */
  imageUris: string[];
  maxImages: number;
  imageError: string | null;
  imagePicking: boolean;
  onPickImages: () => void;
  onRemoveImage: (index: number) => void;

  /** 저장 중이면 버튼이 잠기고 스피너가 뜬다. (중복 제출 방지) */
  submitting: boolean;
  /**
   * 지금 올릴 수 있는 상태인가.
   *
   * 아니면 버튼이 연회색으로 잠긴다. 길이 기준은 화면 파일이 갖고 있어
   * 판단도 거기서 하고 결과만 받는다. (CLAUDE.md 9장)
   */
  canSubmit: boolean;
  onSubmit: () => void;
};

/**
 * COMM-04 게시글 / 팁 작성 폼. (docs/09_IA_v1.md §4-5)
 *
 * ⚠️ 유료 팁은 유형 선택지에 없다. 2026-08-31 팀 결정으로 유료 기능을 뺐다.
 * ⚠️ '여행 유형 공유'(TYPE_SHARE)도 없다. 그 글은 여행 유형 결과(TYPE-01)에서
 *    나와야 하는데 그 화면이 고도화이고 유형 목록도 미확정이다.
 * ⚠️ 임시저장(DRAFT)은 두지 않았다. 화면 목록에 없는 기능이다.
 * ⚠️ 사진은 고르고 미리보기까지만 된다. 저장할 스키마와 Storage 버킷이 없다.
 *    준비되면 업로드 URL 을 createPost 에 넘긴다. (useCoverImage 주석 참조)
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
  imageUris,
  maxImages,
  imageError,
  imagePicking,
  onPickImages,
  onRemoveImage,
  submitting,
  canSubmit,
  onSubmit,
}: Props) {
  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerClassName="px-5 pb-12 pt-5"
      keyboardShouldPersistTaps="handled"
    >
      {/* 사진 */}
      <Text className="mb-2 font-bold text-pot-ink" style={{ fontSize: 13 }}>
        사진 <Text className="text-pot-faint">({imageUris.length}/{maxImages})</Text>
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
        {imageUris.map((uri, index) => (
          <View key={uri} className="overflow-hidden rounded-2xl">
            <Image source={{ uri }} style={{ width: 110, height: 110 }} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${index + 1}번째 사진 지우기`}
              disabled={submitting}
              onPress={() => onRemoveImage(index)}
              className="absolute right-1.5 top-1.5 h-7 w-7 items-center justify-center rounded-full bg-black/55 active:opacity-70"
            >
              <Ionicons name="close" size={15} color="#FFFFFF" />
            </Pressable>
          </View>
        ))}

        {imageUris.length < maxImages ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="사진 추가"
            disabled={submitting || imagePicking}
            onPress={onPickImages}
            className="items-center justify-center rounded-2xl bg-pot-visual active:opacity-70"
            style={{ width: 110, height: 110, opacity: imagePicking ? 0.5 : 1 }}
          >
            <Ionicons name="add" size={24} color="#9AA3AE" />
            <Text className="mt-1 text-pot-faint" style={{ fontSize: 12 }}>
              사진 추가
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
      {imageError ? (
        <Text className="mt-1.5 text-red-500" style={{ fontSize: 12 }}>
          {imageError}
        </Text>
      ) : (
        <Text className="mt-1.5 text-pot-faint" style={{ fontSize: 11, lineHeight: 15 }}>
          사진 저장은 준비 중이에요. 지금은 미리보기만 됩니다.
        </Text>
      )}

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
              className={`rounded-full px-4 py-2.5 ${active ? 'bg-pot-ink' : 'bg-pot-visual'}`}
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
        className={`rounded-xl bg-pot-visual px-4 py-3.5 text-pot-ink ${titleError ? 'border border-red-400' : ''}`}
        style={{ fontSize: 15, ...NO_FOCUS_RING }}
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
        className={`rounded-xl bg-pot-visual px-4 py-3.5 text-pot-ink ${contentError ? 'border border-red-400' : ''}`}
        style={{ fontSize: 15, lineHeight: 23, minHeight: 200, ...NO_FOCUS_RING }}
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
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSubmit || submitting, busy: submitting }}
          disabled={!canSubmit || submitting}
          onPress={onSubmit}
          className={`w-full flex-row items-center justify-center rounded-xl px-5 py-3.5 ${
            canSubmit ? 'bg-pot-ink active:bg-black' : 'bg-pot-visual'
          } ${submitting ? 'opacity-40' : ''}`}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text
              className={`text-base font-semibold ${canSubmit ? 'text-white' : 'text-pot-faint'}`}
            >
              게시하기
            </Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}
