# ChronoClick

**Transforme ações no navegador em procedimentos editáveis no Word.**

O ChronoClick registra interações com páginas web, salva capturas e microprints dos componentes e organiza os passos em um documento `.docx`. O processamento é local: cada projeto fica em uma pasta, sem banco de dados ou serviço de armazenamento externo.

**Versão:** 0.9.1 · **Plataforma dos instaladores:** macOS · **Licença:** [Apache 2.0](LICENSE)

[Instalação](#instalação) · [Como usar](#como-usar) · [Configurações](#configurações) · [Desenvolvimento](#desenvolvimento) · [Limitações](#limitações)

## Recursos

- Clique, duplo clique, botão direito, digitação, seleção, checkbox e observações.
- Última captura de cada página, acompanhada de uma tabela consolidada de passos.
- Microprints junto do texto e cronocliques como formas editáveis no Word.
- Textos automáticos configuráveis, inclusive para links com aparência de botão ou menu.
- Colunas, alinhamento, cores, fontes, espaçamento e legendas configuráveis.
- Borda e sombra do print como propriedades do documento, sem alterar a imagem original.
- Numeração nativa de STEP, atualizada pelo Word ao remover linhas.
- Avisos explícitos quando uma captura falha; exportação parcial somente com confirmação.

## Requisitos

- macOS, com Google Chrome ou Microsoft Edge.
- Node.js **20.9 ou superior** e npm. No macOS, uma instalação em `/opt/homebrew/bin` ou `/usr/local/bin` também é reconhecida pelo host.
- Microsoft Word para a edição dos documentos. Outros leitores podem interpretar formas, sombras e numeração de maneira diferente.

O código de captura utiliza extensões Chromium Manifest V3. Os instaladores `.command` e a abertura automática do DOCX são específicos do macOS.

## Instalação

```bash
git clone https://github.com/tonmarcondes/ChronoClick.git
cd ChronoClick
npm ci
./install/install-native-host.command
```

Depois, no navegador:

1. Abra `chrome://extensions` ou `edge://extensions`.
2. Ative **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação** e selecione a pasta `extension`.
4. Fixe o ChronoClick na barra do navegador.

O host local é responsável por salvar arquivos e gerar o Word. O instalador registra sua localização no navegador, sem exigir administrador. Se mover a pasta do aplicativo, execute o instalador novamente.

### Atualizar uma instalação

Em um clone já sincronizado com o histórico atual:

```bash
git pull --ff-only
npm ci
./install/install-native-host.command
```

Recarregue a extensão na página de extensões e atualize a página web que deseja gravar. Se houver alterações locais ou divergência de histórico, preserve seu trabalho antes de sincronizar; não use comandos de descarte para forçar a atualização.

## Como usar

1. Abra a página que será documentada.
2. Clique no ChronoClick e informe o **nome do projeto**.
3. Clique em **Iniciar nova**. Após confirmar o início, o painel fecha em três segundos.
4. Execute as ações. Ao reabrir o painel, o mesmo botão passa a ser **Finalizar**.
5. Finalize a gravação. O botão passa a ser **Gerar DOCX**.
6. Gere o documento e clique em **Abrir documento Word** quando ele estiver pronto.

A engrenagem abre a revisão e as configurações. A pasta de destino e as opções de documento ficam nessa tela, inclusive antes da primeira gravação. Durante a captura, **Ferramentas de captura** reúne pausa, continuação, observação e captura de texto selecionado.

O DOCX usa o nome do projeto, preservando espaços e acentos; caracteres inválidos são substituídos. O título dentro do Word é independente do nome do arquivo. Gerar novamente atualiza o DOCX do mesmo projeto.

### Última tela e cronocliques

Por padrão, ações consecutivas na mesma página usam a **última captura registrada** daquela visita, com todos os passos na tabela. Isso não é uma captura adicional do estado final após todas as animações: é a última imagem obtida pelo gravador. Ao navegar para outra URL e depois voltar, um novo grupo preserva a cronologia.

Para posicionar os cronocliques anteriores, o gravador verifica os componentes no momento da última captura. Se um componente não estiver mais visível ou sua posição não puder ser confirmada, o documento informa os passos afetados; os textos e microprints continuam na tabela. Ele não inventa coordenadas para completar a imagem.

Os arquivos originais de cada evento permanecem no projeto. Em **Print no Word**, é possível escolher **Um para cada evento mantido** para uma revisão individual. Gravações antigas podem não ter o mapa de posições necessário para todos os marcadores da última tela.

Com **Links e botões: aguardar print antes da ação** ativado, o clique aguarda a captura antes de chegar aos comandos da página, inclusive em rotas SPA. Há uma breve espera: o navegador limita a frequência dos prints. Downloads e cliques com modificadores não são adiados. Sites que exigem eventos `isTrusted`, abrem seletores de arquivo ou alteram a interface no `pointerdown` podem precisar dessa opção desativada; nesses casos a captura anterior à mudança não é garantida. Capturas antigas que falharam precisam ser refeitas.

### URL base

A entrada automática de URL é registrada uma vez por site visitado, considerando protocolo, domínio e porta. Pastas, rotas, parâmetros e fragmentos não geram novas entradas desse tipo. As interações nessas páginas continuam sendo capturadas.

Essa regra pode ser desativada em **Evitar entradas repetidas em cada site**.

## Configurações

| Grupo | Opções principais |
| --- | --- |
| Documento | Título, legendas, exibição das legendas e pasta de destino |
| Gravação | Scroll associado a ações, consolidação de repetições, término da digitação e validação de captura |
| Imagens | Formato, qualidade, dimensões máximas e margem dos microprints |
| Textos automáticos | Frases para cada tipo de ação e suas variáveis |
| Colunas | Nome, fonte do conteúdo, largura e alinhamento |
| Tema | Fontes, cores com amostra visível, espaçamentos e tamanho dos cronocliques |
| Borda e sombra | Cor, espessura, linha contínua/tracejada/pontilhada/dupla, opacidade, desfoque e distância |

As legendas das imagens e das tabelas podem ser ativadas separadamente. As opções de tamanho e qualidade valem para novas capturas; não redimensionam retroativamente os arquivos salvos. Bordas, sombras e apresentação no Word são reaplicadas ao gerar o documento.

O arquivo `theme.css` permite ajustar os tokens `--chrono-*` da apresentação. Nos links, o campo **Usar cor dos links definida em** escolhe explicitamente entre a configuração visual e o CSS. Nos demais tokens de tema, os valores presentes no CSS têm precedência sobre as opções equivalentes.

### Variáveis

A área **Variáveis disponíveis**, na revisão, explica os contextos de uso. Exemplos:

```text
Título do documento: Manual — {pageName}
Entrada na página: Insira a url {url} e acesse a página {pageName}
Digitação: Insira o texto {value} no campo {name}.
Link com aparência de botão: Acione o botão {value}.
Item de menu: Acione o menu {value}.
Texto selecionado: Certifique-se que {texto-iluminado}.
```

No título geral, os dados são os da primeira página ou do primeiro passo. Nos textos das ações, pertencem ao passo correspondente. Em cliques, `{value}` usa o valor disponível ou o nome do componente; na digitação, usa o texto capturado.

A pasta de destino aceita `~`, `$VAR`, `${VAR}` e `%VAR%`. As variáveis devem existir no ambiente do host local. Não confunda variáveis de ambiente com os marcadores dos textos do documento.

Ao ajustar cor, espessura ou tipo da borda, **Mostrar borda no DOCX** é ativado automaticamente. Para retirar a borda, desmarque essa opção. Salve e gere o documento novamente: o arquivo já exportado não muda sozinho.

## Arquivos do projeto

```text
~/sistemas/cronoPrint/nome-do-projeto/
├── project.json       # Identificação e configurações
├── session.json       # Passos, grupos, posições e avisos
├── theme.css          # Tema do documento
├── screenshots/       # Capturas originais
├── components/        # Microprints
└── documents/         # Documentos Word gerados
```

É possível mover ou copiar a pasta do projeto como um conjunto. A existência de `documents` não significa que a geração terminou: aguarde o link de abertura no painel.

## Desenvolvimento

### Organização do código

| Módulo | Responsabilidade |
| --- | --- |
| `extension/content.js` | Eventos da página, componentes DOM e contexto de captura |
| `extension/background.js` | Sessões, filas de captura e comunicação com o host |
| `extension/default-config.js` | Valores padrão compartilhados |
| `extension/recording-policy.js` | Regras de consolidação, URLs e classificação das ações |
| `extension/popup-model.js` | Estado do botão principal e das ações do painel |
| `extension/review.js` | Edição dos passos e configurações |
| `native-host/host.cjs` | Persistência local e comandos de geração |
| `cli/generate-docx.cjs` | Composição do documento Word |
| `cli/page-groups.cjs` | Escolha da última captura por página |
| `cli/marker-layout.cjs` | Distribuição dos cronocliques |
| `cli/print-decoration.cjs` | Bordas e sombras dos prints no DOCX |
| `cli/theme.cjs` | Leitura dos tokens CSS |

### Testes e qualidade

```bash
npm test
npm run test:integration
npm run format:check
npm audit --omit=dev
```

- Os testes de unidade cobrem políticas, agrupamento, sessões e o botão de três etapas.
- A integração usa o host real, imagens sintéticas e verifica o conteúdo do pacote DOCX, incluindo textos, marcadores, legendas, bordas e sombras.
- Para não criar projetos de teste na pasta padrão:

  ```bash
  CHRONO_TEST_ROOT=/private/tmp/chronoclick-tests npm run test:integration
  ```

- `npm run test:ui` serve o painel e a revisão em `http://127.0.0.1:8768/extension/popup.html`, com uma comunicação simulada. É uma ferramenta de teste visual, não uma gravação real do Chrome.
- `npm run format` aplica a formatação padronizada com Prettier.

Os testes automatizados não substituem uma gravação real no navegador nem a conferência visual no Word. Antes de publicar uma alteração, valide também os fluxos afetados. Veja [CONTRIBUTING.md](CONTRIBUTING.md).

### Gerar pela linha de comando

```bash
./generate-docx.command /caminho/do/projeto/session.json /caminho/saida.docx
```

Para gerar uma demonstração com dados sintéticos:

```bash
npm run demo
```

## Solução de problemas

| Sintoma | O que verificar |
| --- | --- |
| Não inicia | Abra uma página HTTP/HTTPS, recarregue a extensão e confira a permissão de acesso ao site. O gravador tenta reconectar páginas já abertas. |
| Host local não responde | Execute novamente o instalador. Confira Node.js e a localização da pasta do aplicativo. |
| Zero passos | Não há conteúdo para exportar. Inicie outro projeto e confira o contador antes de finalizar. |
| Componente mudou de posição | Aguarde carregamentos e animações; deixe um intervalo entre as ações. |
| Página mudou antes do print | Mantenha a espera de captura para links comuns ativada. Redirecionamentos por scripts podem ocorrer antes da captura. |
| Cronoclique ausente na última tela | Consulte o aviso de posição, a tabela e o microprint. O componente pode ter saído da área visível. |
| DOCX incompleto | Revise os avisos. A exportação parcial mantém uma indicação explícita no documento. |

Capturas que não foram salvas não podem ser recuperadas retroativamente. Não desative a validação apenas para eliminar avisos: isso pode associar um passo à imagem errada.

## Limitações

- Captura a área visível da aba, não uma imagem de toda a página rolável.
- Não grava páginas internas como `chrome://` ou `edge://`.
- Iframes, canvas, menus complexos e navegações muito rápidas podem exigir revisão manual.
- A classificação de links pela aparência é heurística e pode precisar de ajustes em sites específicos.
- Formas flutuantes e efeitos de imagem podem variar entre leitores de DOCX. Redimensionar um print no Word pode exigir reposicionar seus cronocliques.
- O encerramento de uma gravação não garante que todas as capturas tenham sido concluídas sem falhas; os avisos fazem parte do registro.

## Privacidade

Textos digitados e screenshots podem conter dados pessoais. Senhas, códigos de uso único e campos marcados como privados são omitidos do texto capturado, mas **as imagens não são censuradas automaticamente**. Revise o documento antes de compartilhar.

Gravações, microprints, documentos gerados, dependências e arquivos de ambiente não devem ser enviados ao repositório. O `.gitignore` cobre os caminhos e formatos usuais.

## Licença

Distribuído sob a [Apache License 2.0](LICENSE). Consulte [CHANGELOG.md](CHANGELOG.md) para as mudanças de versão.
