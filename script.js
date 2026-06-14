/* =============================================
   FIFA 2026 LIVE TV — script.js
   ============================================= */

const CHANNELS_URL = 'fifa.json';
const FIXTURE_URL  = 'fixture.json';

let channels     = [];
let activeIndex  = -1;
let shakaPlayer  = null;
let hlsInstance  = null;

// ── Helpers ──────────────────────────────────

function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Navbar channel cards ──────────────────────

function buildChannelStrip(channels) {
    const strip = document.getElementById('channelStrip');
    strip.innerHTML = '';

    channels.forEach((ch, i) => {
        const card = document.createElement('button');
        card.className = 'channel-card';
        card.dataset.index = i;
        card.setAttribute('aria-label', ch.name);
        card.innerHTML = `
            <img src="${ch.logo}" alt="${ch.name}"
                 onerror="this.style.display='none'" />
            <span class="channel-card-name">${ch.name}</span>
        `;
        card.addEventListener('click', () => loadChannel(i));
        strip.appendChild(card);
    });

    // Arrow scroll
    const leftBtn  = document.getElementById('scrollLeft');
    const rightBtn = document.getElementById('scrollRight');
    leftBtn.addEventListener('click',  () => strip.scrollBy({ left: -200, behavior: 'smooth' }));
    rightBtn.addEventListener('click', () => strip.scrollBy({ left:  200, behavior: 'smooth' }));
}

function setActiveCard(index) {
    document.querySelectorAll('.channel-card').forEach((card, i) => {
        card.classList.toggle('active', i === index);
    });

    // Scroll active card into view
    const cards = document.querySelectorAll('.channel-card');
    if (cards[index]) {
        cards[index].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
}

// ── Player state UI ──────────────────────────

function showLoading(name) {
    const placeholder = document.getElementById('playerPlaceholder');
    placeholder.style.display = 'flex';
    document.getElementById('videoPlayer').style.display = 'none';

    document.getElementById('loadingSpinner').style.display = 'block';
    document.getElementById('trophyIcon').style.display = 'none';
    document.getElementById('placeholderTitle').textContent = name;
    document.getElementById('placeholderSub').textContent = 'Connecting to stream…';
}

function showError(msg) {
    const placeholder = document.getElementById('playerPlaceholder');
    placeholder.style.display = 'flex';
    document.getElementById('videoPlayer').style.display = 'none';

    document.getElementById('loadingSpinner').style.display = 'none';
    document.getElementById('trophyIcon').style.display = 'block';
    document.getElementById('trophyIcon').textContent = '📡';
    document.getElementById('placeholderTitle').textContent = 'Stream Unavailable';
    document.getElementById('placeholderSub').textContent = msg;
}

function showPlayer() {
    document.getElementById('playerPlaceholder').style.display = 'none';
    const video = document.getElementById('videoPlayer');
    video.style.display = 'block';
}

// ── Now-playing bar ──────────────────────────

function updateNowPlaying(ch) {
    const logo   = document.getElementById('activeChannelLogo');
    const nameEl = document.getElementById('activeChannelName');
    logo.src = ch.logo;
    logo.style.display = 'block';
    nameEl.textContent = ch.name;
}

// ── Channel load ─────────────────────────────

async function loadChannel(index) {
    if (activeIndex === index) return;
    activeIndex = index;

    const ch = channels[index];
    setActiveCard(index);
    updateNowPlaying(ch);
    showLoading(ch.name);

    const video = document.getElementById('videoPlayer');
    await destroyPlayers();

    if (ch.type === 'dash') {
        await playDash(video, ch);
    } else {
        playHls(video, ch);
    }
}

async function destroyPlayers() {
    if (shakaPlayer) {
        try { await shakaPlayer.destroy(); } catch(e) {}
        shakaPlayer = null;
    }
    if (hlsInstance) {
        hlsInstance.destroy();
        hlsInstance = null;
    }
    const video = document.getElementById('videoPlayer');
    video.removeAttribute('src');
    video.load();
}

// ── DASH via Shaka ───────────────────────────

async function playDash(video, ch) {
    if (typeof shaka === 'undefined' || !shaka.Player) {
        showError('Shaka Player failed to load.');
        return;
    }

    shaka.polyfill.installAll();

    if (!shaka.Player.isBrowserSupported()) {
        showError('Your browser does not support DASH/DRM playback.');
        return;
    }

    shakaPlayer = new shaka.Player();
    await shakaPlayer.attach(video);

    if (ch.kid && ch.key) {
        shakaPlayer.configure({
            drm: { clearKeys: { [ch.kid]: ch.key } }
        });
    }

    shakaPlayer.addEventListener('error', (e) => {
        console.error('Shaka error:', e.detail);
        showError('Stream error — it may be geo-restricted or offline.');
    });

    video.addEventListener('canplay', showPlayer, { once: true });

    try {
        await shakaPlayer.load(ch.url);
        video.play().catch(() => {});
    } catch (err) {
        console.error('Shaka load error:', err);
        showError('Unable to load stream — geo-restricted or offline.');
    }
}

// ── HLS via hls.js ───────────────────────────

function playHls(video, ch) {
    if (Hls.isSupported()) {
        hlsInstance = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 30
        });
        hlsInstance.loadSource(ch.url);
        hlsInstance.attachMedia(video);

        hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
            showPlayer();
            video.play().catch(() => {});
        });

        hlsInstance.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
                console.error('HLS error:', data);
                showError('Stream unavailable — geo-restricted or offline.');
            }
        });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = ch.url;
        video.addEventListener('loadedmetadata', () => {
            showPlayer();
            video.play().catch(() => {});
        }, { once: true });
    } else {
        showError('HLS playback not supported in this browser.');
    }
}

// ── Fixtures ─────────────────────────────────

const ROUND_LABELS = {
    1: 'Group Stage — Matchday 1',
    2: 'Group Stage — Matchday 2',
    3: 'Group Stage — Matchday 3',
    4: 'Round of 32',
    5: 'Round of 16',
    6: 'Quarter-Finals',
    7: 'Semi-Finals',
    8: 'Final'
};

const PAGE_SIZE = 6;
let allFixtures  = [];
let currentPage  = 1;

function getMatchStatus(f) {
    const now      = new Date();
    const matchEnd = new Date(new Date(f.DateUtc).getTime() + 110 * 60 * 1000); // ~110 min after kickoff
    const matchStart = new Date(f.DateUtc);

    if (f.Winner !== '' || f.HomeTeamScore !== null) return 'finished';
    if (now >= matchStart && now <= matchEnd) return 'live';
    return 'upcoming';
}

function isMatchOver(f) {
    // A match is "over" if it has a result OR kickoff was >110 min ago
    const now = new Date();
    const matchEnd = new Date(new Date(f.DateUtc).getTime() + 110 * 60 * 1000);
    return (f.Winner !== '' || f.HomeTeamScore !== null) && now > matchEnd;
}

function flagUrl(teamName) {
    // Map common team names to ISO country codes for flag CDN
    const map = {
        'Mexico': 'mx', 'South Africa': 'za', 'Korea Republic': 'kr', 'Czechia': 'cz',
        'Canada': 'ca', 'Bosnia and Herzegovina': 'ba', 'USA': 'us', 'Paraguay': 'py',
        'Qatar': 'qa', 'Switzerland': 'ch', 'Brazil': 'br', 'Morocco': 'ma',
        'Haiti': 'ht', 'Scotland': 'gb-sct', 'Australia': 'au', 'Türkiye': 'tr',
        'Germany': 'de', 'Curaçao': 'cw', 'Netherlands': 'nl', 'Japan': 'jp',
        "Côte d'Ivoire": 'ci', 'Ecuador': 'ec', 'Sweden': 'se', 'Tunisia': 'tn',
        'Spain': 'es', 'Cabo Verde': 'cv', 'Belgium': 'be', 'Egypt': 'eg',
        'Saudi Arabia': 'sa', 'Uruguay': 'uy', 'IR Iran': 'ir', 'New Zealand': 'nz',
        'France': 'fr', 'Senegal': 'sn', 'Iraq': 'iq', 'Norway': 'no',
        'Argentina': 'ar', 'Algeria': 'dz', 'Austria': 'at', 'Jordan': 'jo',
        'Portugal': 'pt', 'Congo DR': 'cd', 'England': 'gb-eng', 'Croatia': 'hr',
        'Ghana': 'gh', 'Panama': 'pa', 'Uzbekistan': 'uz', 'Colombia': 'co',
        'TBA': null, 'To be announced': null
    };
    const code = map[teamName];
    return code ? `https://flagcdn.com/w40/${code}.png` : null;
}

function scoreDisplay(f) {
    if (f.HomeTeamScore !== null && f.AwayTeamScore !== null) {
        return `<span class="score-box">${f.HomeTeamScore} — ${f.AwayTeamScore}</span>`;
    }
    return `<span class="fixture-vs">VS</span>`;
}

function buildFixtureCard(f) {
    const status      = getMatchStatus(f);
    const statusClass = status;
    const statusLabel = status === 'live'     ? '🔴 LIVE NOW'
                      : status === 'finished'  ? (f.Winner === 'Draw' ? 'Draw' : `✓ ${f.Winner} Win`)
                      : formatKickoff(f.DateUtc);

    const homeFlagUrl = flagUrl(f.HomeTeam);
    const awayFlagUrl = flagUrl(f.AwayTeam);

    const card = document.createElement('div');
    card.className = `fixture-card ${status === 'live' ? 'fixture-live' : ''}`;
    card.innerHTML = `
        <div class="fixture-meta">
            <span class="fixture-group">${f.Group || 'Knockout'}</span>
            <span class="fixture-location">📍 ${f.Location}</span>
        </div>
        <div class="fixture-teams">
            <div class="team ${f.Winner === f.HomeTeam ? 'team-winner' : ''}">
                ${homeFlagUrl ? `<img class="team-flag" src="${homeFlagUrl}" alt="${f.HomeTeam}" onerror="this.style.display='none'" />` : '<span class="flag-placeholder">🏳</span>'}
                <span class="team-name">${f.HomeTeam}</span>
            </div>
            ${scoreDisplay(f)}
            <div class="team ${f.Winner === f.AwayTeam ? 'team-winner' : ''}">
                ${awayFlagUrl ? `<img class="team-flag" src="${awayFlagUrl}" alt="${f.AwayTeam}" onerror="this.style.display='none'" />` : '<span class="flag-placeholder">🏳</span>'}
                <span class="team-name">${f.AwayTeam}</span>
            </div>
        </div>
        <div style="display:flex;justify-content:center;margin-top:10px;">
            <span class="fixture-status ${statusClass}">${statusLabel}</span>
        </div>
    `;
    return card;
}

function formatKickoff(dateUtc) {
    const d = new Date(dateUtc);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
         + ' · ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + ' UTC';
}

function renderFixtures() {
    const grid = document.getElementById('fixtureGrid');
    grid.innerHTML = '';

    // Filter out fully completed past matches
    const visible = allFixtures.filter(f => !isMatchOver(f));

    if (!visible.length) {
        grid.innerHTML = `<div class="no-fixtures">No upcoming fixtures right now.</div>`;
        return;
    }

    // Group by round
    const byRound = {};
    visible.forEach(f => {
        const r = f.RoundNumber;
        if (!byRound[r]) byRound[r] = [];
        byRound[r].push(f);
    });

    const rounds = Object.keys(byRound).map(Number).sort((a, b) => a - b);

    // Flatten with round headers, then paginate
    const flatItems = []; // { type: 'header'|'card', data }
    rounds.forEach(r => {
        flatItems.push({ type: 'header', label: ROUND_LABELS[r] || `Round ${r}` });
        byRound[r].forEach(f => flatItems.push({ type: 'card', data: f }));
    });

    // Count cards only for pagination
    const cards = flatItems.filter(i => i.type === 'card');
    const totalCards  = cards.length;
    const totalPages  = Math.ceil(totalCards / PAGE_SIZE);
    currentPage = Math.min(currentPage, totalPages || 1);

    const startCard = (currentPage - 1) * PAGE_SIZE;
    const endCard   = startCard + PAGE_SIZE;
    const pageCards = new Set(cards.slice(startCard, endCard).map(i => i.data));

    // Render: only show round header if at least one card in that round is on this page
    let lastRound = null;
    flatItems.forEach(item => {
        if (item.type === 'header') {
            lastRound = item.label;
            return;
        }
        if (!pageCards.has(item.data)) return;

        // Inject round header before first card of that round on this page
        if (lastRound) {
            const hdr = document.createElement('div');
            hdr.className = 'round-header';
            hdr.textContent = lastRound;
            grid.appendChild(hdr);
            lastRound = null;
        }
        grid.appendChild(buildFixtureCard(item.data));
    });

    // Pagination controls
    if (totalPages > 1) {
        const pag = document.createElement('div');
        pag.className = 'pagination';
        pag.innerHTML = `
            <button class="pag-btn" id="pagPrev" ${currentPage <= 1 ? 'disabled' : ''}>← Prev</button>
            <span class="pag-info">Page ${currentPage} / ${totalPages}
                <small>(${totalCards} matches)</small>
            </span>
            <button class="pag-btn" id="pagNext" ${currentPage >= totalPages ? 'disabled' : ''}>See More →</button>
        `;
        grid.appendChild(pag);

        pag.querySelector('#pagPrev').addEventListener('click', () => {
            currentPage--;
            renderFixtures();
            document.querySelector('.fixture-section').scrollIntoView({ behavior: 'smooth' });
        });
        pag.querySelector('#pagNext').addEventListener('click', () => {
            currentPage++;
            renderFixtures();
            document.querySelector('.fixture-section').scrollIntoView({ behavior: 'smooth' });
        });
    }
}

async function loadFixtures() {
    const grid = document.getElementById('fixtureGrid');
    try {
        const res = await fetch(FIXTURE_URL);
        if (!res.ok) throw new Error('not found');
        allFixtures = await res.json();
        currentPage = 1;
        renderFixtures();
    } catch {
        grid.innerHTML = `<div class="no-fixtures">Fixture data will be available soon.</div>`;
    }
}

// ── Init: auto-play first channel ────────────

async function init() {
    try {
        const res = await fetch(CHANNELS_URL);
        channels = await res.json();
        buildChannelStrip(channels);

        // Auto-play first channel on load
        if (channels.length > 0) {
            loadChannel(0);
        }
    } catch (err) {
        console.error('Failed to load channels:', err);
        document.getElementById('channelStrip').innerHTML =
            '<span style="color:#666;font-size:12px;padding:0 16px;">Could not load channels</span>';
    }

    loadFixtures();
}

document.addEventListener('DOMContentLoaded', init);
