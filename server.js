#!/usr/bin/env node
/* =====================================================================
   DERNIER SIGNAL — serveur de jeu
   Aucune dépendance : il suffit d'avoir Node.js 18 ou plus récent.
   Lancer :  node server.js        (port 8080 par défaut, ou PORT=3000)
   ===================================================================== */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const PORT = parseInt(process.env.PORT, 10) || 8080;
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'parties.json');
const MAX_DOC = 256 * 1024;          // taille max d'un document
const MAX_BODY = 600 * 1024;         // taille max d'une requête
const MAX_DOCS = 60000;              // garde-fou mémoire
const GAME_TTL = 3 * 24 * 3600e3;    // une partie inactive est effacée après 3 jours

/* ---------- stockage ---------- */
let store = new Map();   // chemin -> { d: objet, t: date }
let owners = {};
let board = {};          // classement : identifiant -> { nom, victoires, parties… }         // code de partie -> identifiant de l'hôte
let pids = {};           // identifiant joueur -> empreinte de son jeton secret
try {
  const j = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  store = new Map(Object.entries(j.store || {})); owners = j.owners || {}; pids = j.pids || {}; board = j.board || {};
  console.log('  ' + store.size + ' documents rechargés.');
} catch { /* premier lancement */ }
let dirty = false;
setInterval(() => {
  if (!dirty) return; dirty = false;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE + '.tmp', JSON.stringify({ store: Object.fromEntries(store), owners, pids, board }));
    fs.renameSync(DATA_FILE + '.tmp', DATA_FILE);
  } catch (err) { console.error('Sauvegarde impossible :', err.message); }
}, 3000);
function cleanup() {
  const t = Date.now();
  for (const [k, v] of store) {
    const s = k.split('/');
    if (s.length === 2 && s[0] === 'ds' && t - v.t > GAME_TTL) {
      for (const k2 of [...store.keys()]) if (k2 === k || k2.startsWith(k + '/')) store.delete(k2);
      delete owners[s[1]]; dirty = true;
    }
  }
}
setInterval(cleanup, 3600e3); cleanup();

/* ---------- règles d'accès ----------
   ds/CODE            : état public de la partie (tout le monde lit, seul l'hôte écrit)
   ds/CODE/in/JOUEUR  : boîte privée d'un joueur (lui seul lit, seul l'hôte écrit)
   ds/CODE/pl/JOUEUR  : messages d'un joueur vers l'hôte (lui et l'hôte lisent, lui seul écrit)
   Rien d'autre n'est accessible.                                                          */
const SEG = /^[A-Za-z0-9_\-.~:@+]{1,200}$/;
function validPath(p, kind) {
  if (typeof p !== 'string' || p.length > 1000) return false;
  const s = p.split('/');
  if (s.length > 16 || !s.every(x => SEG.test(x) && x !== '.' && x !== '..')) return false;
  return kind === 'doc' ? s.length % 2 === 0 : s.length % 2 === 1;
}
function canRead(pid, p) {
  const s = p.split('/'); if (s[0] !== 'ds' || s.length < 2) return false;
  const owner = owners[s[1]];
  if (s.length === 2) return true;
  if (s[2] === 'in') return s.length === 4 && s[3] === pid;
  if (s[2] === 'pl') return pid === owner || (s.length === 4 && s[3] === pid);
  return false;
}
function canWrite(pid, p) {
  const s = p.split('/'); if (s[0] !== 'ds' || s.length < 2) return false;
  const owner = owners[s[1]];
  if (s.length === 2) return !owner || owner === pid;
  if (s.length !== 4) return false;
  if (s[2] === 'in') return owner === pid;
  if (s[2] === 'pl') return s[3] === pid;
  return false;
}
const hash = t => crypto.createHash('sha256').update(String(t)).digest('hex');
function auth(pid, token) { return typeof pid === 'string' && SEG.test(pid) && pids[pid] && pids[pid] === hash(token); }

/* ---------- temps réel (Server-Sent Events) ---------- */
const conns = new Map(); // cid -> { res, pid, subs: Map }
function emit(conn, event, data) { try { conn.res.write('event: ' + event + '\ndata: ' + JSON.stringify(data) + '\n\n'); } catch { /* fermé */ } }
function snapDoc(pid, p) {
  const v = canRead(pid, p) ? store.get(p) : null;
  return { id: p.split('/').pop(), exists: !!v, data: v ? v.d : null };
}
function snapCol(pid, p) {
  if (!canRead(pid, p)) return [];
  const pre = p + '/'; const out = [];
  for (const k of store.keys()) if (k.startsWith(pre) && k.indexOf('/', pre.length) === -1 && canRead(pid, k)) out.push(snapDoc(pid, k));
  return out.sort((a, b) => (a.id < b.id ? -1 : 1));
}
function notify(p) {
  const parent = p.split('/').slice(0, -1).join('/');
  for (const c of conns.values()) for (const [id, s] of c.subs) {
    if (s.kind === 'doc' && s.path === p) emit(c, 'snap', { id, payload: snapDoc(c.pid, p) });
    else if (s.kind === 'col' && s.path === parent) emit(c, 'snap', { id, payload: snapCol(c.pid, parent) });
  }
}

/* ---------- positions en 3D (non sauvegardées) ---------- */
const rooms = new Map(); // code -> { all: {pid: état}, dirty }
function roomOf(code) { let r = rooms.get(code); if (!r) { r = { all: {}, seen: {}, dirty: false }; rooms.set(code, r); } return r; }
setInterval(() => {
  const t = Date.now();
  for (const [code, r] of rooms) {
    for (const pid of Object.keys(r.all)) if (t - (r.seen[pid] || 0) > 20000) { delete r.all[pid]; delete r.seen[pid]; r.dirty = true; }
    if (!r.dirty) continue; r.dirty = false;
    for (const c of conns.values()) if (c.room === code) emit(c, 'pos', { all: r.all });
    if (!Object.keys(r.all).length) rooms.delete(code);
  }
}, 150);
const cleanPos = s => s && typeof s === 'object' && typeof s.pid === 'string' && SEG.test(s.pid) ? { pid: s.pid, x: +s.x || 0, z: +s.z || 0, r: +s.r || 0, w: s.w ? 1 : 0, s: Array.isArray(s.s) ? s.s.slice(0, 9).map(n => Math.max(0, Math.min(255, n | 0))) : null, em: typeof s.em === 'string' && /^[a-z0-9]{1,16}$/.test(s.em) ? s.em : undefined, et: +s.et || 0 } : null;

/* ---------- chat vocal : relais de signalisation WebRTC (le son passe directement entre joueurs) ---------- */
function voicePeers(code, except) { const out = []; for (const c of conns.values()) if (c.vroom === code && c !== except) out.push(c); return out; }
function voiceBye(conn) { const code = conn.vroom; conn.vroom = null; if ([...conns.values()].some(c => c.vroom === code && c.pid === conn.pid)) return; for (const c of voicePeers(code, conn)) emit(c, 'rtc', { from: conn.pid, data: { t: 'bye' } }); }

/* ---------- bots intelligents (facultatif) : si une clé ANTHROPIC_API_KEY est fournie, les bots réfléchissent avec Claude ---------- */
const AI_KEY = process.env.ANTHROPIC_API_KEY || '';
const AI_MODEL = process.env.AI_MODEL || 'claude-haiku-5-5';
const aiUse = new Map(); // code -> { n, since, busy }
async function aiAsk(code, prompt) {
  const u = aiUse.get(code) || { n: 0, since: Date.now(), busy: 0 }; aiUse.set(code, u);
  if (Date.now() - u.since > 3600e3) { u.n = 0; u.since = Date.now(); }
  if (u.n >= 400 || u.busy >= 2) throw Object.assign(new Error('rate'), { code: 'rate_limited' });
  u.n++; u.busy++;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': AI_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: AI_MODEL, max_tokens: 300, messages: [{ role: 'user', content: String(prompt).slice(0, 12000) }] }), signal: AbortSignal.timeout(20000) });
    const j = await r.json(); if (!r.ok) throw Object.assign(new Error('ai'), { code: 'unavailable', detail: j && j.error && j.error.message });
    return (j.content || []).map(c => c.text || '').join('');
  } finally { u.busy--; }
}


/* ---------- comptes joueurs (pseudo + mot de passe) ----------
   Le navigateur n'envoie jamais le mot de passe : il envoie une empreinte (PBKDF2), que le serveur
   protège encore avec scrypt. Stockage : Upstash Redis si UPSTASH_REDIS_REST_URL et _TOKEN sont fournis
   (permanent, gratuit), sinon un fichier data/comptes.json (effacé à chaque redémarrage sur l'offre
   gratuite de Render : les appareils déjà connectés restaurent alors le compte automatiquement). */
const ACC_FILE = path.join(DATA_DIR, 'comptes.json');
const UP_URL = process.env.UPSTASH_REDIS_REST_URL || '', UP_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';
let accLocal = {}; try { accLocal = JSON.parse(fs.readFileSync(ACC_FILE, 'utf8')); } catch {}
let accDirty = false; setInterval(() => { if (!accDirty) return; accDirty = false; try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(ACC_FILE + '.tmp', JSON.stringify(accLocal)); fs.renameSync(ACC_FILE + '.tmp', ACC_FILE); } catch (e) { console.error('comptes', e.message); } }, 3000);
async function upstash(cmd) { const r = await fetch(UP_URL, { method: 'POST', headers: { authorization: 'Bearer ' + UP_TOKEN, 'content-type': 'application/json' }, body: JSON.stringify(cmd), signal: AbortSignal.timeout(8000) }); const j = await r.json(); if (!r.ok || j.error) throw new Error(j.error || 'upstash'); return j.result; }
async function accGet(k) { if (UP_URL) { const v = await upstash(['GET', 'acc:' + k]); return v ? JSON.parse(v) : null; } return accLocal[k] || null; }
async function accPut(k, v) { if (UP_URL) { await upstash(['SET', 'acc:' + k, JSON.stringify(v)]); return; } accLocal[k] = v; accDirty = true; }
const accKey = u => typeof u === 'string' ? u.normalize('NFC').trim().toLowerCase() : '';
const NAME_RX = /^[\p{L}\p{N}_\-. ]{3,16}$/u;
const scryptHash = (v, salt) => crypto.scryptSync(String(v), salt, 32).toString('base64');
const tries = new Map(); // limite de tentatives par adresse
function tooMany(ip) { const t = Date.now(); const x = (tries.get(ip) || []).filter(z => t - z < 10 * 60e3); x.push(t); tries.set(ip, x); return x.length > 20; }
async function account(req, res) {
  let b; try { b = await readBody(req); } catch { return json(res, 400, { code: 'invalid_argument' }); }
  const op = b.op; const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0];
  if (op === 'info') return json(res, 200, { result: { persistent: !!UP_URL } });
  const name = typeof b.user === 'string' ? b.user.normalize('NFC').trim() : ''; const k = accKey(name);
  if (!NAME_RX.test(name)) return json(res, 400, { code: 'bad_name', error: 'Pseudo : 3 à 16 lettres ou chiffres.' });
  const okProf = p => p && typeof p === 'object' && JSON.stringify(p).length < 250000;
  const newToken = acc => { const t = crypto.randomBytes(24).toString('base64url'); acc.tokens = [hash(t), ...(acc.tokens || [])].slice(0, 8); return t; };
  const okToken = (acc, t) => typeof t === 'string' && (acc.tokens || []).includes(hash(t));
  try {
    if (op === 'register' || op === 'restore') {
      if (tooMany(ip)) return json(res, 429, { code: 'rate_limited', error: 'Trop d’essais, réessaie dans quelques minutes.' });
      if (typeof b.verifier !== 'string' || b.verifier.length < 20) return json(res, 400, { code: 'invalid_argument' });
      const cur = await accGet(k);
      if (cur) { if (op === 'restore' && scryptHash(b.verifier, cur.salt) === cur.hash) { const token = newToken(cur); await accPut(k, cur); return json(res, 200, { result: { token, name: cur.name, prof: cur.prof || null, upd: cur.upd || 0 } }); } return json(res, 409, { code: 'name_taken', error: 'Ce pseudo est déjà pris.' }); }
      const salt = crypto.randomBytes(16).toString('base64'); const acc = { name, salt, hash: scryptHash(b.verifier, salt), prof: okProf(b.prof) ? b.prof : null, upd: Date.now(), created: Date.now() };
      const token = newToken(acc); await accPut(k, acc); return json(res, 200, { result: { token, name, prof: acc.prof, upd: acc.upd } });
    }
    if (op === 'login') {
      if (tooMany(ip)) return json(res, 429, { code: 'rate_limited', error: 'Trop d’essais, réessaie dans quelques minutes.' });
      const acc = await accGet(k); if (!acc || typeof b.verifier !== 'string' || scryptHash(b.verifier, acc.salt) !== acc.hash) return json(res, 403, { code: 'bad_login', error: 'Pseudo ou mot de passe incorrect.' });
      const token = newToken(acc); await accPut(k, acc); return json(res, 200, { result: { token, name: acc.name, prof: acc.prof || null, upd: acc.upd || 0 } });
    }
    const acc = await accGet(k); if (!acc) return json(res, 404, { code: 'unknown_account' });
    if (!okToken(acc, b.token)) return json(res, 403, { code: 'bad_token', error: 'Session expirée : reconnecte-toi.' });
    if (op === 'load') return json(res, 200, { result: { name: acc.name, prof: acc.prof || null, upd: acc.upd || 0 } });
    if (op === 'save') { if (!okProf(b.prof)) return json(res, 400, { code: 'invalid_argument' }); acc.prof = b.prof; acc.upd = Date.now(); await accPut(k, acc); return json(res, 200, { result: { upd: acc.upd } }); }
    if (op === 'logout') { acc.tokens = (acc.tokens || []).filter(x => x !== hash(b.token)); await accPut(k, acc); return json(res, 200, { result: null }); }
    if (op === 'password') { if (typeof b.verifier !== 'string' || b.verifier.length < 20) return json(res, 400, { code: 'invalid_argument' }); acc.salt = crypto.randomBytes(16).toString('base64'); acc.hash = scryptHash(b.verifier, acc.salt); const token = newToken(acc); acc.tokens = [acc.tokens[0]]; await accPut(k, acc); return json(res, 200, { result: { token } }); }
  } catch (e) { console.error('compte', e.message); return json(res, 503, { code: 'unavailable', error: 'Sauvegarde indisponible pour le moment.' }); }
  return json(res, 400, { code: 'invalid_argument' });
}

/* ---------- HTTP ---------- */
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon' };
function json(res, code, obj) { res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(obj)); }
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > MAX_BODY) { reject(new Error('too_big')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch { reject(new Error('bad_json')); } });
    req.on('error', reject);
  });
}
async function api(req, res, url) {
  if (url.pathname.endsWith('/api/ping')) return json(res, 200, { ds: true, v: 1 });
  if (url.pathname.endsWith('/api/hello') && req.method === 'POST') {
    const b = await readBody(req);
    if (typeof b.pid !== 'string' || !SEG.test(b.pid) || typeof b.token !== 'string' || b.token.length < 16) return json(res, 400, { code: 'invalid_argument' });
    const h = hash(b.token);
    if (pids[b.pid] && pids[b.pid] !== h) return json(res, 409, { code: 'pid_taken' });
    if (!pids[b.pid]) { pids[b.pid] = h; dirty = true; }
    return json(res, 200, { ok: true });
  }
  if (url.pathname.endsWith('/api/stream')) {
    const pid = url.searchParams.get('pid'), token = url.searchParams.get('token');
    if (!auth(pid, token)) return json(res, 401, { code: 'not_granted' });
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache, no-transform', connection: 'keep-alive', 'x-accel-buffering': 'no' });
    res.write('retry: 2000\n\n');
    const cid = crypto.randomBytes(9).toString('base64url');
    const conn = { res, pid, subs: new Map() }; conns.set(cid, conn);
    emit(conn, 'hello', { cid });
    const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch {} }, 20000);
    req.on('close', () => { clearInterval(ping); conns.delete(cid); if (conn.vroom) voiceBye(conn); });
    return;
  }
  if (url.pathname.endsWith('/api/account') && req.method === 'POST') return account(req, res);
  if (url.pathname.endsWith('/api/op') && req.method === 'POST') {
    const pid = req.headers['x-ds-pid'], token = req.headers['x-ds-token'];
    if (!auth(pid, token)) return json(res, 401, { code: 'not_granted', error: 'Identité inconnue' });
    let b; try { b = await readBody(req); } catch (err) { return json(res, 413, { code: 'invalid_argument', error: err.message }); }
    const p = b.path;
    switch (b.op) {
      case 'get': if (!validPath(p, 'doc')) return json(res, 400, { code: 'invalid_argument' }); return json(res, 200, { result: snapDoc(pid, p) });
      case 'getcol': if (!validPath(p, 'col')) return json(res, 400, { code: 'invalid_argument' }); return json(res, 200, { result: snapCol(pid, p) });
      case 'set': {
        if (!validPath(p, 'doc') || !b.data || typeof b.data !== 'object' || Array.isArray(b.data)) return json(res, 400, { code: 'invalid_argument' });
        if (!canWrite(pid, p)) return json(res, 403, { code: 'invalid_argument', error: 'Écriture refusée' });
        if (JSON.stringify(b.data).length > MAX_DOC) return json(res, 400, { code: 'invalid_argument', error: 'Document trop gros' });
        if (!store.has(p) && store.size >= MAX_DOCS) { cleanup(); if (store.size >= MAX_DOCS) return json(res, 507, { code: 'quota_exceeded' }); }
        const s = p.split('/');
        if (s.length === 2 && !owners[s[1]]) owners[s[1]] = pid;
        store.set(p, { d: b.data, t: Date.now() });
        if (s.length > 2 && store.has(s[0] + '/' + s[1])) store.get(s[0] + '/' + s[1]).t = Date.now();
        dirty = true; notify(p);
        return json(res, 200, { result: null });
      }
      case 'delete':
        if (!validPath(p, 'doc') || !canWrite(pid, p)) return json(res, 403, { code: 'invalid_argument' });
        store.delete(p); dirty = true; notify(p); return json(res, 200, { result: null });
      case 'sub': {
        const conn = conns.get(b.cid);
        if (!conn || conn.pid !== pid) return json(res, 409, { code: 'unavailable', error: 'Flux non connecté' });
        if (!validPath(p, b.kind === 'col' ? 'col' : 'doc') || conn.subs.size > 64) return json(res, 400, { code: 'invalid_argument' });
        conn.subs.set(b.subId, { path: p, kind: b.kind === 'col' ? 'col' : 'doc' });
        emit(conn, 'snap', { id: b.subId, payload: b.kind === 'col' ? snapCol(pid, p) : snapDoc(pid, p) });
        return json(res, 200, { result: null });
      }
      case 'pos': {
        const code = typeof b.code === 'string' && SEG.test(b.code) ? b.code : null; if (!code || !store.has('ds/' + code)) return json(res, 400, { code: 'invalid_argument' });
        const conn = conns.get(b.cid); if (conn && conn.pid === pid) { if (conn.room !== code) { conn.room = code; emit(conn, 'pos', { all: roomOf(code).all }); } }
        const r = roomOf(code); const t = Date.now();
        const me = cleanPos(b.s); if (me && me.pid === pid) { r.all[pid] = me; r.seen[pid] = t; r.dirty = true; }
        if (Array.isArray(b.b) && owners[code] === pid) for (const bs of b.b.slice(0, 16)) { const c = cleanPos(bs); if (c && c.pid.startsWith('bot-')) { r.all[c.pid] = c; r.seen[c.pid] = t; r.dirty = true; } }
        return json(res, 200, { result: null });
      }
      case 'vjoin': case 'vleave': {
        const conn = conns.get(b.cid); const code = typeof b.code === 'string' && SEG.test(b.code) ? b.code : null;
        if (!conn || conn.pid !== pid || !code || !store.has('ds/' + code)) return json(res, 400, { code: 'invalid_argument' });
        if (b.op === 'vleave') { if (conn.vroom) voiceBye(conn); return json(res, 200, { result: null }); }
        if (conn.vroom && conn.vroom !== code) voiceBye(conn);
        conn.vroom = code;
        for (const c of voicePeers(code, conn)) if (c.pid !== pid) emit(c, 'rtc', { from: pid, data: { t: 'hello' } });
        return json(res, 200, { result: null });
      }
      case 'rtc': {
        const conn = conns.get(b.cid); if (!conn || conn.pid !== pid || !conn.vroom) return json(res, 409, { code: 'unavailable' });
        if (typeof b.to !== 'string' || !SEG.test(b.to) || !b.data || typeof b.data !== 'object' || JSON.stringify(b.data).length > 20000) return json(res, 400, { code: 'invalid_argument' });
        for (const c of voicePeers(conn.vroom, conn)) if (c.pid === b.to) emit(c, 'rtc', { from: pid, data: b.data });
        return json(res, 200, { result: null });
      }
      case 'lbset': {
        const d = b.d || {}; const nm = typeof d.name === 'string' ? d.name.replace(/[\u0000-\u001f]/g, '').slice(0, 16) : ''; if (!nm) return json(res, 400, { code: 'invalid_argument' });
        const n = v => Math.max(0, Math.min(1e6, v | 0)); const w = s2 => typeof s2 === 'string' && /^[a-z0-9]{0,20}$/.test(s2) ? s2 : '';
        board[pid] = { name: nm, games: n(d.games), wins: n(d.wins), best: n(d.best), lvl: n(d.lvl), title: w(d.title), badge: w(d.badge), t: Date.now() }; dirty = true;
        const keys = Object.keys(board); if (keys.length > 500) { keys.sort((a, c) => board[a].wins - board[c].wins).slice(0, keys.length - 500).forEach(k => delete board[k]); }
        return json(res, 200, { result: null });
      }
      case 'lbget': return json(res, 200, { result: Object.values(board).sort((a, c) => c.wins - a.wins || c.games - a.games).slice(0, 50) });
      case 'aiinfo': return json(res, 200, { result: { ai: !!AI_KEY } });
      case 'ai': {
        const code = typeof b.code === 'string' && SEG.test(b.code) ? b.code : null;
        if (!AI_KEY) return json(res, 409, { code: 'unavailable' });
        if (!code || owners[code] !== pid || typeof b.prompt !== 'string') return json(res, 403, { code: 'permission_denied' });
        try { return json(res, 200, { result: { text: await aiAsk(code, b.prompt) } }); }
        catch (e) { return json(res, e.code === 'rate_limited' ? 429 : 502, { code: e.code || 'unavailable' }); }
      }
      case 'unsub': { const conn = conns.get(b.cid); if (conn) conn.subs.delete(b.subId); return json(res, 200, { result: null }); }
    }
    return json(res, 400, { code: 'invalid_argument' });
  }
  return json(res, 404, { code: 'not_found' });
}
function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end(); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); return res.end('Introuvable'); }
    const ext = path.extname(file).toLowerCase();
    const long = /\/(cards|icons)\//.test(rel) || ext === '.png' || ext === '.webp';
    res.writeHead(200, { 'content-type': TYPES[ext] || 'application/octet-stream', 'cache-control': long ? 'public, max-age=86400' : 'no-cache', 'x-content-type-options': 'nosniff' });
    fs.createReadStream(file).pipe(res);
  });
}
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    if (url.pathname.includes('/api/')) return await api(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
    serveStatic(req, res, url);
  } catch (err) { console.error(err); if (!res.headersSent) json(res, 500, { code: 'unavailable' }); }
});
server.listen(PORT, HOST, () => {
  const lan = Object.values(os.networkInterfaces()).flat().filter(i => i && i.family === 'IPv4' && !i.internal).map(i => 'http://' + i.address + ':' + PORT);
  console.log('\n  DERNIER SIGNAL est en ligne.\n');
  console.log('  Sur cet ordinateur :   http://localhost:' + PORT);
  for (const u of lan) console.log('  Sur le réseau local :  ' + u);
  console.log('\n  Laisse cette fenêtre ouverte pendant la partie. Ctrl+C pour arrêter.\n');
});
function shutdown() { try { if (dirty) { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(DATA_FILE, JSON.stringify({ store: Object.fromEntries(store), owners, pids, board })); } } catch {} process.exit(0); }
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
