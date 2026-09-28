// Carrière : missions, jalons, expériences scientifiques, récupération.

import { toast } from '../ui/dom.js';
import { fmtMoney, fmtInt } from '../core/math.js';
import { AU } from '../core/bodies.js';

export const BODY_MULT = {
  terre: 1, lune: 3, mars: 5, venus: 6, mercure: 7, phobos: 5.5, deimos: 5.5, ceres: 7, jupiter: 9, io: 11, europe: 12,
  ganymede: 11, callisto: 10, saturne: 12, titan: 14, encelade: 14, uranus: 15, titania: 16, neptune: 17, triton: 18,
  pluton: 19, charon: 19, nyx: 25, soleil: 8,
};

const SIT_NAMES = { sol: 'au sol', basse_atm: 'en basse atmosphère', haute_atm: 'en haute atmosphère', espace_proche: 'en orbite basse', espace_lointain: 'dans l\'espace lointain', liquide: 'en surface d\'un liquide' };
const SIT_MULT = { sol: 1.6, liquide: 1.3, basse_atm: 1.0, haute_atm: 0.9, espace_proche: 1.0, espace_lointain: 0.8 };

export const EXPERIMENTS = {
  thermo: { name: 'Température', base: 4, sits: ['sol', 'liquide', 'basse_atm', 'haute_atm', 'espace_proche', 'espace_lointain'] },
  baro: { name: 'Pression', base: 6, sits: ['sol', 'basse_atm', 'haute_atm'], needAtm: true },
  goo: { name: 'Échantillons', base: 8, sits: ['sol', 'liquide', 'basse_atm', 'haute_atm', 'espace_proche', 'espace_lointain'] },
  spectro: { name: 'Spectrométrie', base: 12, sits: ['espace_proche', 'espace_lointain'] },
  seismo: { name: 'Sismologie', base: 14, sits: ['sol'] },
  drill: { name: 'Forage', base: 20, sits: ['sol'] },
  rapport: { name: 'Rapport d\'équipage', base: 3, sits: ['sol', 'liquide', 'basse_atm', 'haute_atm', 'espace_proche', 'espace_lointain'] },
};

// Missions : conditions évaluées sur le vaisseau actif
const orbitOf = (id) => (v, c) => v.body.id === id && c.orbitStable;
const landOn = (id) => (v, c) => v.body.id === id && (v.landed || v.splashed) && c.flewHigh;
const soiOf = (id) => (v) => v.body.id === id || !!(v.visited && v.visited[id]);

export const MISSIONS = [
  { id: 'm_launch', name: 'Premier vol', desc: 'Lancez n\'importe quelle fusée depuis le pas de tir.', funds: 6000, sci: 2, test: (v) => v.launched && v.altitude > 200 },
  { id: 'm_10k', name: 'Franchir 10 km', desc: 'Atteignez 10 km d\'altitude au-dessus de la Terre.', funds: 8000, sci: 3, req: ['m_launch'], test: (v) => v.body.id === 'terre' && v.altitude > 10000 },
  { id: 'm_space', name: 'Vers l\'espace', desc: 'Dépassez 70 km : la limite de l\'atmosphère terrestre.', funds: 14000, sci: 6, req: ['m_10k'], test: (v) => v.body.id === 'terre' && v.altitude > 70000 },
  { id: 'm_return', name: 'Retour sain et sauf', desc: 'Récupérez un équipage revenu de l\'espace.', funds: 16000, sci: 6, req: ['m_space'], onRecover: (v) => v.crewed && v.stats.maxAlt > 70000 },
  { id: 'm_orbit', name: 'Première orbite', desc: 'Placez un vaisseau en orbite stable autour de la Terre.', funds: 30000, sci: 12, req: ['m_space'], test: orbitOf('terre') },
  { id: 'm_sat', name: 'Satellite', desc: 'Mettez en orbite une sonde avec panneaux solaires et antenne.', funds: 32000, sci: 10, req: ['m_orbit'], test: (v, c) => c.orbitStable && v.body.id === 'terre' && !v.crewed && v.parts.some((p) => p.def.solar) && v.parts.some((p) => p.def.antenna) },
  { id: 'm_geo', name: 'Orbite géosynchrone', desc: 'Orbite d\'une période de 6 h (≈ 2 870 km d\'altitude) autour de la Terre, à 5 % près.', funds: 60000, sci: 18, req: ['m_sat'], test: (v, c) => v.body.id === 'terre' && c.orbitStable && Math.abs(c.period - 21600) < 1080 && c.ecc < 0.05 },
  { id: 'm_booster', name: 'Retour du lanceur', desc: 'Posez un étage propulsé en douceur sur la Terre après être monté au-dessus de 5 km.', funds: 50000, sci: 15, req: ['m_10k'], test: (v, c) => v.body.id === 'terre' && v.landed && !v.splashed && v.stats.maxAlt > 5000 && v.parts.some((p) => p.def.engine && !p.def.engine.solid) && c.flewHigh },
  { id: 'm_moon_soi', name: 'Survol de la Lune', desc: 'Entrez dans la sphère d\'influence de la Lune.', funds: 45000, sci: 15, req: ['m_orbit'], test: soiOf('lune') },
  { id: 'm_moon_orbit', name: 'Orbite lunaire', desc: 'Placez-vous en orbite stable autour de la Lune.', funds: 55000, sci: 20, req: ['m_moon_soi'], test: orbitOf('lune') },
  { id: 'm_moon_land', name: 'Alunissage', desc: 'Posez-vous sur la Lune.', funds: 90000, sci: 35, req: ['m_moon_orbit'], test: landOn('lune') },
  { id: 'm_moon_return', name: 'Retour de la Lune', desc: 'Ramenez sur Terre un équipage qui a marché sur la Lune.', funds: 140000, sci: 45, req: ['m_moon_land'], onRecover: (v) => v.crewed && v.visited && v.visited.lune && v.visited.lune.landed },
  { id: 'm_station', name: 'Station spatiale', desc: 'Mettez en orbite terrestre un module habitat et des panneaux solaires.', funds: 90000, sci: 25, req: ['m_orbit'], test: (v, c) => v.body.id === 'terre' && c.orbitStable && v.parts.some((p) => p.def.id === 'hab_module') && v.parts.some((p) => p.def.solar) },
  { id: 'm_mars_soi', name: 'Cap sur Mars', desc: 'Atteignez la sphère d\'influence de Mars.', funds: 120000, sci: 40, req: ['m_moon_orbit'], test: soiOf('mars') },
  { id: 'm_mars_land', name: 'Atterrissage martien', desc: 'Posez-vous sur Mars (parachutes et bouclier recommandés).', funds: 200000, sci: 70, req: ['m_mars_soi'], test: landOn('mars') },
  { id: 'm_phobos', name: 'Lunes de Mars', desc: 'Posez-vous sur Phobos ou Déimos.', funds: 150000, sci: 50, req: ['m_mars_soi'], test: (v, c) => landOn('phobos')(v, c) || landOn('deimos')(v, c) },
  { id: 'm_venus_soi', name: 'L\'étoile du berger', desc: 'Atteignez la sphère d\'influence de Vénus.', funds: 120000, sci: 40, req: ['m_moon_orbit'], test: soiOf('venus') },
  { id: 'm_venus_land', name: 'Sous les nuages de Vénus', desc: 'Posez-vous sur Vénus. Coque pressurisée indispensable.', funds: 320000, sci: 110, req: ['m_venus_soi'], test: landOn('venus') },
  { id: 'm_mercury', name: 'Au plus près du Soleil', desc: 'Posez-vous sur Mercure. Bouclier solaire indispensable.', funds: 300000, sci: 100, req: ['m_venus_soi'], test: landOn('mercure') },
  { id: 'm_ceres', name: 'La ceinture', desc: 'Posez-vous sur Cérès, dans la ceinture d\'astéroïdes.', funds: 260000, sci: 90, req: ['m_mars_soi'], test: landOn('ceres') },
  { id: 'm_jupiter', name: 'Le roi des planètes', desc: 'Entrez dans la sphère d\'influence de Jupiter.', funds: 300000, sci: 100, req: ['m_mars_soi'], test: soiOf('jupiter') },
  { id: 'm_europa', name: 'Océan caché', desc: 'Posez-vous sur Europe. Blindage anti-radiations indispensable.', funds: 450000, sci: 160, req: ['m_jupiter'], test: landOn('europe') },
  { id: 'm_io', name: 'Volcans d\'Io', desc: 'Posez-vous sur Io, le monde le plus volcanique.', funds: 450000, sci: 150, req: ['m_jupiter'], test: landOn('io') },
  { id: 'm_ganymede', name: 'Géante des lunes', desc: 'Posez-vous sur Ganymède ou Callisto.', funds: 380000, sci: 130, req: ['m_jupiter'], test: (v, c) => landOn('ganymede')(v, c) || landOn('callisto')(v, c) },
  { id: 'm_saturn', name: 'Seigneur des anneaux', desc: 'Entrez dans la sphère d\'influence de Saturne.', funds: 400000, sci: 140, req: ['m_jupiter'], test: soiOf('saturne') },
  { id: 'm_titan', name: 'Lacs de méthane', desc: 'Posez-vous sur Titan. Isolation cryogénique indispensable.', funds: 600000, sci: 200, req: ['m_saturn'], test: landOn('titan') },
  { id: 'm_enceladus', name: 'Geysers de glace', desc: 'Posez-vous sur Encelade.', funds: 550000, sci: 190, req: ['m_saturn'], test: landOn('encelade') },
  { id: 'm_ice_giants', name: 'Géantes de glace', desc: 'Visitez Uranus et Neptune.', funds: 700000, sci: 240, req: ['m_saturn'], test: (v) => v.visited && v.visited.uranus && v.visited.neptune },
  { id: 'm_triton', name: 'Lune rétrograde', desc: 'Posez-vous sur Triton ou Titania.', funds: 750000, sci: 260, req: ['m_saturn'], test: (v, c) => landOn('triton')(v, c) || landOn('titania')(v, c) },
  { id: 'm_pluto', name: 'Aux confins', desc: 'Posez-vous sur Pluton ou Charon.', funds: 900000, sci: 320, req: ['m_saturn'], test: (v, c) => landOn('pluton')(v, c) || landOn('charon')(v, c) },
  { id: 'm_grand_tour', name: 'Grand Tour', desc: 'Visitez Jupiter, Saturne, Uranus et Neptune avec un seul vaisseau.', funds: 1500000, sci: 500, req: ['m_saturn'], test: (v) => v.visited && ['jupiter', 'saturne', 'uranus', 'neptune'].every((k) => v.visited[k]) },
  { id: 'm_nyx', name: 'La neuvième planète', desc: 'Posez-vous sur Nyx, découverte grâce au télescope spatial profond.', funds: 3000000, sci: 800, req: ['m_pluto'], hiddenTech: 'telescope_profond', test: landOn('nyx') },
];

export class Career {
  constructor(app) {
    this.app = app;
    this.t = 0;
  }

  get game() {
    return this.app.game;
  }

  // Situation scientifique du vaisseau
  situation(v) {
    const b = v.body;
    if (v.landed || v.splashed || v.inContact) return v.splashed ? 'liquide' : 'sol';
    const alt = v.altitude;
    if (b.atmosphere && alt < b.atmosphere.height) return alt < b.atmosphere.height * 0.4 ? 'basse_atm' : 'haute_atm';
    return alt < Math.max(250000, b.radius * 0.6) ? 'espace_proche' : 'espace_lointain';
  }

  // Portée de transmission vers la Terre
  canTransmit(v, ut) {
    let range = 0;
    for (const p of v.parts) if (p.def.antenna) range = Math.max(range, p.def.antenna.range);
    if (!range) return false;
    const sys = this.app.system;
    if (range >= 3) return true;
    let inEarth = false;
    for (let b = v.body; b; b = b.parentBody) if (b.id === 'terre') inEarth = true;
    if (inEarth) return true;
    if (range >= 2) {
      const [x, y] = v.absPos(ut);
      const e = sys.home.state(ut);
      return Math.hypot(x - e.x, y - e.y) < 7 * AU;
    }
    return false;
  }

  runScience(v, ut) {
    const g = this.game;
    const sit = this.situation(v);
    const b = v.body;
    const list = [];
    const exps = new Set();
    for (const p of v.parts) if (p.def.science && p.def.science !== 'lab') exps.add(p.def.science);
    if (v.crewed) exps.add('rapport');
    if (!exps.size) {
      toast('Aucune expérience', 'Ajoutez des instruments scientifiques (catégorie Science).', 'warn');
      return;
    }
    const lab = v.parts.some((p) => p.def.science === 'lab');
    const transmit = this.canTransmit(v, ut);
    v.storedScience = v.storedScience || [];
    let total = 0;
    for (const e of exps) {
      const ex = EXPERIMENTS[e];
      if (!ex.sits.includes(sit)) { list.push(`${ex.name} : impossible ${SIT_NAMES[sit]}`); continue; }
      if (ex.needAtm && !b.atmosphere) { list.push(`${ex.name} : pas d'atmosphère ici`); continue; }
      if (e === 'drill' && sit === 'liquide') continue;
      const key = `${e}:${b.id}:${sit}`;
      if (g.scienceLog[key] || v.storedScience.some((s) => s.key === key)) { list.push(`${ex.name} : déjà étudié ${SIT_NAMES[sit]} sur ${b.name}`); continue; }
      let val = ex.base * (BODY_MULT[b.id] || 1) * SIT_MULT[sit] * (lab ? 1.5 : 1);
      val = Math.round(val * 10) / 10;
      if (transmit) {
        g.scienceLog[key] = val;
        g.earn(0, val);
        total += val;
        list.push(`${ex.name} ${SIT_NAMES[sit]} : +${val} science`);
      } else {
        v.storedScience.push({ key, val });
        list.push(`${ex.name} ${SIT_NAMES[sit]} : ${val} (stockée, à rapporter sur Terre)`);
      }
    }
    this.app.audio.science();
    toast(total > 0 ? `+${fmtInt(total)} points de science` : 'Expériences', list.join(' · '), 'sci', 6500);
    g.save();
  }

  // Vérifications périodiques (jalons, missions, visites)
  tick(v, sim, dt) {
    this.t += dt;
    if (this.t < 0.5) return;
    this.t = 0;
    if (!v || !v.launched) return;
    const g = this.game;
    // visites
    v.visited = v.visited || {};
    const b = v.body;
    if (!v.visited[b.id]) v.visited[b.id] = {};
    const vis = v.visited[b.id];
    const orb = sim.prediction && sim.prediction[0] ? sim.prediction[0] : null;
    const atmTop = b.radius + (b.atmosphere ? b.atmosphere.height : Math.max(3000, b.ground.amp * 1.5));
    const orbitStable = !!(orb && orb.body === b && orb.orbit.e < 1 && orb.orbit.periapsis > atmTop && (orb.end === 'none' || orb.end === 'encounter' || isFinite(orb.orbit.period)) && orb.end !== 'impact' && orb.end !== 'escape');
    if (orbitStable) vis.orbit = true;
    if ((v.landed || v.splashed) && v.stats.maxAlt > 1000) vis.landed = true;
    const c = { orbitStable, period: orb ? orb.orbit.period : Infinity, ecc: orb ? orb.orbit.e : 1, flewHigh: v.stats.maxAlt > 1000 || b.id !== 'terre' };
    // stats globales
    g.stats.maxAlt = Math.max(g.stats.maxAlt, b.id === 'terre' ? v.altitude : 0);
    if (!g.stats.bodies.includes(b.id)) g.stats.bodies.push(b.id);
    if (g.mode === 'challenge' && this.app.challenge) this.app.challenge.tick(v, sim, c);
    if (g.mode !== 'career') return;
    for (const m of MISSIONS) {
      if (g.milestones[m.id] || !m.test) continue;
      if (m.req && !m.req.every((r) => g.milestones[r])) continue;
      if (m.hiddenTech && !g.hasTech(m.hiddenTech)) continue;
      let ok = false;
      try { ok = m.test(v, c); } catch (e) { ok = false; }
      if (ok) this.complete(m);
    }
  }

  complete(m) {
    const g = this.game;
    g.milestones[m.id] = Date.now();
    g.earn(m.funds, m.sci);
    this.app.audio.success();
    toast(`Mission accomplie : ${m.name}`, `+${fmtMoney(m.funds)} · +${m.sci} science`, 'good', 6500);
    g.save();
  }

  // Récupération (posé sur Terre)
  recover(v) {
    const g = this.game;
    let value = 0;
    for (const p of v.parts) {
      let c = p.def.cost;
      value += c;
    }
    const refund = Math.round(value * 0.9);
    let sci = 0;
    for (const s of v.storedScience || []) {
      if (g.scienceLog[s.key]) continue;
      g.scienceLog[s.key] = s.val;
      sci += s.val;
    }
    g.earn(refund, sci);
    if (g.mode === 'career') {
      for (const m of MISSIONS) {
        if (g.milestones[m.id] || !m.onRecover) continue;
        if (m.req && !m.req.every((r) => g.milestones[r])) continue;
        if (m.onRecover(v)) this.complete(m);
      }
    }
    g.stats.landings++;
    g.save();
    return { refund, sci };
  }

  availableMissions() {
    const g = this.game;
    return MISSIONS.filter((m) => !g.milestones[m.id] && (!m.req || m.req.every((r) => g.milestones[r])) && (!m.hiddenTech || g.hasTech(m.hiddenTech)));
  }
}
