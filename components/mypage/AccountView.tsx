import { Text, View } from 'react-native';

import { Button, Input } from '@/components/ui';

/** 이름 최대 길이. DB 제약이 아니라 화면 규칙이다. */
export const NAME_MAX_LENGTH = 20;
/**
 * 여권 영문 이름 최대 길이. DB 제약이 아니라 화면 규칙이다.
 * 실제 여권의 성명란(성 + 이름)은 대략 30자 안팎이라 그보다 조금 넉넉하게 둔다.
 */
export const ENGLISH_NAME_MAX_LENGTH = 40;

type Props = {
  /** 입력창에 들어 있는 값. 상태는 화면 파일이 들고 있다. */
  name: string;
  /** 검증 실패 메시지. 없으면 그리지 않는다. */
  nameError: string | null;
  /** 저장 버튼을 누를 수 있는지. 값이 그대로면 누를 이유가 없다. */
  canSaveName: boolean;
  /** 저장 중. 중복 제출을 막는다. */
  savingName: boolean;
  /**
   * 여권 영문 이름 입력값. 저장된 값이 없으면 ''. (null 은 화면 파일이 '' 로 바꾼다)
   * ⚠️ 자동으로 대문자화 · 변환하지 않는다. 키보드만 대문자로 열어 준다(autoCapitalize).
   */
  englishName: string;
  englishNameError: string | null;
  /** 비워서 저장(지우기)도 가능하다. 값이 바뀌었는지만 본다. */
  canSaveEnglishName: boolean;
  savingEnglishName: boolean;
  /**
   * 연결된 계정 한 줄. 예: `카카오 로그인 · 홍길동`
   *
   * ⚠️ 앱에서 바꿀 수 없는 값이다. 카카오 쪽 정보라 입력창으로 만들지 않는다.
   */
  accountLabel: string | null;
  onChangeName: (next: string) => void;
  onPressSaveName: () => void;
  onChangeEnglishName: (next: string) => void;
  onPressSaveEnglishName: () => void;
  onPressWithdraw: () => void;
};

/**
 * 계정관리 화면의 UI.
 *
 * ⚠️ supabase · track() 을 직접 부르지 않는다. 화면 파일이 부른다. (CLAUDE.md 9장)
 *
 * 구성은 두 덩어리다.
 *   위 — 프로필 이름(바꿀 수 있음) · 여권 영문 이름(바꿀 수 있음 · 선택) · 연결된 계정(읽기 전용)
 *   아래 — 회원탈퇴
 *
 * ⚠️ 탈퇴를 위쪽 항목들과 같은 카드에 넣지 않는다. 이름 저장과 탈퇴가 한
 *    덩어리로 보이면 저장하려다 탈퇴를 누를 수 있다. 여백으로 확실히 끊는다.
 */
export function AccountView({
  name,
  nameError,
  canSaveName,
  savingName,
  englishName,
  englishNameError,
  canSaveEnglishName,
  savingEnglishName,
  accountLabel,
  onChangeName,
  onPressSaveName,
  onChangeEnglishName,
  onPressSaveEnglishName,
  onPressWithdraw,
}: Props) {
  return (
    <View className="px-4">
      <View className="mt-7">
        <Text
          className="text-pot-ink"
          style={{ fontSize: 16, fontWeight: '800', letterSpacing: -0.5 }}
        >
          프로필
        </Text>

        <View
          className="mt-3 rounded-2xl bg-white p-4"
          style={{
            shadowColor: '#000',
            shadowOpacity: 0.05,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
            elevation: 2,
          }}
        >
          <Input
            label="이름"
            value={name}
            onChangeText={onChangeName}
            placeholder="이름을 입력해 주세요"
            error={nameError}
            hint={`${NAME_MAX_LENGTH}자까지 쓸 수 있어요`}
            maxLength={NAME_MAX_LENGTH}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={canSaveName ? onPressSaveName : undefined}
          />

          <View className="mt-3">
            <Button
              label="저장"
              variant="brand"
              disabled={!canSaveName}
              loading={savingName}
              onPress={onPressSaveName}
            />
          </View>
        </View>
      </View>

      {/* 여권 영문 이름. MY-01 여권의 ENGLISH NAME 에 그대로 보인다. 이름 카드와 같은 구조. */}
      <View className="mt-7">
        <Text
          className="text-pot-ink"
          style={{ fontSize: 16, fontWeight: '800', letterSpacing: -0.5 }}
        >
          여권 정보
        </Text>

        <View
          className="mt-3 rounded-2xl bg-white p-4"
          style={{
            shadowColor: '#000',
            shadowOpacity: 0.05,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
            elevation: 2,
          }}
        >
          <Input
            label="여권 영문 이름"
            value={englishName}
            onChangeText={onChangeEnglishName}
            placeholder="HONG GILDONG"
            error={englishNameError}
            hint="여권에 기재된 영문 이름과 동일하게 입력해 주세요."
            maxLength={ENGLISH_NAME_MAX_LENGTH}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={canSaveEnglishName ? onPressSaveEnglishName : undefined}
          />

          <View className="mt-3">
            <Button
              label="저장"
              variant="brand"
              disabled={!canSaveEnglishName}
              loading={savingEnglishName}
              onPress={onPressSaveEnglishName}
            />
          </View>
        </View>
      </View>

      {accountLabel ? (
        <View className="mt-7">
          <Text
            className="text-pot-ink"
            style={{ fontSize: 16, fontWeight: '800', letterSpacing: -0.5 }}
          >
            연결된 계정
          </Text>

          <View
            className="mt-3 rounded-2xl bg-white px-4 py-4"
            style={{
              shadowColor: '#000',
              shadowOpacity: 0.05,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 4 },
              elevation: 2,
            }}
          >
            <Text className="text-pot-ink" style={{ fontSize: 14.5, lineHeight: 21 }}>
              {accountLabel}
            </Text>
            {/*
              ⚠️ 계정 식별자(auth_provider_user_id)는 절대 넣지 않는다.
                 `kakao_1001` 같은 내부 연동 ID 라 사용자가 알아볼 수 없고,
                 다른 서비스와 대조할 수 있는 값이다.
            */}
            <Text className="mt-1 text-pot-faint" style={{ fontSize: 12, lineHeight: 18 }}>
              카카오에서 가져온 정보라 앱에서는 바꿀 수 없어요.
            </Text>
          </View>
        </View>
      ) : null}

      {/* 탈퇴. navigation 이 아니라 action 이라 카드에 넣지 않는다.
          로그아웃을 MY-01 에서 다루는 방식과 같다. */}
      <View className="mt-10">
        <View className="self-start">
          <Text
            accessibilityRole="button"
            accessibilityLabel="회원탈퇴"
            onPress={onPressWithdraw}
            suppressHighlighting
            className="py-3 text-pot-mute"
            // 섹션 제목('프로필')과 같은 단. 탈퇴라고 작게 숨기지 않는다. (2026-09-17)
            style={{ fontSize: 16, fontWeight: '800', letterSpacing: -0.5 }}
          >
            회원탈퇴
          </Text>
        </View>
      </View>
    </View>
  );
}
