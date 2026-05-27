import {existsSync, renameSync} from 'node:fs';
import {resolve} from 'node:path';

const outDir = resolve(process.cwd(), 'dist');
const indexPath = resolve(outDir, 'index.html');
const appPath = resolve(outDir, 'app.html');

if (!existsSync(indexPath)) {
  throw new Error(`Expected Vite output not found: ${indexPath}`);
}

renameSync(indexPath, appPath);
console.log(`Renamed ${indexPath} -> ${appPath}`);
