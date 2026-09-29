// Pool de workers pour sculpter plusieurs créatures en parallèle pendant l'installation.
// Sans workers (navigateur restreint), la sculpture se fait sur le fil principal.
import SculptWorker from './sculpt.worker.js?worker&inline';
import { sculptDesc } from './sculpt.js';

export function createSculptPool(count) {
  const workers = [];
  try {
    for (let i = 0; i < count; i++) workers.push(new SculptWorker());
  } catch {
    workers.forEach((w) => w.terminate());
    workers.length = 0;
  }
  const idle = [...workers];
  const queue = [];
  const pending = new Map();
  let nextId = 1;

  const local = (job) =>
    new Promise((r) => setTimeout(r, 0)).then(() => {
      try {
        job.resolve(sculptDesc(job.desc, job.opts));
      } catch (e) {
        job.reject(e);
      }
    });

  const pump = () => {
    while (idle.length && queue.length) {
      const w = idle.pop();
      const job = queue.shift();
      const id = nextId++;
      pending.set(id, { job, w });
      w.postMessage({ id, desc: job.desc, opts: job.opts });
    }
  };

  for (const w of workers) {
    w.onmessage = (e) => {
      const { id, rec, error } = e.data;
      const p = pending.get(id);
      pending.delete(id);
      idle.push(w);
      if (p) {
        if (error) local(p.job);
        else p.job.resolve(rec);
      }
      pump();
    };
    w.onerror = (e) => {
      e.preventDefault();
      // Worker défaillant : ses tâches passent sur le fil principal
      for (const [id, p] of pending) {
        if (p.w !== w) continue;
        pending.delete(id);
        local(p.job);
      }
      const i = workers.indexOf(w);
      if (i >= 0) workers.splice(i, 1);
      w.terminate();
      if (!workers.length) while (queue.length) local(queue.shift());
      else pump();
    };
  }

  return {
    get parallel() {
      return workers.length;
    },
    run(desc, opts) {
      return new Promise((resolve, reject) => {
        const job = { desc, opts, resolve, reject };
        if (!workers.length) local(job);
        else {
          queue.push(job);
          pump();
        }
      });
    },
    close() {
      workers.forEach((w) => w.terminate());
      workers.length = 0;
    },
  };
}
