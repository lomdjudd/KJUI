// Icônes au trait (SVG) pour la console de bord.
const svg = (body) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const ICONS = {
  explore: svg('<circle cx="10.5" cy="10.5" r="6.5"/><path d="M20 20l-4.8-4.8"/><path d="M7.5 10.5a3 3 0 0 1 3-3"/>'),
  weight: svg('<path d="M12 4v15M7 19h10M4.5 7.5h15"/><circle cx="12" cy="4" r="1.2"/><path d="M4.5 7.5L2 13a2.5 2.5 0 0 0 5 0zM19.5 7.5L17 13a2.5 2.5 0 0 0 5 0z"/>'),
  sizes: svg('<circle cx="4.5" cy="16" r="1.8"/><circle cx="10" cy="15" r="2.8"/><circle cx="17.5" cy="12.5" r="5.3"/><path d="M2 20.5h20"/>'),
  rocket: svg('<path d="M12 2.5c3 2.4 4.4 5.8 4.3 9.8L14.6 16H9.4l-1.7-3.7C7.6 8.3 9 4.9 12 2.5z"/><circle cx="12" cy="9" r="1.7"/><path d="M9.4 13.5L6 16.5l3.3.4M14.6 13.5l3.4 3-3.3.4M12 18.5v3"/>'),
  daynight: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" stroke="none"/>'),
  crafts: svg('<rect x="9.5" y="9.5" width="5" height="5" rx="1"/><path d="M9.5 12H7M17 12h-2.5"/><rect x="2" y="9.5" width="5" height="5" rx=".5"/><rect x="17" y="9.5" width="5" height="5" rx=".5"/><path d="M12 9.5V7m-2.5-2.2a3.5 3.5 0 0 1 5 0"/>'),
  quiz: svg('<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4A2.5 2.5 0 0 1 4 13.5z"/><path d="M10 7.6a2 2 0 1 1 2.8 1.8c-.5.3-.8.7-.8 1.3v.3"/><circle cx="12" cy="13" r=".4" fill="currentColor"/>'),
  gear: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  map: svg('<path d="M9 4L3 6.5v13L9 17l6 2.5 6-2.5V4l-6 2.5z"/><path d="M9 4v13M15 6.5v13"/>'),
  orbit: svg('<circle cx="12" cy="12" r="3.2"/><ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(-20 12 12)"/><circle cx="20.2" cy="8.6" r="1.2" fill="currentColor"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  speaker: svg('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>'),
  pause: svg('<rect x="6.5" y="5" width="3.5" height="14" rx="1"/><rect x="14" y="5" width="3.5" height="14" rx="1"/>'),
  play: svg('<path d="M7 4.5v15l12-7.5z"/>'),
  slow: svg('<path d="M4 16c0-4 3-7 7-7s7 3 7 7z"/><path d="M18 14h2.5M7 16l-1 3M15 16l1 3"/>'),
  fast: svg('<path d="M3 5.5v13L11 12zM12 5.5v13L20 12z"/>'),
  faster: svg('<path d="M2 6v12l6-6zM8.5 6v12l6-6zM15 6v12l6-6z"/>'),
  bolt: svg('<path d="M13 2.5L4.5 13.5H11L10 21.5 19.5 10H13z"/>'),
  target: svg('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>'),
  stop: svg('<rect x="6" y="6" width="12" height="12" rx="2"/>'),
  hint: svg('<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V16h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>'),
  skip: svg('<path d="M5 5l10 7-10 7zM19 5v14"/>'),
  replay: svg('<path d="M3.5 12a8.5 8.5 0 1 0 2.5-6"/><path d="M3 4v4.5h4.5"/>'),
  pin: svg('<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>'),
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>'),
  moon: svg('<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>'),
  season: svg('<circle cx="12" cy="12" r="8.5"/><path d="M8 3.5l8 17"/>'),
  spin: svg('<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v4.5h-4.5"/>'),
  ruler: svg('<rect x="2.5" y="8" width="19" height="8" rx="1.5"/><path d="M6.5 8v3M10.5 8v4.5M14.5 8v3M18.5 8v4.5"/>'),
  helmet: svg('<path d="M4.5 13.5a7.5 7.5 0 0 1 15 0v3.5a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3z"/><path d="M8 12.8a4 3.2 0 0 1 8 0v1.4a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2z"/>'),
  zoom: svg('<circle cx="10.5" cy="10.5" r="6.5"/><path d="M20 20l-4.8-4.8M10.5 7.5v6M7.5 10.5h6"/>'),
};

export const icon = (name, cls = 'ico') => `<span class="${cls}">${ICONS[name] || ''}</span>`;
