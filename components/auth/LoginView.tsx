import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  loading: boolean;
  /** 실패했을 때 보여줄 한 줄. 없으면 그리지 않는다. */
  errorMessage: string | null;
  onPressKakao: () => void;
  onPressGoogle: () => void;
  onPressEmail: () => void;
  /**
   * 초대 링크로 들어와 로그인이 필요한 경우. 설명문과 버튼 글자만 바뀐다.
   * 회원가입 화면은 없다 — 소셜 로그인 = 로그인 + 필요하면 계정 생성. (2026-09-16)
   */
  inviteContext?: boolean;
  onPressTerms: () => void;
  onPressPrivacy: () => void;
  /**
   * 개발용 미리보기 진입을 그릴지.
   *
   * ⚠️ 화면 파일이 __DEV__ 를 넘긴다. production 번들에서는 false 로 굳어
   *    이 블록 전체가 그려지지 않는다. (app/login.tsx)
   */
  showDevPreview: boolean;
  /**
   * [개발용] 신규 사용자 홈(여행 0개)으로 들어가는 통로. (2026-09-16 · HOME-01 담당)
   *
   * ⚠️ seed 사용자 넷은 모두 여행이 있어서, 여행이 하나도 없는 사람의 홈을
   *    볼 방법이 없었다. 이 버튼은 **화면만** 그렇게 그린다. DB 에는 쓰지 않는다.
   * ⚠️ 넘기지 않으면 칩이 그려지지 않는다. showDevPreview 와 함께 사라진다.
   */
  onPressDevPreviewNewUser?: () => void;
};

/** 카카오 브랜드 색. 카카오가 지정한 값이라 pot 토큰을 쓰지 않는다. */
const KAKAO_YELLOW = '#FEE500';
const KAKAO_LABEL = '#191600';

/**
 * 로그인 화면.
 *
 * 카카오 · 구글 · 이메일 셋이다. 카카오가 첫 번째다.
 * (2026-09-07 카카오 단일 → 2026-09-16 확대 · 테스트 빌드 보안 점검 필수 2)
 *
 * ⚠️ 이메일은 화면을 따로 두지 않고 이 화면 안에서 EmailAuthView 로 바꿔 끼운다.
 *    app/_layout.tsx 가드가 'login' 세그먼트만 로그인 전 화면으로 열어 두기 때문이다.
 *
 * ⚠️ supabase · track() 을 직접 부르지 않는다. 화면 파일이 부른다. (CLAUDE.md 9장)
 */
export function LoginView({
  loading,
  errorMessage,
  onPressKakao,
  onPressGoogle,
  onPressEmail,
  inviteContext = false,
  onPressTerms,
  onPressPrivacy,
  showDevPreview,
  onPressDevPreviewNewUser,
}: Props) {
  const insets = useSafeAreaInsets();
  // 초대로 왔으면 "계속하기" — 이미 하던 일(초대 확인)을 이어간다는 뜻이다.
  const kakaoLabel = inviteContext ? '카카오로 계속하기' : '카카오로 시작하기';

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
        {inviteContext ? (
          <Text
            className="mt-9 text-center text-pot-ink"
            style={{ fontSize: 18, lineHeight: 26, fontWeight: '800', letterSpacing: -0.4 }}
          >
            여행 초대를 받았어요
          </Text>
        ) : null}
        <Text
          className={`${inviteContext ? 'mt-2' : 'mt-9'} text-center text-pot-mute`}
          style={{ fontSize: 14, lineHeight: 21 }}
        >
          {inviteContext
            ? '여행 정보를 확인하고 참여하려면\nTripPot 로그인이 필요해요.'
            : '여행 준비부터 자금 관리까지\nTripPot과 함께하세요.'}
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
          accessibilityLabel={kakaoLabel}
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
                {kakaoLabel}
              </Text>
            </>
          )}
        </Pressable>

        {/*
          구글 · 이메일. (2026-09-16 · 보안 점검 필수 2)
          ⚠️ 카카오가 첫 번째다. 지금 쓰는 사람 대부분이 카카오로 들어온다.
          ⚠️ 구글 버튼은 구글 브랜드 규정을 따라 **흰 바탕 + 테두리**다.
             카카오 노랑처럼 색을 칠하지 않는다.
        */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Google로 시작하기"
          accessibilityState={{ disabled: loading, busy: loading }}
          disabled={loading}
          onPress={onPressGoogle}
          className="mt-3 h-14 flex-row items-center justify-center rounded-xl border border-pot-line bg-white active:opacity-80"
          style={{ opacity: loading ? 0.6 : 1 }}
        >
          <Ionicons name="logo-google" size={17} color="#4285F4" />
          <Text className="ml-2 font-semibold text-pot-ink" style={{ fontSize: 15.5 }}>
            Google로 시작하기
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="이메일로 시작하기"
          accessibilityState={{ disabled: loading }}
          disabled={loading}
          onPress={onPressEmail}
          className="mt-3 h-14 flex-row items-center justify-center rounded-xl border border-pot-line bg-white active:opacity-80"
          style={{ opacity: loading ? 0.6 : 1 }}
        >
          <Ionicons name="mail-outline" size={17} color="#111827" />
          <Text className="ml-2 font-semibold text-pot-ink" style={{ fontSize: 15.5 }}>
            이메일로 시작하기
          </Text>
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

        {/*
          개발용 미리보기.

          ⚠️ 실제 사용자 기능이 아니다. '둘러보기' 처럼 읽히면 안 되므로
             '개발용' 을 문구에 그대로 둔다.
          ⚠️ 카카오 버튼과 약관 줄의 디자인·위치를 건드리지 않는다. 이 블록만
             맨 아래에 덧붙인다. showDevPreview 가 false 면 통째로 사라지고
             레이아웃도 원래대로 돌아간다.
        */}
        {showDevPreview ? (
          <View className="mt-4 items-center" style={{ gap: 6 }}>
            <Text className="text-pot-faint" style={{ fontSize: 11.5, lineHeight: 16 }}>
              개발용으로 둘러보기
            </Text>
            {/*
              ⚠️ seed 사용자 이름 칩(지수·민준…)은 2026-09-17 에 뺐다.
                 미리보기는 Supabase 세션이 없어 서버가 로그인 전 사용자(anon)로 본다.
                 권한 전환(20260916000008 이후) 뒤로 anon 은 여행·모임·글을 읽을 수 없어
                 칩으로 들어가면 빈 화면만 나온다. 데이터 확인은 실제 로그인으로 한다.

              [개발용] 여행이 하나도 없는 사람의 홈. 조회 결과와 무관하게 그리므로 남긴다.
            */}
            {onPressDevPreviewNewUser ? (
              <Text
                accessibilityRole="button"
                accessibilityLabel="새 유저 홈으로 둘러보기"
                onPress={onPressDevPreviewNewUser}
                suppressHighlighting
                className="rounded-full border border-dashed border-pot-line px-3 py-1.5 text-pot-mute"
                style={{ fontSize: 12, lineHeight: 16 }}
              >
                새 유저 홈 (여행 0개)
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}
