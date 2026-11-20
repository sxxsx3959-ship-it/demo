/**
 * ضغط الصورة على جهاز العميل قبل رفعها إلى Supabase Storage
 * يقوم بتقليص أبعاد الصورة الكبيرة وتحويلها إلى JPEG بجودة محسوبة
 * لتوفير ما يزيد عن 90% من المساحة وتسريع تحميل الموقع.
 */
export async function compressImage(
  file: File,
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.8
): Promise<{ blob: Blob; originalSize: number; compressedSize: number; reduction: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // الحفاظ على النسبة والتناسب وتصغير الأبعاد الكبيرة
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("تعذر تجهيز لوحة معالجة الصورة"));
          return;
        }

        // رسم الصورة المحسنة
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("فشل ضغط الصورة"));
              return;
            }
            const originalSize = file.size;
            const compressedSize = blob.size;
            const reduction = Math.max(0, Math.round(((originalSize - compressedSize) / originalSize) * 100));

            resolve({
              blob,
              originalSize,
              compressedSize,
              reduction,
            });
          },
          "image/jpeg",
          quality
        );
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 بايت";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["بايت", "كيلوبايت", "ميجابايت", "جيجابايت"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}
