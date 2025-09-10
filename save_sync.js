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
    console.log("[save_sync] Received message:", event.data);

    // 1. Parent sends Save Data to Load
    if (event.data.type === "load" && event.data.saveData !== null) {
        console.log("[save_sync] Loading save data from parent...");
        gotData = true;
        saveData = event.data.saveData;

        for (const [key, value] of Object.entries(saveData)) {
            if (saveKeys.includes(key)) {
                console.log(`[save_sync] Setting localStorage key: ${key}`);
                localStorage.setItem(key, value);
            }
        }

        console.log("[save_sync] Starting game after loading save data...");
        await startGame();
    }

    // 2. Parent requests Save Data
    if (event.data.type === "save") {
        console.log("[save_sync] Parent requested save data...");
        // Store Save Data
        saveData = await saveGame();
        console.log("[save_sync] Save data collected:", saveData);

        // If this is a MessageChannel reply, notify parent
        if (event.ports && event.ports[0]) {
            if (Object.keys(saveData).length > 0) {
                console.log("[save_sync] Sending save data to parent via MessageChannel...");
                event.ports[0].postMessage({ status: "success", saveData: saveData });
            } else {
                console.log("[save_sync] No save data to send, sending success status only.");
                event.ports[0].postMessage({ status: "success" });
            }
        }

        // Optionally clear save cache
        console.log("[save_sync] Clearing localStorage save keys...");
        saveKeys.forEach(key => localStorage.removeItem(key));
        sessionStorage.removeItem("undertale_loaded");
    }
});

// Fallback: If no user is set after a short timeout, play as guest
setTimeout(() => {
    console.log("[save_sync] Timeout reached, checking if game should start as guest...");
    if (!gotData && !gameStarted) {
        console.log("[save_sync] No save data received, starting game as guest...");
        startGame();
    }
}, 1000);

async function startGame() {
    if (gameStarted) {
        console.log("[save_sync] Game already started, skipping...");
        return;
    }
    gameStarted = true;

    if (!sessionStorage.getItem("undertale_loaded")) {
        console.log("[save_sync] Setting undertale_loaded in sessionStorage...");
        sessionStorage.setItem("undertale_loaded", "true");
    }
    console.log("[save_sync] Initializing GameMaker...");
    GameMaker_Init?.();
}

async function saveGame() {
    console.log("[save_sync] Collecting save data from localStorage...");
    // Collect Save Data
    const data = Object.fromEntries(
        saveKeys.map(key => [key, localStorage.getItem(key)]).filter(([_, val]) => val !== null)
    );
    console.log("[save_sync] Save data collected:", data);
    // No More DB For You
    return data;
}

/**
 * Suppress logs, errors, and warns from /html5game/NXTALE.js only,
 * including network errors (GET/HEAD 404s) and repetitive requestAnimationFrame logs.
 */

const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

function suppressIfNXTALE(fn) {
    return function(...args) {
        const stack = new Error().stack;
        // Suppress if called from NXTALE.js
        if (stack && stack.includes("NXTALE.js")) {
            // Suppress network 404 errors from NXTALE.js
            if (
                args.length > 0 &&
                typeof args[0] === "string" &&
                (
                    // Suppress GET/HEAD 404 errors
                    args[0].match(/(GET|HEAD) .* 404/) ||
                    args[0].includes("Not Found") ||
                    // Suppress repetitive requestAnimationFrame logs
                    args[0].includes("requestAnimationFrame")
                )
            ) {
                return;
            }
            // Suppress all logs/errors/warns from NXTALE.js
            return;
        }
        fn.apply(console, args);
    };
}

console.log = suppressIfNXTALE(originalConsoleLog);
console.error = suppressIfNXTALE(originalConsoleError);
console.warn = suppressIfNXTALE(originalConsoleWarn);
