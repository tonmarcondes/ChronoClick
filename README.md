# ChronoClick Recorder — v0.8.8

## Links que parecem botões e cores à vista

Links de navegação e itens de menu usam a frase `Acione o menu {value}.`. Links com papel de botão, classes como `btn`/`button` ou estilo de botão usam `Acione o botão {value}.`. Nesses cliques, `{value}` recebe o nome visível do componente. As frases podem ser alteradas em **Textos automáticos**.

A identificação pela aparência é uma aproximação: sites com estilos muito diferentes podem exigir revisão. Links comuns continuam descritos como links. A classificação vale para novas capturas; não tentamos adivinhar o CSS de uma gravação antiga.

Nas configurações, cada seletor mostra uma amostra da cor e seu código hexadecimal, sem precisar abrir a paleta.

## Ajustes nos prints e no Word

- A entrada automática aparece uma vez por URL base visitada, não só no primeiro site da gravação. Pastas, rotas, parâmetros e fragmentos não criam novas entradas. Cliques nessas páginas continuam com seus prints. Ao gerar novamente, essa regra também remove entradas redundantes da apresentação, sem apagar os arquivos originais.
- Cronocliques próximos são distribuídos para não cobrir os anteriores; os números ficam dentro do print. Campos parcialmente visíveis recebem o número na parte visível. Marcadores deslocados continuam editáveis no Word e podem ser reposicionados.
- Removi a tabulação após os números de STEP e deixei margens iguais nos dois lados. A numeração continua automática.
- Em **Documento**, marque ou desmarque **Mostrar legenda das imagens** e **Mostrar legenda das tabelas**, separadamente.
- Em **Tema**, escolha a cor dos links e se ela deve vir da configuração ou do CSS do projeto. A configuração é o padrão e não é mais sobrescrita silenciosamente pelo CSS.

Falhas reais de captura por navegação ou movimento ainda aparecem nos avisos. Esses prints não são recriados pela distribuição dos cronocliques; é preciso repetir a captura para completar o registro.

## Corrigi o início de uma nova gravação

Ao clicar em **Iniciar nova**, o painel deixa de mostrar o link e os avisos anteriores enquanto conecta. O gravador tenta se reconectar à página sem recarregá-la e exige uma confirmação de início. Quando dá certo, a sessão começa sem os eventos e sem o link do projeto anterior, e o painel fecha após três segundos.

Se o início falhar, a mensagem fica visível e a sessão anterior é preservada. Nenhum arquivo antigo é apagado. As chamadas de conexão e criação têm limite de espera para não deixar o início preso indefinidamente.

Esta versão acrescenta a permissão `scripting`, usada para carregar o gravador nas páginas já abertas. Recarregue a extensão em `chrome://extensions` e confira se o Chrome pede para confirmar a permissão. Páginas internas do navegador continuam não sendo graváveis.

## Nome do arquivo e início da gravação

O DOCX usa o nome do projeto, mantendo espaços e acentos. Caracteres inválidos no nome do arquivo são trocados por hífen. O título dentro do Word continua independente e aceita variáveis. Gerar novamente atualiza o DOCX com o mesmo nome dentro do projeto.

Depois de **Iniciar nova**, o painel fecha em três segundos, somente se a gravação iniciar com sucesso. Em caso de erro, ele fica aberto.

## Como lidar com capturas que falharam

“O componente mudou de posição” indica que o elemento se moveu entre o clique e a captura. Espere imagens, animações e carregamentos terminarem antes de clicar. Aguarde cerca de um segundo entre ações; isso reduz a fila, mas não garante sucesso em páginas que mudam imediatamente.

“A página mudou antes do print” indica que a navegação ocorreu antes da captura da origem. Mantenha **Links comuns: aguardar print antes de navegar** ativado. Essa espera funciona para links comuns, mas não controla todos os redirecionamentos por scripts.

Para tentar completar a sessão, clique em **Continuar**, volte à página e repita a interação no mesmo componente. Uma captura bem-sucedida remove o aviso correspondente. Se o site mudar a URL ou a identificação do componente, o aviso anterior pode permanecer; nesse caso, refaça a gravação. Capturas que nunca foram salvas não podem ser recuperadas. Não desative a validação só para remover avisos: isso pode associar a ação a um print errado.

## Agrupamento e título

Agora os passos consecutivos na mesma tela ficam juntos: um print com vários cronocliques e uma tabela com os passos. Mudanças de URL, rolagem, janela ou aparência relevante abrem outro grupo. Voltar a uma página depois de passar por outra não mistura a ordem do procedimento.

Em **Print no Word**, escolha **Agrupar telas semelhantes**. Esse passa a ser o padrão ao atualizar de versões anteriores. A opção de um print por evento continua disponível. O intervalo de agrupamento aceita `0`, para não separar passos só porque houve uma pausa. Ao gerar novamente, o Word também reagrupa gravações antigas; as imagens originais continuam na pasta.

O **Título do documento** aceita variáveis. Por exemplo, `Manual — {pageName}` usa o nome da primeira página gravada. `{url}` usa o endereço dessa página. O título dentro do Word e as propriedades do documento resolvem essas variáveis. Desde a v0.8.5, o nome do arquivo usa o nome do projeto.

## O que ajustei nesta versão

O texto “Insira a url…” aparece na primeira entrada no site. Ao navegar por outras páginas da mesma base (protocolo, domínio e porta), ele não fica criando prints extras. Os cliques, campos e demais ações continuam sendo gravados. Se quiser registrar cada URL, desative **Evitar entradas repetidas no site inicial**, na revisão. A mudança vale para as próximas capturas; não apaga passos antigos.

Também corrigi os cronocliques dos campos. Quando a digitação substituía o clique inicial, o marcador sumia. Agora os passos de digitação, seleção e checkbox recebem um marcador no centro do componente. Os cliques mantêm a posição do mouse. Rolagens e entradas em páginas não recebem marcador.

Os números continuam sendo formas editáveis no Word, não parte da imagem. Para aplicar essa correção a uma gravação antiga, gere o DOCX novamente.

## Correção da v0.8.2

- Entrada em URL: `Insira a url {url} e acesse a página {pageName}`. Edite em **Textos automáticos → Entrada em nova página**. Vale para URLs abertas diretamente ou por links; não lê o texto da barra de endereços enquanto você digita.
- Iniciar exige conexão com o gravador na aba ativa. Após atualizar a extensão, atualize também a página web; caso contrário, a gravação não inicia e mostra a orientação.
- Nova gravação na mesma página registra novamente a entrada inicial.
- Sessão vazia mostra por que não pode gerar DOCX. Falha na finalização libera nova tentativa, em vez de manter o painel preso em “Finalizando”.
- No painel, marque a autorização de exportação parcial quando houver capturas com falha. O link de abertura só aparece após o arquivo ser gerado e validado.

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
