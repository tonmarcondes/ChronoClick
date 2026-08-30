# ChronoClick Recorder — v0.8.1

Gravador de prints de tela.

## Correção da v0.8.1

A pasta se chama **documents** (no plural). Agora é criada ao iniciar o projeto e recriada na exportação caso esteja ausente. Sua existência não indica que o DOCX foi gerado: aguarde o link **Abrir DOCX gerado**.

Falhas de captura antes de uma navegação bloqueavam toda a geração. Agora, ao gerar pelo painel ou pela revisão, é possível confirmar uma exportação parcial dos passos salvos. As falhas continuam registradas e o Word traz um aviso destacado; capturas ausentes não são inventadas. Cancele a confirmação se preferir refazer a gravação completa.

## Instalação a partir do GitHub (macOS)

Instale Node.js 20 ou superior. Depois:

```bash
git clone https://github.com/tonmarcondes/ChronoClick.git
cd ChronoClick
npm install
./install/install-native-host.command
```

Carregue a pasta `extension` em `chrome://extensions`, usando **Carregar sem compactação**. Os instaladores `.command` são para macOS. Testes: `npm test` e `npm run test:integration`.

## Novidades da v0.8

- **Salvar alterações** fecha a revisão somente após salvar com sucesso.
- A área **Variáveis disponíveis** da revisão lista os modelos, fontes de colunas, variáveis de ambiente e tokens CSS, indicando onde são aceitos.
- Depois de **Finalizar → Gerar DOCX**, o painel mostra o andamento e o link **Abrir DOCX gerado**. O link reaparece ao reabrir o painel e abre o arquivo no aplicativo padrão do macOS.
- A geração verifica passos, prints e arquivo resultante. Erros ficam visíveis no painel. Na v0.8.1, a pasta `documents` voltou a ser criada ao iniciar a gravação.
- Também há um link de abertura após gerar pela revisão. Se ocorrer erro, copie a mensagem do painel para diagnóstico; não é necessário apagar o projeto.

O ChronoClick grava ações realizadas em páginas web, captura a tela visível, cria um microprint do componente DOM e gera um documento Word configurável. Não utiliza banco de dados: cada gravação vira uma pasta autocontida em `~/sistemas/cronoPrint`.

```text
~/sistemas/cronoPrint/nome-do-projeto/
├── project.json
├── session.json
├── theme.css
├── screenshots/
├── components/
└── documents/
```

## O que esta versão faz

- grava clique, duplo clique, clique direito, alteração de campos, seleção e checkbox/radio somente quando existe um componente DOM relevante;
- grava a entrada na página inicial, páginas abertas por links e mudanças de rota em aplicações SPA;
- mantém apenas a posição final do scroll antes de uma interação; scroll isolado é descartado por padrão;
- consolida repetições consecutivas no mesmo componente, preservando o evento e o print mais recentes;
- conclui a digitação ao sair do campo, Enter ou Finalizar e inclui o valor digitado na frase configurável;
- permite configurar todas essas regras em **Gravação e consolidação**;
- confere aba, URL, documento e posição antes/depois da captura; falhas aparecem no painel e bloqueiam a exportação incompleta;
- possui captura manual de observação e captura de texto selecionado;
- identifica nome, papel acessível, seletor, página, URL e coordenadas do componente;
- grava prints e microprints como arquivos normais dentro do projeto;
- agrupa eventos próximos da mesma página em um print cronológico;
- permite revisar nomes, escrever descrições, excluir passos e configurar colunas;
- permite escolher o alinhamento de cada coluna: esquerda, centro, direita ou justificado;
- sugere automaticamente frases como “Clique no botão”, “Clique no link” e “Acione o botão direito”, com modelos editáveis;
- transforma texto selecionado em “Certifique-se que {texto-iluminado}”, com frase configurável;
- usa numeração nativa do Word, que se reorganiza ao excluir uma linha;
- insere microprints na mesma linha e com altura configurável em pontos;
- permite manter a proporção original do microprint ou usar dimensões exatas;
- representa links textuais sem imagem como texto azul configurável; links com imagem continuam usando microprint;
- cria cronocliques como formas independentes e movimentáveis no Word;
- permite configurar cores, tipografia, espaçamentos, legendas e títulos;
- permite configurar formato, qualidade, tamanho e margem das imagens;
- transmite capturas grandes em partes, evitando o travamento da finalização e da geração do DOCX;
- gera o DOCX diretamente em `documents/`, com estilos Word nomeados `ChronoClick - ...`.

## 1. Instalar o host local

No Finder, abra a pasta `install` e dê dois cliques em:

```text
install-native-host.command
```

Se o macOS bloquear, clique com o botão direito, escolha **Abrir** e confirme. O instalador registra o host `com.chronoclick.recorder` no Chrome e no Edge. Ele não precisa de administrador.

## 2. Instalar a extensão

1. Abra Chrome ou Edge.
2. No Chrome, acesse `chrome://extensions`. No Edge, acesse `edge://extensions`.
3. Ative **Modo do desenvolvedor**.
4. Clique em **Carregar sem compactação**.
5. Escolha a pasta `extension` deste projeto.
6. Fixe o ícone **ChronoClick Recorder** na barra do navegador.
7. Se ela já estava instalada, clique em **Recarregar** depois de instalar o host.

Para gravar páginas `file://`, abra os detalhes da extensão e habilite **Permitir acesso a URLs de arquivo**.

## 3. Gravar

1. Abra a página que deseja documentar.
2. Clique no ícone ChronoClick.
3. Informe o nome do projeto, a pasta raiz e clique em **Iniciar nova**. A raiz aceita `~`, `$VAR`, `${VAR}` e `%VAR%`.
4. Navegue normalmente. Cada evento relevante gera print e microprint.
5. Para registrar algo que só deve ser observado, clique em **Adicionar observação** e depois clique no componente. Esse clique é bloqueado e vira uma observação.
6. Para documentar uma frase da página, selecione-a com o mouse, abra o ChronoClick e clique em **Capturar texto selecionado**.
7. Use **Pausar** e **Continuar** quando necessário.
8. Clique em **Finalizar** e aguarde o estado **Finalizando**. Ao concluir, o painel continua disponível para revisar ou gerar o DOCX.

Não feche o navegador durante uma gravação. A sessão é salva localmente pela extensão, mas páginas muito longas podem produzir arquivos grandes.

## 4. Revisar e configurar

1. Abra o ChronoClick e clique em **Revisar e configurar**.
2. Edite o título do documento e os padrões:
   - `{sectionNumber}`: número da seção;
   - `{screenNumber}`: número do print;
   - `{tableNumber}`: número da tabela;
   - `{pageName}`: `h1`, título da aba ou rota da página.
3. Configure as colunas. Cada coluna aceita uma ou mais fontes separadas por vírgula:
   - `sequence`;
   - `auto-description`;
   - `component-name`;
   - `microprint`;
   - `action`;
   - `editable`;
   - `url`;
   - `page-title`;
   - `timestamp`;
   - `value`;
   - `fixed-text:Texto desejado`.
4. Configure fonte, cores, negrito e espaçamentos.
5. Revise o texto automático sugerido. Se desejar, substitua-o por uma descrição manual.
6. Clique em **Salvar alterações**.
7. Configure formato, qualidade e dimensões das próximas imagens.
8. Clique em **Gerar DOCX**. O arquivo será salvo em `documents/` dentro do projeto.

A pasta raiz configurada nessa tela é aplicada aos projetos novos. Exemplos: `${HOME}/sistemas/cronoPrint`, `$HOME/Documents/CronoPrint` ou `~/sistemas/cronoPrint`.

Configuração padrão de duas colunas:

```text
STEP       → sequence
DESCRIÇÃO  → auto-description, microprint
```

## 5. Gerar o Word pela CLI

No macOS, abra o Terminal e execute:

```bash
./generate-docx.command \
  "$HOME/sistemas/cronoPrint/meu-projeto/session.json" \
  "$HOME/sistemas/cronoPrint/meu-projeto/documents/procedimento.docx"
```

Para aplicar um tema CSS editado:

```bash
/caminho/para/chronoclick-recorder/generate-docx.command sessao.json procedimento.docx --theme themes/default.css
```

Edite as variáveis em `themes/default.css`. Elas controlam fonte, tamanhos, cores, negrito, bordas, marcadores e espaçamentos. O CSS informado na linha de comando prevalece sobre o tema salvo na sessão.

Neste computador, o script usa automaticamente o runtime incluído no Codex. Em outro computador:

```bash
cd /caminho/para/chronoclick-recorder
npm install
npm run generate -- /caminho/sessao.json /caminho/procedimento.docx
```

Se o terceiro argumento for omitido, o DOCX será criado ao lado do JSON.

## 6. Alterar tudo depois no Word

Abra o painel **Estilos** do Word e procure por:

- `ChronoClick - Título do Documento`;
- `ChronoClick - Título da Seção`;
- `ChronoClick - Legenda do Print`;
- `ChronoClick - Legenda da Tabela`;
- `ChronoClick - Nome do Componente`;
- `ChronoClick - Descrição do Passo`;
- `ChronoClick - Número do Passo`;
- `ChronoClick - Tabela de Passos`.

Clique com o botão direito em um estilo e escolha **Modificar**. Textos que usam esse estilo serão alterados em conjunto. A tabela possui um estilo próprio para bordas e cabeçalho.

Os marcadores sobre o print são formas flutuantes nomeadas `ChronoClick_1`, `ChronoClick_2` etc. No Word, selecione um marcador para movê-lo ou redimensioná-lo. Como são formas independentes, podem se deslocar se o print for redimensionado; reposicione-os depois de alterar o tamanho da imagem.

## Teste rápido sem gravar

Gere uma sessão de demonstração sintética (não incluímos gravações pessoais no repositório):

```bash
npm run demo
```

## Limitações conhecidas

- não grava páginas internas como `chrome://` e `edge://`;
- iframes de outro domínio e componentes em canvas podem exigir captura manual;
- a captura é da área visível da aba, não da página rolável inteira;
- o conteúdo digitado é salvo quando habilitado; senhas, OTP e campos marcados `data-chrono-private` viram `[REDACTED]`; com a captura textual desligada, usa `[NOT_CAPTURED]`;
- imagens não são automaticamente censuradas: revise dados pessoais antes de compartilhar;
- links HTML comuns podem aguardar a captura antes da navegação; redirecionamentos imediatos de scripts e mudanças muito rápidas ainda podem gerar um aviso de captura em vez de um print incorreto;
- o agrupamento usa mesma página e janela de tempo; a revisão manual ainda é importante;
- nomes de projeto repetidos recebem sufixos como `-2` e `-3`;
- a raiz padrão é `${HOME}/sistemas/cronoPrint`, mas pode ser alterada antes de iniciar um projeto;
- mover a pasta do aplicativo depois de instalar o host exige executar novamente o instalador.

## Privacidade

Revise sempre os prints antes de compartilhar o DOCX. Mesmo sem capturar o texto digitado, a tela pode exibir nomes, e-mails, números ou outras informações sensíveis.
