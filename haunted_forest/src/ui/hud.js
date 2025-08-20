// // src/ui/hud.js
// export function initHUD() {
//   // --- scegli lo schema colori del Beam Heat ---
//   // Opzioni: "yellow-red" | "blue-red"
//   const HEAT_SCHEME = "blue-red";

//   // ---- CSS (iniettato una sola volta) ----
//   if (!document.getElementById('hud-style')) {
//     const style = document.createElement('style');
//     style.id = 'hud-style';
//     style.textContent = `
//       :root{
//         --hud-bg:#2c3946ee;
//         --hud-fg:#e8f1ff;
//         --hud-muted:#a8b4c4;
//         --hud-accent:#18c08f;
//         --hud-danger:#ff6b6b;
//         --hud-track:#12161c;
//       }
//       .hud-card{
//         position: fixed; left:16px; top:16px; z-index: 10000;
//         min-width: 300px;
//         color: var(--hud-fg);
//         background: var(--hud-bg);
//         border-radius: 14px;
//         box-shadow: 0 14px 32px #0008, inset 0 1px 0 #fff1;
//         padding: 14px 16px;
//         backdrop-filter: blur(6px);
//         font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial, "Noto Sans", "Liberation Sans", sans-serif;
//         font-size: 14px;
//       }
//       .hud-row{
//         display: grid; grid-template-columns: auto 1fr auto;
//         align-items: center; gap: 10px;
//         margin: 10px 0;
//       }
//       .hud-label{
//         opacity: .95; display:flex; align-items:center; gap:8px;
//         white-space: nowrap;
//       }
//       .hud-icon{
//         width: 18px; height: 18px; display:inline-flex; align-items:center; justify-content:center;
//         filter: drop-shadow(0 1px 0 #0006);
//       }
//       .hud-value{
//         color: var(--hud-muted); font-variant-numeric: tabular-nums; min-width: 44px; text-align:right;
//       }
//       .meter{
//         position: relative; height: 12px; border-radius: 999px; overflow: hidden;
//         background: linear-gradient(#0000, #0002), var(--hud-track);
//         box-shadow: inset 0 1px 2px #0008, inset 0 0 0 1px #0006;
//       }
//       .meter > .fill{
//         position:absolute; inset:0; width:0%;
//         background: linear-gradient(90deg, #16d6a3, #19b88a);
//         box-shadow: 0 0 10px #16d6a380;
//         transition: width .12s ease;
//       }
//       /* Heat: colore deciso via JS con la CSS var --heat-color */
//       .meter.heat > .fill{
//         background: var(--heat-color, #20b8ff);
//         box-shadow: 0 0 12px color-mix(in srgb, var(--heat-color, #20b8ff) 70%, transparent);
//       }
//       /* Overheated: rosso pulsante */
//       @keyframes pulseRed { 0%{opacity:1} 50%{opacity:.6} 100%{opacity:1} }
//       .meter.heat.over > .fill{
//         background: var(--hud-danger);
//         box-shadow: 0 0 16px #ff6b6b88;
//         animation: pulseRed .8s ease-in-out infinite;
//       }
//       .hud-caption{ color: var(--hud-muted); opacity:.9; }
//       .hud-sep{ height:6px; }
//     `;
//     document.head.appendChild(style);
//   }

//   // ---- Markup ----
//   const root = document.createElement('div');
//   root.className = 'hud-card';
//   root.innerHTML = `
//     <!-- Health -->
//     <div class="hud-row">
//       <div class="hud-label">
//         <span class="hud-icon">❤️</span>
//         <span>Health</span>
//       </div>
//       <div class="meter" id="hud-health-meter">
//         <div class="fill" id="hud-health-fill"></div>
//       </div>
//       <div class="hud-value" id="hud-health-text">100</div>
//     </div>

//     <!-- Beam Heat -->
//     <div class="hud-row">
//       <div class="hud-label">
//         <span class="hud-icon">🔦</span>
//         <span>Beam&nbsp;Heat</span>
//       </div>
//       <div class="meter heat" id="hud-heat-meter">
//         <div class="fill" id="hud-heat-fill"></div>
//       </div>
//       <div class="hud-value" id="hud-heat-text">0%</div>
//     </div>

//     <!-- Score -->
//     <div class="hud-row">
//       <div class="hud-label">
//         <span class="hud-icon">⭐</span>
//         <span>Score</span>
//       </div>
//       <div class="meter" id="hud-score-meter">
//         <div class="fill" id="hud-score-fill" style="opacity:.25"></div>
//       </div>
//       <div class="hud-value" id="hud-score-text">0</div>
//     </div>
//   `;
//   document.body.appendChild(root);

//   // ---- refs ----
//   const els = {
//     healthFill: root.querySelector('#hud-health-fill'),
//     healthText: root.querySelector('#hud-health-text'),
//     heatFill:   root.querySelector('#hud-heat-fill'),
//     heatText:   root.querySelector('#hud-heat-text'),
//     heatMeter:  root.querySelector('#hud-heat-meter'),
//     scoreText:  root.querySelector('#hud-score-text'),
//   };

//   // ---- helpers: colori heat ----
//   const hex = (r,g,b)=>'#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
//   const lerp = (a,b,t)=>a+(b-a)*t;
//   const mix = (c1,c2,t)=>hex(
//     Math.round(lerp(c1[0],c2[0],t)),
//     Math.round(lerp(c1[1],c2[1],t)),
//     Math.round(lerp(c1[2],c2[2],t))
//   );
//   // palette punti di controllo per gli schemi
//   const blue    = [32,184,255];   // #20B8FF
//   const amber   = [255,209,102];  // #FFD166
//   const yellow  = [248,225,108];  // #F8E16C
//   const red     = [255,107,107];  // #FF6B6B

//   function heatColor(t){
//     t = Math.max(0, Math.min(1, t));
//     if (HEAT_SCHEME === 'yellow-red') {
//       // giallo -> rosso (passando per arancio)
//       const m = 0.55;
//       return t < m ? mix(yellow, amber, t/m)
//                    : mix(amber,  red,   (t-m)/(1-m));
//     } else {
//       // blue-red (passando per giallo)
//       const m = 0.6;
//       return t < m ? mix(blue,   yellow, t/m)
//                    : mix(yellow, red,    (t-m)/(1-m));
//     }
//   }

//   // ---- API ----
//   function set(health01, heat01, score, { overheated=false } = {}) {
//     const h = Math.max(0, Math.min(1, health01 ?? 1));
//     const t = Math.max(0, Math.min(1, heat01   ?? 0));

//     // Health
//     els.healthFill.style.width = `${h*100}%`;
//     els.healthText.textContent = Math.round(h*100);

//     // Heat
//     els.heatFill.style.width = `${t*100}%`;
//     els.heatText.textContent = `${Math.round(t*100)}%`;
//     els.heatMeter.classList.toggle('over', !!overheated);

//     // Colore dinamico (se NON overheated)
//     if (!overheated) {
//       const col = heatColor(t);
//       els.heatFill.style.setProperty('--heat-color', col);
//     }

//     // Score
//     els.scoreText.textContent = String(score ?? 0);
//   }

//   set(1, 0, 0); // iniziale
//   return { root, set };
// }


// // src/ui/hud.js
// export function initHUD() {
//   // --- scegli lo schema colori del Beam Heat ---
//   // Opzioni: "yellow-red" | "blue-red"
//   const HEAT_SCHEME = "blue-red";

//   // ---- CSS (iniettato una sola volta) ----
//   if (!document.getElementById('hud-style')) {
//     const style = document.createElement('style');
//     style.id = 'hud-style';
//     style.textContent = `
//       :root{
//         --hud-bg:#2c3946ee;
//         --hud-fg:#e8f1ff;
//         --hud-muted:#a8b4c4;
//         --hud-accent:#18c08f;
//         --hud-danger:#ff6b6b;
//         --hud-track:#12161c;
//       }
//       .hud-card{
//         position: fixed; left:16px; top:16px; z-index: 10000;
//         min-width: 320px;
//         color: var(--hud-fg);
//         background: var(--hud-bg);
//         border-radius: 14px;
//         box-shadow: 0 14px 32px #0008, inset 0 1px 0 #fff1;
//         padding: 14px 16px;
//         backdrop-filter: blur(6px);
//         font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial, "Noto Sans", "Liberation Sans", sans-serif;
//         font-size: 14px;
//       }
//       .hud-row{
//         display: grid; grid-template-columns: auto 1fr auto;
//         align-items: center; gap: 10px;
//         margin: 10px 0;
//       }
//       .hud-label{
//         opacity: .95; display:flex; align-items:center; gap:8px;
//         white-space: nowrap;
//       }
//       .hud-icon{
//         width: 18px; height: 18px; display:inline-flex; align-items:center; justify-content:center;
//         filter: drop-shadow(0 1px 0 #0006);
//       }
//       .hud-value{
//         color: var(--hud-muted); font-variant-numeric: tabular-nums; min-width: 44px; text-align:right;
//       }
//       .meter{
//         position: relative; height: 12px; border-radius: 999px; overflow: hidden;
//         background: linear-gradient(#0000, #0002), var(--hud-track);
//         box-shadow: inset 0 1px 2px #0008, inset 0 0 0 1px #0006;
//       }
//       .meter > .fill{
//         position:absolute; inset:0; width:0%;
//         background: linear-gradient(90deg, #16d6a3, #19b88a);
//         box-shadow: 0 0 10px #16d6a380;
//         transition: width .12s ease;
//       }
//       /* Heat: colore deciso via JS con la CSS var --heat-color */
//       .meter.heat > .fill{
//         background: var(--heat-color, #20b8ff);
//         box-shadow: 0 0 12px color-mix(in srgb, var(--heat-color, #20b8ff) 70%, transparent);
//       }
//       /* Overheated: rosso pulsante */
//       @keyframes pulseRed { 0%{opacity:1} 50%{opacity:.6} 100%{opacity:1} }
//       .meter.heat.over > .fill{
//         background: var(--hud-danger);
//         box-shadow: 0 0 16px #ff6b6b88;
//         animation: pulseRed .8s ease-in-out infinite;
//       }
//       .hud-caption{ color: var(--hud-muted); opacity:.9; }
//       .hud-sep{ height:6px; }

//       /* --- BADGE STATO GHOST --- */
//       .hud-badge{
//         padding: 2px 8px; border-radius: 999px;
//         font-weight: 700; font-size: 12px; letter-spacing:.2px;
//         background: #33415566; color: #cbd5e1; /* default */
//         text-transform: lowercase;
//       }
//       .badge-inactive{ background:#47556944; color:#cbd5e1; }
//       .badge-appearing{ background:#f59e0b33; color:#f8e16c; }
//       .badge-active{ background:#10b98133; color:#18c08f; }
//       .badge-cleansing{ background:#ef444433; color:#ff6b6b; }

//       .hud-rightstack{
//         display:flex; align-items:center; gap:10px; justify-content:flex-end;
//         min-width: 200px;
//       }
//     `;
//     document.head.appendChild(style);
//   }

//   // ---- Markup ----
//   const root = document.createElement('div');
//   root.className = 'hud-card';
//   root.innerHTML = `
//     <!-- Health -->
//     <div class="hud-row">
//       <div class="hud-label">
//         <span class="hud-icon">❤️</span>
//         <span>Health</span>
//       </div>
//       <div class="meter" id="hud-health-meter">
//         <div class="fill" id="hud-health-fill"></div>
//       </div>
//       <div class="hud-value" id="hud-health-text">100</div>
//     </div>

//     <!-- Beam Heat -->
//     <div class="hud-row">
//       <div class="hud-label">
//         <span class="hud-icon">🔦</span>
//         <span>Beam&nbsp;Heat</span>
//       </div>
//       <div class="meter heat" id="hud-heat-meter">
//         <div class="fill" id="hud-heat-fill"></div>
//       </div>
//       <div class="hud-value" id="hud-heat-text">0%</div>
//     </div>

//     <!-- Score -->
//     <div class="hud-row">
//       <div class="hud-label">
//         <span class="hud-icon">⭐</span>
//         <span>Score</span>
//       </div>
//       <div class="meter" id="hud-score-meter">
//         <div class="fill" id="hud-score-fill" style="opacity:.25"></div>
//       </div>
//       <div class="hud-value" id="hud-score-text">0</div>
//     </div>

//     <!-- Ghost Debug -->
//     <div class="hud-row">
//       <div class="hud-label">
//         <span class="hud-icon">👻</span>
//         <span>Ghost</span>
//       </div>
//       <div class="hud-rightstack">
//         <span id="hud-ghost-state" class="hud-badge badge-inactive">inactive</span>
//         <span class="hud-value" id="hud-ghost-thr" title="uThreshold">thr: 1.00</span>
//         <span class="hud-value" id="hud-ghost-exp" title="exposure">exp: 0.00</span>
//         <span class="hud-value" id="hud-ghost-dist" title="dist to camera (XZ)">d: 0.00m</span>
//       </div>
//     </div>
//   `;
//   document.body.appendChild(root);

//   // ---- refs ----
//   const els = {
//     healthFill: root.querySelector('#hud-health-fill'),
//     healthText: root.querySelector('#hud-health-text'),
//     heatFill:   root.querySelector('#hud-heat-fill'),
//     heatText:   root.querySelector('#hud-heat-text'),
//     heatMeter:  root.querySelector('#hud-heat-meter'),
//     scoreText:  root.querySelector('#hud-score-text'),
//     gState:     root.querySelector('#hud-ghost-state'),
//     gThr:       root.querySelector('#hud-ghost-thr'),
//     gExp:       root.querySelector('#hud-ghost-exp'),
//     gDist:      root.querySelector('#hud-ghost-dist'),
//   };

//   // ---- helpers: colori heat ----
//   const hex = (r,g,b)=>'#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
//   const lerp = (a,b,t)=>a+(b-a)*t;
//   const mix = (c1,c2,t)=>hex(
//     Math.round(lerp(c1[0],c2[0],t)),
//     Math.round(lerp(c1[1],c2[1],t)),
//     Math.round(lerp(c1[2],c2[2],t))
//   );
//   // palette punti di controllo per gli schemi
//   const blue    = [32,184,255];   // #20B8FF
//   const amber   = [255,209,102];  // #FFD166
//   const yellow  = [248,225,108];  // #F8E16C
//   const red     = [255,107,107];  // #FF6B6B

//   function heatColor(t){
//     t = Math.max(0, Math.min(1, t));
//     if (HEAT_SCHEME === 'yellow-red') {
//       const m = 0.55;
//       return t < m ? mix(yellow, amber, t/m)
//                    : mix(amber,  red,   (t-m)/(1-m));
//     } else {
//       const m = 0.6;
//       return t < m ? mix(blue,   yellow, t/m)
//                    : mix(yellow, red,    (t-m)/(1-m));
//     }
//   }

//   // ---- API "gioco" principale ----
//   function set(health01, heat01, score, { overheated=false } = {}) {
//     const h = Math.max(0, Math.min(1, health01 ?? 1));
//     const t = Math.max(0, Math.min(1, heat01   ?? 0));

//     // Health
//     els.healthFill.style.width = `${h*100}%`;
//     els.healthText.textContent = Math.round(h*100);

//     // Heat
//     els.heatFill.style.width = `${t*100}%`;
//     els.heatText.textContent = `${Math.round(t*100)}%`;
//     els.heatMeter.classList.toggle('over', !!overheated);

//     if (!overheated) {
//       const col = heatColor(t);
//       els.heatFill.style.setProperty('--heat-color', col);
//     }

//     // Score
//     els.scoreText.textContent = String(score ?? 0);
//   }

//   // ---- API "debug ghost" ----
//   function setDebug({ state='inactive', threshold=1, exposure=0, dist=0 } = {}) {
//     // badge testo + classi
//     els.gState.textContent = String(state);
//     els.gState.classList.remove('badge-inactive', 'badge-appearing', 'badge-active', 'badge-cleansing');
//     els.gState.classList.add(
//       state === 'appearing' ? 'badge-appearing' :
//       state === 'active'    ? 'badge-active'    :
//       state === 'cleansing' ? 'badge-cleansing' : 'badge-inactive'
//     );

//     // numeri
//     els.gThr.textContent  = `thr: ${(+threshold).toFixed(2)}`;
//     els.gExp.textContent  = `exp: ${(+exposure).toFixed(2)}`;
//     els.gDist.textContent = `d: ${(+dist).toFixed(2)}m`;
//   }

//   set(1, 0, 0); // iniziale
//   setDebug();   // iniziale
//   return { root, set, setDebug };
// }


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
        min-width: 320px;
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
      .hud-caption{ color: var(--hud-muted); opacity:.9; }
      .hud-sep{ height:6px; }

      .hud-badge{
        padding: 2px 8px; border-radius: 999px;
        font-weight: 700; font-size: 12px; letter-spacing:.2px;
        background: #33415566; color: #cbd5e1;
        text-transform: lowercase;
      }
      .badge-inactive{ background:#47556944; color:#cbd5e1; }
      .badge-appearing{ background:#f59e0b33; color:#f8e16c; }
      .badge-active{ background:#10b98133; color:#18c08f; }
      .badge-cleansing{ background:#ef444433; color:#ff6b6b; }

      .hud-rightstack{
        display:flex; align-items:center; gap:10px; justify-content:flex-end;
        min-width: 200px;
      }
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

    <div class="hud-row">
      <div class="hud-label">
        <span class="hud-icon">👻</span>
        <span>Ghost</span>
      </div>
      <div class="hud-rightstack">
        <span id="hud-ghost-state" class="hud-badge badge-inactive">inactive</span>
        <span class="hud-value" id="hud-ghost-thr" title="uThreshold">thr: 1.00</span>
        <span class="hud-value" id="hud-ghost-exp" title="exposure">exp: 0.00</span>
        <span class="hud-value" id="hud-ghost-dist" title="dist to target (XZ)">d: 0.00m</span>
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
    gState:     root.querySelector('#hud-ghost-state'),
    gThr:       root.querySelector('#hud-ghost-thr'),
    gExp:       root.querySelector('#hud-ghost-exp'),
    gDist:      root.querySelector('#hud-ghost-dist'),
  };

  const hex = (r,g,b)=>'#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
  const lerp = (a,b,t)=>a+(b-a)*t;
  const mix = (c1,c2,t)=>hex(
    Math.round(lerp(c1[0],c2[0],t)),
    Math.round(lerp(c1[1],c2[1],t)),
    Math.round(lerp(c1[2],c2[2],t))
  );
  const blue    = [32,184,255];
  const amber   = [255,209,102];
  const yellow  = [248,225,108];
  const red     = [255,107,107];

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

  function setDebug({ state='inactive', threshold=1, exposure=0, dist=0 } = {}) {
    els.gState.textContent = String(state);
    els.gState.classList.remove('badge-inactive', 'badge-appearing', 'badge-active', 'badge-cleansing');
    els.gState.classList.add(
      state === 'appearing' ? 'badge-appearing' :
      state === 'active'    ? 'badge-active'    :
      state === 'cleansing' ? 'badge-cleansing' : 'badge-inactive'
    );

    els.gThr.textContent  = `thr: ${(+threshold).toFixed(2)}`;
    els.gExp.textContent  = `exp: ${(+exposure).toFixed(2)}`;
    els.gDist.textContent = `d: ${(+dist).toFixed(2)}m`;
  }

  set(1, 0, 0);
  setDebug();
  return { root, set, setDebug };
}
