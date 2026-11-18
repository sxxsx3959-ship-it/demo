const fs = require('node:fs/promises');
const photos = { majboos:'prod_1766409323.jpg', drinks:'prod_1766324281.jpg', platter:'prod_1766115562.jpg', quarter:'prod_1765934335.jpg', meat:'prod_1765934266.jpg', chicken:'prod_1765894699.jpg', whole:'prod_1765894619.jpg' };
(async () => {
 for (const [name,file] of Object.entries(photos)) {
   const res = await fetch(`https://talabat2.com/uploads/products/${file}`);
   if(!res.ok) throw Error(`${name}: ${res.status}`);
   await fs.writeFile(`public/images/hadramout/${name}.jpg`,Buffer.from(await res.arrayBuffer()));
 }
 const sharp = require('sharp');
 const tiles = await Promise.all(Object.keys(photos).map(async (name,i)=>({input:await sharp(`public/images/hadramout/${name}.jpg`).resize(260,220,{fit:'cover'}).toBuffer(),left:i%4*260,top:Math.floor(i/4)*220})));
 await sharp({create:{width:1040,height:440,channels:3,background:'#eee'}}).composite(tiles).png().toFile('.screenshots/hadramout-photos.png');
 console.log('Downloaded restaurant menu photos.');
})();
