/*
 * WigdosXP Cross-Origin Save System Integration for Undertale
 * 
 * This script enables Undertale to work with WigdosXP's save system
 * when running as a cross-origin iframe.
 * 
 * Include this script in your Undertale HTML file:
 * <script src="wigdosxp-save-integration.js"></script>
 */

(function() {
    'use strict';
    
    // Configuration for Undertale
    const GAME_CONFIG = {
        gameId: 'ut', // Must match the key in WigdosXP applications.js
        debug: true   // Set to false to disable console logging
    };
    
    // Debug logging helper
    function log(message, data = null) {
        if (GAME_CONFIG.debug) {
            console.log('[WigdosXP Save Integration]', message, data || '');
        }
    }
    
    log('WigdosXP Save Integration loaded for game:', GAME_CONFIG.gameId);
    
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
            
            log('Received message from parent:', event.data);        switch (event.data.type) {
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
            }
            
            // Send success response
            event.source.postMessage({
                type: 'loadDataResponse',
                messageId: event.data.messageId,
                success: true
            }, event.origin);
            
            log('Load data response sent to parent');
            
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
        
        // Undertale-specific: You might want to trigger a game refresh here
        // For example, if Undertale has a function to reload game state:
        // if (typeof refreshGameState === 'function') {
        //     refreshGameState();
        // }
        
        // Or dispatch a custom event that Undertale can listen for:
        window.dispatchEvent(new CustomEvent('gameDataLoaded', {
            detail: event.detail
        }));
    });
    
    // Initialize the complete integration system
    function initializeIntegration() {
        log('Initializing complete integration system');
        
        // Set up all message listeners and prepare for save/load operations
        setupPostGameIntegration();
        
        // Send ready signal to parent if we're in an iframe
        if (window.parent !== window) {
            window.parent.postMessage({
                type: 'wigdosxp-integration-ready',
                gameId: GAME_CONFIG.gameId
            }, '*');
            log('Integration ready signal sent to parent');
        }
    }
    
    // Send ready signal to parent (optional)
    window.addEventListener('load', function() {
        // Wait a bit more to ensure game is fully initialized
        setTimeout(function() {
            initializeIntegration();
        }, 2000); // Wait 2 seconds after load event
    });    log('WigdosXP Save Integration initialization complete');
    
})();