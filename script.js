const jsonURL =
"https://raw.githubusercontent.com/mdhujaifatowhid/fifa2026/main/fifa.json";

let channels = [];

fetch(jsonURL)
.then(res => res.json())
.then(data => {

    // DASH entries hide
    channels = data.filter(x => !x.type);

    draw(channels);

})
.catch(err=>{
    console.log(err);
});


// --------------------
// DRAW CHANNELS
// --------------------

function draw(list){

    const container =
    document.getElementById("channels");

    container.innerHTML = "";

    list.forEach(channel=>{

        const card =
        document.createElement("div");

        card.className =
        "channel-card";

        card.innerHTML = `

        <img
        src="${channel.logo || ''}"
        onerror="this.src='https://placehold.co/300x150/111827/ffffff?text=TV'"
        >

        <h3>${channel.name}</h3>

        <p>
        ${channel.group || "LIVE"}
        </p>

        `;

        card.onclick = ()=>{

            play(channel);

        };

        container.appendChild(card);

    });

}


// --------------------
// SEARCH
// --------------------

document
.getElementById("search")
.addEventListener("input",function(){

    const q =
    this.value.toLowerCase();

    const result =
    channels.filter(c=>

        c.name
        .toLowerCase()
        .includes(q)

    );

    draw(result);

});


// --------------------
// PLAY
// --------------------

function play(channel){

    document
    .getElementById(
    "currentTitle"
    )
    .innerText =
    channel.name;

    const video =
    document
    .getElementById(
    "video"
    );

    const frame =
    document
    .getElementById(
    "frame"
    );

    frame.innerHTML = "";

    video.style.display =
    "block";

    video.pause();



    // EMBED

    if(
        channel.url
        .includes("embed")
    ){

        video.style.display =
        "none";

        frame.innerHTML =

        `

        <iframe

        src="${channel.url}"

        allowfullscreen

        loading="lazy"

        >

        </iframe>

        `;

        return;

    }



    // HLS

    if(
        Hls.isSupported()
    ){

        const hls =
        new Hls();

        hls.loadSource(
        channel.url
        );

        hls.attachMedia(
        video
        );

        hls.on(
        Hls.Events.MANIFEST_PARSED,

        ()=>{

            video.play();

        });

    }

    else if(

        video.canPlayType(
        "application/vnd.apple.mpegurl"
        )

    ){

        video.src =
        channel.url;

        video.play();

    }

    else{

        alert(
        "Stream not supported."
        );

    }

}



// --------------------
// AUTO PLAY FIRST
// --------------------

setTimeout(()=>{

    if(
    channels.length
    ){

    play(
    channels[0]
    );

    }

},1000);
