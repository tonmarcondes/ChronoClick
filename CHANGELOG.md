# Histórico de versões

## 0.9.1

- Alterar a aparência da borda passa a ativá-la, com orientação para gerar o DOCX novamente.
- Links e botões aguardam a captura antes dos handlers da página, preservando a navegação SPA e evitando prints após a mudança provocada pelo clique.
- Testes de regressão e página de teste com mudança imediata de posição e rota.

## 0.9.0

- Última captura por visita à página, com todos os passos na tabela.
- Conferência de posições anteriores na última tela e aviso quando um marcador não pode ser posicionado.
- Borda e sombra configuráveis como propriedades dos prints no Word.
- Painel simplificado com engrenagem e botão Iniciar nova → Finalizar → Gerar DOCX.
- Configurações disponíveis antes da primeira gravação; pasta de destino movida para a revisão.
- Módulos separados para configurações, tema, agrupamento, marcadores, decoração e estado do painel.
- Formatação padronizada, lockfile e testes visuais locais com comunicação simulada.
- Atualização do sharp para a série 0.35; Node.js mínimo 20.9.

## 0.8.8

- Classificação de links com aparência de botão ou menu e frases configuráveis.
- Amostras de cores e códigos hexadecimais visíveis nas configurações.
- Consolidação das correções de sessões, exportação, variáveis, legendas e marcadores desenvolvidas nas versões 0.8.x.
