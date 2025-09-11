// Minimal listener: when the exact success log appears, start the game.
// Otherwise start after a short timeout so the iframe doesn't hang.

const START_MESSAGE = '✅ Save data loaded from Firestore into iframe';
let _started = false;

function _startGameOnce() {
    if (_started) return;
    _started = true;
    if (typeof startGame === 'function') {
        try { startGame(); } catch (e) { console.error('Error calling startGame()', e); }
    } else {
        if (!localStorage.getItem('undertale_loaded')) localStorage.setItem('undertale_loaded', 'true');
        try { GameMaker_Init?.(); } catch (e) { console.error('Error calling GameMaker_Init()', e); }
    }
}

// Wrap console.log to watch for the success message while preserving behavior
(function() {
    if (typeof console === 'undefined') return;
    const _orig = console.log.bind(console);
    console.log = function(...args) {
        try { _orig(...args); } catch (e) { /* ignore */ }
        try {
            if (_started) return;
            for (const a of args) {
                if (typeof a === 'string' && a.includes(START_MESSAGE)) {
                    _orig('[firestore_listener] Detected save-ready log; starting game.');
                    _startGameOnce();
                    break;
                }
            }
        } catch (e) {
            try { _orig('[firestore_listener] wrapper error', e); } catch (_) {}
        }
    };
})();

// Fallback: start the game after 2 seconds if nothing triggered it
setTimeout(() => {
    if (!_started) {
        console.log('[firestore_listener] Timeout reached; starting game as fallback.');
        _startGameOnce();
    }
}, 2000);
