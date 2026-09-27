# Arquivo de migrações (até 26/09/2026)

Histórico antigo, só para consulta. Não reconstrói o banco: não tem a criação inicial (o banco foi criado com
`prisma db push`), a primeira migração é de SQLite e as seguintes foram escritas à mão para o PostgreSQL de
produção e aplicadas com `prisma db execute`.

Desde 27/09/2026 o histórico que vale é `prisma/migrations`: começa com a linha de base
(`20260927000000_baseline`, o esquema inteiro de produção naquela data) e é conferido pelo GitHub Actions
num PostgreSQL vazio. Veja `DEPLOY-VERCEL-NEON-GITHUB.md`.
