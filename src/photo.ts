export const PHOTO_BUCKET = "photos";
const MAX_SIDE = 800;
export const AVATAR_SIDE = 160;
const MAX_BYTES = 300 * 1024;

export type PendingPhoto = { blob: Blob; url: string };

export function photoSrc(path?: string | null) {
  if (!path) return null;
  if (path.startsWith("data:")) return path;
  const base = String(import.meta.env.VITE_SUPABASE_URL ?? "").replace(
    /\/$/,
    "",
  );
  return `${base}/storage/v1/object/public/${PHOTO_BUCKET}/${path}`;
}

function toBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality),
  );
}

function toDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("사진을 읽지 못했습니다."));
    reader.readAsDataURL(blob);
  });
}

// 긴 변 800px JPEG으로 줄여 올린다. 휴대폰 원본(수 MB)이 그대로 저장되지 않게 한다.
export async function resizePhoto(
  file: File,
  maxSide = MAX_SIDE,
): Promise<PendingPhoto> {
  if (!file.type.startsWith("image/"))
    throw new Error("이미지 파일만 올릴 수 있습니다.");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("지원하지 않는 사진 형식입니다. JPG나 PNG를 올려 주세요.");
  }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("사진을 처리하지 못했습니다.");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  let blob = await toBlob(canvas, 0.72);
  if (blob && blob.size > MAX_BYTES) blob = await toBlob(canvas, 0.5);
  if (!blob || blob.size > MAX_BYTES)
    throw new Error(
      "사진을 충분히 줄이지 못했습니다. 다른 사진을 선택해 주세요.",
    );
  return { blob, url: await toDataUrl(blob) };
}
