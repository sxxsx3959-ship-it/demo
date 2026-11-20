const fs=require('node:fs');
let p=fs.readFileSync('app/page.tsx','utf8').replace('const merged = [...prev];','const merged = prev.map(item => ({ ...item }));').replace('dishes={dishes} accepting={accepting}', 'dishes={dishes} accepting={accepting && menuReady}');fs.writeFileSync('app/page.tsx',p);
let c=fs.readFileSync('components/Cart.tsx','utf8');
c=c.replace('const [quote, setQuote]', 'const [reviewInput, setReviewInput] = useState<Record<string, unknown> | null>(null);\n  const [quote, setQuote]');
c=c.replace('    try {\n      const response = await fetch("/api/checkout",', '    const snapshot = { items: items.map(item => ({ ...item })), fulfillment, areaId, name, phone, address, notes };\n    try {\n      const response = await fetch("/api/checkout",');
c=c.replace('body: JSON.stringify({ items, fulfillment, areaId, name, phone, address, notes })','body: JSON.stringify(snapshot)');
c=c.replace('setQuote(result);', 'setReviewInput(snapshot); setQuote(result);').replace('order={{ items, fulfillment, areaId, name, phone, address, notes }}', 'order={reviewInput!}');
c=c.replace('disabled={quantity >= MAX_QUANTITY || loading}', 'disabled={!dish.available || quantity >= MAX_QUANTITY || loading}');
c=c.replace('<h4>{dish.title}</h4>', '<h4>{dish.title}</h4>{!dish.available && <span className="unavailable-line">غير متوفر حاليًا، احذفه لإكمال الطلب.</span>}');fs.writeFileSync('components/Cart.tsx',c);
