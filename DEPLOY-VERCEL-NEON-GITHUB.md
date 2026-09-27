# Deploy com GitHub + Neon + Vercel

Este projeto está pronto para deploy na Vercel. Siga exatamente os passos abaixo.

## 1) Subir para GitHub

No terminal, dentro do projeto:

```bash
git init
git add .
git commit -m "chore: prepare deploy vercel neon"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/SEU_REPO.git
git push -u origin main
```

## 2) Criar banco no Neon

1. Acesse o Console do Neon
2. Crie um projeto/database PostgreSQL
3. Copie a `Connection string`

## 3) Configurar variáveis na Vercel

1. Acesse Vercel > New Project > Import do GitHub
2. Selecione o repositório
3. Em **Environment Variables**, adicione:
   - `DATABASE_URL` = string do Neon
   - `NEXTAUTH_SECRET` = segredo forte (`openssl rand -base64 32`)
   - `NEXTAUTH_URL` = URL final da Vercel (ex: `https://seuapp.vercel.app`)

## 4) Build command na Vercel

Em **Build & Output Settings**:
- Build Command: `npm run vercel-build`
- Install Command: `npm ci`

## 5) Criar estrutura do banco (Neon) — só num banco novo

Após o primeiro deploy, rode local apontando para o Neon:

```bash
export DATABASE_URL="SUA_URL_NEON"
npx prisma generate --schema prisma/schema.postgres.prisma
npm run db:migrate:deploy
npm run db:seed
npm run trainer:create -- --email email@do-personal.com --name "Nome do Personal"
npx prisma generate
```

- `db:migrate:deploy` cria as tabelas aplicando `prisma/migrations` em ordem.
- `db:seed` cria só a biblioteca global de exercícios (pode rodar de novo, atualiza pelo nome).
- `trainer:create` cria a conta do personal. A senha inicial aparece uma única vez na tela (ou use
  `TRAINER_PASSWORD="..."` antes do comando); troque em Configurações depois de entrar. Nenhuma senha fica no código.
- O último `prisma generate` volta o cliente para o SQLite do desenvolvimento local.

Depois clique em **Redeploy** na Vercel.

## Mudanças no banco (produção)

- Toda mudança em `prisma/schema.postgres.prisma` (igual em `prisma/schema.prisma`) vem com uma pasta nova em
  `prisma/migrations` com o SQL. Para gerar o SQL a partir da versão anterior do schema:
  `npx prisma migrate diff --from-schema-datamodel <schema anterior> --to-schema-datamodel prisma/schema.postgres.prisma --script`.
- O GitHub Actions aplica todas as migrações num PostgreSQL vazio e falha se o resultado for diferente do schema.
- Em produção, a migração entra **antes** do código que a usa: `npm run db:migrate:status` mostra o que falta e
  `npm run db:migrate:deploy` aplica (com `DATABASE_URL` de produção). Nunca use `prisma db push` em produção.

## 6) Checklist final

- Login funciona
- Aluno e personal aparecem corretamente
- Chat envia/recebe
- Dieta e treino carregam
- Notificações abrem e contam pendências

## Observação importante

- O desenvolvimento local continua em SQLite (`prisma/schema.prisma`).
- O deploy na Vercel usa schema PostgreSQL dedicado (`prisma/schema.postgres.prisma`).
- Não altere o build command da Vercel: ele deve continuar em `npm run vercel-build`.
