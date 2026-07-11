# Auditoria do fluxo do aluno — Adrian Fit iOS

Data: 11 de julho de 2026

## Veredito

A base visual é sólida e coerente, mas a experiência ainda se comporta mais como um visualizador de prescrição do que como um treinador digital. O início e o cronômetro de descanso são os pontos mais fortes. Execução, dieta e progresso precisam de dados confiáveis, feedback e continuidade para alcançar o padrão de apps fitness maduros.

## Etapas auditadas

1. Início — saudável com ressalvas: CTA claro, mas data sem localização e métricas pouco informativas.
2. Treino — crítico: título truncado, conteúdo sob a navegação, repetições ausentes e falta de registro de carga.
3. Descanso — bom: foco e hierarquia fortes; faltam ajuste rápido e indicação do próximo exercício.
4. Dieta — crítico: porções zeradas e alimentos inadequados tornam a prescrição difícil de confiar.
5. Progresso vazio — razoável: próxima ação clara, mas não ensina o benefício nem mostra uma prévia do resultado.
6. Check-in — bom com ressalvas: formulário organizado; escalas numéricas carecem de significado e contexto.
7. Perfil — saudável: simples e legível; faltam acesso ao personal, ajuda e preferências do treino.

## Prioridades

### P0 — confiança e execução

- Corrigir porções/calorias zeradas e impedir alimentos incompatíveis com o plano.
- Exibir repetições corretamente e nunca renderizar `4 séries × •`.
- Registrar carga, repetições realizadas e percepção de esforço por série.
- Persistir o treino e permitir retomada após fechar o app.

### P1 — progressão e motivação

- Transformar Progresso em um painel com peso, aderência, volume, recordes e frequência.
- Mostrar comparação com a semana anterior e progresso em direção ao objetivo.
- Adicionar resumo pós-treino com duração, volume, recordes e feedback ao personal.
- Fazer streak e meta semanal refletirem dados reais.

### P2 — orientação e acabamento

- Localizar datas para português brasileiro.
- Mostrar vídeo/técnica, equipamento, substituição e notas em cada exercício.
- Exibir próximo exercício no descanso e permitir +15s/-15s.
- Melhorar estados vazios com prévia do que o aluno verá após o primeiro check-in.
- Adicionar contato direto com o personal em Hoje e Perfil.

## Limites

A auditoria foi feita no iPhone 17 Simulator com uma conta real de aluno. Não foram submetidos dados de saúde, concluído um treino inteiro, testadas notificações, modo offline, Dynamic Type máximo, VoiceOver completo ou persistência após encerramento forçado.
