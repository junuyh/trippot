import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { Button, Input } from '@/components/ui';

/** groups.name 은 text 라 DB 상한이 없다. 카드가 한 줄 말줄임이라 화면에서 제한한다. */
const MAX_NAME_LENGTH = 20;

type Props = {
  /** 열려 있으면 현재 모임명, 닫혀 있으면 null. */
  initialName: string | null;
  /** 저장 중. 중복 제출을 막는다. (CLAUDE.md 9장) */
  saving: boolean;
  /** 저장 실패 메시지. 예외 객체를 그대로 넣지 않는다. */
  submitError: string | null;
  onClose: () => void;
  onSubmit: (name: string) => void;
};

/**
 * 모임 이름 수정. More 메뉴에서만 열린다.
 *
 * 저장 권한은 RLS 가 판단한다. 앱에서 별도 owner 검사를 만들지 않는다.
 * (lib/supabase/queries/groups.ts updateGroup 주석 참고)
 */
export function GroupRenameModal({
  initialName,
  saving,
  submitError,
  onClose,
  onSubmit,
}: Props) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  // 열릴 때마다 현재 이름으로 되돌린다. 이전에 입력하다 만 값이 남으면 안 된다.
  useEffect(() => {
    if (initialName !== null) {
      setName(initialName);
      setError(null);
    }
  }, [initialName]);

  function handleSubmit() {
    const trimmed = name.trim();

    if (trimmed.length === 0) {
      setError('모임 이름을 입력해 주세요.');
      return;
    }
    if (trimmed.length > MAX_NAME_LENGTH) {
      setError(`${MAX_NAME_LENGTH}자 이내로 입력해 주세요.`);
      return;
    }
    if (trimmed === initialName) {
      onClose();
      return;
    }

    setError(null);
    onSubmit(trimmed);
  }

  return (
    <Modal
      visible={initialName !== null}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable className="flex-1 items-center justify-center bg-black/40 px-8" onPress={onClose}>
        <Pressable className="w-full rounded-2xl bg-white p-5" onPress={() => {}}>
          <Text className="text-lg font-bold text-gray-900">모임 이름 수정</Text>

          <View className="mt-4">
            <Input
              label="모임 이름"
              value={name}
              onChangeText={setName}
              placeholder="모임 이름을 입력해 주세요"
              maxLength={MAX_NAME_LENGTH}
              autoFocus
              error={error ?? submitError}
              hint={`${MAX_NAME_LENGTH}자 이내`}
              editable={!saving}
            />
          </View>

          <View className="mt-5 flex-row gap-2">
            <View className="flex-1">
              <Button label="취소" variant="secondary" onPress={onClose} disabled={saving} />
            </View>
            <View className="flex-1">
              <Button label="저장" onPress={handleSubmit} loading={saving} />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
