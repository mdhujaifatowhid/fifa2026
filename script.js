document.addEventListener('DOMContentLoaded', () => {
    // Your GitHub Raw JSON Links
    const CHANNELS_URL = 'https://raw.githubusercontent.com/mdhujaifatowhid/fifa2026/main/fifa.json';
    const FIXTURES_URL = 'https://raw.githubusercontent.com/mdhujaifatowhid/fifa2026/main/fixture.json';

    const channelsContainer = document.getElementById('channels-container');
    const fixturesContainer = document.getElementById('fixtures-container');
    const currentChannelTitle = document.getElementById('current-channel-title');
    const videoElement = document.getElementById('live-player');
    const videoContainer = document.getElementById('video-container');

    let player;
    let ui;

    // Initialize Shaka Player
    function initPlayer() {
        // Install polyfills to ensure browser compatibility
        shaka.polyfill.installAll();

        if (shaka.Player.isBrowserSupported()) {
            player = new shaka.Player(videoElement);
            
            // Set up Shaka UI Overlay
            ui = new shaka.ui.Overlay(player, videoContainer, videoElement);
            const controls = ui.getControls();

            // Error listener
            player.addEventListener('error', onPlayerError);
        } else {
            console.error('Browser not supported for Shaka Player!');
        }
    }

    function onPlayerError(event) {
        console.error('Shaka Player Error:', event.detail);
    }

    // Fetch and Load Channels from GitHub Raw
    fetch(CHANNELS_URL)
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(channels => {
            channelsContainer.innerHTML = ''; // Clear loading text
            
            // Limit to top 6 channels for the navbar
            channels.slice(0, 6).forEach((channel, index) => {
                const button = document.createElement('button');
                button.classList.add('chan-btn');
                button.textContent = channel.name;
                
                button.addEventListener('click', () => {
                    document.querySelectorAll('.chan-btn').forEach(btn => btn.classList.remove('active'));
                    button.classList.add('active');
                    changeStream(channel);
                });

                channelsContainer.appendChild(button);

                // Auto-play the first channel on load
                if (index === 0) {
                    button.classList.add('active');
                    changeStream(channel);
                }
            });
        })
        .catch(err => {
            console.error('Error fetching channels:', err);
            channelsContainer.innerHTML = '<span class="loading-text">Error loading channels from GitHub.</span>';
        });

    // Fetch and Load Fixtures from GitHub Raw
    fetch(FIXTURES_URL)
        .then(response => response.json())
        .then(fixtures => {
            fixturesContainer.innerHTML = '';
            fixtures.forEach(match => {
                const card = document.createElement('div');
                card.classList.add('fixture-card');
                card.innerHTML = `
                    <div class="match-info">
                        <span>${match.date}</span>
                        <span>${match.time}</span>
                    </div>
                    <div class="match-teams">
                        <div>${match.team1}</div>
                        <div class="match-vs">vs</div>
                        <div>${match.team2}</div>
                    </div>
                    <div class="match-info" style="margin-top: auto; padding-top: 5px; border-top: 1px solid #1f1f1f;">
                        <span>Group ${match.group}</span>
                    </div>
                `;
                fixturesContainer.appendChild(card);
            });
        })
        .catch(err => {
            console.error('Error loading fixtures:', err);
            fixturesContainer.innerHTML = '<p class="loading-text">Failed to load fixtures.</p>';
        });

    // Stream Switching Logic with ClearKey DRM Support
    function changeStream(channel) {
        currentChannelTitle.textContent = `Live: ${channel.name}`;
        
        // Reset DRM Configuration from previous channel
        player.configure({ drm: { clearKeys: {} } });

        // If channel requires ClearKey DRM ڈیکرپشن
        if (channel.type === 'dash' && channel.kid && channel.key) {
            player.configure({
                drm: {
                    clearKeys: {
                        [channel.kid]: channel.key
                    }
                }
            });
        }

        // Load the stream URL (.mpd or .m3u8)
        player.load(channel.url).then(() => {
            console.log('Stream loaded successfully:', channel.name);
        }).catch(error => {
            console.error('Error triggering stream load:', error);
        });
    }

    // Trigger player initialization
    initPlayer();
});
