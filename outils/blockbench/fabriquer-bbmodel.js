// Fabrique les fichiers Blockbench (modeles/*.bbmodel) à partir de specs.js.
// Usage : node outils/blockbench/fabriquer-bbmodel.js
const fs = require('fs'); const path = require('path'); const zlib = require('zlib'); const crypto = require('crypto');
const { ROLES, files } = require('./specs');
const OUT = path.join(__dirname, '..', '..', 'modeles'); fs.mkdirSync(OUT, { recursive: true });
const PX = 16, r6 = v => Math.round(v * 1e4) / 1e4;
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
function colorOf(name) { // même règle que le convertisseur
  const n = name.replace(/[~!]/g, ''); const m = n.match(/^(#[0-9a-f]{6}|[a-z]+)(?:\*([\d.]+))?$/i); if (!m) return [255, 0, 255];
  const base = m[1][0] === '#' ? hex(m[1]) : hex(ROLES[m[1]] || '#ff00ff'); const k = m[2] ? +m[2] : 1; return base.map(v => Math.max(0, Math.min(255, Math.round(v * k))));
}
function png(w, h, rgba) {
  const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = b => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const raw = Buffer.alloc((w * 4 + 1) * h); for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const uuid = () => { const b = crypto.randomBytes(16).toString('hex'); return b.slice(0, 8) + '-' + b.slice(8, 12) + '-' + b.slice(12, 16) + '-' + b.slice(16, 20) + '-' + b.slice(20); };
for (const [file, models] of Object.entries(files)) {
  const names = [...new Set(models.flatMap(m => m.bones.flatMap(b => b.cubes.map(c => c.n.replace(/[~!]/g, '')))))];
  const CELL = 4, COLS = 16, rows = Math.ceil(names.length / COLS), TW = COLS * CELL, TH = Math.max(1, rows) * CELL;
  const buf = Buffer.alloc(TW * TH * 4); const slot = {};
  names.forEach((n, i) => { const cx = (i % COLS) * CELL, cy = Math.floor(i / COLS) * CELL; slot[n] = [cx + 1, cy + 1, cx + 3, cy + 3]; const [r, g, b] = colorOf(n); for (let y = cy; y < cy + CELL; y++) for (let x = cx; x < cx + CELL; x++) { const o = (y * TW + x) * 4; buf[o] = r; buf[o + 1] = g; buf[o + 2] = b; buf[o + 3] = 255; } });
  const elements = [], groups = [], outliner = [];
  for (const m of models) {
    const [ax, az] = m.at; const top = { name: m.name, uuid: uuid(), export: true, locked: false, scope: 0, visibility: true, origin: [ax * PX, 0, az * PX], rotation: [0, 0, 0], color: 0, children: [], reset: false, shade: true, mirror_uv: false, autouv: 0, isOpen: true };
    groups.push(top); const topNode = { uuid: top.uuid, isOpen: true, children: [] }; outliner.push(topNode);
    for (const b of m.bones) {
      let node = topNode;
      if (b.name !== '_') { const g = Object.assign({}, top, { name: b.name, uuid: uuid(), origin: [r6((b.p[0] + ax) * PX), r6(b.p[1] * PX), r6((b.p[2] + az) * PX)], isOpen: false }); groups.push(g); node = { uuid: g.uuid, isOpen: false, children: [] }; topNode.children.push(node); }
      for (const c of b.cubes) {
        const [x, y, z] = c.c, [w, h, d] = c.s; const id = uuid(); const uv = slot[c.n.replace(/[~!]/g, '')];
        const face = { uv, texture: 0 };
        elements.push({ name: c.n, box_uv: false, render_order: 'default', locked: false, export: true, scope: 0, allow_mirror_modeling: true,
          from: [r6((x - w / 2 + ax) * PX), r6((y - h / 2) * PX), r6((z - d / 2 + az) * PX)], to: [r6((x + w / 2 + ax) * PX), r6((y + h / 2) * PX), r6((z + d / 2 + az) * PX)],
          autouv: 0, color: c.n.includes('!') ? 1 : 0, rotation: c.r.slice(), origin: [r6((c.o[0] + ax) * PX), r6(c.o[1] * PX), r6((c.o[2] + az) * PX)],
          faces: { north: face, east: face, south: face, west: face, up: face, down: face }, type: 'cube', uuid: id });
        node.children.push(id);
      }
    }
  }
  const bb = { meta: { format_version: '5.0', model_format: 'free', box_uv: false }, name: 'dernier-signal-' + file, model_identifier: '', visible_box: [1, 1, 0], variable_placeholders: '', variable_placeholder_buttons: [], timeline_setups: [], unhandled_root_fields: {},
    resolution: { width: TW, height: TH }, elements, groups, outliner,
    textures: [{ path: '', name: 'palette.png', folder: '', namespace: '', id: '0', group: '', width: TW, height: TH, uv_width: TW, uv_height: TH, particle: false, use_as_default: true, layers_enabled: false, sync_to_project: '', render_mode: 'default', render_sides: 'auto', pbr_channel: 'color', frame_time: 1, frame_order_type: 'loop', frame_order: '', frame_interpolate: false, visible: true, internal: true, saved: false, uuid: uuid(), relative_path: '', source: 'data:image/png;base64,' + png(TW, TH, buf).toString('base64') }] };
  fs.writeFileSync(path.join(OUT, file + '.bbmodel'), JSON.stringify(bb));
  console.log(file + '.bbmodel', elements.length, 'cubes', models.length, 'modèles', names.length, 'couleurs');
}
