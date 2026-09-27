import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = path.dirname(fileURLToPath(import.meta.url));

// Unit tests (tests/unit) and API tests (tests/api) that call the route handlers against a throwaway
// SQLite database (prisma/test.db, created fresh by tests/setup/database.ts). Run: npm test.
export default defineConfig({
    resolve: {
        alias: { '@': path.resolve(root, 'src') },
    },
    test: {
        environment: 'node',
        include: ['tests/**/*.test.ts'],
        globalSetup: ['tests/setup/database.ts'],
        env: {
            DATABASE_URL: 'file:./test.db',
            NEXTAUTH_SECRET: 'test-secret-not-for-production',
            NEXTAUTH_URL: 'http://localhost:3000',
        },
        // One SQLite file shared by the API tests: files run one at a time.
        fileParallelism: false,
        testTimeout: 20000,
    },
});
