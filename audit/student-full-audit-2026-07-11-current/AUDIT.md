# Auditoria da experiência do aluno — Adrian Fit iOS

Data: 11 de julho de 2026

## Escopo

Auditoria combinada de UX, interface e riscos visíveis de acessibilidade nas áreas Hoje, Treinos, execução do treino, Dieta, Progresso, Check-in e Perfil. A análise usa a versão instalada no iPhone 17 Simulator e a conta atual do aluno.

## Veredito

A navegação principal e a identidade visual já formam uma boa base nativa. O fluxo de treino é a parte mais madura. Dieta e progresso ainda reduzem muito a confiança do produto: a dieta exibe valores nutricionais incorretos em escala crítica e o progresso não entrega uma leitura real de evolução antes do primeiro check-in.

## Passos auditados

1. **Hoje — saúde: razoável.** Bom foco no treino do dia e boa hierarquia. Falta uma leitura mais completa do dia, consistência, hábitos e acesso permanente ao personal. O conteúdo inferior fica próximo/atrás da barra de abas.
2. **Treinos — saúde: boa com ajustes.** A semana é fácil de entender, porém a lista é longa, os títulos são excessivos e não há estado claro de concluído/em andamento/próximo.
3. **Execução do treino — saúde: razoável.** Registro por série e progresso global são bons. Faltam metas válidas em vários exercícios, valores anteriores, cronômetro de descanso evidente, notas, RPE e ação de finalizar persistente. A barra de abas ocupa espaço durante a execução.
4. **Dieta — saúde: crítica.** Metas, porções e calorias aparecem multiplicadas (`2.674g`, `9.808g`, `6.700g`, `67.033 kcal`). Isso impede o uso e pode orientar o aluno de forma perigosa. O plano é apresentado como rastreamento, mas não fica claro o que o aluno deve marcar ou registrar.
5. **Progresso — saúde: fraca.** O vazio é claro, porém não mostra objetivo, linha de base, próximos benefícios ou qualquer dado já disponível dos treinos. A tela deveria agregar peso, medidas, frequência, volume, PRs, aderência, fotos e comparações.
6. **Check-in — saúde: boa com ajustes.** As escalas têm rótulos semânticos e os controles são grandes. O formulário é longo; faltam dor/fadiga, campo livre, fotos, contexto do último check-in, rascunho e explicação visível quando “Enviar” está desativado.
7. **Perfil — saúde: boa.** É limpo e previsível. Há espaço excessivo e faltam central de ajuda, privacidade, termos, preferências de unidade e uma área clara de conexão com o personal.

## Prioridades

### P0 — confiança e segurança

- Corrigir a conversão numérica da dieta e validar limites no app e no servidor antes de exibir/salvar planos.
- Bloquear ou destacar planos inválidos para o aluno e notificar o personal com uma ação de correção.
- Garantir metas completas de séries/repetições; não mostrar “reps a definir” como prescrição final.

### P1 — experiência central

- Transformar Hoje em um painel de ação: próximo treino, próxima refeição, hábitos, sequência semanal e mensagem do personal.
- Criar um modo de treino focado, sem a barra de abas, com cronômetro automático, carga/repetições anteriores, RPE, notas e botão persistente de finalizar.
- Tornar Dieta uma rotina diária clara: planejado, consumido, substituições, porções brasileiras, registro simples e progresso confiável.
- Construir Progresso como história de evolução: gráficos, comparações, fotos, PRs, aderência e resumo semanal.

### P2 — polimento e retenção

- Encurtar e padronizar os títulos dos treinos e corrigir capitalização/acentuação.
- Adicionar estados “hoje”, “concluído”, “em andamento” e “descanso” na agenda semanal.
- Adicionar hábitos simples, sequências, marcos e celebrações discretas.
- Manter acesso claro ao chat com o personal em todas as áreas relevantes.

## Riscos visíveis de acessibilidade

- Os botões de conclusão das refeições são anunciados apenas como “circle”, sem dizer refeição ou estado.
- Alguns textos cinza e placeholders aparentam contraste baixo no tema escuro.
- Títulos longos truncam no treino; é necessário testar Texto Maior e reflow.
- A barra inferior sobrepõe/encobre conteúdo em Dieta e Treino.
- Pontos positivos: alvos de toque parecem grandes, check-in usa rótulos de extremos e campos de carga/repetição possuem descrições acessíveis.

## Limites

Esta auditoria não confirma conformidade WCAG, suporte completo a VoiceOver, Texto Maior, redução de movimento, contraste medido, funcionamento offline, notificações ou fluxos com histórico real de check-ins. Também não foi enviado check-in nem concluído treino para evitar alterar os dados do aluno durante a auditoria.

