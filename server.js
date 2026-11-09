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
const newToken = acc => { const t = crypto.randomBytes(24).toString('base64url'); acc.tokens = [hash(t), ...(acc.tokens || [])].slice(0, 8); return t; };
const okToken = (acc, t) => typeof t === 'string' && (acc.tokens || []).includes(hash(t));
const sameStr = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

/* ---------- compte administrateur ----------
   Il n'existe que si la variable ADMIN_PASSWORD est définie sur Render (jamais dans le code).
   Pseudo : ADMIN_NAME (par défaut « admin »). Le serveur calcule la même empreinte que le navigateur. */
const ADMIN_NAME = (process.env.ADMIN_NAME || 'admin').normalize('NFC').trim();
const ADMIN_K = accKey(ADMIN_NAME);
const ADMIN_V = process.env.ADMIN_PASSWORD ? crypto.pbkdf2Sync(process.env.ADMIN_PASSWORD, 'dernier-signal:' + ADMIN_K, 150000, 32, 'sha256').toString('base64') : '';
const isAdminK = k => !!ADMIN_V && k === ADMIN_K;
const verifierOf = (name, pass) => crypto.pbkdf2Sync(String(pass), 'dernier-signal:' + accKey(name), 150000, 32, 'sha256').toString('base64');

/* ---------- réglages du site (modifiables par l'admin) ---------- */
const CFG_FILE = path.join(DATA_DIR, 'config.json');
let CFG = { codes: {}, off: {}, banner: null, motd: '', coinMul: 1, xpMul: 1, sale: 0, event: '', maint: '', welcome: [], gifts: [], upd: 0 };
async function cfgLoad() { try { const raw = UP_URL ? await upstash(['GET', 'ds:cfg']) : fs.readFileSync(CFG_FILE, 'utf8'); if (raw) CFG = Object.assign(CFG, JSON.parse(raw)); } catch (e) { if (e.code !== 'ENOENT') console.error('réglages', e.message); } }
async function cfgSave() { CFG.upd = Date.now(); if (UP_URL) await upstash(['SET', 'ds:cfg', JSON.stringify(CFG)]); else { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(CFG_FILE, JSON.stringify(CFG)); } }
cfgLoad();
const TOK_RX = /^[A-Za-z0-9_\-:.]{1,60}$/;
const cleanToks = a => Array.isArray(a) ? a.filter(t => typeof t === 'string' && TOK_RX.test(t)).slice(0, 40) : [];
const cleanStr = (v, n) => typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n) : '';
const num = (v, a, b, d) => { const x = +v; return Number.isFinite(x) ? Math.max(a, Math.min(b, x)) : d; };
const CODE_RX = /^[A-Z0-9]{2,40}$/;
const codeHash = c => crypto.createHash('sha256').update('ds-code:' + c).digest('hex').slice(0, 24);
// les codes perso restent secrets : le navigateur ne reçoit que leur empreinte, et demande le contenu au serveur quand on tape le bon code
const publicCfg = () => ({ codes: Object.entries(CFG.codes).filter(([, v]) => v.on !== false).map(([c]) => codeHash(c)), off: CFG.off, banner: CFG.banner, motd: CFG.motd, coinMul: CFG.coinMul, xpMul: CFG.xpMul, sale: CFG.sale, event: CFG.event, maint: CFG.maint, welcome: CFG.welcome, gifts: CFG.gifts, upd: CFG.upd });
async function allAccounts(q) {
  let keys = UP_URL ? (await upstash(['KEYS', 'acc:*'])).map(k => k.slice(4)) : Object.keys(accLocal);
  if (q) keys = keys.filter(k => k.includes(accKey(q)));
  keys = keys.sort().slice(0, 300); if (!keys.length) return [];
  const vals = UP_URL ? await upstash(['MGET', ...keys.map(k => 'acc:' + k)]) : keys.map(k => JSON.stringify(accLocal[k]));
  return vals.map((v, i) => { let a; try { a = JSON.parse(v); } catch { return null; } if (!a) return null; const p = a.prof || {}; const st = p.stats || {};
    return { k: keys[i], name: a.name, coins: p.coins || 0, xp: p.xp || 0, games: st.games || 0, wins: st.wins || 0, codes: Object.keys(p.codes || {}).length, house: p.house || 1, created: a.created || 0, upd: a.upd || 0, banned: !!a.banned, admin: isAdminK(keys[i]), gifts: (a.gifts || []).length }; }).filter(Boolean);
}
async function admin(req, res) {
  let b; try { b = await readBody(req); } catch { return json(res, 400, { code: 'invalid_argument' }); }
  const k = accKey(b.user); if (!isAdminK(k)) return json(res, 403, { code: 'not_admin', error: 'Réservé à l’administrateur.' });
  const me = await accGet(k); if (!me || !okToken(me, b.token)) return json(res, 403, { code: 'bad_token', error: 'Session admin expirée : reconnecte-toi.' });
  const ok = r => json(res, 200, { result: r === undefined ? Object.assign(publicCfg(), { codes: CFG.codes }) : r });
  const code = typeof b.code === 'string' ? b.code.toUpperCase().replace(/[^A-Z0-9]/g, '') : '';
  try {
    switch (b.op) {
      case 'cfg': return ok();
      case 'codeset': {
        if (!CODE_RX.test(code)) return json(res, 400, { code: 'invalid_argument', error: 'Nom du code : 2 à 40 lettres ou chiffres.' });
        const r = cleanToks(b.r); if (!r.length) return json(res, 400, { code: 'invalid_argument', error: 'Ajoute au moins une récompense.' });
        const old = CFG.codes[code] || {}; const from = num(b.from, 0, 9e15, 0), to = num(b.to, 0, 9e15, 0);
        if (b.rename && b.rename !== code && CFG.codes[b.rename]) delete CFG.codes[b.rename];
        CFG.codes[code] = { d: cleanStr(b.d, 200) || 'Code spécial', r, from, to, max: Math.round(num(b.max, 0, 1e7, 0)), uses: b.resetUses ? 0 : old.uses || 0, on: b.on !== false, at: old.at || Date.now() };
        delete CFG.off[code]; await cfgSave(); return ok();
      }
      case 'codedel': delete CFG.codes[code]; await cfgSave(); return ok();
      case 'codeoff': if (!CODE_RX.test(code)) return json(res, 400, { code: 'invalid_argument' }); if (b.off) CFG.off[code] = 1; else delete CFG.off[code]; await cfgSave(); return ok();
      case 'cfgset': {
        const v = b.cfg || {};
        if ('banner' in v) CFG.banner = v.banner && cleanStr(v.banner.text, 200) ? { text: cleanStr(v.banner.text, 200), color: /^#[0-9a-f]{6}$/i.test(v.banner.color) ? v.banner.color : '#e63a2e', id: Date.now() } : null;
        if ('motd' in v) CFG.motd = cleanStr(v.motd, 300);
        if ('coinMul' in v) CFG.coinMul = num(v.coinMul, 0.5, 10, 1);
        if ('xpMul' in v) CFG.xpMul = num(v.xpMul, 0.5, 10, 1);
        if ('sale' in v) CFG.sale = Math.round(num(v.sale, 0, 90, 0));
        if ('event' in v) CFG.event = /^[a-z0-9_]{0,40}$/.test(v.event || '') ? v.event || '' : '';
        if ('maint' in v) CFG.maint = cleanStr(v.maint, 200);
        if ('welcome' in v) CFG.welcome = cleanToks(v.welcome);
        await cfgSave(); return ok();
      }
      case 'giftall': { const r = cleanToks(b.r); if (!r.length) return json(res, 400, { code: 'invalid_argument', error: 'Ajoute au moins une récompense.' }); CFG.gifts = [{ id: crypto.randomBytes(6).toString('base64url'), msg: cleanStr(b.msg, 200) || 'Un cadeau de l’équipe du jeu !', r, until: num(b.until, 0, 9e15, 0), at: Date.now() }, ...CFG.gifts].slice(0, 40); await cfgSave(); return ok(); }
      case 'giftdel': CFG.gifts = CFG.gifts.filter(g => g.id !== b.id); await cfgSave(); return ok();
      case 'players': return ok(await allAccounts(cleanStr(b.q, 16)));
      case 'stats': { const n = UP_URL ? (await upstash(['KEYS', 'acc:*'])).length : Object.keys(accLocal).length; return ok({ players: n, online: conns.size, games: Object.keys(owners).length, codes: Object.keys(CFG.codes).length, off: Object.keys(CFG.off).length, persistent: !!UP_URL }); }
    }
    // actions sur un joueur
    const tk = accKey(b.name); const t = tk && await accGet(tk); if (!t) return json(res, 404, { code: 'unknown_account', error: 'Joueur introuvable.' });
    if (isAdminK(tk) && ['ban', 'delete', 'resetpass'].includes(b.op)) return json(res, 400, { code: 'invalid_argument', error: 'Impossible sur le compte admin.' });
    switch (b.op) {
      case 'give': { const r = cleanToks(b.r); if (!r.length) return json(res, 400, { code: 'invalid_argument', error: 'Ajoute au moins une récompense.' }); t.gifts = [...(t.gifts || []), { id: crypto.randomBytes(6).toString('base64url'), msg: cleanStr(b.msg, 200) || 'Un cadeau de l’administrateur !', r, at: Date.now() }].slice(-30); await accPut(tk, t); return ok(null); }
      case 'ban': t.banned = true; t.tokens = []; await accPut(tk, t); return ok(null);
      case 'unban': t.banned = false; await accPut(tk, t); return ok(null);
      case 'resetpass': { const pw = String(b.pass || ''); if (pw.length < 6) return json(res, 400, { code: 'invalid_argument', error: 'Au moins 6 caractères.' }); t.salt = crypto.randomBytes(16).toString('base64'); t.hash = scryptHash(verifierOf(t.name, pw), t.salt); t.tokens = []; await accPut(tk, t); return ok(null); }
      case 'delete': if (UP_URL) await upstash(['DEL', 'acc:' + tk]); else { delete accLocal[tk]; accDirty = true; } return ok(null);
    }
  } catch (e) { console.error('admin', e.message); return json(res, 503, { code: 'unavailable', error: 'Action impossible pour le moment.' }); }
  return json(res, 400, { code: 'invalid_argument' });
}
const redeemSeen = new Map(); // code -> Set des joueurs (évite de vider un code limité en boucle)
async function redeemLimited(req, res) {
  let b; try { b = await readBody(req); } catch { return json(res, 400, { code: 'invalid_argument' }); }
  const code = typeof b.code === 'string' ? b.code.toUpperCase().replace(/[^A-Z0-9]/g, '') : ''; const c = CFG.codes[code];
  if (!c || c.on === false) return json(res, 404, { code: 'not_found', error: 'Code inconnu.' });
  const now_ = Date.now(); if ((c.from && now_ < c.from) || (c.to && now_ > c.to)) return json(res, 410, { code: 'expired', error: 'Ce code n’est pas valable en ce moment.' });
  const give = left => json(res, 200, { result: { code, d: c.d, r: c.r, left } });
  if (!c.max) return give(null);
  const who = (typeof b.user === 'string' && b.user ? 'u:' + accKey(b.user) : '') || 'ip:' + (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0];
  const seen = redeemSeen.get(code) || new Set(); if (seen.has(who)) return json(res, 409, { code: 'already', error: 'Tu as déjà utilisé ce code.' });
  if ((c.uses || 0) >= c.max) return json(res, 410, { code: 'empty', error: 'Trop tard : ce code a déjà été utilisé ' + c.max + ' fois.' });
  c.uses = (c.uses || 0) + 1; seen.add(who); redeemSeen.set(code, seen); await cfgSave();
  return give(c.max - c.uses);
}
function tooMany(ip) { const t = Date.now(); const x = (tries.get(ip) || []).filter(z => t - z < 10 * 60e3); x.push(t); tries.set(ip, x); return x.length > 20; }
async function account(req, res) {
  let b; try { b = await readBody(req); } catch { return json(res, 400, { code: 'invalid_argument' }); }
  const op = b.op; const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0];
  if (op === 'info') return json(res, 200, { result: { persistent: !!UP_URL } });
  const name = typeof b.user === 'string' ? b.user.normalize('NFC').trim() : ''; const k = accKey(name);
  if (!NAME_RX.test(name)) return json(res, 400, { code: 'bad_name', error: 'Pseudo : 3 à 16 lettres ou chiffres.' });
  const okProf = p => p && typeof p === 'object' && JSON.stringify(p).length < 250000;
  try {
    if (isAdminK(k) && (op === 'register' || op === 'restore' || op === 'login')) {
      if (tooMany(ip)) return json(res, 429, { code: 'rate_limited', error: 'Trop d’essais, réessaie dans quelques minutes.' });
      if (typeof b.verifier !== 'string' || !sameStr(b.verifier, ADMIN_V)) return json(res, op === 'login' ? 403 : 409, op === 'login' ? { code: 'bad_login', error: 'Pseudo ou mot de passe incorrect.' } : { code: 'name_taken', error: 'Ce pseudo est réservé.' });
      let acc = await accGet(k); if (!acc) acc = { name: ADMIN_NAME, prof: null, upd: 0, created: Date.now() };
      if (!acc.hash || scryptHash(b.verifier, acc.salt) !== acc.hash) { acc.salt = crypto.randomBytes(16).toString('base64'); acc.hash = scryptHash(b.verifier, acc.salt); }
      const token = newToken(acc); await accPut(k, acc); return json(res, 200, { result: { token, name: acc.name, prof: acc.prof || null, upd: acc.upd || 0, admin: true } });
    }
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
      if (acc.banned) return json(res, 403, { code: 'banned', error: 'Ce compte a été suspendu par l’administrateur.' });
      const token = newToken(acc); await accPut(k, acc); return json(res, 200, { result: { token, name: acc.name, prof: acc.prof || null, upd: acc.upd || 0 } });
    }
    const acc = await accGet(k); if (!acc) return json(res, 404, { code: 'unknown_account' });
    if (!okToken(acc, b.token)) return json(res, 403, { code: 'bad_token', error: 'Session expirée : reconnecte-toi.' });
    if (acc.banned) return json(res, 403, { code: 'banned', error: 'Ce compte a été suspendu par l’administrateur.' });
    if (op === 'load') return json(res, 200, { result: { name: acc.name, prof: acc.prof || null, upd: acc.upd || 0, admin: isAdminK(k) } });
    if (op === 'gifts') { const g = acc.gifts || []; if (g.length) { acc.gifts = []; await accPut(k, acc); } return json(res, 200, { result: g }); }
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
  if (url.pathname.endsWith('/api/admin') && req.method === 'POST') return admin(req, res);
  if (url.pathname.endsWith('/api/config')) return json(res, 200, { result: publicCfg() });
  if (url.pathname.endsWith('/api/redeem') && req.method === 'POST') return redeemLimited(req, res);
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
