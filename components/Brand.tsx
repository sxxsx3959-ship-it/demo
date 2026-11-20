import type { ReactNode } from "react";
type IconName = "arrow" | "leaf" | "glass" | "people" | "utensils" | "heart" | "case" | "cake" | "calendar" | "clock" | "pin" | "mail" | "phone" | "star" | "plus" | "close" | "menu" | "instagram" | "facebook" | "play" | "check" | "bag" | "minus" | "trash" | "truck" | "store" | "whatsapp" | "tag";
export function Icon({ name, size = 22, className = "" }: { name: IconName; size?: number; className?: string }) {
  const paths: Record<IconName, ReactNode> = {
    tag: <><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z"/><circle cx="7" cy="7" r="1.5"/></>,
    whatsapp: <><path d="m3 21 1.3-4.4A9 9 0 1 1 8 20.1L3 21Z"/><path d="M8 7c-2 3 3 9 7 9l2-2-3-2-1 1c-2-1-3-2-3-3l1-1-1-2H8Z"/></>,
    bag: <><path d="M5 7h14l2 14H3L5 7Z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/></>,
    minus: <path d="M5 12h14"/>,
    trash: <><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/></>,
    truck: <><path d="M3 4h11v12H3V4Zm11 5h4l3 4v3h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></>,
    store: <><path d="M3 10V7l2-4h14l2 4v3M4 10v11h16V10M9 21v-8h6v8M3 7h18"/><path d="M3 10c2 3 4 3 6 0 2 3 4 3 6 0 2 3 4 3 6 0"/></>,
    arrow: <><path d="M19 12H5m6-6-6 6 6 6" /></>,
    leaf: <><path d="M20 4C8 2 3 8 5 15s15 6 15-11Z" /><path d="M4 21 16 9m-8 8v-5m4 1h5" /></>,
    glass: <><path d="M7 3h10l1 7a6 6 0 0 1-12 0l1-7Zm5 13v5m-4 0h8M6 9h12" /></>,
    people: <><circle cx="9" cy="7" r="3"/><path d="M3 21v-4a6 6 0 0 1 12 0v4m3-18a3 3 0 0 1 0 6m0 4a5 5 0 0 1 3 5v3" /></>,
    utensils: <><path d="M4 3v6c0 3 6 3 6 0V3M7 3v18M20 3c-5 2-5 10 0 10V3Zm0 10v8" /></>,
    heart: <path d="M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 22l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />,
    case: <><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V4h8v3M3 12a24 24 0 0 0 18 0m-9 0v3" /></>,
    cake: <><path d="M3 21h18M4 21V11h16v10M4 15c2-3 3 3 5 0s3 3 5 0 4 3 6 0M8 11V7m4 4V7m4 4V7M8 4V3m4 1V3m4 1V3" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v5m10-5v5M3 11h18m-13 4h2m4 0h2m-8 3h2" /></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2" /></>,
    pin: <><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/></>,
    phone: <path d="M21 16v3a2 2 0 0 1-2 2A18 18 0 0 1 3 5a2 2 0 0 1 2-2h3l2 5-3 2a14 14 0 0 0 7 7l2-3 5 2Z" />,
    star: <path d="m12 2 3 6.5 7 1-5 5 1.2 7-6.2-3.3-6.2 3.3 1.2-7-5-5 7-1L12 2Z" />,
    plus: <path d="M12 5v14M5 12h14" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    instagram: <><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/></>,
    facebook: <path d="M14 21v-9h3l1-4h-4V6c0-1 1-2 2-2h2V1h-3a5 5 0 0 0-5 5v2H7v4h3v9" />,
    play: <path d="m9 5 10 7-10 7V5Z" />,
    check: <path d="m5 12 4 4L19 6" />,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{paths[name]}</svg>;
}
export function Branch({ className = "" }: { className?: string }) {
  return <svg className={className} width="44" height="44" viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="M32 55V10" stroke="currentColor" strokeWidth="2"/><path d="M32 23C18 22 19 11 19 11c12 1 13 12 13 12ZM32 35C12 33 14 21 14 21c16 2 18 14 18 14ZM32 47C9 44 11 32 11 32c18 2 21 15 21 15ZM32 23c14-1 13-12 13-12-12 1-13 12-13 12ZM32 35c20-2 18-14 18-14-16 2-18 14-18 14ZM32 47c23-3 21-15 21-15-18 2-21 15-21 15Z" fill="currentColor"/></svg>;
}
export function Logo({ footer = false }: { footer?: boolean }) {
  return <a className={`logo hadramout-logo image-logo ${footer ? "logo-footer" : ""}`} href="/#home" aria-label="وكالة حضرموت اليمني — الرئيسية"><img className="restaurant-logo-image" src="/images/hadramout-logo.png" alt="شعار مطاعم حضرموت اليمني" width={345} height={580} loading={footer ? "lazy" : "eager"}/></a>;
}
