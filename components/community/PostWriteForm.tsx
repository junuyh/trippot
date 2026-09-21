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
import type { TripOption } from './types';

// ⚠️ components/ui/Button 을 쓰지 않는다. 공용 Button 의 primary 가 bg-blue-600 이고
//    그 파일은 [공유] 라 고치면 25개 화면 버튼이 전부 바뀐다.
//    버튼 검은색 통일이 팀 전체로 확정되면 공용 Button 을 고치고 이 버튼을 지운다.
//    (components/home/HomeButton.tsx 도 같은 이유로 따로 있다)

type TypeOption = { value: string; label: string };

type Props = {
  typeOptions: TypeOption[];
  postType: string;
  onChangeType: (value: string) => void;

  /**
   * 어느 여행 이야기인가. (2026-09-03)
   *
   * 이 선택이 글의 여행지 카테고리를 정한다. 비어 있으면 섹션을 그리지 않는다.
   */
  tripOptions: TripOption[];
  /** 고른 여행. null 이면 연결하지 않는다. */
  tripId: string | null;
  onChangeTrip: (value: string | null) => void;

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
   * 게시 · 수정 버튼.
   *
   * ⚠️ 이 버튼은 **비어 있어도 잠기지 않는다.** (2026-09-21)
   *    전에는 제목·내용이 차기 전까지 연회색으로 잠겨 있었는데, 잠긴 버튼은
   *    '왜 못 누르는지' 를 말해주지 않는다. 눌러야 화면이 무엇이 빠졌는지
   *    알려준다 — 화면 파일의 validate() 가 titleError · contentError 를
   *    채우고, 그 문구가 해당 입력칸 아래에 뜬다.
   */
  onSubmit: () => void;
  /**
   * 버튼에 적을 말. 새 글이면 '게시하기', 고치는 중이면 '수정 완료'.
   *
   * ⚠️ 화면이 정해서 넘긴다. 이 컴포넌트는 지금이 새 글인지 수정인지 모른다.
   *    폼이 모드를 알기 시작하면 모드마다 분기가 늘어난다. (CLAUDE.md 9장)
   */
  submitLabel?: string;
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
  tripOptions,
  tripId,
  onChangeTrip,
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
  onSubmit,
  submitLabel = '게시하기',
}: Props) {
  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerClassName="px-5 pb-12 pt-5"
      keyboardShouldPersistTaps="handled"
    >
      {/* 유형 — 2026-09-18 사진을 아래로 옮겨 맨 위가 됐다. 그래서 위 간격(mt-6)을 뺐다. */}
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
              className={`rounded-full px-4 py-2.5 ${active ? 'bg-brand' : 'bg-pot-visual'}`}
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

      {/* 어느 여행 이야기인가 (2026-09-03)
          ⚠️ 이 선택이 커뮤니티의 여행지 카테고리를 정한다. community_posts 에
             destination 컬럼이 없어서 글의 여행지는 연결한 여행에서만 나온다.
             고르지 않으면 '전체' 에만 보인다. 그래서 안내 문구를 꼭 남긴다. */}
      {tripOptions.length > 0 ? (
        <>
          <Text className="mb-2 mt-6 font-bold text-pot-ink" style={{ fontSize: 13 }}>
            어느 여행 이야기인가요
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-2 pr-4"
          >
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: tripId === null }}
              disabled={submitting}
              onPress={() => onChangeTrip(null)}
              className={`justify-center rounded-2xl px-4 py-2.5 ${
                tripId === null ? 'bg-brand' : 'bg-pot-visual'
              }`}
            >
              <Text
                className={`font-bold ${tripId === null ? 'text-white' : 'text-pot-mute'}`}
                style={{ fontSize: 13 }}
              >
                선택 안 함
              </Text>
            </Pressable>

            {tripOptions.map((option) => {
              const active = option.tripId === tripId;
              return (
                <Pressable
                  key={option.tripId}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  disabled={submitting}
                  onPress={() => onChangeTrip(option.tripId)}
                  className={`rounded-2xl px-4 py-2 ${active ? 'bg-brand' : 'bg-pot-visual'}`}
                >
                  <View className="flex-row items-center">
                    {option.flag ? (
                      // 장식이다. 옆 글자가 여행지 이름을 그대로 말한다.
                      <Text style={{ fontSize: 12, marginRight: 4 }} accessible={false}>
                        {option.flag}
                      </Text>
                    ) : null}
                    <Text
                      className={`font-bold ${active ? 'text-white' : 'text-pot-mute'}`}
                      style={{ fontSize: 13 }}
                    >
                      {option.label}
                    </Text>
                  </View>
                  {option.sublabel ? (
                    <Text
                      className={active ? 'text-white/70' : 'text-pot-faint'}
                      style={{ fontSize: 10.5, marginTop: 1 }}
                    >
                      {option.sublabel}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
          <Text className="mt-1.5 text-pot-faint" style={{ fontSize: 11, lineHeight: 15 }}>
            {tripId === null
              ? '고르지 않으면 여행지 카테고리 없이 전체 목록에만 보여요.'
              : '커뮤니티에서 이 여행지 카테고리로 묶여요.'}
          </Text>
        </>
      ) : null}

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

      {/* 사진 — 2026-09-18 맨 위에서 내용 아래로 옮겼다. 어떤 글인지 · 제목 · 내용을 먼저 쓰고
          사진은 마지막에 덧붙인다. 글쓰기의 중심은 글이고, 사진은 선택이다. */}
      <Text className="mb-2 mt-4 font-bold text-pot-ink" style={{ fontSize: 13 }}>
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
      {/* ⚠️ 여기 '사진 저장은 준비 중이에요' 안내를 뒀다가 뺐다. 글을 쓰러 온
             사람에게 아직 안 되는 기능을 먼저 알릴 이유가 없다.
             오류가 났을 때만 말한다. */}
      {imageError ? (
        <Text className="mt-1.5 text-red-500" style={{ fontSize: 12 }}>
          {imageError}
        </Text>
      ) : null}

      {submitError ? (
        <Text className="mt-4 text-center text-red-500" style={{ fontSize: 13 }}>
          {submitError}
        </Text>
      ) : null}

      <View className="mt-7">
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: submitting, busy: submitting }}
          // 저장 중에만 잠근다. 중복 제출 방지다. (CLAUDE.md 9장)
          disabled={submitting}
          onPress={onSubmit}
          className={`w-full flex-row items-center justify-center rounded-xl bg-brand px-5 py-3.5 active:bg-brand-pressed ${
            submitting ? 'opacity-40' : ''
          }`}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text className="text-base font-semibold text-white">{submitLabel}</Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}
