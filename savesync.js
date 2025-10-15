// Save Data Sync Script - IndexedDB <-> Local Storage
const SAVE_SYNC = {
  DB_NAME: '/_savedata', // The root database
  STORE_NAME: 'FILE_DATA', // The object store
  LOCAL_STORAGE_PREFIX: 'ut_save_',
  
  openDB: function() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        // Verify the object store exists
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          reject(new Error(`Store ${this.STORE_NAME} not found in database`));
          return;
        }
        resolve(db);
      };
    });
  },
  
  getAllFromIndexedDB: function() {
    return new Promise(async (resolve, reject) => {
      try {
        const db = await this.openDB();
        const transaction = db.transaction([this.STORE_NAME], 'readonly');
        const store = transaction.objectStore(this.STORE_NAME);
        const request = store.getAll();
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const keysRequest = store.getAllKeys();
          keysRequest.onsuccess = () => {
            resolve({
              values: request.result,
              keys: keysRequest.result
            });
          };
          keysRequest.onerror = () => reject(keysRequest.error);
        };
      } catch (error) {
        reject(error);
      }
    });
  },
  
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
  
  exportToLocalStorage: function() {
    return new Promise(async (resolve, reject) => {
      try {
        const data = await this.getAllFromIndexedDB();
        
        if (data.keys.length === 0) {
          console.log('No save data in IndexedDB to export');
          resolve(0);
          return;
        }
        
        data.keys.forEach((key, index) => {
          const localStorageKey = this.LOCAL_STORAGE_PREFIX + key;
          const value = data.values[index];
          
          localStorage.setItem(localStorageKey, JSON.stringify(value));
        });
        
        console.log('✓ Save data exported to Local Storage:', data.keys.length, 'files');
        resolve(data.keys.length);
      } catch (error) {
        console.error('Error exporting to Local Storage:', error);
        reject(error);
      }
    });
  },
  
  importFromLocalStorage: function() {
    return new Promise(async (resolve, reject) => {
      try {
        let importCount = 0;
        const promises = [];
        
        for (let i = 0; i < localStorage.length; i++) {
          const localKey = localStorage.key(i);
          
          if (localKey && localKey.startsWith(this.LOCAL_STORAGE_PREFIX)) {
            const indexedDBKey = localKey.substring(this.LOCAL_STORAGE_PREFIX.length);
            const dataString = localStorage.getItem(localKey);
            
            try {
              const data = JSON.parse(dataString);
              
              promises.push(
                this.saveToIndexedDB(indexedDBKey, data).then(() => {
                  importCount++;
                  console.log('✓ Restored save file:', indexedDBKey);
                })
              );
            } catch (parseError) {
              console.error('Error parsing Local Storage data for key:', localKey, parseError);
            }
          }
        }
        
        await Promise.all(promises);
        
        if (importCount > 0) {
          console.log('✓ Save data imported from Local Storage:', importCount, 'files');
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
  
  initialize: function() {
    console.log('Initializing Save Data Sync...');
    
    this.importFromLocalStorage()
      .then(() => {
        return this.exportToLocalStorage();
      })
      .then(() => {
        console.log('✓ Save Data Sync initialized successfully');
        
        // Set up periodic backup every 30 seconds
        setInterval(() => {
          this.exportToLocalStorage().catch(err => {
            console.error('Periodic backup failed:', err);
          });
        }, 10000);
      })
      .catch(error => {
        console.error('Save Data Sync initialization failed:', error);
      });
  }
};

// Wait for the game's IndexedDB to be created
window.addEventListener('load', function() {
  let attempts = 0;
  const maxAttempts = 20;
  
  function tryInitialize() {
    attempts++;
    
    SAVE_SYNC.openDB()
      .then(() => {
        console.log('✓ Database "/" found, initializing sync...');
        SAVE_SYNC.initialize();
      })
      .catch(error => {
        if (attempts < maxAttempts) {
          console.log(`Waiting for database... (attempt ${attempts}/${maxAttempts})`);
          setTimeout(tryInitialize, 1500);
        } else {
          console.error('Database not found after', maxAttempts, 'attempts. Save sync disabled.');
          console.error('Last error:', error.message);
        }
      });
  }
  
  // Start trying after 3 seconds (game needs more time to create the database)
  setTimeout(tryInitialize, 3000);
});