(function(){
'use strict';

/* ====================
       CONFIG
==================== */

const API_BASE = "https://c411.org/api/torrents";

function buildTorrentURL(hash){
    return `${API_BASE}/${hash}/download`;
}

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
    DEFAULT_LABEL = data.default_label || LABELS[0] || null;
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
    const now = Date.now();
    const wait = Math.max(0, REQUEST_DELAY - (now - lastRequestTime));
    if(wait > 0) await new Promise(r => setTimeout(r, wait));
    lastRequestTime = Date.now();

    const originalChildren = Array.from(button.childNodes);
    button.disabled = true;
    button.textContent = "";
    button.appendChild(createLoaderSVG());

    const torrentURL = buildTorrentURL(hash);

    try {
        const res = await browser.runtime.sendMessage({
            type: "SEND_TORRENT",
            torrentURL,
            label
        });

        if(!res){
            console.error("Pas de réponse du background");
            button.textContent = "❌";
        } else if(res.success){
            button.textContent = "✓";
        } else {
            console.error("Erreur:", res.error);
            button.textContent = "❌";
        }
    } catch(e){
        console.error("Erreur critique:", e);
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

function createMenu(hash, button) {
    const menu = document.createElement("div");
    menu.style.position = "absolute";
    menu.style.background = "#012119";
    menu.style.border = "1px solid #003f2e";
    menu.style.borderRadius = "6px";
    menu.style.boxShadow = "0 4px 12px rgba(0,0,0,0.3)";
    menu.style.zIndex = "999999";
    menu.style.display = "none";

    if (!document.getElementById('c411-menu-style')) {
        const style = document.createElement('style');
        style.id = 'c411-menu-style';
        style.textContent = `
            .c411-menu-item {
                padding: 8px 12px;
                cursor: pointer;
                color: #00d492;
                transition: background 0.2s;
            }
            .c411-menu-item:hover {
                background: #374151;
            }
            .c411-menu-separator {
                height: 1px;
                margin: 4px 0;
                background: #003f2e;
            }
        `;
        document.head.appendChild(style);
    }

    if(LABELS.length === 0){
        const item = document.createElement("div");
        item.textContent = "⚠️ Configure tes labels";
        item.style.padding = "8px";
        item.style.color = "#f87171";
        menu.appendChild(item);
    } else {
        LABELS.forEach(label => {
            const item = document.createElement("div");
            item.textContent = label;
            item.className = "c411-menu-item";
            item.onclick = () => {
                sendTorrent(hash, label, button);
                menu.style.display = "none";
            };
            menu.appendChild(item);
        });
    }

    const separator = document.createElement('div');
    separator.className = 'c411-menu-separator';
    menu.appendChild(separator);

    const downloadItem = document.createElement("div");
    downloadItem.textContent = "Télécharger .torrent";
    downloadItem.className = "c411-menu-item";
    downloadItem.onclick = () => {
        const torrentURL = buildTorrentURL(hash);
        const a = document.createElement('a');
        a.href = torrentURL;
        a.download = '';
        document.body.appendChild(a);
        a.click();
        a.remove();
        menu.style.display = "none";
    };
    menu.appendChild(downloadItem);

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

    document.addEventListener("click", e => {
        if(currentMenu && !currentMenu.contains(e.target)){
            currentMenu.style.display = "none";
            currentMenu = null;
        }
    });

    button.dataset.rtAttached = "1";
}

/* ====================
   SCAN PAGE
==================== */

function getDownloadButton(root){
    return [...root.querySelectorAll("button")]
        .find(btn => {
            const icon = btn.querySelector('[data-slot="leadingIcon"]');
            return icon && icon.className.includes("arrow-down-tray");
        });
}

function scan(root = document){
    // LISTE
    const links = root.querySelectorAll('a[href^="/torrents/"]');

    links.forEach(link => {
        const match = link.href.match(/torrents\/([a-f0-9]{40})/);
        if(!match) return;

        const hash = match[1];
        const row = link.closest("div.hidden.lg\\:grid, div.lg\\:hidden");
        if(!row) return;

        const button = getDownloadButton(row);
        if(!button) return;
        if(button.dataset.rtAttached) return;

        attachBehaviour(button, hash);
    });

    // PAGE TORRENT
    const pageMatch = location.href.match(/torrents\/([a-f0-9]{40})/);
    if(pageMatch){
        const hash = pageMatch[1];
        const button = getDownloadButton(document);
        if(!button) return;
        if(button.dataset.rtAttached) return;

        attachBehaviour(button, hash);

        if(DEFAULT_LABEL){
            button.innerHTML = DEFAULT_LABEL;
            button.setAttribute("title", DEFAULT_LABEL);
        }
    }

    patchTooltip();
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