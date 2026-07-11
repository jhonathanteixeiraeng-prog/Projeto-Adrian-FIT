# Auditoria de UX/UI — Área do Aluno (v2)

> Revisão após ajustes do Claude Code. Foco no app iOS, com considerações sobre a web.
> Data: 11 de julho de 2026

---

## 1. O que mudou para melhor

Os últimos commits trouxeram avanços significativos que reduzem muitos dos gaps críticos identificados na auditoria anterior:

- **Navegação**: tab bar agora tem 5 itens (Hoje, Treino, Dieta, Progresso, Perfil) — resolveu o problema de acesso rápido.
- **Treino**: sessão interativa real com séries, carga/reps, histórico da última sessão, PRs, timer de descanso com notificação local e resumo pós-treino.
- **Dieta**: anel de progresso calórico diário, marcação de refeições concluídas com persistência no backend.
- **Progresso**: gráfico de linha para peso, gráfico de barras para adesão, histórico de check-ins.
- **Check-in**: formulário funcional, enviando para `/api/checkins`.
- **Home**: card do treino de hoje com estimativa de tempo, preview de refeições e atalho para chat com o personal.

A experiência deixou de ser um "visualizador de prescrição" e passou a ser um **aplicativo de acompanhamento real**. Ainda assim, há espaço considerável para chegar ao padrão de apps como Hevy, MyFitnessPal, Trainerize e Nike Training Club.

---

## 2. Análise por tela

### 2.1 Início / Home

**Pontos fortes**
- Saudação personalizada com nome do aluno.
- Card do treino de hoje bem hierarquizado: título, número de exercícios, tempo estimado, CTA claro.
- Tab bar de 5 itens dá acesso direto às principais áreas.
- Preview das próximas refeições com horários.
- Atalho direto para conversar com o personal.

**Pontos de atenção**
| # | Problema observado | Recomendação | Referência |
|---|--------------------|--------------|------------|
| 2.1.1 | **Data em inglês** ("Saturday, 11 July") quebra a localização esperada para o Brasil. | Forçar `Locale(identifier: "pt_BR")` em todas as formatações de data. | — |
| 2.1.2 | **Stats "dias seguidos" e "treinos na semana" usam UserDefaults local** (`WorkoutHistoryStore`), não refletem dados do servidor. | Buscar estatísticas reais do backend ou sincronizar com completions persistidos. | Hevy, Apple Fitness |
| 2.1.3 | **Falta progresso das refeições do dia** na home (só lista as próximas, não mostra quantas já foram concluídas). | Adicionar mini anel ou contador "X/Y refeições". | MyFitnessPal |
| 2.1.4 | **Não há lembrete/check-in semanal visível** na home. | Mostrar banner/badge quando o check-in estiver pendente. | Trainerize |
| 2.1.5 | **"Próximas refeições" mostra apenas 3 itens**, sem scroll ou acesso ao restante. | Adicionar "Ver todas" ou tornar a lista scrollável. | — |

---

### 2.2 Treino / Sessão

**Pontos fortes**
- Visualização dos dias da semana no plano.
- Sessão interativa: marcar séries, registrar carga e reps.
- Mostra histórico da última sessão nos campos.
- Detecção de PRs com banner animado e feedback háptico.
- Timer de descanso em modal (não fullscreen), com opção de estender e pular.
- Notificação local quando o descanso termina.
- Resumo pós-treino com duração.

**Pontos de atenção**
| # | Problema observado | Recomendação | Referência |
|---|--------------------|--------------|------------|
| 2.2.1 | **Título do treino truncado** no header ("SABADO - glúteo, posterior e estimul..."). | Usar título curto no header ou duas linhas. | — |
| 2.2.2 | **Exibição "4 séries × • 180s de descanso"** mostra o bullet sem reps quando não há reps preenchidas. | Corrigir para "4 séries × 10 reps • 180s" ou similar. | Hevy |
| 2.2.3 | **Não há vídeo/thumbnail visível** no card do exercício — só um ícone de play pequeno. | Mostrar thumbnail do vídeo já no header do exercício. | Nike Training Club |
| 2.2.4 | **Falta RPE / percepção de esforço** por série. | Adicionar campo RPE 1-10 para feedback ao personal. | Trainerize, TrueCoach |
| 2.2.5 | **Não há séries de aquecimento**. | Permitir adicionar séries de aquecimento. | Strong |
| 2.2.6 | **Timer de descanso não mostra próximo exercício**. | Mostrar "Próximo: Agachamento Livre" no descanso. | Hevy |
| 2.2.7 | **Resumo pós-treino é simples** (só duração e séries). | Incluir volume total, PRs batidos, calorias estimadas, compartilhamento. | Strava, Hevy |
| 2.2.8 | **Não há botão de "substituir exercício"** no dia por lesão/equipamento. | Adicionar opção de substituir ou pular exercício. | Hevy |

---

### 2.3 Descanso

**Pontos fortes**
- Modal elegante com anel de progresso.
- Botões de pular e estender (+15s).
- Feedback sonoro e vibração no fim.

**Pontos de atenção**
| # | Problema observado | Recomendação | Referência |
|---|--------------------|--------------|------------|
| 2.3.1 | **Só permite estender, não reduzir** o descanso. | Adicionar botão -15s também. | Hevy |
| 2.3.2 | **Não informa qual série vem a seguir** nem próximo exercício. | Adicionar contexto no modal. | — |
| 2.3.3 | **Modal centralizado oculta o exercício atual** — o aluno perde contexto. | Considerar timer compacto na parte inferior mantendo lista visível. | Strong |

---

### 2.4 Dieta

**Pontos fortes**
- Anel de progresso calórico diário com macros (proteína, carbo, gordura).
- Refeições expansíveis com lista de alimentos.
- Marcação de refeição concluída com persistência real.
- Indicação visual de substituição de alimentos.

**Pontos de atenção (CRÍTICO)**
| # | Problema observado | Recomendação | Referência |
|---|--------------------|--------------|------------|
| 2.4.1 | **Porções zeradas e calorias 0 kcal** para vários alimentos (Tapioca, Frango, Banana). Isso é um problema de dados que quebra a confiança do usuário. | Revisar o gerador de dietas: garantir que `quantity` e `calories` estejam corretos. Nunca exibir "0 × 100g" nem "0 kcal". | MyFitnessPal |
| 2.4.2 | **Não é possível ajustar quantidade** do alimento na refeição. | Permitir editar gramas/porções. | MyFitnessPal |
| 2.4.3 | **Não há busca/adicionar alimento extra** fora do plano. | Adicionar botão "+ Adicionar alimento" à refeição. | MyFitnessPal |
| 2.4.4 | **Falta tracking de água.** | Adicionar contador de copos de água. | MyFitnessPal, Samsung Health |
| 2.4.5 | **Não há lembretes de refeição.** | Notificações push nos horários das refeições. | MyFitnessPal |
| 2.4.6 | **Anel mostra "Consumido hoje" mas não indica meta restante** de forma textual. | Adicionar "Faltam X kcal" com cor do macro. | Lifesum |

---

### 2.5 Progresso

**Pontos fortes**
- Gráfico de linha para evolução de peso.
- Gráfico de barras para adesão de treino/dieta.
- Cards com peso atual e adesões.
- Histórico de check-ins.

**Pontos de atenção**
| # | Problema observado | Recomendação | Referência |
|---|--------------------|--------------|------------|
| 2.5.1 | **Estado vazio muito genérico** — não mostra o que o aluno verá após o primeiro check-in. | Adicionar prévia do gráfico/resultado ou mini-tutorial. | — |
| 2.5.2 | **Não há fotos de progresso** nem comparação lado a lado. | Implementar upload de fotos frente/lado/costas com slider antes/depois. | Trainerize, Progress |
| 2.5.3 | **Faltam medidas corporais** (cintura, quadril, braço, etc.). | Adicionar ao check-in e exibir em gráficos. | Trainerize |
| 2.5.4 | **Adesão ainda é informada manualmente** pelo aluno, não calculada automaticamente. | Calcular adesão de treino a partir de sessões concluídas e dieta a partir de refeições marcadas. | Trainerize |
| 2.5.5 | **Falta meta de peso/objetivo configurável.** | Permitir definir meta na tela de metas e mostrar progresso visual. | MyFitnessPal |
| 2.5.6 | **Não há conquistas/milestones** ("1kg a menos", "10 treinos"). | Adicionar cards de conquistas. | Strava, Nike Run Club |
| 2.5.7 | **Gráfico de adesão limitado a 8 check-ins**, sem filtro de período. | Permitir 1m, 3m, 6m, 1a. | Withings |

---

### 2.6 Check-in

**Pontos fortes**
- Formulário organizado em seções.
- Envio real para o backend.
- Campos de peso, sono, energia, fome, estresse e adesão.

**Pontos de atenção**
| # | Problema observado | Recomendação | Referência |
|---|--------------------|--------------|------------|
| 2.6.1 | **Escalas numéricas (1-5) não têm significado** — o usuário não sabe se 5 é bom ou ruim. | Adicionar labels (ex: "Muito cansado" → "Energia máxima"). | — |
| 2.6.2 | **Faltam medidas corporais e % de gordura** no check-in. | Expandir formulário. | InBody, Trainerize |
| 2.6.3 | **Faltam fotos de progresso** no check-in. | Integrar upload de fotos. | Trainerize |
| 2.6.4 | **Não há validação de entrada** (peso negativo, sono > 24h). | Adicionar validação. | — |
| 2.6.5 | **Após enviar, não mostra resumo** — só fecha a sheet. | Mostrar confirmação com evolução desde o último check-in. | — |

---

### 2.7 Perfil

**Pontos fortes**
- Layout limpo e legível.
- Acesso a dados pessoais, notificações, alterar senha.
- Botão de sair destacado.

**Pontos de atenção**
| # | Problema observado | Recomendação | Referência |
|---|--------------------|--------------|------------|
| 2.7.1 | **Não há acesso direto ao chat com o personal** no perfil. | Adicionar card do personal com botão de chat. | Trainerize |
| 2.7.2 | **Faltam estatísticas pessoais** (total de treinos, tempo, volume, recordes). | Criar seção "Suas conquistas". | Strava, Hevy |
| 2.7.3 | **Não há metas configuráveis** (peso alvo, frequência semanal). | Adicionar tela de metas SMART. | Noom, MyFitnessPal |
| 2.7.4 | **Foto de perfil não é editável.** | Permitir upload de avatar. | — |
| 2.7.5 | **Falta integração com Apple Health / Google Fit.** | Sincronizar peso e atividades. | MyFitnessPal, Strong |
| 2.7.6 | **Não há preferências de unidades** (kg/lb) e lembretes. | Adicionar configurações de unidades e horários. | Strong |

---

## 3. Problemas críticos que ainda persistem

1. **Dados de dieta inconsistentes**: porções zeradas e calorias 0 kcal destroem a confiança.
2. **Stats da home locais**: dias seguidos e treinos na semana não refletem o servidor.
3. **Adesão manual**: o aluno ainda precisa informar % de adesão, em vez do app calcular.
4. **Fotos de progresso não implementadas**.
5. **Medidas corporais ausentes**.
6. **Data em inglês** na home.

---

## 4. Oportunidades de diferenciação

1. **Modo Foco no Treino**: tela minimalista com apenas exercício atual, timer e próxima série.
2. **Insights com IA**: "Você está 5% mais forte no supino que há 4 semanas".
3. **Comparação de fotos com slider** antes/depois.
4. **Gamificação real**: conquistas baseadas em dados do servidor.
5. **Integração com wearables** (Apple Watch, Garmin).
6. **Lembretes inteligentes** baseados no horário do último treino.

---

## 5. Priorização atualizada

### 🔴 Crítico (fazer primeiro)
1. Corrigir porções/calorias zeradas na dieta.
2. Localizar datas para português brasileiro.
3. Sincronizar stats da home com dados reais do servidor.
4. Corrigir exibição de reps no treino ("4 séries × •").

### 🟡 Médio (impacto alto)
5. Fotos de progresso no check-in e tela de progresso.
6. Calcular adesão automaticamente (treino + dieta).
7. Medidas corporais no check-in.
8. Labels descritivas nas escalas de energia/fome/estresse.
9. Mostrar thumbnail de vídeo no exercício.

### 🟢 Polimento
10. Modo foco no treino.
11. Integração Apple Health / Google Fit.
12. Conquistas e gamificação.
13. Preferências de unidades e lembretes.
14. RPE por série.

---

## 6. Conclusão

Os ajustes do Claude Code elevaram bastante a qualidade do app iOS. A área do aluno agora tem **fluxos reais e funcionais** de treino, dieta, progresso e check-in. A maior fraqueza atual não é mais a falta de funcionalidade, mas **a qualidade e consistência dos dados** apresentados (porções zeradas, datas em inglês, stats locais).

A recomendação é focar nos itens críticos de dados e localização primeiro, porque eles são barreiras de confiança. Depois, evoluir para recursos de engajamento (fotos, medidas, conquistas) que aproximam o app dos grandes players do mercado fitness.
