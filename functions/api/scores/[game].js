// Pages Function — handles GET (read top 10) and POST (submit score) for any game.
// URL: /api/scores/{game-slug}  (e.g. /api/scores/whack-a-virus)

// Block list for 3-letter initials. Add to it if you spot anything missed.
const BLOCKED_INITIALS = [
  'ASS', 'FAG', 'KKK', 'NIG', 'CUM', 'TIT', 'JEW', 'NAZ', 'JAP',
  'GAY', 'FCK', 'SHT', 'DCK', 'SUC', 'HOE', 'CNT', 'WTF', 'STD',
  'PIS', 'PSY', 'POO', 'PEE', 'BUT', 'SEX', 'HIV'
];

const MAX_SCORES = 10;

export async function onRequest(context) {
  const { request, env, params } = context;
  const game = params.game;

  // Validate game slug — only allow lowercase letters, numbers, hyphens
  if (!game || !/^[a-z0-9-]+$/.test(game)) {
    return jsonResponse({ error: 'Invalid game' }, 400);
  }

  const kvKey = `scores:${game}`;

  // GET — return top 10 scores
  if (request.method === 'GET') {
    const stored = await env.SCORES_KV.get(kvKey);
    const scores = stored ? JSON.parse(stored) : [];
    return jsonResponse({ scores });
  }

  // POST — submit a new score
  if (request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON' }, 400);
    }

    const initials = String(body.initials || '').toUpperCase().trim();
    const score = Number(body.score);

    // Validate initials: exactly 3 uppercase letters A-Z
    if (!/^[A-Z]{3}$/.test(initials)) {
      return jsonResponse({ error: 'Initials must be 3 letters A-Z' }, 400);
    }
    if (BLOCKED_INITIALS.includes(initials)) {
      return jsonResponse({ error: 'Please choose different initials' }, 400);
    }
    if (!Number.isFinite(score) || score < 0 || score > 1000000) {
      return jsonResponse({ error: 'Invalid score' }, 400);
    }

    // Read current scores, add new one, sort, trim to top 10
    const stored = await env.SCORES_KV.get(kvKey);
    const scores = stored ? JSON.parse(stored) : [];

    scores.push({
      initials,
      score,
      timestamp: new Date().toISOString()
    });

    scores.sort((a, b) => b.score - a.score);
    const topScores = scores.slice(0, MAX_SCORES);

    await env.SCORES_KV.put(kvKey, JSON.stringify(topScores));

    // Find rank of the new score so the UI can show "you're #3!"
    const rank = topScores.findIndex(
      s => s.initials === initials && s.score === score && s.timestamp === scores[scores.length - 1].timestamp
    );
    const madeLeaderboard = rank !== -1;

    return jsonResponse({
      success: true,
      madeLeaderboard,
      rank: madeLeaderboard ? rank + 1 : null,
      scores: topScores
    });
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
}