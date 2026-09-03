// ============================================================================
// 여행 카드 상단의 랜드마크 사진 배너 (2026-09-03)
//
// 홈의 진행 중 여행 카드를 사진 배너로 바꾸면서 만들었다.
// 메인 카드(NextTripCard)와 가로 스크롤 카드가 같은 껍데기를 쓴다.
//
// 이 컴포넌트가 책임지는 것은 세 가지다.
//   ① 사진을 채워 넣는다 (cover)
//   ② 사진 위 글자가 읽히도록 아래쪽에 어두운 그라디언트를 깐다
//   ③ 사진이 없거나 로드에 실패해도 카드가 그대로 읽히게 한다
//
// ⚠️ ③ 이 핵심이다. 사진은 원격 URL 이라 없을 수 있는 값이다.
//    - 목록에 없는 목적지(직접 입력)는 애초에 사진이 없다
//    - 비행기 안·해외 로밍처럼 네트워크가 나쁠 때 로드가 실패한다
//    그래서 사진 레이어 **아래에 항상** 대체 화면을 먼저 그려 둔다.
//    대체 화면은 국가 테마 그라디언트 + 기존 랜드마크 실루엣이다.
//    사진이 뜨면 그 위를 덮고, 실패하면 그대로 남는다. 흰 구멍이 생기지 않는다.
//
// ⚠️ 사진 자체는 정보가 아니라 분위기다. 화면 낭독기가 읽을 내용이 없다.
//    여행지·날짜·금액은 위에 얹는 글자가 전달한다. 그래서 accessible={false} 다.
//
// ⚠️ expo-linear-gradient 를 새로 깔지 않았다. react-native-svg 가 이미 있고
//    같은 일을 한다. 라이브러리를 늘리지 않는다. (CLAUDE.md 1장)
// ============================================================================
import { useId, useState } from 'react';
import { Image, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { countryLandmark } from '@/lib/constants/countryLandmark';
import type { CountryTheme } from '@/lib/constants/countryTheme';

type Props = {
  /** 랜드마크 사진 URL. 없으면 대체 화면만 그린다. */
  photoUrl: string | null;
  /** 대체 화면 실루엣을 고르는 값. 모르는 국가면 기본 실루엣이 나온다. */
  countryKo: string | null;
  /** 대체 화면 배경색이 여기서 온다. */
  theme: CountryTheme;
  height: number;
  /** 사진 위에 얹을 내용. 보통 여행지·D-Day·날짜다. */
  children?: React.ReactNode;
  /**
   * 어두운 그라디언트를 깔지 여부. 기본은 true.
   *
   * 글자를 얹지 않는 작은 썸네일(지난 여행 목록)에서는 끈다.
   * 얹을 글자가 없는데 어둡게만 하면 사진이 탁해 보인다.
   */
  scrim?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * SVG 그라디언트 id 는 카드마다 달라야 한다.
 *
 * ⚠️ 웹(react-native-web)에서는 SVG 가 진짜 DOM 이라 id 가 문서 전체에서 공유된다.
 *    카드 세 장이 같은 id 를 쓰면 url(#...) 이 전부 첫 번째 그라디언트를 가리켜
 *    모든 카드가 첫 여행의 국가 색으로 칠해진다. 네이티브에서는 안 보이고
 *    웹에서만 드러나는 종류의 버그다.
 */
function useGradientIds() {
  // useId 는 ":r1:" 처럼 콜론이 들어간 값을 준다. url(#...) 에 그대로 쓸 수 없다.
  const raw = useId().replace(/:/g, '');
  return { scrim: `scrim-${raw}`, fallback: `fallback-${raw}` };
}

/**
 * 사진 아래쪽을 덮는 어두운 그라디언트의 진하기. 흰 글자가 읽히는 최소값이다.
 *
 * ⚠️ 2026-09-03 그라디언트가 **사진 위쪽까지 덮고 있었다.**
 *    0.45 지점에서 이미 20% 가 깔려 있어서 어떤 사진을 넣어도 칙칙해 보였다.
 *    "사진이 다 어둡다" 는 평의 실제 원인이 사진이 아니라 이 막이었다.
 *
 *    이제 위 절반은 손대지 않는다. 글자가 놓이는 아래쪽에서만 어두워진다.
 *    위쪽 칩(공항 코드·D-Day)은 각자 배경을 갖고 있어 막이 필요 없다 —
 *    공항 코드는 반투명 검정, D-Day 는 흰 알약이다.
 */
const SCRIM_OPACITY = 0.6;
/** 이 지점까지는 사진을 그대로 둔다. 아래로 갈수록 어두워진다. */
const SCRIM_START = 0.52;

export function DestinationBanner({
  photoUrl,
  countryKo,
  theme,
  height,
  children,
  scrim = true,
  style,
}: Props) {
  const ids = useGradientIds();
  // 로드 실패를 기억한다. 실패한 URL 을 계속 다시 그리지 않는다.
  const [failed, setFailed] = useState(false);
  const showPhoto = photoUrl !== null && !failed;

  return (
    <View style={[{ height, overflow: 'hidden' }, style]}>
      {/* ① 대체 화면 — 항상 맨 아래에 깔린다 */}
      <FallbackArt countryKo={countryKo} theme={theme} gradientId={ids.fallback} />

      {/* ② 사진 */}
      {showPhoto ? (
        <Image
          source={{ uri: photoUrl }}
          onError={() => setFailed(true)}
          resizeMode="cover"
          style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}
          accessible={false}
        />
      ) : null}

      {/* ③ 글자를 읽히게 하는 어두운 그라디언트 */}
      {scrim ? (
        <Svg
          width="100%"
          height="100%"
          style={{ position: 'absolute', left: 0, top: 0 }}
          pointerEvents="none"
        >
          <Defs>
            <LinearGradient id={ids.scrim} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#000000" stopOpacity={0} />
              <Stop offset={SCRIM_START} stopColor="#000000" stopOpacity={0} />
              <Stop offset="1" stopColor="#000000" stopOpacity={SCRIM_OPACITY} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${ids.scrim})`} />
        </Svg>
      ) : null}

      {/* ④ 얹는 내용 */}
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

/**
 * 사진이 없을 때의 화면.
 *
 * 국가 테마 두 색으로 비스듬한 그라디언트를 깔고 그 위에 기존 랜드마크
 * 실루엣(lib/constants/countryLandmark)을 크게 얹는다.
 * 실루엣은 흰색을 아주 옅게 써서 사진 대신 분위기만 낸다.
 */
function FallbackArt({
  countryKo,
  theme,
  gradientId,
}: {
  countryKo: string | null;
  theme: CountryTheme;
  gradientId: string;
}) {
  const landmark = countryLandmark(countryKo);

  return (
    <View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={theme.primary} />
            <Stop offset="1" stopColor={theme.neutral} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradientId})`} />
      </Svg>

      {/* 실루엣은 아래쪽에 붙인다. 좌표계의 y = 60 이 지면이다. */}
      <Svg
        width="100%"
        height="70%"
        viewBox={landmark.viewBox}
        preserveAspectRatio="xMidYMax meet"
        style={{ position: 'absolute', left: 0, bottom: 0, opacity: 0.22 }}
      >
        {landmark.paths.map((path, index) => (
          <Path key={index} d={path.d} fill="#FFFFFF" fillRule={path.fillRule} />
        ))}
        {(landmark.circles ?? []).map((circle, index) => (
          <Circle key={index} cx={circle.cx} cy={circle.cy} r={circle.r} fill="#FFFFFF" />
        ))}
      </Svg>
    </View>
  );
}
