// Convertit les fichiers Blockbench (modeles/*.bbmodel) en données pour le moteur 3D du jeu.
// Usage : node outils/blockbench/convertir.js > sortie.js
// Chaque groupe du premier niveau = un modèle ; ses sous-groupes = des os (pivot = origine du groupe).
// Un cube : [x0, y0, z0, x1, y1, z1, ox, oy, oz, rx, ry, rz, "couleur"] en mètres, relatif au pivot de son os.
const fs = require('fs'); const path = require('path');
const DIR = path.join(__dirname, '..', '..', 'modeles'); const PX = 16; const r = v => Math.round(v / PX * 1e4) / 1e4;
const out = {};
for (const f of fs.readdirSync(DIR).filter(x => x.endsWith('.bbmodel')).sort()) {
  const bb = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
  const els = new Map(bb.elements.map(e => [e.uuid, e])); const grs = new Map((bb.groups || []).map(g => [g.uuid, g]));
  const node = n => typeof n === 'string' ? (els.get(n) ? { el: els.get(n) } : grs.get(n) ? { gr: grs.get(n), children: [] } : null) : { gr: grs.get(n.uuid) || n, children: n.children || [] };
  for (const top of bb.outliner) {
    const t = node(top); if (!t || !t.gr) continue; const M = { bones: {} }; const base = t.gr.origin; // [x, y, z] en pixels
    const addCube = (bone, pv, e) => { if (e.export === false || e.type && e.type !== 'cube') return; const ro = e.rotation || [0, 0, 0], o = e.origin || [0, 0, 0];
      bone.c.push([r(e.from[0] - pv[0]), r(e.from[1] - pv[1]), r(e.from[2] - pv[2]), r(e.to[0] - pv[0]), r(e.to[1] - pv[1]), r(e.to[2] - pv[2]), r(o[0] - pv[0]), r(o[1] - pv[1]), r(o[2] - pv[2]), ro[0], ro[1], ro[2], e.name]); };
    const walk = (children, bone, pv) => { for (const ch of children) { const n = node(ch); if (!n) continue; if (n.el) addCube(bone, pv, n.el);
      else { const g = n.gr; const kids = (typeof ch === 'object' && ch.children) || g.children || []; const p = g.origin; const b = { p: [r(p[0] - base[0]), r(p[1] - base[1]), r(p[2] - base[2])], c: [] }; M.bones[g.name] = b; walk(kids, b, p); } } };
    const root = { p: [0, 0, 0], c: [] }; M.bones._ = root; walk(t.children || top.children || [], root, [base[0], 0, base[2]]);
    if (!root.c.length) delete M.bones._;
    out[t.gr.name] = M;
  }
}
process.stdout.write('/* modèles 3D faits avec Blockbench (dossier modeles/, converti par outils/blockbench/convertir.js) */\nconst BBM = ' + JSON.stringify(out) + ';\n');
