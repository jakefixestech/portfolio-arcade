import type { APIRoute } from 'astro';

const BLOCKED_INITIALS = [
  'ASS', 'FAG', 'KKK', 'NIG', 'CUM', 'TIT', 'JEW', 'NAZ', 'JAP',
  'GAY', 'FCK', 'SHT', 'DCK', 'SUC', 'HOE', 'CNT', 'WTF', 'STD',
  'PIS', 'PSY', 'POO', 'PEE', 'BUT', 'SEX', 'HIV'
];

// Per-game realistic score ceilings. Blocks fake scores like Aaron's 10M.
// Anything above these is humanly impossible given each game's mechanics.
const MAX_SCORE_PER_GAME: Record<string, number> = {
  'whack-a-virus':   200,    // ~60 realistic in 30s, 200 is wildly generous
  'system-response': 1000,   // hard cap from formula: max(0, 1000 - avgMs)
  'component-match': 90000,  // 90s timer, score = remaining ms
  'error-override':  200,    // 200 WPM is world-class typing speed
  'cursor-crawl':    400,    // 400 bugs eaten = entire 20x20 grid
  'usb-defender':    500,    // 500 deflections = serious endurance run
  'bug-smasher':     5000,   // 40 bugs/wave x many waves
  'spam-blaster':    5000,   // wave bonuses + kills add up
  'tower-stack':     50000,  // tetris-style; strong sustained run before topping out from speed
  'packet-sort':     10000,  // ~3-4k for perfect run with wave bonuses; generous ceiling
  'loop-trap':       100000, // pac-man; ~1400/level perfect + bonuses; deep run could approach this
  'cable-untangle':  25000,  // 7 cables/level cap, ~700+bonus per level, deep run ceiling
};

const MAX_SCORES = 10;
const MAX_PAYLOAD_BYTES = 1000;

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
}

export const GET: APIRoute = async ({ params, locals }) => {
  const game = params.game;
  if (!game || !/^[a-z0-9-]+$/.test(game)) {
    return jsonResponse({ error: 'Invalid game' }, 400);
  }

  // @ts-ignore
  const kv = locals?.runtime?.env?.SCORES_KV;
  if (!kv) {
    return jsonResponse({ scores: [] });
  }

  const stored = await kv.get(`scores:${game}`);
  const scores = stored ? JSON.parse(stored) : [];
  return jsonResponse({ scores });
};

export const POST: APIRoute = async ({ params, request, locals }) => {
  const game = params.game;
  if (!game || !/^[a-z0-9-]+$/.test(game)) {
    return jsonResponse({ error: 'Invalid game' }, 400);
  }

  // Reject unknown games — only games in MAX_SCORE_PER_GAME can submit
  const maxForGame = MAX_SCORE_PER_GAME[game];
  if (maxForGame === undefined) {
    return jsonResponse({ error: 'Unknown game' }, 400);
  }

  // Reject oversized payloads early (legit body is ~60 bytes)
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > MAX_PAYLOAD_BYTES) {
    return jsonResponse({ error: 'Payload too large' }, 413);
  }

  // @ts-ignore
  const kv = locals?.runtime?.env?.SCORES_KV;
  if (!kv) {
    return jsonResponse({ error: 'Storage unavailable' }, 500);
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const initials = String(body.initials || '').toUpperCase().trim();
  const score = Number(body.score);

  if (!/^[A-Z]{3}$/.test(initials)) {
    return jsonResponse({ error: 'Initials must be 3 letters A-Z' }, 400);
  }
  if (BLOCKED_INITIALS.includes(initials)) {
    return jsonResponse({ error: 'Please choose different initials' }, 400);
  }
  if (!Number.isFinite(score) || score < 0 || score > maxForGame) {
    return jsonResponse({ error: 'Invalid score' }, 400);
  }

  const kvKey = `scores:${game}`;
  const stored = await kv.get(kvKey);
  const scores = stored ? JSON.parse(stored) : [];

  const newEntry = {
    initials,
    score,
    timestamp: new Date().toISOString()
  };
  scores.push(newEntry);

  scores.sort((a: any, b: any) => b.score - a.score);
  const topScores = scores.slice(0, MAX_SCORES);

  await kv.put(kvKey, JSON.stringify(topScores));

  const rank = topScores.findIndex(
    (s: any) => s.initials === newEntry.initials && s.score === newEntry.score && s.timestamp === newEntry.timestamp
  );
  const madeLeaderboard = rank !== -1;

  return jsonResponse({
    success: true,
    madeLeaderboard,
    rank: madeLeaderboard ? rank + 1 : null,
    scores: topScores
  });
};