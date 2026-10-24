/* Daily Drift: pure logic (no DOM). Dates, the word for each day, reading the live word, quote and joke
   sources, each set's piece of music, voice-leading, touch pitch and colour themes. Tested with node. */
(function (root) {
  'use strict';

  const DAY_MS = 864e5;
  const ANCHOR = 20750;      // day number of Saturday 24 October 2026, the first release

  /* ---------- dates (local calendar days, safe across clock changes) ---------- */
  const dayNumber = (d) => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS);
  const dateOf = (n) => { const u = new Date(n * DAY_MS); return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate(), 12); };
  const mod = (a, n) => ((a % n) + n) % n;
  const entryIndex = (n, len) => mod(n - ANCHOR, len);

  function dayLabel(n, today, locale) {
    const d = dateOf(n), t = dateOf(today);
    const o = { weekday: 'long', day: 'numeric', month: 'long' };
    if (d.getFullYear() !== t.getFullYear()) o.year = 'numeric';
    const p = {};
    new Intl.DateTimeFormat(locale || 'en-GB', o).formatToParts(d).forEach((x) => { p[x.type] = x.value; });
    return [p.weekday, p.day, p.month, p.year].filter(Boolean).join(' ');
  }

  /* ---------- seeded randomness ---------- */
  function hash(n) {
    let h = (n | 0) ^ 0x9e3779b9;
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    return (h ^ (h >>> 16)) >>> 0;
  }
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const pick = (r, arr) => arr[Math.floor(r() * arr.length)];

  /* ---------- harmony ---------- */
  // Chord colours as intervals above the chord root (9ths and sus chords keep it open and unresolved).
  const QUALITY = {
    m9:   [0, 3, 7, 10, 14],
    m7:   [0, 3, 7, 10],
    maj9: [0, 4, 7, 11, 14],
    add9: [0, 4, 7, 14],
    sus2: [0, 2, 7, 14],
    six9: [0, 4, 9, 14],
  };
  // Progressions as [chord root in semitones above the key, quality], each with the five-note scale its melody uses.
  const MINOR_PENT = [0, 3, 5, 7, 10];
  const MAJOR_PENT = [0, 2, 4, 7, 9];
  const LYDIAN_PENT = [0, 2, 4, 7, 11];
  const PROGRESSIONS = [
    { name: 'drift',   scale: MINOR_PENT, chords: [[0, 'm9'], [8, 'maj9'], [3, 'maj9'], [10, 'sus2']] },
    { name: 'tide',    scale: MINOR_PENT, chords: [[0, 'm9'], [5, 'm9'], [8, 'maj9'], [7, 'm7']] },
    { name: 'hollow',  scale: MINOR_PENT, chords: [[0, 'm9'], [5, 'add9'], [0, 'm9'], [10, 'add9']] },
    { name: 'float',   scale: LYDIAN_PENT, chords: [[0, 'maj9'], [2, 'add9'], [0, 'maj9'], [11, 'm7']] },
    { name: 'morning', scale: MAJOR_PENT, chords: [[0, 'maj9'], [9, 'm9'], [5, 'maj9'], [7, 'sus2']] },
    { name: 'breath',  scale: MINOR_PENT, chords: [[0, 'm9'], [10, 'maj9']] },
    { name: 'glass',   scale: MAJOR_PENT, chords: [[0, 'six9'], [4, 'm7'], [9, 'm9'], [5, 'maj9']] },
  ];
  const KEYS = [0, 2, 3, 4, 5, 7, 8, 9, 10];   // C, D, E♭, E, F, G, A♭, A, B♭

  // One piece per calendar day: same day, same music, on every phone.
  function piece(n) {
    const seed = hash(n * 7919 + 17);
    const r = rng(seed);
    const prog = pick(r, PROGRESSIONS);
    return {
      day: n,
      seed,
      key: pick(r, KEYS),
      prog: prog.name,
      scale: prog.scale,
      chords: prog.chords,
      beat: +(1.15 + r() * 0.5).toFixed(3),        // seconds per beat
      chordBeats: pick(r, [8, 8, 12]),              // beats per chord
      density: +(0.28 + r() * 0.2).toFixed(3),      // how often a bell sounds on a beat
      bright: +(0.45 + r() * 0.4).toFixed(3),       // pad brightness, 0..1
    };
  }

  function chordAt(p, i) {
    const [root, q] = p.chords[mod(i, p.chords.length)];
    const rootPc = mod(p.key + root, 12);
    return { rootPc, pcs: QUALITY[q].map((x) => mod(rootPc + x, 12)).filter((v, k, a) => a.indexOf(v) === k), bass: 36 + rootPc };
  }

  // Place each pitch class in [lo, hi] as close as possible to the previous chord's centre,
  // then pull apart semitone clusters in the low register, where they turn to mud.
  function voiceLead(prev, pcs, lo = 50, hi = 76) {
    const centre = prev && prev.length ? prev.reduce((a, b) => a + b, 0) / prev.length : 61;
    let notes = pcs.map((pc) => {
      let best = null;
      for (let m = lo; m <= hi; m++) if (mod(m, 12) === pc && (best === null || Math.abs(m - centre) < Math.abs(best - centre))) best = m;
      return best;
    }).filter((m) => m !== null).sort((a, b) => a - b);
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 1; i < notes.length; i++) {
        if (notes[i] - notes[i - 1] <= 1 && notes[i - 1] < 62 && notes[i] + 12 <= hi) notes[i] += 12;
      }
      notes.sort((a, b) => a - b);
    }
    return notes;
  }

  // A melody note on the day's five-note scale: degree 0 is the key note at `base`, 5 is an octave up.
  const scaleMidi = (p, degree, base) => base + p.key + p.scale[mod(degree, 5)] + 12 * Math.floor(degree / 5);

  // Touch pitch: bottom of the screen low, top high, two octaves plus a step, always in key.
  const TOUCH_STEPS = 11;
  function touchDegree(y01) { return Math.max(0, Math.min(TOUCH_STEPS - 1, Math.round(y01 * (TOUCH_STEPS - 1)))); }
  const touchMidi = (p, y01) => scaleMidi(p, touchDegree(y01) + 2, 48);

  // The bell figure for a chord: the same figure returns each time that chord comes round.
  function motif(p, chordIdx) {
    const slot = mod(chordIdx, p.chords.length);
    const r = rng(hash(p.seed + slot * 131));
    const beats = p.chordBeats;
    const out = [];
    let deg = 4 + Math.floor(r() * 4);
    for (let b = 0; b < beats; b++) {
      if (b === 0 || r() < p.density) {
        deg = Math.max(1, Math.min(9, deg + pick(r, [-2, -1, -1, 1, 1, 2, 0, 3])));
        out.push({ beat: b, degree: deg, vel: +(0.55 + r() * 0.45).toFixed(3) });
      }
    }
    return out;
  }

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  /* ---------- gestures ---------- */
  // Release of a sideways swipe: -1 previous day, +1 next day, 0 spring back.
  function swipeOutcome(dx, width, vx) {
    if (Math.abs(dx) > width / 3) return dx > 0 ? -1 : 1;
    if (Math.abs(vx) > 0.5 && Math.sign(vx) === Math.sign(dx) && Math.abs(dx) > 24) return dx > 0 ? -1 : 1;
    return 0;
  }
  // Pull against an edge: resistance that never quite stops.
  const resist = (dx) => Math.sign(dx) * 40 * Math.log1p(Math.abs(dx) / 40);

  /* ---------- live content: which word, and reading what the sources send back ---------- */
  // Lovely words to choose from; the definition, pronunciation and example are fetched live each time.
  const WORDS = 'susurrus farrago crepuscular lagniappe quiescent tryst loquacious incandescent desultory mellifluous widdershins dilettante beatific sanguine evanescent zugzwang lark insouciant candour thrum purl vernal zarf esprit unfurl adroit raffish vivacious delectable abiding salubrious boscage umami gloaming filigree yaffle wistful glade iridescent zeugma hinterland harbinger kenspeckle malapropism thaumaturgy frisson gumption inchoate somnambulist debonair agog luminous halcyon jubilant soporific bower ziggurat moonbow gregarious fecund brindled illume verisimilitude timorous moonglade virga palimpsest hearth sprezzatura zephyr temerity scrumptious cachinnate balmy heyday oxbow windfall honeyed coalesce patina murmuration ataraxia benison persiflage hale bonhomie ebullient legerdemain serendipity roseate dither noctilucent welkin munificent nimbus panacea sonorous chiaroscuro amaranthine opulent besotted quintessence niveous zoetrope umbrageous auspicious garrulous collywobbles rime phosphorescence inglenook brio nuance bibliophile idyll assuage argent emollient aubade ochre mercurial hullabaloo obstreperous tarn liminal eldritch vermilion demure vagary riparian serein numinous sylvan voluble divagate oriel orotund burnish perspicacious penumbra effervescent sartorial riposte wanderlust bucolic xanthic glaucous vignette ethereal empyrean frangible sesquipedalian multifarious syzygy dulcet pareidolia convivial raconteur quotidian imbue hubbub pavonine impish lilt affable pithy wassail mondegreen limpid glister aestival coterie dawdle solace lodestar dote gladsome verdant gewgaw firmament mote hibernal effulgent exuberant jocund yonder fleet rapscallion palaver scintilla diurnal equanimity fortuitous zany nacreous kaleidoscopic erudite mansuetude willowy vespertine dewfall yomp sidereal zeitgeist lambent celerity amity ultramarine oneiric dappled prestidigitation languid peregrination lucent snicket ruminate ephemeral euphony jape flaxen eventide cynosure talisman orison urbane beguile azure oeuvre apricity cerulean gossamer fey cumulus cosset grandiloquent undulate hoarfrost cadence wherewithal rubicund ineffable yen vim pellucid lucubration untrammelled propinquity kismet lackadaisical winsome maunder concinnity titivate clement irenic xenial quidnunc tintinnabulation nesh kindred nepenthe rigmarole resplendent dauntless redolent mizzle spoonerism ken ambrosial lissom orrery quaff vicissitude alacrity whorl zenith irrepressible mien lustrous guileless petrichor jollity tenebrous nocturne jaunty verdigris felicity indefatigable aplomb plangent jink swale sobriquet labyrinthine peripatetic tremulous rill mirth jovial burgeon sempiternal moxie perambulate kerfuffle sibilant nebulous velleity winnow magnanimous diaphanous fettle spindrift coruscate comely gambol friable opalescent offing tarry incipient hallowed gelid plenilune billow ardent hummock genial cairn avuncular roundelay taradiddle nascent uproarious onomatopoeia nonpareil waft tessellate blithe quiddity wuthering frolic chatoyant caliginous doughty trouvaille epiphany whimsical flocculent lollop fervour hearken dandle levity respite caprice encomium reverie marcescent erstwhile kith imbibe meander quixotic yesteryear brume aureate'.split(' ');
  const wordOfDay = (day) => WORDS[entryIndex(day, WORDS.length)];
  function anotherWord(recent, r) {
    const avoid = new Set(recent || []);
    for (let i = 0; i < 50; i++) { const w = WORDS[Math.floor((r || Math.random)() * WORDS.length)]; if (!avoid.has(w)) return w; }
    return WORDS[Math.floor((r || Math.random)() * WORDS.length)];
  }

  const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…', mdash: '—', ndash: '–' };
  const stripHtml = (h) => String(h || '').replace(/<[^>]*>/g, '').replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => {
    if (e[0] === '#') { const c = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return isFinite(c) ? String.fromCodePoint(c) : m; }
    return ENT[e.toLowerCase()] != null ? ENT[e.toLowerCase()] : m;
  });
  // Tidy text from the web: single spaces, typographic quotes and apostrophes, no wrapping quotation marks.
  function tidy(t) {
    t = stripHtml(t).replace(/\s+/g, ' ').trim();
    t = t.replace(/^["“”']+|["“”']+$/g, '').trim();
    t = t.replace(/(^|[\s(\[{—–-])"/g, '$1“').replace(/"/g, '”')
         .replace(/(^|[\s(\[{—–-])'/g, '$1‘').replace(/'/g, '’');
    return t.replace(/\s+([,.;:!?])/g, '$1');
  }
  const sentence = (t) => { t = tidy(t); if (!t) return t; t = t[0].toUpperCase() + t.slice(1); return /[.!?…”’)]$/.test(t) ? t : t + '.'; };
  // Keep long texts to a calm length: cut at a sentence or clause if possible, never mid-word.
  function shorten(t, max) {
    if (t.length <= max) return t;
    const cut = t.slice(0, max);
    const dot = cut.lastIndexOf('. '), semi = cut.lastIndexOf('; ');
    if (dot > 24) return t.slice(0, dot + 1);
    if (semi > max * 0.45) return t.slice(0, semi) + '.';
    return cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:]$/, '') + '…';
  }
  const POS = { noun: 'noun', verb: 'verb', adjective: 'adjective', adverb: 'adverb', interjection: 'interjection', preposition: 'preposition', pronoun: 'pronoun', conjunction: 'conjunction' };
  const usable = (d) => d && d.length > 3 && !/^(alternative|obsolete|archaic) (form|spelling)|^plural of|^(simple )?past|^present participle|^third-person/i.test(d);

  // Free Dictionary API (api.dictionaryapi.dev): [{ word, phonetic, phonetics:[{text}], meanings:[{ partOfSpeech, definitions:[{ definition, example }] }] }]
  function parseDictionary(j, word) {
    const e = Array.isArray(j) ? j[0] : null;
    if (!e || !Array.isArray(e.meanings)) return null;
    let pos = '', d = '', ex = '';
    for (const m of e.meanings) for (const df of m.definitions || []) {
      const t = tidy(df.definition);
      if (!d && usable(t)) { d = t; pos = m.partOfSpeech; if (df.example) ex = tidy(df.example); }
      if (d && !ex && df.example && m.partOfSpeech === pos) ex = tidy(df.example);
    }
    if (!d) return null;
    const ipa = tidy(e.phonetic || ((e.phonetics || []).find((p) => p && p.text) || {}).text || '');
    return finishWord(e.word || word, ipa, pos, d, ex);
  }
  // Wiktionary (en.wiktionary.org/api/rest_v1/page/definition/<word>): { en: [{ partOfSpeech, definitions:[{ definition (HTML), examples:[HTML] }] }] }
  function parseWiktionary(j, word) {
    const list = j && Array.isArray(j.en) ? j.en : [];
    for (const m of list) for (const df of m.definitions || []) {
      const d = tidy(df.definition);
      if (!usable(d)) continue;
      const ex = ((df.parsedExamples || []).map((x) => x.example).concat(df.examples || [])).map(tidy).find((x) => x && x.length < 140) || '';
      return finishWord(word, '', String(m.partOfSpeech || '').toLowerCase(), d, ex);
    }
    return null;
  }
  function finishWord(w, ipa, pos, d, ex) {
    d = sentence(d.replace(/^\([^)]*\)\s*/, '')) || sentence(d);
    d = shorten(d, 150);
    ex = ex ? sentence(ex) : '';
    if (ex.length > 130) ex = '';
    return { w: String(w).toLowerCase(), ipa: ipa && ipa.length < 40 ? ipa : '', pos: POS[String(pos).toLowerCase()] || String(pos).toLowerCase(), d, e: ex };
  }

  // DummyJSON quotes (dummyjson.com/quotes/random): { quote, author }
  function parseQuote(j) {
    if (!j || !j.quote) return null;
    const q = tidy(j.quote), a = tidy(j.author || '') || 'Unknown';
    if (q.length < 8 || q.length > 170) return null;
    return { q, a };
  }

  // A one-line joke becomes a setup and a punchline where it naturally splits.
  function splitJoke(text) {
    const t = tidy(text);
    let m = t.match(/^(.+?\?)\s+(.+)$/);
    if (m) return { s: m[1], p: m[2] };
    m = t.match(/^(.+[.!])\s+([^.!?]+[.!?]?)$/);
    if (m && m[2].length > 3) return { s: m[1], p: m[2] };
    return { s: t, p: '' };
  }
  // icanhazdadjoke.com: { joke }   JokeAPI (v2.jokeapi.dev): { type:'twopart', setup, delivery }   Official Joke API: { setup, punchline }
  function parseJoke(j) {
    if (!j) return null;
    let out = null;
    if (j.joke) out = splitJoke(j.joke);
    else if (j.setup && (j.delivery || j.punchline)) out = { s: tidy(j.setup), p: tidy(j.delivery || j.punchline) };
    if (!out || !out.s || out.s.length > 150 || out.p.length > 130 || /\n/.test(out.s)) return null;
    return out;
  }

  /* ---------- colour themes, made on the fly ---------- */
  // OKLCH (perceptual lightness, chroma, hue) to sRGB, pulling chroma in until the colour fits the screen's gamut.
  function oklchToRgb(L, C, h) {
    for (let c = C; ; c *= 0.92) {
      const a = c * Math.cos((h * Math.PI) / 180), b = c * Math.sin((h * Math.PI) / 180);
      const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
      const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
      const s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
      const lin = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
      if (c < 1e-4 || lin.every((v) => v >= -1e-4 && v <= 1 + 1e-4)) {
        return lin.map((v) => { v = Math.max(0, Math.min(1, v)); return Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055)); });
      }
    }
  }
  const hex = (rgb) => '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
  const rgba = (rgb, a) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
  function luminance(rgb) {
    const [r, g, b] = rgb.map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  function contrast(a, b) { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }

  const TONES = ['both', 'dark', 'light'];
  const toneOf = (n, mode) => (mode === 'dark' ? 'dark' : mode === 'light' ? 'light' : mod(n, 3) === 2 ? 'light' : 'dark');
  // Theme n: the hue walks round the wheel by the golden angle, so neighbours always differ but never clash.
  // Theme 0 is the deep blue twilight the app opens with.
  function palette(n, mode) {
    n = Math.floor(n) || 0;
    const tone = toneOf(n, mode);
    const r = rng(hash(n * 104729 + 7));
    const h = mod(262 + n * 137.50776, 360), depth = n === 0 ? 0.3 : r(), sat = n === 0 ? 0.5 : r();
    // Olive and ochre hues turn muddy in the dark, so they get less colour there.
    const muddy = (hh) => { const d = Math.min(Math.abs(hh - 95), 360 - Math.abs(hh - 95)); return d < 45 ? 0.55 + 0.45 * (d / 45) : 1; };
    const k = (L, C, dh) => { const hh = mod(h + (dh || 0), 360); return oklchToRgb(L, C * (tone === 'dark' ? muddy(hh) : 1), hh); };
    let p;
    if (tone === 'dark') {
      const L = 0.16 + 0.045 * depth, C = 0.016 + 0.013 * sat;
      p = { bg: k(L, C), bg2: k(L + 0.055, C * 1.35, 6), raise: k(L + 0.045, C), raise2: k(L + 0.085, C),
        ink: k(0.945, 0.011, 30), ink2: k(0.8, 0.022), ink3: k(0.69, 0.026), sun: k(0.9, 0.032, 35), onSun: k(0.2, 0.02),
        glow: k(0.93, 0.026), h1: [k(0.52, 0.065, -25), 0.32], h2: [k(0.55, 0.05, 60), 0.2], h3: [k(0.56, 0.04, 140), 0.16] };
    } else {
      const L = 0.915 + 0.04 * depth, C = 0.01 + 0.012 * sat;
      p = { bg: k(L, C), bg2: k(Math.min(0.985, L + 0.03), C * 0.7), raise: k(Math.min(0.975, L + 0.035), C * 0.6), raise2: k(0.995, 0.004),
        ink: k(0.24, 0.022), ink2: k(0.41, 0.026), ink3: k(0.5, 0.024), sun: k(0.3, 0.03), onSun: k(0.965, 0.008),
        glow: k(0.44, 0.045), h1: [k(0.8, 0.06, -25), 0.42], h2: [k(0.84, 0.05, 60), 0.32], h3: [k(0.85, 0.045, 140), 0.3] };
    }
    const vars = {
      '--bg': hex(p.bg), '--bg-2': hex(p.bg2), '--raise': hex(p.raise), '--raise-2': hex(p.raise2),
      '--line': rgba(p.ink, 0.08), '--line-2': rgba(p.ink, tone === 'dark' ? 0.16 : 0.15),
      '--ink': hex(p.ink), '--ink-2': hex(p.ink2), '--ink-3': hex(p.ink3),
      '--sun': hex(p.sun), '--sun-soft': rgba(p.sun, tone === 'dark' ? 0.13 : 0.08), '--on-sun': hex(p.onSun),
      '--glow-c': hex(p.glow), '--h1': rgba(...p.h1), '--h2': rgba(...p.h2), '--h3': rgba(...p.h3),
    };
    return { n, tone, hue: +h.toFixed(1), vars, rgb: p, glow: p.glow, bg: hex(p.bg) };
  }

  // ---------------- faith: one short line from a scripture, fetched live with no keys ----------------
  // The lines are chosen here so each one stands on its own; the words themselves come from the sources.
  const FAITHS = ['buddhism', 'christianity', 'hinduism', 'sikhism'];
  const FAITH = {
    buddhism: { name: 'Buddhism', book: 'Dhammapada', by: 'Bhikkhu Sujato' },
    christianity: { name: 'Christianity', book: 'The Bible', by: 'World English Bible' },
    hinduism: { name: 'Hinduism', book: 'Bhagavad Gita', by: 'Shri Purohit Swami' },
    sikhism: { name: 'Sikhism', book: 'Guru Granth Sahib', by: '' },
  };
  const BIBLE = ['Psalm 23:1', 'Psalm 118:24', 'Psalm 119:105', 'Psalm 34:18', 'Psalm 46:1', 'Psalm 56:3', 'Psalm 90:12', 'Psalm 147:3', 'Psalm 55:22', 'Psalm 103:8',
    'Psalm 62:1', 'Psalm 62:5', 'Psalm 4:8', 'Psalm 100:5', 'Psalm 145:18', 'Psalm 19:1', 'Psalm 51:10', 'Psalm 91:1', 'Psalm 121:1-2', 'Psalm 133:1', 'Psalm 30:5',
    'Psalm 27:1', 'Psalm 139:14', 'Proverbs 3:5', 'Proverbs 15:1', 'Proverbs 16:9', 'Proverbs 17:22', 'Proverbs 4:23', 'Proverbs 16:3', 'Proverbs 12:25', 'Proverbs 16:24',
    'Proverbs 17:17', 'Proverbs 15:13', 'Proverbs 22:1', 'Proverbs 19:11', 'Ecclesiastes 3:1', 'Ecclesiastes 4:9', 'Isaiah 26:3', 'Isaiah 40:8', 'Lamentations 3:22-23',
    'Micah 6:8', 'Numbers 6:24-26', 'Matthew 5:3', 'Matthew 5:4', 'Matthew 5:5', 'Matthew 5:7', 'Matthew 5:8', 'Matthew 5:9', 'Matthew 5:14', 'Matthew 6:21', 'Matthew 6:34',
    'Matthew 7:7', 'Matthew 11:28', 'Matthew 11:30', 'Luke 6:31', 'Luke 6:36', 'Luke 1:37', 'John 1:5', 'John 8:32', 'John 13:34', 'John 14:27', 'John 15:12', 'John 15:13',
    'Romans 12:12', 'Romans 12:21', 'Romans 8:28', 'Romans 15:13', '1 Corinthians 13:4', '1 Corinthians 13:13', '1 Corinthians 16:14', '2 Corinthians 5:7', 'Galatians 6:2',
    'Galatians 6:9', 'Ephesians 4:32', 'Philippians 4:7', 'Philippians 4:13', 'Colossians 3:14', '1 Thessalonians 5:16-18', '2 Timothy 1:7', 'Hebrews 11:1', 'Hebrews 13:2',
    'Hebrews 13:8', '1 Peter 4:8', '1 Peter 5:7', '1 John 3:18', '1 John 4:7', '1 John 4:8', '1 John 4:18', '1 John 4:19'];
  const GITA = ['2.13', '2.14', '2.16', '2.20', '2.22', '2.23', '2.40', '2.47', '2.48', '2.56', '2.58', '2.62', '2.64', '2.67', '2.69', '2.70', '2.71', '3.19', '3.21',
    '4.18', '4.36', '4.38', '4.39', '5.10', '5.21', '6.5', '6.6', '6.7', '6.17', '6.19', '6.26', '6.30', '6.32', '6.35', '6.40', '7.7', '9.26', '9.27', '9.29', '10.8',
    '10.20', '10.41', '12.15', '12.17', '13.28', '16.21', '17.15', '18.46', '18.61', '18.66'];
  const DHP = [2, 5, 25, 26, 33, 35, 43, 49, 50, 52, 53, 55, 58, 80, 81, 82, 98, 100, 103, 112, 116, 118, 122, 133, 151, 160, 163, 172, 173, 183, 197, 199, 201,
    213, 222, 223, 224, 228, 239, 251, 252, 257, 304, 314, 327, 377, 379];
  // SuttaCentral keeps the Dhammapada in one file per chapter.
  const DHP_FILES = [[1, 20], [21, 32], [33, 43], [44, 59], [60, 75], [76, 89], [90, 99], [100, 115], [116, 128], [129, 145], [146, 156], [157, 166], [167, 178],
    [179, 196], [197, 208], [209, 220], [221, 234], [235, 255], [256, 272], [273, 289], [290, 305], [306, 319], [320, 333], [334, 359], [360, 382], [383, 423]];
  function dhpFile(n) { const r = DHP_FILES.find(([a, b]) => n >= a && n <= b); return r ? `dhp${r[0]}-${r[1]}` : null; }
  const REFS = { christianity: BIBLE, hinduism: GITA, buddhism: DHP };
  function verseURL(f, ref) {
    if (f === 'christianity') return 'https://bible-api.com/' + encodeURIComponent(ref) + '?translation=webbe';
    if (f === 'hinduism') { const [c, v] = String(ref).split('.'); return `https://vedicscriptures.github.io/slok/${c}/${v}/index.json`; }
    if (f === 'buddhism') return `https://raw.githubusercontent.com/suttacentral/bilara-data/published/translation/en/sujato/sutta/kn/dhp/${dhpFile(ref)}_translation-en-sujato.json`;
    if (f === 'sikhism') return 'https://api.banidb.com/v2/random/G';
    return '';
  }
  // A faith from those ticked, and a line from it not seen lately.
  const pickFaith = (sel, r) => { const list = FAITHS.filter((f) => (sel || []).includes(f)); return list.length ? list[Math.floor((r || Math.random)() * list.length)] : null; };
  function pickRef(f, recent, r) {
    const list = REFS[f]; if (!list) return null;
    const avoid = new Set((recent || []).map(String)), fresh = list.filter((x) => !avoid.has(String(x)));
    const from = fresh.length ? fresh : list;
    return from[Math.floor((r || Math.random)() * from.length)];
  }
  // One clean line: no stray quotation marks from the verses around it, no leading "But" or "And", ending in a full stop.
  function verseText(t) {
    t = tidy(t).replace(/^(Lord Shri Krishna|Arjuna)[^:]{0,24}:\s*/, '');
    const n = (re) => (t.match(re) || []).length;
    if (n(/“/g) !== n(/”/g)) t = t.replace(/[“”]/g, '');
    if (t[0] === '‘' && n(/‘/g) === 1) t = t.slice(1);
    if (/[.!?,;]’$/.test(t) && n(/‘/g) === 0) t = t.slice(0, -1);
    t = t.replace(/^(But|And|Therefore,?)\s+/, '').replace(/\s-\s/g, ' — ').replace(/([^\s—])—\s/g, '$1 — ').replace(/\s+/g, ' ').trim();
    if (!t) return '';
    t = t[0].toUpperCase() + t.slice(1);
    t = t.replace(/[\s,;:—–-]+$/, '');
    return /[.!?…]$/.test(t) ? t : t + '.';
  }
  const calmLength = (t) => t && t.length >= 12 && t.length <= 240;
  // bible-api.com: { reference, verses:[{ text }], text, translation_name }
  function parseBible(j, ref) {
    if (!j) return null;
    let t = j.text || (Array.isArray(j.verses) ? j.verses.map((v) => v.text).join(' ') : '');
    t = String(t).replace(/(\w[\s,;]+)The LORD/g, '$1the LORD').replace(/\bLORD\b/g, 'Lord').replace(/\bGOD\b/g, 'God');
    t = verseText(t);
    return calmLength(t) ? { f: 'christianity', ref: String(ref || j.reference || ''), t, by: FAITH.christianity.by } : null;
  }
  // vedicscriptures.github.io: { chapter, verse, purohit: { author, et: "2.47 But thou hast..." } }
  function parseGita(j, ref) {
    const et = j && j.purohit && j.purohit.et;
    if (!et || /did not comment/i.test(et)) return null;
    const t = verseText(String(et).replace(/^\s*\d+\.\d+\s*/, ''));
    return calmLength(t) ? { f: 'hinduism', ref: String(ref || (j.chapter + '.' + j.verse)), t, by: FAITH.hinduism.by } : null;
  }
  // SuttaCentral bilara-data: { "dhp223:1": "Defeat anger with kindness, ", "dhp223:2": "..." }
  function parseDhp(j, n) {
    if (!j) return null;
    const lines = [];
    for (const [k, v] of Object.entries(j)) { const m = k.match(/^dhp(\d+):(\d+)$/); if (m && +m[1] === +n && +m[2] > 0 && String(v).trim()) lines.push([+m[2], v]); }
    if (!lines.length) return null;
    const t = verseText(lines.sort((a, b) => a[0] - b[0]).map((x) => x[1]).join(' '));
    return calmLength(t) ? { f: 'buddhism', ref: String(n), t, by: FAITH.buddhism.by } : null;
  }
  // BaniDB (api.banidb.com/v2/random/G): one whole shabad. Its rahao line, the line of pause, holds its central thought;
  // if that isn't a clean sentence, the clearest short line instead.
  function baniLine(v) {
    const en = (v && v.translation && v.translation.en) || {};
    return String(en.bdb || en.ssk || en.ms || '').replace(/\|\|\s*\d+\s*\|\|/g, ' ').replace(/\bPause\b/gi, ' ').replace(/\|+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  const baniHeading = (t) => !t || t.length < 24 || /:\s*$/.test(t) || /\bMehl\b/i.test(t) || /^(shalok|salok|pauree|pauri|raag|one universal creator)/i.test(t);
  function parseBani(j) {
    const vs = (j && Array.isArray(j.verses)) ? j.verses : [];
    let best = null, bestScore = -1;
    vs.forEach((v, i) => {
      const t = baniLine(v); if (baniHeading(t) || t.length > 190) return;
      const rahao = /ਰਹਾਉ/.test((v.verse && v.verse.unicode) || '');
      const score = (rahao ? 3 : 0) + (/^[A-Z]/.test(t) ? 1 : 0) + (/[.!?]$/.test(t) ? 1 : 0) + (t.length >= 40 && t.length <= 140 ? 1 : 0);
      if (score > bestScore) { best = { i, t }; bestScore = score; }
    });
    if (!best) return null;
    let t = best.t;
    if (/^[a-z]/.test(t) && best.i > 0) {                       // it carries on from the line before: join them when short enough
      const prev = baniLine(vs[best.i - 1]);
      if (!baniHeading(prev) && prev.length + t.length < 200) t = prev + ' ' + t;
    }
    t = verseText(t);
    const info = j.shabadInfo || {}, v0 = vs[best.i] || {};
    const writer = info.writer && info.writer.english ? String(info.writer.english) : '';
    const ang = info.pageNo || v0.pageNo;
    return calmLength(t) ? { f: 'sikhism', ref: ang ? String(ang) : '', t, by: writer } : null;
  }
  // The line under a verse: where it is, and whose words or translation.
  function verseCite(v) {
    if (!v) return '';
    const place = v.f === 'christianity' ? v.ref : v.f === 'buddhism' ? (v.ref ? 'Verse ' + v.ref : '') : v.f === 'sikhism' ? (v.ref ? 'Ang ' + v.ref : '') : v.ref;
    return [place, v.by].filter(Boolean).join(' · ');
  }

  const Core = { FAITHS, FAITH, BIBLE, GITA, DHP, DHP_FILES, dhpFile, verseURL, pickFaith, pickRef, verseText, parseBible, parseGita, parseDhp, parseBani, baniLine, verseCite,
    WORDS, wordOfDay, anotherWord, tidy, shorten, parseDictionary, parseWiktionary, parseQuote, parseJoke, splitJoke, oklchToRgb, hex, contrast, luminance, palette, toneOf, TONES, DAY_MS, ANCHOR, dayNumber, dateOf, entryIndex, dayLabel, hash, rng, piece, chordAt, voiceLead, scaleMidi, touchDegree, touchMidi, TOUCH_STEPS, motif, mtof, swipeOutcome, resist, QUALITY, PROGRESSIONS, KEYS, mod };
  if (typeof module !== 'undefined' && module.exports) module.exports = Core; else root.Core = Core;
})(typeof self !== 'undefined' ? self : this);
