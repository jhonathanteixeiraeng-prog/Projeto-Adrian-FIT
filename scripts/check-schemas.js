#!/usr/bin/env node
/**
 * The local (SQLite) and production (Postgres) Prisma schemas must describe the same models: only the
 * generator and datasource blocks may differ. Both must also pass `prisma validate`. Part of npm run check.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');

const LOCAL = 'prisma/schema.prisma';
const PRODUCTION = 'prisma/schema.postgres.prisma';

const models = (file) =>
    fs
        .readFileSync(file, 'utf8')
        .replace(/^(generator|datasource)\s+\w+\s*\{[^}]*\}\s*/gm, '')
        .trim()
        .split('\n');

const local = models(LOCAL);
const production = models(PRODUCTION);
const firstDifference = local.findIndex((line, index) => line !== production[index]);
if (firstDifference !== -1 || local.length !== production.length) {
    const line = firstDifference === -1 ? Math.min(local.length, production.length) : firstDifference;
    console.error(`${LOCAL} and ${PRODUCTION} describe different models (first difference after the config blocks, line ${line + 1}):`);
    console.error(`  ${LOCAL}: ${local[line] ?? '(end of file)'}`);
    console.error(`  ${PRODUCTION}: ${production[line] ?? '(end of file)'}`);
    process.exit(1);
}

// prisma validate needs a URL of the right kind; nothing connects to it.
const urls = { [LOCAL]: 'file:./dev.db', [PRODUCTION]: 'postgresql://check:check@localhost:5432/check' };
for (const [schema, url] of Object.entries(urls)) {
    execFileSync('npx', ['prisma', 'validate', '--schema', schema], { stdio: 'inherit', env: { ...process.env, DATABASE_URL: url } });
}
console.log('Prisma schemas: same models, both valid.');
