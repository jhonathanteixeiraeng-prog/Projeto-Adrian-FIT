# Auditoria de UX/UI — Área do Aluno

> Análise do fluxo do aluno, comparativo com grandes apps fitness e oportunidades de melhoria.

---

## 1. Resumo Executivo

A área do aluno tem uma base visual moderna, identidade de marca consistente (laranja #F88022) e cobre os principais pontos de contato: home, treino, dieta, evolução, check-in, chat e perfil. No entanto, **vários recursos ainda estão incompletos ou simulados** (mock data, TODOs, API calls não persistidas) e a experiência pode evoluir bastante para chegar ao padrão de apps como Hevy, MyFitnessPal, Trainerize e Nike Training Club.

**Principais gaps críticos:**
1. Progresso de treino e dieta não são persistidos no backend.
2. Tela de treino ainda contém mock data embutido.
3. Check-in é apenas uma simulação (não salva dados reais).
4. Fotos de progresso não funcionam.
5. Estatísticas da home são placeholders fixos.

---

## 2. Navegação e Arquitetura da Informação

### O que funciona
- Bottom tab simples com 4 itens: Início, Evolução, Chat, Perfil.
- Header contextual na home com nome do personal e badge de notificações.
- Navegação por cards grandes e touch-friendly.

### O que pode melhorar
| # | Problema | Recomendação | Referência de mercado |
|---|----------|--------------|----------------------|
| 2.1 | **Tab bar não dá acesso direto a Treino e Dieta**, que são as ações mais frequentes. | Adicionar pelo menos 5 itens na bottom nav: Início, Treino, Dieta, Evolução, Perfil. Ou usar floating action button (FAB) para iniciar treino. | Hevy, Trainerize, Nike Training Club |
| 2.2 | **Check-in semanal é pouco visível.** Aparece como card secundário na home. | Criar lembrete contextual na home e/ou acesso na tab bar/bottom sheet. Quando próximo do dia do check-in, eleva-lo para banner. | MyFitnessPal, Lose It! |
| 2.3 | **Notificações e chat ficam em lugares diferentes** (notificações no header, chat na tab bar). | Padronizar: notificações no header, chat como tab principal ou FAB flutuante. | WhatsApp, Trainerize |
| 2.4 | **Falta botão de ação flutuante (FAB)** para iniciar atividade rápida. | Adicionar FAB laranja flutuante para "Iniciar Treino" ou "Registrar Refeição". | Strava, Nike Run Club |
| 2.5 | **Não há breadcrumbs ou indicadores de localização** em telas secundárias. | Manter botão voltar consistente (já existe) e adicionar título descritivo. | — |

---

## 3. Home / Dashboard do Aluno

### O que funciona
- Saudação personalizada com nome do aluno e data.
- Cards de treino e dieta com progresso visual.
- Preview dos 3 primeiros exercícios e lista de refeições.
- CTA primário claro: "Iniciar / Continuar" treino.

### O que pode melhorar
| # | Problema | Recomendação | Referência |
|---|----------|--------------|------------|
| 3.1 | **Stats são placeholders**: `streak: 0`, `weeklyWorkouts: 0`, `weeklyGoal: 5`, `nextCheckin: 'Domingo'`. | Implementar cálculo real a partir de check-ins e completions persistidos. | Apple Fitness, Hevy |
| 3.2 | **Progresso do treino na home é por exercício, não por série.** O aluno pode ter feito 2 de 4 séries e ainda aparecer 0%. | Mudar para progresso por séries completadas (mais granular). | Strong, Hevy |
| 3.3 | **Quando não há treino hoje, a mensagem é genérica** ("Aproveite seu descanso"). | Mostrar o próximo treino programado, horário sugerido e contagem regressiva. | Trainerize |
| 3.4 | **Falta resumo de adesão recente** (treinos feitos na semana, refeições marcadas). | Adicionar mini-seção "Sua semana" com checks visuais dos últimos 7 dias. | MyFitnessPal, Samsung Health |
| 3.5 | **Card de dieta mostra calorias totais, não consumidas.** | Trocar para "X/Y kcal consumidas" com barra de progresso e cor do macro restante. | MyFitnessPal, Lifesum |
| 3.6 | **Não há acesso rápido ao chat com o personal.** | Adicionar ícone de chat no header ou FAB. | Trainerize |
| 3.7 | **Skeletons são bem-vindos**, mas poderiam ter animação mais suave e menos blocos genéricos. | Usar shimmer com gradiente e alturas variadas. | — |

---

## 4. Fluxo de Treino

### O que funciona
- Lista de exercícios expansível.
- Registro de carga e repetições por série.
- Timer de descanso em tela cheia.
- Persistência local do progresso (localStorage) para o dia.
- Vídeo do exercício embutido.
- Tela de conclusão com celebração.

### O que pode melhorar (crítico e médio)
| # | Problema | Recomendação | Referência |
|---|----------|--------------|------------|
| 4.1 | **Mock data ainda está no código** (`mockWorkout` com Supino Reto, etc.). Isso pode vazar para produção. | Remover completamente e garantir fallback de estado vazio. | — |
| 4.2 | **Progresso do treino não é persistido no backend.** `WorkoutCompletion` existe no schema mas não é usado. | Ao finalizar, enviar `POST /api/workout-completions` com workoutDayId, data e séries logadas. | Hevy, Strong |
| 4.3 | **Histórico de cargas/repetições é apagado no dia seguinte** (fica apenas no localStorage daquele dia). | Salvar logs de séries no backend (`ExerciseLog` ou similar) para mostrar progressão de carga. | Hevy, Strong |
| 4.4 | **Timer de descanso em tela cheia bloqueia toda a interface.** | Oferecer opção de timer compacto fixo na parte inferior ou notificação push. Manter fullscreen como opcional. | Hevy |
| 4.5 | **Não há timer total do treino.** | Adicionar cronômetro de sessão visível no header. | Nike Training Club, Hevy |
| 4.6 | **Não há registro de percepção de esforço (RPE) ou anotações por série.** | Adicionar campo RPE (1-10) e notas por série para o personal acompanhar. | Trainerize, TrueCoach |
| 4.7 | **Botão "Concluir" do exercício não inicia descanso automaticamente**; só a série inicia. | Ao concluir exercício, perguntar/sugerir descanso ou ir para o próximo. | Hevy |
| 4.8 | **Não há log de aquecimento.** | Permitir adicionar séries de aquecimento antes das séries principais. | Strong |
| 4.9 | **Tela não trava rotação nem mantém tela ligada** durante o treino. | Usar Wake Lock API para manter tela acesa durante o treino. | Hevy, Strong |
| 4.10 | **Não há som/vibração no fim do descanso.** | Adicionar feedback sonoro e háptico quando o timer zerar. | Hevy |
| 4.11 | **Vídeo oculto dentro do card expansível** — requer toque duplo para acessar. | Mostrar thumbnail do vídeo já no header do exercício. | Nike Training Club |
| 4.12 | **Não há opção de pular/trocar exercício no dia.** | Adicionar "Pular hoje" ou "Substituir" para casos de lesão ou equipamento ocupado. | Hevy |

---

## 5. Plano Semanal de Treinos

### O que funciona
- Visualização dos dias da semana.
- Destaque do dia atual.
- Expansão individual e "Expandir todos".

### O que pode melhorar
| # | Problema | Recomendação | Referência |
|---|----------|--------------|------------|
| 5.1 | **Não mostra duração estimada do treino.** | Calcular estimativa baseada em séries × reps × descanso. | Nike Training Club |
| 5.2 | **Não há filtro por grupo muscular.** | Adicionar chips de filtro (Peito, Costas, Pernas, etc.). | Hevy |
| 5.3 | **Ao tocar em um dia, leva para o treino do dia.** Isso é bom, mas perde-se o contexto de qual dia foi selecionado. | Manter highlight ou adicionar confirção "Iniciar treino de [dia]". | — |
| 5.4 | **Não indica dias de descanso.** | Mostrar explicitamente os dias sem treino programado. | Trainerize |

---

## 6. Fluxo de Dieta / Nutrição

### O que funciona
- Visualização de refeições com horários.
- Marcação de refeição concluída (UI).
- Modal de substituição de alimentos.
- Resumo de macros (proteína, carboidrato, gordura).

### O que pode melhorar
| # | Problema | Recomendação | Referência |
|---|----------|--------------|------------|
| 6.1 | **Marcar refeição concluída não persiste no backend** (há TODO no código). | Implementar `POST /api/meal-completions` e sincronizar estado. | MyFitnessPal |
| 6.2 | **Calorias consumidas são calculadas apenas das refeições marcadas**, mas sem persistência, recarregar perde tudo. | Persistir completions e recalcular no dashboard. | MyFitnessPal, Lifesum |
| 6.3 | **Não há tracking de água.** | Adicionar contador de copos de água com meta diária. | MyFitnessPal, Samsung Health |
| 6.4 | **Não há busca/adicionar alimento manualmente** fora da substituição. | Permitir adicionar alimentos extras à refeição do dia. | MyFitnessPal |
| 6.5 | **Não há scanner de código de barras.** | Adicionar leitura de código de barras para alimentos embalados. | MyFitnessPal, FatSecret |
| 6.6 | **Substituição de alimento só sugere 2 opções.** | Expandir para lista filtrável por categoria e compatibilidade calórica. | Lifesum |
| 6.7 | **Não há registro de peso real do alimento** (ex: 150g de frango). | Permitir ajustar quantidade do alimento na refeição. | MyFitnessPal |
| 6.8 | **Macros mostram metas, mas não progresso diário real.** | Mostrar "consumido / restante" para cada macro. | MyFitnessPal |
| 6.9 | **Não há lembretes de refeição.** | Enviar notificações push nos horários das refeições. | MyFitnessPal |

---

## 7. Evolução / Progresso

### O que funciona
- Tabs: Peso, Adesão, Fotos.
- Cards com peso atual, variação e número de check-ins.
- Lista de check-ins recentes.

### O que pode melhorar
| # | Problema | Recomendação | Referência |
|---|----------|--------------|------------|
| 7.1 | **Gráfico de peso é de barras**, difícil de ver tendência. | Trocar para gráfico de linha com pontos interativos. | Withings, MyFitnessPal |
| 7.2 | **Limitado a 8 check-ins no gráfico.** | Permitir filtros: 1 mês, 3 meses, 6 meses, 1 ano, todos. | Withings, Apple Health |
| 7.3 | **Fotos de progresso não estão implementadas** (apenas placeholder). | Implementar upload de fotos (frente, lado, costas) com data e comparação lado a lado. | Trainerize, Progress |
| 7.4 | **Não há medidas corporais** (cintura, quadril, braço, etc.). | Adicionar campos de medidas no check-in e acompanhá-las em gráficos. | Trainerize |
| 7.5 | **Adesão é informada manualmente pelo aluno**, não calculada automaticamente. | Calcular adesão a partir de treinos completados e refeições marcadas. | Trainerize |
| 7.6 | **Não há indicador de tendência de peso** (ex: "Você perdeu 0,5kg na última semana"). | Adicionar insights automáticos baseados em comparação de períodos. | Noom, Lose It! |
| 7.7 | **Falta meta de peso configurável pelo aluno.** | Permitir definir meta na tela de metas e mostrar progresso visual. | MyFitnessPal |
| 7.8 | **Não há compartilhamento de conquistas.** | Adicionar cards de milestone ("1kg a menos", "10 treinos concluídos"). | Strava, Nike Run Club |

---

## 8. Check-in Semanal

### O que funciona
- Formulário bem estruturado com ratings e sliders.
- Interface amigável com ícones.

### O que pode melhorar (crítico)
| # | Problema | Recomendação | Referência |
|---|----------|--------------|------------|
| 8.1 | **Submit do check-in é simulado** (`setTimeout` de 1,5s, não chama API). | Implementar `POST /api/checkins` real. | Trainerize |
| 8.2 | **Fotos de progresso no check-in são placeholders** (não fazem upload). | Integrar upload de arquivos para o storage (Vercel Blob, S3, etc.). | Trainerize |
| 8.3 | **Faltam campos importantes**: medidas corporais, % de gordura, observações do personal. | Expandir formulário com medidas e composição corporal. | InBody, Trainerize |
| 8.4 | **Não há confirmação/validação de dados** (peso negativo, sono > 24h). | Adicionar validação e feedback visual. | — |
| 8.5 | **Ratings de energia/fome/estresse não explicam o que significa cada número.** | Adicionar labels descritivos (ex: 1 = "Muito cansado", 5 = "Energia máxima"). | — |
| 8.6 | **Após enviar, redireciona para home em 2s sem mostrar resumo.** | Mostrar tela de confirmação com resumo do check-in enviado. | — |

---

## 9. Perfil e Configurações

### O que funciona
- Dados pessoais editáveis.
- Toggle de notificações e dark mode.
- Acesso a metas, privacidade e ajuda.

### O que pode melhorar
| # | Problema | Recomendação | Referência |
|---|----------|--------------|------------|
| 9.1 | **Metas são apenas texto livre** sem estrutura. | Transformar em objetivos SMART: meta de peso, % gordura, frequência semanal, data alvo. | Noom, MyFitnessPal |
| 9.2 | **Toggle de notificações só salva no localStorage**, não no backend. | Persistir preferências no banco (`User.preferences` ou tabela separada). | — |
| 9.3 | **Não há estatísticas pessoais acumuladas** (total de treinos, tempo total, calorias, etc.). | Criar card "Suas conquistas" com estatísticas reais. | Strava, Hevy |
| 9.4 | **Não há integração com apps de saúde** (Apple Health, Google Fit). | Adicionar integração para sincronizar peso e atividades. | MyFitnessPal, Strong |
| 9.5 | **Foto de perfil não é editável.** | Permitir upload de avatar. | — |
| 9.6 | **Falta configuração de unidades** (kg/lb, cm/ft). | Adicionar preferência de unidades. | Strong, Hevy |

---

## 10. Chat e Comunicação

### O que funciona
- Interface de chat estilo WhatsApp.
- Poll a cada 5 segundos.
- Status de mensagem lida.

### O que pode melhorar
| # | Problema | Recomendação | Referência |
|---|----------|--------------|------------|
| 10.1 | **Botões de anexo e imagem não funcionam.** | Implementar upload de mídia ou remover botões até implementar. | WhatsApp, Telegram |
| 10.2 | **Não há status de "digitando" ou online.** | Adicionar indicador quando o personal está digitando. | WhatsApp |
| 10.3 | **Polling a cada 5s pode ser intensivo.** | Considerar WebSockets ou Server-Sent Events (SSE) para escalabilidade. | — |
| 10.4 | **Não há mensagens rápidas** (templates). | Adicionar respostas rápidas para dúvidas comuns. | Trainerize |
| 10.5 | **Falta opção de agendar consulta/call pelo chat.** | Integrar link para agendamento. | Calendly, Trainerize |

---

## 11. Notificações

### O que funciona
- Lista de notificações categorizadas por tipo.
- Badge de não lidas.
- "Marcar todas como lidas".

### O que pode melhorar
| # | Problema | Recomendação | Referência |
|---|----------|--------------|------------|
| 11.1 | **Notificações não têm ações contextuais.** | Adicionar botões nas notificações: "Registrar refeição", "Iniciar treino", "Fazer check-in". | iOS Push Actions |
| 11.2 | **Não há histórico de notificações antigas.** | Paginar ou agrupar por data. | — |
| 11.3 | **Notificações push não estão configuradas** (apenas in-app). | Implementar web push notifications. | — |
| 11.4 | **Falta personalização de frequência** (ex: lembrete de treino às 18h). | Permitir configurar horários de lembretes no perfil. | MyFitnessPal |

---

## 12. Consistência Visual e Acessibilidade

### O que funciona
- Paleta de cores consistente.
- Dark mode implementado.
- Cards com bordas arredondadas e sombras suaves.
- Tipografia clara.

### O que pode melhorar
| # | Problema | Recomendação | Referência |
|---|----------|--------------|------------|
| 12.1 | **Muitos `any` no código** dificultam manutenção e podem causar bugs. | Tipar estados e props (ex: `dashboardData`, `workout`, `diet`). | — |
| 12.2 | **Alguns textos têm contraste baixo** (text-muted-foreground em fundos claros). | Verificar contraste WCAG AA (mínimo 4.5:1). | WCAG |
| 12.3 | **Inputs numéricos de carga/reps aceitam valores negativos.** | Adicionar `min="0"` e validação. | — |
| 12.4 | **Tamanhos de toque variam.** Garantir área mínima de 44×44px para botões principais. | Revisar botões pequenos como os de substituição. | Apple HIG |
| 12.5 | **Animações podem causar motion sickness** em alguns usuários. | Respeitar `prefers-reduced-motion`. | WCAG |
| 12.6 | **Falta estados de erro amigáveis** em várias telas (apenas console.error). | Adicionar toasts e mensagens de erro na UI. | — |
| 12.7 | **Botão de voltar é inconsistente** (às vezes leva para `/student/home`, às vezes para `/student/profile`). | Padronizar navegação hierárquica. | — |

---

## 13. Oportunidades de Diferenciação (ir além dos concorrentes)

1. **Modo "Foco no Treino"**: tela minimalista com apenas exercício atual, timer e próxima série.
2. **Comparação de fotos com slider**: antes/depois interativo.
3. **Insights com IA**: "Baseado nos seus últimos 5 treinos, você pode aumentar a carga de X em 2kg".
4. **Gamificação**: conquistas, streaks reais e rankings privados.
5. **Integração com wearables**: Apple Watch, Garmin, Polar.
6. **Check-in por voz**: aluno fala peso e medidas.
7. **Resumo semanal automático**: enviado por notificação/email com progresso.

---

## 14. Priorização Recomendada

### 🔴 Crítico (fazer primeiro)
1. Remover mock data da tela de treino.
2. Persistir progresso do treino no backend (`WorkoutCompletion` + logs de séries).
3. Persistir refeições concluídas no backend (`MealCompletion`).
4. Tornar o check-in funcional (chamar API real e salvar fotos).
5. Implementar estatísticas reais na home (streak, treinos semanais).

### 🟡 Médio (impacto alto, esforço moderado)
6. Gráfico de linha para evolução de peso.
7. Upload de fotos de progresso com comparação.
8. Timer de treino e histórico de cargas.
9. Melhorar navegação com FAB e/ou tab bar de 5 itens.
10. Adicionar RPE e notas por série.

### 🟢 Baixo (polimento)
11. Integração com Apple Health / Google Fit.
12. Scanner de código de barras.
13. Push notifications.
14. Gamificação e conquistas.
15. Tema de acessibilidade e redução de motion.

---

## 15. Conclusão

A experiência do aluno já tem uma boa estrutura visual, mas **ainda está em estágio de protótipo funcional em várias áreas críticas**. O maior risco atual é a falta de persistência real de dados: o aluno pode marcar treino e refeições como concluídos, mas essas informações não chegam ao personal nem acumulam histórico.

A recomendação é focar nos itens críticos primeiro para tornar o app utilizável no dia a dia, e depois evoluir para recursos de diferenciação que aproximem o produto dos grandes apps do mercado.
