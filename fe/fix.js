const fs = require('fs');
const file = 'c:\\auth-be\\fe\\src\\app\\[lang]\\admin\\stories\\[id]\\chapters\\_components\\ChapterForm.tsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace('const ReactQuill = dynamic(', 'const ReactQuill: any = dynamic(');
fs.writeFileSync(file, content);
console.log('Fixed ChapterForm.tsx');
