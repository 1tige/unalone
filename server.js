/* ============================================================
   Unalone — real-time matchmaking backend
   Node.js + Express + Socket.io
   Pairs live users by shared interests, falls back to anyone
   so no one is left alone. Relays messages, images, emojis,
   typing indicators. Handles "next" and "leave".
   ============================================================ */

const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  maxHttpBufferSize: 6e6,           // ~6 MB, lets small photos through
});

// serve the frontend from /public
app.use(express.static(path.join(__dirname, 'public')));

/* ---------------- state ----------------
   waiting: users searching for a partner
   rooms:   active 1-on-1 conversations
*/
const waiting = new Map();   // socket.id -> { name, interests:Set }
const rooms = new Map();     // roomId    -> [socketIdA, socketIdB]
let onlineCount = 0;

function broadcastOnline() {
  onlineCount = io.engine.clientsCount;
  io.emit('online', onlineCount);
}

function sharedInterests(a, b) {
  const out = [];
  a.interests.forEach(i => { if (b.interests.has(i)) out.push(i); });
  return out;
}

/* Find the best partner already waiting.
   1) someone sharing >=1 interest
   2) otherwise anyone waiting (so low traffic still pairs people) */
function findPartner(meId, me) {
  let best = null, bestScore = -1;
  for (const [id, other] of waiting) {
    if (id === meId) continue;
    const score = sharedInterests(me, other).length;
    if (score > bestScore) { bestScore = score; best = id; }
  }
  return best; // null if nobody else is waiting
}

function pair(idA, idB) {
  const a = waiting.get(idA), b = waiting.get(idB);
  if (!a || !b) return;
  waiting.delete(idA); waiting.delete(idB);

  const roomId = idA + '#' + idB;
  rooms.set(roomId, [idA, idB]);

  const sockA = io.sockets.sockets.get(idA);
  const sockB = io.sockets.sockets.get(idB);
  if (!sockA || !sockB) { rooms.delete(roomId); return; }

  sockA.join(roomId); sockB.join(roomId);
  sockA.data.room = roomId; sockB.data.room = roomId;

  const shared = sharedInterests(a, b);
  sockA.emit('matched', { roomId, partner: { name: b.name, interests: [...b.interests] }, shared, matchedByInterest: shared.length > 0 });
  sockB.emit('matched', { roomId, partner: { name: a.name, interests: [...a.interests] }, shared, matchedByInterest: shared.length > 0 });
}

function leaveRoom(socket, notifyPartner = true) {
  const roomId = socket.data.room;
  if (!roomId) return;
  const members = rooms.get(roomId) || [];
  rooms.delete(roomId);

  members.forEach(id => {
    const s = io.sockets.sockets.get(id);
    if (!s) return;
    s.leave(roomId);
    s.data.room = null;
    if (notifyPartner && id !== socket.id) s.emit('partner_left');
  });
}

/* ---------------- socket lifecycle ---------------- */
io.on('connection', (socket) => {
  socket.data.room = null;
  broadcastOnline();

  // user starts searching
  socket.on('find', ({ name, interests }) => {
    leaveRoom(socket);                       // safety: drop any old room
    const me = {
      name: (name || 'Anonymous').slice(0, 24),
      interests: new Set((interests || []).slice(0, 30)),
    };
    waiting.set(socket.id, me);

    const partnerId = findPartner(socket.id, me);
    if (partnerId) pair(socket.id, partnerId);
    // else: stay in queue; next person to search will pair with us
  });

  // cancel searching
  socket.on('cancel', () => waiting.delete(socket.id));

  // relay a text/emoji message to the partner
  socket.on('message', (text) => {
    const room = socket.data.room;
    if (room) socket.to(room).emit('message', String(text).slice(0, 2000));
  });

  // relay an image (base64 data URL)
  socket.on('image', (dataUrl) => {
    const room = socket.data.room;
    if (room && typeof dataUrl === 'string' && dataUrl.startsWith('data:image/')) {
      socket.to(room).emit('image', dataUrl);
    }
  });

  // typing indicator
  socket.on('typing', (isTyping) => {
    const room = socket.data.room;
    if (room) socket.to(room).emit('typing', !!isTyping);
  });

  // "Next talk" — leave current partner and search again
  socket.on('next', () => {
    leaveRoom(socket, true);
  });

  // "Say goodbye" — just leave the room, stop searching
  socket.on('leave', () => {
    leaveRoom(socket, true);
    waiting.delete(socket.id);
  });

  socket.on('disconnect', () => {
    waiting.delete(socket.id);
    leaveRoom(socket, true);
    broadcastOnline();
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n  Unalone server running → http://localhost:${PORT}\n`);
});
