# YouTube Subscription Manager Chrome Extension

A Chrome extension that allows you to export your YouTube subscriptions to CSV and perform bulk unsubscribes. This extension bypasses Google's automation detection by running directly in the browser context.

## Features

- ✅ **Export Subscriptions**: Export all your YouTube subscriptions to CSV format
- ✅ **Bulk Unsubscribe**: Import a CSV file and unsubscribe from marked channels
- ✅ **Progress Tracking**: Real-time progress indicator for all operations
- ✅ **No Login Issues**: Works with your existing YouTube session
- ✅ **Rate Limiting**: Built-in delays to avoid triggering YouTube's limits

## Installation

### Load as Unpacked Extension

1. **Open Chrome Extensions Page**:
   - Go to `chrome://extensions/`
   - Or click the three dots menu → More tools → Extensions

2. **Enable Developer Mode**:
   - Toggle the "Developer mode" switch in the top right corner

3. **Load the Extension**:
   - Click "Load unpacked"
   - Select this folder (Youtube Subcription Manager Chrome Extension)

4. **Verify Installation**:
   - You should see "YouTube Subscription Manager" in your extensions list
   - The extension icon should appear in your Chrome toolbar


## Usage

### Step 1: Export Your Subscriptions

1. **Navigate to YouTube** (any YouTube page)
2. **Click the extension icon** in your Chrome toolbar
3. **Click "Export Subscriptions to CSV"**
4. The extension will:
   - Automatically navigate to your subscriptions page
   - Scroll to load all subscriptions
   - Extract channel data
   - Download a CSV file

### Step 2: Review and Mark Channels

1. **Open the downloaded CSV file** in Excel or any spreadsheet application
2. **Review the channels** and their descriptions
3. **Mark channels for unsubscription** by adding one of these values to the `unsubscribe` column:
   - `yes`
   - `y`
   - `1`
   - `true`
4. **Save the CSV file**

### Step 3: Bulk Unsubscribe

1. **Go back to YouTube** (any YouTube page)
2. **Click the extension icon** again
3. **Click "Import CSV File"** and select your modified CSV
4. **Click "Start Bulk Unsubscribe"**
5. The extension will:
   - Process each marked channel
   - Navigate to each channel page
   - Click the unsubscribe button
   - Show real-time progress

## CSV Format

The exported CSV contains the following columns:

| Column | Description |
|--------|-------------|
| `channel_name` | Name of the YouTube channel |
| `channel_url` | Direct URL to the channel |
| `subscriber_count` | Number of subscribers (if available) |
| `description` | Channel description (if available) |
| `unsubscribe` | **Your input**: Mark with 'yes', 'y', '1', or 'true' to unsubscribe |
| `date_collected` | Date when the data was collected |

## Example CSV

```csv
channel_name,channel_url,subscriber_count,description,unsubscribe,date_collected
TechCrunch,https://www.youtube.com/c/TechCrunch,2.1M subscribers,Technology news and reviews,,2025-01-09
Old Gaming Channel,https://www.youtube.com/c/oldgaming,50K subscribers,Gaming content I no longer watch,yes,2025-01-09
MIT OpenCourseWare,https://www.youtube.com/c/mitocw,3.8M subscribers,Free MIT courses,,2025-01-09
```

## Important Notes

### Rate Limiting
- The extension includes built-in delays (2 seconds between each unsubscribe)
- This prevents triggering YouTube's rate limiting
- Large unsubscribe lists may take considerable time

### Browser Requirements
- Chrome browser (version 88 or higher)
- Must be logged into YouTube
- JavaScript must be enabled

### Privacy & Security
- The extension only works on YouTube pages
- No data is sent to external servers
- All processing happens locally in your browser
- Your login session is used (no credentials stored)

## Troubleshooting

### Common Issues

1. **Extension doesn't appear**:
   - Make sure Developer Mode is enabled
   - Check that you selected the correct folder
   - Refresh the extensions page

2. **Export fails**:
   - Make sure you're logged into YouTube
   - Try refreshing the YouTube page
   - Check if you have any ad blockers interfering

3. **Unsubscribe process stops**:
   - This is normal for large lists due to rate limiting
   - The extension will continue processing
   - You can monitor progress in the on-screen indicator

4. **CSV parsing errors**:
   - Make sure the CSV file hasn't been corrupted
   - Ensure you're using the correct format
   - Try re-exporting if needed

### Getting Help

If you encounter issues:

1. Check the browser console for errors (F12 → Console)
2. Verify you're on a YouTube page when using the extension
3. Try disabling other extensions temporarily
4. Refresh the YouTube page and try again

## File Structure

```
Youtube Subcription Manager Chrome Extension/
├── manifest.json          # Extension configuration
├── popup.html             # Extension popup interface
├── popup.js              # Popup functionality
├── content.js            # Main YouTube page interaction
├── background.js         # Background service worker
├── styles.css           # Styling for progress indicator
├── icon.svg             # Extension icon
└── README.md            # This file
```

## Technical Details

### Permissions Used
- `activeTab`: To interact with the current YouTube tab
- `storage`: To temporarily store the unsubscribe list
- `downloads`: To download the CSV file
- `https://www.youtube.com/*`: To run on YouTube pages

### How It Works
1. **Content Script**: Runs on YouTube pages and handles DOM manipulation
2. **Popup**: Provides the user interface for triggering actions
3. **Background**: Handles extension lifecycle and downloads
4. **Storage**: Temporarily stores the list of channels to unsubscribe

## Limitations

- Only works on YouTube (by design)
- Requires manual review of CSV file
- Processing time depends on number of subscriptions
- Subject to YouTube's rate limiting
- YouTube layout changes may require updates

## Packaging Scripts

The `../utilities/` folder contains packaging scripts for different platforms:

### Development Packaging
- **package.bat** / **package.ps1** / **package.sh**: Creates a standard distribution package
- Includes all files including README.md
- Creates `youtube-subscription-manager.zip`

### Production Packaging (Chrome Web Store)
- **package-prod.bat** / **package-prod.ps1** / **package-prod.sh**: Creates a production-ready package
- Excludes development files
- Creates optimized README
- Creates `youtube-subscription-manager-webstore.zip`
- Includes Chrome Web Store submission guidelines

### Usage
```bash
# Windows
cd ../utilities
package.bat          # or package.ps1
package-prod.bat     # or package-prod.ps1

# Linux/macOS
cd ../utilities
./package.sh
./package-prod.sh
```

## License

This extension is for educational and personal use only. Please respect YouTube's Terms of Service and use responsibly.

## Updates

If YouTube changes its layout and the extension stops working:
1. The selectors in `content.js` may need updating
2. Check the browser console for specific error messages
3. The extension may need to be updated to handle new YouTube layouts
