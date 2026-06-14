/* =============================================
   FIFA 2026 LIVE TV — script.js
   ============================================= */

const CHANNELS_URL = 'fifa.json';
const FIXTURE_URL  = 'fixture.json';

let channels     = [];
let activeIndex  = -1;
let shakaPlayer  = null;
let hlsInstance  = null;

// ── Helpers ─────────────────────────────────

function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(timeStr) {
    return timeStr || '';
}

// ── Build Navbar Channels ────────────────────

function buildChannelStrip(channels) {
    const strip = document.getElementById('channelStrip');
    strip.innerHTML = '';

    channels.forEach((ch, i) => {
        const btn = document.createElement('button');
        btn.className = 'channel-btn';
        btn.dataset.index = i;
        btn.innerHTML = `
            <img src="${ch.logo}" alt="${ch.name}" onerror="this.style.display='none'" />
            ${ch.name}
        `;
        btn.addEventListener('click', () => loadChannel(i));
        strip.appendChild(btn);
    });
}

// ── Channel Playback ─────────────────────────

async function loadChannel(index) {
    if (activeIndex === index) return;
    activeIndex = index;

    const ch = channels[index];

    // Update active button
    document.querySelectorAll('.channel-btn').forEach((btn, i) => {
        btn.classList.toggle('active', i === index);
    });

    // Update now-playing
    const logo = document.getElementById('activeChannelLogo');
    const nameEl = document.getElementById('activeChannelName');
    logo.src = ch.logo;
    logo.style.display = 'block';
    nameEl.textContent = ch.name;

    // Hide placeholder, show video
    document.getElementById('playerPlaceholder').style.display = 'none';
    const video = document.getElementById('videoPlayer');
    video.style.display = 'block';

    // Destroy previous player
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
    video.src = '';
    video.load();
}

async function playDash(video, ch) {
    if (!shaka || !shaka.Player) {
        showError('Shaka Player not loaded.');
        return;
    }

    shaka.polyfill.installAll();

    if (!shaka.Player.isBrowserSupported()) {
        showError('Your browser does not support DASH playback.');
        return;
    }

    shakaPlayer = new shaka.Player();
    await shakaPlayer.attach(video);

    // DRM config if kid/key exist
    if (ch.kid && ch.key) {
        shakaPlayer.configure({
            drm: {
                clearKeys: {
                    [ch.kid]: ch.key
                }
            }
        });
    }

    shakaPlayer.addEventListener('error', (e) => {
        console.error('Shaka error:', e.detail);
        showError(`Stream error: ${e.detail.message || 'Unknown error'}`);
    });

    try {
        await shakaPlayer.load(ch.url);
        video.play().catch(() => {});
    } catch (err) {
        console.error('Load error:', err);
        showError('Unable to load this stream. It may be geo-restricted or offline.');
    }
}

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
            video.play().catch(() => {});
        });
        hlsInstance.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
                console.error('HLS fatal error:', data);
                showError('Unable to load HLS stream. It may be offline or geo-restricted.');
            }
        });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS (Safari)
        video.src = ch.url;
        video.addEventListener('loadedmetadata', () => video.play().catch(() => {}));
    } else {
        showError('HLS is not supported in this browser.');
    }
}

function showError(msg) {
    const placeholder = document.getElementById('playerPlaceholder');
    placeholder.style.display = 'flex';
    document.getElementById('videoPlayer').style.display = 'none';
    placeholder.querySelector('.placeholder-title').textContent = 'Stream Unavailable';
    placeholder.querySelector('.placeholder-sub').textContent = msg;
    placeholder.querySelector('.trophy-icon').textContent = '📡';
}

// ── Fixtures ─────────────────────────────────

async function loadFixtures() {
    const grid = document.getElementById('fixtureGrid');
    try {
        const res = await fetch(FIXTURE_URL);
        if (!res.ok) throw new Error('Not found');
        const fixtures = await res.json();

        if (!fixtures.length) {
            grid.innerHTML = `<div class="no-fixtures">Fixtures will be published soon. Stay tuned!</div>`;
            return;
        }

        grid.innerHTML = '';
        fixtures.forEach(f => {
            const card = document.createElement('div');
            card.className = 'fixture-card';

            const statusClass = f.status === 'live' ? 'live'
                              : f.status === 'finished' ? 'finished'
                              : 'upcoming';
            const statusLabel = f.status === 'live'     ? '🔴 LIVE'
                              : f.status === 'finished'  ? 'Full Time'
                              : 'Upcoming';

            card.innerHTML = `
                <div class="fixture-meta">
                    <span class="fixture-group">${f.group || 'FIFA 2026'}</span>
                    <span class="fixture-datetime">${formatDate(f.date)} · ${formatTime(f.time)}</span>
                </div>
                <div class="fixture-teams">
                    <div class="team">
                        ${f.homeLogo ? `<img class="team-flag" src="${f.homeLogo}" alt="${f.homeTeam}" onerror="this.style.display='none'" />` : ''}
                        <span class="team-name">${f.homeTeam}</span>
                    </div>
                    <span class="fixture-vs">VS</span>
                    <div class="team">
                        ${f.awayLogo ? `<img class="team-flag" src="${f.awayLogo}" alt="${f.awayTeam}" onerror="this.style.display='none'" />` : ''}
                        <span class="team-name">${f.awayTeam}</span>
                    </div>
                </div>
                ${f.venue ? `<div class="fixture-venue">📍 ${f.venue}</div>` : ''}
                <div style="display:flex;justify-content:center;">
                    <span class="fixture-status ${statusClass}">${statusLabel}</span>
                </div>
            `;
            grid.appendChild(card);
        });
    } catch (err) {
        grid.innerHTML = `<div class="no-fixtures">Fixture data will be available soon.</div>`;
        console.info('Fixtures not loaded:', err.message);
    }
}

// ── Init ─────────────────────────────────────

async function init() {
    try {
        const res = await fetch(CHANNELS_URL);
        channels = await res.json();
        buildChannelStrip(channels);
    } catch (err) {
        console.error('Failed to load channels:', err);
        document.getElementById('channelStrip').innerHTML =
            '<span style="color:#666;font-size:12px;">Failed to load channels</span>';
    }

    await loadFixtures();
}

document.addEventListener('DOMContentLoaded', init);
