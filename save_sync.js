// Firebase initialization (already in your HTML)
const db = firebase.firestore();

const saveKeys = [
    "CreatedwithGameMaker.0.file0",
    "CreatedwithGameMaker.0.file9",
    "CreatedwithGameMaker.0.undertale.ini"
];

let currentUser = "guest";
let gameStarted = false;
let gotUser = false;

// Listen for postMessages from parent (WigdosXP)
window.addEventListener("message", async (event) => {
    const { type, username } = event.data || {};

    // 1. Parent sets user
    if (type === "setUser") {
        gotUser = true;
        if (username) currentUser = username;
        await startGame();
    }

    // 2. Parent requests save
    if (type === "saveGame") {
        await saveGame();
        // If this is a MessageChannel reply, notify parent
        if (event.ports && event.ports[0]) {
            event.ports[0].postMessage("save-complete");
        }
        // Optionally clear save cache
        saveKeys.forEach(key => localStorage.removeItem(key));
        sessionStorage.removeItem("undertale_loaded");
    }
});

// Fallback: If no user is set after a short timeout, play as guest
setTimeout(() => {
    if (!gotUser && !gameStarted) startGame();
}, 1000);

async function startGame() {
    if (gameStarted) return;
    gameStarted = true;

    if (!sessionStorage.getItem("undertale_loaded")) {
        sessionStorage.setItem("undertale_loaded", "true");
        await loadGame();
    }
    GameMaker_Init?.();
}

async function saveGame() {
    const data = Object.fromEntries(
        saveKeys.map(key => [key, localStorage.getItem(key)]).filter(([_, val]) => val !== null)
    );
    try {
        await db.collection("game_saves").doc(currentUser).set(data);
        // Optionally: alert("✅ Game saved for: " + currentUser);
    } catch (err) {
        console.error("❌ Save error:", err);
        // Optionally: alert("❌ Failed to save.");
    }
}

async function loadGame() {
    try {
        const doc = await db.collection("game_saves").doc(currentUser).get();
        if (!doc.exists) {
            // Optionally: alert("⚠️ No save found for: " + currentUser);
            return;
        }
        const data = doc.data();
        for (const [key, value] of Object.entries(data)) {
            if (saveKeys.includes(key)) localStorage.setItem(key, value);
        }
        // Optionally: alert("✅ Game loaded for: " + currentUser);
    } catch (err) {
        console.error("❌ Load error:", err);
        // Optionally: alert("❌ Failed to load.");
    }
}