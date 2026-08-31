# Contribuindo com o ChronoClick

## Preparar o ambiente

Use Node.js 20.9 ou superior e execute `npm ci`. Para testar a captura real, instale o host local e carregue a pasta `extension` no Chrome ou Edge.

## Antes de enviar uma alteração

1. Faça uma mudança com objetivo claro e preserve as gravações existentes.
2. Adicione um teste de regressão para o comportamento alterado.
3. Execute `npm test`, `npm run test:integration` e `npm run format:check`.
4. Confira a interface no navegador e o resultado no Word quando houver mudança visual.
5. Atualize a documentação e descreva as limitações conhecidas.

Prefira funções pequenas, nomes que expliquem a intenção e módulos com uma responsabilidade definida. Compartilhe regras entre extensão e gerador para evitar resultados diferentes na revisão e no DOCX.

## Commits

Escreva em português, com linguagem natural e direta. Separe alterações independentes em commits próprios. Exemplo:

```text
Passei a usar a última captura de cada página no Word
```

Não inclua capturas reais, documentos de usuários, credenciais, arquivos de ambiente ou `node_modules`. Use imagens e dados sintéticos nos testes. Não reescreva histórico publicado sem autorização explícita dos responsáveis.

## Relatar um problema

Informe a versão do ChronoClick, navegador, sistema operacional, passos para reproduzir e a mensagem de erro. Se anexar uma sessão ou documento, remova dados pessoais e confirme que pode compartilhar o conteúdo.
