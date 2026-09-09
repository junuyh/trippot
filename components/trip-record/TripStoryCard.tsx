// ============================================================================
// TRIP-HOME-02 여행 기록 스토리 이미지 (2026-09-08 시안)
//
// 인스타 스토리에 올리는 세로 한 장(9:16). 사용자에게 받는 건 **배경 사진
// 하나**뿐이고, 나머지(달력·나라 실루엣·도시 핀·멤버·한 줄 기록)는 전부
// 여행 데이터에서 자동으로 채운다.
//
// 참고한 구도: "THE DAY TRIP" 포스터 (사진 위에 제목 + 오려 붙인 지도 + 하단 정보)
//
// ⚠️ 지도에 시간·거리를 쓰지 않는다. 해외여행이라 경로선도 없다. 도시 핀 하나다.
//
// ⚠️ 지도 자리는 **슬롯**이다. 지금은 나라 실루엣(countryOutline)을 그리고,
//    Google Maps Static 같은 실제 지도 이미지가 붙으면 mapImageUri 로 같은
//    자리에 <Image> 를 넣는다. 실루엣은 그때 fallback 이 된다.
//
// ⚠️ 이 컴포넌트는 supabase 도 track() 도 부르지 않는다. 화면 파일이 부른다.
//    (CLAUDE.md 9장) 사진 선택·캡처·공유도 화면 파일이 한다.
//
// ⚠️ 캡처 대상은 미리보기로 보여주는 이 카드 그대로다. (ShareReportSheet 와 같은
//    원칙) 보이는 것과 나가는 것이 달라지면 안 된다.
// ============================================================================
import {
  eachDayOfInterval,
  endOfWeek,
  format,
  isWithinInterval,
  parseISO,
  startOfWeek,
} from 'date-fns';
import { useRef } from 'react';
import { Image, Pressable, Text, TextInput, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { CountryOutline } from '@/lib/constants/countryOutline';
import type { CountryTheme } from '@/lib/constants/countryTheme';

import { DraggableSticker } from './DraggableSticker';

/** 카드 위에서 고를 수 있는 텍스트. 글꼴·크기 패널이 이 값을 보고 대상을 정한다 */
export const STORY_TEXT = {
  TITLE: 'title',
  MEMBERS: 'members',
} as const;
export type StoryText = (typeof STORY_TEXT)[keyof typeof STORY_TEXT];

/** 도시명·이름 각각의 편집 상태 */
export type StoryTextStyle = {
  /** undefined 면 시스템 굵은 이탤릭 (lib/constants/storyFonts) */
  fontFamily?: string;
  scale: number;
};

/** 미리보기 가로. 세로는 9:16. 캡처는 기기 배율(3x)로 나가서 810×1440 이다 */
export const STORY_WIDTH = 270;
export const STORY_HEIGHT = Math.round((STORY_WIDTH * 16) / 9);

/** 실루엣이 차지하는 가로. 나머지는 여백 */
const MAP_WIDTH = 168;

/** 달력 칸 한 변과 간격. 왼쪽 위 모서리에 작게 들어가야 해서 아주 작다 */
const CAL_CELL = 12;
const CAL_GAP = 2;
/** 요일 머리. 일요일 시작 */
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;
/** 이 줄 수를 넘으면 첫 주·마지막 주만 두고 사이를 ··· 로 줄인다 */
const MAX_CALENDAR_ROWS = 3;

type Props = {
  theme: CountryTheme;
  flag: string;
  /** 영문 도시명. 제목으로 크게 쓴다 */
  destinationEn: string;
  /** 사용자가 고른 배경 사진. 없으면 fallbackPhotoUrl */
  photoUri: string | null;
  /** 목적지 랜드마크 사진(destinationPhoto). 사진을 안 골랐을 때의 배경 */
  fallbackPhotoUrl: string | null;
  /** 나라 실루엣. 직접 입력 목적지면 null 이고 지도 자리를 비운다 */
  outline: CountryOutline | null;
  /** 실루엣 viewBox 안의 도시 좌표 */
  pin: { x: number; y: number } | null;
  /** [Future] 실제 지도 이미지. 있으면 실루엣 대신 이걸 그린다 */
  mapImageUri?: string | null;
  /** ISO date. 둘 다 있어야 달력을 그린다 */
  startDate: string | null;
  endDate: string | null;
  /**
   * 함께 간 사람. 카드 위에서 바로 고친다. 줄바꿈 포함.
   * ⚠️ 비어 있어도 입력칸은 남긴다. 없애면 다시 쓸 자리가 사라진다.
   */
  membersText: string;
  onChangeMembersText?: (text: string) => void;
  titleStyle: StoryTextStyle;
  membersStyle: StoryTextStyle;
  onChangeTitleScale?: (scale: number) => void;
  onChangeMembersScale?: (scale: number) => void;
  /** 지금 선택된 텍스트. 점선 테두리를 그린다. 캡처 전에는 null 이어야 한다 */
  selected: StoryText | null;
  onSelect?: (target: StoryText | null) => void;
  /** 지도 크기. 핀치로 바꾼다 */
  mapScale: number;
  onChangeMapScale?: (scale: number) => void;
  /** 스티커를 끌고 있는 동안 true. 부모 ScrollView 를 멈추는 데 쓴다 */
  onStickerActiveChange?: (active: boolean) => void;
};

export function TripStoryCard({
  theme,
  flag,
  destinationEn,
  photoUri,
  fallbackPhotoUrl,
  outline,
  pin,
  mapImageUri,
  startDate,
  endDate,
  membersText,
  onChangeMembersText,
  titleStyle,
  membersStyle,
  onChangeTitleScale,
  onChangeMembersScale,
  selected,
  onSelect,
  mapScale,
  onChangeMapScale,
  onStickerActiveChange,
}: Props) {
  const background = photoUri ?? fallbackPhotoUrl;
  const calendar = buildCalendar(startDate, endDate);
  const membersInputRef = useRef<TextInput>(null);
  /*
    ⚠️ 커스텀 폰트에는 fontWeight · fontStyle 을 주지 않는다. iOS 는 그 굵기가
       없는 폰트에 fontWeight 를 주면 시스템 폰트로 되돌아간다.
  */
  const titleFont = titleStyle.fontFamily
    ? { fontFamily: titleStyle.fontFamily, fontWeight: 'normal' as const, fontStyle: 'normal' as const }
    : { fontWeight: '900' as const, fontStyle: 'italic' as const };
  const bodyFont = membersStyle.fontFamily
    ? { fontFamily: membersStyle.fontFamily, fontWeight: 'normal' as const }
    : { fontWeight: '800' as const };

  return (
    <View
      style={{
        width: STORY_WIDTH,
        height: STORY_HEIGHT,
        overflow: 'hidden',
        backgroundColor: theme.neutral,
      }}
    >
      {/* ── 배경 사진 ──────────────────────────────────────────────── */}
      {background ? (
        <Image
          source={{ uri: background }}
          resizeMode="cover"
          style={{ position: 'absolute', inset: 0, width: STORY_WIDTH, height: STORY_HEIGHT }}
          accessibilityIgnoresInvertColors
        />
      ) : null}

      {/*
        ── 어둡게 깔기 ──
        사진이 밝으면 흰 글자가 안 보인다. 위·아래만 어둡게 하고 가운데는 사진을 살린다.
      */}
      <Svg
        width={STORY_WIDTH}
        height={STORY_HEIGHT}
        style={{ position: 'absolute', inset: 0 }}
        pointerEvents="none"
      >
        <Defs>
          <LinearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#000" stopOpacity="0.55" />
            <Stop offset="0.3" stopColor="#000" stopOpacity="0.05" />
            <Stop offset="0.62" stopColor="#000" stopOpacity="0.1" />
            <Stop offset="1" stopColor="#000" stopOpacity="0.8" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={STORY_WIDTH} height={STORY_HEIGHT} fill="url(#shade)" />
      </Svg>

      {/* 빈 곳을 누르면 선택을 푼다. 스티커가 이 위에 있어서 스티커를 누르면 안 닿는다 */}
      <Pressable
        style={{ position: 'absolute', inset: 0 }}
        onPress={() => {
          membersInputRef.current?.blur();
          onSelect?.(null);
        }}
        accessibilityLabel="선택 해제"
      />

      {/* ── 머리: 달력(좌) · 국기(우) ─────────────────────────────── */}
      <View
        style={{
          position: 'absolute',
          top: 18,
          left: 16,
          right: 16,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        {calendar ? (
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 8 }}>📅</Text>
              <Text
                style={{
                  color: '#fff',
                  fontSize: 8,
                  fontWeight: '800',
                  letterSpacing: 1.5,
                }}
              >
                {calendar.monthLabel}
              </Text>
            </View>
            {/* 요일 머리 */}
            <View style={{ flexDirection: 'row', gap: CAL_GAP, marginTop: 5 }}>
              {WEEKDAYS.map((letter, index) => (
                <Text
                  key={index}
                  style={{
                    width: CAL_CELL,
                    textAlign: 'center',
                    fontSize: 6.5,
                    fontWeight: '800',
                    color: 'rgba(255,255,255,0.55)',
                  }}
                >
                  {letter}
                </Text>
              ))}
            </View>
            {/* 주 단위 줄. 여행일만 나라 색 칸에 흰 글자 */}
            {calendar.rows.map((row, rowIndex) =>
              row === 'ellipsis' ? (
                <Text
                  key={`row-${rowIndex}`}
                  style={{
                    color: 'rgba(255,255,255,0.55)',
                    fontSize: 8,
                    lineHeight: 10,
                    letterSpacing: 2,
                    marginLeft: 3,
                  }}
                >
                  ···
                </Text>
              ) : (
                <View key={`row-${rowIndex}`} style={{ flexDirection: 'row', gap: CAL_GAP, marginTop: 2 }}>
                  {row.map((day) => (
                    <View
                      key={day.key}
                      style={{
                        width: CAL_CELL,
                        height: CAL_CELL,
                        borderRadius: 3,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: day.inTrip ? theme.primary : 'transparent',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 7.5,
                          fontWeight: day.inTrip ? '900' : '600',
                          color: day.inTrip ? '#fff' : 'rgba(255,255,255,0.45)',
                        }}
                      >
                        {day.label}
                      </Text>
                    </View>
                  ))}
                </View>
              ),
            )}
          </View>
        ) : (
          <View />
        )}

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 999,
            backgroundColor: 'rgba(255,255,255,0.18)',
          }}
        >
          <Text style={{ fontSize: 11 }}>{flag}</Text>
          <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 1 }}>
            {theme.code}
          </Text>
        </View>
      </View>

      {/* ── 도시명 ── 끌어서 옮기고 두 손가락으로 키울 수 있다 ──────── */}
      <View style={{ position: 'absolute', top: 76, left: 0, right: 0, alignItems: 'center' }}>
        <DraggableSticker
          onActiveChange={onStickerActiveChange}
          scale={titleStyle.scale}
          onScaleChange={onChangeTitleScale}
          selected={selected === STORY_TEXT.TITLE}
          onTap={() => {
            membersInputRef.current?.blur();
            onSelect?.(STORY_TEXT.TITLE);
          }}
        >
          <Text
            style={{
              color: '#fff',
              fontSize: 46,
              lineHeight: 54,
              letterSpacing: titleStyle.fontFamily ? 0 : -1,
              paddingHorizontal: 12,
              textShadowColor: 'rgba(0,0,0,0.35)',
              textShadowOffset: { width: 0, height: 2 },
              textShadowRadius: 8,
              ...titleFont,
            }}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {destinationEn}
          </Text>
        </DraggableSticker>
      </View>

      {/* ── 지도 슬롯 ── 끌어서 옮기고 두 손가락으로 키울 수 있다 ──── */}
      <View
        style={{
          position: 'absolute',
          top: 180,
          left: 0,
          right: 0,
          alignItems: 'center',
        }}
      >
        <DraggableSticker
          onActiveChange={onStickerActiveChange}
          scale={mapScale}
          onScaleChange={onChangeMapScale}
          onTap={() => onSelect?.(null)}
        >
        {mapImageUri ? (
          <Image
            source={{ uri: mapImageUri }}
            style={{ width: MAP_WIDTH, height: MAP_WIDTH, borderRadius: 14, transform: [{ rotate: '-3deg' }] }}
          />
        ) : outline ? (
          <OutlineMap outline={outline} pin={pin} />
        ) : null}
        </DraggableSticker>
      </View>

      {/* ── 멤버 이름 스티커 ── 끌어서 옮기고 두 손가락으로 키울 수 있다 ── */}
      {/*
        ⚠️ Text 가 아니라 TextInput 이다. 인스타 스토리처럼 카드 위에서 바로 고친다.
           톡 치면 선택 + 커서, 끌면 이동. 캡처 전에 blur 해서 커서가 안 찍히게 한다.
      */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 52, alignItems: 'center' }}>
        <DraggableSticker
          onActiveChange={onStickerActiveChange}
          scale={membersStyle.scale}
          onScaleChange={onChangeMembersScale}
          selected={selected === STORY_TEXT.MEMBERS}
          onTap={() => {
            onSelect?.(STORY_TEXT.MEMBERS);
            membersInputRef.current?.focus();
          }}
        >
          <TextInput
            ref={membersInputRef}
            value={membersText}
            onChangeText={onChangeMembersText}
            onFocus={() => onSelect?.(STORY_TEXT.MEMBERS)}
            multiline
            scrollEnabled={false}
            maxLength={120}
            autoCorrect={false}
            placeholder="함께 간 사람"
            placeholderTextColor="rgba(255,255,255,0.45)"
            accessibilityLabel="함께 간 사람 입력"
            style={{
              color: '#fff',
              fontSize: 12,
              letterSpacing: membersStyle.fontFamily ? 0 : 0.3,
              textAlign: 'center',
              lineHeight: 20,
              paddingHorizontal: 4,
              paddingVertical: 0,
              // 멀티라인 TextInput 은 내용만큼만 넓어져 일찍 줄이 꺾인다. 카드 너비로 고정한다
              width: STORY_WIDTH - 12,
              textShadowColor: 'rgba(0,0,0,0.4)',
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 4,
              ...bodyFont,
            }}
          />
        </DraggableSticker>
      </View>

      {/* ── 워터마크 ─────────────────────────────────────────────── */}
      <View style={{ position: 'absolute', left: 18, right: 18, bottom: 18, alignItems: 'center' }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
          }}
        >
          <View style={{ width: 14, height: 1, backgroundColor: 'rgba(255,255,255,0.4)' }} />
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 9, fontWeight: '800', letterSpacing: 2 }}>
            @TRIPPOT
          </Text>
          <View style={{ width: 14, height: 1, backgroundColor: 'rgba(255,255,255,0.4)' }} />
        </View>
      </View>
    </View>
  );
}

// ── 실루엣 지도 ───────────────────────────────────────────────────────────

/** 핀 이모지 크기. 이모지의 꼭짓점이 도시 좌표에 오도록 아래 중앙을 기준으로 놓는다 */
const PIN_SIZE = 26;

/**
 * 종이를 오려 붙인 느낌의 나라 실루엣.
 * 흰 테두리를 두껍게 두르고 살짝 기울여서 사진 위에 얹은 스티커처럼 보이게 한다.
 * 도시는 글자 없이 📍 하나로만 찍는다. 도시명은 제목에 이미 크게 있다.
 */
function OutlineMap({
  outline,
  pin,
}: {
  outline: CountryOutline;
  pin: { x: number; y: number } | null;
}) {
  const [, , vw, vh] = outline.viewBox.split(' ').map(Number);
  // 세로로 긴 나라(베트남·대만)는 높이를 기준으로 맞춘다
  const scale = Math.min(MAP_WIDTH / vw, MAP_WIDTH / vh);
  const width = vw * scale;
  const height = vh * scale;
  // 핀·라벨이 실루엣 밖으로 삐져나갈 수 있어서 여백을 둔다
  const pad = 12;

  return (
    <View style={{ transform: [{ rotate: '-4deg' }] }}>
      <Svg
        width={width + pad * 2}
        height={height + pad * 2}
        viewBox={`${-pad / scale} ${-pad / scale} ${vw + (pad * 2) / scale} ${vh + (pad * 2) / scale}`}
      >
        {/* 흰 테두리: 같은 패스를 굵은 흰 선으로 먼저 깐다 */}
        {outline.paths.map((d, index) => (
          <Path
            key={`edge-${index}`}
            d={d}
            fill="#fff"
            stroke="#fff"
            strokeWidth={4.5 / scale}
            strokeLinejoin="round"
          />
        ))}
        {outline.paths.map((d, index) => (
          <Path key={`land-${index}`} d={d} fill="#DCEBD6" stroke="#BFD6B4" strokeWidth={0.5 / scale} />
        ))}
      </Svg>
      {pin ? (
        <Text
          style={{
            position: 'absolute',
            left: pad + pin.x * scale - PIN_SIZE / 2,
            // 이모지 꼭짓점이 좌표에 닿도록 글자 높이만큼 올린다
            top: pad + pin.y * scale - PIN_SIZE + 3,
            width: PIN_SIZE,
            fontSize: PIN_SIZE - 6,
            lineHeight: PIN_SIZE,
            textAlign: 'center',
          }}
        >
          📍
        </Text>
      ) : null}
    </View>
  );
}

// ── 달력 ──────────────────────────────────────────────────────────────────

type CalendarDay = { key: string; label: string; inTrip: boolean };
type CalendarRow = CalendarDay[] | 'ellipsis';

/**
 * 실제 달력처럼 요일에 맞춰 놓는다. 시작 주의 일요일부터 끝 주의 토요일까지,
 * 주 하나가 한 줄이다. 여행이 주를 넘어가면 자연히 두 줄이 된다.
 *
 * ⚠️ 3주를 넘는 긴 여행은 줄이 끝없이 늘어난다. 첫 주와 마지막 주만 두고
 *    사이를 ··· 로 접는다. 달력처럼 보이는 건 유지하면서 높이를 고정한다.
 */
function buildCalendar(startDate: string | null, endDate: string | null) {
  if (!startDate || !endDate) return null;
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return null;

  const days = eachDayOfInterval({
    start: startOfWeek(start, { weekStartsOn: 0 }),
    end: endOfWeek(end, { weekStartsOn: 0 }),
  }).map<CalendarDay>((day) => ({
    key: format(day, 'yyyy-MM-dd'),
    label: format(day, 'd'),
    inTrip: isWithinInterval(day, { start, end }),
  }));

  const weeks: CalendarDay[][] = [];
  for (let index = 0; index < days.length; index += 7) {
    weeks.push(days.slice(index, index + 7));
  }
  const rows: CalendarRow[] =
    weeks.length > MAX_CALENDAR_ROWS
      ? [weeks[0], 'ellipsis', weeks[weeks.length - 1]]
      : weeks;

  // 달이 바뀌는 여행은 "MAY – JUN 2026" 로 적는다
  const sameMonth = format(start, 'yyyy-MM') === format(end, 'yyyy-MM');
  const monthLabel = (
    sameMonth ? format(start, 'MMM yyyy') : `${format(start, 'MMM')} – ${format(end, 'MMM yyyy')}`
  ).toUpperCase();

  return { monthLabel, rows };
}
