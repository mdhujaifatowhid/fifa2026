const JSON_URL =
"https://raw.githubusercontent.com/mdhujaifatowhid/fifa2026/main/fifa.json";

let allChannels = [];

const video =
document.getElementById("video");

const frame =
document.getElementById("frame");

const title =
document.getElementById("currentTitle");

const search =
document.getElementById("search");

const grid =
document.getElementById("channels");



// LOAD

fetch(JSON_URL)

.then(res=>res.json())

.then(data=>{

    allChannels=

    data.filter(

    x=>!x.type

    );

    render(allChannels);

    if(allChannels.length){

        play(allChannels[0]);

    }

})

.catch(err=>{

console.log(err);

grid.innerHTML=

"<h2>Failed to load channels.</h2>";

});



// RENDER

function render(list){

grid.innerHTML="";

list.forEach(ch=>{

const card=

document.createElement("div");

card.className=

"channel-card";

card.innerHTML=`

<img

src="${ch.logo}"

onerror="this.src='https://placehold.co/300x120/111827/ffffff?text=TV'"

>

<h3>

${ch.name}

</h3>

<p>

${ch.group||"LIVE"}

</p>

`;

card.onclick=()=>{

play(ch);

};

grid.appendChild(card);

});

}



// SEARCH

search.addEventListener(

"input",

function(){

const q=

this.value

.toLowerCase();

const filtered=

allChannels.filter(

x=>

x.name

.toLowerCase()

.includes(q)

);

render(filtered);

}

);



// PLAY

function play(ch){

title.innerText=

ch.name;

frame.innerHTML="";

video.style.display=

"block";

video.pause();



// EMBED

if(

ch.url.includes(

"embed"

)

){

video.style.display=

"none";

frame.innerHTML=

`

<iframe

src="${ch.url}"

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

const hls=

new Hls();

hls.loadSource(

ch.url

);

hls.attachMedia(

video

);

hls.on(

Hls.Events

.MANIFEST_PARSED,

function(){

video.play();

}

);

}

else if(

video.canPlayType(

'application/vnd.apple.mpegurl'

)

){

video.src=

ch.url;

video.play();

}

else{

alert(

"Unsupported Stream"

);

}

}
