"use client";
import { useEffect, useState, type FormEvent } from "react";
import { Icon, Logo } from "@/components/Brand";
import { dishImage, money, restaurant } from "@/lib/restaurant";
import { useCatalog } from "@/lib/use-catalog";
import { exportCatalog, readCatalog, resetCatalog, saveCatalog, type Catalog } from "@/lib/local-catalog";
import { checkLocalPassword } from "@/lib/local-owner";
const SESSION = "hadramout-local-owner-session";
export default function OwnerPage() {
  const { dishes, areas, accepting, ready } = useCatalog();
  const [entered, setEntered] = useState(false), [checking, setChecking] = useState(true), [busy, setBusy] = useState(false);
  const [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [tab, setTab] = useState<"overview" | "menu" | "delivery">("overview");
  useEffect(() => { try { setEntered(sessionStorage.getItem(SESSION) === "1"); } catch {} setChecking(false); }, []);
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(""), 3500); return () => window.clearTimeout(timer); }, [notice]);
  async function signIn(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (busy) return; const password = String(new FormData(e.currentTarget).get("password") || "");
    setBusy(true); setError("");
    try { if (!await checkLocalPassword(password)) { setError("كلمة المرور غير صحيحة."); return; } setEntered(true); try { sessionStorage.setItem(SESSION,"1"); } catch {} }
    catch { setError("تعذّر فتح الإعدادات. افتح الموقع باستخدام HTTPS أو من localhost."); }
    finally { setBusy(false); }
  }
  function save(update: (data: Catalog) => Catalog) {
    setError(""); try { saveCatalog(update(readCatalog())); setNotice("تم حفظ التغيير على هذا الجهاز"); }
    catch { setError("تعذّر الحفظ في المتصفح. اسمح بتخزين بيانات الموقع وحاول مرة أخرى."); }
  }
  function signOut() { try { sessionStorage.removeItem(SESSION); } catch {} setEntered(false); setError(""); }
  function download() {
    const url = URL.createObjectURL(new Blob([exportCatalog(readCatalog())], {type:"application/json"}));
    const a = document.createElement("a"); a.href=url; a.download="catalog-defaults.json"; a.click(); window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function reset() { if (!window.confirm("استعادة الأسعار وأجور التوصيل الأصلية على هذا الجهاز؟")) return; try { resetCatalog(); setNotice("تمت استعادة الإعدادات الأصلية"); } catch { setError("تعذّر استعادة الإعدادات."); } }
  if (checking || !ready) return <div className="owner-loading"><Logo/><p>جارٍ فتح إعدادات حضرموت…</p></div>;
  if (!entered) return <main className="owner-login"><div className="login-brand-panel"><Logo/><span className="login-monogram">ح</span><div><p className="eyebrow light">مساحة أصحاب الطعم</p><h1>كل التفاصيل،<br/>على ذوقك.</h1><p>المنيو وأجور التوصيل…<br/>بترتيب يليق بحضرموت.</p></div><a href="/">عرض موقع المطعم <Icon name="arrow" size={17}/></a></div><div className="login-form-panel"><form onSubmit={signIn}><span className="feature-kicker">إعدادات حضرموت</span><h2>أهلًا بصاحب اللّمة.</h2><p>سجّل دخولك لتعديل إعدادات الموقع على هذا الجهاز.</p><label>كلمة مرور الإدارة<input name="password" type="password" required maxLength={128} autoComplete="current-password" placeholder="كلمة المرور"/></label>{error && <p className="checkout-error" role="alert">{error}</p>}<button type="submit" className="button button-dark" disabled={busy}>{busy ? "جارٍ فتح الإعدادات…" : "ادخل إلى لوحة المطعم"}<Icon name="arrow" size={18}/></button><small>التغييرات محلية في هذا المتصفح.</small></form></div></main>;
  return <div className="owner-shell"><aside className="owner-sidebar"><Logo/><div className="owner-label">إعدادات الموقع</div><nav aria-label="أقسام الإدارة">{([{id:"overview",label:"نظرة عامة",icon:"store"},{id:"menu",label:"إدارة المنيو",icon:"utensils"},{id:"delivery",label:"مناطق التوصيل",icon:"truck"}] as const).map(item=><button key={item.id} className={tab===item.id?"active":""} onClick={()=>setTab(item.id)}><Icon name={item.icon} size={20}/>{item.label}</button>)}</nav><div className="owner-sidebar-bottom"><a href="/" target="_blank" rel="noopener noreferrer">شاهد موقعك <Icon name="arrow" size={16}/></a><button onClick={signOut}>تسجيل الخروج</button><small>حضرموت اليمني · الناصرية</small></div></aside>
    <main className="owner-main"><header className="owner-topbar"><div><p className="eyebrow">أهلًا، أهل حضرموت</p><h1>{tab==="menu"?"منيو يتغيّر بلمسة.":tab==="delivery"?"كل منطقة، وأجورها.":"مطعمك… بكل تفاصيله."}</h1><p className="owner-refresh">التعديلات تُحفظ على هذا الجهاز فقط، ولا تنتقل لأجهزة الزوّار.</p></div><div className="owner-toolbar"><button className={`accepting-toggle ${accepting?"open":"closed"}`} onClick={()=>save(data=>({...data,accepting:!data.accepting}))}><i/>{accepting?"الطلبات متاحة · إيقاف محلي":"الطلبات متوقفة · تشغيل محلي"}</button></div></header>
    {error&&<p className="checkout-error" role="alert">{error}</p>}{notice&&<p className="owner-save-notice" role="status"><Icon name="check" size={15}/>{notice}</p>}
    {tab==="overview"&&<><div className="owner-metrics"><article><span>أصناف المنيو</span><strong>{dishes.length}</strong><small>مندي، صواني ومشروبات</small></article><article className="metric-featured"><span>متوفر للطلب</span><strong>{dishes.filter(d=>d.available).length}</strong><small>حسب إعدادات هذا المتصفح</small></article><article><span>مناطق التوصيل</span><strong>{areas.length}</strong><small>داخل الناصرية</small></article><article><span>طريقة استقبال الطلبات</span><strong className="local-channel">واتساب</strong><small>على رقم المطعم مباشرة</small></article></div><section className="local-owner-panel"><Icon name="whatsapp" size={38}/><h2>الطلب يوصلك برسالة.</h2><p>الزبون يختار وجبته وعنوانه، ويكمل الإرسال داخل واتساب المطعم. هذه اللوحة لا تجمع طلبات الزبائن من أجهزتهم ولا تحفظ بياناتهم.</p><a href={`https://wa.me/${restaurant.whatsapp}`} className="button button-dark" target="_blank" rel="noopener noreferrer">واتساب المطعم <span dir="ltr">{restaurant.phone}</span></a></section><section className="local-owner-panel"><h2>إعداداتك، محفوظة عندك.</h2><p>لتطبيق التعديلات لكل الزوّار، حمّل ملف الإعدادات واستبدل به ملف <b dir="ltr">lib/catalog-defaults.json</b> في المشروع، ثم أعد نشر الموقع.</p><div className="local-settings-actions"><button className="button button-dark" onClick={download}>تحميل الإعدادات للنشر <Icon name="arrow" size={17}/></button><button className="button button-outline" onClick={reset}>استعادة الإعدادات الأصلية</button></div></section></>}
    {tab==="menu"&&<><div className="owner-section-intro"><Icon name="leaf" size={24}/><p>عدّل السعر والتوفر، وشاهد النتيجة في الموقع على نفس المتصفح.</p></div><div className="menu-editor-grid">{dishes.map(d=><form className="menu-editor-card" key={`${d.id}-${d.price}-${d.available}`} onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);save(data=>({...data,dishes:data.dishes.map(item=>item.id===d.id?{...item,price:Number(f.get("price")),available:f.get("available")==="on"}:item)}));}}><img src={dishImage(d.image)} alt={d.title}/><div><h3>{d.title}</h3><label>السعر بالدينار<input name="price" type="number" defaultValue={d.price} min="1" max="1000000" required/></label><label className="availability-check"><input type="checkbox" name="available" defaultChecked={d.available}/>متوفر للطلب</label><button className="button button-dark" type="submit">حفظ التغيير <Icon name="check" size={15}/></button></div></form>)}</div></>}
    {tab==="delivery"&&<><div className="owner-section-intro"><Icon name="truck" size={25}/><p>الأجور تُحفظ محليًا وتظهر في السلة على هذا الجهاز.</p></div><div className="area-editor-grid">{areas.map(a=><form className="area-editor" key={`${a.id}-${a.fee}`} onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);save(data=>({...data,areas:data.areas.map(item=>item.id===a.id?{...item,fee:Number(f.get("fee"))}:item)}));}}><span><Icon name="pin" size={18}/>{a.name}</span><label><span className="sr-only">أجرة {a.name}</span><input name="fee" type="number" min="0" max="100000" defaultValue={a.fee} required/><small>د.ع</small></label><button aria-label={`حفظ أجرة ${a.name}`}><Icon name="check" size={19}/></button></form>)}</div></>}
    </main></div>;
}
