(function () {
  const STORE_KEY = "kk_praesenz_cfg_v2";
  let cfg = loadCfg();
  let source = "door";
  let pollTimer = null;

  const $ = (id) => document.getElementById(id);

  function loadCfg() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || "{}"); }
    catch (e) { return {}; }
  }
  function saveCfg() {
    localStorage.setItem(STORE_KEY, JSON.stringify(cfg));
  }

  function toast(msg) {
    const el = $("toast");
    el.textContent = msg;
    el.classList.remove("hidden");
    requestAnimationFrame(() => el.classList.add("show"));
    clearTimeout(toast._t);
    toast._t = setTimeout(() => {
      el.classList.remove("show");
      setTimeout(() => el.classList.add("hidden"), 220);
    }, 2200);
  }

  function baseUrl() {
    return (cfg.url || "").replace(/\/+$/, "");
  }

  function authHeader() {
    if (!cfg.user) return {};
    const token = btoa(unescape(encodeURIComponent(cfg.user + ":" + (cfg.pass || ""))));
    return { Authorization: "Basic " + token };
  }

  async function api(path, opts) {
    const url = baseUrl() + path;
    const headers = Object.assign(
      { "Content-Type": "application/json" },
      authHeader(),
      (opts && opts.headers) || {}
    );
    const res = await fetch(url, Object.assign({}, opts || {}, { headers }));
    if (res.status === 401) throw new Error("Login fehlgeschlagen (401)");
    if (!res.ok) {
      let detail = "";
      try { const j = await res.json(); detail = j.error || JSON.stringify(j); } catch (e) {}
      throw new Error(detail || ("HTTP " + res.status));
    }
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) return res.json();
    return res.text();
  }

  function showSetup(err) {
    $("view-main").classList.add("hidden");
    $("view-setup").classList.remove("hidden");
    if (cfg.url) $("cfgUrl").value = cfg.url;
    if (cfg.user) $("cfgUser").value = cfg.user;
    if (cfg.pass) $("cfgPass").value = cfg.pass;
    $("setupErr").textContent = err || "";
    setConnectLoading(false);
    stopPoll();
  }

  function showMain() {
    $("view-setup").classList.add("hidden");
    $("view-main").classList.remove("hidden");
    $("connMetaTxt").textContent = baseUrl().replace(/^https?:\/\//, "");
    startPoll();
    refresh();
  }

  function setConnectLoading(on) {
    const btn = $("btnConnect");
    const label = btn.querySelector(".btn-label");
    const spin = btn.querySelector(".btn-spinner");
    btn.disabled = on;
    if (on) {
      label.textContent = "Verbinde\u2026";
      spin.classList.remove("hidden");
    } else {
      label.textContent = "Verbinden";
      spin.classList.add("hidden");
    }
  }

  async function connect() {
    cfg.url = ($("cfgUrl").value || "").trim();
    cfg.user = ($("cfgUser").value || "").trim();
    cfg.pass = $("cfgPass").value || "";
    if (!cfg.url) {
      $("setupErr").textContent = "Bitte Server-URL angeben";
      return;
    }
    if (!/^https?:\/\//i.test(cfg.url)) cfg.url = "http://" + cfg.url;
    $("setupErr").textContent = "";
    setConnectLoading(true);
    try {
      await api("/api/door/status");
      saveCfg();
      showMain();
      toast("Verbunden");
    } catch (e) {
      $("setupErr").textContent = e.message || String(e);
    } finally {
      setConnectLoading(false);
    }
  }

  function setSource(src) {
    source = src;
    document.querySelectorAll(".seg-btn").forEach((t) => {
      const on = t.dataset.src === src;
      t.classList.toggle("active", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
    });
    const pill = $("segPill");
    if (pill) pill.classList.toggle("right", src === "ld2450");
    $("panel-door").classList.toggle("hidden", src !== "door");
    $("panel-ld2450").classList.toggle("hidden", src !== "ld2450");
    refresh();
  }

  function setOnline(elPill, elTxt, online) {
    elPill.className = "status-pill " + (online ? "on" : "off");
    elTxt.textContent = online ? "online" : "offline";
  }

  async function refreshDoor() {
    const d = await api("/api/door/status");
    $("doorInside").textContent = d.inside != null ? d.inside : "\u2013";
    $("doorIn").textContent = d.in_total != null ? d.in_total : "\u2013";
    $("doorOut").textContent = d.out_total != null ? d.out_total : "\u2013";
    setOnline($("doorOnline"), $("doorOnlineTxt"), !!d.online);
    const pct = d.load_pct != null ? Math.min(100, d.load_pct) : 0;
    $("doorLoad").style.width = pct + "%";
    $("doorLoadTxt").textContent = d.capacity
      ? ("Auslastung " + pct + "% \u00b7 Kapazit\u00e4t " + d.capacity)
      : "Auslastung \u2013";
    $("doorUpdated").textContent = d.ts ? formatTs(d.ts) : "\u2013";
    $("doorEsp").textContent = [
      d.ip ? ("IP " + d.ip) : null,
      d.fw ? ("FW " + d.fw) : null,
      d.ts ? ("Stand " + formatTs(d.ts)) : null
    ].filter(Boolean).join(" \u00b7 ") || "Kein ESP-Status";

    try {
      const g = await api("/api/door/groups?days=30");
      renderGroups(g);
    } catch (e) {
      $("doorGroups").textContent = "Gruppen nicht ladbar";
    }
  }

  function renderGroups(g) {
    const list = (g && g.groups) || [];
    const active = g && g.active;
    if (!list.length && !active) {
      $("doorGroups").textContent = "Keine Gruppen-Besuche";
      return;
    }
    let html = "";
    if (active) {
      html += '<div class="group-item group-active"><span class="group-left">Jetzt aktiv \u00b7 Spitze ' +
        escapeHtml(active.peak) + '</span><span class="group-right">' +
        (active.inside_now != null ? active.inside_now + " Pers." : "") + "</span></div>";
    }
    list.slice(0, 8).forEach((it) => {
      const label = it.label || "Gruppe";
      html += '<div class="group-item"><span class="group-left">' + escapeHtml(label) +
        " \u00b7 " + formatTs(it.start) + '</span><span class="group-right">' +
        (it.peak || "?") + " Pers. \u00b7 " + (it.duration_min || "?") + " min</span></div>";
    });
    $("doorGroups").innerHTML = html;
  }

  async function refreshRadar() {
    const d = await api("/api/radar/status");
    $("radarPersons").textContent = d.persons != null ? d.persons : "\u2013";
    setOnline($("radarOnline"), $("radarOnlineTxt"), !!d.online);
    $("radarUpdated").textContent = d.ts ? formatTs(d.ts) : "\u2013";
    $("radarEsp").textContent = [
      d.ip ? ("IP " + d.ip) : null,
      d.fw ? ("FW " + d.fw) : null,
      d.ts ? ("Stand " + formatTs(d.ts)) : null
    ].filter(Boolean).join(" \u00b7 ") || "Kein ESP-Status";
    drawRadar(d);
  }

  function drawRadar(d) {
    const c = $("radarCanvas");
    const ctx = c.getContext("2d");
    const w = c.width, h = c.height;
    ctx.clearRect(0, 0, w, h);
    const bg = ctx.createRadialGradient(w/2, h/2, 10, w/2, h/2, w*0.55);
    bg.addColorStop(0, "#151820");
    bg.addColorStop(1, "#090a0d");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    const room = d.room || { w: 10, h: 8 };
    const rw = room.w || 10, rh = room.h || 8;
    const pad = 28;
    const scale = Math.min((w - pad * 2) / rw, (h - pad * 2) / rh);
    const ox = (w - rw * scale) / 2;
    const oy = (h - rh * scale) / 2;
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= rw; i++) {
      const x = ox + i * scale;
      ctx.beginPath(); ctx.moveTo(x, oy); ctx.lineTo(x, oy + rh * scale); ctx.stroke();
    }
    for (let j = 0; j <= rh; j++) {
      const y = oy + j * scale;
      ctx.beginPath(); ctx.moveTo(ox, y); ctx.lineTo(ox + rw * scale, y); ctx.stroke();
    }
    ctx.strokeStyle = "rgba(100,210,255,0.35)";
    ctx.lineWidth = 2;
    ctx.strokeRect(ox, oy, rw * scale, rh * scale);
    const origin = d.origin || { x: rw / 2, y: 0 };
    const sx = ox + (origin.x || 0) * scale;
    const sy = oy + (origin.y || 0) * scale;
    ctx.fillStyle = "#0a84ff";
    ctx.beginPath(); ctx.arc(sx, sy, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(10,132,255,0.2)";
    ctx.beginPath(); ctx.arc(sx, sy, 14, 0, Math.PI * 2); ctx.fill();
    const targets = d.targets || [];
    targets.forEach((t, i) => {
      const x = ox + (Number(t.x) || 0) * scale;
      const y = oy + (Number(t.y) || 0) * scale;
      ctx.fillStyle = "rgba(48,209,88,0.2)";
      ctx.beginPath(); ctx.arc(x, y, 16, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#30d158";
      ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "600 12px -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(i + 1), x, y + 0.5);
    });
    if (!targets.length) {
      ctx.fillStyle = "rgba(142,142,147,0.9)";
      ctx.font = "500 14px -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Keine Ziele erkannt", w / 2, h / 2);
    }
  }

  async function refresh() {
    try {
      if (source === "door") await refreshDoor();
      else await refreshRadar();
    } catch (e) {
      toast(e.message || String(e));
      if (String(e.message || "").includes("401")) showSetup("Bitte erneut anmelden");
    }
  }

  async function adjust(delta) {
    try {
      await api("/api/door/adjust", { method: "POST", body: JSON.stringify({ delta: delta }) });
      toast(delta > 0 ? "Belegung +1" : "Belegung \u22121");
      await refreshDoor();
    } catch (e) { toast(e.message || String(e)); }
  }

  async function resetDoor() {
    if (!confirm("Belegung auf 0 setzen?")) return;
    try {
      await api("/api/door/reset", { method: "POST", body: JSON.stringify({ value: 0 }) });
      toast("Auf 0 gesetzt");
      await refreshDoor();
    } catch (e) { toast(e.message || String(e)); }
  }

  function startPoll() {
    stopPoll();
    pollTimer = setInterval(refresh, 4000);
  }
  function stopPoll() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  }

  function formatTs(ts) {
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return String(ts).slice(0, 16);
      return d.toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    } catch (e) { return String(ts || ""); }
  }

  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[c]);
  }

  $("btnConnect").onclick = connect;
  $("btnRefresh").onclick = () => { refresh(); toast("Aktualisiert"); };
  $("btnSettings").onclick = () => showSetup("");
  $("btnPlus").onclick = () => adjust(1);
  $("btnMinus").onclick = () => adjust(-1);
  $("btnReset").onclick = resetDoor;
  document.querySelectorAll(".seg-btn").forEach((t) => {
    t.onclick = () => setSource(t.dataset.src);
  });

  ["cfgUrl", "cfgUser", "cfgPass"].forEach((id) => {
    $(id).addEventListener("keydown", (e) => {
      if (e.key === "Enter") connect();
    });
  });

  if (cfg.url) showMain();
  else showSetup("");
})();
