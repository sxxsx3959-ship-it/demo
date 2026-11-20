export type Dish = { id: number; category: string; title: string; sub: string; price: number; image: string; description: string; available: boolean };
export const restaurant = {
  name: "حضرموت اليمني",
  city: "الناصرية",
  address: "الناصرية، شارع الإمام علي",
  phone: "07841444044",
  whatsapp: "9647841444044",
  instagram: "https://www.instagram.com/hadramot.na/",
  mapEmbed: "https://www.google.com/maps?cid=17520701731878199095&output=embed&hl=ar&z=16",
  directions: "https://www.google.com/maps/dir/?api=1&destination=حضرموت+اليمني+الناصرية&destination_place_id=ChIJhY6H0oXj3T8RN98rgGUJJvM",
  map: "https://www.google.com/maps/search/?api=1&query=مندي+ومشويات+حضرموت+اليمني+الناصرية+شارع+الإمام+علي&query_place_id=ChIJhY6H0oXj3T8RN98rgGUJJvM",
};
export const categories = [
  { id: "chicken", name: "مندي الدجاج", sub: "نكهة المندي الأصيلة", image: "whole" },
  { id: "meat", name: "مندي اللحم", sub: "لحم وأرز على الأصول", image: "meat" },
  { id: "platters", name: "صواني المشاركة", sub: "للّمة والجمعة الحلوة", image: "platter" },
  { id: "drinks", name: "المشروبات", sub: "كمّل وجبتك على ذوقك", image: "drinks" },
];
// Menu source: https://talabat2.com/products.php?category_id=29
// Update this catalog whenever the restaurant changes prices or availability.
export const dishes: Dish[] = [
  { id: 27, category: "chicken", title: "نصف مندي دجاج", sub: "نصف دجاجة مع أرز المندي", price: 10000, image: "chicken", description: "وجبة نصف دجاجة مندي مع الأرز. اكتب أي إضافات أو تفضيلات في ملاحظات الطلب.", available: true },
  { id: 37, category: "meat", title: "نصف كيلو مندي لحم", sub: "نكهة غنية تستحق التجربة", price: 19000, image: "meat", description: "نصف كيلو مندي لحم. لمتطلبات الوجبة الخاصة أو حساسية الطعام، اترك ملاحظة لفريق المطعم.", available: true },
  { id: 134, category: "platters", title: "صينية مشكل مندي", sub: "للمشاركة مع أحبابك", price: 31000, image: "platter", description: "صينية مشكل مندي للمشاركة. يمكنك الاستفسار عن تفاصيل الصينية وعدد الأشخاص عند تأكيد الطلب.", available: true },
  { id: 38, category: "chicken", title: "ربع مندي دجاج", sub: "وجبة على قدّ جوعك", price: 6000, image: "quarter", description: "ربع دجاجة مندي. أضف مشروبك المفضل واكتب تفضيلاتك في ملاحظات الطلب.", available: true },
  { id: 26, category: "chicken", title: "دجاجة مندي كاملة", sub: "وجبة كاملة، وفرحة كاملة", price: 20000, image: "whole", description: "دجاجة مندي كاملة مع الأرز، خيار للمشاركة على مائدتكم.", available: true },
  { id: 252, category: "drinks", title: "مشروبات غازية", sub: "انتعاش مع وجبتك", price: 500, image: "drinks", description: "اذكر نوع المشروب الذي تفضله في الملاحظات. يؤكد المطعم النوع المتوفر مع طلبك.", available: true },
  { id: 263, category: "chicken", title: "مجبوس دجاج", sub: "نصف دجاجة مع الأرز", price: 11000, image: "majboos", description: "مجبوس دجاج — نصف حبة. غير متوفر حاليًا.", available: false },
];
export const money = (value: number) => new Intl.NumberFormat("en-US").format(value);
export const dishImage = (name: string) => {
  if (!name) return "/images/hadramout/whole.jpg";
  if (name.startsWith("http://") || name.startsWith("https://") || name.startsWith("/")) return name;
  return `/images/hadramout/${name}.jpg`;
};
export const CART_KEY = "hadramout-cart-v1";
export const MAX_QUANTITY = 99;
export type CartItem = { id: number; quantity: number };
export function sanitizeCart(value: unknown, menu = dishes): CartItem[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<number>();
  return value.flatMap(item => {
    if (!item || typeof item !== "object" || !Number.isSafeInteger(item.id) || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || !menu.some(d => d.id === item.id) || seen.has(item.id)) return [];
    seen.add(item.id);
    return [{ id: item.id, quantity: Math.min(item.quantity, MAX_QUANTITY) }];
  });
}

export type Coupon = {
  id: string;
  code: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  minOrder: number;
  maxUses: number;
  usedCount: number;
  active: boolean;
};

export function normalizeCouponCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

export function isCouponExhausted(coupon: Coupon | null | undefined): boolean {
  if (!coupon) return false;
  return coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses;
}

export function isCouponUsable(coupon: Coupon | null | undefined): boolean {
  return Boolean(coupon && coupon.active && !isCouponExhausted(coupon));
}

export function calculateDiscount(subtotal: number, coupon: Coupon | null | undefined): number {
  if (!isCouponUsable(coupon) || !coupon || subtotal <= 0) return 0;
  if (coupon.minOrder > 0 && subtotal < coupon.minOrder) return 0;
  if (coupon.discountType === "percent") {
    const pct = Math.max(0, Math.min(100, coupon.discountValue));
    return Math.min(subtotal, Math.round((subtotal * pct) / 100));
  }
  return Math.min(subtotal, Math.max(0, Math.round(coupon.discountValue)));
}
