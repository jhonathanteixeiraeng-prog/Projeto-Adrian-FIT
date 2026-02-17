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

## 5) Criar estrutura do banco (Neon)

Após o primeiro deploy, rode local apontando para o Neon:

```bash
DATABASE_URL="SUA_URL_NEON" npm run db:push:neon
DATABASE_URL="SUA_URL_NEON" npm run db:seed
```

Depois clique em **Redeploy** na Vercel.

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
