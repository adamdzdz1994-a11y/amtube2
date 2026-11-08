/* AMTube icon set - drawn from scratch (24x24 grid, rounded strokes, one accent-coloured detail per icon).
   Parts marked [a] use the user's accent colour, so changing the colour in Settings recolours every icon. */
(function () {
  const A = (d, extra) => `<path class="ac" d="${d}" ${extra || ""}/>`;
  const P = (d) => `<path d="${d}"/>`;
  const C = (cx, cy, r, ac) => `<circle ${ac ? 'class="ac"' : ""} cx="${cx}" cy="${cy}" r="${r}"/>`;
  const ICONS = {
    home: P("M3.5 11.2 12 4l8.5 7.2") + P("M6 9.8V19a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9.8") + A("M10 20v-4.6a2 2 0 0 1 4 0V20"),
    sites: C(12, 12, 8.6) + P("M3.4 12h17.2") + P("M12 3.4c2.6 2.6 2.6 14.6 0 17.2") + P("M12 3.4c-2.6 2.6-2.6 14.6 0 17.2") + C(12, 12, 1.9, 1),
    library: P("M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z") + P("M12 7.6v6") + A("M8.8 11.2 12 14.4l3.2-3.2") + P("M8 17h8"),
    settings: P("M4 7h9.2") + P("M17.8 7H20") + C(15.5, 7, 2.2, 1) + P("M4 17h2.2") + P("M10.8 17H20") + C(8.5, 17, 2.2, 1),
    search: C(10.8, 10.8, 6.2) + A("M15.6 15.6 20 20", 'fill="none" stroke-width="2.4"'),
    paste: P("M8 5H6.6A1.6 1.6 0 0 0 5 6.6v12.8A1.6 1.6 0 0 0 6.6 21h10.8a1.6 1.6 0 0 0 1.6-1.6V6.6A1.6 1.6 0 0 0 17.4 5H16") + A("M9 3.5h6v3.2H9z") + P("M8.6 12h6.8M8.6 16h4.4"),
    close: P("M6 6l12 12M18 6 6 18"),
    download: P("M5 20h14") + P("M12 4v10.2") + A("M7.6 10.4 12 14.8l4.4-4.4", 'fill="none"'),
    play: A("M8 5.4v13.2L19 12z", 'stroke-linejoin="round"'),
    pause: A("M7.5 5.5h3v13h-3z") + A("M13.5 5.5h3v13h-3z"),
    music: P("M9.4 17.6V6.2l9.2-2v11.2") + C(7.2, 17.8, 2.2, 1) + C(16.4, 15.6, 2.2, 1),
    video: P("M3.5 6.5h11a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z") + A("M16.5 10.2l5-2.6v8.8l-5-2.6z"),
    share: C(6, 12, 2.2) + C(18, 6, 2.2, 1) + C(18, 18, 2.2) + P("M8 11l8-4M8 13l8 4"),
    trash: P("M4.6 7h14.8") + P("M9.6 7V5h4.8v2") + P("M6.6 7l.9 12.2a1 1 0 0 0 1 .8h7a1 1 0 0 0 1-.8L17.4 7") + A("M10.4 11v5.2M13.6 11v5.2", 'fill="none"'),
    check: A("M5 12.6 9.8 17.4 19 7.6", 'fill="none" stroke-width="2.4"'),
    alert: P("M12 4 3 19.2h18z") + A("M12 9.8v4.4", 'fill="none"') + C(12, 16.7, .6, 1),
    clock: C(12, 12, 8.6) + A("M12 7.4V12l3.2 2", 'fill="none"'),
    wifi: P("M3.4 9.2a12.6 12.6 0 0 1 17.2 0") + P("M6.4 12.4a8.4 8.4 0 0 1 11.2 0") + P("M9.4 15.6a4.2 4.2 0 0 1 5.2 0") + C(12, 18.6, 1.3, 1),
    palette: P("M12 3.4a8.6 8.6 0 1 0 0 17.2c1.2 0 1.8-.9 1.4-1.9-.5-1.2.3-2.5 1.7-2.5H17a3.6 3.6 0 0 0 3.6-3.6C20.6 7 16.8 3.4 12 3.4z") + C(7.8, 11, 1.2, 1) + C(10.4, 7.4, 1.2, 1) + C(14.8, 7.6, 1.2, 1),
    moon: P("M19.6 14.4A8 8 0 0 1 9.6 4.4 8.2 8.2 0 1 0 19.6 14.4z") + A("M17.6 4.2v3M16.1 5.7h3", 'fill="none"'),
    sun: C(12, 12, 3.6, 1) + P("M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"),
    language: P("M4 6h9M8.5 4v2") + P("M6 6c.4 3 2.6 5.2 5.6 6.4M12 6c-.6 3.2-3.4 5.8-7 6.8") + A("M13.6 20l3.7-9 3.7 9M14.9 17h4.8", 'fill="none"'),
    shield: P("M12 3.2l7.2 2.8v5.2c0 4.7-3 7.9-7.2 9.6-4.2-1.7-7.2-4.9-7.2-9.6V6z") + A("M8.8 12.2l2.2 2.2 4.2-4.4", 'fill="none"'),
    refresh: P("M19.6 8.6A8 8 0 0 0 5 8.4") + A("M5 4.2v4.4h4.4", 'fill="none"') + P("M4.4 15.4a8 8 0 0 0 14.6.2") + P("M19 19.8v-4.4h-4.4"),
    back: P("M14.6 5.4 8 12l6.6 6.6"),
    plus: A("M12 5v14M5 12h14", 'fill="none" stroke-width="2.2"'),
    more: C(12, 5.4, 1.5, 1) + C(12, 12, 1.5, 1) + C(12, 18.6, 1.5, 1),
    external: P("M10 5H6.6A1.6 1.6 0 0 0 5 6.6v10.8A1.6 1.6 0 0 0 6.6 19h10.8a1.6 1.6 0 0 0 1.6-1.6V14") + A("M13.4 4.6H19.4v6M19 5l-8 8", 'fill="none"'),
    info: C(12, 12, 8.6) + A("M12 11v5", 'fill="none" stroke-width="2.2"') + C(12, 8, .5, 1),
    update: P("M7 18.4a4.6 4.6 0 0 1-.5-9.1 6 6 0 0 1 11.4 1.4 3.9 3.9 0 0 1-.4 7.7") + A("M12 11.4v7M9.4 14l2.6-2.6 2.6 2.6", 'fill="none"'),
    edit: P("M5 19l.8-3.8L16.4 4.6a1.8 1.8 0 0 1 2.6 0l.4.4a1.8 1.8 0 0 1 0 2.6L8.8 18.2z") + A("M14.6 6.4l3 3", 'fill="none"'),
    drag: C(9, 7, 1.2, 1) + C(15, 7, 1.2, 1) + C(9, 12, 1.2, 1) + C(15, 12, 1.2, 1) + C(9, 17, 1.2, 1) + C(15, 17, 1.2, 1),
    chevron: P("M9.4 5.4 16 12l-6.6 6.6"),
    sparkle: A("M12 3.6l1.9 5.4 5.4 1.9-5.4 1.9L12 18.2l-1.9-5.4-5.4-1.9 5.4-1.9z"),
    queue: P("M4 7h12M4 12h12M4 17h7") + A("M18 14.4l3.2 2.6-3.2 2.6z"),
    folder: P("M3.6 7.2a1.6 1.6 0 0 1 1.6-1.6h4l2 2.4h7.6a1.6 1.6 0 0 1 1.6 1.6v8a1.6 1.6 0 0 1-1.6 1.6H5.2a1.6 1.6 0 0 1-1.6-1.6z") + A("M3.6 11h16.8", 'fill="none"'),
    logo: ""
  };
  window.AMIcons = {
    names: Object.keys(ICONS),
    svg(name, size) {
      const s = size || 22;
      const body = ICONS[name] || "";
      return `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
    }
  };
})();
