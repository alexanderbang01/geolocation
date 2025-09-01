// Network interceptor der bruger PerformanceObserver og andre metoder
(function() {
    let capturedData = [];

    // Method 1: Intercept via native XMLHttpRequest hooking (most aggressive)
    (function hookXHR() {
        const originalXHR = window.XMLHttpRequest;
        
        function CustomXHR() {
            const xhr = new originalXHR();
            const originalOpen = xhr.open;
            const originalSend = xhr.send;
            
            let requestURL = '';
            let requestMethod = '';
            
            xhr.open = function(method, url, async, user, pass) {
                requestURL = url;
                requestMethod = method;
                console.log('XHR Open called:', method, url);
                return originalOpen.call(this, method, url, async, user, pass);
            };
            
            xhr.send = function(data) {
                if (requestURL && (requestURL.includes('GetMetadata') || requestURL.includes('GeoPhotoService'))) {
                    console.log('Sending XHR to GetMetadata:', requestURL);
                    
                    // Hook alle response events
                    const originalOnLoad = xhr.onload;
                    const originalOnReadyStateChange = xhr.onreadystatechange;
                    
                    xhr.addEventListener('load', function() {
                        if (xhr.status === 200 && xhr.responseText) {
                            console.log('XHR Load event - Response received:', xhr.responseText.length, 'chars');
                            console.log('Response preview:', xhr.responseText.substring(0, 200));
                            
                            capturedData.push({
                                url: requestURL,
                                method: requestMethod,
                                response: xhr.responseText,
                                timestamp: new Date().toLocaleString('da-DK'),
                                type: 'XHR-Load-Event',
                                status: xhr.status
                            });
                        }
                    });
                    
                    xhr.onreadystatechange = function() {
                        if (xhr.readyState === 4 && xhr.status === 200 && xhr.responseText) {
                            console.log('XHR ReadyState 4 - Response received:', xhr.responseText.length, 'chars');
                            
                            capturedData.push({
                                url: requestURL,
                                method: requestMethod,
                                response: xhr.responseText,
                                timestamp: new Date().toLocaleString('da-DK'),
                                type: 'XHR-ReadyState',
                                status: xhr.status
                            });
                        }
                        
                        if (originalOnReadyStateChange) {
                            originalOnReadyStateChange.apply(this, arguments);
                        }
                    };
                    
                    if (originalOnLoad) {
                        xhr.onload = originalOnLoad;
                    }
                }
                
                return originalSend.call(this, data);
            };
            
            return xhr;
        }
        
        // Replace the constructor
        CustomXHR.prototype = originalXHR.prototype;
        window.XMLHttpRequest = CustomXHR;
    })();

    // Method 2: Hook fetch aggressively
    (function hookFetch() {
        const originalFetch = window.fetch;
        
        window.fetch = function(...args) {
            const [resource, config] = args;
            const url = typeof resource === 'string' ? resource : resource.url;
            
            if (url && (url.includes('GetMetadata') || url.includes('GeoPhotoService'))) {
                console.log('Fetch intercepted:', url);
                
                return originalFetch.apply(this, args)
                    .then(response => {
                        console.log('Fetch response received:', response.status, response.ok);
                        
                        if (response.ok) {
                            // Clone response multiple times to avoid consumption issues
                            const clone1 = response.clone();
                            const clone2 = response.clone();
                            
                            clone1.text()
                                .then(text => {
                                    console.log('Fetch text received:', text.length, 'chars');
                                    console.log('Response preview:', text.substring(0, 200));
                                    
                                    capturedData.push({
                                        url: url,
                                        method: (config && config.method) || 'GET',
                                        response: text,
                                        timestamp: new Date().toLocaleString('da-DK'),
                                        type: 'Fetch-Clone',
                                        status: response.status
                                    });
                                })
                                .catch(err => console.error('Error reading cloned response:', err));
                        }
                        
                        return response;
                    })
                    .catch(error => {
                        console.error('Fetch error:', error);
                        throw error;
                    });
            }
            
            return originalFetch.apply(this, args);
        };
    })();

    // Method 3: Hook Response.prototype methods
    (function hookResponse() {
        const originalText = Response.prototype.text;
        const originalJson = Response.prototype.json;
        
        Response.prototype.text = function() {
            const response = this;
            
            return originalText.call(this).then(text => {
                if (response.url && (response.url.includes('GetMetadata') || response.url.includes('GeoPhotoService'))) {
                    console.log('Response.text() hooked for:', response.url);
                    console.log('Text length:', text.length);
                    
                    capturedData.push({
                        url: response.url,
                        method: 'Unknown',
                        response: text,
                        timestamp: new Date().toLocaleString('da-DK'),
                        type: 'Response-Text-Hook',
                        status: response.status
                    });
                }
                
                return text;
            });
        };
        
        Response.prototype.json = function() {
            const response = this;
            
            return originalJson.call(this).then(json => {
                if (response.url && (response.url.includes('GetMetadata') || response.url.includes('GeoPhotoService'))) {
                    console.log('Response.json() hooked for:', response.url);
                    console.log('JSON data:', json);
                    
                    capturedData.push({
                        url: response.url,
                        method: 'Unknown',
                        response: JSON.stringify(json),
                        timestamp: new Date().toLocaleString('da-DK'),
                        type: 'Response-JSON-Hook',
                        status: response.status
                    });
                }
                
                return json;
            });
        };
    })();

    // Method 4: Performance Observer for network timing
    try {
        const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                if (entry.name && (entry.name.includes('GetMetadata') || entry.name.includes('GeoPhotoService'))) {
                    console.log('Performance entry detected:', entry.name, entry);
                    
                    // Try to fetch the response using fetch (might work for GET requests)
                    if (entry.name.startsWith('http') && !entry.name.includes('$rpc')) {
                        fetch(entry.name)
                            .then(response => response.text())
                            .then(text => {
                                console.log('Performance Observer fetch successful:', text.length, 'chars');
                                
                                capturedData.push({
                                    url: entry.name,
                                    method: 'GET',
                                    response: text,
                                    timestamp: new Date().toLocaleString('da-DK'),
                                    type: 'Performance-Observer-Fetch',
                                    status: 200
                                });
                            })
                            .catch(err => {
                                console.log('Performance Observer fetch failed:', err);
                            });
                    }
                }
            }
        });
        
        observer.observe({ entryTypes: ['resource'] });
        console.log('Performance Observer active');
    } catch (e) {
        console.log('Performance Observer not available:', e);
    }

    // Message listener
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'getMetadataRequests') {
            console.log('Sending captured data:', capturedData.length, 'items');
            sendResponse({
                requests: capturedData,
                url: window.location.href,
                timestamp: new Date().toLocaleString('da-DK')
            });
        } else if (request.action === 'clearMetadataRequests') {
            capturedData = [];
            sendResponse({ success: true });
        }
    });

    // Periodic logging to see if we're getting any data
    setInterval(() => {
        if (capturedData.length > 0) {
            console.log('Captured data count:', capturedData.length);
        }
    }, 5000);

    console.log('Network interceptor loaded with', 4, 'methods');
})();