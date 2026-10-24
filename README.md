# Daily Drift

A word, a quote and a joke each day, in a calm space that answers your touch.

Live at **https://quick-sheet.github.io/DailyDrift/**

## Install

- **Android (Chrome):** open the live link and follow the welcome sheet: tap **Install**, or Chrome ⋮ → **Install app**. Daily Drift then sits in your app drawer and on your home screen like any other app.
- **iPhone (Safari):** open the live link, tap **Share** (on iOS 26 it's under the ⋯ beside the address bar), then **Add to Home Screen**. Keep **Open as Web App** on and tap **Add**. Always open it from its icon.

## Using it

- The icons at the top rest out of sight to keep the page clean; only a faint settings icon shows at the top right. Tap it once and the fly, sound, eye and share icons (and the praying hands, if Faith is on) fade in, then fade away 5 seconds after your last tap on them. Tap settings again while they show to open Settings.
- Each day, the first open fetches a new word, quote and joke. Pull the words down for another set at any time: they settle back and fade out line by line while the next set loads, then the new one comes into focus from the top.
- Use the arrows at the bottom to look back through every set you've had. They're kept on the phone.
- Touch anywhere to start the music, then tap, hold and draw on the space to play it. Each set has its own piece, made live on the phone.
- Turn or tilt the phone and the stars glide past, as if you're looking out into space; nearer stars move faster. Settings → **Motion** turns it off, and it stays off if the phone is set to reduce motion. On iPhone it asks once for motion access, on your first tap.
- The streaks icon flies you forward through the stars, endlessly. Swipe to speed up (the faster the swipe, the faster you fly) and it eases back to a cruise when you stop; turning the phone steers. Tap it again to glide to a stop. Hidden if the phone is set to reduce motion.
- The eye changes the colours. Settings chooses whether themes are dark, light or both, and sets music, touch sounds and haptics.
- The share button turns the set on screen into a picture and opens the phone's share sheet (WhatsApp, Signal, Messages…).
- **Faith** (off unless chosen): in Settings, switch on Faith and tick any of Buddhism, Christianity, Hinduism and Sikhism. Praying hands then sit at the top left. Tap them for a short verse from one of the faiths you ticked, in place of the set. Pull down for another, use the arrows to look back, and tap the round arrow (or the phone's Back) to return. Share sends the verse as a picture.

## Where the content comes from

Fetched live by the phone, with no keys and no server: the word's definition and pronunciation from the Free Dictionary API (Wiktionary as a fallback), quotes from DummyJSON, and jokes from icanhazdadjoke, JokeAPI and the Official Joke API. The day's word comes from a short list of lovely words built into `core.js`, so everyone shares it; pulls choose another. If a source is down, that part comes from your last set and the app says so.

Verses are fetched the same way. The lines are chosen in `core.js` so each stands on its own; the words come live from:

| Faith | Source | Translation |
| --- | --- | --- |
| Buddhism | Dhammapada, from SuttaCentral's bilara-data on GitHub | Bhikkhu Sujato (CC0) |
| Christianity | bible-api.com | World English Bible, British Edition (public domain) |
| Hinduism | Bhagavad Gita, from vedicscriptures.github.io | Shri Purohit Swami |
| Sikhism | A random shabad from BaniDB (api.banidb.com); its rahao line, or its clearest short line | BaniDB's English translation |

If a faith's source is down, another ticked faith steps in; offline, a verse from earlier shows. The praying hands icon is from Phosphor Icons (MIT).

## Share the app

Send the live link. Each phone keeps its own sets and settings.

## Update

1. In the repo, **Add file → Upload files**, choose the changed files (same names replace the old ones), then **Commit changes**.
2. Wait about a minute.
3. Fully close the app and reopen it. If it looks the same, close and reopen once more.

Every release bumps two markers together: `?v=N` on the two scripts in `index.html`, and `dailydrift-vN` in `sw.js`.

## Files

| File | What it does |
| --- | --- |
| `index.html` | The whole interface: layout, light field, touch, pull to refresh, sheets |
| `core.js` | Pure logic: dates, the word list, the chosen verses, reading the live sources, each set's music, colour themes |
| `sound.js` | The music and touch sounds, synthesised with Web Audio |
| `sw.js` | Offline support and instant updates |
| `manifest.webmanifest`, icons | Install to the home screen |

No server, no account, no Sheet. Your sets, verses and settings stay on the phone. Nothing to maintain.

## Good to know

- On iPhone, music plays even with the ring switch on silent (iOS 17 and later); the speaker button turns it off. Haptics on iPhone need iOS 18 or later.
- Music stops when you leave the app or lock the phone, and resumes when you come back.
- **iPhone motion:** if you decline the motion question, switch **Motion** on in Settings to be asked again. If iOS has remembered the refusal, it won't ask; clearing the site's data in Safari resets it.
- **Android:** if every launch plays a sound and shows a Chrome notification saying "Tap to copy the URL for this app", long-press that notification and turn off the **Full screen site controls** category. The app's code can't switch it off.
