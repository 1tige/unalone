# Unalone

**You were never meant to be alone.** A real-time web app that matches lonely people with someone to talk to — by shared interests, with a fallback to anyone online so no one is ever left alone.

Real backend included: two live people find each other over WebSocket, then chat with text, emojis, and photos in real time.

---

## What's inside

```
unalone-app/
├── server.js          ← backend: matchmaking + message relay (Node + Socket.io)
├── package.json       ← dependencies
└── public/
    └── index.html     ← frontend (English), connects to the server
```

## Run it locally (2 minutes)

You need [Node.js](https://nodejs.org) installed (v18+).

```bash
cd unalone-app
npm install
npm start
```

Then open **http://localhost:3000** in your browser.

### Test the matching with a real second person
Open the site in **two different browser windows** (or one normal + one incognito). Pick a name and interests in each, hit **Search for talk** in both — they'll match and you can chat live between the two windows. That's two real clients talking through your server.

To test with a friend on the same Wi-Fi, share your local IP (e.g. `http://192.168.1.20:3000`).

## Put it online so anyone can use it

The app is a standard Node server, so any Node host works. Free, beginner-friendly options:

- **Render.com** — New → Web Service → connect your repo → build `npm install`, start `npm start`. Done.
- **Railway.app** — New Project → Deploy from repo → it auto-detects Node.
- **Fly.io** — `fly launch` then `fly deploy`.

The server already reads `process.env.PORT`, so these hosts work with zero changes. Once deployed you get a public URL to share.

## How the matchmaking works

1. A user enters a name + interests and emits `find`.
2. The server scans everyone currently waiting and picks the best partner:
   - first, someone sharing **one or more interests**;
   - if nobody shares an interest, **anyone else waiting** (so low traffic still pairs people).
3. The two are placed in a private room. All messages, images, and typing events are relayed only between them.
4. **Next talk** leaves the current partner (who gets re-queued) and searches again.
5. **Say goodbye** leaves cleanly and shows the summary screen.

The online counter is the live number of connected clients, broadcast to everyone on every connect/disconnect.

## Ideas for next steps

- Add a quick "report / skip" safety control and basic profanity filtering.
- Persist nothing by default (privacy-friendly) — or add optional accounts later.
- Add voice/video with WebRTC once text chat has traction.
- Store images on a service like Cloudinary instead of sending base64 (scales better).

---

Built as a starting point — it's real, working code you fully own and can extend.
