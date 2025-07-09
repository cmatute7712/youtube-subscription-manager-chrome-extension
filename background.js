// Background script for YouTube Subscription Manager
let unsubscribeProcess = null;

chrome.runtime.onInstalled.addListener(() => {
    console.log('YouTube Subscription Manager installed');
});

// Handle downloads
chrome.downloads.onCreated.addListener((downloadItem) => {
    if (downloadItem.filename.includes('youtube_subscriptions')) {
        console.log('YouTube subscriptions CSV downloaded:', downloadItem.filename);
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Background received message:', request.action);
    
    if (request.action === 'startBulkUnsubscribe') {
        console.log('Starting bulk unsubscribe in background');
        startBulkUnsubscribeProcess(sender.tab.id);
        sendResponse({success: true});
    }
    
    if (request.action === 'contentScriptReady') {
        console.log('Content script ready on tab:', sender.tab.id);
        // Content script is ready, continue process if needed
        if (unsubscribeProcess && unsubscribeProcess.tabId === sender.tab.id) {
            continueUnsubscribeProcess(sender.tab.id);
        }
    }
    
    if (request.action === 'stopBulkUnsubscribe') {
        console.log('Stop bulk unsubscribe requested');
        if (unsubscribeProcess) {
            console.log('Stopping unsubscribe process');
            unsubscribeProcess.stopped = true;
            // Clear process status
            chrome.storage.local.set({
                processStatus: {
                    isRunning: false,
                    stopped: true
                }
            });
            unsubscribeProcess = null;
            sendResponse({success: true, message: 'Unsubscribe process stopped'});
        } else {
            console.log('No unsubscribe process to stop');
            sendResponse({success: false, message: 'No unsubscribe process running'});
        }
    }
});

async function startBulkUnsubscribeProcess(tabId) {
    try {
        // Get the unsubscribe list from storage
        const result = await chrome.storage.local.get(['unsubscribeList']);
        
        if (!result.unsubscribeList || result.unsubscribeList.length === 0) {
            console.log('No unsubscribe list found');
            return;
        }
        
        unsubscribeProcess = {
            tabId: tabId,
            channels: result.unsubscribeList,
            currentIndex: 0,
            successCount: 0,
            errorCount: 0
        };
        
        // Set process status
        await chrome.storage.local.set({
            processStatus: {
                isRunning: true,
                startTime: new Date().toISOString(),
                totalChannels: unsubscribeProcess.channels.length
            }
        });
        
        console.log(`Starting bulk unsubscribe for ${unsubscribeProcess.channels.length} channels`);
        
        // Start processing
        processNextChannel();
        
    } catch (error) {
        console.error('Error starting bulk unsubscribe:', error);
    }
}

async function processNextChannel() {
    if (!unsubscribeProcess || unsubscribeProcess.stopped || unsubscribeProcess.currentIndex >= unsubscribeProcess.channels.length) {
        // Process complete or stopped
        if (unsubscribeProcess && unsubscribeProcess.stopped) {
            console.log('Bulk unsubscribe stopped by user');
        } else {
            console.log('Bulk unsubscribe complete');
        }
        if (unsubscribeProcess) {
            await chrome.storage.local.remove(['unsubscribeList']);
            // Clear process status
            await chrome.storage.local.set({
                processStatus: {
                    isRunning: false,
                    completed: true,
                    completedAt: new Date().toISOString()
                }
            });
            unsubscribeProcess = null;
        }
        return;
    }
    
    const channel = unsubscribeProcess.channels[unsubscribeProcess.currentIndex];
    const tabId = unsubscribeProcess.tabId;
    
    console.log(`Processing channel ${unsubscribeProcess.currentIndex + 1}/${unsubscribeProcess.channels.length}: ${channel.channel_name}`);
    
    try {
        // Navigate to the channel page
        await chrome.tabs.update(tabId, { url: channel.channel_url });
        
        // Wait for navigation to complete
        await new Promise(resolve => {
            const listener = (tabId, changeInfo) => {
                if (changeInfo.status === 'complete') {
                    chrome.tabs.onUpdated.removeListener(listener);
                    resolve();
                }
            };
            chrome.tabs.onUpdated.addListener(listener);
        });
        
        // Wait a bit more for page to settle
        await new Promise(resolve => setTimeout(resolve, 1250));
        
        // Send message to content script to unsubscribe
        console.log('Sending unsubscribe message to content script...');
        try {
            const response = await chrome.tabs.sendMessage(tabId, {
                action: 'unsubscribeFromChannel',
                channelUrl: channel.channel_url,
                channelName: channel.channel_name
            });
            
            console.log('Response from content script:', response);
            
            if (response && response.success) {
                unsubscribeProcess.successCount++;
                console.log(`Successfully unsubscribed from ${channel.channel_name}`);
            } else {
                unsubscribeProcess.errorCount++;
                console.log(`Failed to unsubscribe from ${channel.channel_name}:`, response?.error);
            }
        } catch (error) {
            console.error('Error sending message to content script:', error);
            unsubscribeProcess.errorCount++;
            
            // Try to inject content script if it's not loaded
            console.log('Attempting to inject content script...');
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    files: ['content_simple.js']
                });
                
                console.log('Content script injected, retrying unsubscribe...');
                // Wait a bit for content script to initialize
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                const retryResponse = await chrome.tabs.sendMessage(tabId, {
                    action: 'unsubscribeFromChannel',
                    channelUrl: channel.channel_url,
                    channelName: channel.channel_name
                });
                
                if (retryResponse && retryResponse.success) {
                    unsubscribeProcess.successCount++;
                    console.log(`Successfully unsubscribed from ${channel.channel_name} (retry)`);
                } else {
                    unsubscribeProcess.errorCount++;
                    console.log(`Failed to unsubscribe from ${channel.channel_name} (retry):`, retryResponse?.error);
                }
            } catch (retryError) {
                console.error('Retry also failed:', retryError);
                unsubscribeProcess.errorCount++;
            }
        }
        
    } catch (error) {
        console.error(`Error processing ${channel.channel_name}:`, error);
        unsubscribeProcess.errorCount++;
    }
    
    // Move to next channel
    unsubscribeProcess.currentIndex++;
    
    // Rate limiting
    setTimeout(() => {
        processNextChannel();
    }, 750);
}

function continueUnsubscribeProcess(tabId) {
    if (unsubscribeProcess && unsubscribeProcess.tabId === tabId) {
        // Content script is ready, we can continue
        console.log('Content script ready, continuing process');
    }
}
