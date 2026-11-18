const fs=require('node:fs');const crypto=require('node:crypto');
const password=fs.readFileSync('OWNER-ACCESS.txt','utf8').match(/كلمة المرور: (.+)/)?.[1].trim();
if(!password)throw Error('Existing local owner password is missing.');
const salt=crypto.randomBytes(16).toString('hex'),iterations=150000;
const digest=crypto.pbkdf2Sync(password,salt,iterations,32,'sha256').toString('hex');
fs.writeFileSync('lib/local-owner-access.json',JSON.stringify({salt,iterations,digest},null,2)+'\n');
console.log('Local settings password preserved; no plaintext password included in the site.');
