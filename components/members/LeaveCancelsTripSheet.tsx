// ============================================================================
// MEM-04 즉시 취소 경고 — 바텀시트
//
// 취소 요청 중인 여행에서 나가려는데, 나가면 동의 분모가 줄어 **남은 전원이
// 이미 동의한 상태**가 되는 경우에만 뜬다. (POL-MEM-015)
// 아직 미동의자가 있으면 이 시트를 거치지 않고 그냥 나간다.
//
// ⚠️ 나가기를 **막지 않는다.** (POL-MEM-013) 한 명이 취소 요청만 걸어두고
//    다른 사람을 여행에 묶어둘 수 있으면 안 된다. 경고만 하고 보낸다.
//
// ⚠️⚠️ 파란 블록을 빼지 말 것. ⚠️⚠️
//    빨간 블록만 보면 "내가 나가서 취소에 동의한 것" 으로 읽힌다. 실제로는
//    동의 분모에서 빠지는 것뿐이고, 나간 사람에게는 동의를 묻지 않는다.
//    (POL-MEM-014) 취소에 찬성한 적 없는 사람이 찬성한 것처럼 기억하게 된다.
//
// ⚠️ '3일' 은 되돌리기 창(RESTORE_WINDOW_HOURS = 72시간)이다. 24시간이 아니다.
//    (POL-CXL-030) 숫자를 고칠 일이 생기면 그 상수부터 본다.
// ============================================================================
import { Text, View } from "react-native";

import { BranchNotice } from "@/components/invite";
import { BottomSheet, Button } from "@/components/ui";

type Props = {
  visible: boolean;
  onClose: () => void;
  /**
   * 시트가 **완전히 내려간 뒤**(iOS). 다음 시트를 이어서 열 때 쓴다.
   *
   * ⚠️ 닫는 중에 새 Modal 을 띄우면 iOS 가 조용히 무시하고, 보이지 않는 Modal 이
   *    화면 전체의 터치를 삼킨다. 타이머로 어림잡지 말고 이 신호를 쓴다.
   */
  onDismiss?: () => void;

  destination: string;
  /**
   * 이미 취소에 동의한 멤버 이름들. **나는 뺀다.**
   *
   * ⚠️ 빌 수 있다. 동의 대상이 나뿐이었으면(요청자 + 나 둘뿐인 여행) 아무도
   *    동의하지 않았는데도 내가 나가는 순간 동의를 기다릴 사람이 0명이 되어
   *    취소가 확정된다. (POL-CXL-066) 그때는 제목이 달라진다.
   */
  agreedNames: string[];

  onLeave: () => void;
  leaving?: boolean;
};

export function LeaveCancelsTripSheet({
  visible,
  onClose,
  onDismiss,
  destination,
  agreedNames,
  onLeave,
  leaving = false,
}: Props) {
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      onDismiss={onDismiss}
      title={"나가면 이 여행이\n바로 취소돼요"}
      description={`지금 ${destination} 여행은 취소 요청 중이에요.`}
      footer={
        <View style={{ gap: 8 }}>
          {/*
            ⚠️ 문구가 '나가기' 가 아니라 '그래도 나가기' 다. 방금 읽은 경고를
               알고도 하는 선택이라는 걸 버튼이 말해야 한다.
          */}
          <Button label="그래도 나가기" variant="danger" loading={leaving} onPress={onLeave} />
          <Button label="닫기" variant="ghost" disabled={leaving} onPress={onClose} />
        </View>
      }
    >
      <View style={{ paddingBottom: 8, gap: 10 }}>
        <BranchNotice
          tone="warn"
          /*
            ⚠️ 이름을 못 채우면 "님이 이미 취소에 동의했어요" 가 된다.
               동의 대상이 나뿐인 여행에서 실제로 일어난다. 문장을 바꾼다.
          */
          title={
            agreedNames.length > 0
              ? `${agreedNames.join(" · ")}님이 이미 취소에 동의했어요`
              : "동의를 기다릴 사람이 회원님뿐이에요"
          }
          body={
            "회원님이 나가면 동의를 기다릴 사람이 없어져서, 나가는 순간 여행이 취소돼요. " +
            "되돌리려면 남은 멤버가 3일 안에 되돌려야 해요."
          }
        />

        {/* ⚠️ 위 블록만 보면 자기가 취소에 동의한 것처럼 읽힌다. (POL-MEM-014) */}
        <BranchNotice
          tone="info"
          title="취소에 동의하는 건 아니에요"
          body="나간 분에게는 동의를 묻지 않아요. 남은 사람들의 동의만으로 처리되는 거예요."
        />
      </View>
    </BottomSheet>
  );
}
