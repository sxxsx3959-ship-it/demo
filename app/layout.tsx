import type { Metadata } from "next";
import "./globals.css";
import "./ordering.css";
import "./features.css";
import "./landing.css";
export const metadata: Metadata = {
  title: "حضرموت اليمني | مندي ومشويات في الناصرية",
  description: "اطلب مندي الدجاج واللحم وصواني المشاركة من حضرموت اليمني في الناصرية، شارع الإمام علي. اختر منطقتك واعرف أجور التوصيل وأرسل طلبك مباشرة للمطعم. تواصل معنا بالهاتف أو واتساب وشاهد موقعنا على الخريطة.",
  applicationName: "حضرموت اليمني",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl"><body>{children}</body></html>;
}

