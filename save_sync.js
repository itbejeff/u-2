const saveKeys = [
    "CreatedwithGameMaker.0.file0",
    "CreatedwithGameMaker.0.file9",
    "CreatedwithGameMaker.0.undertale.ini"
];

let saveData = null;
let gameStarted = false;
let gotData = false;

// Listen for postMessages from parent (WigdosXP)
window.addEventListener("message", async (event) => {

    // 1. Parent sends Save Data to Load
    if (event.data.type === "load" && event.data.saveData !== null) {
        
        gotData = true;
        saveData = event.data.saveData;

        for (const [key, value] of Object.entries(saveData)) {
            if (saveKeys.includes(key)) localStorage.setItem(key, value);
        }
        
        await startGame();
        
    }

    // 2. Parent requests Save Data
    if (event.data.type === "save") {
        
        // Store Save Data
        saveData = await saveGame();
        // If this is a MessageChannel reply, notify parent
        if (event.ports && event.ports[0]) {
            if (saveData.length > 0) event.ports[0].postMessage({ status: "success", saveData: saveData });
            else event.ports[0].postMessage({ status: "success" });
        }
        // Optionally clear save cache
        saveKeys.forEach(key => localStorage.removeItem(key));
        sessionStorage.removeItem("undertale_loaded");
    }
});

// Fallback: If no user is set after a short timeout, play as guest
setTimeout(() => {
    if (!gotData && !gameStarted) startGame();
}, 1000);

async function startGame() {
    if (gameStarted) return;
    gameStarted = true;

    if (!sessionStorage.getItem("undertale_loaded")) {
        sessionStorage.setItem("undertale_loaded", "true");
    }
    GameMaker_Init?.();
}

async function saveGame() {
    // Collect Save Data
    const data = Object.fromEntries(
        saveKeys.map(key => [key, localStorage.getItem(key)]).filter(([_, val]) => val !== null)
    );
    // No More DB For You
    return data;
}
