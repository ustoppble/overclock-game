# Mundo Aberto Multiplayer v1 — presença, caça e desafio 1x1

Data: 2026-07-09 · Repo: overclock-game · Status: aprovado

## Objetivo

Transformar o overworld em espaço multiplayer: todo mundo que abre overclock.sh/game entra no MESMO mapa, se vê andando, caça agents no mato alto e desafia outros players pra duelo 1x1 apertando X. Ginásios fechados no v1. Loop = caçar agent + duelar + upar level (forma do mascote).

## Escopo v1

### Mundo fechado pro essencial
- Portas dos ginásios 1-6: interagir mostra diálogo "EM BREVE — ginásios fecham no v1", sem entrar.
- Treinadores-tutorial (x/y), NPCs (a/b/c), mato alto (encontros selvagens/captura) e Catálogo (porta C) continuam funcionando como hoje.
- Porta da Arena (A) continua levando ao fluxo PvP por código de sala (fallback pra desafiar amigo remoto).

### Presença global (server/server.mjs — relay ganha canal `w*`)
Estado novo no servidor: `world = Map<playerId, { ws, name, x, y, dir, skin, form, hasSquad }>`.
Protocolo (mesmo WebSocket, mensagens JSON novas, protocolo de duelo intocado):

| Direção | Mensagem | Efeito |
|---|---|---|
| c→s | `{t:'wjoin', name, skin, form, hasSquad}` | registra player, responde `{t:'wstate', you, players[]}` e broadcast `{t:'wenter', player}` |
| c→s | `{t:'wmove', x, y, dir, form}` | valida bounds, broadcast `{t:'wmove', id, x, y, dir, form}` |
| s→broadcast | `{t:'wleave', id}` | na desconexão do ws |
| c→s | `{t:'wchallenge', to}` | alvo recebe `{t:'wchallenged', from:{id,name}}`; desafiante recebe `{t:'wchallenge-sent'}` |
| c→s | `{t:'waccept', to}` | servidor cria sala interna pro par e dispara o `{t:'start', seed, you, a, b}` EXISTENTE |
| c→s | `{t:'wdecline', to}` | desafiante recebe `{t:'wdeclined'}` |

Regras servidor:
- Throttle: ignora `wmove` mais rápido que 1 por 100ms por conexão.
- Desafio expira em 15s (timer no servidor → `wdeclined` automático).
- Player em duelo sai da lista de presença (broadcast `wleave`); volta com novo `wjoin` ao fim.
- Validação: `wchallenge` exige ambos `hasSquad`; squad é enviado no `waccept`/`wchallenge` (mesma `validSquad` atual).
- Sem persistência; tudo em memória, mesmo padrão das salas.

### Cliente — WorldScene ganha rede
- Conecta `PvpClient`-like (novo `WorldClient` em `src/engine/worldLive.ts`) ao entrar na tela world; `wjoin` com nome, cor do clock (skin), forma atual e `hasSquad = party.length > 0`.
- Players remotos: sprite clockinho (mesma textura procedural, tint pela skin), label com nome + forma flutuando, movimento interpolado por tween tile-a-tile (mesmo timing do player local).
- Apertar X olhando pra player adjacente → `wchallenge`. Modal no alvo: "「nome」 te desafia! ACEITAR (X) / RECUSAR (Z)" com barra de 15s.
- Aceito → ambos congelam → transição pra PvpArenaScene existente com o `start` do servidor (fluxo idêntico ao match por sala) → ao fim do duelo, voltam pro world no mesmo tile e re-`wjoin`.
- Sem party: entra no mundo normalmente, mas não desafia nem é desafiável (label indica "sem squad").

### XP / level via duelo
- Simulação determinística = mesmo resultado nos 2 clientes; cada cliente aplica o próprio XP local: vitória +40, derrota +10.
- XP alimenta a form ladder existente (`formForXp`); forma nova propaga no próximo `wmove`/`wjoin`.

## Fora de escopo (YAGNI)
Chat, colisão entre players, persistência de posição no servidor, sharding/instâncias, espectador, anti-cheat além da validação de payload, ranking.

## Riscos aceitos
- Broadcast O(n²) em movimento — ok até ~50 players simultâneos.
- XP client-side (localStorage) é trivialmente editável — jogo casual, aceito no v1.

## Restrições
- NÃO alterar a matemática do duelo (`computeRound`, `deriveDomains`) nem o protocolo create/join/pick/reveal/rematch.
- `npm run build` limpo. Branch `feat/world-multiplayer` a partir de main; push só da branch, merge via PR.

## Como testar
`npm run server` local, 2 janelas privadas: ambos aparecem no mapa, andar, um aperta X no outro, aceitar, duelo na arena visual, voltar pro mundo, XP aplicado, forma atualizada. Testar recusa, timeout 15s, desconexão no meio do duelo, player sem squad.
