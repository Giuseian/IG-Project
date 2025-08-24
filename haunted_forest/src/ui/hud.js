// src/ui/hud.js
export function initHUD() {
  const HEAT_SCHEME = "blue-red";

  if (!document.getElementById('hud-style')) {
    const style = document.createElement('style');
    style.id = 'hud-style';
    style.textContent = `
      :root{
        --hud-bg:#2c3946ee;
        --hud-fg:#e8f1ff;
        --hud-muted:#a8b4c4;
        --hud-accent:#18c08f;
        --hud-danger:#ff6b6b;
        --hud-track:#12161c;
      }
      .hud-card{
        position: fixed; left:16px; top:16px; z-index: 10000;
        min-width: 380px;
        color: var(--hud-fg);
        background: var(--hud-bg);
        border-radius: 14px;
        box-shadow: 0 14px 32px #0008, inset 0 1px 0 #fff1;
        padding: 14px 16px;
        backdrop-filter: blur(6px);
        font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial, "Noto Sans", "Liberation Sans", sans-serif;
        font-size: 14px;
      }
      .hud-row{
        display: grid; grid-template-columns: auto 1fr auto;
        align-items: center; gap: 10px;
        margin: 10px 0;
      }
      .hud-label{
        opacity: .95; display:flex; align-items:center; gap:8px;
        white-space: nowrap;
      }
      .hud-icon{
        width: 18px; height: 18px; display:inline-flex; align-items:center; justify-content:center;
        filter: drop-shadow(0 1px 0 #0006);
      }
      .hud-value{
        color: var(--hud-muted); font-variant-numeric: tabular-nums; min-width: 44px; text-align:right;
      }
      .meter{
        position: relative; height: 12px; border-radius: 999px; overflow: hidden;
        background: linear-gradient(#0000, #0002), var(--hud-track);
        box-shadow: inset 0 1px 2px #0008, inset 0 0 0 1px #0006;
      }
      .meter.slim{ height: 10px; }
      .meter > .fill{
        position:absolute; inset:0; width:0%;
        background: linear-gradient(90deg, #16d6a3, #19b88a);
        box-shadow: 0 0 10px #16d6a380;
        transition: width .12s ease;
      }
      .meter.heat > .fill{
        background: var(--heat-color, #20b8ff);
        box-shadow: 0 0 12px color-mix(in srgb, var(--heat-color, #20b8ff) 70%, transparent);
      }
      @keyframes pulseRed { 0%{opacity:1} 50%{opacity:.6} 100%{opacity:1} }
      .meter.heat.over > .fill{
        background: var(--hud-danger);
        box-shadow: 0 0 16px #ff6b6b88;
        animation: pulseRed .8s ease-in-out infinite;
      }
      .hud-badge{
        padding: 2px 8px; border-radius: 999px;
        font-weight: 700; font-size: 12px; letter-spacing:.2px;
        background: #33415566; color: #cbd5e1;
        text-transform: lowercase;
        white-space: nowrap;
      }
      .badge-inactive{ background:#47556944; color:#cbd5e1; }

      .hud-rightstack{
        display:flex; align-items:center; gap:8px; justify-content:flex-end;
        flex-wrap: wrap;
        min-width: 220px;
      }

      /* Sanctuary badge palette (niente più blocked) */
      .sanct-idle{ background:#3b82f633; color:#93c5fd; }
      .sanct-armed{ background:#ef444433; color:#fecaca; }
      .sanct-purifying{ background:#fbbf2433; color:#fde68a; }
      .sanct-done{ background:#10b98133; color:#a7f3d0; }
      .sanct-safe{ background:#0ea5a533; color:#99f6e4; }
    `;
    document.head.appendChild(style);
  }

  const root = document.createElement('div');
  root.className = 'hud-card';
  root.innerHTML = `
    <div class="hud-row">
      <div class="hud-label">
        <span class="hud-icon">❤️</span>
        <span>Health</span>
      </div>
      <div class="meter" id="hud-health-meter">
        <div class="fill" id="hud-health-fill"></div>
      </div>
      <div class="hud-value" id="hud-health-text">100</div>
    </div>

    <div class="hud-row">
      <div class="hud-label">
        <span class="hud-icon">🔦</span>
        <span>Beam&nbsp;Heat</span>
      </div>
      <div class="meter heat" id="hud-heat-meter">
        <div class="fill" id="hud-heat-fill"></div>
      </div>
      <div class="hud-value" id="hud-heat-text">0%</div>
    </div>

    <div class="hud-row">
      <div class="hud-label">
        <span class="hud-icon">⭐</span>
        <span>Score</span>
      </div>
      <div class="meter" id="hud-score-meter">
        <div class="fill" id="hud-score-fill" style="opacity:.25"></div>
      </div>
      <div class="hud-value" id="hud-score-text">0</div>
    </div>

    <!-- Sanctuary row -->
    <div class="hud-row">
      <div class="hud-label">
        <span class="hud-icon">🛕</span>
        <span>Sanctuary</span>
      </div>
      <div>
        <div class="meter slim" id="hud-sanct-meter" title="progress">
          <div class="fill" id="hud-sanct-fill"></div>
        </div>
        <div style="margin-top:6px; display:flex; gap:8px; align-items:center;">
          <span id="hud-sanct-state" class="hud-badge sanct-idle">idle</span>
          <span id="hud-sanct-safe"  class="hud-badge sanct-safe" style="display:none;">SAFE</span>
          <span id="hud-sanct-dist"  class="hud-badge" title="distance to nearest">d: 0.0m</span>
        </div>
      </div>
      <div class="hud-value" id="hud-sanct-pct">0%</div>
    </div>

    <div class="hud-row">
      <div class="hud-label">
        <span class="hud-icon">👻</span>
        <span>Ghost</span>
      </div>
      <div class="hud-rightstack">
        <span id="hud-ghost-state" class="hud-badge badge-inactive">inactive</span>
        <span class="hud-badge" id="hud-ghost-thr" title="uThreshold">thr: 1.00</span>
        <span class="hud-badge" id="hud-ghost-exp" title="exposure">exp: 0.00</span>
        <span class="hud-badge" id="hud-ghost-dist" title="dist to target (XZ)">d: 0.00m</span>
      </div>
    </div>

    <!-- Spawner row -->
    <div class="hud-row">
      <div class="hud-label">
        <span class="hud-icon">🧲</span>
        <span>Spawner</span>
      </div>
      <div class="hud-rightstack">
        <span class="hud-badge" id="hud-sp-alive" title="alive">alive: 0</span>
        <span class="hud-badge" id="hud-sp-cap"   title="max alive">cap: 0</span>
        <span class="hud-badge" id="hud-sp-pool"  title="pool">pool: 0</span>
        <span class="hud-badge" id="hud-sp-next"  title="time to next spawn">next: 0.00</span>
        <span class="hud-badge" id="hud-sp-mode"  title="spawn mode">mode: -</span>
        <span class="hud-badge" id="hud-sp-anti"  title="anti-pop-in">anti: off</span>
      </div>
    </div>
  `;
  document.body.appendChild(root);

  const els = {
    healthFill: root.querySelector('#hud-health-fill'),
    healthText: root.querySelector('#hud-health-text'),
    heatFill:   root.querySelector('#hud-heat-fill'),
    heatText:   root.querySelector('#hud-heat-text'),
    heatMeter:  root.querySelector('#hud-heat-meter'),
    scoreText:  root.querySelector('#hud-score-text'),

    // Sanctuary
    sanctFill:  root.querySelector('#hud-sanct-fill'),
    sanctMeter: root.querySelector('#hud-sanct-meter'),
    sanctPct:   root.querySelector('#hud-sanct-pct'),
    sanctState: root.querySelector('#hud-sanct-state'),
    sanctSafe:  root.querySelector('#hud-sanct-safe'),
    sanctDist:  root.querySelector('#hud-sanct-dist'),

    // Ghost
    gState:     root.querySelector('#hud-ghost-state'),
    gThr:       root.querySelector('#hud-ghost-thr'),
    gExp:       root.querySelector('#hud-ghost-exp'),
    gDist:      root.querySelector('#hud-ghost-dist'),

    // Spawner
    spAlive: root.querySelector('#hud-sp-alive'),
    spCap:   root.querySelector('#hud-sp-cap'),
    spPool:  root.querySelector('#hud-sp-pool'),
    spNext:  root.querySelector('#hud-sp-next'),
    spMode:  root.querySelector('#hud-sp-mode'),
    spAnti:  root.querySelector('#hud-sp-anti'),
  };

  const hex = (r,g,b)=>'#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
  const lerp = (a,b,t)=>a+(b-a)*t;
  const mix  = (c1,c2,t)=>hex(
    Math.round(lerp(c1[0],c2[0],t)),
    Math.round(lerp(c1[1],c2[1],t)),
    Math.round(lerp(c1[2],c2[2],t))
  );
  const blue=[32,184,255], amber=[255,209,102], yellow=[248,225,108], red=[255,107,107];

  function heatColor(t){
    t = Math.max(0, Math.min(1, t));
    if (HEAT_SCHEME === 'yellow-red') {
      const m = 0.55;
      return t < m ? mix(yellow, amber, t/m) : mix(amber, red, (t-m)/(1-m));
    } else {
      const m = 0.6;
      return t < m ? mix(blue, yellow, t/m) : mix(yellow, red, (t-m)/(1-m));
    }
  }

  function set(health01, heat01, score, { overheated=false } = {}) {
    const h = Math.max(0, Math.min(1, health01 ?? 1));
    const t = Math.max(0, Math.min(1, heat01   ?? 0));

    els.healthFill.style.width = `${h*100}%`;
    els.healthText.textContent = Math.round(h*100);

    els.heatFill.style.width = `${t*100}%`;
    els.heatText.textContent = `${Math.round(t*100)}%`;
    els.heatMeter.classList.toggle('over', !!overheated);

    if (!overheated) {
      const col = heatColor(t);
      els.heatFill.style.setProperty('--heat-color', col);
    }

    els.scoreText.textContent = String(score ?? 0);
  }

  // aggiorna Sanctuary (senza "blocked")
  function setSanctuary(info, { safe=false } = {}) {
    // info: { state, t, dist, radius }
    const state = info?.state || 'idle';
    const t = Math.max(0, Math.min(1, info?.t ?? 0));
    els.sanctFill.style.width = `${Math.round(t*100)}%`;
    els.sanctPct.textContent = `${Math.round(t*100)}%`;

    const clsMap = {
      idle:'sanct-idle', armed:'sanct-armed',
      purifying:'sanct-purifying', done:'sanct-done'
    };
    els.sanctState.textContent = state;
    els.sanctState.className = `hud-badge ${clsMap[state] || 'sanct-idle'}`;

    els.sanctSafe.style.display = safe ? '' : 'none';
    if (info?.dist != null) els.sanctDist.textContent = `d: ${(+info.dist).toFixed(1)}m`;
  }

  function setDebug(d = {}) {
    const state = d.state ?? 'inactive';
    els.gState.textContent = String(state);
    els.gState.classList.remove('badge-inactive', 'badge-appearing', 'badge-active', 'badge-cleansing');
    els.gState.classList.add(
      state === 'appearing' ? 'badge-appearing' :
      state === 'active'    ? 'badge-active'    :
      state === 'cleansing' ? 'badge-cleansing' : 'badge-inactive'
    );

    if (d.threshold != null) els.gThr.textContent  = `thr: ${(+d.threshold).toFixed(2)}`;
    if (d.exposure  != null) els.gExp.textContent  = `exp: ${(+d.exposure).toFixed(2)}`;
    if (d.dist      != null) els.gDist.textContent = `d: ${(+d.dist).toFixed(2)}m`;

    const sp = d.spawner || {};
    if (els.spAlive && sp.alive != null) els.spAlive.textContent = `alive: ${sp.alive}`;
    if (els.spCap   && sp.maxAlive != null) els.spCap.textContent = `cap: ${sp.maxAlive}`;
    if (els.spPool  && sp.pool != null) els.spPool.textContent = `pool: ${sp.pool}`;
    if (els.spNext  && sp.nextIn != null) els.spNext.textContent = `next: ${(+sp.nextIn).toFixed(2)}`;
    if (els.spMode  && sp.mode) els.spMode.textContent = `mode: ${sp.mode}`;
    if (els.spAnti  && sp.antiPopIn != null) els.spAnti.textContent = `anti: ${sp.antiPopIn ? 'on' : 'off'}`;
  }

  set(1, 0, 0);
  setDebug();
  return { root, set, setSanctuary, setDebug };
}
