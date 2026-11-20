// LeafAtlas build: generate the public question bank from the approved source.
// Uses Node.js already required for the Netlify functions; no Python dependency.
import { readFile, writeFile } from 'node:fs/promises';
const file = new URL('./server/questions_public.json', import.meta.url);
const output = new URL('./public/assets/questions.js', import.meta.url);
const questions = JSON.parse(await readFile(file, 'utf8'));
const json = JSON.stringify(questions).replace(/</g, '\\u003c');
await writeFile(output, `window.LEAFATLAS_QUESTIONS=${json};\n`, 'utf8');
console.log('Built public question bank (without staff-only answer key).');
