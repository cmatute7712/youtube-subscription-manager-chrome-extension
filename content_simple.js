// Simplified content script for testing
console.log('Content script loaded at:', new Date().toLocaleTimeString());

// Test if chrome.runtime is available
if (typeof chrome !== 'undefined' && chrome.runtime) {
    console.log('Chrome runtime available');
} else {
    console.error('Chrome runtime not available');
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Content script received message:', request.action);
    
    if (request.action === 'ping') {
        console.log('Ping received, responding...');
        sendResponse({success: true, message: 'Content script loaded'});
        return true;
    }
    
    if (request.action === 'startUnsubscribe') {
        console.log('Unsubscribe request received - forwarding to background');
        // Forward to background script to handle navigation
        chrome.runtime.sendMessage({action: 'startBulkUnsubscribe'});
        sendResponse({success: true, message: 'Unsubscribe process started'});
        return true;
    }
    
    if (request.action === 'unsubscribeFromChannel') {
        console.log('Unsubscribe from channel request received:', request.channelName);
        console.log('Request details:', request);
        
        // Send immediate response to acknowledge receipt
        setTimeout(() => {
            unsubscribeFromChannelOnly(request.channelUrl, request.channelName)
                .then(result => {
                    console.log('Unsubscribe result:', result);
                    sendResponse(result);
                })
                .catch(error => {
                    console.error('Unsubscribe error:', error);
                    sendResponse({success: false, error: error.message});
                });
        }, 100);
        
        return true; // Keep message channel open for async response
    }
    
    if (request.action === 'exportSubscriptions') {
        console.log('Export subscriptions request received');
        exportSubscriptions()
            .then(result => {
                console.log('Export result:', result);
                sendResponse(result);
            })
            .catch(error => {
                console.error('Export error:', error);
                sendResponse({success: false, error: error.message});
            });
        return true; // Must return true to indicate async response
    }
    
    // Default response
    sendResponse({success: false, message: 'Unknown action'});
    return true;
});

// Send ready signal
setTimeout(() => {
    console.log('Sending ready signal...');
    try {
        chrome.runtime.sendMessage({action: 'contentScriptReady'}, (response) => {
            console.log('Ready signal sent, response:', response);
        });
    } catch (e) {
        console.log('Could not send ready signal:', e);
    }
}, 100);

console.log('Content script initialization complete');

// Simplified unsubscribe function for current page only
async function unsubscribeFromChannelOnly(channelUrl, channelName) {
    try {
        console.log(`Starting unsubscribe for: ${channelName}`);
        console.log(`Current URL: ${window.location.href}`);
        console.log(`Target URL: ${channelUrl}`);
        
        // This function assumes we're already on the channel page
        console.log('Looking for subscribe button...');
        
        // Find subscribe button - the notification settings button that opens the menu
        const subscribeSelectors = [
            'button.yt-spec-button-shape-next[aria-label*="notification"]',
            'button.yt-spec-button-shape-next[aria-label*="setting"]',
            'button[aria-label*="Current setting is"]',
            'button[aria-label*="Tap to change your notification setting"]',
            // Fallback selectors
            'button[aria-label*="Subscribed"]',
            'button[aria-label*="Subscribe"]',
            'ytd-subscribe-button-renderer button'
        ];
        
        let subscribeButton = null;
        
        // Try multiple times to find the button
        for (let attempt = 0; attempt < 5; attempt++) {
            console.log(`Attempt ${attempt + 1} to find subscribe button`);
            
            for (const selector of subscribeSelectors) {
                subscribeButton = document.querySelector(selector);
                if (subscribeButton) {
                    const buttonText = subscribeButton.textContent.trim().toLowerCase();
                    const ariaLabel = subscribeButton.getAttribute('aria-label') || '';
                    
                    console.log(`Found button: text="${buttonText}", aria-label="${ariaLabel}"`);
                    
                    // Check if this is a "Subscribe" button (meaning we're already unsubscribed)
                    if (buttonText.includes('subscribe') && !buttonText.includes('subscribed') && !ariaLabel.toLowerCase().includes('subscribed')) {
                        console.log('Found "Subscribe" button - already unsubscribed from this channel');
                        return { success: true, message: 'Already unsubscribed from this channel' };
                    }
                    
                    // If it's a subscribed/notification button, we can proceed
                    if (ariaLabel.toLowerCase().includes('subscribed') || ariaLabel.toLowerCase().includes('notification') || ariaLabel.toLowerCase().includes('setting')) {
                        console.log(`Found valid subscribe button: ${ariaLabel}`);
                        break;
                    }
                    
                    // Clear subscribeButton if it's not the right type
                    subscribeButton = null;
                }
            }
            
            if (subscribeButton) break;
            
            console.log(`No valid button found in attempt ${attempt + 1}, waiting...`);
            await new Promise(resolve => setTimeout(resolve, 450));
        }
        
        if (!subscribeButton) {
            console.log('Subscribe button not found - checking if already unsubscribed...');
            
            // Check if we can find a regular "Subscribe" button instead
            const regularSubscribeSelectors = [
                'button[aria-label="Subscribe"]',
                'button[aria-label*="Subscribe to"]',
                'ytd-subscribe-button-renderer button[aria-label="Subscribe"]'
            ];
            
            let regularSubscribeButton = null;
            for (const selector of regularSubscribeSelectors) {
                regularSubscribeButton = document.querySelector(selector);
                if (regularSubscribeButton) {
                    console.log('Found regular subscribe button - already unsubscribed from this channel');
                    return { success: true, message: 'Already unsubscribed from this channel' };
                }
            }
            
            console.error('No subscribe or notification button found');
            // List all buttons for debugging
            const allButtons = document.querySelectorAll('button');
            console.log('All buttons on page:');
            allButtons.forEach((btn, index) => {
                console.log(`Button ${index}: ${btn.textContent.trim()} | aria-label: ${btn.getAttribute('aria-label')}`);
            });
            throw new Error('Subscribe button not found');
        }
        
        console.log('Clicking subscribe button...');
        subscribeButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        await new Promise(resolve => setTimeout(resolve, 750));
        
        // Look for 'Unsubscribe' menu item (last instance)
        console.log('Looking for unsubscribe menu item...');
        const unsubscribeSelectors = [
            '#contentWrapper yt-list-item-view-model:last-child',
            'div#contentWrapper yt-list-item-view-model[role="menuitem"]:last-child',
            'tp-yt-iron-dropdown yt-list-item-view-model:last-child',
            // Fallback selectors
            'button[aria-label*="Unsubscribe"]',
            'yt-button-renderer[aria-label*="Unsubscribe"] button'
        ];
        
        let unsubscribeButton = null;
        for (let attempt = 0; attempt < 3; attempt++) {
            console.log(`Attempt ${attempt + 1} to find unsubscribe button`);
            for (const selector of unsubscribeSelectors) {
                unsubscribeButton = document.querySelector(selector);
                if (unsubscribeButton) {
                    console.log('Unsubscribe button found:', unsubscribeButton.getAttribute('aria-label'));
                    break;
                }
            }
            if (unsubscribeButton) break;
            await new Promise(resolve => setTimeout(resolve, 450));
        }

        if (!unsubscribeButton) {
            console.error('Unsubscribe button not found after clicking subscribe');
            throw new Error('Unsubscribe button not found');
        }
        
        console.log('Clicking unsubscribe button...');
        unsubscribeButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        await new Promise(resolve => setTimeout(resolve, 750));
        
        // Look for toast confirmation
        console.log('Looking for toast confirmation...');
        const toastSelectors = [
            'button.yt-spec-button-shape-next[aria-label="Unsubscribe"]',
            'button.yt-spec-button-shape-next--call-to-action[aria-label="Unsubscribe"]',
            // Fallback selectors
            'tp-yt-paper-toast button[aria-label*="Unsubscribe"]',
            'ytd-notification-action-button-renderer button[aria-label*="Unsubscribe"]'
        ];

        let toastButton = null;
        for (let attempt = 0; attempt < 3; attempt++) {
            console.log(`Attempt ${attempt + 1} to find toast confirm button`);
            for (const selector of toastSelectors) {
                toastButton = document.querySelector(selector);
                if (toastButton) {
                    console.log('Toast confirm button found:', toastButton.getAttribute('aria-label'));
                    break;
                }
            }
            if (toastButton) break;
            await new Promise(resolve => setTimeout(resolve, 450));
        }

        if (toastButton) {
            console.log('Clicking toast confirm button...');
            toastButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        await new Promise(resolve => setTimeout(resolve, 450));
        } else {
            console.log('No toast confirmation found');
        }
        
        console.log(`Successfully unsubscribed from ${channelName}`);
        return { success: true };
    } catch (error) {
        console.error(`Error unsubscribing from ${channelName}:`, error);
        return { success: false, error: error.message };
    }
}

// Progress indicator functions
function createProgressIndicator() {
    const existing = document.getElementById('yt-sub-manager-progress');
    if (existing) existing.remove();

    const progressDiv = document.createElement('div');
    progressDiv.id = 'yt-sub-manager-progress';
    progressDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 15px;
        border-radius: 8px;
        z-index: 10000;
        font-family: Arial, sans-serif;
        font-size: 14px;
        max-width: 300px;
    `;
    
    progressDiv.innerHTML = `
        <div id="progress-title">YouTube Subscription Manager</div>
        <div id="progress-status">Starting...</div>
        <div id="progress-bar" style="width: 100%; height: 4px; background: #333; margin: 10px 0; border-radius: 2px;">
            <div id="progress-fill" style="width: 0%; height: 100%; background: #4CAF50; border-radius: 2px; transition: width 0.3s;"></div>
        </div>
        <div id="progress-details"></div>
    `;
    
    document.body.appendChild(progressDiv);
    return progressDiv;
}

function updateProgress(status, details = '', percent = 0) {
    const statusEl = document.getElementById('progress-status');
    const detailsEl = document.getElementById('progress-details');
    const fillEl = document.getElementById('progress-fill');
    
    if (statusEl) statusEl.textContent = status;
    if (detailsEl) detailsEl.textContent = details;
    if (fillEl) fillEl.style.width = percent + '%';
}

function removeProgressIndicator() {
    const progressDiv = document.getElementById('yt-sub-manager-progress');
    if (progressDiv) {
        setTimeout(() => progressDiv.remove(), 3000);
    }
}

// Unsubscribe from a single channel
async function unsubscribeFromChannel(channelUrl, channelName) {
    try {
        console.log(`Starting unsubscribe for: ${channelName}`);
        console.log(`Current URL: ${window.location.href}`);
        console.log(`Target URL: ${channelUrl}`);
        
        // Navigate to channel page if not already there
        if (window.location.href !== channelUrl) {
            console.log('Navigating to channel page...');
            updateProgress(`Navigating to ${channelName}...`);
            window.location.href = channelUrl;
            
            // Wait for navigation to complete
            await new Promise(resolve => {
                let timeoutCount = 0;
                const maxTimeout = 30; // 30 seconds max
                const checkInterval = setInterval(() => {
                    timeoutCount++;
                    console.log(`Navigation check ${timeoutCount}: Current URL = ${window.location.href}`);
                    
                    if (window.location.href === channelUrl) {
                        clearInterval(checkInterval);
                        console.log('Navigation complete');
                        resolve();
                    } else if (timeoutCount >= maxTimeout) {
                        clearInterval(checkInterval);
                        console.log('Navigation timeout reached');
                        resolve(); // Continue anyway
                    }
                }, 1000);
            });
            
            // Additional wait for page to load
            console.log('Waiting for page to fully load...');
            updateProgress(`Loading ${channelName} page...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
        
        console.log('Looking for subscribe button...');
        
        // Find subscribe button
        const subscribeSelectors = [
            'button[aria-label*="Subscribed"]',
            'button[aria-label*="Unsubscribe"]',
            'ytd-subscribe-button-renderer button[aria-label*="Subscribed"]',
            '#subscribe-button button[aria-label*="Subscribed"]'
        ];
        
        let subscribeButton = null;
        
        // Try multiple times to find the button
        for (let attempt = 0; attempt < 5; attempt++) {
            console.log(`Attempt ${attempt + 1} to find subscribe button`);
            
            for (const selector of subscribeSelectors) {
                subscribeButton = document.querySelector(selector);
                if (subscribeButton) {
                    console.log(`Found subscribe button: ${subscribeButton.getAttribute('aria-label')}`);
                    break;
                }
            }
            
            if (subscribeButton) break;
            
            console.log(`No button found in attempt ${attempt + 1}, waiting...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        if (!subscribeButton) {
            console.error('Subscribe button not found after 5 attempts');
            throw new Error('Subscribe button not found');
        }
        
        console.log('Clicking subscribe button...');

        subscribeButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Look for 'Unsubscribe' button
        console.log('Looking for unsubscribe button...');
        const unsubscribeSelectors = [
            'button[aria-label*="Unsubscribe"]',
            'yt-button-renderer[aria-label*="Unsubscribe"] button'
        ];
        
        let unsubscribeButton = null;
        for (let attempt = 0; attempt < 3; attempt++) {
            console.log(`Attempt ${attempt + 1} to find unsubscribe button`);
            for (const selector of unsubscribeSelectors) {
                unsubscribeButton = document.querySelector(selector);
                if (unsubscribeButton) {
                    console.log('Unsubscribe button found:', unsubscribeButton.getAttribute('aria-label'));
                    break;
                }
            }
            if (unsubscribeButton) break;
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        if (!unsubscribeButton) {
            console.error('Unsubscribe button not found after clicking subscribe');
            throw new Error('Unsubscribe button not found');
        }
        
        console.log('Clicking unsubscribe button...');
        unsubscribeButton.click();
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Look for toast confirmation
        console.log('Looking for toast confirmation...');
        const toastSelectors = [
            'tp-yt-paper-toast button[aria-label*="Unsubscribe"]',
            'ytd-notification-action-button-renderer button[aria-label*="Unsubscribe"]'
        ];

        let toastButton = null;
        for (let attempt = 0; attempt < 3; attempt++) {
            console.log(`Attempt ${attempt + 1} to find toast confirm button`);
            for (const selector of toastSelectors) {
                toastButton = document.querySelector(selector);
                if (toastButton) {
                    console.log('Toast confirm button found:', toastButton.getAttribute('aria-label'));
                    break;
                }
            }
            if (toastButton) break;
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        if (toastButton) {
            console.log('Clicking toast confirm button...');
            toastButton.click();
            await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
            console.log('No toast confirmation found');
        }
        
        console.log(`Successfully unsubscribed from ${channelName}`);
        return { success: true };
    } catch (error) {
        console.error(`Error unsubscribing from ${channelName}:`, error);
        return { success: false, error: error.message };
    }
}

// Start bulk unsubscribe process
async function startBulkUnsubscribe() {
    try {
        console.log('Starting bulk unsubscribe process...');
        
        const result = await new Promise(resolve => {
            chrome.storage.local.get(['unsubscribeList'], resolve);
        });
        
        console.log('Storage result:', result);
        
        if (!result.unsubscribeList || result.unsubscribeList.length === 0) {
            console.log('No unsubscribe list found');
            return { success: false, error: 'No unsubscribe list found' };
        }
        
        createProgressIndicator();
        const unsubscribeList = result.unsubscribeList;
        let successCount = 0;
        let errorCount = 0;
        
        console.log(`Found ${unsubscribeList.length} channels to unsubscribe from`);
        
        updateProgress('Starting bulk unsubscribe...', `0/${unsubscribeList.length} processed`);
        
        for (let i = 0; i < unsubscribeList.length; i++) {
            const channel = unsubscribeList[i];
            const percent = (i / unsubscribeList.length) * 100;
            
            console.log(`Processing channel ${i + 1}/${unsubscribeList.length}: ${channel.channel_name}`);
            
            updateProgress(
                `Unsubscribing from: ${channel.channel_name}`,
                `${i}/${unsubscribeList.length} processed (${successCount} success, ${errorCount} errors)`,
                percent
            );
            
            const result = await unsubscribeFromChannel(channel.channel_url, channel.channel_name);
            
            console.log(`Channel ${channel.channel_name} result:`, result);
            
            if (result.success) {
                successCount++;
            } else {
                errorCount++;
            }
            
            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        console.log(`Bulk unsubscribe complete! Success: ${successCount}, Errors: ${errorCount}`);
        
        updateProgress(
            'Bulk unsubscribe complete!',
            `${successCount} successful, ${errorCount} errors`,
            100
        );
        
        removeProgressIndicator();
        
        // Clear the unsubscribe list
        chrome.storage.local.remove(['unsubscribeList']);
        
        return { success: true, successCount, errorCount };
    } catch (error) {
        console.error('Bulk unsubscribe error:', error);
        updateProgress('Bulk unsubscribe failed', error.message, 100);
        removeProgressIndicator();
        return { success: false, error: error.message };
    }
}

// Export subscriptions functionality
async function exportSubscriptions() {
    try {
        createProgressIndicator();
        
        await navigateToSubscriptions();
        await scrollToLoadAll();
        
        const subscriptions = extractSubscriptionData();
        
        if (subscriptions.length > 0) {
            downloadCSV(subscriptions);
            updateProgress('Export complete!', `${subscriptions.length} subscriptions exported`, 100);
            removeProgressIndicator();
            return { success: true, count: subscriptions.length };
        } else {
            updateProgress('No subscriptions found', '', 100);
            removeProgressIndicator();
            return { success: false, error: 'No subscriptions found' };
        }
    } catch (error) {
        updateProgress('Export failed', error.message, 100);
        removeProgressIndicator();
        return { success: false, error: error.message };
    }
}

// Navigate to subscriptions page if not already there
async function navigateToSubscriptions() {
    if (!window.location.href.includes('/feed/channels')) {
        updateProgress('Navigating to subscriptions page...');
        window.location.href = 'https://www.youtube.com/feed/channels';
        return new Promise(resolve => {
            const checkInterval = setInterval(() => {
                if (window.location.href.includes('/feed/channels')) {
                    clearInterval(checkInterval);
                    setTimeout(resolve, 2000); // Wait for page to load
                }
            }, 500);
        });
    }
}

// Scroll to load all subscriptions
async function scrollToLoadAll() {
    updateProgress('Loading all subscriptions...');
    
    let lastHeight = document.documentElement.scrollHeight;
    let scrollAttempts = 0;
    const maxAttempts = 100;
    
    while (scrollAttempts < maxAttempts) {
        window.scrollTo(0, document.documentElement.scrollHeight);
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const newHeight = document.documentElement.scrollHeight;
        if (newHeight === lastHeight) {
            break;
        }
        lastHeight = newHeight;
        scrollAttempts++;
        
        updateProgress(`Loading subscriptions... (${scrollAttempts}/${maxAttempts})`, '', (scrollAttempts / maxAttempts) * 50);
    }
}

// Extract subscription data from the page
function extractSubscriptionData() {
    updateProgress('Extracting subscription data...');
    
    const subscriptions = [];
    const selectors = [
        'ytd-channel-renderer',
        'div#contents ytd-channel-renderer',
        'ytd-grid-channel-renderer'
    ];
    
    let elements = [];
    for (const selector of selectors) {
        elements = document.querySelectorAll(selector);
        if (elements.length > 0) break;
    }
    
    elements.forEach((element, index) => {
        try {
            // Channel name
            let channelName = '';
            const nameSelectors = [
                'a#main-link yt-formatted-string',
                'yt-formatted-string#text',
                'h3 a',
                'a[href*="/channel/"] yt-formatted-string',
                'a[href*="/@"] yt-formatted-string'
            ];
            
            for (const selector of nameSelectors) {
                const nameEl = element.querySelector(selector);
                if (nameEl && nameEl.textContent.trim()) {
                    channelName = nameEl.textContent.trim();
                    break;
                }
            }
            
            // Channel URL
            let channelUrl = '';
            const urlSelectors = [
                'a#main-link',
                'a[href*="/channel/"]',
                'a[href*="/@"]'
            ];
            
            for (const selector of urlSelectors) {
                const urlEl = element.querySelector(selector);
                if (urlEl && urlEl.href) {
                    channelUrl = urlEl.href;
                    break;
                }
            }
            
            // Subscriber count
            let subscriberCount = 'N/A';
            const subEl = element.querySelector('span#subscribers, span[class*="subscriber"]');
            if (subEl) {
                subscriberCount = subEl.textContent.trim();
            }
            
            // Extract description text
            let description = 'No description available';
            try {
                // Get all the text content and parse it
                const fullText = element.innerText;
                const lines = fullText.split('\n').filter(line => line.trim());
                
                // Skip the first line (channel name) and second line (handle + subscribers)
                // The description should be the remaining lines
                if (lines.length > 2) {
                    description = lines.slice(2).join(' ').trim();
                }
                
                // Remove 'Subscribed' text from the end
                if (description.endsWith('Subscribed')) {
                    description = description.slice(0, -10).trim(); // Remove 'Subscribed' (10 chars)
                }
                
                // If description is empty or just 'Subscribed', mark as no description
                if (!description || description === 'Subscribed' || description === '') {
                    description = 'No description available';
                }
                
                // If still no description, try alternative method
                if (description === 'No description available') {
                    const descSelectors = [
                        'yt-formatted-string#description-text',
                        'div[class*="description"]',
                        '#description-text',
                        '.description'
                    ];
                    
                    for (const selector of descSelectors) {
                        const descEl = element.querySelector(selector);
                        if (descEl && descEl.textContent.trim()) {
                            let altDescription = descEl.textContent.trim();
                            // Also remove 'Subscribed' from alternative method
                            if (altDescription.endsWith('Subscribed')) {
                                altDescription = altDescription.slice(0, -10).trim();
                            }
                            if (altDescription && altDescription !== 'Subscribed') {
                                description = altDescription;
                                break;
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('Error extracting description:', error);
            }
            
            if (channelName && channelUrl) {
                subscriptions.push({
                    channel_name: channelName,
                    channel_url: channelUrl,
                    subscriber_count: subscriberCount,
                    description: description,
                    unsubscribe: '',
                    date_collected: new Date().toISOString().split('T')[0]
                });
            }
            
            updateProgress(`Extracting data... (${index + 1}/${elements.length})`, '', 50 + (index / elements.length) * 50);
        } catch (error) {
            console.error('Error extracting subscription data:', error);
        }
    });
    
    return subscriptions;
}

// Convert data to CSV and download
function downloadCSV(data) {
    const headers = ['channel_name', 'channel_url', 'subscriber_count', 'description', 'unsubscribe', 'date_collected'];
    const csvContent = [
        headers.join(','),
        ...data.map(row => headers.map(header => `"${(row[header] || '').toString().replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `youtube_subscriptions_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
}
