// server/friendsStore.js
// Simple in-memory store. Swap to DB later if you want.
// Keys are lowercase wallet/user IDs.

const norm = (s) => (s || '').trim().toLowerCase();

const state = new Map(); // address -> { friends:Set, pendingIn:Set, pendingOut:Set }

function ensureUser(addr) {
  addr = norm(addr);
  if (!state.has(addr)) {
    state.set(addr, {
      friends: new Set(),
      pendingIn: new Set(),
      pendingOut: new Set(),
    });
  }
  return state.get(addr);
}

function sendRequest(from, to) {
  from = norm(from);
  to = norm(to);
  if (!from || !to || from === to) return { ok: false, error: 'bad-addr' };

  const A = ensureUser(from);
  const B = ensureUser(to);

  if (A.friends.has(to)) return { ok: false, error: 'already-friends' };
  if (A.pendingOut.has(to)) return { ok: false, error: 'already-sent' };
  if (A.pendingIn.has(to)) {
    // They had already sent you one — auto accept both ways.
    A.pendingIn.delete(to);
    B.pendingOut.delete(from);
    A.friends.add(to);
    B.friends.add(from);
    return { ok: true, autoAccepted: true };
  }

  A.pendingOut.add(to);
  B.pendingIn.add(from);
  return { ok: true };
}

function respond(to, from, accept) {
  // "to" == person responding, "from" == original sender
  to = norm(to);
  from = norm(from);

  const T = ensureUser(to);
  const F = ensureUser(from);

  if (!T.pendingIn.has(from)) return { ok: false, error: 'no-request' };

  T.pendingIn.delete(from);
  F.pendingOut.delete(to);

  if (accept) {
    T.friends.add(from);
    F.friends.add(to);
  }
  return { ok: true };
}

function list(addr) {
  addr = norm(addr);
  const U = ensureUser(addr);
  return {
    friends: [...U.friends],
    pendingIn: [...U.pendingIn],
    pendingOut: [...U.pendingOut],
  };
}

// your existing functions here: norm, list, sendRequest, respond

export default { norm, list, sendRequest, respond };
