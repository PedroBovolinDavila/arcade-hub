# O Salão — Arcade Hub

Plataforma de jogos em formato de salão 3D. O salão é a entrada e a identidade visual; o catálogo concentra a descoberta e a abertura dos jogos.

## Estrutura

- `index.html`: página principal do salão e navegação.
- `assets/css/salon.css`: estilos do salão e das telas do catálogo.
- `assets/js/salon.js`: cena 3D, controles, navegação e interface do catálogo.
- `assets/salon/`: recursos 3D compartilhados do ambiente (modelos, texturas, shaders e áudio).
- `assets/ui/`: ícones e recursos compartilhados da interface.
- `assets/covers/`: capas dos jogos.
- `data/games.json`: cadastro central dos jogos exibidos no catálogo.
- `games/<id>/`: cada jogo é um módulo independente; `index.html` é o ponto de entrada.
- `manifest.webmanifest` e `sw.js`: instalação PWA e cache da aplicação.

## Adicionar um jogo

1. Crie `games/<id>/index.html` e coloque os recursos exclusivos do jogo dentro dessa pasta.
2. Adicione a capa em `assets/covers/` (quando houver arte final).
3. Cadastre o jogo em `data/games.json`, usando um `id` único, `name`, `description`, `shortDescription`, `status`, `number`, `path`, `kind` e `players`.
4. O catálogo carrega os registros desse JSON e atualiza a busca automaticamente.

## Desenvolvimento

A página é estática e pode ser servida por qualquer servidor HTTP local ou GitHub Pages. Não abra por `file://`, pois o catálogo carrega `data/games.json` com `fetch`.
