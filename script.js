let db;

// Check Theme Preference on Load
document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
    }
});

// Theme Toggle
function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    if (document.body.classList.contains('dark-mode')) {
        localStorage.setItem('theme', 'dark');
    } else {
        localStorage.setItem('theme', 'light');
    }
}

// Open IndexedDB
const request = indexedDB.open("URLShortenerDB", 1);

request.onupgradeneeded = function(event) {
    db = event.target.result;

    // Create object store if it doesn't exist
    if (!db.objectStoreNames.contains("urls")) {
        const store = db.createObjectStore("urls", {
            keyPath: "shortCode"
        });

        store.createIndex("longUrl", "longUrl", {
            unique: false
        });
    }
};

request.onsuccess = function(event) {
    db = event.target.result;
    displayURLs();
};

request.onerror = function() {
    console.error("Database Error");
};

// Generate Random Code
function generateCode() {
    return Math.random().toString(36).substring(2, 8);
}

// Shorten URL
function shortenURL() {
    const longUrl = document.getElementById("longUrl").value.trim();
    const expirationInput = document.getElementById("expirationDate").value;

    if (!longUrl) {
        alert("Please enter a valid URL.");
        return;
    }

    try {
        new URL(longUrl); // Basic validation
    } catch (_) {
        alert("Please enter a valid URL including http:// or https://");
        return;
    }

    const shortCode = generateCode();
    const createdAt = new Date().getTime();
    let expirationDate = null;

    if (expirationInput) {
        expirationDate = new Date(expirationInput).getTime();
        if (expirationDate <= createdAt) {
            alert("Expiration date must be in the future.");
            return;
        }
    }

    const transaction = db.transaction(["urls"], "readwrite");
    const store = transaction.objectStore("urls");

    const newUrlObj = {
        shortCode,
        longUrl,
        createdAt,
        expirationDate,
        visits: 0
    };

    const addRequest = store.add(newUrlObj);

    addRequest.onsuccess = function() {
        const shortUrlDisplay = `${window.location.origin}${window.location.pathname}?c=${shortCode}`;
        
        const resultDiv = document.getElementById("result");
        resultDiv.innerHTML = `
            <span>Short URL generated!</span>
            <a href="#" onclick="redirectURL('${shortCode}', event)" class="result-link">${shortCode}</a>
        `;
        resultDiv.classList.remove("hidden");

        document.getElementById("longUrl").value = "";
        document.getElementById("expirationDate").value = "";

        displayURLs();
    };

    addRequest.onerror = function() {
        alert("Error saving URL. Please try again.");
    }
}

// Redirect URL (Simulated click on short URL)
function redirectURL(code, event) {
    if(event) event.preventDefault();

    const transaction = db.transaction(["urls"], "readwrite");
    const store = transaction.objectStore("urls");
    const request = store.get(code);

    request.onsuccess = function() {
        if(request.result){
            const urlData = request.result;
            const now = new Date().getTime();

            // Check Expiration
            if (urlData.expirationDate && now > urlData.expirationDate) {
                alert("This URL has expired.");
                return;
            }

            // Increment Visit Counter
            urlData.visits = (urlData.visits || 0) + 1;
            const updateRequest = store.put(urlData);

            updateRequest.onsuccess = function() {
                // Refresh list to show updated visits
                displayURLs(); 
                // Redirect
                window.open(urlData.longUrl, "_blank");
            };
            
        } else {
            alert("URL not found!");
        }
    };
}

// Global variable to hold current data for searching
let allUrls = [];

// Display URLs
function displayURLs() {
    if (!db) return;

    const transaction = db.transaction(["urls"], "readonly");
    const store = transaction.objectStore("urls");
    const request = store.getAll();

    request.onsuccess = function() {
        // Sort by creation date descending
        allUrls = request.result.sort((a, b) => b.createdAt - a.createdAt);
        renderUrlList(allUrls);
    };
}

// Filter URLs based on search input
function filterURLs() {
    const searchTerm = document.getElementById("searchInput").value.toLowerCase();
    const filtered = allUrls.filter(item => 
        item.longUrl.toLowerCase().includes(searchTerm) || 
        item.shortCode.toLowerCase().includes(searchTerm)
    );
    renderUrlList(filtered);
}

// Render the list of URLs to the DOM
function renderUrlList(data) {
    const urlListDiv = document.getElementById("urlList");
    let html = "";

    if (data.length === 0) {
        urlListDiv.innerHTML = "<p style='text-align:center; color:var(--text-secondary); margin-top:20px;'>No URLs found.</p>";
        return;
    }

    const now = new Date().getTime();

    data.forEach(item => {
        const createdDate = new Date(item.createdAt).toLocaleDateString();
        let expirationHtml = "";
        let isExpired = false;

        if (item.expirationDate) {
            isExpired = now > item.expirationDate;
            const expDateStr = new Date(item.expirationDate).toLocaleString();
            expirationHtml = `<span class="stat-badge ${isExpired ? 'expired' : ''}">
                <span class="material-symbols-rounded" style="font-size:14px">schedule</span>
                ${isExpired ? 'Expired' : 'Exp: ' + expDateStr}
            </span>`;
        }

        html += `
        <div class="url-item" id="item-${item.shortCode}">
            <div class="url-item-header">
                <div class="url-info">
                    <div class="short-url">
                        <span class="material-symbols-rounded" style="font-size:20px">link</span>
                        <a href="#" onclick="redirectURL('${item.shortCode}', event)" ${isExpired ? 'style="text-decoration:line-through; color:var(--text-secondary);"' : ''}>${item.shortCode}</a>
                    </div>
                    <div class="long-url" title="${item.longUrl}">${item.longUrl}</div>
                    
                    <div class="url-stats">
                        <span class="stat-badge">
                            <span class="material-symbols-rounded" style="font-size:14px">calendar_today</span>
                            ${createdDate}
                        </span>
                        <span class="stat-badge">
                            <span class="material-symbols-rounded" style="font-size:14px">visibility</span>
                            ${item.visits || 0} Visits
                        </span>
                        ${expirationHtml}
                    </div>
                </div>
                <div class="qr-code" id="qr-${item.shortCode}"></div>
            </div>
            
            <div class="url-actions">
                <button class="action-btn copy" onclick="copyURL('${item.shortCode}')">
                    <span class="material-symbols-rounded" style="font-size:18px">content_copy</span>
                    Copy
                </button>
                <button class="action-btn delete" onclick="deleteURL('${item.shortCode}')">
                    <span class="material-symbols-rounded" style="font-size:18px">delete</span>
                    Delete
                </button>
            </div>
        </div>
        `;
    });

    urlListDiv.innerHTML = html;

    // Generate QR codes after rendering HTML
    data.forEach(item => {
        // Construct the full simulated short URL
        const fullShortUrl = `${window.location.origin}${window.location.pathname}?c=${item.shortCode}`;
        
        new QRCode(document.getElementById(`qr-${item.shortCode}`), {
            text: fullShortUrl,
            width: 64,
            height: 64,
            colorDark : "#000000",
            colorLight : "#ffffff",
            correctLevel : QRCode.CorrectLevel.L
        });
    });
}

// Copy URL to clipboard
function copyURL(code) {
    const fullShortUrl = `${window.location.origin}${window.location.pathname}?c=${code}`;
    navigator.clipboard.writeText(fullShortUrl).then(() => {
        alert("Short URL copied to clipboard!");
    }).catch(err => {
        console.error('Could not copy text: ', err);
        // Fallback for older browsers
        prompt("Copy this link:", fullShortUrl);
    });
}

// Delete URL
function deleteURL(code) {
    if (!confirm("Are you sure you want to delete this URL?")) {
        return;
    }

    const transaction = db.transaction(["urls"], "readwrite");
    const store = transaction.objectStore("urls");
    const request = store.delete(code);

    request.onsuccess = function() {
        displayURLs();
    };

    request.onerror = function() {
        alert("Error deleting URL.");
    };
}

// Export URLs to CSV
function exportCSV() {
    if (!allUrls || allUrls.length === 0) {
        alert("No URLs to export.");
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    // Header
    csvContent += "Short Code,Long URL,Visits,Created At,Expiration Date\n";

    allUrls.forEach(item => {
        const createdDate = new Date(item.createdAt).toISOString();
        const expDate = item.expirationDate ? new Date(item.expirationDate).toISOString() : "None";
        // Escape quotes and commas in long URL
        const escapedLongUrl = `"${item.longUrl.replace(/"/g, '""')}"`;
        
        const row = `${item.shortCode},${escapedLongUrl},${item.visits || 0},${createdDate},${expDate}`;
        csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "shortened_urls.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Simulate handling a direct short link navigation
// E.g., index.html?c=x7a9bc
window.onload = function() {
    const urlParams = new URLSearchParams(window.location.search);
    const shortCode = urlParams.get('c');
    
    if (shortCode) {
        // Remove the query param from the URL visually
        window.history.replaceState({}, document.title, window.location.pathname);
        
        // Wait for DB to be ready, then redirect
        const checkDbInterval = setInterval(() => {
            if (db) {
                clearInterval(checkDbInterval);
                redirectURL(shortCode);
            }
        }, 100);
    }
};
