import { createClient } from "@supabase/supabase-js";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

// 1. قراءة متغيرات البيئة من .env.local
async function loadEnv() {
  try {
    const envContent = await fs.readFile(".env.local", "utf8");
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
        if (!process.env[key]) process.env[key] = val;
      }
    }
  } catch {
    // ملف .env.local قد لا يكون موجودًا أو محميًا
  }
}

await loadEnv();

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (supabaseUrl) {
  supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");
}
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ خطأ: يرجى وضع متغيرات Supabase في ملف .env.local:");
  console.error("   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co");
  console.error("   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key");
  console.error("   أو SUPABASE_SERVICE_ROLE_KEY=your-service-role-key (مفضل لعمليات الترحيل والرفع)");
  process.exit(1);
}

console.log("🚀 جاري الاتصال بـ Supabase على:", supabaseUrl);
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

const BUCKET_NAME = "restaurant-media";

async function ensureBucket() {
  console.log(`📦 التحقق من وجود الحاوية (Storage Bucket): '${BUCKET_NAME}'...`);
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) {
    console.warn("⚠️ تنبيه عند فحص الحاويات:", error.message);
  } else {
    const exists = buckets.some((b) => b.name === BUCKET_NAME);
    if (!exists) {
      console.log(`🔨 جاري إنشاء الحاوية العامة '${BUCKET_NAME}'...`);
      const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
        public: true,
      });
      if (createError) {
        console.warn("⚠️ لم يتم إنشاء الحاوية برمجياً (ربما تحتاج Service Role Key أو تم إنشاؤها عبر SQL):", createError.message);
      } else {
        console.log("✅ تم إنشاء الحاوية بنجاح!");
      }
    } else {
      console.log("✅ الحاوية موجودة بالفعل.");
    }
  }
}

async function uploadFile(localPath, storagePath, mimeType) {
  try {
    const fileBuffer = await fs.readFile(localPath);
    const { error } = await supabase.storage.from(BUCKET_NAME).upload(storagePath, fileBuffer, {
      contentType: mimeType,
      upsert: true,
    });
    if (error) {
      console.error(`❌ فشل رفع ${localPath}:`, error.message);
      return null;
    }
    const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(storagePath);
    console.log(`  ✓ تم رفع ${storagePath} -> ${data.publicUrl}`);
    return data.publicUrl;
  } catch (err) {
    console.error(`❌ خطأ أثناء قراءة/رفع ${localPath}:`, err.message);
    return null;
  }
}

async function run() {
  await ensureBucket();

  console.log("\n📸 جاري نقل صور الأطباق والهوية إلى Supabase Storage...");
  const imageUrls = {};

  // 1. صور الأطباق الأساسية في مجلد hadramout
  const hadramoutDir = "public/images/hadramout";
  try {
    const files = await fs.readdir(hadramoutDir);
    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      const mime = ext === ".png" ? "image/png" : "image/jpeg";
      const fullPath = path.join(hadramoutDir, file);
      const keyName = path.basename(file, ext);
      const publicUrl = await uploadFile(fullPath, `hadramout/${file}`, mime);
      if (publicUrl) {
        imageUrls[keyName] = publicUrl;
      }
    }
  } catch (err) {
    console.warn("⚠️ لم يتم العثور على مجلد hadramout:", err.message);
  }

  // 2. صور الشعار والخلفيات العامة
  const generalImages = [
    { file: "hadramout-logo.png", mime: "image/png" },
    { file: "hero.jpg", mime: "image/jpeg" },
    { file: "restaurant.jpg", mime: "image/jpeg" },
    { file: "chef.jpg", mime: "image/jpeg" },
  ];

  for (const img of generalImages) {
    const fullPath = path.join("public/images", img.file);
    try {
      await fs.access(fullPath);
      const publicUrl = await uploadFile(fullPath, `general/${img.file}`, img.mime);
      if (publicUrl) {
        imageUrls[img.file] = publicUrl;
      }
    } catch {
      // ملف اختياري
    }
  }

  console.log("\n💾 جاري تحديث روابط الصور في قاعدة البيانات (Supabase Dishes & Categories)...");

  // تحديث صور التصنيفات
  const categoryImageMap = {
    chicken: imageUrls["whole"] || imageUrls["chicken"],
    meat: imageUrls["meat"],
    platters: imageUrls["platter"],
    drinks: imageUrls["drinks"],
  };

  for (const [catId, imgUrl] of Object.entries(categoryImageMap)) {
    if (imgUrl) {
      const { error } = await supabase
        .from("categories")
        .update({ image: imgUrl })
        .eq("id", catId);
      if (error) console.warn(`⚠️ لم يتم تحديث صورة التصنيف ${catId}:`, error.message);
      else console.log(`  ✓ تم ربط صورة التصنيف: ${catId}`);
    }
  }

  // تحديث صور الأطباق
  const dishImageMap = {
    27: imageUrls["chicken"],
    37: imageUrls["meat"],
    134: imageUrls["platter"],
    38: imageUrls["quarter"],
    26: imageUrls["whole"],
    252: imageUrls["drinks"],
    263: imageUrls["majboos"],
  };

  for (const [dishId, imgUrl] of Object.entries(dishImageMap)) {
    if (imgUrl) {
      const { error } = await supabase
        .from("dishes")
        .update({ image: imgUrl })
        .eq("id", Number(dishId));
      if (error) console.warn(`⚠️ لم يتم تحديث صورة الطبق ${dishId}:`, error.message);
      else console.log(`  ✓ تم ربط صورة الطبق رقم ${dishId}`);
    }
  }

  console.log("\n✨ اكتملت عملية الترحيل بنجاح! تم نقل الصور وربطها بسوبابيس.");
}

run().catch((err) => {
  console.error("❌ حدث خطأ غير متوقع:", err);
  process.exit(1);
});
