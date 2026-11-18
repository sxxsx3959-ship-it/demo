const fs = require('node:fs');
const page = fs.readFileSync('app/page.tsx','utf8');
let icons = page.slice(page.indexOf('type IconName'),page.indexOf('const categories'));
icons = icons.replace('function Icon(', 'export function Icon(').replace('function Branch(', 'export function Branch(').replace('function Logo(', 'export function Logo(');
icons = icons.replace('"check";', '"check" | "bag" | "minus" | "trash" | "truck" | "store";');
icons = icons.replace('    arrow:', '    bag: <><path d="M5 7h14l2 14H3L5 7Z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/></>,\n    minus: <path d="M5 12h14"/>,\n    trash: <><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/></>,\n    truck: <><path d="M3 4h11v12H3V4Zm11 5h4l3 4v3h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></>,\n    store: <><path d="M3 10V7l2-4h14l2 4v3M4 10v11h16V10M9 21v-8h6v8M3 7h18"/><path d="M3 10c2 3 4 3 6 0 2 3 4 3 6 0 2 3 4 3 6 0"/></>,\n    arrow:');
const logoStart=icons.indexOf('export function Logo(');
icons = icons.slice(0,logoStart)+`export function Logo({ footer = false }: { footer?: boolean }) {
 return <a className={\`logo hadramout-logo \${footer ? "logo-footer" : ""}\`} href="#home" aria-label="حضرموت اليمني — الرئيسية"><svg className="hadramout-mark" width="48" height="32" viewBox="0 0 80 50" fill="none" aria-hidden="true"><path d="M14 45V17l12-7 12 7v28M40 45V8l12-6 12 6v37M6 45h68M20 22h12m-12 7h12m-12 7h12M46 14h12m-12 7h12m-12 7h12m-12 7h12" stroke="currentColor" strokeWidth="2"/><path d="M23 45v-6h6v6m20 0v-5h6v5" stroke="currentColor" strokeWidth="2"/></svg><span className="logo-name">حضرموت <span>اليمني</span></span><span className="logo-sub">H A D R A M O U T</span><span className="logo-caption">مندي ومشويات · الناصرية</span></a>;
}
`;
fs.writeFileSync('components/Brand.tsx', 'import type { ReactNode } from "react";\n'+icons.replaceAll('React.ReactNode','ReactNode'));
