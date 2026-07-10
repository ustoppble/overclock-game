# Mundo Aberto Multiplayer v1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Presença multiplayer no overworld (todos no mesmo mapa), desafio 1x1 com X → duelo na PvpArenaScene existente, XP por duelo, ginásios fechados.

**Architecture:** O relay WS existente (`server/server.mjs`) ganha um canal de presença (`w*` messages) e um fluxo de desafio que desemboca em uma sala "duo" — os dois clientes entram nela com `join` e o protocolo de duelo atual roda intocado. No cliente, um hook React (`useWorldLive`) segura o socket de mundo e conversa com a `WorldScene` (Phaser) via `bridge`.

**Tech Stack:** Node (ws) no servidor, testes com `node:test` + client `ws`. Cliente React 19 + Phaser 3.90, TypeScript, sem libs novas.

## Global Constraints
- NÃO alterar `computeRound`, `deriveDomains` nem o protocolo create/join/pick/reveal/rematch (exceto o slot "duo" no join).
- `npm run build` (tsc + vite) limpo ao fim de cada task.
- Branch `feat/world-multiplayer`; push só da branch, merge via PR.
- `PICK_SECONDS = 15` (era 20) — única mudança de ritmo.
- Estética existente: dark `#0a0810`, accent `#ef4444`, monospace, zero asset externo.

---

### Task 1: Servidor — presença no mundo (wjoin/wmove/wleave)

**Files:**
- Modify: `server/server.mjs`
- Test: `server/test/world.test.mjs` (novo; `node --test server/test/`)

**Interfaces:**
- Produces (protocolo): `{t:'wjoin', name, x, y, skin, form, hasSquad}` → `{t:'wstate', you, players[]}` + broadcast `{t:'wenter', player}`; `{t:'wmove', x, y, dir, form}` → broadcast `{t:'wmove', id, x, y, dir, form}`; close → broadcast `{t:'wleave', id}`. Player público: `{id, name, x, y, dir, skin, form, hasSquad}`.
- Throttle: `wmove` < 100ms por conexão é ignorado. `x∈[0,45]`, `y∈[0,31]` clampados.

Passos: escrever teste (2 clients ws conectam, A faz wjoin, B faz wjoin e recebe wenter de A + wstate com A; A move → B recebe wmove; A fecha → B recebe wleave) → rodar e ver falhar → implementar → passar → commit `feat(server): presença de mundo (wjoin/wmove/wleave)`.

### Task 2: Servidor — desafio 1x1 + sala duo

**Files:**
- Modify: `server/server.mjs`
- Test: `server/test/world.test.mjs` (ampliar)

**Interfaces:**
- `{t:'wchallenge', to}` → alvo `{t:'wchallenged', from:{id,name}}`, desafiante `{t:'wchallenge-sent', to}`. Ambos precisam `hasSquad`; 1 desafio pendente por par; timeout 15s → `{t:'wdeclined', id}` pro desafiante.
- `{t:'waccept', to}` → servidor cria sala `{duo:true}` e manda `{t:'wmatch', code}` pros dois.
- `{t:'wdecline', to}` → desafiante recebe `{t:'wdeclined', id}`.
- No handler `join` existente: sala `duo` aceita o PRIMEIRO join como lado `a` (em vez de exigir create) e o segundo como `b` → `startMatch`. Validação `validSquad` inalterada.
- Cleanup: desconexão limpa desafios pendentes envolvendo o id.

Passos: teste (A desafia B, B aceita, ambos recebem wmatch com mesmo code; dois novos sockets dão join no code e recebem start com sides a/b; recusa manda wdeclined; desafio sem squad → err) → falhar → implementar → passar → commit `feat(server): desafio 1x1 no mundo + sala duo`.

### Task 3: Cliente — engine `worldLive.ts`

**Files:**
- Create: `src/engine/worldLive.ts`

**Interfaces (Produces):**
```ts
export type Dir = 'up' | 'down' | 'left' | 'right'
export interface WorldPlayer { id: string; name: string; x: number; y: number; dir: Dir; skin: string | null; form: string; hasSquad: boolean }
export type WorldEvent =
  | { t: 'open' } | { t: 'closed' }
  | { t: 'wstate'; you: string; players: WorldPlayer[] }
  | { t: 'wenter'; player: WorldPlayer }
  | { t: 'wmove'; id: string; x: number; y: number; dir: Dir; form: string }
  | { t: 'wleave'; id: string }
  | { t: 'wchallenged'; from: { id: string; name: string } }
  | { t: 'wchallenge-sent'; to: string }
  | { t: 'wdeclined'; id?: string }
  | { t: 'wmatch'; code: string }
  | { t: 'err'; msg: string }
export class WorldClient {
  constructor(handler: (e: WorldEvent) => void)
  connect(): void
  join(info: { name: string; x: number; y: number; skin: string | null; form: string; hasSquad: boolean }): void
  move(x: number, y: number, dir: Dir, form: string): void
  challenge(to: string): void
  accept(to: string): void
  decline(to: string): void
  close(): void
}
```
Mesmo shape do `PvpClient`; reusa `wsUrl()` de `pvpLive.ts`. Verify: `npx tsc -b`. Commit `feat(client): WorldClient (canal de presença)`.

### Task 4: WorldScene — ginásios fechados

**Files:**
- Modify: `src/phaser/WorldScene.ts` (método `enterTile`, case `[1-6]`)

Trocar o gate de insígnias por: `chiptune.back(); this.showToast('🔒 GINÁSIO — EM BREVE'); return`. Nada de `bridge.emit('gym')`. Verify: build + entrar na porta mostra toast. Commit `feat(world): ginásios fechados no v1 (EM BREVE)`.

### Task 5: WorldScene — jogadores remotos + desafio com X

**Files:**
- Modify: `src/phaser/WorldScene.ts`

**Interfaces (bridge, Consumes/Produces):**
- Consome (React → cena): `w:snapshot` (WorldPlayer[]), `w:enter` (WorldPlayer), `w:move` ({id,x,y,dir,form}), `w:leave` ({id}), `w:challenged` ({id,name}), `w:toast` (string).
- Produz (cena → React): `w:challenge` (targetId: string), `w:answer` ({id, accept: boolean}); `move` passa a `{x, y, dir}`.
- Estado interno: `remotes = Map<id, { sprite, label, x, y }>`; sprite = `clockKey(form,'idle',0)` com `setTint` da skin (fallback sem tint), label = nome + forma. `w:move` → tween 150ms pro tile.
- keydown-X: modal de desafio aberto → aceitar; senão, se `facing()` tem remoto → `w:challenge` + toast "desafio enviado…". keydown-Z: modal aberto → recusar.
- Modal de desafio: container estilo dialog existente, texto `「name」 te desafia! X ▸ ACEITAR · Z ▸ RECUSAR`, barra de 15s; congela movimento; timeout local fecha modal.
- Handlers de bridge registrados no `create()` com off no `shutdown` (scene restart não pode duplicar).

Verify: build + QA manual (task 8). Commit `feat(world): jogadores remotos + desafio 1x1 com X`.

### Task 6: App — hook `useWorldLive` + roteamento do match

**Files:**
- Create: `src/screens/useWorldLive.ts`
- Modify: `src/App.tsx`

**Interfaces:**
- `useWorldLive(opts: { active: boolean; name: string; skin: string | null; form: string; hasSquad: boolean; pos: {x:number;y:number}; onMatch: (code: string) => void })` — monta `WorldClient` quando `active` (screen === 'world'), faz `wjoin`, repassa eventos ↔ bridge (`w:*`), escuta `move` do bridge pra `client.move`, fecha no unmount.
- `wmatch` → `onMatch(code)` → App: `setRoomCode(code); set({ screen: 'pvp' })` — `Pvp` já auto-entra via `joinCode` (fluxo existente).
- `bridge.on('move')` handler existente do App continua salvando `worldPos` (payload agora tem `dir` a mais — ignora).

Verify: build. Commit `feat(app): hook de presença + desafio desemboca no PvP existente`.

### Task 7: XP por duelo + timer 15s

**Files:**
- Modify: `src/engine/pvpLive.ts` (`PICK_SECONDS = 15`)
- Modify: `src/screens/PvpLive.tsx` (prop `onResult?: (o: 'win'|'loss'|'draw') => void`, chamada única no reveal final — não em `left`/`closed`)
- Modify: `src/screens/Pvp.tsx` (repassa prop)
- Modify: `src/App.tsx` (`onResult` → `xp += win?40 : draw?20 : 10`; `wonBattles++` em win)

Guard: ref `awardedRef` por match, resetada no `start` (rematch premia de novo). Verify: build. Commit `feat(pvp): XP por duelo (40/20/10) + timer 15s`.

### Task 8: QA E2E + PR

- `npm run build` limpo; `node --test server/test/` verde.
- `npm run server` + 2 janelas privadas: presença mútua, andar, X → modal → aceitar → duelo → placar → XP aplicado → volta pro mundo re-conectado; recusa; timeout; ginásio fechado; player sem squad.
- Push branch, PR pra main.
