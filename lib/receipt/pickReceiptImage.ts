// ============================================================================
// 영수증 사진 고르기 → 줄여서 base64 로
//
// 카메라 또는 앨범에서 한 장 받아 긴 변 1280px JPEG 로 줄인다. 원본(12MP)을
// 그대로 보내면 base64 만 수 MB 라 Edge Function 이 느리고 실패한다.
//
// ⚠️ 사진을 앱 안에 남기지 않는다. 줄인 파일은 캐시에만 있고 업로드하지 않는다.
// ⚠️ 권한이 없으면 null. 화면이 안내한다.
// ============================================================================
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

export type ReceiptImageSource = "camera" | "library";

export type ReceiptImage = {
  base64: string;
  mimeType: "image/jpeg";
  /** 미리보기용 로컬 경로 */
  uri: string;
};

export type PickReceiptResult =
  | { status: "ok"; image: ReceiptImage }
  | { status: "canceled" }
  | { status: "denied" };

const MAX_WIDTH = 1280;

export async function pickReceiptImage(source: ReceiptImageSource): Promise<PickReceiptResult> {
  const permission =
    source === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return { status: "denied" };

  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.85 };
  const picked =
    source === "camera"
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  const asset = picked.canceled ? null : picked.assets[0];
  if (!asset?.uri) return { status: "canceled" };

  // 긴 변 기준으로 줄인다. 세로 영수증이 대부분이라 폭이 아니라 큰 쪽을 본다
  const context = ImageManipulator.manipulate(asset.uri);
  const width = asset.width ?? 0;
  const height = asset.height ?? 0;
  if (width > 0 && height > 0 && Math.max(width, height) > MAX_WIDTH) {
    if (width >= height) context.resize({ width: MAX_WIDTH });
    else context.resize({ height: MAX_WIDTH });
  }
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.72, base64: true });
  if (!saved.base64) return { status: "canceled" };

  return { status: "ok", image: { base64: saved.base64, mimeType: "image/jpeg", uri: saved.uri } };
}
