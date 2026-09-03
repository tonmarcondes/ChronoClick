# ChronoClick

Extensão Chromium que transforma uma sequência de interações em um procedimento Word editável, com prints da página, cronocliques, microprints e descrições automáticas.

**Versão:** 0.12.2 · **Plataformas:** Chrome, Edge, Brave e outros navegadores Chromium · **Licença:** [Apache 2.0](LICENSE)

## O que mudou na versão web

O ChronoClick funciona inteiramente como extensão. Não precisa de Node.js, instalador ou aplicativo auxiliar. A gravação e as imagens ficam no armazenamento privado do navegador; ao finalizar, a própria extensão monta o DOCX e abre a janela de download.

O acesso passa por uma validação de e-mail. Enquanto `chronoclick.app` não está disponível, somente `wmarcondesbr@gmail.com` é aceito pelo modo de teste, por 30 dias em cada validação.

## Instalação para desenvolvimento

```bash
npm install
npm run build:extension
```

Depois:

1. Abra `chrome://extensions`.
2. Ative **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação**.
4. Selecione a pasta `extension`.
5. Fixe o ChronoClick na barra do navegador.
6. Informe o e-mail de teste para validar o acesso.

Ao atualizar o código, execute novamente `npm run build:extension` e recarregue a extensão.

## Como usar

1. Abra a página que deseja documentar.
2. Clique no ChronoClick e valide o acesso.
3. Informe o nome do projeto e clique em **Iniciar nova**.
4. Navegue, clique, digite, selecione campos e role a página.
5. Use **Marcar observação** para selecionar uma área e escrever um texto explicativo.
6. Clique em **Finalizar**.
7. Revise os passos e as configurações, se necessário.
8. Clique em **Gerar DOCX** e escolha onde salvar o arquivo.

O nome do projeto é usado como nome do arquivo.

## Ações registradas

- clique, clique duplo e botão direito;
- botões, links, menus e campos;
- digitação consolidada após o usuário terminar;
- seleção e alteração de opções;
- texto destacado;
- navegação para um novo site;
- última rolagem associada à interação seguinte;
- observação com texto e recorte selecionado.

Cliques sem objeto útil são ignorados. Digitação não cria microprint. A observação aparece como texto e imagem fora da tabela.

## Configurações do Word

É possível configurar:

- título do documento e das seções;
- sumário e legendas;
- tabela ou passos em texto;
- colunas, larguras e alinhamentos;
- fontes, cores, bordas e sombras;
- dimensões dos prints e microprints;
- textos automáticos;
- exibição dos avisos de captura;
- espaçamentos por expressão regular.

As regras de espaçamento usam:

```text
regex | linhas antes | linhas depois | tabs
```

Além das ações, os alvos abaixo controlam blocos do documento:

```text
^print$ | 1 | 1 | 0
^observation-print$ | 1 | 1 | 0
^table$ | 2 | 1 | 0
```

## Dados e privacidade

O ChronoClick precisa ler a página visível para capturar nomes de componentes, URLs, textos e imagens usados no documento. Esses dados ficam localmente no navegador e só saem dele quando o usuário salva ou compartilha o DOCX.

Consulte [PRIVACY.md](PRIVACY.md) para a descrição completa. Antes da publicação, essa política deverá estar em uma URL pública do domínio `chronoclick.app`.

## Desenvolvimento

```bash
npm test
npm run build:extension
npm run package:extension
```

O último comando cria o ZIP pronto para envio à Chrome Web Store dentro de `dist/`.

O gerador usado pela extensão fica em `browser/docx-generator.js`. `cli/` e `native-host/` permanecem temporariamente no repositório apenas como referência e testes de compatibilidade; não entram no ZIP da extensão.

## Estrutura

```text
browser/       gerador DOCX executado no navegador
extension/     extensão Manifest V3
scripts/       build e empacotamento
tests/         testes automatizados e página de validação
cli/           gerador legado de referência
native-host/   host legado de referência
```

## Segurança da licença

O e-mail de teste é uma liberação temporária e local. A versão pública usará `https://chronoclick.app/api/v1/access/validate`, com licença, prazo e revogação controlados pelo servidor. Nenhum segredo de validação deve ser armazenado dentro da extensão.

## Licença

[Apache License 2.0](LICENSE).
