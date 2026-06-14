const url="https://raw.githubusercontent.com/mdhujaifatowhid/fifa2026/main/fifa.json";

let channels=[];

fetch(url)
.then(r=>r.json())
.then(data=>{
channels=data.filter(x=>!x.type); // public HLS/embed entries
draw(channels);
});

function draw(arr){

const list=document.getElementById("list");

list.innerHTML="";

arr.forEach(ch=>{

const d=document.createElement("div");

d.className="card";

d.innerHTML=`
<img src="${ch.logo||''}">
<div>${ch.name}</div>
`;

d.onclick=()=>play(ch);

list.appendChild(d);

});

}

document.getElementById("search").oninput=function(){

const q=this.value.toLowerCase();

draw(
channels.filter(
x=>x.name.toLowerCase().includes(q)
)
);

};

function play(ch){

const video=document.getElementById("video");
const frame=document.getElementById("frame");

frame.innerHTML="";
video.style.display="block";

if(ch.url.includes("embed")){

video.pause();

video.style.display="none";

frame.innerHTML=
`<iframe src="${ch.url}" allowfullscreen></iframe>`;

return;

}

if(Hls.isSupported()){

const hls=new Hls();

hls.loadSource(ch.url);

hls.attachMedia(video);

}else{

video.src=ch.url;

}

}
