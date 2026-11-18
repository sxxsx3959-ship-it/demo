const fs = require('node:fs');
const { randomBytes, scryptSync } = require('node:crypto');
const file = '.env.local';
let env = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
if (!/^OWNER_PASSWORD_HASH=/m.test(env)) {
 const password = `HY-${randomBytes(12).toString('base64url')}`;
 const salt = randomBytes(16).toString('hex');
 env += `\nOWNER_PASSWORD_HASH=${salt}:${scryptSync(password,salt,64).toString('hex')}\n`;
 fs.writeFileSync(file, env);
 fs.writeFileSync('OWNER-ACCESS.txt', `حضرموت اليمني — دخول الإدارة\nالرابط: http://localhost:3000/owner\nكلمة المرور: ${password}\n\nهذا الملف خاص بصاحب المشروع. لا تنشره ولا ترسله ضمن ملفات الموقع العامة.\n`);
 console.log('Owner account created. Credentials saved privately in OWNER-ACCESS.txt.');
} else { console.log('Existing owner credentials preserved.'); }
