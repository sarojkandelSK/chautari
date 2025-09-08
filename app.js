import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, updateDoc, doc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";

// Firebase config
const firebaseConfig = {
  apiKey:"YOUR_API_KEY",
  authDomain:"YOUR_AUTH_DOMAIN",
  projectId:"YOUR_PROJECT_ID",
  storageBucket:"YOUR_STORAGE_BUCKET",
  messagingSenderId:"YOUR_MESSAGING_SENDER_ID",
  appId:"YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const provider = new GoogleAuthProvider();

let currentUser = null;
const signinBtn = document.getElementById("signin-btn");
signinBtn.addEventListener("click", ()=>signInWithPopup(auth, provider));
onAuthStateChanged(auth, user=>{
  currentUser = user;
  signinBtn.textContent = user?user.displayName:"Sign in with Google";
});

// Tabs
const tabs = document.querySelectorAll(".tab-btn");
let currentTab = "home";
tabs.forEach(t=>{
  t.addEventListener("click", ()=>{
    tabs.forEach(b=>b.classList.remove("active"));
    t.classList.add("active");
    currentTab = t.dataset.tab;
    renderFeed();
  });
});

// Compose post
const postsContainer = document.getElementById("posts");
const composeBtn = document.getElementById("compose-post");
const composeText = document.getElementById("compose-text");
const composeFile = document.getElementById("compose-file");
const asStory = document.getElementById("asStory");
const asReel = document.getElementById("asReel");

composeBtn.addEventListener("click", async ()=>{
  if(!currentUser){ alert("Sign in first"); return; }

  let fileUrl=null;
  let mediaType=null;
  if(composeFile.files[0]){
    const file = composeFile.files[0];
    const storageRef = ref(storage, `posts/${Date.now()}_${file.name}`);
    const snap = await uploadBytesResumable(storageRef, file);
    fileUrl = await getDownloadURL(snap.ref);
    mediaType = file.type.startsWith("video") ? "video" : "image";
  }

  if(asStory.checked){
    await addDoc(collection(db,"stories"),{
      userId: currentUser.uid,
      media: fileUrl,
      mediaType,
      text: composeText.value,
      createdAt:serverTimestamp()
    });
  } else if(asReel.checked){
    await addDoc(collection(db,"reels"),{
      userId: currentUser.uid,
      media: fileUrl,
      mediaType,
      text: composeText.value,
      createdAt:serverTimestamp()
    });
  } else {
    await addDoc(collection(db,"posts"),{
      userId: currentUser.uid,
      text: composeText.value,
      media:fileUrl,
      mediaType,
      likes:0,
      createdAt:serverTimestamp()
    });
  }

  composeText.value="";
  composeFile.value="";
  asStory.checked=false;
  asReel.checked=false;
});

// Real-time posts
let allPosts = [];
const postsQuery = query(collection(db,"posts"), orderBy("createdAt","desc"));
onSnapshot(postsQuery, snap=>{
  allPosts = snap.docs.map(d=>({id:d.id, ...d.data()}));
  renderFeed();
});

// Real-time stories
let allStories = [];
const storiesQuery = query(collection(db,"stories"), orderBy("createdAt","desc"));
onSnapshot(storiesQuery, snap=>{
  allStories = snap.docs.map(d=>({id:d.id, ...d.data()}));
  renderStories(allStories);
});

// Render feed
function renderFeed(){
  postsContainer.innerHTML="";
  const trendingSet = new Set();

  if(currentTab==="home"){
    allPosts.forEach(p=>{
      if(p.text) (p.text.match(/#\w+/g)||[]).forEach(t=>trendingSet.add(t));
      const div = document.createElement("div");
      div.className="post";
      div.innerHTML=`
        <p>${p.text||""}</p>
        ${p.media?`<${p.mediaType==='video'?'video controls':'img'} src="${p.media}" style="width:100%;border-radius:8px;"></${p.mediaType==='video'?'video':'img'}>`:""}
        <button class="like-btn">❤️ ${p.likes||0}</button>
      `;
      div.querySelector(".like-btn").addEventListener("click", async ()=>{
        const postRef = doc(db,"posts",p.id);
        await updateDoc(postRef,{likes:(p.likes||0)+1});
      });
      postsContainer.appendChild(div);
    });
    document.getElementById("trending").innerHTML = Array.from(trendingSet).map(t=>`<div>${t}</div>`).join("");

  } else if(currentTab==="reels"){
    postsContainer.innerHTML="";
    const reelsQuerySnap = query(collection(db,"reels"), orderBy("createdAt","desc"));
    onSnapshot(reelsQuerySnap, snap=>{
      snap.docs.forEach(r=>{
        const reel = r.data();
        const div = document.createElement("div");
        div.className="post";
        div.innerHTML=`
          <video src="${reel.media}" controls style="width:100%;border-radius:12px;"></video>
          <p>${reel.text||""}</p>
        `;
        postsContainer.appendChild(div);
      });
    });

  } else if(currentTab==="messages"){
    postsContainer.innerHTML="<p>Messages placeholder</p>";
  }
}

// Stories
const storiesBar = document.getElementById("stories-bar");
const storyModal = document.getElementById("story-modal");
const storyMedia = document.getElementById("story-media");
const modalClose = document.querySelector(".close");

function renderStories(stories){
  storiesBar.innerHTML="";
  stories.forEach(s=>{
    const img = document.createElement("img");
    img.className="story";
    img.src=s.avatar || "https://i.pravatar.cc/100";
    img.addEventListener("click", ()=>{
      storyMedia.innerHTML="";
      if(s.mediaType==="video"){
        const v = document.createElement("video");
        v.src = s.media;
        v.controls=true;
        v.autoplay=true;
        v.style.maxWidth="100%";
        v.style.maxHeight="80vh";
        v.style.borderRadius="12px";
        storyMedia.appendChild(v);
      } else {
        const i = document.createElement("img");
        i.src = s.media;
        i.style.maxWidth="100%";
        i.style.maxHeight="80vh";
        i.style.borderRadius="12px";
        storyMedia.appendChild(i);
      }
      storyModal.style.display="flex";
    });
    storiesBar.appendChild(img);
  });
}
modalClose.addEventListener("click", ()=>storyModal.style.display="none");
window.addEventListener("click", e=>{ if(e.target===storyModal) storyModal.style.display="none"; });

// Right sidebar
const peopleDiv = document.getElementById("people");
peopleDiv.innerHTML = ["Maya","Arjun","Sita"].map(p=>`<div>${p}</div>`).join("");
document.getElementById("active").innerHTML = ["You","Maya"].map(a=>`<div>${a}</div>`).join("");
