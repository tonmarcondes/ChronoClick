# Histórico de versões

## 0.12.2

- Centralizei corretamente a numeração da coluna STEP no documento.
- Mostrei no ícone da extensão quantas capturas já foram salvas.
- Limpei os eventos e o link anterior depois que o documento é aberto.
- Troquei o ícone antigo pelo novo logo do ChronoClick com fundo transparente.

## 0.12.1

- Completei no gerador do navegador as colunas configuráveis, legendas e numerações automáticas do Word.
- Mantive os textos, links e microprints editáveis mesmo sem o aplicativo nativo.
- Validei a geração e a aparência do documento em uma página web real.

## 0.12.0

- Removi a dependência do aplicativo nativo: gravação, imagens e geração do DOCX agora ficam dentro da extensão.
- Adicionei validação de acesso por e-mail, preparada para o serviço futuro em `chronoclick.app`.
- Passei a salvar o documento pela janela de download do navegador.
- Incluí build e pacote próprios para publicação na Chrome Web Store.

## 0.11.1

- Permiti usar regex para controlar o espaço antes e depois dos prints e das tabelas.
- Mantive a observação como texto acima da área selecionada, sem criar uma linha na tabela.

## 0.11.0

- Transformei a observação em uma seleção de área com explicação e microprint.
- Adicionei apresentação dos passos em tabela ou texto e regras de espaçamento por regex.
- Removi o microprint da digitação e uni o último scroll à interação seguinte.

## 0.10.0

- Incluí opções para sumário e exibição dos erros de captura no DOCX.
- Transformei a numeração dos títulos em uma lista automática do Word.
- Limpei eventos, avisos e links antigos quando uma nova gravação começa.
- Organizei as configurações em áreas recolhíveis, com navegação mais clara e responsiva.

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
