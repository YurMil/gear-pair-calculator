import {cpSync, mkdirSync, rmSync, existsSync} from 'node:fs';
import {resolve} from 'node:path';

const srcDir = resolve(process.cwd(), 'dist');
const destDir = resolve(process.cwd(), '../cadautoscript.com/static/utility-apps/gear-pair-calculator');

if (!existsSync(srcDir)) {
  throw new Error(`Source directory does not exist: ${srcDir}`);
}

console.log(`Clearing destination: ${destDir}`);
rmSync(destDir, {recursive: true, force: true});
mkdirSync(destDir, {recursive: true});

console.log(`Copying built files from ${srcDir} to ${destDir}`);
cpSync(srcDir, destDir, {recursive: true});
console.log('Build files copied successfully!');
