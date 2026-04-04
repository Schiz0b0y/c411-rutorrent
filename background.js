browser.runtime.onMessage.addListener(async (msg) => {

    const config = await browser.storage.local.get([
        "rutorrentUrl",
        "login",
        "password"
    ]);

    if (!config.rutorrentUrl || !config.login || !config.password) {
        return { success: false, error: "Configuration manquante" };
    }

    function buildRutorrentAddUrl(baseUrl){
    if(!baseUrl) return null;

    baseUrl = baseUrl.trim();

    // enlève trailing slash
    baseUrl = baseUrl.replace(/\/+$/, "");

    // enlève si déjà présent (sécurité)
    baseUrl = baseUrl.replace(/\/php\/addtorrent\.php$/, "");

    return baseUrl + "/php/addtorrent.php";
}

    /* ====================
        TEST CONNEXION
    ==================== */
    if(msg.type === "TEST_CONNECTION"){
        return await testConnection(
            buildRutorrentAddUrl(config.rutorrentUrl),
            config.login,
            config.password
        );
    }

    /* ====================
        ENVOI TORRENT
    ==================== */
    if(msg.type === "SEND_TORRENT"){
        try {
            // téléchargement du torrent
            const res = await fetch(msg.torrentURL);
            const buffer = await res.arrayBuffer();

            const form = new FormData();
            form.append("torrent_file", new Blob([buffer]), "file.torrent");
            form.append("label", msg.label);

            const result = await uploadTorrent(
                buildRutorrentAddUrl(config.rutorrentUrl),
                form,
                config.login,
                config.password
            );

            return result;

        } catch(e){
            return { success: false, error: e.message };
        }
    }

});

/* ====================
    DIGEST AUTH UPLOAD
==================== */

function uploadTorrent(url, form, login, password){
    return new Promise((resolve) => {

        const xhr = new XMLHttpRequest();

        xhr.open("POST", url, true, login, password);

        xhr.onload = () => {
            resolve({
                success: xhr.status === 200,
                status: xhr.status,
                response: xhr.responseText
            });
        };

        xhr.onerror = () => {
            resolve({
                success: false,
                error: "Erreur réseau"
            });
        };

        xhr.send(form);
    });
}

/* ====================
    TEST CONNEXION
==================== */

function testConnection(url, login, password){
    return new Promise((resolve) => {

        const xhr = new XMLHttpRequest();

        xhr.open("GET", url, true, login, password);

        xhr.onload = () => {
            resolve({
                success: xhr.status !== 401,
                status: xhr.status
            });
        };

        xhr.onerror = () => {
            resolve({
                success: false,
                error: "Erreur réseau"
            });
        };

        xhr.send();
    });
}