"use client";
import { useEffect, useState, useRef, type FormEvent, type ChangeEvent } from "react";
import { Icon, Logo } from "@/components/Brand";
import { dishImage, isCouponExhausted, money, normalizeCouponCode, restaurant } from "@/lib/restaurant";
import { useCatalog } from "@/lib/use-catalog";
import { exportCatalog, readCatalog, resetCatalog, saveCatalog, type Catalog } from "@/lib/local-catalog";
import { checkLocalPassword } from "@/lib/local-owner";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { compressImage, formatBytes } from "@/lib/image-compress";

const SESSION = "hadramout-local-owner-session";

export default function OwnerPage() {
  const { dishes, areas, categories, accepting, coupons, couponsEnabled, featuredCouponCode, ready } = useCatalog();
  const [entered, setEntered] = useState(false);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState<"overview" | "menu" | "delivery" | "coupons">("overview");

  // إضافة طبق جديد
  const [showAddModal, setShowAddModal] = useState(false);
  const [addTitle, setAddTitle] = useState("");
  const [addSub, setAddSub] = useState("");
  const [addCategory, setAddCategory] = useState("chicken");
  const [addPrice, setAddPrice] = useState(10000);
  const [addDescription, setAddDescription] = useState("");
  const [addAvailable, setAddAvailable] = useState(true);

  const [imagePreview, setImagePreview] = useState("");
  const [compressedBlob, setCompressedBlob] = useState<Blob | null>(null);
  const [compressStats, setCompressStats] = useState<{ original: string; compressed: string; reduction: number } | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSubmittingDish, setIsSubmittingDish] = useState(false);
  const addDialog = useRef<HTMLDialogElement>(null);

  // إضافة مناطق توصيل
  const [showAddAreaModal, setShowAddAreaModal] = useState(false);
  const [newAreaName, setNewAreaName] = useState("");
  const [newAreaFee, setNewAreaFee] = useState(3000);
  const [isSubmittingArea, setIsSubmittingArea] = useState(false);
  const addAreaDialog = useRef<HTMLDialogElement>(null);

  // إضافة كوبون خصم
  const [showAddCouponModal, setShowAddCouponModal] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponType, setCouponType] = useState<"percent" | "fixed">("percent");
  const [couponValue, setCouponValue] = useState(10);
  const [couponMinOrder, setCouponMinOrder] = useState(0);
  const [couponMaxUses, setCouponMaxUses] = useState(10);
  const [couponActive, setCouponActive] = useState(true);
  const [isSubmittingCoupon, setIsSubmittingCoupon] = useState(false);
  const addCouponDialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    try { setEntered(sessionStorage.getItem(SESSION) === "1"); } catch {}
    setChecking(false);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (showAddModal) addDialog.current?.showModal();
    else addDialog.current?.close();
  }, [showAddModal]);

  useEffect(() => {
    if (showAddAreaModal) addAreaDialog.current?.showModal();
    else addAreaDialog.current?.close();
  }, [showAddAreaModal]);

  useEffect(() => {
    if (showAddCouponModal) addCouponDialog.current?.showModal();
    else addCouponDialog.current?.close();
  }, [showAddCouponModal]);

  async function signIn(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const password = String(new FormData(e.currentTarget).get("password") || "");
    setBusy(true);
    setError("");
    try {
      if (!await checkLocalPassword(password)) {
        setError("كلمة المرور غير صحيحة.");
        return;
      }
      setEntered(true);
      try { sessionStorage.setItem(SESSION, "1"); } catch {}
    } catch {
      setError("تعذّر فتح الإعدادات. افتح الموقع باستخدام HTTPS أو من localhost.");
    } finally {
      setBusy(false);
    }
  }

  function currentSnapshot(): Catalog {
    return { dishes, areas, accepting, coupons, couponsEnabled, featuredCouponCode };
  }

  async function save(update: (data: Catalog) => Catalog, supabaseAction?: () => Promise<void>) {
    setError("");
    try {
      const next = update(currentSnapshot());
      saveCatalog(next);
      if (isSupabaseConfigured && supabaseAction) {
        await supabaseAction();
        setNotice("تم حفظ التعديل بنجاح في سوبابيس (Supabase)");
      } else {
        setNotice("تم حفظ التغيير محليًا على هذا الجهاز");
      }
    } catch (err: any) {
      setError(err?.message || "تعذّر الحفظ في سوبابيس. تأكد من تشغيل تحديث SQL الأخير وحاول مجددًا.");
    }
  }

  function signOut() {
    try { sessionStorage.removeItem(SESSION); } catch {}
    setEntered(false);
    setError("");
  }

  function download() {
    const url = URL.createObjectURL(new Blob([exportCatalog(readCatalog())], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "catalog-defaults.json";
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function reset() {
    if (!window.confirm("استعادة الأسعار وأجور التوصيل الأصلية على هذا الجهاز؟")) return;
    try {
      resetCatalog();
      setNotice("تمت استعادة الإعدادات الأصلية");
    } catch {
      setError("تعذّر استعادة الإعدادات.");
    }
  }

  // ضغط الصورة عند اختيار ملف من الجهاز
  async function onFileSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressing(true);
    try {
      const result = await compressImage(file, 1200, 1200, 0.82);
      setCompressedBlob(result.blob);
      setImagePreview(URL.createObjectURL(result.blob));
      setCompressStats({
        original: formatBytes(result.originalSize),
        compressed: formatBytes(result.compressedSize),
        reduction: result.reduction,
      });
    } catch (err) {
      console.error("Compression error:", err);
      setError("تعذر ضغط الصورة. يرجى تجربة صورة أخرى.");
    } finally {
      setIsCompressing(false);
    }
  }

  // إضافة طبق جديد ورفع صورته المضغوطة
  async function handleCreateDish(e: FormEvent) {
    e.preventDefault();
    if (isSubmittingDish || isCompressing) return;

    if (!addTitle.trim() || !addPrice) {
      setError("يرجى إدخال اسم الطبق وسعره");
      return;
    }

    setIsSubmittingDish(true);
    setError("");

    try {
      let finalImageUrl = "/images/hadramout/whole.jpg";

      if (compressedBlob) {
        if (isSupabaseConfigured && supabase) {
          const fileName = `dishes/dish_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.jpg`;
          const { error: uploadError } = await supabase.storage
            .from("restaurant-media")
            .upload(fileName, compressedBlob, {
              contentType: "image/jpeg",
              upsert: true,
            });

          if (uploadError) {
            throw new Error(`تعذر رفع الصورة لسوبابيس: ${uploadError.message}`);
          }

          const { data: { publicUrl } } = supabase.storage
            .from("restaurant-media")
            .getPublicUrl(fileName);

          finalImageUrl = publicUrl;
        }
      }

      if (isSupabaseConfigured && supabase) {
        const { data: inserted, error: insertError } = await supabase
          .from("dishes")
          .insert({
            title: addTitle.trim(),
            sub: addSub.trim(),
            category: addCategory,
            price: Number(addPrice),
            description: addDescription.trim(),
            image: finalImageUrl,
            available: addAvailable,
            sort_order: dishes.length + 1,
          })
          .select()
          .single();

        if (insertError) {
          throw new Error(`خطأ في إضافة الطبق لقاعدة البيانات: ${insertError.message}`);
        }

        if (inserted) {
          saveCatalog({
            ...currentSnapshot(),
            dishes: [
              ...dishes,
              {
                id: Number(inserted.id),
                title: inserted.title,
                sub: inserted.sub || "",
                category: inserted.category,
                price: Number(inserted.price),
                description: inserted.description || "",
                image: inserted.image,
                available: inserted.available,
              },
            ],
          });
        }
      } else {
        const newId = Math.max(0, ...dishes.map(d => d.id)) + 1;
        saveCatalog({
          ...currentSnapshot(),
          dishes: [
            ...dishes,
            {
              id: newId,
              title: addTitle.trim(),
              sub: addSub.trim(),
              category: addCategory,
              price: Number(addPrice),
              description: addDescription.trim(),
              image: finalImageUrl,
              available: addAvailable,
            },
          ],
        });
      }

      setNotice(`تمت إضافة طبق "${addTitle.trim()}" بنجاح!`);
      setShowAddModal(false);
      setAddTitle("");
      setAddSub("");
      setAddPrice(10000);
      setAddDescription("");
      setAddAvailable(true);
      setCompressedBlob(null);
      setImagePreview("");
      setCompressStats(null);
    } catch (err: any) {
      setError(err?.message || "حدث خطأ أثناء إضافة الطبق.");
    } finally {
      setIsSubmittingDish(false);
    }
  }

  // حذف طبق
  async function handleDeleteDish(id: number, title: string) {
    if (!window.confirm(`هل أنت متأكد من حذف طبق "${title}" نهائياً من المنيو وسوبابيس؟`)) return;

    try {
      if (isSupabaseConfigured && supabase) {
        const { error: delError } = await supabase.from("dishes").delete().eq("id", id);
        if (delError) throw new Error(delError.message);
      }

      saveCatalog({
        ...currentSnapshot(),
        dishes: dishes.filter(d => d.id !== id),
      });

      setNotice(`تم حذف طبق "${title}" بنجاح.`);
    } catch (err: any) {
      setError(`تعذر حذف الطبق: ${err?.message || ""}`);
    }
  }

  // إضافة منطقة توصيل جديدة
  async function handleCreateArea(e: FormEvent) {
    e.preventDefault();
    if (isSubmittingArea || !newAreaName.trim()) return;

    setIsSubmittingArea(true);
    setError("");

    try {
      const areaId = "area_" + Date.now().toString(36);
      const fee = Number(newAreaFee);

      if (isSupabaseConfigured && supabase) {
        const { error: insError } = await supabase.from("delivery_areas").insert({
          id: areaId,
          name: newAreaName.trim(),
          fee,
          sort_order: areas.length + 1,
        });
        if (insError) throw new Error(insError.message);
      }

      saveCatalog({
        ...currentSnapshot(),
        areas: [...areas, { id: areaId, name: newAreaName.trim(), fee }],
      });

      setNotice(`تمت إضافة منطقة "${newAreaName.trim()}" بنجاح!`);
      setShowAddAreaModal(false);
      setNewAreaName("");
      setNewAreaFee(3000);
    } catch (err: any) {
      setError(`تعذر إضافة المنطقة: ${err?.message || ""}`);
    } finally {
      setIsSubmittingArea(false);
    }
  }

  // حذف منطقة توصيل
  async function handleDeleteArea(id: string, name: string) {
    if (!window.confirm(`هل أنت متأكد من حذف منطقة "${name}" نهائياً من مناطق التوصيل؟`)) return;

    try {
      if (isSupabaseConfigured && supabase) {
        const { error: delError } = await supabase.from("delivery_areas").delete().eq("id", id);
        if (delError) throw new Error(delError.message);
      }

      saveCatalog({
        ...currentSnapshot(),
        areas: areas.filter(a => a.id !== id),
      });

      setNotice(`تم حذف منطقة "${name}" بنجاح.`);
    } catch (err: any) {
      setError(`تعذر حذف المنطقة: ${err?.message || ""}`);
    }
  }

  // إضافة كوبون خصم جديد
  async function handleCreateCoupon(e: FormEvent) {
    e.preventDefault();
    if (isSubmittingCoupon) return;

    const code = normalizeCouponCode(couponCode);
    const val = Number(couponValue);
    const minOrd = Math.max(0, Number(couponMinOrder) || 0);
    const maxUses = Math.max(0, Math.round(Number(couponMaxUses) || 0));

    if (!code || code.length < 2) {
      setError("أدخل كود كوبون صحيح (حرفين على الأقل).");
      return;
    }
    if (couponType === "percent" && (val < 1 || val > 100)) {
      setError("النسبة المئوية يجب أن تكون بين 1% و 100%.");
      return;
    }
    if (couponType === "fixed" && val < 250) {
      setError("مبلغ الخصم المحدد يجب أن يكون 250 د.ع على الأقل.");
      return;
    }
    if (coupons.some(c => normalizeCouponCode(c.code) === code)) {
      setError("هذا الكود موجود بالفعل، اختر كوداً آخر.");
      return;
    }

    setIsSubmittingCoupon(true);
    setError("");

    try {
      let createdId = "coupon_" + Date.now().toString(36);

      if (isSupabaseConfigured && supabase) {
        const { data: inserted, error: insError } = await supabase
          .from("coupons")
          .insert({
            code,
            discount_type: couponType,
            discount_value: val,
            min_order: minOrd,
            max_uses: maxUses,
            used_count: 0,
            active: couponActive,
          })
          .select()
          .single();

        if (insError) throw new Error(insError.message);
        if (inserted?.id) createdId = String(inserted.id);
      }

      saveCatalog({
        ...currentSnapshot(),
        coupons: [
          {
            id: createdId,
            code,
            discountType: couponType,
            discountValue: val,
            minOrder: minOrd,
            maxUses,
            usedCount: 0,
            active: couponActive,
          },
          ...coupons,
        ],
      });

      setNotice(`تم إنشاء كوبون "${code}" بنجاح!`);
      setShowAddCouponModal(false);
      setCouponCode("");
      setCouponType("percent");
      setCouponValue(10);
      setCouponMinOrder(0);
      setCouponMaxUses(10);
      setCouponActive(true);
    } catch (err: any) {
      setError(`تعذر إضافة الكوبون: ${err?.message || "تأكد من تشغيل ملف supabase/add-coupons.sql"}`);
    } finally {
      setIsSubmittingCoupon(false);
    }
  }

  async function handleToggleCoupon(id: string, currentActive: boolean) {
    const nextActive = !currentActive;
    await save(
      data => ({
        ...data,
        coupons: data.coupons.map(c => (c.id === id ? { ...c, active: nextActive } : c)),
      }),
      async () => {
        if (supabase) {
          const { error: updError } = await supabase.from("coupons").update({ active: nextActive }).eq("id", id);
          if (updError) throw new Error(updError.message);
        }
      }
    );
  }

  async function handleFeatureCoupon(code: string) {
    const clean = normalizeCouponCode(code);
    const isAlreadyFeatured = featuredCouponCode && normalizeCouponCode(featuredCouponCode) === clean;
    const nextCode = isAlreadyFeatured ? null : clean;
    await save(
      data => ({ ...data, featuredCouponCode: nextCode }),
      async () => {
        if (supabase) {
          const { error: setError } = await supabase
            .from("restaurant_settings")
            .upsert({ key: "featured_coupon_code", value: nextCode ?? "" });
          if (setError) throw new Error(setError.message);
        }
      }
    );
  }

  async function handleDeleteCoupon(id: string, code: string) {
    if (!window.confirm(`هل أنت متأكد من حذف كوبون "${code}" نهائياً؟`)) return;

    try {
      const wasFeatured = featuredCouponCode && normalizeCouponCode(featuredCouponCode) === normalizeCouponCode(code);
      if (isSupabaseConfigured && supabase) {
        const { error: delError } = await supabase.from("coupons").delete().eq("id", id);
        if (delError) throw new Error(delError.message);
        if (wasFeatured) {
          await supabase.from("restaurant_settings").upsert({ key: "featured_coupon_code", value: "" });
        }
      }

      saveCatalog({
        ...currentSnapshot(),
        coupons: coupons.filter(c => c.id !== id),
        featuredCouponCode: wasFeatured ? null : featuredCouponCode,
      });

      setNotice(`تم حذف كوبون "${code}" بنجاح.`);
    } catch (err: any) {
      setError(`تعذر حذف الكوبون: ${err?.message || ""}`);
    }
  }

  if (checking || !ready) {
    return (
      <div className="owner-loading">
        <Logo />
        <p>جارٍ فتح إعدادات حضرموت…</p>
      </div>
    );
  }

  if (!entered) {
    return (
      <main className="owner-login">
        <div className="login-brand-panel">
          <Logo />
          <span className="login-monogram">ح</span>
          <div>
            <p className="eyebrow light">مساحة أصحاب الطعم</p>
            <h1>كل التفاصيل،<br/>على ذوقك.</h1>
            <p>المنيو وأجور التوصيل…<br/>بترتيب يليق بحضرموت.</p>
          </div>
          <a href="/">عرض موقع المطعم <Icon name="arrow" size={17}/></a>
        </div>
        <div className="login-form-panel">
          <form onSubmit={signIn}>
            <span className="feature-kicker">إعدادات حضرموت</span>
            <h2>أهلًا بصاحب اللّمة.</h2>
            <p>سجّل دخولك لتعديل إعدادات ومنيو المطعم.</p>
            <label>
              كلمة مرور الإدارة
              <input name="password" type="password" required maxLength={128} autoComplete="current-password" placeholder="كلمة المرور"/>
            </label>
            {error && <p className="checkout-error" role="alert">{error}</p>}
            <button type="submit" className="button button-dark" disabled={busy}>
              {busy ? "جارٍ فتح الإعدادات…" : "ادخل إلى لوحة المطعم"}
              <Icon name="arrow" size={18}/>
            </button>
            <small>{isSupabaseConfigured ? "🟢 متصل بقاعدة بيانات سوبابيس (سحابي)" : "🟡 وضع التخزين المحلي"}</small>
          </form>
        </div>
      </main>
    );
  }

  return (
    <div className="owner-shell">
      <aside className="owner-sidebar">
        <Logo />
        <div className="owner-label">إعدادات الموقع</div>
        <nav aria-label="أقسام الإدارة">
          {([
            { id: "overview", label: "نظرة عامة", icon: "store" },
            { id: "menu", label: "إدارة المنيو", icon: "utensils" },
            { id: "delivery", label: "مناطق التوصيل", icon: "truck" },
            { id: "coupons", label: "كوبونات الخصم", icon: "tag" },
          ] as const).map(item => (
            <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}>
              <Icon name={item.icon} size={20} />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="owner-sidebar-bottom">
          <a href="/" target="_blank" rel="noopener noreferrer">شاهد موقعك <Icon name="arrow" size={16}/></a>
          <button onClick={signOut}>تسجيل الخروج</button>
          <small>حضرموت اليمني · الناصرية</small>
        </div>
      </aside>

      <main className="owner-main">
        <header className="owner-topbar">
          <div>
            <p className="eyebrow">أهلًا، أهل حضرموت</p>
            <h1>
              {tab === "menu"
                ? "منيو يتغيّر بلمسة."
                : tab === "delivery"
                ? "كل منطقة، وأجورها."
                : tab === "coupons"
                ? "خصومات وعروض… على ذوقك."
                : "مطعمك… بكل تفاصيله."}
            </h1>
            <p className="owner-refresh">
              {isSupabaseConfigured
                ? "🟢 متصل بسوبابيس: التعديلات والإضافات تُحفظ فورًا في السحابة وتظهر للزبائن في الوقت الفعلي."
                : "🟡 التعديلات تُحفظ محليًا."}
            </p>
          </div>
          <div className="owner-toolbar">
            <button
              className={`accepting-toggle ${accepting ? "open" : "closed"}`}
              onClick={() => {
                const nextVal = !accepting;
                save(
                  data => ({ ...data, accepting: nextVal }),
                  async () => {
                    if (supabase) {
                      const { error: setError } = await supabase
                        .from("restaurant_settings")
                        .upsert({ key: "accepting_orders", value: nextVal });
                      if (setError) throw new Error(setError.message);
                    }
                  }
                );
              }}
            >
              <i/>
              {accepting ? "الطلبات متاحة · إيقاف" : "الطلبات متوقفة · تشغيل"}
            </button>
          </div>
        </header>

        {error && <p className="checkout-error" role="alert">{error}</p>}
        {notice && <p className="owner-save-notice" role="status"><Icon name="check" size={15}/>{notice}</p>}

        {tab === "overview" && (
          <>
            <div className="owner-metrics">
              <article>
                <span>أصناف المنيو</span>
                <strong>{dishes.length}</strong>
                <small>مندي، صواني ومشروبات</small>
              </article>
              <article className="metric-featured">
                <span>متوفر للطلب</span>
                <strong>{dishes.filter(d => d.available).length}</strong>
                <small>{isSupabaseConfigured ? "مباشرة من سوبابيس" : "حسب الإعدادات الحالية"}</small>
              </article>
              <article>
                <span>مناطق التوصيل</span>
                <strong>{areas.length}</strong>
                <small>داخل الناصرية</small>
              </article>
              <article>
                <span>الكوبونات الفعّالة</span>
                <strong>{coupons.filter(c => c.active && !isCouponExhausted(c)).length}</strong>
                <small>{couponsEnabled ? "مفعّلة في السلة" : "مخفية حالياً"}</small>
              </article>
            </div>

            <section className="local-owner-panel">
              <Icon name="whatsapp" size={38}/>
              <h2>الطلب يوصلك برسالة واتساب.</h2>
              <p>الزبون يختار وجبته وعنوانه، ويكمل الإرسال داخل واتساب المطعم مباشرة.</p>
              <a href={`https://wa.me/${restaurant.whatsapp}`} className="button button-dark" target="_blank" rel="noopener noreferrer">
                واتساب المطعم <span dir="ltr">{restaurant.phone}</span>
              </a>
            </section>

            <section className="local-owner-panel">
              <h2>إعدادات النشر والنسخ الاحتياطي</h2>
              <p>يمكنك دائمًا تحميل نسخة احتياطية من قائمة الأسعار والمناطق المنشورة.</p>
              <div className="local-settings-actions">
                <button className="button button-dark" onClick={download}>تحميل الإعدادات كملف JSON <Icon name="arrow" size={17}/></button>
                <button className="button button-outline" onClick={reset}>استعادة الإعدادات الأصلية</button>
              </div>
            </section>
          </>
        )}

        {tab === "menu" && (
          <>
            <div className="owner-action-bar">
              <div className="owner-section-intro" style={{ margin: 0, flex: 1 }}>
                <Icon name="leaf" size={24}/>
                <p>يمكنك إضافة وجبات جديدة أو تعديل الأسعار وحذف الأطباق {isSupabaseConfigured ? "مباشرة في سوبابيس" : "محليًا"}.</p>
              </div>
              <button
                type="button"
                className="add-dish-btn"
                onClick={() => {
                  setError("");
                  setShowAddModal(true);
                }}
              >
                <Icon name="plus" size={18}/> إضافة طبق جديد للمنيو
              </button>
            </div>

            <div className="menu-editor-grid">
              {dishes.map(d => (
                <form
                  className="menu-editor-card"
                  key={`${d.id}-${d.price}-${d.available}`}
                  onSubmit={e => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    const newPrice = Number(f.get("price"));
                    const newAvailable = f.get("available") === "on";
                    save(
                      data => ({
                        ...data,
                        dishes: data.dishes.map(item => (item.id === d.id ? { ...item, price: newPrice, available: newAvailable } : item)),
                      }),
                      async () => {
                        if (supabase) {
                          const { error: updError } = await supabase
                            .from("dishes")
                            .update({ price: newPrice, available: newAvailable })
                            .eq("id", d.id);
                          if (updError) throw new Error(updError.message);
                        }
                      }
                    );
                  }}
                >
                  <img src={dishImage(d.image)} alt={d.title}/>
                  <div>
                    <h3>{d.title}</h3>
                    <p style={{ fontSize: "12px", color: "#8a9179", margin: "2px 0 10px" }}>{d.sub}</p>
                    <label>
                      السعر بالدينار
                      <input name="price" type="number" defaultValue={d.price} min="1" max="1000000" required/>
                    </label>
                    <label className="availability-check">
                      <input type="checkbox" name="available" defaultChecked={d.available}/>
                      متوفر للطلب
                    </label>
                    <div className="dish-card-actions">
                      <button className="button button-dark" type="submit">
                        حفظ التعديل <Icon name="check" size={15}/>
                      </button>
                      <button
                        type="button"
                        className="dish-delete-btn"
                        onClick={() => handleDeleteDish(d.id, d.title)}
                        aria-label={`حذف ${d.title}`}
                      >
                        <Icon name="trash" size={15}/> حذف
                      </button>
                    </div>
                  </div>
                </form>
              ))}
            </div>

            {/* نافذة إضافة طبق جديد */}
            {showAddModal && (
              <dialog
                ref={addDialog}
                className="add-dish-dialog"
                onCancel={e => { e.preventDefault(); setShowAddModal(false); }}
                onClick={e => { if (e.target === e.currentTarget) setShowAddModal(false); }}
              >
                <div className="add-dish-header">
                  <h2>إضافة طبق جديد للمنيو</h2>
                  <button className="add-dish-close" onClick={() => setShowAddModal(false)} aria-label="إغلاق">
                    <Icon name="close" size={20} />
                  </button>
                </div>
                <form className="add-dish-body" onSubmit={handleCreateDish}>
                  <div className="add-dish-grid">
                    <label className="add-dish-field">
                      <span>اسم الطبق *</span>
                      <input
                        required
                        placeholder="مثال: مندي لحم تيس بلدي"
                        value={addTitle}
                        onChange={e => setAddTitle(e.target.value)}
                      />
                    </label>
                    <label className="add-dish-field">
                      <span>التصنيف *</span>
                      <select value={addCategory} onChange={e => setAddCategory(e.target.value)}>
                        {categories.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="add-dish-grid">
                    <label className="add-dish-field">
                      <span>السعر بالدينار (د.ع) *</span>
                      <input
                        type="number"
                        required
                        min="500"
                        max="1000000"
                        step="250"
                        value={addPrice}
                        onChange={e => setAddPrice(Number(e.target.value))}
                      />
                    </label>
                    <label className="add-dish-field">
                      <span>وصف مختصر</span>
                      <input
                        placeholder="مثال: نصف دجاجة مع أرز المندي والصلصة"
                        value={addSub}
                        onChange={e => setAddSub(e.target.value)}
                      />
                    </label>
                  </div>

                  <label className="add-dish-field">
                    <span>وصف وتفاصيل الوجبة</span>
                    <textarea
                      rows={2}
                      placeholder="تفاصيل المكونات أو ملاحظات الحساسية..."
                      value={addDescription}
                      onChange={e => setAddDescription(e.target.value)}
                    />
                  </label>

                  <div className="add-dish-field">
                    <span>صورة الطبق (سيتم ضغطها تلقائيًا لتقليص المساحة)</span>
                    <label className="add-dish-upload">
                      <input type="file" accept="image/*" onChange={onFileSelected} />
                      <div className="add-dish-upload-content">
                        <Icon name="utensils" size={28} />
                        <strong>{imagePreview ? "تغيير الصورة المختارة" : "اضغط هنا لاختيار صورة من جهازك"}</strong>
                        <small>تدعم JPG, PNG, WebP (يتم ضغط الصورة فوريًا قبل الرفع لتقليل استهلاك المساحة)</small>
                      </div>
                    </label>

                    {isCompressing && <p style={{ fontSize: "12px", color: "#666" }}>جارٍ ضغط الصورة ومعالجتها...</p>}

                    {imagePreview && compressStats && (
                      <div className="add-dish-preview-wrap">
                        <img src={imagePreview} alt="معاينة" className="add-dish-preview-img" />
                        <div className="add-dish-compression-badge">
                          <strong>✓ تم ضغط الصورة بنجاح!</strong>
                          <br />
                          الحجم الأصلي: <b>{compressStats.original}</b> ➔ بعد الضغط: <b>{compressStats.compressed}</b>
                          <br />
                          <small>تم توفير <b>{compressStats.reduction}%</b> من مساحة سوبابيس وسرعة التحميل.</small>
                        </div>
                      </div>
                    )}
                  </div>

                  <label className="availability-check" style={{ marginTop: "4px" }}>
                    <input
                      type="checkbox"
                      checked={addAvailable}
                      onChange={e => setAddAvailable(e.target.checked)}
                    />
                    <span>متوفر للطلب في المنيو حاليًا</span>
                  </label>

                  {error && <p className="checkout-error" role="alert">{error}</p>}

                  <div className="add-dish-actions">
                    <button
                      type="button"
                      className="button button-outline"
                      onClick={() => setShowAddModal(false)}
                      disabled={isSubmittingDish}
                    >
                      إلغاء
                    </button>
                    <button
                      type="submit"
                      className="button button-dark"
                      disabled={isSubmittingDish || isCompressing}
                    >
                      {isSubmittingDish ? "جارٍ حفظ الطبق ورفع الصورة..." : "إضافة الطبق ونشره"}
                      <Icon name="plus" size={16} />
                    </button>
                  </div>
                </form>
              </dialog>
            )}
          </>
        )}

        {tab === "delivery" && (
          <>
            <div className="owner-action-bar">
              <div className="owner-section-intro" style={{ margin: 0, flex: 1 }}>
                <Icon name="truck" size={24}/>
                <p>عدّل أجور توصيل أحياء الناصرية أو أضف مناطق جديدة {isSupabaseConfigured ? "مباشرة في سوبابيس" : "محليًا"}.</p>
              </div>
              <button
                type="button"
                className="add-dish-btn"
                onClick={() => {
                  setError("");
                  setShowAddAreaModal(true);
                }}
              >
                <Icon name="plus" size={18}/> إضافة منطقة توصيل جديدة
              </button>
            </div>

            <div className="area-editor-grid">
              {areas.map(a => (
                <form
                  className="area-editor"
                  key={`${a.id}-${a.fee}`}
                  onSubmit={e => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    const newFee = Number(f.get("fee"));
                    save(
                      data => ({
                        ...data,
                        areas: data.areas.map(item => (item.id === a.id ? { ...item, fee: newFee } : item)),
                      }),
                      async () => {
                        if (supabase) {
                          const { error: updError } = await supabase
                            .from("delivery_areas")
                            .update({ fee: newFee })
                            .eq("id", a.id);
                          if (updError) throw new Error(updError.message);
                        }
                      }
                    );
                  }}
                >
                  <span><Icon name="pin" size={18}/>{a.name}</span>
                  <label>
                    <span className="sr-only">أجرة {a.name}</span>
                    <input name="fee" type="number" min="0" max="100000" defaultValue={a.fee} required/>
                    <small>د.ع</small>
                  </label>
                  <div className="area-editor-actions">
                    <button className="area-save-btn" type="submit" aria-label={`حفظ أجرة ${a.name}`}>
                      <Icon name="check" size={17}/>
                    </button>
                    <button
                      type="button"
                      className="area-delete-btn"
                      onClick={() => handleDeleteArea(a.id, a.name)}
                      aria-label={`حذف منطقة ${a.name}`}
                    >
                      <Icon name="trash" size={16}/>
                    </button>
                  </div>
                </form>
              ))}
            </div>

            {/* نافذة إضافة منطقة توصيل جديدة */}
            {showAddAreaModal && (
              <dialog
                ref={addAreaDialog}
                className="add-dish-dialog"
                style={{ maxWidth: "460px" }}
                onCancel={e => { e.preventDefault(); setShowAddAreaModal(false); }}
                onClick={e => { if (e.target === e.currentTarget) setShowAddAreaModal(false); }}
              >
                <div className="add-dish-header">
                  <h2>إضافة منطقة توصيل جديدة</h2>
                  <button className="add-dish-close" onClick={() => setShowAddAreaModal(false)} aria-label="إغلاق">
                    <Icon name="close" size={20} />
                  </button>
                </div>
                <form className="add-dish-body" onSubmit={handleCreateArea}>
                  <label className="add-dish-field">
                    <span>اسم الحي / المنطقة في الناصرية *</span>
                    <input
                      required
                      placeholder="مثال: حي الجامعة، الشعلة، الشرقية..."
                      value={newAreaName}
                      onChange={e => setNewAreaName(e.target.value)}
                    />
                  </label>
                  <label className="add-dish-field">
                    <span>أجرة التوصيل بالدينار (د.ع) *</span>
                    <input
                      type="number"
                      required
                      min="0"
                      max="100000"
                      step="500"
                      value={newAreaFee}
                      onChange={e => setNewAreaFee(Number(e.target.value))}
                    />
                  </label>
                  {error && <p className="checkout-error" role="alert">{error}</p>}
                  <div className="add-dish-actions">
                    <button
                      type="button"
                      className="button button-outline"
                      onClick={() => setShowAddAreaModal(false)}
                      disabled={isSubmittingArea}
                    >
                      إلغاء
                    </button>
                    <button
                      type="submit"
                      className="button button-dark"
                      disabled={isSubmittingArea}
                    >
                      {isSubmittingArea ? "جارٍ حفظ المنطقة..." : "إضافة وحفظ المنطقة"}
                      <Icon name="plus" size={16} />
                    </button>
                  </div>
                </form>
              </dialog>
            )}
          </>
        )}

        {tab === "coupons" && (
          <>
            <div className="owner-action-bar">
              <div className="owner-section-intro" style={{ margin: 0, flex: 1 }}>
                <Icon name="tag" size={24}/>
                <p>أنشئ كوبونات خصم بنسبة مئوية (%) أو بسعر محدد (د.ع) تطبق على جميع طلبات السلة.</p>
              </div>
              <button
                type="button"
                className={`accepting-toggle ${couponsEnabled ? "open" : "closed"}`}
                onClick={() => {
                  const nextEnabled = !couponsEnabled;
                  save(
                    data => ({ ...data, couponsEnabled: nextEnabled }),
                    async () => {
                      if (supabase) {
                        const { error: setError } = await supabase
                          .from("restaurant_settings")
                          .upsert({ key: "coupons_enabled", value: nextEnabled });
                        if (setError) throw new Error(setError.message);
                      }
                    }
                  );
                }}
              >
                <i/>
                {couponsEnabled ? "نظام الكوبونات مفعّل في السلة · إيقاف" : "نظام الكوبونات متوقف · تفعيل"}
              </button>
              <button
                type="button"
                className="add-dish-btn"
                onClick={() => {
                  setError("");
                  setShowAddCouponModal(true);
                }}
              >
                <Icon name="plus" size={18}/> إضافة كوبون خصم جديد
              </button>
            </div>

            {coupons.length === 0 ? (
              <section className="local-owner-panel" style={{ textAlign: "center" }}>
                <Icon name="tag" size={38}/>
                <h2>لا توجد كوبونات خصم حاليًا.</h2>
                <p style={{ marginInline: "auto" }}>أضف أول كود خصم (نسبة مئوية أو مبلغ ثابت) ليتمكن الزبائن من استخدامه في السلة.</p>
                <button
                  type="button"
                  className="button button-dark"
                  onClick={() => {
                    setError("");
                    setShowAddCouponModal(true);
                  }}
                >
                  إنشاء أول كوبون <Icon name="plus" size={16}/>
                </button>
              </section>
            ) : (
              <div className="coupon-editor-grid">
                {coupons.map(c => {
                  const exhausted = isCouponExhausted(c);
                  const isFeatured = Boolean(
                    featuredCouponCode && normalizeCouponCode(featuredCouponCode) === normalizeCouponCode(c.code)
                  );
                  return (
                    <article className={`coupon-card ${(!c.active || exhausted) ? "is-inactive" : ""} ${isFeatured && c.active && !exhausted ? "is-featured" : ""}`} key={c.id}>
                      <div className="coupon-card-top">
                        <span className="coupon-code-badge" dir="ltr">{c.code}</span>
                        <span className="coupon-type-pill">
                          {c.discountType === "percent" ? "نسبة مئوية %" : "مبلغ محدد د.ع"}
                        </span>
                      </div>
                      <div className="coupon-value-text">
                        خصم {c.discountType === "percent" ? `${c.discountValue}%` : `${money(c.discountValue)} د.ع`}
                      </div>
                      <p className="coupon-meta">
                        {c.minOrder > 0
                          ? `الحد الأدنى للطلب: ${money(c.minOrder)} د.ع`
                          : "يسري على جميع طلبات السلة دون حد أدنى"}
                      </p>
                      <p className="coupon-meta" style={{ fontWeight: 700, color: exhausted ? "#b24a30" : "#35672c" }}>
                        {c.maxUses > 0
                          ? exhausted
                            ? `انتهت الصلاحية — استُخدم بالكامل (${c.usedCount} / ${c.maxUses} ${c.maxUses === 1 ? "شخص" : "أشخاص"})`
                            : `الاستخدام: ${c.usedCount} / ${c.maxUses} (متبقي ${Math.max(0, c.maxUses - c.usedCount)} — مرة واحدة لكل شخص)`
                          : `الاستخدام: ${c.usedCount} مرة (غير محدود · مرة واحدة لكل شخص)`}
                      </p>
                      {!exhausted && c.active && (
                        <button
                          type="button"
                          className={`coupon-pin-btn ${isFeatured ? "is-pinned" : ""}`}
                          onClick={() => handleFeatureCoupon(c.code)}
                        >
                          <Icon name="star" size={14}/>
                          {isFeatured ? "مثبّت كعرض بارز أعلى الموقع · إلغاء التثبيت" : "تثبيت كعرض بارز أعلى الموقع"}
                        </button>
                      )}
                      <div className="coupon-card-actions">
                        <button
                          type="button"
                          className={`coupon-toggle-btn ${(!c.active || exhausted) ? "is-off" : ""}`}
                          disabled={exhausted}
                          onClick={() => handleToggleCoupon(c.id, c.active)}
                        >
                          {exhausted
                            ? "منتهي (اكتمل العدد)"
                            : c.active
                              ? "مفعّل · إيقاف الكوبون"
                              : "معطّل · تفعيل الكوبون"}
                        </button>
                        <button
                          type="button"
                          className="dish-delete-btn"
                          onClick={() => handleDeleteCoupon(c.id, c.code)}
                          aria-label={`حذف كوبون ${c.code}`}
                        >
                          <Icon name="trash" size={15}/> حذف
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {/* نافذة إضافة كوبون خصم جديد */}
            {showAddCouponModal && (
              <dialog
                ref={addCouponDialog}
                className="add-dish-dialog"
                style={{ maxWidth: "500px" }}
                onCancel={e => { e.preventDefault(); setShowAddCouponModal(false); }}
                onClick={e => { if (e.target === e.currentTarget) setShowAddCouponModal(false); }}
              >
                <div className="add-dish-header">
                  <h2>إضافة كوبون خصم جديد</h2>
                  <button className="add-dish-close" onClick={() => setShowAddCouponModal(false)} aria-label="إغلاق">
                    <Icon name="close" size={20} />
                  </button>
                </div>
                <form className="add-dish-body" onSubmit={handleCreateCoupon}>
                  <div className="add-dish-grid">
                    <label className="add-dish-field">
                      <span>كود الخصم (بالإنجليزية أو الأرقام) *</span>
                      <input
                        required
                        dir="ltr"
                        placeholder="مثال: H10 أو VIP5000"
                        value={couponCode}
                        maxLength={32}
                        onChange={e => setCouponCode(e.target.value.toUpperCase())}
                      />
                    </label>
                    <label className="add-dish-field">
                      <span>نوع الخصم *</span>
                      <select
                        value={couponType}
                        onChange={e => {
                          const nextType = e.target.value as "percent" | "fixed";
                          setCouponType(nextType);
                          setCouponValue(nextType === "percent" ? 10 : 3000);
                        }}
                      >
                        <option value="percent">نسبة مئوية (%)</option>
                        <option value="fixed">سعر محدد (د.ع)</option>
                      </select>
                    </label>
                  </div>

                  <div className="add-dish-grid">
                    <label className="add-dish-field">
                      <span>{couponType === "percent" ? "نسبة الخصم (%) *" : "قيمة الخصم (د.ع) *"}</span>
                      <input
                        type="number"
                        required
                        min={couponType === "percent" ? 1 : 250}
                        max={couponType === "percent" ? 100 : 500000}
                        step={couponType === "percent" ? 1 : 250}
                        value={couponValue}
                        onChange={e => setCouponValue(Number(e.target.value))}
                      />
                    </label>
                    <label className="add-dish-field">
                      <span>الحد الأدنى للطلب (د.ع)</span>
                      <input
                        type="number"
                        min={0}
                        max={500000}
                        step={1000}
                        value={couponMinOrder}
                        onChange={e => setCouponMinOrder(Number(e.target.value))}
                      />
                    </label>
                  </div>

                  <div className="add-dish-field">
                    <span>عدد الأشخاص / مرات الاستخدام المسموحة (0 = غير محدود) *</span>
                    <input
                      type="number"
                      required
                      min={0}
                      max={100000}
                      value={couponMaxUses}
                      onChange={e => setCouponMaxUses(Number(e.target.value))}
                    />
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "4px" }}>
                      {[
                        { label: "شخص واحد فقط (وينتهي نهائياً)", val: 1 },
                        { label: "10 أشخاص", val: 10 },
                        { label: "50 شخص", val: 50 },
                        { label: "غير محدود", val: 0 },
                      ].map(preset => (
                        <button
                          key={preset.val}
                          type="button"
                          onClick={() => setCouponMaxUses(preset.val)}
                          style={{
                            padding: "5px 10px",
                            borderRadius: "7px",
                            fontSize: "11px",
                            fontWeight: 700,
                            cursor: "pointer",
                            border: couponMaxUses === preset.val ? "1px solid #263c2b" : "1px solid #d5ceb9",
                            background: couponMaxUses === preset.val ? "#263c2b" : "#fff",
                            color: couponMaxUses === preset.val ? "#f9eed7" : "#44543e",
                          }}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                    <small style={{ color: "#767d66", fontSize: "11px", fontWeight: 400 }}>
                      ملاحظة: كل شخص يحق له استخدام الكوبون مرة واحدة فقط على جهازه ورقم هاتفه، وعند اكتمال العدد يتعطل الكوبون تلقائيًا.
                    </small>
                  </div>

                  <label className="availability-check" style={{ marginTop: "4px" }}>
                    <input
                      type="checkbox"
                      checked={couponActive}
                      onChange={e => setCouponActive(e.target.checked)}
                    />
                    <span>تفعيل الكوبون فورًا للزبائن</span>
                  </label>

                  {error && <p className="checkout-error" role="alert">{error}</p>}

                  <div className="add-dish-actions">
                    <button
                      type="button"
                      className="button button-outline"
                      onClick={() => setShowAddCouponModal(false)}
                      disabled={isSubmittingCoupon}
                    >
                      إلغاء
                    </button>
                    <button
                      type="submit"
                      className="button button-dark"
                      disabled={isSubmittingCoupon}
                    >
                      {isSubmittingCoupon ? "جارٍ حفظ الكوبون..." : "إضافة وتفعيل الكوبون"}
                      <Icon name="plus" size={16} />
                    </button>
                  </div>
                </form>
              </dialog>
            )}
          </>
        )}
      </main>
    </div>
  );
}
