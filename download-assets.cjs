const fs = require('node:fs/promises');
const images = {
 hero: ['1551183053-bf91a1d81141', 2000], pasta: ['1551183053-bf91a1d81141', 700],
 salmon: ['1467003909585-2f8a72700288', 900], pizza: ['1579751626657-72bc17010498', 700],
 steak: ['1598930230137-27b0b22154fc', 800], burger: ['1568901346375-23c9450c58cd', 700],
 salad: ['1512621776951-a57141f2eefd', 700], dessert: ['1578985545062-69928b1d9587', 700],
 restaurant: ['1517248135467-4c7edcad34c4', 1600], chef: ['1577219491135-ce391730fb2c', 1000]
};
async function save(url, file) {
 const r = await fetch(url); if (!r.ok) throw new Error(`${file}: ${r.status}`);
 await fs.writeFile(file, Buffer.from(await r.arrayBuffer())); console.log(`Saved ${file}`);
}
(async () => {
 const results = await Promise.allSettled(Object.entries(images).map(([name,[id,w]]) => save(`https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=85`, `public/images/${name}.jpg`)));
 results.forEach(r=>{if(r.status === 'rejected') console.error(r.reason.message)});
 for(const [family, weight, name] of [['Tajawal','400','tajawal-regular'],['Tajawal','700','tajawal-bold'],['El Messiri','400','el-messiri'],['El Messiri','600','el-messiri-semibold']]) {
  const css = await fetch(`https://fonts.googleapis.com/css2?family=${family.replaceAll(' ','+')}:wght@${weight}&display=swap`, {headers:{'User-Agent':'Mozilla/5.0'}}).then(r=>r.text());
  const url = css.match(/url\(([^)]+)\)/)?.[1]; if(!url) throw new Error(css);
  await save(url, `public/fonts/${name}.ttf`);
 }
 if(results.some(r=>r.status==='rejected')) process.exitCode=1;
})();
