// ============================================================================
// 계정관리 (MY-01 설정 → 계정 관리)
//
// 담는 것: 프로필 이름 변경 · 여권 영문 이름 변경 · 연결된 계정 표시 · 회원탈퇴
//
// ⚠️ 04_화면목록_v3.md 에 대응하는 화면 ID 가 없다. [검토 필요]
//    IA 5-1 '프로필' 과 5-5 '설정' 사이에 있는 기능인데 문서에는 계정관리가
//    없다. 문서를 코드에 맞춰 고치지 않는다. (CLAUDE.md 1-1)
//
// ⚠️ useScreenView 를 부르지 않는다. SCREENS 에 이 화면 상수가 없고,
//    events.ts 는 공유 파일이라 임의로 상수를 추가하지 않는다. (CLAUDE.md 8장)
//    /me/settings/notifications 와 같은 이유다.
// ============================================================================
import { Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView } from 'react-native';

import {
  AccountView,
  WithdrawConfirmModal,
  ENGLISH_NAME_MAX_LENGTH,
  NAME_MAX_LENGTH,
  type ConnectedAccount,
} from '@/components/mypage';
import { ErrorState, Loading } from '@/components/ui';
import { useAuth, useCurrentUserId } from '@/lib/auth/AuthProvider';
import { AUTH_PROVIDER } from '@/lib/constants/status';
import {
  getUserProfile,
  readOAuthProfile,
  readSessionAuthMethod,
  readSessionAuthProvider,
  toProductAuthProvider,
  updateUserEnglishName,
  updateUserName,
  WITHDRAWAL_ERROR,
  requestWithdrawal,
  withdrawalErrorCode,
} from '@/lib/supabase/queries/users';

type LoadState = 'loading' | 'ready' | 'error';

export default function ScreenMyAccount() {
  const userId = useCurrentUserId();
  // 로그인 방식 · 닉네임 · 이메일은 DB 가 아니라 세션에 있다. 아래 toConnectedAccount 주석 참고.
  // signOut 은 미리보기와 실제 로그인을 알아서 가른다. (lib/auth/AuthProvider)
  const { session, isPreview, signOut } = useAuth();

  const [loadState, setLoadState] = useState<LoadState>('loading');
  /** 저장된 이름. 입력값과 비교해 '바뀐 게 있는지' 를 판단한다. */
  const [savedName, setSavedName] = useState('');
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);

  /**
   * 여권 영문 이름. 이름과 같은 구조(저장값 · 입력값 · 오류 · 저장 중)를 따로 둔다.
   * ⚠️ 저장값은 DB 의 null 을 '' 로 들고 있다. 입력창은 null 을 받을 수 없다.
   *    저장할 때 다시 ''→null 로 바꾸는 건 updateUserEnglishName 이 한다.
   */
  const [savedEnglishName, setSavedEnglishName] = useState('');
  const [englishName, setEnglishName] = useState('');
  const [englishNameError, setEnglishNameError] = useState<string | null>(null);
  const [savingEnglishName, setSavingEnglishName] = useState(false);

  const [withdrawAsking, setWithdrawAsking] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  const [account, setAccount] = useState<ConnectedAccount | null>(null);

  /**
   * 연결된 계정 한 줄을 만든다.
   *
   * ⚠️ 닉네임은 users.name 이 아니라 **세션의 user_metadata** 에서 읽는다.
   *    users.name 은 사용자가 이 화면에서 바꿀 수 있는 값이라, 그걸 쓰면
   *    바로 위 '이름' 입력창과 같은 값이 두 번 보인다. 그리고 이름을 바꾼
   *    뒤에는 '어떤 카카오 계정인지' 를 알려주지 못한다.
   *
   * ⚠️ 계정 식별자(auth_provider_user_id)는 넣지 않는다. `kakao_1001` 같은
   *    내부 연동 ID 라 사용자가 알아볼 수 없다.
   *
   * 로그인 방식은 셋이다 — 카카오 · 구글 · 이메일. (2026-09-20 최종 정책 · 카카오 전용 정책 대체)
   *   카카오  기존 표시 그대로: `카카오 로그인 · 닉네임`
   *   구글    `Google` + 로그인한 구글 이메일
   *   이메일  `이메일` + 가입 이메일
   * 판별은 **세션 토큰의 인증 방법(amr) + 신원 목록**(readSessionAuthProvider) 이 먼저고,
   * 그걸로 못 정하면 가입 때 저장한 users.auth_provider 로 본다. 둘 다 모르면 null →
   * 화면은 그 영역을 그리지 않는다(모르는 값을 카카오·이메일로 넘겨짚지 않는다).
   * 신원이 여럿(구글+이메일 자동 연결)이어도 **지금 로그인한 하나만** 보여준다.
   *
   * ⚠️ email 유무로 방식을 정하지 않는다. 구글도 email 을 준다.
   * ⚠️ 이메일은 **세션의 auth user** 것이다. DB 에 이메일을 저장하지 않는다(readOAuthProfile).
   *    본인 화면이라 보여줄 수는 있지만 로그 · 이벤트 payload 에는 넣지 않는다.
   * ⚠️ 저장된 값을 그대로 비교하지 않는다. Custom OIDC 로 만들어진 행에는
   *    'custom:kakao-oidc' 가 들어 있다. 읽을 때 제품 기준으로 바꾼다. (toProductAuthProvider)
   */
  const toConnectedAccount = useCallback(
    (storedProvider: string | null, method: string | null): ConnectedAccount | null => {
      const user = session?.user ?? null;
      const provider =
        (user ? readSessionAuthProvider(user, method) : null) ??
        toProductAuthProvider(storedProvider);
      const email = user?.email?.trim() || null;

      switch (provider) {
        case AUTH_PROVIDER.KAKAO: {
          const nickname = user ? readOAuthProfile(user).name : null;
          return {
            title: nickname ? `카카오 로그인 · ${nickname}` : '카카오 로그인',
            subtitle: null,
            hint: '카카오에서 가져온 정보라 앱에서는 바꿀 수 없어요.',
          };
        }
        case AUTH_PROVIDER.GOOGLE:
          return {
            title: 'Google',
            subtitle: email,
            hint: '구글 계정으로 로그인했어요. 앱에서는 바꿀 수 없어요.',
          };
        case AUTH_PROVIDER.EMAIL:
          return {
            title: '이메일',
            subtitle: email,
            hint: '가입할 때 쓴 이메일이에요. 앱에서는 바꿀 수 없어요.',
          };
        default:
          return null;
      }
    },
    [session],
  );

  const load = useCallback(async () => {
    try {
      if (!userId) return;

      const [user, method] = await Promise.all([getUserProfile(userId), readSessionAuthMethod()]);
      if (!user) {
        setLoadState('error');
        return;
      }

      setSavedName(user.name);
      setName(user.name);
      setSavedEnglishName(user.english_name ?? '');
      setEnglishName(user.english_name ?? '');
      setAccount(toConnectedAccount(user.auth_provider, method));
      setLoadState('ready');
    } catch {
      // 예외 객체를 화면에 그대로 노출하지 않는다. (components/ui/ErrorState)
      setLoadState('error');
    }
  }, [userId, toConnectedAccount]);

  // ⚠️ useFocusEffect 를 쓰지 않는다. 이 화면은 입력 중인 값을 들고 있어서,
  //    돌아올 때마다 다시 불러오면 저장하지 않은 입력이 사라진다.
  //    다른 화면이 이름을 바꾸는 경로도 없다.
  useEffect(() => {
    void load();
  }, [load]);

  const trimmed = name.trim();
  const canSaveName = trimmed !== '' && trimmed !== savedName && !savingName;

  function handleChangeName(next: string) {
    setName(next);
    // 사용자가 고치기 시작하면 이전 오류 문구는 치운다.
    if (nameError) setNameError(null);
  }

  async function handlePressSaveName() {
    if (!canSaveName || !userId) return;

    if (trimmed.length > NAME_MAX_LENGTH) {
      setNameError(`닉네임은 ${NAME_MAX_LENGTH}자까지 쓸 수 있어요.`);
      return;
    }

    setSavingName(true);
    setNameError(null);
    try {
      await updateUserName(userId, trimmed);
      // 저장된 값이 기준이다. 이걸 갱신해야 저장 버튼이 다시 잠긴다.
      setSavedName(trimmed);
      setName(trimmed);
      Alert.alert('닉네임을 바꿨어요');
    } catch {
      setNameError('닉네임을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSavingName(false);
    }
  }

  // 영문 이름은 비워서 저장할 수 있다(= 지우기). 그래서 '' 도 저장 가능한 값이다.
  // 바뀐 게 있는지만 본다.
  const trimmedEnglishName = englishName.trim();
  const canSaveEnglishName = trimmedEnglishName !== savedEnglishName && !savingEnglishName;

  function handleChangeEnglishName(next: string) {
    setEnglishName(next);
    if (englishNameError) setEnglishNameError(null);
  }

  async function handlePressSaveEnglishName() {
    if (!canSaveEnglishName || !userId) return;

    if (trimmedEnglishName.length > ENGLISH_NAME_MAX_LENGTH) {
      setEnglishNameError(`영문 이름은 ${ENGLISH_NAME_MAX_LENGTH}자까지 쓸 수 있어요.`);
      return;
    }

    setSavingEnglishName(true);
    setEnglishNameError(null);
    try {
      // 입력한 그대로 저장한다. 비어 있으면 null 이 들어간다. (updateUserEnglishName)
      await updateUserEnglishName(userId, trimmedEnglishName);
      setSavedEnglishName(trimmedEnglishName);
      setEnglishName(trimmedEnglishName);
      Alert.alert(trimmedEnglishName === '' ? '영문 이름을 지웠어요' : '영문 이름을 저장했어요');
    } catch {
      setEnglishNameError('영문 이름을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSavingEnglishName(false);
    }
  }

  /**
   * 탈퇴 확정.
   *
   * 순서가 중요하다. **DB 를 먼저 바꾸고 그다음 로그아웃한다.**
   * 반대로 하면 로그아웃은 됐는데 탈퇴는 안 된 상태가 남고, 그때는
   * userId 가 없어서 다시 시도할 방법도 없다.
   *
   * 로그아웃한 뒤 화면 이동은 하지 않는다. 세션이 사라지면 루트 가드가
   * /login 으로 옮긴다. (app/_layout.tsx) 두 곳이 같이 옮기면 화면이 두 번 바뀐다.
   */
  async function handleConfirmWithdraw() {
    if (!userId || withdrawing) return;

    // ⚠️ 개발용 미리보기에서는 DB 를 건드리지 않는다. 여기서 막지 않으면
    //    seed 사용자(지수)에게 deleted_at 이 박혀 이후 MY / GROUP 화면
    //    확인용 데이터가 통째로 사라진다.
    //    이름 변경 등 다른 기능까지 막지는 않는다. 되돌릴 수 있는 값이다.
    if (isPreview) {
      setWithdrawAsking(false);
      Alert.alert('개발용 미리보기에서는 회원 탈퇴를 실행할 수 없어요.');
      return;
    }

    setWithdrawing(true);
    try {
      // 30일 유예 신청. 즉시 지우지 않는다 — 서버가 요청 시각만 찍고 30일 뒤 최종 처리한다.
      await requestWithdrawal();
    } catch (error) {
      setWithdrawing(false);
      setWithdrawAsking(false);
      if (withdrawalErrorCode(error) === WITHDRAWAL_ERROR.LEADER_MUST_DELEGATE) {
        // 자동 위임하지 않는다. 누구에게 넘길지는 본인이 멤버 관리에서 고른다.
        Alert.alert(
          '여행장인 여행이 있어요',
          '함께하는 멤버가 있는 여행의 여행장은 탈퇴할 수 없어요. 여행 멤버 관리에서 여행장을 다른 멤버에게 위임한 뒤 다시 시도해 주세요.',
        );
        return;
      }
      Alert.alert('탈퇴를 신청하지 못했어요', '잠시 후 다시 시도해 주세요.');
      return;
    }

    try {
      await signOut();
    } catch {
      // DB 는 이미 탈퇴 처리됐다. 세션만 남았고 조회는 전부 비어 보인다.
      // 여기서 되돌리지 않는다. 사용자가 직접 로그아웃하면 정리된다.
      setWithdrawing(false);
      setWithdrawAsking(false);
      Alert.alert('탈퇴를 신청했어요', '로그아웃에 실패했어요. 앱을 다시 실행해 주세요.');
    }
  }

  return (
    <>
      {/* 다른 상세 화면과 같은 헤더. 뒤로 버튼은 root Stack 이 이미 그린다. */}
      <Stack.Screen options={{ title: '계정 관리', headerTitleAlign: 'center' }} />

      {loadState === 'loading' ? <Loading /> : null}
      {loadState === 'error' ? (
        <ErrorState message="계정 정보를 불러오지 못했어요." onRetry={() => void load()} />
      ) : null}
      {loadState === 'ready' ? (
        <ScrollView
          // 바탕 = 앱 공통 light gray(bg-gray-50 · 여행 홈·결산과 같다). 카드는 흰색. MY 구분을 배경색으로 하지 않는다. (2026-09-20)
          className="flex-1 bg-gray-50"
          contentContainerClassName="pb-16"
          keyboardShouldPersistTaps="handled"
        >
          <AccountView
            name={name}
            nameError={nameError}
            canSaveName={canSaveName}
            savingName={savingName}
            englishName={englishName}
            englishNameError={englishNameError}
            canSaveEnglishName={canSaveEnglishName}
            savingEnglishName={savingEnglishName}
            account={account}
            onChangeName={handleChangeName}
            onPressSaveName={() => void handlePressSaveName()}
            onChangeEnglishName={handleChangeEnglishName}
            onPressSaveEnglishName={() => void handlePressSaveEnglishName()}
            onPressWithdraw={() => setWithdrawAsking(true)}
          />
        </ScrollView>
      ) : null}

      <WithdrawConfirmModal
        visible={withdrawAsking}
        busy={withdrawing}
        onCancel={() => setWithdrawAsking(false)}
        onConfirm={() => void handleConfirmWithdraw()}
      />
    </>
  );
}
