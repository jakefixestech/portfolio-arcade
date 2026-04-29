function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function fetchOne(slug) {
  try {
    const res = await fetch(`/api/scores/${slug}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.scores || [];
  } catch {
    return [];
  }
}

function renderLeaderboard(slug, scores) {
  const block = document.querySelector(`.game-block[data-game-slug="${slug}"]`);
  if (!block) return;
  const lb = block.querySelector('.game-leaderboard');
  if (!lb) return;

  const top3 = scores.slice(0, 3);
  if (top3.length === 0) {
    lb.innerHTML = '<p class="leaderboard-eyebrow">TOP 3</p><p class="leaderboard-empty">No scores yet. Be the first.</p>';
    return;
  }

  const rows = top3.map((entry, i) => `
    <li class="leaderboard-row leaderboard-row--${i + 1}">
      <span class="rank-num">${i + 1}</span>
      <span class="rank-initials">${escapeHtml(entry.initials)}</span>
      <span class="rank-score">${entry.score}</span>
    </li>
  `).join('');

  lb.innerHTML = `<p class="leaderboard-eyebrow">TOP 3</p><ol class="leaderboard-list">${rows}</ol>`;
}

function computeChampion(allScores) {
  const points = {};
  allScores.forEach(scores => {
    scores.forEach((entry, rank) => {
      const p = rank + 1;
      if (!points[entry.initials]) points[entry.initials] = { points: 0, gamesPlayed: 0 };
      points[entry.initials].points += p;
      points[entry.initials].gamesPlayed += 1;
    });
  });

  const eligible = Object.entries(points).filter(([_, p]) => p.gamesPlayed >= 2);
  if (eligible.length === 0) return null;
  eligible.sort((a, b) => a[1].points - b[1].points);
  return { initials: eligible[0][0], points: eligible[0][1].points, gamesPlayed: eligible[0][1].gamesPlayed };
}

function showChampion(champ) {
  if (!champ) return;
  const card = document.getElementById('champion-card');
  const empty = document.getElementById('champion-empty');
  const active = document.getElementById('champion-active');
  const initials = document.getElementById('champ-initials-text');
  const pts = document.getElementById('champ-points');
  const games = document.getElementById('champ-games');

  if (initials) initials.textContent = champ.initials;
  if (pts) pts.textContent = String(champ.points);
  if (games) games.textContent = String(champ.gamesPlayed);

  if (empty) empty.style.display = 'none';
  if (active) active.style.display = '';
  if (card) {
    card.classList.remove('champion-card--empty');
    card.classList.add('champion-card--active');
  }
}

async function init() {
  const blocks = document.querySelectorAll('.game-block[data-game-slug]');
  const slugs = Array.from(blocks).map(b => b.getAttribute('data-game-slug')).filter(Boolean);
  const all = await Promise.all(slugs.map(fetchOne));
  slugs.forEach((slug, i) => renderLeaderboard(slug, all[i]));
  showChampion(computeChampion(all));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}