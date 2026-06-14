/* =============================================
   FIFA 2026 LIVE TV — script.js
   ============================================= */

const CHANNELS_URL = './fifa.json';
const FIXTURE_URL  = './fixture.json';

let channels    = [];
let activeIndex = -1;
let shakaPlayer = null;
let hlsInstance = null;

/* ─────────────────────────────────────────────
   CHANNEL STRIP
───────────────────────────────────────────── */

function buildChannelStrip(list) {
    const strip = document.getElementById('channelStrip');
    strip.innerHTML = '';

    list.forEach((ch, i) => {
        const card = document.createElement('button');
        card.className = 'channel-card';
        card.setAttribute('aria-label', ch.name);
        card.innerHTML = `
            <img src="${ch.logo}" alt="${ch.name}" onerror="this.style.display='none'" />
            <span class="channel-card-name">${ch.name}</span>
        `;
        card.addEventListener('click', () => loadChannel(i));
        strip.appendChild(card);
    });

    document.getElementById('scrollLeft').addEventListener('click', () =>
        strip.scrollBy({ left: -220, behavior: 'smooth' }));
    document.getElementById('scrollRight').addEventListener('click', () =>
        strip.scrollBy({ left: 220, behavior: 'smooth' }));
}

function setActiveCard(i) {
    document.querySelectorAll('.channel-card').forEach((c, idx) =>
        c.classList.toggle('active', idx === i));
    const cards = document.querySelectorAll('.channel-card');
    if (cards[i]) cards[i].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
}

/* ─────────────────────────────────────────────
   PLAYER UI STATES
───────────────────────────────────────────── */

function showLoading(name) {
    document.getElementById('playerPlaceholder').style.display = 'flex';
    document.getElementById('videoPlayer').style.display = 'none';
    document.getElementById('loadingSpinner').style.display = 'block';
    document.getElementById('trophyIcon').style.display = 'none';
    document.getElementById('placeholderTitle').textContent = name;
    document.getElementById('placeholderSub').textContent = 'Connecting to stream…';
}

function showError(msg) {
    document.getElementById('playerPlaceholder').style.display = 'flex';
    document.getElementById('videoPlayer').style.display = 'none';
    document.getElementById('loadingSpinner').style.display = 'none';
    document.getElementById('trophyIcon').style.display = 'block';
    document.getElementById('trophyIcon').textContent = '📡';
    document.getElementById('placeholderTitle').textContent = 'Stream Unavailable';
    document.getElementById('placeholderSub').textContent = msg;
}

function showPlayer() {
    document.getElementById('playerPlaceholder').style.display = 'none';
    document.getElementById('videoPlayer').style.display = 'block';
}

function updateNowPlaying(ch) {
    const logo = document.getElementById('activeChannelLogo');
    logo.src = ch.logo;
    logo.style.display = 'block';
    document.getElementById('activeChannelName').textContent = ch.name;
}

/* ─────────────────────────────────────────────
   CHANNEL PLAYBACK
───────────────────────────────────────────── */

async function loadChannel(index) {
    if (activeIndex === index) return;
    activeIndex = index;
    const ch = channels[index];
    setActiveCard(index);
    updateNowPlaying(ch);
    showLoading(ch.name);
    await destroyPlayers();
    if (ch.type === 'dash') {
        await playDash(document.getElementById('videoPlayer'), ch);
    } else {
        playHls(document.getElementById('videoPlayer'), ch);
    }
}

async function destroyPlayers() {
    if (shakaPlayer) { try { await shakaPlayer.destroy(); } catch(e) {} shakaPlayer = null; }
    if (hlsInstance)  { hlsInstance.destroy(); hlsInstance = null; }
    const v = document.getElementById('videoPlayer');
    v.removeAttribute('src');
    v.load();
}

async function playDash(video, ch) {
    if (typeof shaka === 'undefined') { showError('Shaka Player failed to load.'); return; }
    shaka.polyfill.installAll();
    if (!shaka.Player.isBrowserSupported()) { showError('Browser does not support DASH/DRM.'); return; }

    shakaPlayer = new shaka.Player();
    await shakaPlayer.attach(video);

    if (ch.kid && ch.key) {
        shakaPlayer.configure({ drm: { clearKeys: { [ch.kid]: ch.key } } });
    }

    shakaPlayer.addEventListener('error', () =>
        showError('Stream error — may be geo-restricted or offline.'));

    video.addEventListener('canplay', showPlayer, { once: true });

    try {
        await shakaPlayer.load(ch.url);
        video.play().catch(() => {});
    } catch {
        showError('Unable to load stream — geo-restricted or offline.');
    }
}

function playHls(video, ch) {
    if (typeof Hls === 'undefined') { showError('HLS.js failed to load.'); return; }

    if (Hls.isSupported()) {
        hlsInstance = new Hls({ enableWorker: true, lowLatencyMode: true, backBufferLength: 30 });
        hlsInstance.loadSource(ch.url);
        hlsInstance.attachMedia(video);
        hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => { showPlayer(); video.play().catch(() => {}); });
        hlsInstance.on(Hls.Events.ERROR, (_, data) => {
            if (data.fatal) showError('Stream unavailable — geo-restricted or offline.');
        });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = ch.url;
        video.addEventListener('loadedmetadata', () => { showPlayer(); video.play().catch(() => {}); }, { once: true });
    } else {
        showError('HLS not supported in this browser.');
    }
}

/* ─────────────────────────────────────────────
   FIXTURES
───────────────────────────────────────────── */

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

const PAGE_SIZE  = 6;
let allFixtures  = [];
let currentPage  = 1;

function getMatchStatus(f) {
    const now      = new Date();
    const start    = new Date(f.DateUtc);
    const end      = new Date(start.getTime() + 110 * 60 * 1000);
    if (f.Winner !== '' || f.HomeTeamScore !== null) return 'finished';
    if (now >= start && now <= end) return 'live';
    return 'upcoming';
}

function isMatchOver(f) {
    const end = new Date(new Date(f.DateUtc).getTime() + 110 * 60 * 1000);
    return (f.Winner !== '' || f.HomeTeamScore !== null) && new Date() > end;
}

const FLAG_MAP = {
    'Mexico':'mx','South Africa':'za','Korea Republic':'kr','Czechia':'cz',
    'Canada':'ca','Bosnia and Herzegovina':'ba','USA':'us','Paraguay':'py',
    'Qatar':'qa','Switzerland':'ch','Brazil':'br','Morocco':'ma',
    'Haiti':'ht','Scotland':'gb-sct','Australia':'au','Türkiye':'tr',
    'Germany':'de','Curaçao':'cw','Netherlands':'nl','Japan':'jp',
    "Côte d'Ivoire":'ci','Ecuador':'ec','Sweden':'se','Tunisia':'tn',
    'Spain':'es','Cabo Verde':'cv','Belgium':'be','Egypt':'eg',
    'Saudi Arabia':'sa','Uruguay':'uy','IR Iran':'ir','New Zealand':'nz',
    'France':'fr','Senegal':'sn','Iraq':'iq','Norway':'no',
    'Argentina':'ar','Algeria':'dz','Austria':'at','Jordan':'jo',
    'Portugal':'pt','Congo DR':'cd','England':'gb-eng','Croatia':'hr',
    'Ghana':'gh','Panama':'pa','Uzbekistan':'uz','Colombia':'co'
};

function flagUrl(name) {
    const code = FLAG_MAP[name];
    return code ? `https://flagcdn.com/w40/${code}.png` : null;
}

function formatKickoff(utc) {
    const d = new Date(utc);
    return d.toLocaleDateString('en-GB', { day:'2-digit', month:'short' })
         + ' · ' + d.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' }) + ' UTC';
}

function buildFixtureCard(f) {
    const status = getMatchStatus(f);
    const label  = status === 'live'     ? '🔴 LIVE NOW'
                 : status === 'finished' ? (f.Winner === 'Draw' ? 'Draw' : `✓ ${f.Winner} Win`)
                 : formatKickoff(f.DateUtc);

    const hFlag = flagUrl(f.HomeTeam);
    const aFlag = flagUrl(f.AwayTeam);

    const scoreHtml = (f.HomeTeamScore !== null && f.AwayTeamScore !== null)
        ? `<span class="score-box">${f.HomeTeamScore} — ${f.AwayTeamScore}</span>`
        : `<span class="fixture-vs">VS</span>`;

    const card = document.createElement('div');
    card.className = `fixture-card${status === 'live' ? ' fixture-live' : ''}`;
    card.innerHTML = `
        <div class="fixture-meta">
            <span class="fixture-group">${f.Group || 'Knockout'}</span>
            <span class="fixture-location">📍 ${f.Location}</span>
        </div>
        <div class="fixture-teams">
            <div class="team ${f.Winner === f.HomeTeam ? 'team-winner' : ''}">
                ${hFlag ? `<img class="team-flag" src="${hFlag}" alt="${f.HomeTeam}" onerror="this.style.display='none'">` : '<span>🏳</span>'}
                <span class="team-name">${f.HomeTeam}</span>
            </div>
            ${scoreHtml}
            <div class="team ${f.Winner === f.AwayTeam ? 'team-winner' : ''}">
                ${aFlag ? `<img class="team-flag" src="${aFlag}" alt="${f.AwayTeam}" onerror="this.style.display='none'">` : '<span>🏳</span>'}
                <span class="team-name">${f.AwayTeam}</span>
            </div>
        </div>
        <div style="display:flex;justify-content:center;margin-top:10px;">
            <span class="fixture-status ${status}">${label}</span>
        </div>
    `;
    return card;
}

function renderFixtures() {
    const grid    = document.getElementById('fixtureGrid');
    grid.innerHTML = '';

    const visible = allFixtures.filter(f => !isMatchOver(f));
    if (!visible.length) {
        grid.innerHTML = `<div class="no-fixtures">No upcoming fixtures right now.</div>`;
        return;
    }

    const byRound = {};
    visible.forEach(f => {
        if (!byRound[f.RoundNumber]) byRound[f.RoundNumber] = [];
        byRound[f.RoundNumber].push(f);
    });

    const flatItems = [];
    Object.keys(byRound).map(Number).sort((a,b) => a-b).forEach(r => {
        flatItems.push({ type: 'header', label: ROUND_LABELS[r] || `Round ${r}` });
        byRound[r].forEach(f => flatItems.push({ type: 'card', data: f }));
    });

    const cards      = flatItems.filter(i => i.type === 'card');
    const totalPages = Math.ceil(cards.length / PAGE_SIZE) || 1;
    currentPage      = Math.min(currentPage, totalPages);

    const pageSet = new Set(
        cards.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE).map(i => i.data)
    );

    let pendingHeader = null;
    flatItems.forEach(item => {
        if (item.type === 'header') { pendingHeader = item.label; return; }
        if (!pageSet.has(item.data)) return;
        if (pendingHeader) {
            const hdr = document.createElement('div');
            hdr.className = 'round-header';
            hdr.textContent = pendingHeader;
            grid.appendChild(hdr);
            pendingHeader = null;
        }
        grid.appendChild(buildFixtureCard(item.data));
    });

    if (totalPages > 1) {
        const pag = document.createElement('div');
        pag.className = 'pagination';
        pag.innerHTML = `
            <button class="pag-btn" id="pagPrev" ${currentPage <= 1 ? 'disabled' : ''}>← Prev</button>
            <span class="pag-info">Page ${currentPage} / ${totalPages}<small>${cards.length} matches</small></span>
            <button class="pag-btn" id="pagNext" ${currentPage >= totalPages ? 'disabled' : ''}>See More →</button>
        `;
        grid.appendChild(pag);
        pag.querySelector('#pagPrev').addEventListener('click', () => {
            currentPage--; renderFixtures();
            document.querySelector('.fixture-section').scrollIntoView({ behavior: 'smooth' });
        });
        pag.querySelector('#pagNext').addEventListener('click', () => {
            currentPage++; renderFixtures();
            document.querySelector('.fixture-section').scrollIntoView({ behavior: 'smooth' });
        });
    }
}

async function loadFixtures() {
    const grid = document.getElementById('fixtureGrid');
    grid.innerHTML = '<div class="fixture-loading">Loading fixtures...</div>';
    try {
        const res = await fetch(FIXTURE_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        allFixtures = await res.json();
        currentPage = 1;
        renderFixtures();
    } catch (err) {
        console.error('Fixture load error:', err);
        grid.innerHTML = `<div class="no-fixtures">Could not load fixtures. (${err.message})</div>`;
    }
}

/* ─────────────────────────────────────────────
   SUPABASE LIVE CHAT
───────────────────────────────────────────── */

const SB_URL  = 'https://vfcdttehaxqizeklyzib.supabase.co';
const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmY2R0dGVoYXhxaXpla2x5emliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0NDQ2NTQsImV4cCI6MjA5NzAyMDY1NH0.ScVBWDl5nInSLHBQ5MaeIGPz41PTrUO6ab3GzNCBsR8';

const SB_HEADERS = {
    'apikey':        SB_ANON,
    'Authorization': `Bearer ${SB_ANON}`,
    'Content-Type':  'application/json'
};

let chatUser     = null;
let lastMsgId    = 0;
let pollTimer    = null;
const MAX_MSGS   = 80;

function nameColor(name) {
    let h = 0;
    for (const c of name) h = c.charCodeAt(0) + ((h << 5) - h);
    return `hsl(${Math.abs(h) % 360}, 60%, 55%)`;
}

function initials(name) { return name.trim().slice(0, 2).toUpperCase(); }

function timeLabel(iso) {
    return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function escHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function buildMsgEl(msg) {
    const isSelf = msg.name === chatUser;
    const color  = nameColor(msg.name);
    const div    = document.createElement('div');
    div.className  = `chat-msg${isSelf ? ' chat-msg-self' : ''}`;
    div.dataset.id = msg.id;
    div.innerHTML  = `
        <div class="chat-avatar" style="background:${color}">${initials(msg.name)}</div>
        <div class="chat-bubble-wrap">
            <span class="chat-name-label" style="color:${color}">${escHtml(msg.name)}</span>
            <div class="chat-bubble">${escHtml(msg.message)}</div>
            <span class="chat-time">${timeLabel(msg.created_at)}</span>
        </div>
    `;
    return div;
}

function chatScrollBottom() {
    const box = document.getElementById('chatMessages');
    if (box) box.scrollTop = box.scrollHeight;
}

async function sbFetch(since) {
    const url = `${SB_URL}/rest/v1/chat_messages?select=*&id=gt.${since}&order=id.asc&limit=50`;
    const res = await fetch(url, { headers: SB_HEADERS });
    if (!res.ok) throw new Error(`Supabase fetch ${res.status}`);
    return res.json();
}

async function sbSend(name, message) {
    const res = await fetch(`${SB_URL}/rest/v1/chat_messages`, {
        method: 'POST',
        headers: { ...SB_HEADERS, 'Prefer': 'return=representation' },
        body: JSON.stringify({ name, message })
    });
    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Supabase insert ${res.status}: ${errText}`);
    }
    return res.json();
}

async function loadInitialMessages() {
    const box = document.getElementById('chatMessages');
    box.innerHTML = '';
    try {
        const url = `${SB_URL}/rest/v1/chat_messages?select=*&order=id.desc&limit=${MAX_MSGS}`;
        const res = await fetch(url, { headers: SB_HEADERS });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const msgs = (await res.json()).reverse();

        if (!msgs.length) {
            box.innerHTML = `<div class="chat-empty">No messages yet — say hi! 👋</div>`;
        } else {
            msgs.forEach(m => box.appendChild(buildMsgEl(m)));
            lastMsgId = msgs[msgs.length - 1].id;
        }
        chatScrollBottom();
    } catch (e) {
        console.error('Chat load error:', e);
        box.innerHTML = `<div class="chat-empty">Could not load chat. Check console.</div>`;
    }
}

function startPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(async () => {
        try {
            const msgs = await sbFetch(lastMsgId);
            if (!msgs.length) return;

            const box     = document.getElementById('chatMessages');
            const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
            box.querySelector('.chat-empty')?.remove();

            msgs.forEach(m => {
                if (box.querySelector(`[data-id="${m.id}"]`)) return;
                box.appendChild(buildMsgEl(m));
                lastMsgId = Math.max(lastMsgId, m.id);
            });

            // trim overflow
            const all = box.querySelectorAll('.chat-msg');
            if (all.length > MAX_MSGS) {
                for (let i = 0; i < all.length - MAX_MSGS; i++) all[i].remove();
            }

            if (atBottom) chatScrollBottom();
        } catch (e) { console.warn('Poll error:', e); }
    }, 2500);
}

async function handleSend() {
    const input = document.getElementById('chatMsgInput');
    const text  = input.value.trim();
    if (!text || !chatUser) return;

    input.value    = '';
    input.disabled = true;

    try {
        await sbSend(chatUser, text);
        const msgs = await sbFetch(lastMsgId);
        const box  = document.getElementById('chatMessages');
        box.querySelector('.chat-empty')?.remove();
        msgs.forEach(m => {
            if (box.querySelector(`[data-id="${m.id}"]`)) return;
            box.appendChild(buildMsgEl(m));
            lastMsgId = Math.max(lastMsgId, m.id);
        });
        chatScrollBottom();
    } catch (e) {
        console.error('Send error:', e);
        input.value = text;
    } finally {
        input.disabled = false;
        input.focus();
    }
}

function joinChat(name) {
    chatUser = name.trim();
    localStorage.setItem('chatUsername', chatUser);

    document.getElementById('chatNamePrompt').style.display = 'none';
    document.getElementById('chatUi').style.display         = 'flex';

    const badge = document.getElementById('chatUserBadge');
    badge.textContent        = chatUser;
    badge.style.background   = nameColor(chatUser);

    document.getElementById('onlineCount').textContent =
        Math.floor(Math.random() * 40) + 10;

    loadInitialMessages();
    startPolling();

    document.getElementById('chatSendBtn').addEventListener('click', handleSend);
    document.getElementById('chatMsgInput').addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    });
}

function initChat() {
    document.getElementById('chatNameSubmit').addEventListener('click', () => {
        const v = document.getElementById('chatNameInput').value.trim();
        if (v) joinChat(v);
    });
    document.getElementById('chatNameInput').addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            const v = e.target.value.trim();
            if (v) joinChat(v);
        }
    });

    const saved = localStorage.getItem('chatUsername');
    if (saved) {
        document.getElementById('chatNameInput').value = saved;
        joinChat(saved);
    }
}

/* ─────────────────────────────────────────────
   INIT
───────────────────────────────────────────── */

async function init() {
    // Load channels
    try {
        const res = await fetch(CHANNELS_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        channels = await res.json();
        buildChannelStrip(channels);
        if (channels.length > 0) loadChannel(0);
    } catch (err) {
        console.error('Channel load error:', err);
        document.getElementById('channelStrip').innerHTML =
            '<span style="color:#666;font-size:12px;padding:0 16px;">Could not load channels</span>';
    }

    // Chat + Fixtures in parallel
    initChat();
    loadFixtures();
}

document.addEventListener('DOMContentLoaded', init);
