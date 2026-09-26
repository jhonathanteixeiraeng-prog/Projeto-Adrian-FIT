import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');
const files = ['test.db', 'test.db-journal'].map((file) => path.join(root, 'prisma', file));

/** Creates prisma/test.db from prisma/schema.prisma before the run and deletes it afterwards. */
export default function setup() {
    files.forEach((file) => rmSync(file, { force: true }));
    execSync('npx prisma db push --skip-generate --schema prisma/schema.prisma', {
        cwd: root,
        env: { ...process.env, DATABASE_URL: 'file:./test.db' },
        stdio: 'ignore',
    });
    return () => files.forEach((file) => rmSync(file, { force: true }));
}
