/** COMO JOGAR — manual do orquestrador, no vocabulário real do produto. */
interface Props { onBack: () => void }

export function HowToPlay({ onBack }: Props) {
  return (
    <div className="panel">
      <h2>📖 COMO JOGAR</h2>

      <div className="slot">
        <h4>🎯 Você é o ORQUESTRADOR — nunca lute</h4>
        <p className="sub">Você não ataca. Você monta o <span className="kw">harness</span> certo e DESPACHA agentes. Quem tenta agir sozinho é bloqueado — igual no Overclock de verdade.</p>
      </div>

      <div className="slot" style={{ marginTop: 8 }}>
        <h4>🧰 Harness = agente + modelo + effort + skills</h4>
        <p className="sub">Antes de cada missão, monte o loadout POR TIPO de task (⚔ SQUAD):</p>
        <p className="sub">· <b>Agente</b> — scout 🔍 pesquisa, executor ⚡ entrega, reviewer 🛡️ revisa. Afinidade com o domínio = dano ×1.3.<br />
        · <b>Modelo</b> — stats vêm de benchmarks reais (LMArena, WebDev Arena…). Fable devasta código mas custa caro; DeepSeek barato destrói em lógica; Gemini enxerga QA visual.<br />
        · <b>Effort</b> — low/medium/high: força do golpe × custo por turno.<br />
        · <b>Skills</b> — máx 4, respeitando a whitelist do agente (cadeado = skill gate).</p>
      </div>

      <div className="slot" style={{ marginTop: 8 }}>
        <h4>💰 Tokens = sua vida</h4>
        <p className="sub">Cada turno queima tokens (modelo × effort). Budget zerado = missão falida. Vencer dá nota de eficiência <b>S/A/B/C</b> — quanto MENOS gastar, melhor a nota, mais XP pro mascote evoluir (Base→Boost→Turbo→Overdrive→Redline).</p>
      </div>

      <div className="slot" style={{ marginTop: 8 }}>
        <h4>⚠️ Punições que ensinam</h4>
        <p className="sub">· Modelo fraco em task densa → <b>ALUCINAÇÃO</b> (o inimigo regenera — "resolveu errado").<br />
        · Repetir o mesmo agente demais → <b>429 RATE LIMIT</b> (perde a vez).<br />
        · Effort low em task criativa → resultado genérico (dano 0.3×).</p>
      </div>

      <div className="slot" style={{ marginTop: 8 }}>
        <h4>🗺️ Mundo</h4>
        <p className="sub">Ande com as setas/WASD. Mato alto esconde tasks selvagens. <b>6 ginásios</b> guardam insígnias — zere todos pra forma Redline. No Catálogo você instala agentes e desbloqueia modelos.</p>
      </div>

      <div className="slot" style={{ marginTop: 8 }}>
        <h4>🌐 PvP multiplayer</h4>
        <p className="sub">· <b>🔴 AO VIVO</b>: crie uma sala, mande o código/link — 7 rodadas de domínios de arena, os dois escolhem o harness às cegas com timer de 20s. Repetir agente = 429.<br />
        · <b>🔗 Por link</b>: seu squad vira um código; quem abrir enfrenta — sem precisar estar online junto.<br />
        Squad diverso (scout+executor+reviewer) ganha bônus — squad só de executor caro PERDE.</p>
      </div>

      <p className="sub" style={{ marginTop: 10 }}>Controles: setas/WASD andar · E/Enter confirmar · Esc voltar.</p>

      <button className="btn" onClick={onBack}>entendi — jogar</button>
    </div>
  )
}
