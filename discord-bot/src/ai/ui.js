const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const TRACK = 10;

// Une barre qui va-et-vient : le bloc plein se déplace sur la piste à chaque image.
export function movingBar(tick) {
  const cycle = (TRACK - 1) * 2;
  const pos = tick % cycle;
  const head = pos < TRACK ? pos : cycle - pos;
  return '▱'.repeat(head) + '▰' + '▱'.repeat(TRACK - head - 1);
}

export function thinkingFrame(tick, seconds, levelLabel) {
  return `${SPINNER[tick % SPINNER.length]} **Claude réfléchit…** ${movingBar(tick)}\n-# Réflexion : ${levelLabel} · ${seconds} s`;
}

// Découpe un texte en morceaux de `max` caractères maximum, de préférence à un saut de ligne.
export function splitMessage(text, max = 1800) {
  const chunks = [];
  let rest = text.trim();
  while (rest.length > max) {
    let cut = rest.lastIndexOf('\n', max);
    if (cut < max / 2) cut = rest.lastIndexOf(' ', max);
    if (cut <= 0) cut = max;
    chunks.push(rest.slice(0, cut).trimEnd());
    rest = rest.slice(cut).trimStart();
  }
  if (rest) chunks.push(rest);
  return chunks;
}
