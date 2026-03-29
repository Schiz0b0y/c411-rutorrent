const url = document.getElementById("url");
const login = document.getElementById("login");
const password = document.getElementById("password");
const labels = document.getElementById("labels");
const status = document.getElementById("status");
const defaultLabelSelect = document.getElementById("defaultLabel");

async function load(){
    const data = await browser.storage.local.get([
        "rutorrentUrl",
        "login",
        "password",
        "labels",
        "default_label"
    ]);

    // remplir champs
    url.value = data.rutorrentUrl || "";
    login.value = data.login || "";
    password.value = data.password || "";

    const labelsArray = data.labels || [];

    // textarea
    labels.value = labelsArray.join("\n");

    // select
    defaultLabelSelect.innerHTML = "";

    labelsArray.forEach(label => {
        const opt = document.createElement("option");
        opt.value = label;
        opt.textContent = label;
        defaultLabelSelect.appendChild(opt);
    });

    if(data.default_label && labelsArray.includes(data.default_label)){
        defaultLabelSelect.value = data.default_label;
    } else {
        defaultLabelSelect.selectedIndex = 0;
    }
}

labels.addEventListener("input", () => {
    const parsed = labels.value
        .split("\n")
        .map(l => l.trim())
        .filter(Boolean);

    defaultLabelSelect.innerHTML = "";

    parsed.forEach(label => {
        const opt = document.createElement("option");
        opt.value = label;
        opt.textContent = label;
        defaultLabelSelect.appendChild(opt);
    });
});

document.getElementById("save").onclick = async () => {

    const parsedLabels = labels.value
        .split("\n")
        .map(l => l.trim())
        .filter(Boolean);

    await browser.storage.local.set({
        rutorrentUrl: url.value.trim(),
        login: login.value.trim(),
        password: password.value,
        labels: parsedLabels,
        default_label: defaultLabelSelect.value
    });

    status.textContent = "Configuration sauvegardée";
};

    /* ====================
        TEST CONNEXION
    ==================== */

document.getElementById("test").onclick = async () => {

    status.textContent = "Test en cours...";

    const response = await browser.runtime.sendMessage({
        type: "TEST_CONNECTION"
    });

    if(response.success){
        status.textContent = "Connexion OK";
    } else {
        status.textContent = "Erreur : " + response.error;
    }
};

load();