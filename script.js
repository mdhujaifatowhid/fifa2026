document.addEventListener('DOMContentLoaded', () => {
    const player = videojs('live-player');
    const channelsContainer = document.getElementById('channels-container');
    const fixturesContainer = document.getElementById('fixtures-container');
    const currentChannelTitle = document.getElementById('current-channel-title');

    // Fetch and Load Channels
    fetch('fifa.json')
        .then(response => response.json())
        .then(channels => {
            channelsContainer.innerHTML = ''; // Clear loading text
            
            // Render maximum 6 channels as per UI requirements
            channels.slice(0, 6).forEach((channel, index) => {
                const button = document.createElement('button');
                button.classList.add('chan-btn');
                button.textContent = channel.name;
                
                button.addEventListener('click', () => {
                    // Update active button styling
                    document.querySelectorAll('.chan-btn').forEach(btn => btn.classList.remove('active'));
                    button.classList.add('active');
                    
                    // Change stream source
                    changeStream(channel.url, channel.name);
                });

                channelsContainer.appendChild(button);

                // Auto-play the first channel initially
                if (index === 0) {
                    button.classList.add('active');
                    changeStream(channel.url, channel.name);
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
            fixturesContainer.innerHTML = ''; // Clear loading text
            
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

    // Helper function to safely switch streams using Video.js
    function changeStream(url, name) {
        currentChannelTitle.textContent = `Live: ${name}`;
        
        // Setup type inference based on extension (primarily HLS .m3u8 or standard MP4)
        let type = 'video/mp4';
        if (url.includes('.m3u8')) {
            type = 'application/x-mpegURL';
        }
        
        player.src({ src: url, type: type });
        player.ready(() => {
            player.play().catch(error => {
                console.log("Autoplay blocked or stream error:", error);
            });
        });
    }
});
