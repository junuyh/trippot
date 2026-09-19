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
import { useCallback, useRef, useState } from 'react';
import { Alert, InteractionManager, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  LogoutConfirmModal,
  MenuRow,
  MenuSection,
  NotificationBellButton,
  TravelPassportPanel,
  type MyProfile,
  type MyTripCounts,
} from '@/components/mypage';
import { ErrorState, Header, Loading } from '@/components/ui';
import { SCREENS } from '@/lib/analytics/events';
import { useAuth, useCurrentUserId } from '@/lib/auth/AuthProvider';
import { TRIP_STATUS } from '@/lib/constants/status';
import { useScreenView } from '@/lib/hooks/useScreenView';
import { getMyParticipatingTrips } from '@/lib/supabase/queries/trips';
import { prepareProfileImage } from '@/lib/image/profileImage';
import { getUserProfile, updateProfileImageUrl } from '@/lib/supabase/queries/users';
import {
  ProfileImageTooLargeError,
  deleteProfileImage,
  uploadProfileImage,
} from '@/lib/supabase/storage/profileImage';
import { isTripBeforeDeparture } from '@/lib/trip/tripStatus';

type LoadState = 'loading' | 'ready' | 'error';

export default function ScreenMY01() {
  useScreenView(SCREENS.MY_PAGE);

  const router = useRouter();
  // 로그인한 사용자. 가드가 미로그인 상태를 막고 있어 여기서는 항상 값이 있다.
  const userId = useCurrentUserId();
  // signOut 은 미리보기와 실제 로그인을 알아서 가른다. (lib/auth/AuthProvider)
  const { signOut } = useAuth();
  // 탭 헤더를 껐다. 상태바 높이만큼은 여기서 띄운다. (커뮤니티와 같은 방식)
  const insets = useSafeAreaInsets();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  /**
   * 이번 실행에서 고른 사진의 기기 경로.
   *
   * 업로드가 끝나도 비우지 않는다. 비우면 같은 사진을 원격 URL 로 다시 내려받는
   * 동안 빈 원이 보인다. 앱을 다시 켜면 사라지고 profile.profileImageUrl 로 그린다.
   */
  const [pickedImageUri, setPickedImageUri] = useState<string | null>(null);
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [counts, setCounts] = useState<MyTripCounts>({ planning: 0, traveling: 0, past: 0 });
  /** 프로필 사진 업로드 중. 중복 제출을 막는다. */
  const [savingImage, setSavingImage] = useState(false);
  /**
   * 사진 고르기 ~ 저장까지 **한 번에 하나만.** (2026-09-20 · 프로필 사진 시트 간헐 오류 대응)
   *
   * ⚠️ savingImage 는 사진을 고른 **뒤**에야 true 가 된다. 그 전 — 권한 확인 · 네이티브
   *    사진 선택기가 뜨는 사이 — 에는 아무 가드가 없어서, 사진 칸과 연필 배지(같은 handler)를
   *    연달아 누르면 launchImageLibraryAsync 가 두 번 불렸다. expo-image-picker(iOS) 는
   *    진행 중인 선택을 막지 않고 currentPickingContext 를 덮어쓴 채 present 를 한 번 더
   *    시도한다(ImagePickerModule.swift presentPickerUI). 그러면 먼저 띄운 선택기의 Promise 는
   *    영영 돌아오지 않고, 두 번째 present 는 이미 떠 있는 선택기 위에서 조용히 실패한다.
   *    state 가 아니라 ref 인 이유: setSavingImage 직후 재렌더 전의 탭은 이전 closure 를 본다.
   */
  const pickingRef = useRef(false);
  /** 로그아웃 확인창 노출 여부. Alert 대신 Modal 을 쓰는 이유는 아래 주석 참고. */
  const [logoutAsking, setLogoutAsking] = useState(false);

  const load = useCallback(async () => {
    try {
      if (!userId) return;

      const [user, trips] = await Promise.all([getUserProfile(userId), getMyParticipatingTrips(userId)]);

      if (!user) {
        setLoadState('error');
        return;
      }

      // ⚠️ 내가 **실제로 참가 중인** 여행만 센다. 모임에만 속해 있고 그 여행에서
      //    빠졌다면 여기 개수에 들어가지 않는다. (2026-09-09 확정)
      //    공용 getTrips 는 그대로 두고 MY 전용 함수로 한 겹 걸렀다.
      // 준비 중(PLANNING) / 여행 중(TRAVELING) / 지난(ENDED·SETTLED).
      // ⚠️ trips.status 로만 가른다. 날짜로 다시 판정하지 않는다.
      //    /me/trips 목록이 쓰는 기준과 같아야 카드 숫자와 목록 건수가 맞는다.
      //    (app/me/trips.tsx:144-146)
      // ⚠️ 취소 요청 중도 '준비 중' 으로 센다. (MY-02 목록과 같은 기준)
      const planning = trips.filter((trip) => isTripBeforeDeparture(trip.status)).length;
      const traveling = trips.filter((trip) => trip.status === TRIP_STATUS.TRAVELING).length;
      const past = trips.filter(
        (trip) => trip.status === TRIP_STATUS.ENDED || trip.status === TRIP_STATUS.SETTLED,
      ).length;

      setProfile({
        name: user.name,
        // 여권 ENGLISH NAME. 계정관리(/me/account)에서만 바꾼다. 없으면 '—'.
        englishName: user.english_name,
        profileImageUrl: user.profile_image_url,
        // 여권 MEMBER SINCE. users.created_at = 이 계정으로 TripPot 에 처음 들어온 날.
        memberSince: user.created_at ?? null,
      });
      setCounts({ planning, traveling, past });
      setLoadState('ready');
    } catch {
      // 예외 객체를 화면에 그대로 노출하지 않는다. (components/ui/ErrorState)
      setLoadState('error');
    }
  }, [userId]);

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
    // 중복 제출 방지. 고르는 중 · 업로드 중에 다시 눌러도 무시한다. (CLAUDE.md 9장)
    if (pickingRef.current || savingImage) return;
    pickingRef.current = true;

    try {
    let result: ImagePicker.ImagePickerResult;
    try {
      // 권한창이 **실제로 떴는지** 를 기억한다. 아래 지연은 그때만 건다.
      const before = await ImagePicker.getMediaLibraryPermissionsAsync();
      const permission = before.granted
        ? before
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('사진 접근 권한이 필요해요', '설정에서 사진 접근을 허용해 주세요.');
        return;
      }

      /**
       * ⚠️ 시스템 권한창이 **막 내려가는 중**에 사진 선택기를 띄우면 iOS 가 present 를 삼킨다.
       *    (funds/index.tsx · components/ui/BottomSheet onDismiss 주석과 같은 부류)
       *    그러면 네이티브 쪽에는 "고르는 중" 컨텍스트만 남고 화면에는 아무것도 없어,
       *    다음 탭이 그 컨텍스트를 덮어쓸 때까지 눌러도 반응이 없다.
       *    권한창을 지금 띄웠을 때만 애니메이션이 끝날 여유를 준 뒤 연다.
       */
      if (!before.granted) {
        await new Promise<void>((resolve) => {
          InteractionManager.runAfterInteractions(() => setTimeout(resolve, 350));
        });
      }

      result = await ImagePicker.launchImageLibraryAsync({
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
    } catch {
      // 선택기 자체를 못 띄운 경우(다른 화면이 뜨거나 내려가는 중 · 권한 모듈 오류).
      // 전에는 처리되지 않은 rejection 으로 새어 나가 LogBox 만 떴다. 화면은 그대로 쓸 수 있어야 한다.
      Alert.alert('사진을 열지 못했어요', '잠시 후 다시 시도해 주세요.');
      return;
    }

    if (result.canceled) return;

    const asset = result.assets[0];

    if (!userId) return;
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
    } finally {
      // 어떤 경로로 나가든 다음 탭을 막지 않는다. (선택 · 취소 · 권한 거부 · 예외 · 업로드 성공/실패 모두)
      pickingRef.current = false;
    }
  }, [savingImage, profile, userId]);

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
   * 목록 화면이 filter 파라미터를 열어 두었다. 기본은 준비 중이고
   * traveling · past 로 다른 탭을 열 수 있다. (app/me/trips.tsx — toFilter)
   *
   * 카드 셋이 목록의 탭 셋과 1:1 이다. 카드 숫자와 그 탭의 목록 건수가 같다.
   */
  function handlePressPlanningTrips() {
    router.push('/me/trips?filter=planning');
  }

  function handlePressTravelingTrips() {
    router.push('/me/trips?filter=traveling');
  }

  function handlePressPastTrips() {
    router.push('/me/trips?filter=past');
  }

  function handlePressMyPosts() {
    router.push('/me/posts');
  }

  // ⚠️ 화면과 이동 경로만 있다. 내가 쓴 댓글을 가져오는 query 는 아직 없어
  //    그 화면은 빈 상태만 보여준다. (app/me/comments.tsx)
  function handlePressMyComments() {
    router.push('/me/comments');
  }

  function handlePressMyLikes() {
    router.push('/me/likes');
  }

  function handlePressMyBookmarks() {
    router.push('/me/bookmarks');
  }

  /**
   * 헤더 알림 아이콘. 받은 알림 목록으로 간다.
   *
   * ⚠️ /me/settings/notifications(어떤 알림을 받을지)와 다른 화면이다.
   *    이 버튼 = 실제로 받은 알림 (/me/notifications). 알림 설정 메뉴는 MY 에서 뺐다.
   */
  function handlePressNotifications() {
    router.push('/me/notifications');
  }

  // ⚠️ 두 문서 모두 MVP 검증용 임시 원문이다. 정식 문서는 확정 후 교체한다.
  function handlePressTerms() {
    router.push('/me/settings/terms');
  }

  function handlePressPrivacy() {
    router.push('/me/settings/privacy');
  }

  function handlePressAccount() {
    router.push('/me/account');
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
   * 세션을 지우면 AuthProvider 가 signedOut 을 받고 가드가 /login 으로 옮긴다.
   * 여기서 router 를 부르지 않는다. 두 곳이 같이 옮기면 화면이 두 번 바뀐다.
   *
   * ⚠️ 개발용 미리보기에서도 같은 함수를 쓴다. 그때는 Supabase 를 부르지 않고
   *    미리보기만 끝낸다. 분기는 AuthProvider 안에 한 번만 둔다.
   */
  async function handleConfirmLogout() {
    setLogoutAsking(false);
    try {
      await signOut();
    } catch {
      // 세션 삭제에 실패하면 로그인 상태가 유지된다. 화면은 그대로 둔다.
      Alert.alert('로그아웃하지 못했어요', '잠시 후 다시 시도해 주세요.');
    }
  }

  // 상단바는 로딩·오류일 때도 같은 자리에 있어야 한다.
  // 커뮤니티와 같은 공통 Header 를 쓴다. 같은 컴포넌트라 높이·제목 단이 같다.
  const header = (
    <View className="bg-white" style={{ paddingTop: insets.top }}>
      <Header
        title="마이페이지"
        showBack={false}
        right={<NotificationBellButton onPress={handlePressNotifications} />}
      />
    </View>
  );

  if (loadState === 'loading') {
    return (
      <View className="flex-1 bg-white">
        {header}
        <Loading message="프로필을 불러오고 있어요" />
      </View>
    );
  }

  if (loadState === 'error' || !profile) {
    return (
      <View className="flex-1 bg-white">
        {header}
        <ErrorState message="내 정보를 불러오지 못했어요." onRetry={() => void load()} />
      </View>
    );
  }

  // 화면은 두 영역으로 읽힌다.
  //   위   — "TripPot 여행 여권" 패널. 프로필 · 내 여행 (2026-09-13)
  //          흰 헤더 아래 연라벤더 종이 한 장이 섬처럼 놓인다. 상단 전체를
  //          칠하지 않는다. 헤더도 흰색 그대로다.
  //   아래 — navigation 과 action.  커뮤니티 · 설정 · 로그아웃 (흰 바탕)
  //
  // ⚠️ ScrollView 자체는 흰색이다. 내용이 짧아 아래가 남을 때 그 빈자리가
  //    하단 영역과 이어져야 한다.
  //
  // ⚠️ pb-28 은 하단 탭바 자리다. FloatingTabBar 가 화면 위에 떠 있어(absolute)
  //    내용을 가린다. 바 높이 64 + 안전영역(최소 18)을 덮는 값이다.
  //    홈·커뮤니티도 같은 값을 쓴다. (app/(tabs)/_layout.tsx 주석)
  //
  // 가로 여백은 홈과 같은 px-4 다. (HomeView)
  return (
    <View className="flex-1 bg-white">
      {header}

      <ScrollView className="flex-1 bg-white" contentContainerClassName="pb-28">
      {/* ── 상단: 여권 영역 (프로필 · 내 여행) — 흰 바탕 위에 놓인 여권 한 장(카드) ──── */}
      <TravelPassportPanel
        profile={profile}
        pickedImageUri={pickedImageUri}
        onPressChangeImage={() => void handleChangeProfileImage()}
        counts={counts}
        onPressPlanning={handlePressPlanningTrips}
        onPressTraveling={handlePressTravelingTrips}
        onPressPast={handlePressPastTrips}
      />

      {/* ── 하단: 메뉴 · action ───────────────────────────────────────────
          가로 여백 18 = 여행준비홈 계열(페이지 14 + 섹션 안쪽 4 · app/trips/[tripId]/index.tsx)과
          같은 content grid. 제목 · 메뉴 글자 · chevron 이 그 화면들과 같은 선에 선다. (2026-09-17) */}
      <View className="pt-8" style={{ paddingHorizontal: 18 }}>
        <MenuSection title="내 커뮤니티 활동">
          <MenuRow label="작성한 게시글" onPress={handlePressMyPosts} />
          <MenuRow label="작성한 댓글" onPress={handlePressMyComments} />
          <MenuRow label="저장된 게시물" onPress={handlePressMyBookmarks} />
          <MenuRow label="좋아요" onPress={handlePressMyLikes} isLast />
        </MenuSection>

        <View className="mt-7">
          <MenuSection title="설정">
            {/*
              알림 설정(/me/settings/notifications)은 메뉴에서 뺐다. (2026-09-17 MY Finalization)
              스위치 값은 users.notification_settings_json 에 저장되지만 알림을 만드는 RPC ·
              배너 · 목록 어디도 그 값을 읽지 않아 사용자에게 아무 효과가 없는 설정이었다.
              실제 preference 가 연결되면 다시 넣는다. 화면 파일은 그대로 둔다.
            */}
            <MenuRow label="계정 관리" onPress={handlePressAccount} />
            <MenuRow label="이용약관" onPress={handlePressTerms} />
            <MenuRow label="개인정보처리방침" onPress={handlePressPrivacy} isLast />
          </MenuSection>
        </View>

        {/*
          로그아웃은 navigation 이 아니라 action 이다.
          MenuRow 에 끼워 넣지 않고 여백을 띄워 위계를 구분한다.
        */}
        <View className="mt-7">
          {/*
            MenuRow 와 같은 높이(py-3.5 + 19 = 47)·글자 크기라 위 메뉴와 한 리듬이다.
            다른 점은 구분선·chevron 이 없고 글자가 조금 굵은 것 — "이동" 이 아니라
            "동작" 이라는 표시다. 아이콘은 두지 않는다. (2026-09-13)
            ⚠️ 색은 MenuRow 와 같은 text-pot-ink 다. pot-mute 는 비활성처럼 읽혀서
               실제로 눌리는 동작인데 못 누르는 것처럼 보였다.
               빨강으로 강조하지는 않는다. 로그아웃은 파괴적 동작이 아니다.
          */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="로그아웃"
            onPress={handlePressLogout}
            className="self-start py-3.5 active:opacity-60"
          >
            <Text className="font-semibold text-pot-ink" style={{ fontSize: 13.5, lineHeight: 19 }}>
              로그아웃
            </Text>
          </Pressable>
        </View>
      </View>

      <LogoutConfirmModal
        visible={logoutAsking}
        onCancel={() => setLogoutAsking(false)}
        onConfirm={() => void handleConfirmLogout()}
      />
      </ScrollView>
    </View>
  );
}
