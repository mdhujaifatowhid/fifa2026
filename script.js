document.addEventListener('DOMContentLoaded', () => {
    // Initialize Video.js and activate EME (Encrypted Media Extensions)
    const player = videojs('live-player');
    player.eme(); 

    const channelsContainer = document.getElementById('channels-container');
    const fixturesContainer = document.getElementById('fixtures-container');
    const currentChannelTitle = document.getElementById('current-channel-title');

    // Fetch and Load Channels
    fetch('fifa.json')
        .then(response => response.json())
        .then(channels => {
            channelsContainer.innerHTML = ''; // Clear loading
            
            channels.forEach((channel, index) => {
                const button = document.createElement('button');
                button.classList.add('chan-btn');
                button.textContent = channel.name;
                
                button.addEventListener('click', () => {
                    document.querySelectorAll('.chan-btn').forEach(btn => btn.classList.remove('active'));
                    button.classList.add('active');
                    changeStream(channel);
                });

                channelsContainer.appendChild(button);

                // Auto-play first channel
                if (index === 0) {
                    button.classList.add('active');
                    changeStream(channel);
                }
            });
        })
        .catch(err => {
            console.error('Error loading channels:', err);
            channelsContainer.innerHTML = '<span class="loading-text">Failed to load channels.</span>';
        });

    // Fetch and Load Fixtures
    fetch('fixture.json')
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

    // Stream Switching with DRM ClearKey Handler
    function changeStream(channel) {
        currentChannelTitle.textContent = `Live: ${channel.name}`;
        
        let srcObj = {
            src: channel.url,
            type: (channel.type === 'dash' || channel.url.includes('.mpd')) ? 'application/dash+xml' : 'application/x-mpegURL'
        };

        // If the channel is locked with ClearKey DRM
        if (channel.type === 'dash' && channel.kid && channel.key) {
            srcObj.keySystems = {
                'org.w3.clearkey': {
                    videoRobustness: 'SW_SECURE_CRYPTO',
                    audioRobustness: 'SW_SECURE_CRYPTO',
                    clearkeys: {
                        [channel.kid]: channel.key
                    }
                }
            };
        }

        // Reset player before loading new source to prevent memory leaks
        player.src(srcObj);
        player.ready(() => {
            player.play().catch(error => {
                console.log("Autoplay failed or Stream Error:", error);
            });
        });
    }
});
