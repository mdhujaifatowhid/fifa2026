document.addEventListener('DOMContentLoaded', () => {
    // GitHub Raw URLs
    const CHANNELS_URL = 'https://raw.githubusercontent.com/mdhujaifatowhid/fifa2026/main/fifa.json';
    const FIXTURES_URL = 'https://raw.githubusercontent.com/mdhujaifatowhid/fifa2026/main/fixture.json';

    const player = videojs('live-player', {
        fluid: true,
        autoplay: true,
        responsive: true
    });
    
    // Activate DRM Plugin
    player.eme();

    const channelsContainer = document.getElementById('channels-container');
    const fixturesContainer = document.getElementById('fixtures-container');
    const currentChannelTitle = document.getElementById('current-channel-title');

    // Fetch Channels
    fetch(CHANNELS_URL)
        .then(res => res.json())
        .then(channels => {
            channelsContainer.innerHTML = '';
            channels.slice(0, 8).forEach((channel, index) => {
                const btn = document.createElement('button');
                btn.className = 'chan-btn';
                btn.innerText = channel.name;
                btn.onclick = () => loadChannel(channel, btn);
                channelsContainer.appendChild(btn);
                if(index === 0) loadChannel(channel, btn);
            });
        });

    // Fetch Fixtures
    fetch(FIXTURES_URL)
        .then(res => res.json())
        .then(fixtures => {
            fixturesContainer.innerHTML = '';
            fixtures.forEach(match => {
                const card = document.createElement('div');
                card.className = 'fixture-card';
                card.innerHTML = `
                    <div class="match-info"><span>${match.date}</span><span>${match.time}</span></div>
                    <div class="match-teams"><div>${match.team1}</div><div class="match-vs">vs</div><div>${match.team2}</div></div>
                    <div class="match-info" style="margin-top:10px; border-top:1px solid #222;"><span>Group ${match.group}</span></div>
                `;
                fixturesContainer.appendChild(card);
            });
        });

    function loadChannel(channel, btn) {
        // Update UI
        document.querySelectorAll('.chan-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentChannelTitle.innerText = "Live: " + channel.name;

        let videoSrc = {
            src: channel.url,
            type: (channel.url.includes('.mpd') || channel.type === 'dash') ? 'application/dash+xml' : 'application/x-mpegURL'
        };

        // Handle ClearKey DRM
        if (channel.kid && channel.key) {
            videoSrc.keySystems = {
                'org.w3.clearkey': {
                    'clearkeys': {
                        [channel.kid]: channel.key
                    }
                }
            };
        }

        player.src(videoSrc);
        player.play().catch(e => console.log("Playback error: ", e));
    }
});
