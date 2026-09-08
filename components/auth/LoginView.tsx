import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  loading: boolean;
  /** 실패했을 때 보여줄 한 줄. 없으면 그리지 않는다. */
  errorMessage: string | null;
  onPressKakao: () => void;
  onPressTerms: () => void;
  onPressPrivacy: () => void;
};

/** 카카오 브랜드 색. 카카오가 지정한 값이라 pot 토큰을 쓰지 않는다. */
const KAKAO_YELLOW = '#FEE500';
const KAKAO_LABEL = '#191600';

/**
 * 로그인 화면.
 *
 * 카카오 하나뿐이다. 회원가입·이메일 로그인·SNS 선택 화면을 두지 않는다.
 * (2026-09-07 MVP 인증 정책)
 *
 * ⚠️ supabase · track() 을 직접 부르지 않는다. 화면 파일이 부른다. (CLAUDE.md 9장)
 */
export function LoginView({
  loading,
  errorMessage,
  onPressKakao,
  onPressTerms,
  onPressPrivacy,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    // ⚠️ 위쪽 padding 으로 브랜드 영역을 밀어 내리지 않는다. 기기마다 화면
    //    높이가 달라 어떤 기기에서는 가운데, 어떤 기기에서는 위로 붙는다.
    //    브랜드 블록이 남는 공간을 flex-1 로 다 가져가고 그 안에서 가운데
    //    정렬하면 화면 크기와 무관하게 늘 같은 자리에 온다.
    <View
      className="flex-1 bg-white px-6"
      style={{ paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 24) + 12 }}
    >
      {/* 브랜드 영역 — 로고와 설명문을 한 덩어리로 묶어 가운데 둔다.
          아래 CTA 블록은 자기 높이만 쓰므로 이 블록에 밀리지 않는다. */}
      <View className="flex-1 items-center justify-center">
        {/*
          ⚠️ 확정된 로고 파일을 그대로 쓴다. (assets/logo.png)
             홈 상단바가 쓰는 것과 같은 파일이다. (components/home/HomeHeader)
             복사본을 만들거나 아이콘으로 대신 그리지 않는다.
             비율은 resizeMode="contain" 이 지킨다. 크기만 로그인 화면에 맞게
             키웠다. (홈 34x28 → 여기 102x84)
        */}
        <Image
          source={require('@/assets/logo.png')}
          style={{ width: 102, height: 84 }}
          resizeMode="contain"
          accessibilityRole="image"
          accessibilityLabel="TripPot"
        />

        {/* 로고와 설명문 사이. mt-5(20) 은 둘이 붙어 보였다. mt-9(36) 이면
            떨어져 보이지 않으면서 한 그룹으로 읽힌다. */}
        <Text
          className="mt-9 text-center text-pot-mute"
          style={{ fontSize: 14, lineHeight: 21 }}
        >
          여행 준비부터 자금 관리까지{'\n'}TripPot과 함께하세요.
        </Text>
      </View>

      <View>
        {errorMessage ? (
          <Text
            className="mb-3 text-center text-pot-mute"
            style={{ fontSize: 12.5, lineHeight: 18 }}
          >
            {errorMessage}
          </Text>
        ) : null}

        {/*
          ⚠️ 공용 Button 을 쓰지 않는다. 카카오는 지정된 노란 배경과 갈색 글자를
             써야 하는데 그 조합이 Button 의 variant 에 없다. 새 variant 를
             만들면 카카오 전용 색이 앱 공용 버튼에 들어간다.
        */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="카카오로 시작하기"
          accessibilityState={{ disabled: loading, busy: loading }}
          disabled={loading}
          onPress={onPressKakao}
          className="h-14 flex-row items-center justify-center rounded-xl active:opacity-80"
          style={{ backgroundColor: KAKAO_YELLOW, opacity: loading ? 0.6 : 1 }}
        >
          {loading ? (
            <ActivityIndicator color={KAKAO_LABEL} />
          ) : (
            <>
              <Ionicons name="chatbubble" size={17} color={KAKAO_LABEL} />
              <Text
                className="ml-2 font-semibold"
                style={{ fontSize: 15.5, color: KAKAO_LABEL }}
              >
                카카오로 시작하기
              </Text>
            </>
          )}
        </Pressable>

        <View className="mt-5 flex-row items-center justify-center">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="이용약관"
            hitSlop={8}
            onPress={onPressTerms}
            className="px-1 active:opacity-60"
          >
            <Text className="text-pot-faint" style={{ fontSize: 11.5 }}>
              이용약관
            </Text>
          </Pressable>
          <Text className="text-pot-faint" style={{ fontSize: 11.5 }}>
            {'  ·  '}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="개인정보처리방침"
            hitSlop={8}
            onPress={onPressPrivacy}
            className="px-1 active:opacity-60"
          >
            <Text className="text-pot-faint" style={{ fontSize: 11.5 }}>
              개인정보처리방침
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
