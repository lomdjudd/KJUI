// Worker de sculpture : reçoit la description d'un modèle, renvoie le maillage compressé
import { sculptDesc } from './sculpt.js';

self.onmessage = (e) => {
  const { id, desc, opts } = e.data;
  let rec = null;
  let error = null;
  try {
    rec = sculptDesc(desc, opts);
  } catch (err) {
    error = String((err && err.message) || err);
  }
  const transfer = rec ? [rec.pos.buffer, rec.nrm.buffer, rec.si.buffer, rec.sw.buffer, rec.pa.buffer, rec.pb.buffer, rec.bl.buffer, rec.idx.buffer, rec.acc.buffer] : [];
  self.postMessage({ id, rec, error }, transfer);
};
