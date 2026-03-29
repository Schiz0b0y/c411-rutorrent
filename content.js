(function(){
'use strict';

/* ====================
       CONFIG
   ==================== */

let LABELS = [];
let DEFAULT_LABEL = null;

let currentMenu = null;

const REQUEST_DELAY = 2000;
let lastRequestTime = 0;
let queue = Promise.resolve();
const requestedHashes = new Set();

/* ====================
   LOAD SETTINGS
==================== */

async function loadSettings(){
    const data = await browser.storage.local.get(["labels", "default_label"]);

    LABELS = data.labels || [];

    if(data.default_label){
        DEFAULT_LABEL = data.default_label;
    } else {
        DEFAULT_LABEL = LABELS[0] || null;
    }
}

/* ====================
   SVG LOADER
==================== */

function createLoaderSVG(){
    const svgNS = "http://www.w3.org/2000/svg";

    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "16");
    svg.setAttribute("viewBox", "0 0 24 24");

    const circle = document.createElementNS(svgNS, "circle");
    circle.setAttribute("cx", "12");
    circle.setAttribute("cy", "12");
    circle.setAttribute("r", "10");
    circle.setAttribute("stroke", "#10b981");
    circle.setAttribute("stroke-width", "3");
    circle.setAttribute("fill", "none");
    circle.setAttribute("stroke-dasharray", "60");
    circle.setAttribute("stroke-dashoffset", "20");

    const anim = document.createElementNS(svgNS, "animateTransform");
    anim.setAttribute("attributeName", "transform");
    anim.setAttribute("type", "rotate");
    anim.setAttribute("from", "0 12 12");
    anim.setAttribute("to", "360 12 12");
    anim.setAttribute("dur", "1s");
    anim.setAttribute("repeatCount", "indefinite");

    circle.appendChild(anim);
    svg.appendChild(circle);

    return svg;
}

/* ====================
   SEND TORRENT
==================== */

async function sendTorrent(hash, label, button){

    if(!LABELS.length){
        alert("Configure tes labels dans l'extension");
        return;
    }

    // évite double clic / spam même torrent
    if(requestedHashes.has(hash)){
        console.log("Déjà en cours:", hash);
        return;
    }

    requestedHashes.add(hash);

    queue = queue
        .then(() => processTorrent(hash, label, button))
        .finally(() => requestedHashes.delete(hash));
}

/* ====================
   PROCESS TORRENT
==================== */

async function processTorrent(hash, label, button){

    // cooldown
    const now = Date.now();
    const wait = Math.max(0, REQUEST_DELAY - (now - lastRequestTime));

    if(wait > 0){
        await new Promise(r => setTimeout(r, wait));
    }

    lastRequestTime = Date.now();

    const originalChildren = Array.from(button.childNodes);
    button.disabled = true;

    button.textContent = "";
    button.appendChild(createLoaderSVG());

    const torrentURL = `https://c411.org/api/torrents/${hash}/download`;

    try {

        const res = await browser.runtime.sendMessage({
            type: "SEND_TORRENT",
            torrentURL,
            label
        });

        if(res?.success){
            button.textContent = "✓";
        } else {
            console.log("Erreur:", res?.error);
            button.textContent = "❌";
        }

    } catch(e){
        console.log(e);
        button.textContent = "❌";
    }

    setTimeout(()=>{
        button.textContent = "";
        originalChildren.forEach(c => button.appendChild(c));
        button.disabled = false;
    }, 2000);
}

/* ====================
   MENU LABELS
==================== */

function createMenu(hash, button){
    if(LABELS.length === 0){
      const item = document.createElement("div");
      item.textContent = "⚠️ Configure tes labels";
      item.style.padding = "8px";
      item.style.color = "#f87171";
      menu.appendChild(item);
      return menu;
    }

    const menu = document.createElement("div");
    menu.style.position="absolute";
    menu.style.background="#012119";
    menu.style.border="1px solid #003f2e";
    menu.style.borderRadius="6px";
    menu.style.boxShadow="0 4px 12px rgba(0,0,0,0.3)";
    menu.style.zIndex="999999";
    menu.style.display="none";

    LABELS.forEach(label => {
        const item = document.createElement("div");
        item.textContent = label;
        item.style.padding="8px 12px";
        item.style.cursor="pointer";
        item.style.color="#00d492";

        item.onmouseenter = ()=>item.style.background="#374151";
        item.onmouseleave = ()=>item.style.background="";

        item.onclick = ()=>{
            sendTorrent(hash, label, button);
            menu.style.display="none";
        };

        menu.appendChild(item);
    });

    document.body.appendChild(menu);
    return menu;
}

/* ====================
   ATTACH BUTTON
==================== */

function attachBehaviour(button, hash){
    if(button.dataset.rtAttached) return;
    const menu = createMenu(hash, button);

    // clic = label par défaut
    button.addEventListener("click", e=>{
        e.preventDefault();
        e.stopImmediatePropagation();
        if(!DEFAULT_LABEL){
            alert("Aucun label par défaut défini");
            return;
        }

        sendTorrent(hash, DEFAULT_LABEL, button);
    }, true);

    // clic droit = menu
    button.addEventListener("contextmenu", e=>{
        e.preventDefault();
        e.stopImmediatePropagation();

        const rect = button.getBoundingClientRect();

        menu.style.top = window.scrollY + rect.bottom + "px";
        menu.style.left = window.scrollX + rect.left + "px";

        if(currentMenu && currentMenu !== menu)
            currentMenu.style.display = "none";

        menu.style.display = "block";
        currentMenu = menu;
    }, true);

    document.addEventListener("click", (e) => {
    if (currentMenu && !currentMenu.contains(e.target)) {
        currentMenu.style.display = "none";
        currentMenu = null;
    }
});

    button.dataset.rtAttached = "1";
}

/* ====================
   SCAN PAGE
==================== */

function getHashFromRow(row){
    const link = row.querySelector("a[href*='/torrents/']");
    if(!link) return null;

    const match = link.href.match(/torrents\/([a-f0-9]{40})/);
    return match ? match[1] : null;
}

function scan(root=document){
    const buttons = root.querySelectorAll("button");

    buttons.forEach(button=>{
        const icon = button.querySelector(".i-heroicons\\:arrow-down-tray");
        if(!icon) return;

        const row = button.closest("div[class*='grid']");
        if(!row) return;

        const hash = getHashFromRow(row);
        if(!hash) return;

        attachBehaviour(button, hash);
    });
}

/* ====================
   PATCH TOOLTIP
==================== */

function patchTooltip(){
    document.querySelectorAll('[data-slot="text"]').forEach(el => {
        if(el.textContent === "Télécharger"){
            el.textContent = DEFAULT_LABEL
                ? "⬇ " + DEFAULT_LABEL
                : "Configurer";
        }
    });
}

/* ====================
   OBSERVER
==================== */

const observer = new MutationObserver(mutations => {
    mutations.forEach(m=>{
        m.addedNodes.forEach(node=>{
            if(node.nodeType === 1){
                scan(node);
                patchTooltip();
            }
        });
    });
});

observer.observe(document.body, {childList:true, subtree:true});

/* ====================
   INIT
==================== */

(async function(){
    await loadSettings();
    scan();
})();

})();