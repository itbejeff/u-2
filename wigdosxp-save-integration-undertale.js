/*
 * WigdosXP Cross-Origin Save System Integration for Undertale
 * 
 * This script enables Undertale to work with WigdosXP's save system
 * when running as a cross-origin iframe.
 * 
 * Include this script in your Undertale HTML file BEFORE the game script:
 * <script src="wigdosxp-save-integration-undertale.js"></script>
 * <script src="html5game/NXTALE.js"></script>
 */

(function() {
    'use strict';
    
    // Configuration for Undertale
    const GAME_CONFIG = {
        gameId: 'ut', // Must match the key in WigdosXP applications.js
        debug: true   // Set to false to disable console logging
    };
    
    // Game startup management
    const START_MESSAGE = '✅ Save data loaded from Firestore into iframe';
    let _gameStarted = false;
    let _startAttempted = false;
    
    // Debug logging helper
    function log(message, data = null) {
        if (GAME_CONFIG.debug) {
            console.log('[WigdosXP Save Integration]', message, data || '');
        }
    }
    
    // Game startup function - called when save data is ready or timeout reached
    function _startGameOnce() {
        if (_gameStarted || _startAttempted) return;
        _startAttempted = true;
        
        log('Starting game...');
        
        // Try different possible game start functions in order of preference
        if (typeof startGame === 'function') {
            try { 
                startGame(); 
                log('Game started using startGame() function');
                _gameStarted = true;
                return;
            } catch (e) { 
                console.error('Error calling startGame()', e); 
            }
        }
        
        // Try GameMaker_Init
        if (typeof GameMaker_Init === 'function') {
            try { 
                GameMaker_Init(); 
                log('Game started using GameMaker_Init()');
                _gameStarted = true;
                return;
            } catch (e) { 
                console.error('Error calling GameMaker_Init()', e); 
            }
        }
        
        // Try window.GameMaker_Init
        if (typeof window.GameMaker_Init === 'function') {
            try { 
                window.GameMaker_Init(); 
                log('Game started using window.GameMaker_Init()');
                _gameStarted = true;
                return;
            } catch (e) { 
                console.error('Error calling window.GameMaker_Init()', e); 
            }
        }
        
        // Set undertale_loaded flag regardless
        if (!localStorage.getItem('undertale_loaded')) {
            localStorage.setItem('undertale_loaded', 'true');
            log('Set undertale_loaded flag in localStorage');
        }
        
        // If no initialization function worked, just log and continue
        log('No game initialization function found or all failed - game should auto-start');
        
        // Mark as started even if we couldn't call an init function
        _gameStarted = true;
    }
    
    log('WigdosXP Save Integration loaded for game:', GAME_CONFIG.gameId);
    
    // Initialize based on environment
    if (window.parent !== window) {
        log('Detected WigdosXP iframe environment - initializing save system');
        initializeWigdosXPIntegration();
        
        // Set up console.log wrapper to detect save success message
        setupConsoleWrapper();
        
        // Fallback: start the game after 2 seconds if nothing triggered it
        setTimeout(() => {
            if (!_gameStarted) {
                log('Timeout reached; starting game as fallback.');
                _startGameOnce();
            }
        }, 2000);
    } else {
        log('Running standalone - save integration disabled, but will still start game');
        
        // In standalone mode, we still want to start the game
        // Set up console.log wrapper to detect save success message
        setupConsoleWrapper();
        
        // Start the game after a short delay to ensure everything is loaded
        setTimeout(() => {
            if (!_gameStarted) {
                log('Standalone mode: starting game after timeout.');
                _startGameOnce();
            }
        }, 1000);
    }
    
    function initializeWigdosXPIntegration() {
        // Request initial save data
        requestInitialSaveData();
        
        // Set up message listeners for ongoing operations
        setupMessageListeners();
        
        // Send ready signal
        sendReadySignal();
    }
    
    // Request initial save data from WigdosXP parent
    function requestInitialSaveData() {
        const messageId = `initial_load_${Date.now()}`;
        
        log('Requesting initial save data from parent...');
        
        // Set timeout for response
        const timeout = setTimeout(() => {
            log('Timeout waiting for initial save data - continuing without it');
        }, 5000);
        
        // Listen for response
        const responseHandler = function(event) {
            if (event.data && event.data.type === 'initialSaveDataResponse' && event.data.messageId === messageId) {
                clearTimeout(timeout);
                window.removeEventListener('message', responseHandler);
                
                log('Received initial save data response:', event.data);
                
                if (event.data.allLocalStorageData && Object.keys(event.data.allLocalStorageData).length > 0) {
                    log('Loading initial save data:', Object.keys(event.data.allLocalStorageData));
                    
                    // Load the save data into localStorage
                    Object.keys(event.data.allLocalStorageData).forEach(key => {
                        localStorage.setItem(key, event.data.allLocalStorageData[key]);
                    });
                    
                    log('Initial save data loaded successfully');
                    
                    // Start the game when initial save data is loaded (with a small delay)
                    setTimeout(() => {
                        log('Save data loaded from initial request; starting game.');
                        _startGameOnce();
                    }, 500);
                    
                    // Dispatch event for game to know save data is ready
                    window.dispatchEvent(new CustomEvent('wigdosxp-save-loaded', {
                        detail: {
                            gameId: GAME_CONFIG.gameId,
                            data: event.data.allLocalStorageData,
                            isInitialLoad: true
                        }
                    }));
                } else {
                    log('No initial save data available');
                    // Even if no save data, we might want to start the game
                    // Let the timeout handle this case
                }
            }
        };
        
        window.addEventListener('message', responseHandler);
        
        // Send request to parent
        window.parent.postMessage({
            type: 'getInitialSaveData',
            gameId: GAME_CONFIG.gameId,
            messageId: messageId
        }, '*');
    }
    
    // Set up console.log wrapper to detect save success message
    function setupConsoleWrapper() {
        if (typeof console === 'undefined') return;
        
        const _orig = console.log.bind(console);
        console.log = function(...args) {
            try { _orig(...args); } catch (e) { /* ignore */ }
            try {
                if (_gameStarted) return;
                for (const a of args) {
                    if (typeof a === 'string' && a.includes(START_MESSAGE)) {
                        log('Detected save-ready log; starting game.');
                        _startGameOnce();
                        break;
                    }
                }
            } catch (e) {
                try { _orig('[WigdosXP Save Integration] wrapper error', e); } catch (_) {}
            }
        };
    }
    
    function setupMessageListeners() {
        // Listen for save/load requests from WigdosXP parent frame
        window.addEventListener('message', function(event) {
            // Basic validation - ensure we're in an iframe and message is from parent
            if (window.parent === window || !event.data || !event.data.type) return;
            
            // Only process WigdosXP save system messages
            const validMessageTypes = [
                'getAllLocalStorageData',
                'setAllLocalStorageData',
                'requestSnapshot'
            ];
            
            if (!validMessageTypes.includes(event.data.type)) return;
            
            log('Received message from parent:', event.data);
            
            switch (event.data.type) {
                case 'getAllLocalStorageData':
                    handleGetAllLocalStorageData(event);
                    break;
                    
                case 'setAllLocalStorageData':
                    handleSetAllLocalStorageData(event);
                    break;
                    
                case 'requestSnapshot':
                    handleSnapshotRequest(event);
                    break;
            }
        });
    }
    
    function sendReadySignal() {
        // Send ready signal after a short delay
        setTimeout(() => {
            window.parent.postMessage({
                type: 'wigdosxp-integration-ready',
                gameId: GAME_CONFIG.gameId
            }, '*');
            log('Integration ready signal sent to parent');
        }, 1000);
    }
    
    // Handle save data request from WigdosXP (get all localStorage)
    function handleGetAllLocalStorageData(event) {
        log('Processing getAllLocalStorageData request');
        
        try {
            // Get all localStorage data
            const allLocalStorageData = {};
            
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                allLocalStorageData[key] = localStorage.getItem(key);
            }
            
            log('Retrieved localStorage data:', {
                keys: Object.keys(allLocalStorageData),
                totalItems: Object.keys(allLocalStorageData).length
            });
            
            // Send response back to WigdosXP
            event.source.postMessage({
                type: 'saveDataResponse',
                messageId: event.data.messageId,
                allLocalStorageData: allLocalStorageData
            }, event.origin);
            
            log('Save data response sent to parent');
            
        } catch (error) {
            console.error('Error getting localStorage data:', error);
            
            // Send error response
            event.source.postMessage({
                type: 'saveDataResponse',
                messageId: event.data.messageId,
                allLocalStorageData: null,
                error: error.message
            }, event.origin);
        }
    }
    
    // Handle load data request from WigdosXP (set all localStorage)
    function handleSetAllLocalStorageData(event) {
        log('Processing setAllLocalStorageData request');
        
        try {
            if (event.data.allLocalStorageData) {
                log('Restoring localStorage data:', {
                    keys: Object.keys(event.data.allLocalStorageData),
                    totalItems: Object.keys(event.data.allLocalStorageData).length
                });
                
                // Clear existing localStorage and restore all data
                localStorage.clear();
                
                Object.keys(event.data.allLocalStorageData).forEach(key => {
                    localStorage.setItem(key, event.data.allLocalStorageData[key]);
                });
                
                log('All localStorage data restored successfully');
                
                // For Undertale, we need to reload the page when save data is restored
                // This ensures the game properly loads with the restored save data
                log('Save data restored; reloading page to apply save data.');
                
                // Send success response first
                event.source.postMessage({
                    type: 'loadDataResponse',
                    messageId: event.data.messageId,
                    success: true
                }, event.origin);
                
                // Small delay then reload
                setTimeout(() => {
                    window.location.reload();
                }, 100);
                
                // Notify the game that save data was loaded
                window.dispatchEvent(new CustomEvent('wigdosxp-save-loaded', {
                    detail: {
                        gameId: GAME_CONFIG.gameId,
                        data: event.data.allLocalStorageData
                    }
                }));
                
                log('Dispatched wigdosxp-save-loaded event');
            } else {
                log('No save data provided to restore');
                
                // Send success response for no data case
                event.source.postMessage({
                    type: 'loadDataResponse',
                    messageId: event.data.messageId,
                    success: true
                }, event.origin);
                
                log('Load data response sent to parent (no data case)');
            }
            
        } catch (error) {
            console.error('Error setting localStorage data:', error);
            
            // Send error response
            event.source.postMessage({
                type: 'loadDataResponse',
                messageId: event.data.messageId,
                success: false,
                error: error.message
            }, event.origin);
        }
    }
    
    // Handle screenshot/snapshot request for window previews
    function handleSnapshotRequest(event) {
        log('Processing snapshot request');
        
        try {
            // Try to capture a screenshot using html2canvas if available
            if (typeof html2canvas !== 'undefined') {
                html2canvas(document.body, {
                    width: 240,
                    height: 140,
                    scale: 0.3
                }).then(canvas => {
                    const dataUrl = canvas.toDataURL('image/png');
                    event.source.postMessage({
                        type: 'snapshotResponse',
                        messageId: event.data.messageId,
                        dataUrl: dataUrl
                    }, event.origin);
                    log('Snapshot sent to parent');
                }).catch(err => {
                    log('Snapshot capture failed:', err);
                    // Send empty response
                    event.source.postMessage({
                        type: 'snapshotResponse',
                        messageId: event.data.messageId,
                        dataUrl: null
                    }, event.origin);
                });
            } else {
                // html2canvas not available, send empty response
                event.source.postMessage({
                    type: 'snapshotResponse',
                    messageId: event.data.messageId,
                    dataUrl: null
                }, event.origin);
                log('html2canvas not available for snapshot');
            }
        } catch (error) {
            console.error('Error handling snapshot request:', error);
            event.source.postMessage({
                type: 'snapshotResponse',
                messageId: event.data.messageId,
                dataUrl: null,
                error: error.message
            }, event.origin);
        }
    }
    
    // Optional: Listen for the save loaded event to refresh game state
    window.addEventListener('wigdosxp-save-loaded', function(event) {
        log('Save data loaded event received:', event.detail);
        
        // Dispatch a custom event that Undertale can listen for:
        window.dispatchEvent(new CustomEvent('gameDataLoaded', {
            detail: event.detail
        }));
    });
    
    log('WigdosXP Save Integration initialization complete');
    
})();