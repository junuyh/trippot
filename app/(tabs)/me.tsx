// ============================================================================
// MY-01 · /me · MVP
// 기준: docs/09_IA_v1.md §5, docs/04_화면목록_v3.md MY-01
//       레이아웃·정보 위계는 Figma frame 79:374 참고
//
// 담는 것: 프로필 · 내 여행(개수) · 내 커뮤니티 활동 · 설정 · 로그아웃
//
// ⚠️ '나의 모임' 은 넣지 않는다. 하단 탭에 이미 '모임' 이 있어 같은 진입점을
//    두 번 두지 않는다. 그래서 getMyGroups() 도 부르지 않는다.
//
// ⚠️ MY-03 /me/community 와 MY-04 /me/settings 를 거치게 하지 않는다.
//    항목 수가 적어 MY-01 에서 바로 보여준다. 두 route 파일은 그대로 둔다.
//
// ⚠️ 색은 Figma 값을 그대로 쓰지 않는다. 시안 상단은 연파랑이지만 현재 정책은
//    "배경과 기본 카드는 항상 화이트·쿨그레이" 다. 상단/하단이 나뉜다는 구조만
//    가져오고 색은 pot.visual 로 바꾼다. (lib/constants/countryTheme.ts 규칙)
//
// 이 파일은 데이터 조회·상태 관리·로그 기록만 한다.
// 실제로 보이는 UI 는 components/mypage/ 에 있다. (CLAUDE.md 9장)
//
// 헤더·탭 라벨 제목은 app/(tabs)/_layout.tsx 에서 정한다.
// ============================================================================
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';

import {
  LogoutConfirmModal,
  MenuRow,
  MenuSection,
  ProfileSection,
  TripSummaryCards,
  type MyProfile,
  type MyTripCounts,
} from '@/components/mypage';
import { ErrorState, Loading } from '@/components/ui';
import { SCREENS } from '@/lib/analytics/events';
import { DEV_USER_ID } from '@/lib/constants/devUser';
import { AUTH_PROVIDER, TRIP_STATUS } from '@/lib/constants/status';
import { useScreenView } from '@/lib/hooks/useScreenView';
import { getTrips } from '@/lib/supabase/queries/trips';
import { prepareProfileImage } from '@/lib/image/profileImage';
import { getUserProfile, updateProfileImageUrl } from '@/lib/supabase/queries/users';
import {
  ProfileImageTooLargeError,
  deleteProfileImage,
  uploadProfileImage,
} from '@/lib/supabase/storage/profileImage';

type LoadState = 'loading' | 'ready' | 'error';

/**
 * 연결된 로그인 계정을 화면에 보여줄 문장으로 바꾼다.
 *
 * ⚠️ 계정 **식별자는 절대 넣지 않는다.** users.auth_provider_user_id 는
 *    `kakao_1001` 같은 내부 연동 ID 다. 사용자가 자기 계정으로 알아볼 수 없고,
 *    다른 서비스와 대조 가능한 값이라 화면에 내보내지 않는다.
 *    users 에 email 칼럼도 없다. 그래서 "무엇으로 로그인했는지" 만 알려준다.
 *
 * ⚠️ TODO: 실제 Kakao Auth 연동 후, 사용자에게 보여줄 계정 정보(카카오 닉네임 ·
 *    이메일 등)를 무엇으로 할지 정책이 확정되면 그 값으로 교체한다.
 *    그 전까지 임의의 Kakao ID 나 email 을 만들어 넣지 않는다.
 *
 * MVP 는 kakao 만 구현한다. (lib/constants/status.ts AUTH_PROVIDER)
 * 그 외 값이면 null 을 주고 화면에서 줄 자체를 그리지 않는다.
 */
function toAccountLabel(authProvider: string | null): string | null {
  if (authProvider === AUTH_PROVIDER.KAKAO) return '카카오 로그인';
  return null;
}

export default function ScreenMY01() {
  useScreenView(SCREENS.MY_PAGE);

  const router = useRouter();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  /**
   * 이번 실행에서 고른 사진의 기기 경로.
   *
   * 업로드가 끝나도 비우지 않는다. 비우면 같은 사진을 원격 URL 로 다시 내려받는
   * 동안 빈 원이 보인다. 앱을 다시 켜면 사라지고 profile.profileImageUrl 로 그린다.
   */
  const [pickedImageUri, setPickedImageUri] = useState<string | null>(null);
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [counts, setCounts] = useState<MyTripCounts>({ ongoing: 0, past: 0 });
  /** 프로필 사진 업로드 중. 중복 제출을 막는다. */
  const [savingImage, setSavingImage] = useState(false);
  /** 로그아웃 확인창 노출 여부. Alert 대신 Modal 을 쓰는 이유는 아래 주석 참고. */
  const [logoutAsking, setLogoutAsking] = useState(false);

  const load = useCallback(async () => {
    try {
      // TODO: 로그인 연동 시 교체
      const userId = DEV_USER_ID;

      const [user, trips] = await Promise.all([getUserProfile(userId), getTrips(userId)]);

      if (!user) {
        setLoadState('error');
        return;
      }

      // 진행중(PLANNING·TRAVELING) / 지난(ENDED·SETTLED).
      // HOME-01 과 같은 기준이다. (app/(tabs)/index.tsx)
      const ongoing = trips.filter(
        (trip) =>
          trip.status === TRIP_STATUS.PLANNING || trip.status === TRIP_STATUS.TRAVELING,
      ).length;
      const past = trips.filter(
        (trip) => trip.status === TRIP_STATUS.ENDED || trip.status === TRIP_STATUS.SETTLED,
      ).length;

      setProfile({
        name: user.name,
        accountLabel: toAccountLabel(user.auth_provider),
        profileImageUrl: user.profile_image_url,
      });
      setCounts({ ongoing, past });
      setLoadState('ready');
    } catch {
      // 예외 객체를 화면에 그대로 노출하지 않는다. (components/ui/ErrorState)
      setLoadState('error');
    }
  }, []);

  // 여행을 만들거나 끝내고 돌아오면 개수가 달라져 있다.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // ── 목적지가 아직 없는 항목들 ──────────────────────────────────────────
  //
  // 아래는 전부 이동할 화면이 확정되지 않았다. 임의 route 를 만들지 않고,
  // 빈 스텁이나 가짜 링크로도 연결하지 않는다. 확정되면 여기만 채우면 된다.

  /**
   * 프로필 사진 변경. 고르기 → 업로드 → DB 갱신 → 이전 파일 삭제.
   *
   * 순서가 중요하다. **새 이미지 업로드와 DB 갱신이 모두 성공한 뒤에만**
   * 이전 파일을 지운다. 먼저 지우면 중간에 실패했을 때 사진이 사라진다.
   *
   * 실패하면 화면을 원래 사진으로 되돌리고, 방금 올린 파일은 정리한다.
   */
  const handleChangeProfileImage = useCallback(async () => {
    // 중복 제출 방지. 업로드 중에 다시 눌러도 무시한다. (CLAUDE.md 9장)
    if (savingImage) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('사진 접근 권한이 필요해요', '설정에서 사진 접근을 허용해 주세요.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],

      // ⚠️ allowsEditing 을 켜지 않는다. 켜면 iOS 가 구형 UIImagePickerController 로
      //    떨어져 사진첩이 눈에 띄게 늦게 열린다. 앱이 라이브러리를 직접 읽기 때문이다.
      //    끄면 PHPickerViewController 를 써서 훨씬 빨리 열린다.
      //    (expo-image-picker ios/ImagePickerModule.swift 의 `if !options.allowsEditing`)
      //
      //    자르기 화면은 사라지지만 프로필은 85pt 원이고, ProfileSection 이
      //    resizeMode="cover" 로 그려서 어떤 비율이든 가운데를 채워 보여준다.

      // ⚠️ compatible 을 주지 않으면 아이폰 사진이 **HEIC 원본 그대로** 넘어온다.
      //    네이티브 기본값이 current 라 원본 표현을 주기 때문이다.
      //    아래에서 image/jpeg 로 이름 붙여 올리므로 HEIC 가 오면 내용과 형식이
      //    어긋나 깨진 이미지가 저장된다. Storage 허용 MIME 에도 HEIC 는 없다.
      //    compatible 이면 iOS 가 읽는 시점에 JPEG 로 바꿔 준다.
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,

      // ⚠️ 1 미만이어야 재인코딩 경로를 타서 결과가 JPEG 로 확정된다.
      //    1 이면 원본 파일을 그대로 복사해 형식이 남는다.
      //    (ios/ImageUtils.swift readDataAndFileExtension 의 default 분기)
      //    화면에는 85pt 원으로만 보여서 0.6 이어도 차이가 보이지 않는다.
      quality: 0.6,

      // ⚠️ base64 를 여기서 받지 않는다. 원본 해상도의 base64 는 문자열이 수 MB 라
      //    브릿지를 건너오는 것만으로 느리다. 업로드에 쓸 base64 는 크기를 줄인
      //    뒤에 얻는다. (lib/image/profileImage.ts)
    });

    if (result.canceled) return;

    const asset = result.assets[0];

    // TODO: 로그인 연동 시 교체
    const userId = DEV_USER_ID;
    const previousUrl = profile?.profileImageUrl ?? null;

    setSavingImage(true);
    // 고른 즉시 보여준다. 업로드가 끝나면 DB 의 URL 로 바뀐다.
    setPickedImageUri(asset.uri);

    // 업로드는 됐는데 DB 갱신에서 실패하면 주인 없는 파일이 남는다. 그것만 지운다.
    let uploadedUrl: string | null = null;

    try {
      // 원본 그대로 올리면 고해상도 사진이 Storage 상한 2MB 를 넘는다.
      // 긴 변을 1024 로 줄이고 JPEG 로 다시 뽑는다. (lib/image/profileImage.ts)
      const prepared = await prepareProfileImage(asset.uri);

      // ⚠️ const 로 받는다. 아래에서 uploadedUrl 을 null 로 되돌리는데,
      //    setProfile 의 updater 는 나중에 실행되므로 그 변수를 그대로 읽으면
      //    null 이 들어가 방금 올린 사진이 화면에서 사라진다.
      const newUrl = await uploadProfileImage(userId, prepared.base64);
      uploadedUrl = newUrl;

      await updateProfileImageUrl(userId, newUrl);

      // 여기부터는 성공이다.
      setProfile((prev) => (prev ? { ...prev, profileImageUrl: newUrl } : prev));
      // 성공했으니 정리 대상이 아니다.
      uploadedUrl = null;

      // ⚠️ pickedImageUri 를 비우지 않는다.
      //    비우면 화면이 기기 파일 대신 방금 올린 **원격 URL** 로 그리기 시작해서,
      //    같은 사진을 네트워크로 다시 내려받는 동안 빈 원이 보인다.
      //    기기 파일을 그대로 두면 그 공백이 없다. 내용은 어차피 같은 사진이다.
      //    앱을 다시 켜면 이 값이 사라지고 profile.profileImageUrl 로 그린다.

      // 이전 파일 삭제는 마지막이다. 실패해도 사용자에게는 이미 성공이라
      // 화면을 되돌리지 않는다. 남은 파일은 다음에 정리한다.
      if (previousUrl) {
        await deleteProfileImage(previousUrl).catch(() => {});
      }
    } catch (error) {
      // 화면을 원래 사진으로 되돌린다.
      setPickedImageUri(null);
      if (uploadedUrl) {
        await deleteProfileImage(uploadedUrl).catch(() => {});
      }

      Alert.alert(
        error instanceof ProfileImageTooLargeError
          ? '사진이 너무 커요'
          : '사진을 저장하지 못했어요',
        error instanceof ProfileImageTooLargeError
          ? '2MB 이하의 사진을 골라 주세요.'
          : '잠시 후 다시 시도해 주세요.',
      );
    } finally {
      setSavingImage(false);
    }
  }, [savingImage, profile]);

  /**
   * 여행 카드 두 개는 '내 여행' 목록(/me/trips)으로 보낸다.
   *
   * ⚠️ /me/trips 는 마이페이지 전용 화면이 아니다. 홈 담당자가 만든 **공용
   *    목록 화면**이고 홈의 '전체 보기' 도 같은 곳으로 들어온다.
   *    (app/(tabs)/index.tsx 의 onPressAllTrips)
   *    그래서 이 화면의 목록·필터·분류 기준을 마이페이지 쪽에서 바꾸지 않는다.
   *    여기서 하는 일은 **올바른 진입 경로를 연결하는 것뿐**이다.
   *
   * ⚠️ 예전에는 둘 다 홈으로 보냈다. 홈이 진행 중과 지난 여행을 함께 보여줬기
   *    때문이다. 지금은 홈이 **진행 중인 여행만** 다뤄서
   *    '지난 여행' 을 홈으로 보내면 아무것도 없는 화면에 도착한다.
   *
   * 목록 화면이 filter 파라미터를 열어 두었다. 기본은 진행 중이고 past 면 지난 여행이다.
   * (app/me/trips.tsx — params.filter === 'past' ? 'past' : 'ongoing')
   * 분류 기준도 이 화면의 개수와 같다. 진행 중 = PLANNING·TRAVELING,
   * 지난 = ENDED·SETTLED 라 카드 숫자와 목록 길이가 어긋나지 않는다.
   */
  function handlePressOngoingTrips() {
    router.push('/me/trips');
  }

  function handlePressPastTrips() {
    router.push('/me/trips?filter=past');
  }

  // TODO: 커뮤니티 목적지 미확정.
  //       COMM 화면은 구현됐지만 getPosts() 에 author_user_id 필터가 없고
  //       댓글·좋아요 목록 조회 함수도 없다. "내가 쓴 것" 목적지가 아직 없다.
  function handlePressMyPosts() {}
  function handlePressMyComments() {}
  function handlePressMyLikes() {}

  function handlePressNotification() {
    router.push('/me/settings/notifications');
  }

  // ⚠️ 두 문서 모두 MVP 검증용 임시 원문이다. 정식 문서는 확정 후 교체한다.
  function handlePressTerms() {
    router.push('/me/settings/terms');
  }

  function handlePressPrivacy() {
    router.push('/me/settings/privacy');
  }

  /**
   * 로그아웃 확인.
   *
   * ⚠️ Alert.alert 을 쓰지 않는다. react-native-web 의 Alert 는 내용이 빈 함수라
   *    웹에서는 눌러도 아무 일이 없었다. Modal 은 웹에서도 제대로 동작해서
   *    iOS·Web 이 같은 UX 가 된다. (components/mypage/LogoutConfirmModal)
   */
  function handlePressLogout() {
    setLogoutAsking(true);
  }

  /**
   * 확인창에서 '로그아웃' 을 눌렀을 때.
   *
   * ⚠️ TODO: 실제 Auth 가 구현되면 여기서 signOut 을 부른다.
   *    지금은 로그인·세션이 없어 확인창을 닫기만 한다. 화면도 그대로 둔다.
   *    가짜 성공 처리나 navigation reset 을 넣지 않는다.
   */
  function handleConfirmLogout() {
    setLogoutAsking(false);
  }

  if (loadState === 'loading') {
    return <Loading message="프로필을 불러오고 있어요" />;
  }

  if (loadState === 'error' || !profile) {
    return <ErrorState message="내 정보를 불러오지 못했어요." onRetry={() => void load()} />;
  }

  return (
    // ⚠️ pb-28 은 하단 탭바 자리다. FloatingTabBar 가 화면 위에 떠 있어(absolute)
    //    내용을 가린다. 바 높이 64 + 안전영역(최소 18)을 덮는 값이다.
    //    홈·커뮤니티도 같은 값을 쓴다. (app/(tabs)/_layout.tsx 주석)
    <ScrollView className="flex-1 bg-white" contentContainerClassName="pb-28">
      {/* 상단 — 배경색으로 하단과 구분한다 */}
      <View className="bg-pot-visual px-5 pb-7 pt-6">
        <ProfileSection
          profile={profile}
          pickedImageUri={pickedImageUri}
          onPressChangeImage={() => void handleChangeProfileImage()}
        />

        <View className="mt-7">
          <TripSummaryCards
            counts={counts}
            onPressOngoing={handlePressOngoingTrips}
            onPressPast={handlePressPastTrips}
          />
        </View>
      </View>

      {/* 하단 — 흰 배경 */}
      <View className="px-5 pt-7">
        <MenuSection title="내 커뮤니티 활동">
          <MenuRow label="작성한 게시글" onPress={handlePressMyPosts} />
          <MenuRow label="작성한 댓글" onPress={handlePressMyComments} />
          <MenuRow label="좋아요" onPress={handlePressMyLikes} isLast />
        </MenuSection>

        <View className="mt-9">
          <MenuSection title="설정">
            <MenuRow label="알림 설정" onPress={handlePressNotification} />
            <MenuRow label="이용약관" onPress={handlePressTerms} />
            <MenuRow label="개인정보처리방침" onPress={handlePressPrivacy} isLast />
          </MenuSection>
        </View>

        {/*
          로그아웃은 navigation 이 아니라 action 이다.
          MenuRow 에 끼워 넣지 않고 여백을 크게 띄워 위계를 구분한다.
          텍스트만 두되 터치 영역은 padding 으로 충분히 확보한다.
        */}
        <View className="mt-8">
          <View className="self-start">
            <Text
              accessibilityRole="button"
              accessibilityLabel="로그아웃"
              onPress={handlePressLogout}
              suppressHighlighting
              // py-2.5 + leading-6 → 높이 44. 글자가 16 으로 커져도 터치 영역을 지킨다.
              className="py-2.5 text-base font-medium leading-6 text-pot-ink"
            >
              로그아웃
            </Text>
          </View>
        </View>
      </View>

      <LogoutConfirmModal
        visible={logoutAsking}
        onCancel={() => setLogoutAsking(false)}
        onConfirm={handleConfirmLogout}
      />
    </ScrollView>
  );
}
