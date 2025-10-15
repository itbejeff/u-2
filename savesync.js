// Save Data Sync Script - IndexedDB <-> Local Storage
// Add this near the top of your script, after the Module definition

const SAVE_SYNC = {
  DB_NAME: 'IndexedDB', // Adjust this to your actual database name if different
  STORE_NAME: '/_savedata',
  LOCAL_STORAGE_PREFIX: 'savedata_',
  
  // Open IndexedDB connection
  openDB: function() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  },
  
  // Get all data from IndexedDB
  getAllFromIndexedDB: function() {
    return new Promise(async (resolve, reject) => {
      try {
        const db = await this.openDB();
        const transaction = db.transaction([this.STORE_NAME], 'readonly');
        const store = transaction.objectStore(this.STORE_NAME);
        const request = store.getAll();
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const keys = store.getAllKeys();
          keys.onsuccess = () => {
            resolve({
              values: request.result,
              keys: keys.result
            });
          };
        };
      } catch (error) {
        reject(error);
      }
    });
  },
  
  // Save data to IndexedDB
  saveToIndexedDB: function(key, data) {
    return new Promise(async (resolve, reject) => {
      try {
        const db = await this.openDB();
        const transaction = db.transaction([this.STORE_NAME], 'readwrite');
        const store = transaction.objectStore(this.STORE_NAME);
        const request = store.put(data, key);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      } catch (error) {
        reject(error);
      }
    });
  },
  
  // Export IndexedDB data to Local Storage
  exportToLocalStorage: function() {
    return new Promise(async (resolve, reject) => {
      try {
        const data = await this.getAllFromIndexedDB();
        
        data.keys.forEach((key, index) => {
          const localStorageKey = this.LOCAL_STORAGE_PREFIX + key;
          const value = data.values[index];
          
          // Store as JSON string
          localStorage.setItem(localStorageKey, JSON.stringify(value));
        });
        
        console.log('Save data exported to Local Storage:', data.keys.length, 'files');
        resolve(data.keys.length);
      } catch (error) {
        console.error('Error exporting to Local Storage:', error);
        reject(error);
      }
    });
  },
  
  // Import Local Storage data to IndexedDB (overwrites IndexedDB)
  importFromLocalStorage: function() {
    return new Promise(async (resolve, reject) => {
      try {
        let importCount = 0;
        const promises = [];
        
        // Scan Local Storage for save data
        for (let i = 0; i < localStorage.length; i++) {
          const localKey = localStorage.key(i);
          
          // Check if this is a save data key
          if (localKey && localKey.startsWith(this.LOCAL_STORAGE_PREFIX)) {
            const indexedDBKey = localKey.substring(this.LOCAL_STORAGE_PREFIX.length);
            const dataString = localStorage.getItem(localKey);
            
            try {
              const data = JSON.parse(dataString);
              
              // Save to IndexedDB (overwrite)
              promises.push(
                this.saveToIndexedDB(indexedDBKey, data).then(() => {
                  importCount++;
                  console.log('Restored save file to IndexedDB:', indexedDBKey);
                })
              );
            } catch (parseError) {
              console.error('Error parsing Local Storage data for key:', localKey, parseError);
            }
          }
        }
        
        await Promise.all(promises);
        
        if (importCount > 0) {
          console.log('Save data imported from Local Storage:', importCount, 'files');
          showRollbackMessage(`Restored ${importCount} save file(s) from backup`);
        } else {
          console.log('No save data found in Local Storage to import');
        }
        
        resolve(importCount);
      } catch (error) {
        console.error('Error importing from Local Storage:', error);
        reject(error);
      }
    });
  },
  
  // Initialize sync on game start
  initialize: function() {
    console.log('Initializing Save Data Sync...');
    
    // First, try to import from Local Storage (restore saves)
    this.importFromLocalStorage()
      .then(() => {
        // Then export current IndexedDB state to Local Storage (backup)
        return this.exportToLocalStorage();
      })
      .then(() => {
        console.log('Save Data Sync initialized successfully');
        
        // Set up periodic backup (every 30 seconds)
        setInterval(() => {
          this.exportToLocalStorage().catch(err => {
            console.error('Periodic backup failed:', err);
          });
        }, 30000);
      })
      .catch(error => {
        console.error('Save Data Sync initialization failed:', error);
      });
  }
};

// Add to Module.preRun to execute before game starts
Module.preRun.push(function() {
  console.log('Running save data sync...');
  
  // Wait a bit for IndexedDB to be ready
  setTimeout(() => {
    SAVE_SYNC.initialize();
  }, 100);
});