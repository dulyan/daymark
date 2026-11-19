const shapes = {
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 1.55V21a2 2 0 0 1-4 0v-.08A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 0 1 0-4h.08A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 0 1 4 0v.08A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.55 1H21a2 2 0 0 1 0 4h-.08a1.7 1.7 0 0 0-1.52 1Z"/>',
  week: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18m-14 4h2m3 0h2m3 0h1M7 17h2m3 0h2"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/><rect x="9" y="13" width="6" height="5" rx="1"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2l3.4-6.8A2 2 0 0 1 7.2 4h9.6a2 2 0 0 1 1.8 1.2L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6Zm-14-4h8"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M10 2h4m-2 7v4l2 2m4-8 2-2"/>',
  next: '<path d="m9 6 6 6-6 6"/>',
  prev: '<path d="m15 6-6 6 6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  play: '<path d="m8 5 12 7-12 7V5Z" fill="currentColor" stroke-linejoin="round"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="1" fill="currentColor"/>',
  sparkle: '<path d="M10 2c1.2 5.1 2.8 6.7 8 8-5.2 1.3-6.8 2.9-8 8-1.3-5.1-2.9-6.7-8-8 5.1-1.3 6.7-2.9 8-8Zm9 11c.5 2.3 1.7 3.5 4 4-2.3.5-3.5 1.7-4 4-.5-2.3-1.7-3.5-4-4 2.3-.5 3.5-1.7 4-4Z"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3m-4 5v2"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4m.1 3h.01"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  up: '<path d="m6 15 6-6 6 6"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 4H6a2 2 0 0 0-2 2v10"/>',
  repeat: '<path d="M17 2l4 4-4 4M3 10V8a2 2 0 0 1 2-2h16m-14 8-4 4 4 4m14-8v2a2 2 0 0 1-2 2H3"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12a2 2 0 0 0 4 0"/>',
  arrow: '<path d="M7 17 17 7M7 7h10v10"/>'
}

export function icon(name, size = 20) {
  return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${shapes[name] ?? ''}</svg>`
}
