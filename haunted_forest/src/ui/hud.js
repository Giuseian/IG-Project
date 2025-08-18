// src/ui/hud.js
export function initHUD() {
  // --- CSS (inject) ---
  const style = document.createElement('style');
  style.textContent = `
    #hud {
      position: fixed; left: 16px; top: 16px; z-index: 9999;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      color: #e8eef7; pointer-events: none;
    }
    #hud .panel {
      background: rgba(0,0,0,0.55);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 10px;
      padding: 10px 12px;
      box-shadow: 0 6px 18px rgba(0,0,0,0.25);
      min-width: 220px;
    }
    #hud .row { margin-bottom: 8px; }
    #hud .label { font-size: 12px; opacity: 0.85; margin-bottom: 4px; }
    #hud .bar {
      width: 100%; height: 10px; border-radius: 999px; background: #1f2630; overflow: hidden;
      outline: 1px solid rgba(255,255,255,0.06);
    }
    #hud .fill {
      height: 100%; width: 0%; border-radius: inherit; transition: width 0.08s linear;
    }
    #hud .fill.health { background: linear-gradient(90deg, #38ef7d, #11998e); }
    #hud .fill.heat   { background: linear-gradient(90deg, #ffd56a, #ff9d00); }
    #hud .overheated .fill.heat { background: linear-gradient(90deg, #ff6b6b, #c9184a); }
    #hud .line {
      display: flex; align-items: baseline; justify-content: space-between;
      margin-top: 8px; font-size: 13px; opacity: 0.9;
    }
    #hud .small { font-size: 11px; opacity: 0.75; }
  `;
  document.head.appendChild(style);

  // --- Markup ---
  const root = document.createElement('div');
  root.id = 'hud';
  root.innerHTML = `
    <div class="panel">
      <div class="row">
        <div class="label">Health</div>
        <div class="bar"><div class="fill health" style="width:0%"></div></div>
      </div>
      <div class="row" id="hud-heat-row">
        <div class="label">Beam Heat <span class="small" id="hud-heat-state"></span></div>
        <div class="bar"><div class="fill heat" style="width:0%"></div></div>
      </div>
      <div class="line">
        <div>Score</div>
        <div id="hud-score">0</div>
      </div>
    </div>
  `;
  document.body.appendChild(root);

  const els = {
    healthFill: root.querySelector('.fill.health'),
    heatFill:   root.querySelector('.fill.heat'),
    heatRow:    root.querySelector('#hud-heat-row'),
    heatState:  root.querySelector('#hud-heat-state'),
    scoreText:  root.querySelector('#hud-score'),
  };

  function clamp01(x){ return Math.max(0, Math.min(1, x)); }

  function set(health01, heat01, score, opts={}) {
    const h = clamp01(health01);
    const t = clamp01(heat01);
    els.healthFill.style.width = (h*100).toFixed(1) + '%';
    els.heatFill.style.width   = (t*100).toFixed(1) + '%';

    const overheated = !!opts.overheated;
    els.heatRow.classList.toggle('overheated', overheated);
    els.heatState.textContent = overheated ? '(OVERHEATED)' : '';
    els.scoreText.textContent = String(score|0);
  }

  // default safe
  set(1, 0, 0, { overheated:false });

  return { set };
}
