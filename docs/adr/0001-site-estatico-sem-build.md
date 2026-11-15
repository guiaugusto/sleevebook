# ADR 0001: Site estático, JavaScript puro, sem etapa de build

- Status: aceito
- Data: 2026-11-14

## Contexto

O planejamento inicial sugeria Vite + TypeScript. O ambiente de desenvolvimento do projeto não tem Node.js instalado, e o produto é uma aplicação que roda inteira no navegador (sem servidor próprio no início).

## Decisão

Usar **HTML, CSS e módulos ES nativos**, sem bundler, sem framework e sem dependências de runtime. O código é organizado em módulos pequenos em `src/js`. O site é publicado como arquivos estáticos.

## Consequências

- Quem baixar o repositório roda o projeto com qualquer servidor estático; não há `npm install`.
- Menos conveniências de TypeScript e de framework. Em troca, o código fica pequeno e direto de ler, e o navegador é o único requisito.
- Se o projeto crescer e precisar de build (tipagem, componentes), dá para introduzir Vite depois sem reescrever: os módulos ES já são o formato que o Vite consome.
- Testes de lógica pura rodam no navegador (`tests/index.html`), sem runner externo.

## Atualização (2026-11-15): aviso de versão nova

Como o site é estático e tem service worker, quem deixa a aba aberta continua rodando o código antigo na memória depois de cada publicação (e viu, por exemplo, correções que já estavam no ar como se ainda não estivessem). Agora, quando uma versão nova assume o controle (`controllerchange`), o app mostra "Há uma versão nova do Sleevebook" com os botões **Recarregar** e **Depois**. O navegador também procura versão nova ao voltar para a aba e a cada 30 minutos. Na primeira instalação não há aviso.
