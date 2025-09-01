# Geolocation Finder

A Chrome extension that intercepts and extracts location metadata from Google Maps services, helping users identify geographic locations from Google Maps interactions.

## Features

- **Real-time Location Capture**: Monitors Google Maps network requests to extract location metadata
- **Location Information Display**: Shows place names, coordinates, country information with flags
- **Interactive Maps**: View captured locations on embedded Google Maps or static maps
- **Multiple Interception Methods**: Uses Chrome debugger API and content script hooking for comprehensive coverage
- **User-friendly Interface**: Clean, modern popup interface with tabbed navigation

## Installation

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the extension directory
5. The extension icon should appear in your Chrome toolbar

## Usage

1. **Start Capturing**: Click the extension icon and press "Start capture"
2. **Browse Google Maps**: Navigate to any location on Google Maps
3. **View Results**: The extension will automatically capture location data and display it in the popup
4. **View on Map**: Switch to the "Maps" tab to see the location visualized
5. **Open in Google Maps**: Use the "Open in Google Maps" button to view the full location

## How It Works

The extension uses two primary methods to intercept location data:

### Background Script (Primary Method)
- Uses Chrome's debugger API to monitor network traffic
- Intercepts `GeoPhotoService.GetMetadata` requests from Google Maps
- Parses JSON responses to extract place names and coordinates
- Handles both regular JSON and JSONP formatted responses

### Content Script (Fallback Method)
- Hooks into XMLHttpRequest and fetch APIs
- Intercepts network requests at the page level
- Provides multiple fallback mechanisms for data capture
- Uses Performance Observer for additional network monitoring

## Technical Details

### Files Structure
- `manifest.json` - Extension configuration and permissions
- `background.js` - Service worker for network interception
- `content.js` - Content script for additional network hooking
- `popup.html/css/js` - User interface components

### Key Functions
- **Location Parsing**: Intelligent parsing of Google Maps API responses
- **Coordinate Extraction**: Automatic extraction of latitude/longitude pairs
- **Country Resolution**: Uses OpenStreetMap Nominatim API for country lookup
- **Multi-language Support**: Prioritizes location names in preferred languages (EN, DA, ES)

### Data Captured
- Place names and location descriptions
- Latitude and longitude coordinates
- Language codes
- Country information with flag display
- Request timestamps and source URLs

## Permissions Required

- `debugger` - For network traffic monitoring
- `storage` - For saving captured location data
- `tabs` - For accessing active tab information
- `activeTab` - For content script injection
- Host permissions for Google Maps domains

## Privacy & Security

- All data is stored locally in Chrome's storage
- No data is transmitted to external servers (except for country lookup via Nominatim)
- Extension only monitors Google Maps related network requests
- Users have full control over data capture (start/stop/reset)

## Browser Compatibility

- Chrome 88+ (Manifest V3 required)
- Chromium-based browsers with extension support

## License

Created by Alexander Bang 2025

## Disclaimer

This extension is intended for educational and research purposes. Users should be aware of and comply with Google's Terms of Service when using this tool with Google Maps.