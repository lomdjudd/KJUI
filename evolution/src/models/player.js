// Modèle du joueur selon son étape d'évolution et ses mutations.
import { buildCell, buildMulti, buildFish, buildQuad } from './creatures.js';
import { buildApe, buildHumanoid, buildPerson, buildMonster, outfitFor } from './humans.js';

export const PLAYER_COLOR = 0x4ad0ff;

export function buildPlayerModel(stage, muts, o = {}) {
  const has = (m) => muts.includes(m);
  if (o.monster) return buildMonster(o.monster);
  switch (stage) {
    case 0:
      return buildCell(PLAYER_COLOR, muts, { eyes: true });
    case 1:
      return buildMulti(PLAYER_COLOR, muts, { eyes: true });
    case 2:
      return buildFish(has('ecailles') ? 0x5a9ad0 : 0x6ac0f0, {
        teeth: has('machoires'),
        lobed: has('lobees'),
        metal: has('ecailles'),
        glow: has('electro'),
        stripes: 0x2a5a90,
        dorsal: has('nageoires') ? 0.45 : 0.3,
      });
    case 3:
      return buildQuad({
        color: has('peau_toxique') ? 0xff7a20 : 0x4a8a3a,
        spots: has('peau_toxique') ? 0x2040ff : 0x2a5a1a,
        belly: 0xd8d090,
        len: 0.95,
        legLen: has('pattes') ? 0.2 : 0.15,
        legW: 0.05,
        sprawl: 1,
        bodyW: 0.2,
        bodyH: 0.12,
        neck: 0.02,
        head: 0.13,
        headW: 1.3,
        snout: 0.05,
        ears: false,
        eyeSize: 0.05,
        tail: has('peau_seche') ? 0.6 : 0.45,
        tailSegs: 4,
        tailW: 0.06,
        freq: 12,
      });
    case 4:
      return buildQuad({
        color: has('fourrure') ? 0x8a6a3a : 0x5a8a3a,
        belly: 0xd8c890,
        len: 1.1,
        legLen: 0.22,
        legW: 0.06,
        sprawl: 0.6,
        bodyW: 0.2,
        bodyH: 0.15,
        neck: 0.08,
        head: 0.13,
        snout: 0.12,
        ears: false,
        teeth: has('crocs_r'),
        claws: has('griffes'),
        spikes: has('ecailles_d') ? 0x3a5a2a : null,
        tail: has('queue') ? 0.9 : 0.65,
        tailSegs: 5,
        tailW: 0.07,
        freq: 12,
        gait: 7,
      });
    case 5:
      return buildQuad({
        color: has('fourrure_e') ? 0x6a4a2a : 0x9a6a40,
        belly: 0xe0c8a0,
        len: 1,
        legLen: has('course') ? 0.5 : 0.4,
        legW: 0.055,
        bodyW: 0.22,
        bodyH: 0.23,
        neck: 0.15,
        head: 0.15,
        snout: 0.14,
        teeth: has('crocs_m'),
        fur: true,
        shaggy: has('fourrure_e'),
        tail: 0.4,
        tailW: 0.07,
        tailUp: -0.2,
        gait: 8,
      });
    case 6:
      return buildApe(0x4a3020, { bulk: has('bras') ? 1.3 : 1.15 });
    case 7:
      return buildHumanoid({
        skin: 0x9a6a48,
        hairColor: 0x2a1a10,
        hair: 'long',
        beard: true,
        top: 0x6a4a2a,
        bottom: 0x6a4a2a,
        shoes: 0x9a6a48,
        bareChest: true,
        hunch: 0.15,
        armLen: 1.1,
        bulk: has('force') ? 1.15 : 1.05,
      });
    default: {
      const look = o.look || { skin: 0xe0ac84, hairColor: 0x3a2410, hair: 'court', top: 0x3a6ab0, bottom: 0x2a2a3a };
      if (o.title === 'president') {
        const out = outfitFor(o.era ?? 0, look);
        return buildHumanoid({ ...out, top: 0x1a1a2a, bottom: 0x1a1a2a, shoes: 0x0a0a0a, tie: 0xc02020, tunic: false, hood: false, hat: null, glow: null, collar: true, bareChest: false });
      }
      if (o.title === 'roi' || o.title === 'chef') return buildPerson(look, o.era ?? 0, 'chef');
      return buildPerson(look, o.era ?? 0, o.career === 'soldat' ? 'soldat' : 'joueur');
    }
  }
}
