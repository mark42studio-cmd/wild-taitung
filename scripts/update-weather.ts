import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import type { updateWeatherCache as UpdateWeatherCache } from '../lib/weather';

const envPath = path.resolve(process.cwd(), '.env.local');
const fallbackEnvPaths = [
  path.resolve(process.cwd(), '.env.local'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '..', '.env.local'),
  path.resolve(process.cwd(), '..', '.env'),
];

function cleanEnvValue(value: string): string {
  return value
    .replace(/[\r\n\s\u0000-\u001F\u007F\u200B-\u200D\uFEFF]/g, '')
    .replace(/^['"]|['"]$/g, '');
}

function decodeEnvFile(filePath: string): string {
  const buffer = fs.readFileSync(filePath);

  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return buffer.subarray(2).toString('utf16le');
  }

  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    const swapped = Buffer.alloc(buffer.length - 2);
    for (let index = 2; index + 1 < buffer.length; index += 2) {
      swapped[index - 2] = buffer[index + 1];
      swapped[index - 1] = buffer[index];
    }
    return swapped.toString('utf16le');
  }

  const sample = buffer.subarray(0, Math.min(buffer.length, 200));
  const nulCount = sample.filter((byte) => byte === 0).length;
  if (nulCount > sample.length * 0.2) {
    return buffer.toString('utf16le');
  }

  return buffer.toString('utf8').replace(/^\uFEFF/, '');
}

function decodeEnvFileVariants(filePath: string): string[] {
  const buffer = fs.readFileSync(filePath);
  const variants = [
    buffer.toString('utf8').replace(/^\uFEFF/, ''),
    buffer.toString('utf16le').replace(/^\uFEFF/, ''),
  ];

  if (buffer.length >= 2) {
    const swapped = Buffer.alloc(buffer.length);
    for (let index = 0; index + 1 < buffer.length; index += 2) {
      swapped[index] = buffer[index + 1];
      swapped[index + 1] = buffer[index];
    }
    variants.push(swapped.toString('utf16le').replace(/^\uFEFF/, ''));
  }

  variants.push(decodeEnvFile(filePath));
  return Array.from(new Set(variants));
}

function extractCwaKey(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null;

  const rawContent = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  const line = rawContent.split('\n').find((candidate) => candidate.includes('NEXT_PUBLIC_CWA_API_KEY'));
  if (!line) return null;

  const value = line.split('=')[1]?.trim().replace(/['"]/g, '').replace(/\r$/, '');
  if (!value) return null;

  console.log('✅ 讀取到的真實長度:', value.length);
  return value;
}

function forceLoadCwaKey(filePaths: string[]): void {
  const candidates = filePaths
    .map((filePath) => ({ filePath, value: extractCwaKey(filePath) }))
    .filter((candidate): candidate is { filePath: string; value: string } => Boolean(candidate.value));

  delete process.env.NEXT_PUBLIC_CWA_API_KEY;

  if (candidates.length === 0) {
    console.error('❌ 未從 raw env 檔案中找到 NEXT_PUBLIC_CWA_API_KEY 非空值');
    return;
  }

  const selected = candidates.find((candidate) => candidate.value.length >= 40) ?? candidates[0];

  if (selected.value.length < 40) {
    console.error(`❌ NEXT_PUBLIC_CWA_API_KEY 長度不足：${selected.value.length}，預期至少 40`);
    return;
  }

  process.env.NEXT_PUBLIC_CWA_API_KEY = selected.value;
  console.log('✅ 完整 Key 抓取成功，實際長度:', process.env.NEXT_PUBLIC_CWA_API_KEY.length);
  console.log('CWA Key source:', selected.filePath);
}

function assertRequiredEnv(): void {
  const apiKey = process.env.NEXT_PUBLIC_CWA_API_KEY;
  if (!apiKey) {
    throw new Error('缺少 NEXT_PUBLIC_CWA_API_KEY 授權碼');
  }
  if (apiKey.length < 40) {
    throw new Error(`NEXT_PUBLIC_CWA_API_KEY 長度不足：${apiKey.length}，預期至少 40，已中止 API 請求`);
  }
}

function loadRawEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;

  const rawContent = decodeEnvFile(filePath);
  for (const line of rawContent.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;

    const key = match[1];
    const value = cleanEnvValue(match[2]);
    if (value && !process.env[key]) process.env[key] = value;
  }
}

dotenv.config({ path: envPath });
console.log('Env loaded from:', envPath);

for (const filePath of fallbackEnvPaths) loadRawEnvFile(filePath);
forceLoadCwaKey(fallbackEnvPaths);
assertRequiredEnv();

const weatherModule = await import(new URL('../lib/weather.ts', import.meta.url).href);
const updateWeatherCache = weatherModule.updateWeatherCache as typeof UpdateWeatherCache;

try {
  const written = await updateWeatherCache();
  console.log(`[weather] weather_cache 更新完成，共回傳 ${written.length} 筆原始地點資料`);
} catch (err) {
  console.error('[weather] ❌ 更新失敗：', err instanceof Error ? err.message : String(err));
  process.exit(1);
}
