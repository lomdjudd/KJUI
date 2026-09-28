// Fusées prêtes à voler (bibliothèque « Modèles »).

import { Craft } from '../craft/craft.js';

// Empile une liste de pièces sous (ou sur) une pièce
function below(c, parent, ids) {
  let p = parent;
  const out = [];
  for (const id of ids) {
    p = c.add(id, p, { type: 'bottom' });
    out.push(p);
  }
  return out;
}
function above(c, parent, ids) {
  let p = parent;
  const out = [];
  for (const id of ids) {
    p = c.add(id, p, { type: 'top' });
    out.push(p);
  }
  return out;
}
function radial(c, parent, id, n, y = 0, psi0 = 0) {
  const sym = n > 1 ? c.symCounter++ : 0;
  const out = [];
  for (let k = 0; k < n; k++) out.push(c.add(id, parent, { type: 'side', y, psi: psi0 + (k * Math.PI * 2) / n }, { sym }));
  return out;
}
// Propulseurs latéraux : découpleur radial + pile de pièces
function boosters(c, parent, decId, n, y, stackIds, extras) {
  const decs = radial(c, parent, decId, n, y, 0);
  const symStack = stackIds.map(() => c.symCounter++);
  const bodies = [];
  decs.forEach((d) => {
    let main = c.add(stackIds[0], d, { type: 'out' }, { sym: symStack[0] });
    bodies.push(main);
    let cur = main;
    for (let i = 1; i < stackIds.length; i++) {
      const s = stackIds[i];
      if (s.startsWith('^')) cur = c.add(s.slice(1), main, { type: 'top' }, { sym: symStack[i] });
      else cur = c.add(s, cur, { type: 'bottom' }, { sym: symStack[i] });
    }
  });
  if (extras) extras(bodies);
  return bodies;
}

export const TEMPLATES = [
  {
    name: 'Fusée-sonde Alpha',
    desc: 'Capsule monoplace sur un propulseur à poudre : vol suborbital, parachute au retour.',
    build() {
      const c = new Craft('Fusée-sonde Alpha');
      const cap = c.addRoot('cap_alpha');
      above(c, cap, ['chute_s']);
      const [, srb] = below(c, cap, ['dec_s', 'srb_s']);
      radial(c, srb, 'fin_basic', 3, -2.2, Math.PI / 2);
      radial(c, cap, 'sci_thermo', 1, 0, -Math.PI / 2);
      return c;
    },
  },
  {
    name: 'Orbiteur Frelon',
    desc: 'Deux étages kérolox et deux propulseurs à poudre : la mise en orbite terrestre basse.',
    build() {
      const c = new Craft('Orbiteur Frelon');
      const cap = c.addRoot('cap_alpha');
      above(c, cap, ['chute_s']);
      const st2 = below(c, cap, ['shield_s', 'dec_s', 'tank_k_s2', 'eng_aigle_v', 'dec_s', 'tank_k_s4', 'tank_k_s4', 'eng_frelon']);
      const core = st2[6];
      boosters(c, core, 'dec_radial_s', 2, 0, ['srb_s', '^nose_s']);
      radial(c, st2[7], 'fin_basic', 3, 0.2, Math.PI / 2);
      return c;
    },
  },
  {
    name: 'Aquila R réutilisable',
    desc: 'Premier étage récupérable (grilles, jambes, sonde de guidage) et capsule Orion-X.',
    build() {
      const c = new Craft('Aquila R');
      const cap = c.addRoot('cap_orion');
      above(c, cap, ['chute_m']);
      const s = below(c, cap, ['shield_m', 'dec_m', 'tank_k_m2', 'eng_aigle_v', 'inter_m', 'probe_nexus_m', 'tank_k_m8', 'tank_k_m4', 'eng_aquila']);
      radial(c, s[6], 'fin_grid', 4, 3.2, Math.PI / 4);
      radial(c, s[7], 'legs_m', 4, -0.4, Math.PI / 4);
      radial(c, s[3], 'rcs_quad', 4, 1.4, 0);
      return c;
    },
  },
  {
    name: 'Artémis lunaire',
    desc: 'Capsule, module de service, alunisseur Aigle et lanceur lourd à propulseurs : aller-retour vers la Lune.',
    build() {
      const c = new Craft('Artémis');
      const les = c.addRoot('cap_orion');
      above(c, les, ['chute_m']);
      const sv = below(c, les, ['shield_m', 'dec_m', 'tank_k_m4', 'eng_aigle_v']);
      radial(c, sv[2], 'solar_wing', 4, 0.8, Math.PI / 4);
      radial(c, sv[2], 'rcs_quad', 4, -1.2, 0);
      const ld = below(c, sv[3], ['dec_m', 'lander_cab', 'tank_k_m2', 'eng_colibri']);
      radial(c, ld[2], 'legs_s', 4, 0, Math.PI / 4);
      const st2 = below(c, ld[3], ['dec_m', 'fairing_m', 'tank_h_m12', 'eng_hydra', 'inter_m', 'tank_k_m16', 'tank_k_m16', 'eng_titan']);
      boosters(c, st2[6], 'dec_radial_l', 2, 0, ['srb_m', '^nose_m']);
      radial(c, st2[6], 'fin_delta', 4, -6, Math.PI / 4);
      return c;
    },
  },
  {
    name: 'Sonde martienne Arès',
    desc: 'Atterrisseur à bouclier, parachutes et jambes, avec étage de croisière hydrolox.',
    build() {
      const c = new Craft('Sonde Arès');
      const probe = c.addRoot('probe_nexus');
      above(c, probe, ['chute_m']);
      radial(c, probe, 'ant_dish', 1, 0, -Math.PI / 2);
      const l = below(c, probe, ['battery_s', 'tank_k_s1', 'eng_colibri', 'shield_m']);
      radial(c, l[1], 'legs_s', 3, 0, Math.PI / 6);
      radial(c, l[1], 'sci_spectro', 1, 0, Math.PI);
      radial(c, probe, 'solar_fixed', 4, 0, Math.PI / 4);
      const up = below(c, l[3], ['dec_m', 'tank_h_m6', 'eng_vega', 'inter_m', 'tank_k_m16', 'eng_aquila']);
      radial(c, up[1], 'solar_fan', 2, 0.5, Math.PI / 2);
      boosters(c, up[4], 'dec_radial_s', 4, 0, ['srb_s', '^nose_s']);
      return c;
    },
  },
  {
    name: 'Titan Lourd',
    desc: 'Lanceur de 3,75 m à grappe de neuf moteurs et deux Pulsar L, coiffe géante.',
    build() {
      const c = new Craft('Titan Lourd');
      const probe = c.addRoot('probe_nexus_m');
      radial(c, probe, 'solar_wing', 2, 0, Math.PI / 2);
      const s = below(c, probe, ['tank_k_m4', 'eng_aigle_v', 'dec_m', 'fairing_l', 'tank_h_l16', 'eng_hydra', 'inter_l', 'tank_k_l24', 'tank_k_l24', 'eng_titan_grappe']);
      const core = s[8];
      boosters(c, core, 'dec_radial_l', 2, 0, ['srb_l', '^nose_l']);
      return c;
    },
  },
  {
    name: 'Starfall',
    desc: 'Super-lourd méthalox en inox : vaisseau à capsule Dragonne sur un étage Super-Phénix.',
    build() {
      const c = new Craft('Starfall');
      const cap = c.addRoot('cap_dragon');
      above(c, cap, ['chute_m']);
      const ship = below(c, cap, ['shield_m', 'dec_m', 'adapt_m_l', 'tank_m_l10', 'tank_m_l10', 'eng_phenix_v', 'inter_l', 'adapt_l_xl', 'tank_m_xl32', 'tank_m_xl32', 'eng_phenix_grappe']);
      radial(c, ship[8], 'fin_grid', 4, 15, Math.PI / 4);
      radial(c, ship[4], 'legs_l', 3, -3, Math.PI / 6);
      radial(c, ship[3], 'fin_delta', 2, 1.5, 0);
      return c;
    },
  },
];
