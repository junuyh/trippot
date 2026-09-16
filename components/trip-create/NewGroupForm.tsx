// TRIP-01 신규 모임 입력. 모임명만 받는다.
//
// ⚠️ 2026-09-15 · '함께 가는 사람'(동행자 이름) 입력을 뺐다.
//    적어 둔 이름과 초대 링크로 들어온 사람을 잇는 장치가 없었다.
//    trip_members 에 display_name 만 있는 행이 남고, 초대를 수락하면 그와 별개로
//    새 행이 생겨 같은 사람이 두 번 보였다. 이름은 열쇠가 될 수 없어서
//    (동명이인·표기 차이) 자동 매칭도 만들 수 없다.
//    → 멤버는 초대 수락으로만 늘린다. (2026-09-15 다빈 결정)
//
//    기존 여행에 남아 있는 display_name 행을 읽는 코드는 그대로 둔다.
//    새로 만드는 여행에서만 생기지 않는다.
import { Input } from '@/components/ui';

type Props = {
  groupName: string;
  onChangeGroupName: (value: string) => void;
  /** 모임명 검증 실패 메시지. null 이면 정상 */
  groupNameError: string | null;
  /** 입력칸을 벗어날 때 검증한다. '다음' 이 disabled 라 눌러서는 띄울 수 없다 */
  onBlurGroupName: () => void;

  disabled?: boolean;
};

export function NewGroupForm({
  groupName,
  onChangeGroupName,
  groupNameError,
  onBlurGroupName,
  disabled = false,
}: Props) {
  return (
    <Input
      label="모임 이름"
      required
      value={groupName}
      onChangeText={onChangeGroupName}
      onBlur={onBlurGroupName}
      placeholder="예) 대학동기, 등산모임"
      error={groupNameError}
      editable={!disabled}
      maxLength={20}
      returnKeyType="done"
      hint="여행을 만든 뒤 초대 링크로 사람을 부를 수 있어요."
    />
  );
}
