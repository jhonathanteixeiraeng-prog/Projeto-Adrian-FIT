# Auditoria da interface do aluno - 2026-07-11

## Escopo

Fluxo auditado no Simulator como aluno logado: Hoje, Treinos, Detalhe/execucao de treino, Dieta, Progresso, Check-in, Chat e Perfil.

## Veredito

O app ja tem uma base visual forte: dark mode consistente, identidade laranja clara, cards grandes, boa sensacao premium e uma navegacao principal simples. O ponto fraco e que a experiencia ainda parece "painel web compactado" em algumas areas: muito dado cru, pouca orientacao contextual, pouca leitura de evolucao e alguns dados quebrados reduzem a confianca do aluno.

## Passos capturados

1. Hoje - saudacao, treino do dia, indicadores semanais, proximas refeicoes e contato com personal.
   Saude: boa base visual, mas metricas zeradas e data em ingles enfraquecem o produto.

2. Treinos - lista semanal com cards por dia.
   Saude: clara e bonita, mas mostra grupos repetidos e nao destaca o treino de hoje no contexto da semana.

3. Execucao de treino - progresso por series, campos de kg/reps e checks.
   Saude: funcionalmente promissora, mas precisa de metas completas, historico de carga, video/tecnica e area inferior sem sobreposicao.

4. Dieta - consumo do dia, macros e refeicoes.
   Saude: visualmente boa, mas criticamente prejudicada por alimentos e porcoes ruins, itens 0 kcal e medidas pouco humanas.

5. Progresso - estado vazio e CTA de check-in.
   Saude: limpo, mas pobre para um app fitness; falta grafico, tendencia, fotos, historico e incentivo claro.

6. Check-in - medidas, energia/fome/estresse, adesao a treino e dieta.
   Saude: organizado, mas escalas precisam de ancoras semanticas e melhor traducao para progresso visivel.

7. Chat - conversa com personal.
   Saude: util e direto, mas precisa aparecer como parte mais central da jornada do aluno.

8. Perfil - dados, notificacoes, senha e sair.
   Saude: limpo, mas limitado; faltam objetivo, plano atual, preferencias, suporte e dados fisicos relevantes.

## Principais oportunidades

1. Transformar a Home em "Hoje vou fazer isso"
   - Trocar data em ingles por pt-BR.
   - Mostrar proxima acao clara: iniciar treino, registrar refeicao, fazer check-in ou falar com personal.
   - Substituir metricas zeradas por progresso real: sequencia, treinos feitos/semana, adesao da dieta, peso/medidas recentes.
   - Dar feedback emocional: "bom ritmo", "falta 1 treino na semana", "proxima refeicao as 10:00".

2. Elevar a execucao de treino
   - Mostrar ultima carga/reps por exercicio.
   - Corrigir metas incompletas como "4 x  • 180s".
   - Adicionar video/tecnica, observacao do personal, RPE/dificuldade e substituicao quando equipamento indisponivel.
   - Melhorar o descanso com contexto: proxima serie, proximo exercicio, ajuste rapido de tempo e estado minimizado.
   - Garantir padding inferior para a barra nao cobrir series.

3. Refazer a camada de dieta para linguagem de aluno
   - Corrigir itens 0 kcal e 0 x 100g.
   - Usar medidas caseiras: 1 ovo, 2 fatias, 1 concha, 1 colher, 1 banana media.
   - Priorizar refeicoes brasileiras saudaveis e comuns.
   - Incluir marcar refeicao feita, substituir alimento e ver alternativas equivalentes.
   - Mostrar macros por refeicao de forma simples, sem transformar a tela em calculadora.

4. Progresso precisa virar central de evolucao
   - Estado vazio deve mostrar preview do que sera acompanhado.
   - Depois do primeiro check-in: grafico de peso/medidas, fotos comparativas, aderencia semanal e PRs/cargas.
   - Mostrar relacao entre treino, dieta e resultado: nao so lista de check-ins.
   - Evitar duplicidade entre botao "+" e "Fazer check-in" sem explicar diferenca.

5. Check-in mais humano
   - Escalas 1-5 precisam de significado: "muito baixa" a "muito alta".
   - Energia, fome e estresse devem ter direcoes visuais diferentes para nao confundir.
   - Aderencia em slider de 0-100 pode passar falsa precisao; considerar opcoes: 0, 25, 50, 75, 100 ou "fiz tudo / fiz quase tudo / falhei bastante".
   - Envio deve explicar o que acontece depois: personal recebe, historico atualiza, feedback pode vir no chat.

6. Perfil e relacionamento com personal
   - Mostrar plano atual, objetivo, data da proxima avaliacao, personal responsavel e atalho de chat.
   - Adicionar preferencias: horarios de treino, equipamentos disponiveis, restricoes alimentares, alimentos que nao gosta.
   - Perfil deve ser centro de configuracao da jornada, nao so conta/senha.

## Comparacao com apps grandes

- Nike Training Club enfatiza metas, conteudo continuo e historico de atividades; aqui a Home ainda mostra pouco historico vivo.
- Freeletics posiciona personalizacao como nucleo; aqui existe plano individual, mas o aluno ainda nao ve muita adaptacao a feedback, carga, energia ou adesao.
- MyFitnessPal trata nutricao como tracking diario de macros/calorias/peso/agua; aqui a tela de dieta tem visual de tracking, mas falta confiabilidade nos dados e acoes de registro.

## Riscos de acessibilidade vistos nas capturas

- Alguns controles acessiveis aparecem genericos como "circle" ou so numeros 1-5, sem contexto suficiente.
- Contraste de textos secundarios cinza em fundo escuro pode ficar fraco em tela real.
- Areas tocaveis da barra inferior e conteudo parecem competir no final da tela.
- Campos de kg/reps no treino precisam de labels mais claros para leitor de tela.
- Escalas do check-in precisam dizer o que cada valor significa.

## Prioridade sugerida

P0:
- Corrigir dados de dieta e unidades.
- Corrigir metas incompletas nos treinos.
- Resolver sobreposicao da barra inferior.
- Localizar pt-BR.

P1:
- Historico de cargas/reps/RPE.
- Progresso com graficos e fotos.
- Check-in com ancoras semanticas.
- Marcacao de refeicao feita e substituicoes.

P2:
- Video/tecnica.
- Personalizacao por equipamento/preferencias.
- Resumo pos-treino.
- Notificacoes inteligentes.
