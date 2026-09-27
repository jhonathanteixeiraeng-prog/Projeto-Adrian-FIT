import { rmSync } from 'node:fs';
import path from 'node:path';

/** Where photo-storage puts files under Vitest (NODE_ENV=test), apart from development's .data/photos. */
export const TEST_PHOTO_DIR = path.join(process.cwd(), '.data', 'test-photos');

export const removeTestPhotos = () => rmSync(TEST_PHOTO_DIR, { recursive: true, force: true });
