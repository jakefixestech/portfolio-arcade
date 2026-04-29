(function () {
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fetchLeaderboard(slug) {
    return fetch('/api/scores/' + slug)
      .then(function (res) { return res.json(); })
      .then(function (data) { return data.scores || []; })
      .catch(function () { return []; });
  }

  function renderTop3(slug, scores) {
    var block = document.querySelector('.game-block[data-game-slug="' + slug + '"]');
    if (!block) return;
    var lb = block.querySelector('.game-leaderboard');
    if (!lb) return;

    var top3 = scores.slice(0, 3);

    if (top3.length === 0) {
      lb.innerHTML = '<p class="leaderboard-eyebrow">TOP 3</p><p class="leaderboard-empty">No scores yet. Be the first.</p>';
      return;
    }

    var rowsHtml = '';
    top3.forEach(function (entry, idx) {
      var rank = idx + 1;
      rowsHtml +=
        '<li class="leaderboard-row leaderboard-row--' + rank + '">' +
          '<span class="rank-num">' + rank + '</span>' +
          '<span class="rank-initials">' + escapeHtml(entry.initials) + '</span>' +
          '<span class="rank-score">' + entry.score + '</span>' +
        '</li>';
    });

    lb.innerHTML =
      '<p class="leaderboard-eyebrow">TOP 3</p>' +
      '<ol class="leaderboard-list">' + rowsHtml + '</ol>';
  }

  function showChampion(allScores) {
    var points = {};
    allScores.forEach(function (scores) {
      scores.forEach(function (entry, idx) {
        var rank = idx + 1;
        if (!points[entry.initials]) {
          points[entry.initials] = { points: 0, gamesPlayed: 0 };
        }
        points[entry.initials].points += rank;
        points[entry.initials].gamesPlayed += 1;
      });
    });

    var eligible = [];
    for (var initials in points) {
      if (points[initials].gamesPlayed >= 2) {
        eligible.push({
          initials: initials,
          points: points[initials].points,
          gamesPlayed: points[initials].gamesPlayed
        });
      }
    }

    if (eligible.length === 0) return;
    eligible.sort(function (a, b) { return a.points - b.points; });
    var champ = eligible[0];

    var card = document.querySelector('.champion-card');
    if (!card) return;

    card.classList.remove('champion-card--empty');
    card.classList.add('champion-card--active');

    card.innerHTML =
      '<div class="champ-rays" aria-hidden="true">' +
        '<span class="ray ray-1"></span>' +
        '<span class="ray ray-2"></span>' +
        '<span class="ray ray-3"></span>' +
        '<span class="ray ray-4"></span>' +
        '<span class="ray ray-5"></span>' +
        '<span class="ray ray-6"></span>' +
      '</div>' +
      '<div class="champ-trophy" aria-hidden="true">' +
        '<div class="champ-trophy-glow"></div>' +
        '<svg viewBox="0 0 80 90" xmlns="http://www.w3.org/2000/svg">' +
          '<path d="M 18 24 Q 6 24 6 38 Q 6 50 18 50" fill="none" stroke="#fbbf24" stroke-width="3" stroke-linecap="round" />' +
          '<path d="M 62 24 Q 74 24 74 38 Q 74 50 62 50" fill="none" stroke="#fbbf24" stroke-width="3" stroke-linecap="round" />' +
          '<path d="M 16 16 L 64 16 L 60 54 Q 58 60 50 62 L 30 62 Q 22 60 20 54 Z" fill="#fbbf24" stroke="#92400e" stroke-width="1.5" stroke-linejoin="round" />' +
          '<path d="M 22 20 L 28 20 L 26 52 Q 25 56 23 58 L 22 58 Z" fill="#fde68a" opacity="0.6" />' +
          '<rect x="14" y="13" width="52" height="6" rx="1" fill="#fbbf24" stroke="#92400e" stroke-width="1.5" />' +
          '<path d="M 40 28 L 43 36 L 51 37 L 45 42 L 47 50 L 40 46 L 33 50 L 35 42 L 29 37 L 37 36 Z" fill="#fff" />' +
          '<rect x="34" y="62" width="12" height="10" fill="#d97706" stroke="#92400e" stroke-width="1.5" />' +
          '<path d="M 24 72 L 56 72 L 60 86 L 20 86 Z" fill="#d97706" stroke="#92400e" stroke-width="1.5" stroke-linejoin="round" />' +
        '</svg>' +
      '</div>' +
      '<div class="champ-content">' +
        '<div class="champ-badge">' +
          '<span class="champ-badge-dot"></span>' +
          '<span>REIGNING CHAMPION</span>' +
        '</div>' +
        '<div class="champ-initials">' + escapeHtml(champ.initials) + '</div>' +
        '<p class="champ-stats">' +
          '<strong>' + champ.points + '</strong> rank points across <strong>' + champ.gamesPlayed + '</strong> games' +
        '</p>' +
        '<p class="champ-note">' +
          'The fewer points, the better. Top this player by ranking high in more games.' +
        '</p>' +
      '</div>';
  }

  function loadAll() {
    var blocks = document.querySelectorAll('.game-block[data-game-slug]');
    var slugs = [];
    blocks.forEach(function (b) {
      var s = b.getAttribute('data-game-slug');
      if (s) slugs.push(s);
    });

    Promise.all(slugs.map(fetchLeaderboard)).then(function (allScores) {
      slugs.forEach(function (slug, idx) {
        renderTop3(slug, allScores[idx]);
      });
      showChampion(allScores);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadAll);
  } else {
    loadAll();
  }
})();