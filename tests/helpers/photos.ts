import { rmSync } from 'node:fs';
import path from 'node:path';

/** Where the tests' photo files go (LOCAL_PHOTO_DIR in vitest.config.mts), apart from development's .data/photos. */
export const TEST_PHOTO_DIR = path.join(process.cwd(), process.env.LOCAL_PHOTO_DIR ?? '.data/test-photos');

export const removeTestPhotos = () => rmSync(TEST_PHOTO_DIR, { recursive: true, force: true });
