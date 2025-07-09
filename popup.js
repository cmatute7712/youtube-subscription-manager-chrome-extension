document.addEventListener('DOMContentLoaded', function() {
    const exportBtn = document.getElementById('exportBtn');
    const importBtn = document.getElementById('importBtn');
    const fileInput = document.getElementById('fileInput');
    const unsubscribeBtn = document.getElementById('unsubscribeBtn');
    const stopBtn = document.getElementById('stopBtn');
    const status = document.getElementById('status');
    const toggleDebugBtn = document.getElementById('toggleDebug');
    const debugLogs = document.getElementById('debugLogs');
    const clearLogsBtn = document.getElementById('clearLogs');
    const logContent = document.getElementById('logContent');
    
    // Load last state of popup window
    chrome.storage.local.get(['lastPopupState', 'processStatus'], function(result) {
        if (result.lastPopupState) {
            console.log('Restoring last popup state...');
            debugLogs.style.display = result.lastPopupState.debugVisible ? 'block' : 'none';
            toggleDebugBtn.textContent = result.lastPopupState.debugVisible ? 'Hide Debug Logs' : 'Show Debug Logs';
            logContent.innerHTML = result.lastPopupState.logContent;
        }
        
        // Check if unsubscribe process is running
        if (result.processStatus && result.processStatus.isRunning) {
            console.log('Unsubscribe process is running, showing stop button');
            stopBtn.style.display = 'block';
            unsubscribeBtn.style.display = 'none';
            showStatus('Unsubscribe process is running...', 'info');
        }
        
        // Check if we have unsubscribe data to show the unsubscribe button
        chrome.storage.local.get(['unsubscribeList'], function(unsubResult) {
            if (unsubResult.unsubscribeList && unsubResult.unsubscribeList.length > 0 && (!result.processStatus || !result.processStatus.isRunning)) {
                unsubscribeBtn.style.display = 'block';
                unsubscribeBtn.textContent = `Unsubscribe from ${unsubResult.unsubscribeList.length} channels`;
            }
        });
    });

    // Listen for popup being opened in its own window
    document.getElementById('popoutBtn').addEventListener('click', function() {
        chrome.windows.create({
            url: chrome.runtime.getURL('popup.html'),
            type: 'popup',
            width: 400,
            height: 600
        });
    });

    // Save state before closing
    window.addEventListener('unload', function() {
        chrome.storage.local.set({
            lastPopupState: {
                debugVisible: debugLogs.style.display === 'block',
                logContent: logContent.innerHTML
            }
        });
    });

    // Debug logging functions
    function addLog(message) {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.style.cssText = 'padding: 2px 0; border-bottom: 1px solid #eee; font-size: 10px; color: #333;';
        logEntry.textContent = `[${timestamp}] ${message}`;
        logContent.appendChild(logEntry);
        logContent.scrollTop = logContent.scrollHeight;
    }
    
    // Toggle debug logs
    toggleDebugBtn.addEventListener('click', function() {
        if (debugLogs.style.display === 'none') {
            debugLogs.style.display = 'block';
            toggleDebugBtn.textContent = 'Hide Debug Logs';
        } else {
            debugLogs.style.display = 'none';
            toggleDebugBtn.textContent = 'Show Debug Logs';
        }
    });
    
    // Clear debug logs
    clearLogsBtn.addEventListener('click', function() {
        logContent.innerHTML = '';
    });

    // Show status message
    function showStatus(message, type = 'info') {
        status.textContent = message;
        status.className = `status ${type}`;
        status.style.display = 'block';
        
        if (type === 'success' || type === 'error') {
            setTimeout(() => {
                status.style.display = 'none';
            }, 5000);
        }
    }

    // Function to send export message to content script
    function sendExportMessage(tabId) {
        chrome.tabs.sendMessage(tabId, {action: 'exportSubscriptions'}, function(response) {
            if (chrome.runtime.lastError) {
                addLog('Export message failed: ' + JSON.stringify(chrome.runtime.lastError));
                showStatus('Failed to communicate with content script', 'error');
                return;
            }
            
            if (response && response.success) {
                addLog('Exported ' + response.count + ' subscriptions successfully!');
                showStatus(`Exported ${response.count} subscriptions successfully!`, 'success');
            } else {
                addLog('Failed to export subscriptions: ' + JSON.stringify(response));
                showStatus('Failed to export subscriptions. Attempting automatic navigation...', 'info');
                // Attempt automatic navigation to subscriptions page
                chrome.tabs.update(tabId, {url: "https://www.youtube.com/feed/channels"});
            }
        });
    }

    // Export subscriptions
    exportBtn.addEventListener('click', function() {
        showStatus('Exporting subscriptions...', 'info');
        addLog('Attempting to export subscriptions...');
        
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            const currentTab = tabs[0];
            console.log('Current tab URL:', currentTab.url);
            addLog('Current tab URL: ' + currentTab.url);
            
            if (currentTab.url.includes('youtube.com')) {
                // First try to send a message to see if content script is already loaded
                chrome.tabs.sendMessage(currentTab.id, {action: 'ping'}, function(response) {
                    if (chrome.runtime.lastError) {
                        addLog('Content script not loaded, injecting...');
                        // Content script not loaded, inject it
                        chrome.scripting.executeScript({
                            target: {tabId: currentTab.id},
                            files: ['content_simple.js']
                        }, function() {
                            if (chrome.runtime.lastError) {
                                addLog('Script injection failed: ' + JSON.stringify(chrome.runtime.lastError));
                                showStatus('Failed to inject content script. Please refresh the page.', 'error');
                                return;
                            }
                            addLog('Content script injected successfully');
                            sendExportMessage(currentTab.id);
                        });
                    } else {
                        addLog('Content script already loaded');
                        sendExportMessage(currentTab.id);
                    }
                });
            } else {
                showStatus('Please navigate to YouTube first', 'error');
                addLog('User not on a YouTube page.');
            }
        });
    });

    // Import CSV file
    importBtn.addEventListener('click', function() {
        fileInput.click();
    });

    fileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const csvData = e.target.result;
                try {
                    const parsedData = parseCSV(csvData);
                    const toUnsubscribe = parsedData.filter(row => 
                        row.unsubscribe && 
                        ['yes', 'y', '1', 'true'].includes(row.unsubscribe.toLowerCase())
                    );
                    
                    if (toUnsubscribe.length > 0) {
                        // Store data for unsubscribing
                        chrome.storage.local.set({
                            unsubscribeList: toUnsubscribe
                        });
                        
                        showStatus(`Found ${toUnsubscribe.length} channels to unsubscribe from`, 'success');
                        unsubscribeBtn.style.display = 'block';
                        unsubscribeBtn.textContent = `Unsubscribe from ${toUnsubscribe.length} channels`;
                    } else {
                        showStatus('No channels marked for unsubscription', 'info');
                    }
                } catch (error) {
                    showStatus('Error parsing CSV file', 'error');
                }
            };
            reader.readAsText(file);
        }
    });

    // Start bulk unsubscribe
    unsubscribeBtn.addEventListener('click', function() {
        showStatus('Starting bulk unsubscribe...', 'info');
        addLog('Attempting to start bulk unsubscribe...');
        
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            const currentTab = tabs[0];
            addLog('Current tab URL: ' + currentTab.url);
            
            if (currentTab.url.includes('youtube.com')) {
                // First check if we have data in storage
                chrome.storage.local.get(['unsubscribeList'], function(result) {
                    if (chrome.runtime.lastError) {
                        addLog('Storage error: ' + JSON.stringify(chrome.runtime.lastError));
                        showStatus('Storage error occurred', 'error');
                        return;
                    }
                    
                    if (!result.unsubscribeList || result.unsubscribeList.length === 0) {
                        addLog('No unsubscribe list found in storage');
                        showStatus('No channels marked for unsubscription. Please import a CSV file first.', 'error');
                        return;
                    }
                    
                    addLog('Found ' + result.unsubscribeList.length + ' channels to unsubscribe from');
                    
                    // First try to ping the content script
                    chrome.tabs.sendMessage(currentTab.id, {action: 'ping'}, function(response) {
                        if (chrome.runtime.lastError) {
                            addLog('Content script not loaded, injecting...');
                            // Content script not loaded, inject it
                            chrome.scripting.executeScript({
                                target: {tabId: currentTab.id},
                                files: ['content_simple.js']
                            }, function(results) {
                                if (chrome.runtime.lastError) {
                                    addLog('Script injection failed: ' + JSON.stringify(chrome.runtime.lastError));
                                    showStatus('Failed to inject content script. Please refresh the page.', 'error');
                                    return;
                                }
                                addLog('Content script injected successfully, results: ' + JSON.stringify(results));
                                // Give more time for the content script to initialize
                                setTimeout(() => {
                                    waitForContentScriptReady(currentTab.id, () => {
                                        startUnsubscribeProcess(currentTab.id);
                                        // Show stop button
                                        stopBtn.style.display = 'block';
                                    });
                                }, 2000);
                            });
                        } else {
                            addLog('Content script already loaded');
                            startUnsubscribeProcess(currentTab.id);
                            // Show stop button
                            stopBtn.style.display = 'block';
                        }
                    });
                });
            } else {
                showStatus('Please navigate to YouTube first', 'error');
                addLog('User not on a YouTube page.');
            }
        });
    });

    stopBtn.addEventListener('click', function() {
        showStatus('Stopping bulk unsubscribe...', 'info');
        addLog('Attempting to stop unsubscribe process...');
        
        chrome.runtime.sendMessage({action: 'stopBulkUnsubscribe'}, function(response) {
            if (response && response.success) {
                showStatus('Unsubscribe process stopped', 'success');
            } else {
                showStatus('Failed to stop unsubscribe process', 'error');
            }
            // Hide stop button
            stopBtn.style.display = 'none';
        });
    });
    
    function waitForContentScriptReady(tabId, callback) {
        let attempts = 0;
        const maxAttempts = 10;
        
        function tryPing() {
            attempts++;
            addLog(`Checking content script readiness (attempt ${attempts}/${maxAttempts})`);
            
            chrome.tabs.sendMessage(tabId, {action: 'ping'}, function(response) {
                if (chrome.runtime.lastError) {
                    if (attempts < maxAttempts) {
                        addLog('Content script not ready, waiting 500ms...');
                        setTimeout(tryPing, 500);
                    } else {
                        addLog('Content script failed to respond after max attempts');
                        showStatus('Content script failed to load properly', 'error');
                    }
                } else {
                    addLog('Content script is ready!');
                    callback();
                }
            });
        }
        
        tryPing();
    }
    
    function startUnsubscribeProcess(tabId) {
        addLog('Sending startUnsubscribe message to content script...');
        chrome.tabs.sendMessage(tabId, {action: 'startUnsubscribe'}, function(response) {
            if (chrome.runtime.lastError) {
                addLog('Unsubscribe message failed: ' + JSON.stringify(chrome.runtime.lastError));
                showStatus('Failed to communicate with content script', 'error');
                return;
            }
            
            if (response && response.success) {
                addLog('Bulk unsubscribe started successfully');
                showStatus('Bulk unsubscribe started! Check the page for progress.', 'success');
                unsubscribeBtn.style.display = 'none';
            } else {
                addLog('Unsubscribe process failed: ' + JSON.stringify(response));
                showStatus('Failed to start unsubscribe process: ' + (response ? response.error : 'Unknown error'), 'error');
            }
        });
    }

    // Simple CSV parser
    function parseCSV(csvText) {
        const lines = csvText.split('\n');
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const data = [];
        
        for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim()) {
                const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
                const row = {};
                headers.forEach((header, index) => {
                    row[header] = values[index] || '';
                });
                data.push(row);
            }
        }
        
        return data;
    }
});
