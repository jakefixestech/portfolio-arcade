import type { APIRoute } from 'astro';

const BLOCKED_INITIALS = [
  'ASS', 'FAG', 'KKK', 'NIG', 'CUM', 'TIT', 'JEW', 'NAZ', 'JAP',
  'GAY', 'FCK', 'SHT', 'DCK', 'SUC', 'HOE', 'CNT', 'WTF', 'STD',
  'PIS', 'PSY', 'POO', 'PEE', 'BUT', 'SEX', 'HIV'
];

const MAX_SCORES = 10;

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
  if (!Number.isFinite(score) || score < 0 || score > 1000000) {
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