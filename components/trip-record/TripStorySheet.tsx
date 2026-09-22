// ============================================================================
// 여행 기록 스토리 이미지 공유 시트 (TRIP-HOME-02)
//
// 미리보기(카드 위에서 직접 편집) → 배경 사진 → 이미지로 공유.
//
// 인스타그램 스토리처럼 카드 위의 텍스트를 누르면 선택되고, 그 아래에 **그 텍스트의**
// 글꼴·크기 패널이 뜬다. 도시명과 이름은 글꼴을 따로 가진다.
//   도시명   글꼴·크기·위치만. 내용은 못 바꾼다 (여행 데이터다)
//   이름     카드 위에서 바로 커서가 떠서 고친다. 줄바꿈 가능
//
// ⚠️ 카드를 **미리 보여준 뒤** 공유하게 한다. 무엇이 나가는지 모르고 누르게
//    하면 안 된다. (ShareReportSheet 와 같은 원칙)
//
// ⚠️ 캡처 전에 선택 테두리와 키보드 커서를 지운다. 안 그러면 이미지에 찍힌다.
//    그래서 onShare 를 바로 부르지 않고 한 프레임 뒤에 부른다.
//
// ⚠️ 이 컴포넌트는 supabase 도 track() 도 부르지 않는다. 사진 선택·캡처·공유는
//    전부 화면 파일이 한다. 글꼴·크기·선택은 캡처 한 장에만 쓰는 값이라 여기서 든다.
// ============================================================================
import { Ionicons } from '@expo/vector-icons';
import { forwardRef, useCallback, useMemo, useState, type ComponentProps } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import ViewShot, { type ViewShotRef } from 'react-native-view-shot';

import { BottomSheet } from '@/components/ui';
import { DEFAULT_STORY_FONT_ID, STORY_FONTS, storyFont } from '@/lib/constants/storyFonts';
import { useStoryFonts } from '@/lib/hooks/useStoryFonts';

import { clampStickerScale } from './DraggableSticker';
import { STORY_TEXT, TripStoryCard, type StoryText } from './TripStoryCard';

/** −/+ 한 번에 바뀌는 크기 */
const SCALE_STEP = 0.1;

type CardProps = ComponentProps<typeof TripStoryCard>;

type Props = {
  visible: boolean;
  onClose: () => void;
  card: Omit<
    CardProps,
    | 'titleStyle'
    | 'membersStyle'
    | 'onChangeTitleScale'
    | 'onChangeMembersScale'
    | 'selected'
    | 'onSelect'
    | 'mapScale'
    | 'onChangeMapScale'
    | 'onStickerActiveChange'
    | 'onChangeMembersText'
  >;
  onChangeMembersText: (text: string) => void;
  /** 모임 여행일 때만 온다. 없으면 채우기 버튼을 숨긴다 */
  memberPresets: { label: string; text: string }[];
  onPickPhoto: () => void;
  /** 내 사진을 골랐을 때만 보인다. 서비스 기본 배경(목적지 사진)으로 되돌린다 */
  onResetPhoto: () => void;
  onShare: () => void;
  /** 캡처·공유 중. 중복 제출 방지 */
  busy: boolean;
};

/**
 * ⚠️ ViewShot ref 를 화면 파일이 들고 있어야 캡처할 수 있어서 forwardRef 다.
 *    캡처 대상은 미리보기로 보여주는 그 카드 그대로다.
 */
export const TripStorySheet = forwardRef<ViewShotRef, Props>(function TripStorySheet(
  {
    visible,
    onClose,
    card,
    onChangeMembersText,
    memberPresets,
    onPickPhoto,
    onResetPhoto,
    onShare,
    busy,
  },
  ref,
) {
  const { theme } = card;
  // 시트가 열릴 때만 폰트를 받는다. 못 받은 동안은 시스템 폰트로 그려진다
  const fontsLoaded = useStoryFonts();
  // 스티커를 끄는 동안 시트 스크롤을 멈춘다
  const [dragging, setDragging] = useState(false);

  // ── 편집 상태. 캡처 한 장에만 쓰므로 여기서 든다 ───────────────────────
  const [selected, setSelected] = useState<StoryText | null>(null);
  const [titleFontId, setTitleFontId] = useState(DEFAULT_STORY_FONT_ID);
  const [membersFontId, setMembersFontId] = useState(DEFAULT_STORY_FONT_ID);
  const [titleScale, setTitleScale] = useState(1);
  const [membersScale, setMembersScale] = useState(1);
  const [mapScale, setMapScale] = useState(1);

  /*
    ⚠️ 글꼴·크기 패널을 **항상 띄운다.** (2026-09-21 테스트)

       예전에는 카드 위 글자를 먼저 눌러야(selected) 패널이 나왔다. 그래서
       시트를 열자마자 글꼴을 고를 수 없었고, "폰트가 바로 적용되지 않는다 ·
       도시명이나 사람 이름을 꼭 먼저 선택해야만 된다" 로 올라왔다.
       무엇을 꾸미는 중인지는 아래 칩으로 직접 고를 수 있게 한다.

    ⚠️ selected 는 그대로 둔다. 카드 위 선택 테두리와 캡처 직전 해제에 쓰인다.
       패널이 무엇을 바꾸는지는 target 이 정한다. 아무것도 안 골랐으면 도시명이다.
  */
  const target = selected ?? STORY_TEXT.TITLE;
  const isTitle = target === STORY_TEXT.TITLE;
  const fontId = isTitle ? titleFontId : membersFontId;
  const setFontId = isTitle ? setTitleFontId : setMembersFontId;
  const scale = isTitle ? titleScale : membersScale;
  const setScale = isTitle ? setTitleScale : setMembersScale;
  const selectedFont = storyFont(fontId);
  /*
    ⚠️ '함께 간 사람' 에서는 **한글 글꼴을 앞으로 당긴다.** (2026-09-21 4차)
       "도시명은 바뀌는데 함께 간 사람은 잘 안 된다" 가 올라왔다. 코드는
       멀쩡했다 — 목록 앞쪽이 전부 영문 전용 글꼴이고 이름은 한글이라,
       눌러도 화면이 그대로였던 것이다. 도시명은 TAIPEI 라 바로 바뀐다.
       고장이 아니라 **고를 수 없는 것을 먼저 보여 준 것**이 문제였다.
       영문 이름을 쓰는 사람도 있으니 지우지는 않고 뒤로 보내고 흐리게 둔다.
  */
  const fontChoices = useMemo(
    () =>
      isTitle
        ? STORY_FONTS
        : [...STORY_FONTS].sort(
            (a, b) => Number(b.hangul) - Number(a.hangul),
          ),
    [isTitle],
  );

  const handleShare = useCallback(() => {
    // 선택 테두리·커서를 지운 다음 프레임에 캡처한다
    setSelected(null);
    Keyboard.dismiss();
    setTimeout(onShare, 80);
  }, [onShare]);

  return (
    <BottomSheet visible={visible} onClose={onClose} title="여행 기록 이미지">
      <ScrollView
        contentContainerClassName="items-center gap-4 px-5 pb-6 pt-1"
        keyboardShouldPersistTaps="handled"
        scrollEnabled={!dragging}
      >
        <Text className="self-stretch text-xs leading-5 text-gray-500">
          카드 위의 글자를 누르면 글꼴과 크기를 바꿀 수 있어요. 끌어서 옮기고, 두
          손가락으로 키울 수도 있어요.
        </Text>

        {/*
          미리보기 = 캡처 대상
          ⚠️ Modal 안이라 GestureHandlerRootView 를 한 번 더 감싼다. 루트에 있는 것은
             Modal 의 새 창까지 닿지 않는다.
        */}
        <GestureHandlerRootView>
          <View className="overflow-hidden rounded-2xl" style={{ elevation: 4 }}>
            <ViewShot ref={ref} options={{ format: 'png', quality: 1 }}>
              <TripStoryCard
                {...card}
                onChangeMembersText={onChangeMembersText}
                titleStyle={{
                  fontFamily: fontsLoaded ? storyFont(titleFontId).family : undefined,
                  scale: titleScale,
                }}
                membersStyle={{
                  fontFamily: fontsLoaded ? storyFont(membersFontId).family : undefined,
                  scale: membersScale,
                }}
                onChangeTitleScale={setTitleScale}
                onChangeMembersScale={setMembersScale}
                selected={selected}
                onSelect={setSelected}
                mapScale={mapScale}
                onChangeMapScale={setMapScale}
                onStickerActiveChange={setDragging}
              />
            </ViewShot>
          </View>
        </GestureHandlerRootView>

        {/* ── 글꼴·크기. 카드를 누르지 않아도 바로 쓸 수 있다 ──────────── */}
        <View className="w-full gap-3 rounded-2xl bg-gray-50 p-3">
            <View className="flex-row items-center justify-between">
              {/* 무엇을 꾸미는 중인지 직접 고른다. 카드를 누르는 것과 같은 효과 */}
              <View className="flex-row gap-1.5">
                {[
                  { key: STORY_TEXT.TITLE, label: '도시명' },
                  { key: STORY_TEXT.MEMBERS, label: '함께 간 사람' },
                ].map((tab) => {
                  const on = target === tab.key;
                  return (
                    <Pressable
                      key={tab.label}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={`${tab.label} 꾸미기`}
                      onPress={() => setSelected(tab.key)}
                      className="rounded-full px-3 py-1.5"
                      style={{
                        borderWidth: 1,
                        borderColor: on ? theme.primary : '#e5e7eb',
                        backgroundColor: on ? theme.primarySoft : '#fff',
                      }}
                    >
                      <Text
                        className="text-[11px] font-bold"
                        style={{ color: on ? theme.primary : '#6b7280' }}
                      >
                        {tab.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {!isTitle && memberPresets.length > 0 ? (
                <View className="flex-row gap-1.5">
                  {memberPresets.map((preset) => (
                    <Pressable
                      key={preset.label}
                      accessibilityRole="button"
                      accessibilityLabel={`${preset.label}으로 채우기`}
                      onPress={() => onChangeMembersText(preset.text)}
                      className="rounded-full bg-white px-3 py-1.5 active:bg-gray-200"
                    >
                      <Text className="text-[11px] font-bold text-gray-700">{preset.label}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>

            {/* 글꼴 */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="gap-2"
              className="-mx-3 px-3"
            >
              {fontChoices.map((font) => {
                const active = font.id === fontId;
                return (
                  <Pressable
                    key={font.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`글꼴 ${font.label}`}
                    onPress={() => setFontId(font.id)}
                    className="h-12 min-w-[64px] items-center justify-center rounded-xl border px-3"
                    style={{
                      borderColor: active ? theme.primary : '#e5e7eb',
                      backgroundColor: active ? theme.primarySoft : '#fff',
                      // 한글 이름에 안 먹는 글꼴은 흐리게. 고를 수는 있다 (영문 이름도 쓴다)
                      opacity: !isTitle && !font.hangul ? 0.5 : 1,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 16,
                        color: active ? theme.primary : '#111827',
                        ...(fontsLoaded && font.family
                          ? { fontFamily: font.family }
                          : { fontWeight: '800', fontStyle: 'italic' }),
                      }}
                      numberOfLines={1}
                    >
                      {isTitle && !font.hangul ? 'Aa' : '가Aa'}
                    </Text>
                    <Text className="mt-0.5 text-[9px] text-gray-400" numberOfLines={1}>
                      {font.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            {!selectedFont.hangul && !isTitle ? (
              <Text className="text-[11px] font-bold" style={{ color: '#b4700f' }}>
                이 글꼴에는 한글이 없어요. 이름이 한글이면 바뀐 게 안 보여요.
              </Text>
            ) : null}

            {/* 크기 */}
            <View className="flex-row items-center justify-between">
              <Text className="text-[12px] text-gray-500">크기</Text>
              <View className="flex-row items-center gap-2">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="작게"
                  onPress={() => setScale(clampStickerScale(scale - SCALE_STEP))}
                  className="h-8 w-8 items-center justify-center rounded-full bg-white active:bg-gray-200"
                >
                  <Ionicons name="remove" size={16} color="#111827" />
                </Pressable>
                <Text className="w-12 text-center text-[12px] font-bold text-gray-900">
                  {Math.round(scale * 100)}%
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="크게"
                  onPress={() => setScale(clampStickerScale(scale + SCALE_STEP))}
                  className="h-8 w-8 items-center justify-center rounded-full bg-white active:bg-gray-200"
                >
                  <Ionicons name="add" size={16} color="#111827" />
                </Pressable>
              </View>
            </View>
          </View>

        <View className="w-full gap-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="배경 사진 고르기"
            disabled={busy}
            onPress={onPickPhoto}
            className="h-12 flex-row items-center justify-center gap-1.5 rounded-xl bg-gray-100 active:bg-gray-200"
          >
            <Ionicons name="images-outline" size={16} color="#111827" />
            <Text className="text-[13px] font-bold text-gray-900">
              {card.photoUri ? '배경 사진 바꾸기' : '내 사진으로 배경 바꾸기'}
            </Text>
          </Pressable>

          {/* 내 사진을 골랐을 때만. 기본 배경일 때는 되돌릴 것이 없다 (2026-09-22 테스트) */}
          {card.photoUri ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="기본 배경으로 되돌리기"
              disabled={busy}
              onPress={onResetPhoto}
              className="h-12 flex-row items-center justify-center gap-1.5 rounded-xl bg-gray-100 active:bg-gray-200"
            >
              <Ionicons name="refresh-outline" size={16} color="#111827" />
              <Text className="text-[13px] font-bold text-gray-900">기본 배경으로 되돌리기</Text>
            </Pressable>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="여행 기록 이미지로 공유하기"
            disabled={busy}
            onPress={handleShare}
            className="h-12 flex-row items-center justify-center gap-1.5 rounded-xl active:opacity-90"
            style={{ backgroundColor: theme.primary, opacity: busy ? 0.6 : 1 }}
          >
            {busy ? (
              <ActivityIndicator size="small" color={theme.onPrimary} />
            ) : (
              <Ionicons name="share-outline" size={16} color={theme.onPrimary} />
            )}
            <Text className="text-[13px] font-bold" style={{ color: theme.onPrimary }}>
              이미지로 공유
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </BottomSheet>
  );
});
