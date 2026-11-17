import { mkdir, writeFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const photos = [
  { file: 'public/images/recipes/chicken-pasta-white-sauce.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/4/4d/Chicken_Pasta_in_White_Sauce.jpg', label: 'Chicken Pasta in White Sauce (TourismSchool, CC BY-SA 4.0)' },
  { file: 'public/images/recipes/mashed-potato-eggs.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/f/f3/Mashed_potatoes%2C_eggs%2C_beans.jpg', label: 'Mashed potatoes, eggs, beans (MOs810, CC BY-SA 3.0)' },
];

const USER_AGENT =
  'Mozilla/5.0 (compatible; TadbeeraApp/1.0; +https://github.com/mustafaelmenshawy23-jpg/Tadbeera)';

const sleep = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));

async function fetchWithRetry(url, label, maxAttempts = 4) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'image/jpeg,image/*;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
    });

    if (response.ok) {
      return response;
    }

    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt === maxAttempts) {
      throw new Error(`Could not download ${label}: HTTP ${response.status}`);
    }

    const retryAfterHeader = response.headers.get('retry-after');
    const retryAfterSec = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : Number.NaN;
    const delayMs = Number.isFinite(retryAfterSec)
      ? Math.max(1000, retryAfterSec * 1000)
      : attempt * 1500;

    console.warn(`Retrying ${label} after HTTP ${response.status} in ${delayMs}ms (attempt ${attempt}/${maxAttempts})...`);
    await sleep(delayMs);
  }
}

for (const photo of photos) {
  const destination = resolve(photo.file);
  await mkdir(dirname(destination), { recursive: true });
  try {
    const existing = await stat(destination);
    if (existing.size >= 10_000) {
      console.log(`Using cached ${photo.label}: ${existing.size} bytes`);
      continue;
    }
  } catch {
    // Download the image when it is not already bundled in the workspace.
  }
  const response = await fetchWithRetry(photo.url, photo.label);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().startsWith('image/jpeg')) throw new Error(`Unexpected content type for ${photo.label}: ${contentType}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 10_000) throw new Error(`Downloaded image is unexpectedly small for ${photo.label}: ${bytes.length} bytes`);
  await writeFile(destination, bytes);
  console.log(`Bundled ${photo.label}: ${bytes.length} bytes -> ${photo.file}`);
  await sleep(300);
}
