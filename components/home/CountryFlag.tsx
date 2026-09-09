// ============================================================================
// 국기 이미지 (2026-09-07)
//
// ⚠️ **왜 이모지를 안 쓰는가.**
//    국기 이모지('🇹🇼')는 그림 한 글자가 아니다. 지역 표시 문자 두 개(T·W)를
//    나란히 놓은 것이고, 폰트가 그 쌍을 국기로 합쳐 그린다.
//    그런데 **윈도우에는 국기 글꼴이 없다.** 마이크로소프트가 영토 분쟁 문제로
//    넣지 않아서, 합치지 못하고 'TW' 라는 글자 두 개가 그대로 보인다.
//    개발·시연을 윈도우에서 하면 국기 자리마다 국가 코드가 뜬다.
//    그림 파일을 쓰면 어느 기기에서나 같은 국기가 나온다.
//
// ⚠️ 국가 코드는 countryTheme.code 를 그대로 쓴다. 이미 ISO 두 글자
//    ('JP'·'FR'·'TW'…)로 들어 있어서 새로 표를 만들 이유가 없다.
//    국가를 모르는 목적지는 '--' 라서 아무것도 그리지 않는다.
//
// ⚠️ 원격 이미지다. 안 뜰 수 있다.
//    실패하면 이모지로 되돌아간다. 윈도우에서는 그마저 글자로 보이지만,
//    사용자가 쓰는 폰(iOS·안드로이드)에서는 제대로 된 국기가 나온다.
//    빈 자리로 두는 것보다 낫다.
//
// ⚠️ 국기 그림을 앱에 넣지 않고 CDN 을 쓴다.
//    나라가 늘 때마다 그림 파일을 만들어 넣는 일을 피하려는 판단이다.
//    앱 용량도 늘지 않는다. 오프라인에서 안 보이는 것이 대가다.
//    (같은 배너의 랜드마크 사진도 이미 원격이라 조건이 다르지 않다)
//    [검토 필요] 오프라인 지원이 요구사항이 되면 assets 로 옮긴다.
// ============================================================================
import { useState } from 'react';
import { Image, Text, View } from 'react-native';

type Props = {
  /** ISO 두 글자 국가 코드. countryTheme(countryKo).code 를 넣는다. */
  code: string;
  /** 그림을 못 불러왔을 때 대신 쓸 국기 이모지. */
  emoji: string;
  /** 국기 높이. 폭은 3:2 비율로 따라간다. */
  height?: number;
  /**
   * 테두리 색.
   *
   * ⚠️ 배경에 따라 반대로 줘야 한다. 일본 국기처럼 바탕이 흰 국기는 테두리가
   *    없으면 경계가 사라져 빨간 동그라미만 떠 있는 것처럼 보인다.
   *    어두운 사진 위에서는 흰 테두리가, 흰 카드 위에서는 어두운 테두리가 보인다.
   *    쓰는 쪽이 자기 배경을 아니까 여기서 정하지 않고 받는다.
   */
  borderColor?: string;
};

/** 국가를 모를 때 countryTheme 이 주는 값. 이때는 그리지 않는다. */
const UNKNOWN_CODE = '--';

export function CountryFlag({ code, emoji, height = 13, borderColor = '#ffffff80' }: Props) {
  const [failed, setFailed] = useState(false);

  if (code === UNKNOWN_CODE) return null;

  if (failed) {
    return <Text style={{ fontSize: height + 2 }}>{emoji}</Text>;
  }

  // 대부분의 국기가 3:2 다. 아닌 국기도 이 칸 안에 맞춰 넣는다(contain).
  const width = Math.round(height * 1.5);

  return (
    <View
      style={{
        width,
        height,
        borderRadius: 2.5,
        overflow: 'hidden',
        borderWidth: 0.5,
        borderColor,
      }}
    >
      <Image
        // w40 은 40px 폭이다. 화면에 19pt 로 그리므로 2배 화면에서도 충분하다.
        source={{ uri: `https://flagcdn.com/w40/${code.toLowerCase()}.png` }}
        onError={() => setFailed(true)}
        resizeMode="cover"
        style={{ width: '100%', height: '100%' }}
        // 국가명이 바로 옆에 글자로 있다. 낭독기가 같은 정보를 두 번 읽지 않게 한다.
        accessible={false}
      />
    </View>
  );
}
