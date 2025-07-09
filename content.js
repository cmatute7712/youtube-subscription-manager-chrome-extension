// Content script for YouTube Subscription Manager
class YouTubeSubscriptionManager {
    constructor() {
        this.subscriptions = [];
        this.unsubscribeList = [];
        this.currentIndex = 0;
        this.isProcessing = false;
    }

    // Create and show progress indicator
    createProgressIndicator() {
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

    updateProgress(status, details = '', percent = 0) {
        const statusEl = document.getElementById('progress-status');
        const detailsEl = document.getElementById('progress-details');
        const fillEl = document.getElementById('progress-fill');
        
        if (statusEl) statusEl.textContent = status;
        if (detailsEl) detailsEl.textContent = details;
        if (fillEl) fillEl.style.width = percent + '%';
    }

    removeProgressIndicator() {
        const progressDiv = document.getElementById('yt-sub-manager-progress');
        if (progressDiv) {
            setTimeout(() => progressDiv.remove(), 3000);
        }
    }

    // Navigate to subscriptions page if not already there
    async navigateToSubscriptions() {
        if (!window.location.href.includes('/feed/channels')) {
            this.updateProgress('Navigating to subscriptions page...');
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
    async scrollToLoadAll() {
        this.updateProgress('Loading all subscriptions...');
        
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
            
            this.updateProgress(`Loading subscriptions... (${scrollAttempts}/${maxAttempts})`, '', (scrollAttempts / maxAttempts) * 50);
        }
    }

// Extract subscription data from the page
    extractSubscriptionData() {
        this.updateProgress('Extracting subscription data...');
        
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
                
                this.updateProgress(`Extracting data... (${index + 1}/${elements.length})`, '', 50 + (index / elements.length) * 50);
            } catch (error) {
                console.error('Error extracting subscription data:', error);
            }
        });
        
        return subscriptions;
    }

    // Convert data to CSV and download
    downloadCSV(data) {
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

    // Export subscriptions
    async exportSubscriptions() {
        try {
            const progressDiv = this.createProgressIndicator();
            
            await this.navigateToSubscriptions();
            await this.scrollToLoadAll();
            
            const subscriptions = this.extractSubscriptionData();
            
            if (subscriptions.length > 0) {
                this.downloadCSV(subscriptions);
                this.updateProgress('Export complete!', `${subscriptions.length} subscriptions exported`, 100);
                this.removeProgressIndicator();
                return { success: true, count: subscriptions.length };
            } else {
                this.updateProgress('No subscriptions found', '', 100);
                this.removeProgressIndicator();
                return { success: false, error: 'No subscriptions found' };
            }
        } catch (error) {
            this.updateProgress('Export failed', error.message, 100);
            this.removeProgressIndicator();
            return { success: false, error: error.message };
        }
    }

    // Unsubscribe from a channel
    async unsubscribeFromChannel(channelUrl, channelName) {
        try {
            console.log(`Starting unsubscribe for: ${channelName}`);
            console.log(`Current URL: ${window.location.href}`);
            console.log(`Target URL: ${channelUrl}`);
            
            // Navigate to channel page if not already there
            if (window.location.href !== channelUrl) {
                console.log('Navigating to channel page...');
                window.location.href = channelUrl;
                
                // Wait for navigation to complete
                await new Promise(resolve => {
                    const checkInterval = setInterval(() => {
                        if (window.location.href === channelUrl) {
                            clearInterval(checkInterval);
                            console.log('Navigation complete');
                            resolve();
                        }
                    }, 100);
                });
                
                // Additional wait for page to load
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
            
            console.log('Looking for subscribe button...');
            
            // Find subscribe button with more comprehensive selectors
            const subscribeSelectors = [
                'button[aria-label*="Unsubscribe"]',
                'button[aria-label*="Subscribed"]',
                'button[title*="Unsubscribe"]',
                'button[title*="Subscribed"]',
                'ytd-subscribe-button-renderer button[aria-label*="Subscribed"]',
                'ytd-subscribe-button-renderer button[aria-label*="Unsubscribe"]',
                '#subscribe-button button[aria-label*="Subscribed"]',
                '#subscribe-button button[aria-label*="Unsubscribe"]',
                'yt-button-renderer[is-paper-button] button[aria-label*="Subscribed"]',
                'button[class*="subscribe"][aria-label*="Subscribed"]'
            ];
            
            let subscribeButton = null;
            let foundSelector = '';
            
            // Try multiple times to find the button
            for (let attempt = 0; attempt < 5; attempt++) {
                console.log(`Attempt ${attempt + 1} to find subscribe button`);
                
                for (const selector of subscribeSelectors) {
                    subscribeButton = document.querySelector(selector);
                    if (subscribeButton) {
                        foundSelector = selector;
                        console.log(`Found subscribe button with selector: ${selector}`);
                        console.log(`Button text: ${subscribeButton.textContent}`);
                        console.log(`Button aria-label: ${subscribeButton.getAttribute('aria-label')}`);
                        break;
                    }
                }
                
                if (subscribeButton) break;
                
                console.log(`No button found in attempt ${attempt + 1}, waiting...`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            if (!subscribeButton) {
                console.error('Subscribe button not found after 5 attempts');
                console.log('Available buttons on page:');
                const allButtons = document.querySelectorAll('button');
                allButtons.forEach((btn, index) => {
                    console.log(`Button ${index}: ${btn.textContent.trim()} | aria-label: ${btn.getAttribute('aria-label')}`);
                });
                throw new Error('Subscribe button not found');
            }
            
            console.log('Clicking subscribe button...');
            subscribeButton.click();
            console.log('Clicked subscribe button, waiting for unsubscribe option...');
            await new Promise(resolve =e setTimeout(resolve, 1000));
            
            // Look for 'Unsubscribe' button specifically
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
                        console.log('Unsubscribe button found:', unsubscribeButton);
                        break;
                    }
                }
                if (unsubscribeButton) break;
                await new Promise(resolve =e setTimeout(resolve, 1000));
            }

            if (!unsubscribeButton) {
                console.error('Unsubscribe button not found after clicking subscribe');
                throw new Error('Unsubscribe button not found');
            }
            
            console.log('Clicking unsubscribe button...');
            unsubscribeButton.click();
            await new Promise(resolve =e setTimeout(resolve, 1000));
            
            // Confirm on toast
            const toastSelectors = [
                'tp-yt-paper-toast button[aria-label*="Unsubscribe"]',
                'ytd-toast button[aria-label*="Unsubscribe"]'
            ];

            let toastButton = null;
            for (let attempt = 0; attempt < 3; attempt++) {
                console.log(`Attempt ${attempt + 1} to find toast confirm button`);
                for (const selector of toastSelectors) {
                    toastButton = document.querySelector(selector);
                    if (toastButton) {
                        console.log('Toast confirm button found:', toastButton);
                        break;
                    }
                }
                if (toastButton) break;
                await new Promise(resolve =e setTimeout(resolve, 1000));
            }

            if (toastButton) {
                console.log('Clicking toast confirm button...');
                toastButton.click();
                await new Promise(resolve =e setTimeout(resolve, 1000));
            } else {
                console.log('No toast confirmation needed or found');
            }
            
            // Look for confirmation dialog
            console.log('Looking for confirmation dialog...');
            const confirmSelectors = [
                'button[aria-label*="Unsubscribe"]',
                'yt-button-renderer[aria-label*="Unsubscribe"] button',
                'ytd-popup-container button[aria-label*="Unsubscribe"]',
                'tp-yt-paper-dialog button[aria-label*="Unsubscribe"]',
                'ytd-confirmation-dialog-renderer button[aria-label*="Unsubscribe"]',
                '#confirm-button',
                'button[class*="confirm"]'
            ];
            
            let confirmButton = null;
            let foundConfirmSelector = '';
            
            // Try multiple times to find the confirmation button
            for (let attempt = 0; attempt < 3; attempt++) {
                console.log(`Attempt ${attempt + 1} to find confirmation button`);
                
                for (const selector of confirmSelectors) {
                    confirmButton = document.querySelector(selector);
                    if (confirmButton) {
                        foundConfirmSelector = selector;
                        console.log(`Found confirmation button with selector: ${selector}`);
                        console.log(`Confirm button text: ${confirmButton.textContent}`);
                        break;
                    }
                }
                
                if (confirmButton) break;
                
                console.log(`No confirmation button found in attempt ${attempt + 1}, waiting...`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            if (confirmButton) {
                console.log('Clicking confirmation button...');
                confirmButton.click();
                await new Promise(resolve => setTimeout(resolve, 2000));
            } else {
                console.log('No confirmation dialog found, unsubscribe might be immediate');
            }
            
            console.log(`Successfully unsubscribed from ${channelName}`);
            return { success: true };
        } catch (error) {
            console.error(`Error unsubscribing from ${channelName}:`, error);
            return { success: false, error: error.message };
        }
    }

    // Start bulk unsubscribe process
    async startBulkUnsubscribe() {
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
            
            const progressDiv = this.createProgressIndicator();
            const unsubscribeList = result.unsubscribeList;
            let successCount = 0;
            let errorCount = 0;
            
            console.log(`Found ${unsubscribeList.length} channels to unsubscribe from`);
            
            this.updateProgress('Starting bulk unsubscribe...', `0/${unsubscribeList.length} processed`);
            
            for (let i = 0; i < unsubscribeList.length; i++) {
                const channel = unsubscribeList[i];
                const percent = (i / unsubscribeList.length) * 100;
                
                console.log(`Processing channel ${i + 1}/${unsubscribeList.length}: ${channel.channel_name}`);
                
                this.updateProgress(
                    `Unsubscribing from: ${channel.channel_name}`,
                    `${i}/${unsubscribeList.length} processed (${successCount} success, ${errorCount} errors)`,
                    percent
                );
                
                const result = await this.unsubscribeFromChannel(channel.channel_url, channel.channel_name);
                
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
            
            this.updateProgress(
                'Bulk unsubscribe complete!',
                `${successCount} successful, ${errorCount} errors`,
                100
            );
            
            this.removeProgressIndicator();
            
            // Clear the unsubscribe list
            chrome.storage.local.remove(['unsubscribeList']);
            
            return { success: true, successCount, errorCount };
        } catch (error) {
            console.error('Bulk unsubscribe error:', error);
            this.updateProgress('Bulk unsubscribe failed', error.message, 100);
            this.removeProgressIndicator();
            return { success: false, error: error.message };
        }
    }
}

// Initialize the manager
const manager = new YouTubeSubscriptionManager();

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Content script received message:', request.action);
    
    if (request.action === 'ping') {
        console.log('Ping received, responding...');
        sendResponse({success: true, message: 'Content script loaded'});
    } else if (request.action === 'exportSubscriptions') {
        console.log('Export request received');
        manager.exportSubscriptions().then(response => {
            console.log('Export response:', response);
            sendResponse(response);
        }).catch(error => {
            console.error('Export error:', error);
            sendResponse({success: false, error: error.message});
        });
        return true; // Indicates we will respond asynchronously
    } else if (request.action === 'startUnsubscribe') {
        console.log('Unsubscribe request received');
        
        // Send immediate response to prevent channel closure
        sendResponse({success: true, message: 'Unsubscribe process started'});
        
        // Start the unsubscribe process without waiting for response
        manager.startBulkUnsubscribe().then(response => {
            console.log('Unsubscribe completed:', response);
        }).catch(error => {
            console.error('Unsubscribe error:', error);
        });
        
        return false; // Don't keep the message channel open
    }
});

// Log when content script loads
console.log('YouTube Subscription Manager content script loaded');

// Send ready signal to popup if it's listening
setTimeout(() => {
    try {
        chrome.runtime.sendMessage({action: 'contentScriptReady'}, (response) => {
            // Ignore any errors - popup might not be listening
            if (chrome.runtime.lastError) {
                // Silently ignore - this is expected if popup is closed
            }
        });
    } catch (e) {
        // Silently ignore - this is expected if popup is closed
    }
}, 100);

// Add error handling for the manager
window.addEventListener('error', function(event) {
    console.error('Content script error:', event.error);
});
