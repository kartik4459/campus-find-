// Main Application Logic (app.js)
// Handles page rendering, card displays, user session state, matching views, notifications, and claim approval flow

let uploadedImageBase64 = null;
let uploadedImageFeaturesPromise = null;

function extractImageFeatures(dataUrl) {
    return new Promise((resolve) => {
        let image = new Image();
        image.onload = function() {
            let canvas = document.createElement("canvas");
            let size = 32;
            canvas.width = size;
            canvas.height = size;
            let context = canvas.getContext("2d", { willReadFrequently: true });
            if (!context) {
                resolve(null);
                return;
            }

            context.drawImage(image, 0, 0, size, size);
            let pixels = context.getImageData(0, 0, size, size).data;
            let histogram = new Array(16).fill(0);
            let grayscale = new Array(size * size).fill(0);
            let totalBrightness = 0;

            for (let pixelIndex = 0; pixelIndex < size * size; pixelIndex++) {
                let offset = pixelIndex * 4;
                let red = pixels[offset];
                let green = pixels[offset + 1];
                let blue = pixels[offset + 2];
                let brightness = (red * 0.299 + green * 0.587 + blue * 0.114) / 255;
                let colorBin = (Math.floor(red / 128) * 8) + (Math.floor(green / 128) * 4) + (Math.floor(blue / 128) * 2) + (brightness >= 0.5 ? 1 : 0);
                histogram[colorBin]++;
                grayscale[pixelIndex] = brightness;
                totalBrightness += brightness;
            }

            let averageBrightness = totalBrightness / grayscale.length;
            let perceptualHash = "";
            let edgeStrength = 0;
            for (let row = 0; row < size; row++) {
                for (let column = 0; column < size; column++) {
                    let pixelIndex = row * size + column;
                    perceptualHash += grayscale[pixelIndex] >= averageBrightness ? "1" : "0";
                    if (column > 0) edgeStrength += Math.abs(grayscale[pixelIndex] - grayscale[pixelIndex - 1]);
                    if (row > 0) edgeStrength += Math.abs(grayscale[pixelIndex] - grayscale[pixelIndex - size]);
                }
            }

            resolve({
                histogram: histogram.map(value => value / grayscale.length),
                perceptualHash: perceptualHash,
                edgeStrength: edgeStrength / (size * size * 2),
                aspectRatio: image.width / image.height,
                averageBrightness: averageBrightness
            });
        };
        image.onerror = () => resolve(null);
        image.src = dataUrl;
    });
}

// Image preview helper function
function previewImage(event) {
    let input = event.target;
    let file = input && input.files && input.files[0];
    let wrapper = document.getElementById("image-preview-wrapper");
    let preview = document.getElementById("img-preview");

    if (file && file.type && file.type.startsWith("image/")) {
        let reader = new FileReader();
        reader.onload = function(e) {
            uploadedImageBase64 = e.target.result;
            uploadedImageFeaturesPromise = extractImageFeatures(e.target.result);
            if (preview) {
                preview.src = e.target.result;
            }
            if (wrapper) {
                wrapper.classList.remove("d-none");
            }
        };
        reader.readAsDataURL(file);
    } else {
        removeImage();
    }
}

// Remove selected image helper function
function removeImage() {
    uploadedImageBase64 = null;
    uploadedImageFeaturesPromise = null;
    let fileInput = document.getElementById("itemImage");
    if (fileInput) {
        fileInput.value = "";
    }
    let preview = document.getElementById("img-preview");
    if (preview) {
        preview.src = "";
    }
    let wrapper = document.getElementById("image-preview-wrapper");
    if (wrapper) {
        wrapper.classList.add("d-none");
    }
}

window.addEventListener('load', function() {
    // Render dynamic navbar user badge & account switcher
    renderNavbarUser();

    // Hide the "Admin" sidebar link from everyone except whitelisted admins
    applyAdminNavVisibility();

    // Determine active page

    let path = window.location.pathname;
    if (path.includes("report.html") || path.includes("report-found.html")) {
        initReportPage();
    } else if (path.includes("matches.html")) {
        initMatchesPage();
    } else if (path.includes("dashboard.html")) {
        initDashboardPage();
    } else if (path.includes("my-reports.html")) {
        initMyReportsPage();
    } else if (path.includes("all-reports.html")) {
        initAllReportsPage();
    } else if (path.includes("admin.html")) {
        initAdminPage();
    } else {
        initHomePage();
    }
});

function applyAdminNavVisibility() {
    let currentUser = getCurrentUser();
    let showAdmin = (typeof isAdminUser === "function") && isAdminUser(currentUser);
    document.querySelectorAll('a[href="admin.html"]').forEach(function(link) {
        link.classList.toggle("d-none", !showAdmin);
    });
}


// Render multi-user account switcher badge in navigation bar
function renderNavbarUser() {
    let currentUser = getCurrentUser();
    let rawUsers = (typeof getUsers === 'function') ? getUsers() : [];
    // Strict filter: Only real registered users (exclude legacy demo accounts)
    let allUsers = rawUsers.filter(u => u.useremail && u.useremail.toLowerCase() !== "ira.sodhi@example.com" && u.useremail.toLowerCase() !== "rohan.verma@example.com");

    let userDisplay = document.getElementById("nav-user-display");
    if (!userDisplay) return;

    let isLight = document.documentElement.classList.contains("light-theme");
    let themeIcon = isLight ? "bi-moon-stars" : "bi-sun";
    let themeTitle = isLight ? "Switch to Dark Mode" : "Switch to Light Mode";

    if (!currentUser) {
        userDisplay.innerHTML = `
            <div class="d-flex align-items-center gap-3">
                <button type="button" class="btn btn-theme-toggle" onclick="toggleTheme()" title="${themeTitle}">
                    <i class="${themeIcon}"></i>
                </button>
                <a class="btn btn-sm btn-outline-primary rounded-pill px-3 fw-semibold" href="login.html">
                    <i class="bi bi-box-arrow-in-right me-1"></i>Sign In
                </a>
            </div>
        `;
        return;
    }

    // Ensure active currentUser is present in allUsers
    if (!allUsers.some(u => u.useremail && u.useremail.toLowerCase() === currentUser.useremail.toLowerCase())) {
        allUsers.push(currentUser);
    }

    let userOptionsHtml = allUsers.map(u => {
        let isCurrent = u.useremail && currentUser.useremail && u.useremail.toLowerCase().trim() === currentUser.useremail.toLowerCase().trim();
        return `
            <li>
                <a class="dropdown-item d-flex align-items-center justify-content-between py-2 ${isCurrent ? 'bg-light fw-bold text-primary' : ''}" href="#" onclick="switchAccount('${u.useremail}')">
                    <div class="d-flex align-items-center">
                        <div class="rounded-circle bg-primary-subtle text-primary fw-bold me-2 d-flex align-items-center justify-content-center" style="width: 28px; height: 28px; font-size: 0.75rem;">
                            ${u.username ? u.username.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() : 'U'}
                        </div>
                        <div>
                            <div class="small leading-tight">${u.username}</div>
                            <div class="text-muted extra-small">${u.useremail}</div>
                        </div>
                    </div>
                    ${isCurrent ? '<span class="badge bg-primary rounded-pill ms-2" style="font-size: 0.65rem;">Active</span>' : ''}
                </a>
            </li>
        `;
    }).join('');

    let initials = currentUser.username ? currentUser.username.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() : 'U';
    let unreadNotifCount = (typeof getUnreadNotificationCount === 'function') ? getUnreadNotificationCount(currentUser.useremail) : 0;
    let unreadChatCount = (typeof getUnreadChatCount === 'function') ? getUnreadChatCount(currentUser.useremail) : 0;
    let count = unreadNotifCount + unreadChatCount;

    userDisplay.innerHTML = `
        <div class="d-flex align-items-center gap-3">
            <button type="button" class="btn btn-theme-toggle" onclick="toggleTheme()" title="${themeTitle}">
                <i class="${themeIcon}"></i>
            </button>

            <a href="dashboard.html#notifications-section" class="position-relative text-decoration-none text-muted nav-notification-bell" title="View Notifications & Chats in Dashboard">
                <i class="bi bi-bell"></i>
                ${count > 0 ? `
                    <span class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" style="font-size: 0.6rem; padding: 0.2rem 0.35rem;">
                        ${count}
                    </span>
                ` : ''}
            </a>

            <div class="dropdown">
                <button class="btn p-0 border-0 bg-transparent dropdown-toggle no-caret" type="button" data-bs-toggle="dropdown">
                    <div class="avatar-circle-nav shadow-sm">
                        ${initials}
                    </div>
                </button>
                <ul class="dropdown-menu dropdown-menu-end shadow border-0 p-2" style="min-width: 260px;">
                    <li class="px-3 py-2 bg-light rounded-3 mb-2 border">
                        <small class="text-muted d-block text-uppercase extra-small fw-bold">Active Account</small>
                        <strong class="text-dark small d-block">${currentUser.username}</strong>
                        <span class="text-muted extra-small d-block text-truncate">${currentUser.useremail}</span>
                        <div class="mt-1 d-flex flex-wrap gap-1">
                            ${currentUser.studentId ? `<span class="badge bg-dark-subtle text-light border border-secondary-subtle extra-small" style="font-size: 0.65rem;"><i class="bi bi-card-text me-1 text-primary"></i>${currentUser.studentId}</span>` : ''}
                            ${currentUser.department ? `<span class="badge bg-dark-subtle text-light border border-secondary-subtle extra-small" style="font-size: 0.65rem;"><i class="bi bi-mortarboard me-1 text-primary"></i>${currentUser.department}</span>` : ''}
                        </div>
                    </li>
                    <li class="px-2 pb-1"><small class="text-muted fw-bold extra-small text-uppercase tracking-wider">Switch Saved Account</small></li>
                    ${userOptionsHtml}
                    <li><hr class="dropdown-divider my-2"></li>
                    <li>
                        <a class="dropdown-item small rounded-2 py-1.5" href="login.html">
                            <i class="bi bi-person-plus text-success me-2"></i>Add Student Account
                        </a>
                    </li>
                    <li>
                        <a class="dropdown-item small text-danger fw-bold rounded-2 py-1.5" href="#" onclick="handleLogout()">
                            <i class="bi bi-box-arrow-right me-2"></i>Log Out
                        </a>
                    </li>
                </ul>
            </div>
        </div>
    `;
}

// Switch account helper
function switchAccount(email) {
    let u = switchUser(email);
    if (u) {
        // Clear any old item ID from URL so new user's own report loads
        if (window.location.pathname.includes("matches.html")) {
            window.location.href = "matches.html";
        } else {
            window.location.reload();
        }
    }
}

// Logout helper — clears session but keeps campusfind_users intact
function handleLogout() {
    if (typeof clearCurrentSession === 'function') {
        clearCurrentSession();
    } else {
        localStorage.removeItem("campusfind_current_user");
        localStorage.removeItem("current_user");
        localStorage.setItem("isLoggedIn", "false");
    }
    window.location.href = "login.html";
}

function scrollToMyReports(e) {
    let section = document.getElementById("recent-reports-section");
    if (!section) return;

    if (e) e.preventDefault();

    let sidebarEl = document.getElementById("sidebarMenu");
    if (sidebarEl) {
        let bsOffcanvas = (typeof bootstrap !== "undefined" && bootstrap.Offcanvas) ? bootstrap.Offcanvas.getInstance(sidebarEl) : null;
        if (bsOffcanvas) {
            bsOffcanvas.hide();
        } else {
            let closeBtn = sidebarEl.querySelector(".btn-close");
            if (closeBtn) closeBtn.click();
        }
    }

    setTimeout(function() {
        let navbar = document.querySelector(".navbar-custom");
        let navbarHeight = navbar ? navbar.getBoundingClientRect().height : 70;
        let targetTop = Math.max(0, section.getBoundingClientRect().top + window.scrollY - navbarHeight - 16);
        window.scrollTo({
            top: targetTop,
            behavior: "smooth"
        });
        if (history && history.pushState) {
            history.pushState(null, null, "#recent-reports-section");
        }
    }, 150);
}

function scrollToCampusInsights(e) {
    let section = document.getElementById("campus-insights-section");
    if (!section) return;

    if (e) e.preventDefault();

    let sidebarEl = document.getElementById("sidebarMenu");
    if (sidebarEl) {
        let bsOffcanvas = (typeof bootstrap !== "undefined" && bootstrap.Offcanvas) ? bootstrap.Offcanvas.getInstance(sidebarEl) : null;
        if (bsOffcanvas) {
            bsOffcanvas.hide();
        } else {
            let closeBtn = sidebarEl.querySelector(".btn-close");
            if (closeBtn) closeBtn.click();
        }
    }

    setTimeout(function() {
        let navbar = document.querySelector(".navbar-custom");
        let navbarHeight = navbar ? navbar.getBoundingClientRect().height : 70;
        let targetTop = Math.max(0, section.getBoundingClientRect().top + window.scrollY - navbarHeight - 16);
        window.scrollTo({
            top: targetTop,
            behavior: "smooth"
        });
        if (history && history.pushState) {
            history.pushState(null, null, "#campus-insights-section");
        }
    }, 150);
}

// -------------------------------------------------------------
// 1. HOME PAGE LOGIC
// -------------------------------------------------------------
function initHomePage() {
    let reports = getReports();
    let claims = getClaims();

    if (window.location.hash === "#recent-reports-section") {
        setTimeout(function() {
            let section = document.getElementById("recent-reports-section");
            if (section) {
                let navbar = document.querySelector(".navbar-custom");
                let navbarHeight = navbar ? navbar.getBoundingClientRect().height : 70;
                window.scrollTo({
                    top: Math.max(0, section.getBoundingClientRect().top + window.scrollY - navbarHeight - 16),
                    behavior: "smooth"
                });
            }
        }, 300);
    } else if (window.location.hash === "#campus-insights-section") {
        setTimeout(function() {
            let section = document.getElementById("campus-insights-section");
            if (section) {
                let navbar = document.querySelector(".navbar-custom");
                let navbarHeight = navbar ? navbar.getBoundingClientRect().height : 70;
                window.scrollTo({
                    top: Math.max(0, section.getBoundingClientRect().top + window.scrollY - navbarHeight - 16),
                    behavior: "smooth"
                });
            }
        }, 300);
    }

    // Active link highlighting for Campus Insights vs Home
    let insightsSection = document.getElementById("campus-insights-section");
    if (insightsSection) {
        let activeObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                let insightsLinks = document.querySelectorAll('a[href*="campus-insights-section"]');
                let homeLinks = document.querySelectorAll('.sidebar-nav a[href="index.html"]');
                if (entry.isIntersecting) {
                    insightsLinks.forEach(link => link.classList.add("active"));
                    homeLinks.forEach(link => link.classList.remove("active"));
                } else if (!window.location.hash.includes("campus-insights-section")) {
                    insightsLinks.forEach(link => link.classList.remove("active"));
                    homeLinks.forEach(link => {
                        if (window.location.pathname.endsWith("index.html") || window.location.pathname.endsWith("/")) {
                            link.classList.add("active");
                        }
                    });
                }
            });
        }, { threshold: 0.25 });
        activeObserver.observe(insightsSection);
    }

    // Calculate real data target counts
    let targetTotal = reports.length;
    let targetLost = reports.filter(r => r.type === "lost").length;
    let targetFound = reports.filter(r => r.type === "found").length;
    let targetRecovered = reports.filter(r => r.type === "lost" && r.status === "Recovered").length;

    // Setup IntersectionObserver for Live Statistics Section
    let statsSection = document.getElementById("stats-section");
    if (statsSection) {
        let observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    statsSection.classList.add("is-visible");
                    
                    // Trigger Staggered Vanilla JS Count-Up Animations for Real Data
                    setTimeout(() => animateCountUp("stat-total", targetTotal), 0);
                    setTimeout(() => animateCountUp("stat-lost", targetLost), 120);
                    setTimeout(() => animateCountUp("stat-found", targetFound), 240);
                    setTimeout(() => animateCountUp("stat-recovered", targetRecovered), 360);

                }
            });
        }, { threshold: 0.2 });

        observer.observe(statsSection);
    } else {
        // Fallback if section element not found directly
        let totalEl = document.getElementById("stat-total");
        let lostEl = document.getElementById("stat-lost");
        let foundEl = document.getElementById("stat-found");
        let recoveredEl = document.getElementById("stat-recovered");

        if (totalEl) totalEl.innerText = targetTotal;
        if (lostEl) lostEl.innerText = targetLost;
        if (foundEl) foundEl.innerText = targetFound;
        if (recoveredEl) recoveredEl.innerText = targetRecovered;
    }

    // Initialize How It Works Sequential Process Timeline Animation
    initHowItWorksAnimation();

    // Initialize Campus Insights Data Visualization Section
    initCampusInsights();

    // Setup IntersectionObserver for Last Section Entrance Animation
    let recentSection = document.getElementById("recent-reports-section");
    if (recentSection) {
        let recentObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    recentSection.classList.add("is-visible");
                    recentObserver.unobserve(recentSection);
                }
            });
        }, { threshold: 0.15 });
        recentObserver.observe(recentSection);
    }

    let currentUser = getCurrentUser();
    let myEmail = currentUser ? (currentUser.useremail || currentUser.email || "").toLowerCase().trim() : "";

    let myReports = myEmail
        ? reports.filter(item => {
            let itemEmail = (item.postedByEmail || item.userEmail || item.email || "").toLowerCase().trim();
            return itemEmail && itemEmail === myEmail;
        })
        : [];

    renderRecentCards(myReports);

    // Filter Listeners
    let searchIn = document.getElementById("home-search-input");
    let typeSelect = document.getElementById("home-type-filter");
    let catSelect = document.getElementById("home-category-filter");

    let filterCards = () => {
        let q = searchIn ? searchIn.value.toLowerCase().trim() : "";
        let t = typeSelect ? typeSelect.value : "all";
        let c = catSelect ? catSelect.value : "all";

        let filtered = myReports.filter(item => {
            let nameStr = (item.itemName || "").toLowerCase();
            let descStr = (item.description || "").toLowerCase();
            let matchQ = !q || nameStr.includes(q) || descStr.includes(q);
            let matchT = t === "all" || item.type === t;
            let matchC = c === "all" || item.category === c;
            return matchQ && matchT && matchC;
        });

        renderRecentCards(filtered);
    };

    if (searchIn) searchIn.oninput = filterCards;
    if (typeSelect) typeSelect.onchange = filterCards;
    if (catSelect) catSelect.onchange = filterCards;

    // Initialize Custom Themed Dropdowns (#151329 / #6B3FBF / #6D28D9)
    setupCustomSelect("home-type-filter");
    setupCustomSelect("home-category-filter");
}

function renderRecentCards(list) {
    let container = document.getElementById("recent-reports-grid");
    if (!container) return;

    if (list.length === 0) {
        container.innerHTML = `<div class="col-12 text-center py-4 text-muted">No items found matching filter.</div>`;
        return;
    }

    let currentUser = getCurrentUser();

    container.innerHTML = "";
    list.slice(0, 8).forEach(item => {
        let isMine = currentUser && item.postedByEmail && currentUser.useremail && item.postedByEmail.toLowerCase().trim() === currentUser.useremail.toLowerCase().trim();

        // Image or Placeholder logo
        let imageHtml = "";
        if (item.image && item.image.trim() !== "" && !item.image.includes("placeholder")) {
            imageHtml = `<img src="${item.image}" class="card-img-top w-100 h-100 object-fit-cover" alt="${escapeHtml(item.itemName)}">`;
        } else {
            let placeholderIcon = "bi-tag";
            if (item.category === "Electronics") placeholderIcon = "bi-laptop";
            else if (item.category === "Bags") placeholderIcon = "bi-backpack";
            else if (item.category === "Wallets") placeholderIcon = "bi-wallet2";
            
            imageHtml = `
                <div class="card-img-placeholder d-flex align-items-center justify-content-center w-100 h-100" style="background-color: rgba(255, 255, 255, 0.02);">
                    <div class="rounded-circle d-flex align-items-center justify-content-center" style="width: 52px; height: 52px; border: 1px solid var(--border-color); background-color: rgba(255, 255, 255, 0.03);">
                        <i class="bi ${placeholderIcon} text-muted fs-3"></i>
                    </div>
                </div>
            `;
        }

        container.innerHTML += `
            <div class="col-lg-3 col-md-4 col-sm-6 mb-4">
                <div class="card h-100 report-card-premium shadow-lg border-0 cursor-pointer" onclick="openItemDetailsModal('${item.id}')" style="cursor: pointer;">
                    <div class="card-img-wrapper position-relative overflow-hidden">
                        ${imageHtml}
                        <div class="card-img-overlay-gradient"></div>
                        <div class="position-absolute top-0 start-0 m-2.5" style="z-index: 5;">
                            <span class="badge ${item.type === 'lost' ? 'badge-type-lost' : 'badge-type-found'} rounded-pill px-2.5 py-1">
                                ${item.type.toUpperCase()}
                            </span>
                        </div>
                        <div class="position-absolute top-0 end-0 m-2.5" style="z-index: 5;">
                            <span class="badge badge-verified rounded-pill px-2.5 py-1">
                                <i class="bi bi-patch-check-fill me-1"></i>Verified
                            </span>
                        </div>
                    </div>
                    <div class="card-body p-3.5 d-flex flex-column justify-content-between">
                        <div>
                            <div class="card-category-tag mb-1">
                                ${item.category}
                            </div>
                            <h5 class="fw-bold card-item-title mb-1.5 text-truncate" title="${escapeHtml(item.itemName)}">
                                ${escapeHtml(item.itemName)}
                            </h5>
                            <p class="card-text card-description mb-3">
                                ${escapeHtml(item.description)}
                            </p>
                            <div class="d-flex align-items-center justify-content-between card-meta-row extra-small mb-3">
                                <span><i class="bi bi-geo-alt-fill text-cyan me-1"></i>${item.zone}</span>
                                <span><i class="bi bi-calendar-event-fill text-amber me-1"></i>${formatDate(item.date)}</span>
                            </div>
                        </div>
                        <button type="button" class="btn btn-view-full-info w-100 fw-bold">
                            View Full Info <i class="bi bi-arrow-right ms-1.5 btn-arrow-icon"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    });
}

function openItemDetailsModal(itemId) {
    let reports = getReports();
    let item = reports.find(r => r.id === itemId);
    if (!item) return;

    let titleEl = document.getElementById("item-modal-title");
    let bodyEl = document.getElementById("item-modal-body");

    if (titleEl) {
        titleEl.innerHTML = `
            <span class="badge ${item.type === 'lost' ? 'bg-danger' : 'bg-success'} me-2">${item.type.toUpperCase()} ITEM</span>
            ${escapeHtml(item.itemName)}
        `;
    }

    if (bodyEl) {
        let imageHtml = "";
        if (item.image && item.image.trim() !== "" && !item.image.includes("placeholder")) {
            imageHtml = `<img src="${item.image}" class="w-100 rounded-3 shadow-sm border border-secondary-subtle" style="max-height: 260px; object-fit: cover;">`;
        } else {
            imageHtml = `
                <div class="p-5 text-center info-box-cream rounded-3 border">
                    <i class="bi bi-bag-check fs-1 text-primary d-block mb-2"></i>
                    <span class="info-box-label small">No photo uploaded</span>
                </div>
            `;
        }

        bodyEl.innerHTML = `
            <div class="row g-4">
                <div class="col-md-5 text-center">
                    ${imageHtml}
                    <div class="mt-3 p-2.5 info-box-cream rounded-3 shadow-sm text-center extra-small">
                        <i class="bi bi-shield-check text-success me-1"></i>
                        <span class="info-box-label me-1">Report ID:</span>
                        <strong class="info-box-main">${item.id}</strong>
                    </div>
                </div>
                <div class="col-md-7">
                    <div class="d-flex flex-wrap gap-2 mb-3">
                        <span class="badge bg-primary-subtle text-primary border border-primary-subtle px-3 py-1.5 rounded-pill fw-bold">
                            <i class="bi bi-tag me-1"></i>Category: ${item.category}
                        </span>
                        <span class="badge bg-info-subtle text-info border border-info-subtle px-3 py-1.5 rounded-pill fw-bold">
                            <i class="bi bi-geo-alt me-1"></i>Zone: ${item.zone}
                        </span>
                        ${item.color ? `
                            <span class="badge bg-secondary-subtle text-light border border-secondary-subtle px-3 py-1.5 rounded-pill fw-bold">
                                <i class="bi bi-palette me-1"></i>Color: ${item.color}
                            </span>
                        ` : ''}
                    </div>

                    <h4 class="fw-bold text-heading mb-3">${escapeHtml(item.itemName)}</h4>

                    <div class="p-3 info-box-cream rounded-3 shadow-sm mb-3">
                        <small class="info-box-label text-uppercase fw-bold extra-small d-block mb-1" style="letter-spacing: 0.05em;">FULL DESCRIPTION</small>
                        <p class="info-box-main small mb-0 fw-medium" style="line-height: 1.6;">${escapeHtml(item.description)}</p>
                    </div>

                    <div class="p-3 info-box-cream rounded-3 shadow-sm mb-4">
                        <div class="d-flex justify-content-between small py-1.5 border-bottom" style="border-color: rgba(82, 101, 121, 0.15) !important;">
                            <span class="info-box-label"><i class="bi bi-person me-1 text-primary"></i>Reported By</span>
                            <strong class="info-box-main">${escapeHtml(item.postedBy)}</strong>
                        </div>
                        <div class="d-flex justify-content-between small py-1.5 border-bottom" style="border-color: rgba(82, 101, 121, 0.15) !important;">
                            <span class="info-box-label"><i class="bi bi-calendar-event me-1 text-warning"></i>Report Date</span>
                            <strong class="info-box-main">${formatDate(item.date)}</strong>
                        </div>
                        <div class="d-flex justify-content-between small py-1.5">
                            <span class="info-box-label"><i class="bi bi-patch-check me-1 text-success"></i>Current Status</span>
                            <span class="badge bg-warning text-dark rounded-pill px-2.5 py-0.5 fw-bold">${item.status || 'Searching'}</span>
                        </div>
                    </div>

                    <div class="d-flex gap-2 flex-wrap">
                        <a href="matches.html?id=${item.id}" class="btn btn-primary fw-bold flex-fill py-2">
                            <i class="bi bi-cpu me-1"></i>Run Match Engine
                        </a>
                        <button type="button" class="btn btn-outline-secondary fw-bold px-4" data-bs-dismiss="modal">
                            Close
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    let modalEl = document.getElementById("itemDetailsModal");
    if (modalEl) {
        let modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    }
}


// -------------------------------------------------------------
// 2. REPORT ITEM FORM LOGIC
// -------------------------------------------------------------
function initReportPage() {
    let form = document.getElementById("report-form");
    if (!form) return;

    let lostBtn = document.getElementById("btn-type-lost");
    let foundBtn = document.getElementById("btn-type-found");
    let typeInput = document.getElementById("report-type-input");
    let hiddenContainer = document.getElementById("hidden-details-container");
    let hiddenInput = document.getElementById("hiddenDetails");
    let categoryEl = document.getElementById("category");
    let colorEl = document.getElementById("color");
    let zoneEl = document.getElementById("zone");
    let customCategoryContainer = document.getElementById("custom-category-container");
    let customCategoryInput = document.getElementById("custom-category");
    let customColorContainer = document.getElementById("custom-color-container");
    let customColorInput = document.getElementById("custom-color");
    let customZoneContainer = document.getElementById("custom-zone-container");
    let customZoneInput = document.getElementById("custom-zone");

    function toggleCustomSelectField(selectEl, containerEl, inputEl) {
        if (!selectEl || !containerEl || !inputEl) return;
        const isCustom = selectEl.value === "Other";
        containerEl.classList.toggle("d-none", !isCustom);
        inputEl.required = isCustom;
        if (!isCustom) inputEl.value = "";
    }

    if (categoryEl) {
        categoryEl.addEventListener("change", () => toggleCustomSelectField(categoryEl, customCategoryContainer, customCategoryInput));
    }
    if (colorEl) {
        colorEl.addEventListener("change", () => toggleCustomSelectField(colorEl, customColorContainer, customColorInput));
    }
    if (zoneEl) {
        zoneEl.addEventListener("change", () => toggleCustomSelectField(zoneEl, customZoneContainer, customZoneInput));
    }

    function renderInstructions(type) {
        let card = document.getElementById("instruction-card");
        if (!card) return;

        if (type === "found") {
            card.className = "alert alert-success border-0 border-start border-4 border-success mb-4 p-4 shadow-sm rounded-3";
            card.innerHTML = `
                <h5 class="fw-bold mb-3 d-flex align-items-center text-success">
                    <i class="bi bi-info-circle-fill me-2"></i> Found Item Reporting Instructions
                </h5>
                <ul class="mb-0 ps-3 small" style="list-style-type: disc; display: flex; flex-direction: column; gap: 0.5rem; color: var(--text-body);">
                    <li><strong>Accurate Logging:</strong> Choose the category, color, and location zone that best describe where you found the item.</li>
                    <li><strong>Withhold Public Proof:</strong> Do not put unique identifying details (e.g., serial numbers, stickers, screen lock wallpapers) in the public description. Keep them private.</li>
                    <li><strong>Review Ownership Proof:</strong> The owner will submit proof of these hidden details via their dashboard. Check their responses carefully before approving.</li>
                    <li><strong>Safe Handover Spot:</strong> Once approved, schedule the handover meeting at a secure campus public location (e.g., Library Desk, Sports Reception).</li>
                    <li><strong>Verification Checklist:</strong> Always request the claimant to present their college student ID card during the physical handover.</li>
                </ul>
            `;
        } else {
            card.className = "alert alert-primary border-0 border-start border-4 border-primary mb-4 p-4 shadow-sm rounded-3";
            card.innerHTML = `
                <h5 class="fw-bold mb-3 d-flex align-items-center text-primary">
                    <i class="bi bi-info-circle-fill me-2"></i> Lost Item Reporting Instructions
                </h5>
                <ul class="mb-0 ps-3 small" style="list-style-type: disc; display: flex; flex-direction: column; gap: 0.5rem; color: var(--text-body);">
                    <li><strong>Select Category:</strong> Choose the appropriate category that best describes your lost item.</li>
                    <li><strong>Provide Details:</strong> Enter accurate characteristics like primary colors, dates, and zones as they appear on your identification or device.</li>
                    <li><strong>Hidden Identifying Details:</strong> Under "Hidden Details", write distinct secrets (e.g., "Dell sticker on top-right, scratch on back") to verify your ownership to the founder.</li>
                    <li><strong>Verification Process:</strong> Found matches will require you to submit proof of these hidden details for founder approval.</li>
                    <li><strong>Contact Support:</strong> If you encounter any issues or suspicious claims, contact our student support team for assistance.</li>
                </ul>
            `;
        }
    }

    function setReportType(type) {
        if (!typeInput) return;
        typeInput.value = type;
        if (type === "found") {
            if (foundBtn) foundBtn.classList.add("active-found");
            if (lostBtn) lostBtn.classList.remove("active-lost");
            if (hiddenContainer) hiddenContainer.classList.add("d-none");
            if (hiddenInput) hiddenInput.value = "";
        } else {
            if (lostBtn) lostBtn.classList.add("active-lost");
            if (foundBtn) foundBtn.classList.remove("active-found");
            if (hiddenContainer) hiddenContainer.classList.remove("d-none");
        }
        renderInstructions(type);
    }

    // Check URL parameters or active pathname to determine type
    let urlParams = new URLSearchParams(window.location.search);
    let presetType = urlParams.get("type");
    if (presetType === "found" || window.location.pathname.includes("report-found.html")) {
        setReportType("found");
    } else if (presetType === "lost" || window.location.pathname.includes("report.html")) {
        setReportType("lost");
    } else {
        let defaultType = typeInput ? typeInput.value : "lost";
        setReportType(defaultType);
    }

    if (lostBtn) {
        lostBtn.onclick = () => setReportType("lost");
    }
    if (foundBtn) {
        foundBtn.onclick = () => setReportType("found");
    }

    // ── STEP WIZARD CONTROLLER LOGIC ─────────────────────────────
    let currentStep = 1;

    function getFeedbackEl() {
        let feedbackEl = document.getElementById("report-feedback-msg");
        if (!feedbackEl) {
            feedbackEl = document.createElement("div");
            feedbackEl.id = "report-feedback-msg";
            feedbackEl.style.marginBottom = "1rem";
            form.parentNode.insertBefore(feedbackEl, form);
        }
        return feedbackEl;
    }

    function clearFeedback() {
        let el = document.getElementById("report-feedback-msg");
        if (el) {
            el.className = "d-none";
            el.innerHTML = "";
        }
    }

    function showStepError(msg, focusEl) {
        let feedbackEl = getFeedbackEl();
        feedbackEl.className = "alert alert-danger border-0 shadow-sm";
        feedbackEl.innerHTML = '<i class="bi bi-exclamation-triangle-fill me-2"></i>' + msg;
        feedbackEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (focusEl && typeof focusEl.focus === "function") {
            focusEl.focus();
        }
    }

    function validateStep(step) {
        clearFeedback();
        if (step === 1) {
            let name = document.getElementById("itemName") ? document.getElementById("itemName").value.trim() : "";
            let cat = document.getElementById("category") ? document.getElementById("category").value : "";
            let customCat = document.getElementById("custom-category") ? document.getElementById("custom-category").value.trim() : "";
            if (!name) {
                showStepError("Please enter the Item Name before proceeding.", document.getElementById("itemName"));
                return false;
            }
            if (!cat) {
                showStepError("Please select an Item Category before proceeding.", document.getElementById("category"));
                return false;
            }
            if (cat === "Other" && !customCat) {
                showStepError("Please enter your custom category.", document.getElementById("custom-category"));
                return false;
            }
        } else if (step === 2) {
            let color = document.getElementById("color") ? document.getElementById("color").value : "";
            let customColor = document.getElementById("custom-color") ? document.getElementById("custom-color").value.trim() : "";
            let desc = document.getElementById("description") ? document.getElementById("description").value.trim() : "";
            if (!color) {
                showStepError("Please select a Primary Color before proceeding.", document.getElementById("color"));
                return false;
            }
            if (color === "Other" && !customColor) {
                showStepError("Please enter your custom color.", document.getElementById("custom-color"));
                return false;
            }
            if (!desc) {
                showStepError("Please enter an Item Description before proceeding.", document.getElementById("description"));
                return false;
            }
        } else if (step === 3) {
            let zone = document.getElementById("zone") ? document.getElementById("zone").value : "";
            let customZone = document.getElementById("custom-zone") ? document.getElementById("custom-zone").value.trim() : "";
            let date = document.getElementById("date") ? document.getElementById("date").value : "";
            if (!zone) {
                showStepError("Please select a Campus Zone or Location before proceeding.", document.getElementById("zone"));
                return false;
            }
            if (zone === "Other" && !customZone) {
                showStepError("Please enter your custom campus location.", document.getElementById("custom-zone"));
                return false;
            }
            if (!date) {
                showStepError("Please select the Date before proceeding.", document.getElementById("date"));
                return false;
            }
        }
        return true;
    }

    function renderReviewSummary() {
        let reviewContainer = document.getElementById("review-summary-content");
        if (!reviewContainer) return;

        let name = document.getElementById("itemName") ? document.getElementById("itemName").value.trim() : "—";
        let cat = document.getElementById("category") ? document.getElementById("category").value : "—";
        let customCat = document.getElementById("custom-category") ? document.getElementById("custom-category").value.trim() : "";
        if (cat === "Other" && customCat) cat = customCat;

        let color = document.getElementById("color") ? document.getElementById("color").value : "—";
        let customColor = document.getElementById("custom-color") ? document.getElementById("custom-color").value.trim() : "";
        if (color === "Other" && customColor) color = customColor;

        let zone = document.getElementById("zone") ? document.getElementById("zone").value : "—";
        let customZone = document.getElementById("custom-zone") ? document.getElementById("custom-zone").value.trim() : "";
        if (zone === "Other" && customZone) zone = customZone;

        let date = document.getElementById("date") ? document.getElementById("date").value : "—";
        let desc = document.getElementById("description") ? document.getElementById("description").value.trim() : "—";
        let phone = document.getElementById("contactPhone") ? document.getElementById("contactPhone").value.trim() : "Not provided";
        let typeVal = typeInput ? typeInput.value.toUpperCase() : "LOST";

        let previewWrapper = document.getElementById("image-preview-wrapper");
        let previewImg = document.getElementById("img-preview");
        let hasImg = previewWrapper && !previewWrapper.classList.contains("d-none") && previewImg && previewImg.src && previewImg.src !== window.location.href;

        reviewContainer.innerHTML = `
            <div class="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom">
                <span class="badge ${typeVal === 'LOST' ? 'bg-danger' : 'bg-success'} px-3 py-1.5 rounded-pill fw-bold">${typeVal} ITEM REPORT</span>
                <span class="text-muted extra-small"><i class="bi bi-shield-check text-success me-1"></i>Ready to submit</span>
            </div>

            ${hasImg ? `
                <div class="text-center mb-3">
                    <img src="${previewImg.src}" class="img-fluid rounded border shadow-sm" style="max-height: 120px; object-fit: contain;">
                </div>
            ` : ''}

            <div class="review-item-row">
                <span class="review-label">Item Name:</span>
                <span class="review-value">${escapeHtml(name)}</span>
            </div>
            <div class="review-item-row">
                <span class="review-label">Category & Color:</span>
                <span class="review-value">${escapeHtml(cat)} (${escapeHtml(color)})</span>
            </div>
            <div class="review-item-row">
                <span class="review-label">Location Zone:</span>
                <span class="review-value">${escapeHtml(zone)}</span>
            </div>
            <div class="review-item-row">
                <span class="review-label">Date:</span>
                <span class="review-value">${escapeHtml(date)}</span>
            </div>
            <div class="review-item-row">
                <span class="review-label">Description:</span>
                <span class="review-value text-start ms-3" style="max-width: 60%;">${escapeHtml(desc)}</span>
            </div>
            <div class="review-item-row">
                <span class="review-label">Contact Phone:</span>
                <span class="review-value">${escapeHtml(phone)}</span>
            </div>
        `;
    }

    function updateStepUI() {
        clearFeedback();

        // Panes
        for (let i = 1; i <= 5; i++) {
            let pane = document.getElementById("step-pane-" + i);
            if (pane) {
                pane.classList.toggle("d-none", i !== currentStep);
            }
        }

        // Progress bar
        let progressBar = document.getElementById("stepper-progress-bar");
        if (progressBar) {
            let pct = ((currentStep - 1) / 4) * 80;
            progressBar.style.width = pct + "%";
        }

        // Stepper Items
        document.querySelectorAll(".stepper-item").forEach(item => {
            let stepNum = parseInt(item.getAttribute("data-step"));
            item.classList.toggle("active", stepNum === currentStep);
            item.classList.toggle("completed", stepNum < currentStep);
        });

        // Nav buttons
        let prevBtn = document.getElementById("prev-step-btn");
        let nextBtn = document.getElementById("next-step-btn");

        if (prevBtn) {
            prevBtn.classList.toggle("disabled", currentStep === 1);
        }

        if (nextBtn) {
            if (currentStep === 5) {
                nextBtn.classList.add("d-none");
            } else {
                nextBtn.classList.remove("d-none");
                nextBtn.innerHTML = (currentStep === 4 ? 'Review Report <i class="bi bi-file-earmark-check ms-1"></i>' : 'Next Step <i class="bi bi-arrow-right ms-1"></i>');
            }
        }

        if (currentStep === 5) {
            renderReviewSummary();
        }

        // Scroll to form top smoothly
        let formCard = document.querySelector(".form-card");
        if (formCard) {
            formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    window.nextStep = function(dir) {
        if (dir > 0) {
            if (!validateStep(currentStep)) return;
            if (currentStep < 5) currentStep++;
        } else {
            if (currentStep > 1) currentStep--;
        }
        updateStepUI();
    };

    window.jumpToStep = function(target) {
        target = parseInt(target);
        if (isNaN(target) || target < 1 || target > 5) return;

        if (target > currentStep) {
            for (let i = currentStep; i < target; i++) {
                if (!validateStep(i)) {
                    currentStep = i;
                    updateStepUI();
                    return;
                }
            }
        }
        currentStep = target;
        updateStepUI();
    };

    // Initialize Step UI
    updateStepUI();

    form.onsubmit = async function(e) {
        e.preventDefault();

        // ── Inline feedback ─────────────────────────────────────────
        let feedbackEl = document.getElementById("report-feedback-msg");
        if (!feedbackEl) {
            feedbackEl = document.createElement("div");
            feedbackEl.id = "report-feedback-msg";
            feedbackEl.style.marginBottom = "1rem";
            // Place it BEFORE the form element so it's always visible
            form.parentNode.insertBefore(feedbackEl, form);
        }
        feedbackEl.className = "d-none";
        feedbackEl.innerHTML = "";

        function showError(msg) {
            feedbackEl.className = "alert alert-danger border-0 shadow-sm";
            feedbackEl.innerHTML = '<i class="bi bi-exclamation-triangle-fill me-2"></i>' + msg;
        }

        function showSuccess(msg) {
            feedbackEl.className = "alert alert-success border-0 shadow-sm";
            feedbackEl.innerHTML = '<i class="bi bi-check-circle-fill me-2"></i>' + msg;
        }

        // ── Auth check: try every possible key ─────────────────────
        // Try the new key first, then fall back to the old JSON blob key
        let activeUser = null;

        // Method 1: new campusfind_current_user → campusfind_users
        try {
            let sessionEmail = localStorage.getItem("campusfind_current_user");
            if (sessionEmail) {
                let usersRaw = localStorage.getItem("campusfind_users");
                let usersArr = usersRaw ? JSON.parse(usersRaw) : [];
                activeUser = Array.isArray(usersArr)
                    ? usersArr.find(u => u.useremail && u.useremail.toLowerCase().trim() === sessionEmail.toLowerCase().trim()) || null
                    : null;
            }
        } catch(ex) { /* ignore */ }

        // Method 2: legacy "current_user" JSON blob
        if (!activeUser) {
            try {
                let raw = localStorage.getItem("current_user");
                if (raw && raw !== "null") {
                    let parsed = JSON.parse(raw);
                    if (parsed && parsed.useremail) activeUser = parsed;
                }
            } catch(ex) { /* ignore */ }
        }

        // Method 3: call getCurrentUser() as a final fallback
        if (!activeUser && typeof getCurrentUser === "function") {
            activeUser = getCurrentUser();
        }

        if (!activeUser) {
            showError('You are not signed in. Please <a href="login.html" class="fw-bold alert-link">sign in</a> to submit a report.');
            return;
        }

        // ── Collect field values ────────────────────────────────────
        let itemNameEl    = document.getElementById("itemName");
        let categoryEl    = document.getElementById("category");
        let colorEl       = document.getElementById("color");
        let zoneEl        = document.getElementById("zone");
        let dateEl        = document.getElementById("date");
        let descEl        = document.getElementById("description");
        let phoneEl       = document.getElementById("contactPhone");

        let itemName    = itemNameEl    ? itemNameEl.value.trim()    : "";
        let cat         = categoryEl    ? categoryEl.value           : "";
        let color       = colorEl       ? colorEl.value              : "";
        let zone        = zoneEl        ? zoneEl.value               : "";
        let date        = dateEl        ? dateEl.value               : "";
        let description = descEl        ? descEl.value.trim()        : "";
        let phone       = phoneEl       ? phoneEl.value.trim()       : "";
        let reportType  = typeInput     ? typeInput.value            : "lost";
        let hiddenVal   = (reportType === "lost" && hiddenInput) ? hiddenInput.value.trim() : "";
        let customCategory = customCategoryInput ? customCategoryInput.value.trim() : "";
        let customColor = customColorInput ? customColorInput.value.trim() : "";
        let customZone  = customZoneInput ? customZoneInput.value.trim() : "";

        if (categoryEl && categoryEl.value === "Other") {
            cat = customCategory;
        }
        if (colorEl && colorEl.value === "Other") {
            color = customColor;
        }
        if (zoneEl && zoneEl.value === "Other") {
            zone = customZone;
        }

        // ── Required field validation ───────────────────────────────
        if (!itemName)    { showError("Item Name is required.");          return; }
        if (!cat)         { showError("Please select a Category or enter a custom category."); return; }
        if (categoryEl && categoryEl.value === "Other" && !customCategory) {
            showError("Please enter the custom category.");
            return;
        }
        if (!color)       { showError("Please select a Primary Color or enter a custom color."); return; }
        if (colorEl && colorEl.value === "Other" && !customColor) {
            showError("Please enter the custom color.");
            return;
        }
        if (!zone)        { showError("Please select a Campus Zone or enter a custom location."); return; }
        if (zoneEl && zoneEl.value === "Other" && !customZone) {
            showError("Please enter the custom campus location.");
            return;
        }
        if (!date)        { showError("Please select the Date.");         return; }
        if (!description) { showError("Item Description is required.");   return; }

        // ── Image ───────────────────────────────────────────────────
        let itemImg = uploadedImageBase64 || getDefaultImage(cat);

        let itemImageFeatures = uploadedImageFeaturesPromise ? await uploadedImageFeaturesPromise : null;

        // ── Build report object ─────────────────────────────────────
        let newReport = {
            id:            "REP-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
            type:          reportType,
            itemName:      itemName,
            category:      cat,
            color:         color,
            zone:          zone,
            date:          date,
            description:   description,
            hiddenDetails: hiddenVal,
            postedBy:      activeUser.username  || "Student",
            postedByEmail: activeUser.useremail || "",
            contactPhone:  phone || activeUser.contactPhone || "",
            image:         itemImg,
            imageFeatures: itemImageFeatures,
            status:        "Searching"
        };

        // ── Persist to campus_reports ───────────────────────────────
        try {
            let existing = [];
            let raw = localStorage.getItem("campus_reports");
            if (raw) existing = JSON.parse(raw);
            if (!Array.isArray(existing)) existing = [];
            existing.unshift(newReport);
            localStorage.setItem("campus_reports", JSON.stringify(existing));
        } catch (storageErr) {
            showError("Storage error: could not save report. " + storageErr.message);
            return;
        }

        uploadedImageBase64 = null;
        uploadedImageFeaturesPromise = null;

        // ── Verify save ─────────────────────────────────────────────
        try {
            let check = JSON.parse(localStorage.getItem("campus_reports") || "[]");
            let found = Array.isArray(check) ? check.find(r => r.id === newReport.id) : null;
            if (!found) {
                showError("Report could not be verified after saving. Please try again.");
                return;
            }
        } catch(ex) { /* if parsing fails, trust the save went through */ }

        // ── Success → redirect ──────────────────────────────────────
        showSuccess('Report for "' + escapeHtml(newReport.itemName) + '" submitted by ' + escapeHtml(activeUser.username || "you") + '! Redirecting...');
        setTimeout(function() {
            window.location.href = "matches.html?id=" + newReport.id;
        }, 900);
    };
}

// -------------------------------------------------------------
// 3. MATCHES PAGE LOGIC
// -------------------------------------------------------------
function initMatchesPage() {
    let reports = getReports();
    let urlParams = new URLSearchParams(window.location.search);
    let urlTargetId = urlParams.get("id");
    let currentUser = getCurrentUser();

    // Separate the active user's reports from other reports for the selector.
    let myReports = [];
    let otherReports = [];

    reports.forEach(r => {
        let isMine = currentUser && r.postedByEmail && currentUser.useremail && r.postedByEmail.toLowerCase().trim() === currentUser.useremail.toLowerCase().trim();
        if (isMine) {
            myReports.push(r);
        } else {
            otherReports.push(r);
        }
    });

    let targetReport = null;

    if (urlTargetId) {
        let requestedReport = reports.find(r => r.id === urlTargetId);
        if (requestedReport) {
            let isMine = currentUser && requestedReport.postedByEmail && currentUser.useremail && requestedReport.postedByEmail.toLowerCase().trim() === currentUser.useremail.toLowerCase().trim();
            if (isMine) {
                // Logged-in user clicked their own report -> put it on top!
                targetReport = requestedReport;
            } else {
                targetReport = requestedReport;
            }
        }
    }

    // Default to logged-in user's first report if no valid target found
    if (!targetReport && myReports.length > 0) {
        targetReport = myReports[0];
    }

    // Populate the selector with the active user's reports and other reports.
    let selectEl = document.getElementById("target-report-select");
    if (selectEl) {
        selectEl.innerHTML = "";

        if (myReports.length > 0) {
            let myOptGroup = `<optgroup label="⭐ My Reports (${currentUser ? currentUser.username : 'You'})">`;
            myReports.forEach(r => {
                myOptGroup += `
                    <option value="${r.id}" ${targetReport && r.id === targetReport.id ? 'selected' : ''}>
                        [${r.type.toUpperCase()}] ${r.itemName} (My Report)
                    </option>
                `;
            });
            myOptGroup += `</optgroup>`;
            selectEl.innerHTML += myOptGroup;
        }

        if (otherReports.length > 0) {
            let otherOptGroup = `<optgroup label="🏫 Other Campus Reports">`;
            otherReports.forEach(r => {
                otherOptGroup += `
                    <option value="${r.id}" ${targetReport && r.id === targetReport.id ? 'selected' : ''}>
                        [${r.type.toUpperCase()}] ${r.itemName} (by ${r.postedBy})
                    </option>
                `;
            });
            otherOptGroup += `</optgroup>`;
            selectEl.innerHTML += otherOptGroup;
        }

        if (myReports.length === 0 && otherReports.length === 0) {
            selectEl.innerHTML = `<option value="">No reports submitted yet</option>`;
        }

        selectEl.onchange = (e) => {
            if (e.target.value) window.location.href = "matches.html?id=" + e.target.value;
        };
    }

    // If active user has no reports yet and hasn't selected another campus report:
    if (!targetReport && myReports.length === 0) {
        renderNoUserReportsState(currentUser);
        return;
    }

    if (targetReport) {
        renderTargetBanner(targetReport, currentUser);
        renderMatchCardsList(targetReport, reports);
    }
}

// Empty state when newly logged in user has not created reports yet
function renderNoUserReportsState(currentUser) {
    let banner = document.getElementById("target-item-banner");
    let container = document.getElementById("matches-grid");
    let countEl = document.getElementById("matches-count");

    if (countEl) countEl.innerText = "0";

    let userName = currentUser ? currentUser.username : "Student";
    let userEmail = currentUser ? currentUser.useremail : "";

    if (banner) {
        banner.innerHTML = `
            <div class="card p-4 border-0 shadow-sm mb-4 rounded-3 bg-white text-center">
                <div class="py-4 max-w-lg mx-auto">
                    <div class="badge bg-primary-subtle text-primary mb-2 px-3 py-1.5 rounded-pill fw-bold">
                        <i class="bi bi-person-circle me-1"></i>Active User: ${userName} (${userEmail})
                    </div>
                    <h3 class="fw-bold mb-2">No Reports Submitted by ${userName} Yet</h3>
                    <p class="text-muted small mb-4">
                        You are currently logged in as <strong>${userName}</strong>. Submit a Lost or Found item report to run our matching algorithm against other reported items.
                    </p>
                    <div class="d-flex justify-content-center gap-3 flex-wrap">
                        <a href="report.html" class="btn btn-lost">
                            <i class="bi bi-plus-circle me-1"></i>Post a Lost Item
                        </a>
                        <a href="report-found.html" class="btn btn-found">
                            <i class="bi bi-plus-circle me-1"></i>Post a Found Item
                        </a>
                    </div>
                </div>
            </div>
        `;
    }

    if (container) {
        container.innerHTML = `
            <div class="col-12 text-center py-5 text-muted bg-white rounded-3 border">
                <i class="bi bi-cpu fs-1 d-block mb-3 text-primary opacity-50"></i>
                <h5 class="fw-bold text-dark">Ready to Match Your Items</h5>
                <p class="small text-muted mb-0">Once you post an item report as <strong>${userName}</strong>, calculated probability matches from other students will appear here automatically.</p>
            </div>
        `;
    }
}

function renderTargetBanner(item, currentUser) {
    let banner = document.getElementById("target-item-banner");
    if (!banner) return;

    let isMyReport = currentUser && item.postedByEmail && currentUser.useremail && item.postedByEmail.toLowerCase().trim() === currentUser.useremail.toLowerCase().trim();

    banner.innerHTML = `
        <div class="card p-4 border-0 shadow-sm mb-4 rounded-3 bg-white">
            <div class="row align-items-center">
                <div class="col-md-2 text-center">
                    <img src="${item.image || getDefaultImage(item.category)}" class="img-fluid rounded-3" style="max-height: 100px; object-fit: cover;">
                </div>
                <div class="col-md-7">
                    <div class="d-flex align-items-center gap-2 mb-1 flex-wrap">
                        <span class="badge ${item.type === 'lost' ? 'badge-lost' : 'badge-found'}">${item.type.toUpperCase()}</span>
                        ${isMyReport ? `
                            <span class="badge bg-primary text-white"><i class="bi bi-person-check-fill me-1"></i>My Report (${currentUser ? currentUser.username : 'You'})</span>
                        ` : `
                            <span class="badge bg-light text-dark border"><i class="bi bi-person me-1"></i>Reported by: <strong>${item.postedBy}</strong></span>
                        `}
                    </div>
                    <h4 class="fw-bold mb-1">${item.itemName}</h4>
                    <p class="small text-muted mb-0">Zone: ${item.zone} | Color: ${item.color} | Date: ${item.date}</p>
                    ${!isMyReport ? `
                        <div class="extra-small text-muted fst-italic mt-1">
                            <i class="bi bi-info-circle me-1"></i>Viewing matches for campus report submitted by <strong>${item.postedBy}</strong>.
                        </div>
                    ` : ''}
                </div>
                <div class="col-md-3 text-end">
                    <a href="report.html" class="btn btn-sm btn-outline-primary"><i class="bi bi-plus-circle me-1"></i>Post New Item</a>
                </div>
            </div>
        </div>
    `;
}

function getConfidenceInfo(score) {
    if (score >= 90) return { label: "Very Strong Match", badgeClass: "badge-confidence-very-strong" };
    if (score >= 75) return { label: "Strong Match", badgeClass: "badge-confidence-strong" };
    if (score >= 50) return { label: "Possible Match", badgeClass: "badge-confidence-possible" };
    return { label: "Weak Match", badgeClass: "badge-confidence-weak" };
}

function renderMatchCardsList(targetReport, reports) {
    let container = document.getElementById("matches-grid");
    if (!container) return;

    let matches = findMatches(targetReport, reports);

    let countEl = document.getElementById("matches-count");
    if (countEl) countEl.innerText = matches.length;

    if (matches.length === 0) {
        container.innerHTML = `
            <div class="col-12 text-center py-5 text-muted bg-white rounded-3 border shadow-sm">
                <div class="py-3">
                    <i class="bi bi-search fs-1 d-block mb-3 text-primary opacity-75"></i>
                    <h5 class="fw-bold text-dark mb-2">No strong matches found yet</h5>
                    <p class="small text-muted mb-0 max-w-md mx-auto">We'll show potential matches here when a similar item of opposite type (Lost vs Found) is reported by another student.</p>
                </div>
            </div>
        `;
        return;
    }

    container.innerHTML = "";
    matches.forEach((m, idx) => {
        let item = m.candidate;
        let b = m.breakdown;
        let conf = getConfidenceInfo(m.score);
        let collapseId = `breakdown-collapse-${idx}`;

        let isCandidateFound = item.type === "found";
        let btnText = isCandidateFound ? `<i class="bi bi-shield-lock me-1"></i>Claim Item (Provide Hidden Details)` : `<i class="bi bi-bell-fill me-1"></i>Notify Owner (I Found This Item)`;
        let btnClass = isCandidateFound ? "btn-primary" : "btn-success";

        // Generate student-friendly "Why this is a match" list
        let whyMatchedHtml = "";
        if (m.reasons && m.reasons.length > 0) {
            whyMatchedHtml = m.reasons.map(r => `
                <div class="match-reason-item">
                    <i class="bi bi-check-circle-fill text-success me-2"></i><span>${escapeHtml(r)}</span>
                </div>
            `).join('');
        } else {
            whyMatchedHtml = `
                <div class="match-reason-item text-muted">
                    <i class="bi bi-info-circle me-2"></i><span>Matches based on general item attributes</span>
                </div>
            `;
        }

        // Check claim status for this match pair
        let currentUser = getCurrentUser();
        let allClaims = typeof getClaims === "function" ? getClaims() : [];
        let matchClaim = allClaims.find(c =>
            (c.itemId === item.id || c.itemId === targetReport.id) &&
            (
                (c.claimedByEmail && currentUser && c.claimedByEmail.toLowerCase().trim() === currentUser.useremail.toLowerCase().trim()) ||
                (c.reporterEmail && currentUser && c.reporterEmail.toLowerCase().trim() === currentUser.useremail.toLowerCase().trim())
            )
        );

        let isApproved = matchClaim && (
            matchClaim.status === "Approved & Meeting Scheduled" ||
            matchClaim.status === "Verified" ||
            matchClaim.status === "Recovery Arranged" ||
            matchClaim.status === "Recovered"
        );

        let chatBtnHtml = "";
        if (isApproved) {
            chatBtnHtml = `
                <button class="btn btn-success fw-bold flex-shrink-0 py-2" onclick="openOrCreateChat('${targetReport.id}', '${item.id}', ${m.score})" title="Chat Unlocked - Claim Approved">
                    <i class="bi bi-chat-dots-fill me-1"></i>💬 Open Chat
                </button>
            `;
        } else if (matchClaim && (matchClaim.status === "Pending Founder Approval" || matchClaim.status === "Pending Approval")) {
            chatBtnHtml = `
                <button class="btn btn-outline-warning text-dark fw-bold flex-shrink-0 py-2" onclick="alert('🔒 Chat Locked. Your hidden details have been submitted. Chat unlocks after the Founder accepts your claim.')" title="Chat locks until Founder approves">
                    <i class="bi bi-lock-fill me-1"></i>Awaiting Approval
                </button>
            `;
        } else if (matchClaim && matchClaim.status === "Rejected") {
            chatBtnHtml = `
                <button class="btn btn-outline-danger fw-bold flex-shrink-0 py-2" onclick="alert('✕ Claim Rejected. The Founder did not accept the ownership details.')">
                    <i class="bi bi-x-circle me-1"></i>Claim Rejected
                </button>
            `;
        } else {
            chatBtnHtml = `
                <button class="btn btn-outline-secondary fw-bold flex-shrink-0 py-2" onclick="openClaimModal('${targetReport.id}', '${item.id}')" title="Submit proof to unlock chat">
                    <i class="bi bi-lock-fill me-1"></i>Contact Finder (Locked)
                </button>
            `;
        }

        container.innerHTML += `
            <div class="col-12 mb-4">
                <div class="card match-result-card p-4 shadow-sm rounded-3">
                    <div class="row g-4">
                        <!-- Left Column: Item Image & Header Info -->
                        <div class="col-md-3 text-center text-md-start">
                            <img src="${item.image || getDefaultImage(item.category)}" alt="${escapeHtml(item.itemName)}" class="w-100 rounded-3 border" style="height: 170px; object-fit: contain; background: rgba(15,23,42,0.5);">
                        </div>

                        <!-- Center Column: Item Details & Why This Is a Match -->
                        <div class="col-md-5">
                            <div class="d-flex align-items-center gap-2 mb-2 flex-wrap">
                                <span class="badge ${item.type === 'lost' ? 'badge-lost' : 'badge-found'} px-2.5 py-1">${item.type.toUpperCase()}</span>
                                <span class="badge bg-light text-dark border px-2.5 py-1"><i class="bi bi-person-fill text-primary me-1"></i>Reported by: <strong>${escapeHtml(item.postedBy)}</strong></span>
                            </div>

                            <h4 class="fw-bold mb-1.5 text-dark">${escapeHtml(item.itemName)}</h4>

                            <div class="extra-small text-muted mb-3 d-flex flex-wrap gap-3">
                                <span><i class="bi bi-tag-fill text-primary me-1"></i>${escapeHtml(item.category)}</span>
                                ${item.color ? `<span><i class="bi bi-palette-fill text-info me-1"></i>${escapeHtml(item.color)}</span>` : ''}
                                <span><i class="bi bi-geo-alt-fill text-danger me-1"></i>${escapeHtml(item.zone)}</span>
                                <span><i class="bi bi-calendar-event me-1"></i>${item.date}</span>
                            </div>

                            <p class="small text-muted mb-3 line-clamp-2">${escapeHtml(item.description)}</p>
                            
                            <!-- "Why this is a match" Checklist Box -->
                            <div class="match-reasons-box">
                                <div class="d-flex justify-content-between align-items-center mb-2">
                                    <strong class="small fw-bold text-dark d-flex align-items-center gap-1.5">
                                        <i class="bi bi-stars text-warning fs-6"></i>Why this is a match
                                    </strong>
                                </div>
                                <div class="match-reasons-list">
                                    ${whyMatchedHtml}
                                </div>
                            </div>
                        </div>

                        <!-- Right Column: Score Display, Confidence Level & Action -->
                        <div class="col-md-4 border-start ps-md-4 d-flex flex-column justify-content-between">
                            <div>
                                <!-- Score & Confidence Header -->
                                <div class="match-score-box mb-3">
                                    <div class="d-flex align-items-center justify-content-center gap-2 mb-1">
                                        <div class="match-score-number">${m.score}%</div>
                                        <div class="text-start">
                                            <div class="small fw-bold text-muted text-uppercase" style="font-size:0.7rem; letter-spacing:0.04em;">Match Score</div>
                                            <span class="badge ${conf.badgeClass}">${conf.label}</span>
                                        </div>
                                    </div>
                                    <!-- Progress Bar Visualization -->
                                    <div class="progress mt-2" style="height: 8px; background-color: rgba(168, 85, 247, 0.15);">
                                        <div class="progress-bar ${m.score >= 75 ? 'bg-success' : (m.score >= 50 ? 'bg-primary' : 'bg-warning')}" role="progressbar" style="width: ${m.score}%" aria-valuenow="${m.score}" aria-valuemin="0" aria-valuemax="100"></div>
                                    </div>
                                </div>

                                <!-- Collapsible Attribute Point Breakdown -->
                                <div class="mb-3">
                                    <button class="btn btn-sm btn-link text-decoration-none p-0 w-100 d-flex justify-content-between align-items-center text-muted small fw-semibold" type="button" data-bs-toggle="collapse" data-bs-target="#${collapseId}" aria-expanded="false">
                                        <span><i class="bi bi-bar-chart-steps me-1"></i>View Attribute Point Breakdown</span>
                                        <i class="bi bi-chevron-down"></i>
                                    </button>
                                    <div class="collapse mt-2" id="${collapseId}">
                                        <div class="p-2.5 bg-light rounded border small">
                                            <div class="d-flex justify-content-between extra-small mb-1">
                                                <span>Category (${b.category.maxPts}%)</span>
                                                <span class="fw-bold text-primary">${b.category.pts} / ${b.category.maxPts} pts</span>
                                            </div>
                                            <div class="progress mb-2" style="height:4px"><div class="progress-bar bg-primary" style="width:${(b.category.pts / b.category.maxPts) * 100}%"></div></div>

                                            <div class="d-flex justify-content-between extra-small mb-1">
                                                <span>Location (${b.location.maxPts}%)</span>
                                                <span class="fw-bold text-primary">${b.location.pts} / ${b.location.maxPts} pts</span>
                                            </div>
                                            <div class="progress mb-2" style="height:4px"><div class="progress-bar bg-primary" style="width:${(b.location.pts / b.location.maxPts) * 100}%"></div></div>

                                            <div class="d-flex justify-content-between extra-small mb-1">
                                                <span>Color (${b.color.maxPts}%)</span>
                                                <span class="fw-bold text-primary">${b.color.pts} / ${b.color.maxPts} pts</span>
                                            </div>
                                            <div class="progress mb-2" style="height:4px"><div class="progress-bar bg-primary" style="width:${(b.color.pts / b.color.maxPts) * 100}%"></div></div>

                                            <div class="d-flex justify-content-between extra-small mb-1">
                                                <span>Date (${b.date.maxPts}%)</span>
                                                <span class="fw-bold text-primary">${b.date.pts} / ${b.date.maxPts} pts</span>
                                            </div>
                                            <div class="progress mb-2" style="height:4px"><div class="progress-bar bg-primary" style="width:${(b.date.pts / b.date.maxPts) * 100}%"></div></div>

                                            <div class="d-flex justify-content-between extra-small mb-1">
                                                <span>Description (${b.description.maxPts}%)</span>
                                                <span class="fw-bold text-primary">${b.description.pts} / ${b.description.maxPts} pts</span>
                                            </div>
                                            <div class="progress mb-2" style="height:4px"><div class="progress-bar bg-primary" style="width:${(b.description.pts / b.description.maxPts) * 100}%"></div></div>

                                            <div class="d-flex justify-content-between extra-small mb-1">
                                                <span>Image Similarity (${b.image.maxPts}%)</span>
                                                <span class="fw-bold text-info">${b.image.pts} / ${b.image.maxPts} pts</span>
                                            </div>
                                            <div class="progress" style="height:4px"><div class="progress-bar bg-info" style="width:${(b.image.pts / b.image.maxPts) * 100}%"></div></div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Action Buttons -->
                            <div class="d-flex gap-2 mt-3 flex-wrap">
                                <button class="btn ${btnClass} fw-bold flex-fill py-2" onclick="openClaimModal('${targetReport.id}', '${item.id}')">
                                    ${btnText}
                                </button>
                                ${chatBtnHtml}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
}

// -------------------------------------------------------------
// 4. INTERACTIVE CLAIM & CONTACT MODAL FLOW
// -------------------------------------------------------------
function openClaimModal(targetReportId, candidateItemId) {
    let reports = getReports();
    let targetReport = reports.find(r => r.id === targetReportId);
    let candidateItem = reports.find(r => r.id === candidateItemId);

    if (!candidateItem && targetReportId) {
        candidateItem = reports.find(r => r.id === targetReportId);
    }
    if (!candidateItem) return;

    let currentUser = getCurrentUser();
    let modalEl = document.getElementById("claimModal");
    let modalBody = document.getElementById("claim-modal-body");

    if (!modalEl || !modalBody) return;

    // Check action type based on the candidate item being interacted with:
    // If candidate item is a LOST item -> Finder is notifying the Lost Item Owner!
    // If candidate item is a FOUND item -> Owner is submitting a claim to the Finder!
    let isCandidateLost = candidateItem.type === "lost";

    if (isCandidateLost) {
        // CASE: Finder notifying Lost Item Owner ("I Found Your Item!")
        let lostReport = candidateItem;
        let ownerEmail = lostReport.postedByEmail;
        let ownerName = lostReport.postedBy;

        let isSelfMatch = currentUser && ownerEmail && currentUser.useremail && ownerEmail.toLowerCase().trim() === currentUser.useremail.toLowerCase().trim();

        if (isSelfMatch) {
            modalBody.innerHTML = `
                <div class="alert alert-warning border-0 shadow-sm mb-3">
                    <h6 class="fw-bold mb-2"><i class="bi bi-exclamation-triangle-fill me-1"></i> Self-Reported Lost Item</h6>
                    <p class="small mb-2">This lost item report (<strong>${lostReport.itemName}</strong>) belongs to your active account (<strong>${currentUser.username}</strong>).</p>
                    <p class="small mb-0">To test finding and notifying the owner, switch to another account using the top navbar.</p>
                </div>
                <button type="button" class="btn btn-secondary w-100 fw-bold" data-bs-dismiss="modal">Close</button>
            `;
        } else {
            modalBody.innerHTML = `
                <div class="mb-3">
                    <span class="badge badge-lost me-2">LOST ITEM</span>
                    <h5 class="fw-bold text-dark mb-1 fs-5">${lostReport.itemName}</h5>
                    <div class="p-2 bg-light rounded border mt-2 small text-dark">
                        <i class="bi bi-person-circle text-primary me-1"></i>Owner who lost item: <strong>${ownerName}</strong> (${ownerEmail})
                    </div>
                </div>

                <div class="p-3 bg-light rounded-3 border mb-3 small text-muted">
                    <strong>Lost Item Description:</strong> ${lostReport.description}
                    ${targetReport && targetReport.type === 'found' ? `<div class="mt-2 text-primary"><strong>Your Matching Found Report:</strong> ${targetReport.itemName} (${targetReport.zone})</div>` : ''}
                </div>

                <form id="notify-owner-form" onsubmit="handleNotifyOwnerSubmit(event, '${lostReport.id}', '${targetReport ? targetReport.id : ''}')">
                    <div class="mb-3">
                        <label class="form-label fw-semibold small">Your Name (Finder)</label>
                        <input type="text" id="finder-name-input" class="form-control form-control-sm" value="${currentUser ? currentUser.username : ''}" placeholder="Your full name" required>
                    </div>
                    <div class="mb-3">
                        <label class="form-label fw-semibold small">Your Contact Phone / WhatsApp (Optional)</label>
                        <input type="tel" id="finder-phone-input" class="form-control form-control-sm" value="${currentUser && currentUser.contactPhone ? currentUser.contactPhone : '+91 98123 45678'}" placeholder="+91 98123 45678">
                    </div>
                    <div class="mb-3">
                        <label class="form-label fw-semibold small">Notification Message for Owner (${ownerName})</label>
                        <textarea id="found-notice-message" rows="3" class="form-control form-control-sm" required>Hi ${ownerName}, I found an item matching your lost report "${lostReport.itemName}"! Please get in touch with me so we can arrange to return it.</textarea>
                    </div>
                    <button type="submit" class="btn btn-success w-100 fw-bold btn-sm py-2">
                        <i class="bi bi-bell-fill me-1"></i>Send Notification to Owner (${ownerName})
                    </button>
                </form>

                <div id="unlocked-contact-info" class="mt-3"></div>
            `;
        }
    } else {
        // CASE: Submitting claim to the person who FOUND the item (the Finder / Founder)
        let foundReport = candidateItem;
        let finderEmail = foundReport.postedByEmail;
        let finderName = foundReport.postedBy;

        let isSelfMatch = currentUser && finderEmail && currentUser.useremail && finderEmail.toLowerCase().trim() === currentUser.useremail.toLowerCase().trim();

        if (isSelfMatch) {
            modalBody.innerHTML = `
                <div class="alert alert-warning border-0 shadow-sm mb-3">
                    <h6 class="fw-bold mb-2"><i class="bi bi-exclamation-triangle-fill me-1"></i> Self-Reported Found Item</h6>
                    <p class="small mb-2">You reported finding this item under your active account (<strong>${currentUser.username}</strong>).</p>
                    <p class="small mb-0">To test claiming this item as the owner, switch to another account using the top navbar.</p>
                </div>
                <button type="button" class="btn btn-secondary w-100 fw-bold" data-bs-dismiss="modal">Close</button>
            `;
        } else {
            modalBody.innerHTML = `
                <div class="mb-3">
                    <span class="badge badge-found me-2">FOUND ITEM</span>
                    <h5 class="fw-bold text-dark mb-1 fs-5">${escapeHtml(foundReport.itemName)}</h5>
                    <div class="p-2 bg-light rounded border mt-2 small text-dark">
                        <i class="bi bi-person-circle text-primary me-1"></i>Founder holding this item: <strong>${escapeHtml(finderName)}</strong> (${escapeHtml(finderEmail)})
                    </div>
                </div>
                
                <div class="p-3 bg-light rounded-3 border mb-3 small text-muted">
                    <strong>Found Item Details:</strong> ${escapeHtml(foundReport.description)}
                </div>

                <div class="p-3 bg-primary bg-opacity-10 border border-primary-subtle rounded-3 mb-3 small text-primary-emphasis">
                    <h6 class="fw-bold mb-1"><i class="bi bi-shield-lock-fill me-1"></i>🔐 Verify Ownership</h6>
                    <p class="mb-0">Before contacting the finder, tell us one thing about your item that is NOT visible in the listing.</p>
                </div>

                <form id="claim-submit-form" onsubmit="handleClaimSubmit(event, '${foundReport.id}')">
                    <div class="mb-3">
                        <label class="form-label fw-semibold small">Your Name (Claimant / Person Who Lost)</label>
                        <input type="text" id="claimant-name-input" class="form-control form-control-sm" value="${currentUser ? escapeHtml(currentUser.username) : ''}" placeholder="Enter your full name" required>
                    </div>
                    <div class="mb-3">
                        <label class="form-label fw-semibold small">
                            <i class="bi bi-shield-lock-fill text-primary me-1"></i>What unique mark or detail does your item have? <span class="text-danger">*</span>
                        </label>
                        <textarea id="provided-proof" rows="3" class="form-control form-control-sm" placeholder="e.g. Unique scratch near zipper, initials engraved, keychain design, screen lock wallpaper, serial number..." required></textarea>
                        <small class="text-muted" style="font-size: 0.75rem;">Sent directly to Founder <strong>${escapeHtml(finderName)}</strong>. The founder will review your answer to Accept or Reject your claim before chat unlocks.</small>
                    </div>
                    <button type="submit" class="btn btn-primary w-100 fw-bold btn-sm py-2">
                        <i class="bi bi-shield-lock me-1"></i>Submit Hidden Detail to Founder
                    </button>
                </form>

                <div id="unlocked-contact-info" class="mt-3"></div>
            `;
        }
    }

    let bsModal = new bootstrap.Modal(modalEl);
    bsModal.show();
}

function handleClaimSubmit(event, foundReportId) {
    event.preventDefault();
    let reports = getReports();
    let item = reports.find(r => r.id === foundReportId);
    let proof = document.getElementById("provided-proof").value.trim();
    let claimantName = document.getElementById("claimant-name-input").value.trim();

    if (!item) return;

    let currentUser = getCurrentUser();
    let claimantEmail = currentUser ? currentUser.useremail : "claimant@example.com";
    let claimId = "CLM-" + Math.floor(1000 + Math.random() * 9000);

    // Save claim record into localStorage with "Pending Founder Approval" status
    saveClaim({
        claimId: claimId,
        itemId: item.id,
        itemName: item.itemName,
        claimedBy: claimantName,
        claimedByEmail: claimantEmail,
        reporter: item.postedBy,
        reporterEmail: item.postedByEmail, // The FINDER / FOUNDER who holds the item!
        providedProof: proof,
        status: "Pending Founder Approval",
        date: new Date().toLocaleDateString()
    });

    // Send Notification directly to Founder (item.postedByEmail)
    sendNotification({
        id: "NOTIF-" + Date.now(),
        recipientEmail: item.postedByEmail, // SENT TO THE FINDER / FOUNDER!
        senderName: claimantName,
        senderEmail: claimantEmail,
        itemId: item.id,
        itemName: item.itemName,
        message: `🔐 Hidden Details Submitted! ${claimantName} submitted hidden details to claim your found item "${item.itemName}". Please review details on your Dashboard to approve and schedule the meeting.`,
        date: new Date().toLocaleString(),
        type: "claim_request",
        claimId: claimId
    });

    // Display confirmation & Founder's contact details to claimant
    let outputArea = document.getElementById("unlocked-contact-info");
    outputArea.innerHTML = `
        <div class="alert alert-success border-0 shadow-sm mb-0">
            <h6 class="fw-bold mb-2"><i class="bi bi-check-circle-fill me-1"></i> Hidden Details Sent to Founder!</h6>
            <p class="small mb-3">Your hidden identifying details have been sent to Founder <strong>${item.postedBy}</strong>. They will verify your proof on their Dashboard and schedule the campus handover meeting.</p>
            <div class="p-3 bg-white rounded border small text-dark mb-3">
                <strong class="d-block text-primary mb-2"><i class="bi bi-person-lines-fill me-1"></i>Founder Contact Details:</strong>
                <div class="mb-1"><strong>Name:</strong> ${item.postedBy}</div>
                <div class="mb-1"><strong>Email:</strong> <a href="mailto:${item.postedByEmail}">${item.postedByEmail}</a></div>
                <div class="mb-1"><strong>Phone / WhatsApp:</strong> ${item.contactPhone || '+91 98123 45678'}</div>
            </div>
            <div class="d-flex gap-2">
                <a href="dashboard.html" class="btn btn-sm btn-success fw-bold flex-fill">
                    <i class="bi bi-speedometer2 me-1"></i>Go to Dashboard
                </a>
                <button type="button" class="btn btn-sm btn-outline-secondary" data-bs-dismiss="modal">Close</button>
            </div>
        </div>
    `;

    let formEl = document.getElementById("claim-submit-form");
    if (formEl) formEl.style.display = "none";
}

function handleNotifyOwnerSubmit(event, lostReportId, matchingFoundReportId) {
    event.preventDefault();
    let reports = getReports();
    let item = reports.find(r => r.id === lostReportId);
    let messageText = document.getElementById("found-notice-message").value.trim();
    let finderNameInput = document.getElementById("finder-name-input");
    let finderPhoneInput = document.getElementById("finder-phone-input");

    if (!item) return;

    let currentUser = getCurrentUser();
    let finderName = finderNameInput ? finderNameInput.value.trim() : (currentUser ? currentUser.username : "A student");
    let finderEmail = currentUser ? currentUser.useremail : "finder@example.com";
    let finderPhone = finderPhoneInput ? finderPhoneInput.value.trim() : "+91 98123 45678";

    // Send notification directly to Lost Item Owner
    sendNotification({
        id: "NOTIF-" + Date.now(),
        recipientEmail: item.postedByEmail, // SENT DIRECTLY TO THE USER WHO LOST THE ITEM!
        senderName: finderName,
        senderEmail: finderEmail,
        senderPhone: finderPhone,
        itemId: item.id,
        itemName: item.itemName,
        message: `🎉 Good News! ${finderName} reported finding an item matching your lost report "${item.itemName}": "${messageText}"`,
        matchingFoundId: matchingFoundReportId || null,
        type: "owner_notification",
        date: new Date().toLocaleString()
    });

    let outputArea = document.getElementById("unlocked-contact-info");
    outputArea.innerHTML = `
        <div class="alert alert-success border-0 shadow-sm mb-0">
            <h6 class="fw-bold mb-2"><i class="bi bi-check-circle-fill me-1"></i> Notification Sent to Owner!</h6>
            <p class="small mb-3">We have notified <strong>${item.postedBy}</strong> (<em>${item.postedByEmail}</em>) that you found an item matching their report. They can view this in their Dashboard notifications and provide their hidden details for verification.</p>
            <div class="p-3 bg-white rounded border small text-dark mb-3">
                <strong class="d-block text-primary mb-2"><i class="bi bi-person-lines-fill me-1"></i>Owner Contact Details:</strong>
                <div class="mb-1"><strong>Name:</strong> ${item.postedBy}</div>
                <div class="mb-1"><strong>Email:</strong> <a href="mailto:${item.postedByEmail}">${item.postedByEmail}</a></div>
                <div class="mb-1"><strong>Phone / WhatsApp:</strong> ${item.contactPhone || '+91 98765 43210'}</div>
            </div>
            <div class="d-flex gap-2">
                <a href="dashboard.html" class="btn btn-sm btn-primary fw-bold flex-fill">
                    <i class="bi bi-speedometer2 me-1"></i>Go to Dashboard
                </a>
                <button type="button" class="btn btn-sm btn-outline-secondary" data-bs-dismiss="modal">Close</button>
            </div>
        </div>
    `;

    let formEl = document.getElementById("notify-owner-form");
    if (formEl) formEl.style.display = "none";
}

// -------------------------------------------------------------
// SECURE MATCH CHAT - Helper to open/create chat
// -------------------------------------------------------------
function openOrCreateChat(report1Id, report2Id, score = 90) {
    let currentUser = getCurrentUser();
    if (!currentUser) {
        alert("Please sign in to start a private chat with the finder or lost item owner.");
        window.location.href = "login.html";
        return;
    }

    let reports = getReports();
    let rep1 = reports.find(r => r.id === report1Id);
    let rep2 = reports.find(r => r.id === report2Id);

    if (!rep1 || !rep2) {
        alert("Could not load report details for this match.");
        return;
    }

    let lostReport = rep1.type === "lost" ? rep1 : rep2;
    let foundReport = rep1.type === "found" ? rep1 : rep2;

    // Check if an approved claim exists for this pair
    let claims = typeof getClaims === "function" ? getClaims() : [];
    let approvedClaim = claims.find(c =>
        (c.itemId === foundReport.id || c.itemId === lostReport.id) &&
        (c.status === "Approved & Meeting Scheduled" || c.status === "Verified" || c.status === "Recovery Arranged" || c.status === "Recovered")
    );

    if (!approvedClaim) {
        alert("🔒 Chat Locked. You must submit your hidden ownership detail and have the Founder accept your claim before chat unlocks.");
        openClaimModal(lostReport.id, foundReport.id);
        return;
    }

    // Check if chat already exists for this pair
    let existingChat = getChats().find(c => 
        (c.lostItemId === lostReport.id && c.foundItemId === foundReport.id) ||
        (c.lostItemId === foundReport.id && c.foundItemId === lostReport.id)
    );

    if (existingChat) {
        window.location.href = `chat.html?chatId=${existingChat.chatId}`;
        return;
    }

    // Create new chat
    let chatId = "CHAT-" + Math.floor(100000 + Math.random() * 900000);
    let newChat = {
        chatId: chatId,
        lostItemId: lostReport.id,
        foundItemId: foundReport.id,
        lostUserEmail: lostReport.postedByEmail,
        finderEmail: foundReport.postedByEmail,
        lostItemName: lostReport.itemName,
        foundItemName: foundReport.itemName,
        lostZone: lostReport.zone,
        foundZone: foundReport.zone,
        matchScore: score || 90,
        status: "Verification Pending",
        recoveryDetails: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [
            {
                id: "MSG-" + Date.now(),
                senderId: "SYSTEM",
                senderName: "CampusFind System",
                text: `🔒 Private match chat initiated for ${lostReport.itemName} (${score}% Match). Use this chat to verify ownership details and arrange item recovery securely.`,
                type: "system",
                timestamp: new Date().toISOString(),
                read: true
            }
        ]
    };

    saveChat(newChat);

    // Notify the other user about the new chat
    let recipientEmail = (currentUser.useremail.toLowerCase() === lostReport.postedByEmail.toLowerCase()) 
        ? foundReport.postedByEmail 
        : lostReport.postedByEmail;

    sendNotification({
        id: "NOTIF-" + Date.now(),
        recipientEmail: recipientEmail,
        senderName: currentUser.username,
        senderEmail: currentUser.useremail,
        itemId: lostReport.id,
        itemName: lostReport.itemName,
        message: `💬 New match chat started by ${currentUser.username} for "${lostReport.itemName}" (${score}% Match)!`,
        chatId: chatId,
        type: "chat_start",
        date: new Date().toLocaleString()
    });

    window.location.href = `chat.html?chatId=${chatId}`;
}

// -------------------------------------------------------------
// 5. DASHBOARD LOGIC (NOTIFICATIONS & MEETING SCHEDULING)
// -------------------------------------------------------------
function initDashboardPage() {
    let currentUser = getCurrentUser();
    let nameEl = document.getElementById("dash-user-name");
    if (nameEl) nameEl.innerText = currentUser.username;

    // Render Quick Statistics Cards (Lost Count, Found Count, Potential Matches)
    renderDashboardQuickStats(currentUser.useremail);

    // Render Notifications Feed Sidebar
    renderNotificationsFeed(currentUser.useremail);

    // Render Found Item Alerts (Lost item owner responds with hidden details)
    renderFoundNotices(currentUser.useremail);

    // Render Received Claims Needing Founder Approval
    renderReceivedClaims(currentUser.useremail);

    // Render Sent Claims & Founder Meeting Status
    renderSubmittedClaims(currentUser.useremail);

    // Render My Submitted Reports (Your Lost Items & Your Found Items)
    renderMyReports(currentUser.useremail);

    // Reposition hash navigation after the fixed navbar and dashboard content render.
    if (window.location.hash === "#notifications-section") {
        window.requestAnimationFrame(function() {
            let section = document.getElementById("notifications-section");
            let navbar = document.querySelector(".navbar-custom");
            if (!section) return;
            let navbarHeight = navbar ? navbar.getBoundingClientRect().height : 0;
            window.scrollTo({
                top: Math.max(0, section.getBoundingClientRect().top + window.scrollY - navbarHeight - 16),
                behavior: "auto"
            });
        });
    }

    // Setup Meeting Location change listener to show/hide custom input
    let meetingLocationSelect = document.getElementById("meeting-location");
    if (meetingLocationSelect) {
        meetingLocationSelect.addEventListener("change", function() {
            let customContainer = document.getElementById("custom-location-container");
            let customInput = document.getElementById("custom-meeting-location");
            if (customContainer && customInput) {
                if (meetingLocationSelect.value === "Other") {
                    customContainer.classList.remove("d-none");
                    customInput.required = true;
                } else {
                    customContainer.classList.add("d-none");
                    customInput.required = false;
                    customInput.value = "";
                }
            }
        });
    }
}

// Render Found Item Alerts as a compact summary preview in the dashboard
function renderFoundNotices(userEmail) {
    let container = document.getElementById("found-notices-container");
    let badgeEl = document.getElementById("found-notices-badge");
    if (!container) return;

    let notifs = getNotifications(userEmail);
    // Find all notifications that are owner alerts (someone found an item matching your lost report)
    let foundNotices = notifs.filter(n => n.type === "owner_notification" || (n.message && n.message.includes("Good News")));

    if (badgeEl) {
        badgeEl.innerText = `${foundNotices.length} Alert${foundNotices.length === 1 ? '' : 's'}`;
        badgeEl.className = foundNotices.length > 0 ? "badge bg-warning text-dark border rounded-pill px-2.5 py-1 fw-bold" : "badge bg-secondary-subtle text-secondary border rounded-pill px-2.5 py-1";
    }

    if (foundNotices.length === 0) {
        container.innerHTML = `<p class="text-muted small py-2 mb-0">No found item alerts received from finders yet.</p>`;
        return;
    }

    let allClaims = getClaims();

    container.innerHTML = "";
    foundNotices.forEach(n => {
        let finderPhone = n.senderPhone || "+91 98123 45678";
        let finderEmail = n.senderEmail || "finder@example.com";
        let finderName = n.senderName || "Founder";
        let itemName = n.itemName || "Lost Item";

        let existingClaim = allClaims.find(c => 
            c.claimedByEmail && userEmail && c.claimedByEmail.toLowerCase().trim() === userEmail.toLowerCase().trim() &&
            c.reporterEmail && finderEmail && c.reporterEmail.toLowerCase().trim() === finderEmail.toLowerCase().trim() &&
            (c.itemId === n.itemId || c.itemName === itemName)
        );

        let badgeLabel = existingClaim ? "⚠️ Hidden Details Submitted" : "Founder Found Your Item!";

        container.innerHTML += `
            <div class="card p-2.5 mb-2 border border-warning-subtle shadow-sm rounded-3 bg-light-subtle">
                <div class="d-flex justify-content-between align-items-center mb-1 flex-wrap gap-1">
                    <span class="badge bg-warning text-dark fw-bold" style="font-size: 0.72rem;">
                        <i class="bi bi-bell-fill me-1"></i>${badgeLabel}
                    </span>
                    <small class="text-muted" style="font-size: 0.72rem;"><i class="bi bi-clock me-1"></i>${n.date}</small>
                </div>
                <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mt-1">
                    <div>
                        <div class="fw-bold text-dark" style="font-size: 0.85rem;">
                            Lost Item: <span class="text-primary">${itemName}</span>
                        </div>
                        <div class="small text-muted" style="font-size: 0.78rem;">
                            Found by: <strong>${finderName}</strong>
                        </div>
                    </div>
                    <div class="d-flex gap-1 align-items-center">
                        <button type="button" class="btn btn-sm btn-primary fw-bold py-1 px-2.5" style="font-size: 0.75rem;" onclick="openProvideHiddenDetailsModal('${n.id}')">
                            <i class="bi bi-shield-lock me-1"></i>Provide Hidden Details
                        </button>
                        <button type="button" class="btn btn-sm btn-outline-warning text-dark fw-bold py-1 px-2.5" style="font-size: 0.75rem;" onclick="openFoundNoticeDetailModal('${n.id}')">
                            View Details <i class="bi bi-arrow-right ms-1"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    });
}

function openFoundNoticeDetailModal(notifId) {
    let currentUser = getCurrentUser();
    let userEmail = currentUser ? currentUser.email : "";
    let notifs = getNotifications(userEmail);
    let n = notifs.find(item => item.id === notifId);
    if (!n) return;

    let modalBody = document.getElementById("modal-found-notice-details-body");
    if (!modalBody) return;

    let finderPhone = n.senderPhone || "+91 98123 45678";
    let finderEmail = n.senderEmail || "finder@example.com";
    let finderName = n.senderName || "Founder";
    let itemName = n.itemName || "Lost Item";
    let noticeMsg = n.message || "No message provided.";

    let allClaims = getClaims();
    let existingClaim = allClaims.find(c => 
        c.claimedByEmail && userEmail && c.claimedByEmail.toLowerCase().trim() === userEmail.toLowerCase().trim() &&
        c.reporterEmail && finderEmail && c.reporterEmail.toLowerCase().trim() === finderEmail.toLowerCase().trim() &&
        (c.itemId === n.itemId || c.itemName === itemName)
    );

    let actionHtml = "";
    if (existingClaim) {
        if (existingClaim.status === "Approved & Meeting Scheduled" && existingClaim.meetingDetails) {
            actionHtml = `
                <div class="w-100 p-2.5 bg-success bg-opacity-10 text-success rounded border small fw-bold mt-2">
                    <i class="bi bi-check2-circle me-1"></i>Approved by Founder! Meeting at ${existingClaim.meetingDetails.location} | ${existingClaim.meetingDetails.time}
                </div>
            `;
        } else if (existingClaim.status === "More Info Requested") {
            actionHtml = `
                <div class="w-100 p-2.5 bg-warning bg-opacity-10 text-dark rounded border small mt-2">
                    <div class="fw-bold text-warning-emphasis mb-1"><i class="bi bi-exclamation-triangle-fill text-warning me-1"></i>Founder (${finderName}) requested more details:</div>
                    <div class="mb-2">"${existingClaim.founderFeedback || 'Please provide more details'}"</div>
                    <button type="button" class="btn btn-sm btn-warning text-dark fw-bold" onclick="bootstrap.Modal.getInstance(document.getElementById('foundNoticeDetailModal')).hide(); openUpdateDetailsModal('${existingClaim.claimId}')">
                        <i class="bi bi-pencil-square me-1"></i>Provide Additional / Correct Details
                    </button>
                </div>
            `;
        } else if (existingClaim.status === "Rejected") {
            actionHtml = `
                <div class="w-100 p-2.5 bg-danger bg-opacity-10 text-danger rounded border small mt-2">
                    <i class="bi bi-x-circle-fill me-1"></i><strong>Claim Rejected:</strong> ${existingClaim.rejectionReason || 'Details did not match'}
                </div>
            `;
        } else {
            actionHtml = `
                <div class="w-100 p-2.5 bg-warning bg-opacity-10 text-dark rounded border small mt-2">
                    <i class="bi bi-hourglass-split text-warning me-1"></i><strong>Hidden Details Submitted:</strong> "${existingClaim.providedProof}". Awaiting Founder (${finderName}) to verify & schedule meeting.
                </div>
            `;
        }
    } else {
        actionHtml = `
            <button type="button" class="btn btn-sm btn-primary fw-bold ms-auto mt-2" onclick="bootstrap.Modal.getInstance(document.getElementById('foundNoticeDetailModal')).hide(); openProvideHiddenDetailsModal('${n.id}')">
                <i class="bi bi-shield-lock me-1"></i>Provide Hidden Details to Founder
            </button>
        `;
    }

    modalBody.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
            <span class="badge bg-warning text-dark fw-bold">
                <i class="bi bi-bell-fill me-1"></i>Founder Found Your Item!
            </span>
            <small class="text-muted"><i class="bi bi-clock"></i> ${n.date}</small>
        </div>

        <h6 class="fw-bold mb-2 text-dark fs-5">
            <i class="bi bi-search-heart text-primary me-1"></i>Lost Item: <span class="text-primary">${itemName}</span>
        </h6>
        
        <p class="small text-muted mb-3">
            <strong>Founder:</strong> ${finderName} (${finderEmail})
        </p>

        <div class="p-3 bg-light rounded border mb-3 small text-dark">
            <div class="text-muted extra-small text-uppercase fw-bold mb-1">Message from Founder (${finderName}):</div>
            <div class="text-dark">${noticeMsg}</div>
        </div>

        <div class="d-flex flex-wrap gap-2 align-items-center">
            <a href="tel:${finderPhone}" class="btn btn-sm btn-outline-success fw-semibold">
                <i class="bi bi-telephone-fill me-1"></i>Call (${finderPhone})
            </a>
            <a href="mailto:${finderEmail}?subject=Regarding Found Item: ${encodeURIComponent(itemName)}" class="btn btn-sm btn-outline-primary fw-semibold">
                <i class="bi bi-envelope-fill me-1"></i>Email Founder
            </a>
            ${actionHtml}
        </div>
    `;

    let modalEl = document.getElementById("foundNoticeDetailModal");
    if (modalEl) {
        let bsModal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        bsModal.show();
    }
}

function openProvideHiddenDetailsModal(notifId) {
    let notifs = JSON.parse(localStorage.getItem("campus_notifications")) || [];
    let notif = notifs.find(n => n.id === notifId || n.claimId === notifId);
    
    // Fallback: check claims list if not directly matched in notifications array
    if (!notif) {
        let claims = getClaims();
        let claim = claims.find(c => c.claimId === notifId || c.itemId === notifId);
        if (claim) {
            notif = {
                id: claim.claimId,
                senderName: claim.reporter || claim.claimedBy || "Founder",
                senderEmail: claim.reporterEmail || claim.claimedByEmail || "",
                itemName: claim.itemName || "Item"
            };
        }
    }
    if (!notif) return;

    let notifIdInput = document.getElementById("handover-notif-id");
    let emailInput = document.getElementById("handover-finder-email");
    let detailsInput = document.getElementById("handover-hidden-details");
    let phoneInput = document.getElementById("handover-claimant-phone");
    
    let currentUser = getCurrentUser();

    if (notifIdInput) notifIdInput.value = notif.id;
    if (emailInput) emailInput.value = notif.senderEmail || "";
    if (detailsInput) detailsInput.value = "";
    if (phoneInput && currentUser) phoneInput.value = currentUser.contactPhone || "+91 98765 43210";
    
    let finderNameEl = document.getElementById("handover-finder-name");
    let finderNameLabel = document.getElementById("handover-finder-name-label");
    let itemNameEl = document.getElementById("handover-item-name");
    
    if (finderNameEl) finderNameEl.innerText = notif.senderName || "Founder";
    if (finderNameLabel) finderNameLabel.innerText = notif.senderName || "Founder";
    if (itemNameEl) itemNameEl.innerText = `"${notif.itemName || 'Lost Item'}"`;

    let modalEl = document.getElementById("provideHiddenDetailsModal");
    if (modalEl) {
        let modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    }
}

function handleProvideHiddenDetailsSubmit(event) {
    event.preventDefault();
    let notifId = document.getElementById("handover-notif-id").value;
    let finderEmail = document.getElementById("handover-finder-email").value;
    let hiddenDetails = document.getElementById("handover-hidden-details").value.trim();
    let claimantPhone = document.getElementById("handover-claimant-phone") ? document.getElementById("handover-claimant-phone").value.trim() : "";

    if (!hiddenDetails) {
        alert("Please enter the hidden identifying details to prove your ownership.");
        return;
    }

    let currentUser = getCurrentUser();
    let notifs = JSON.parse(localStorage.getItem("campus_notifications")) || [];
    let notif = notifs.find(n => n.id === notifId);
    let itemName = notif ? notif.itemName : "Lost Item";
    let claimId = "CLM-" + Math.floor(1000 + Math.random() * 9000);

    // Save claim entry with "Pending Founder Approval" status
    saveClaim({
        claimId: claimId,
        itemId: notif ? notif.itemId : "ITEM-" + Date.now(),
        itemName: itemName,
        claimedBy: currentUser ? currentUser.username : "Owner",
        claimedByEmail: currentUser ? currentUser.useremail : "",
        claimantPhone: claimantPhone || (currentUser ? currentUser.contactPhone : ""),
        reporter: notif ? notif.senderName : "Finder",
        reporterEmail: finderEmail,
        providedProof: hiddenDetails,
        status: "Pending Founder Approval",
        date: new Date().toLocaleDateString()
    });

    // Notify Founder that hidden details have been submitted for verification
    sendNotification({
        id: "NOTIF-" + Date.now(),
        recipientEmail: finderEmail,
        senderName: currentUser ? currentUser.username : "Owner",
        senderEmail: currentUser ? currentUser.useremail : "",
        senderPhone: claimantPhone,
        itemName: itemName,
        message: `🔐 Hidden Details Submitted! ${currentUser ? currentUser.username : 'Owner'} submitted hidden details to claim "${itemName}": "${hiddenDetails}". Please review on your Dashboard to approve and schedule the meeting.`,
        date: new Date().toLocaleString(),
        type: "claim_request",
        claimId: claimId
    });

    alert("Hidden details submitted to Founder (" + finderEmail + ")!\nThe Founder will verify your details and schedule the handover meeting.");

    let modalEl = document.getElementById("provideHiddenDetailsModal");
    if (modalEl) {
        let modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
    }

    window.location.reload();
}

function renderReceivedClaims(userEmail) {
    let container = document.getElementById("received-claims-container");
    if (!container) return;

    let claims = getClaims();
    let received = claims.filter(c => c.reporterEmail && userEmail && c.reporterEmail.toLowerCase().trim() === userEmail.toLowerCase().trim());

    if (received.length === 0) {
        container.innerHTML = `<p class="text-muted small py-2 mb-0">No claim requests received for your found items yet.</p>`;
        return;
    }

    container.innerHTML = "";
    received.forEach(c => {
        let isPending = c.status === "Pending Founder Approval" || c.status === "Pending Approval";
        let isMoreInfo = c.status === "More Info Requested";
        let isApproved = c.status === "Approved & Meeting Scheduled";
        let isRejected = c.status === "Rejected";

        let badgeClass = isApproved ? "bg-success" : (isRejected ? "bg-danger" : (isMoreInfo ? "bg-warning text-dark" : "bg-warning text-dark"));
        let badgeLabel = isPending ? "🔐 Ownership Claim Request" : c.status;

        container.innerHTML += `
            <div class="card p-2.5 mb-2 border shadow-sm rounded-3 bg-light-subtle">
                <div class="d-flex justify-content-between align-items-center mb-1 flex-wrap gap-1">
                    <span class="badge ${badgeClass}" style="font-size: 0.72rem;">
                        ${isApproved ? '<i class="bi bi-check-circle me-1"></i>' : (isRejected ? '<i class="bi bi-x-circle me-1"></i>' : '<i class="bi bi-shield-lock me-1"></i>')}${badgeLabel}
                    </span>
                    <small class="text-muted" style="font-size: 0.72rem;"><i class="bi bi-clock me-1"></i>${c.date}</small>
                </div>
                <div class="mt-1 mb-1">
                    <div class="fw-bold text-dark" style="font-size: 0.85rem;">
                        Item: <span class="text-primary">${escapeHtml(c.itemName)}</span>
                    </div>
                    <div class="small text-muted" style="font-size: 0.78rem;">
                        Claimant: <strong>${escapeHtml(c.claimedBy)}</strong>
                    </div>
                    ${(isPending || isMoreInfo) && c.providedProof ? `
                        <div class="p-1.5 bg-light rounded border mt-1 small text-muted" style="font-size: 0.75rem;">
                            <strong class="text-dark"><i class="bi bi-shield-lock text-primary me-1"></i>Claimant's Hidden Details:</strong> "${escapeHtml(c.providedProof)}"
                        </div>
                    ` : ''}
                </div>
                <div class="d-flex justify-content-between align-items-center flex-wrap gap-1 mt-1 pt-1.5 border-top">
                    ${(isPending || isMoreInfo) ? `
                        <div class="d-flex gap-1 flex-wrap align-items-center">
                            <button type="button" class="btn btn-sm btn-success fw-bold py-1 px-2" style="font-size: 0.73rem;" onclick="openApproveClaimModal('${c.claimId}')">
                                <i class="bi bi-check-lg me-1"></i>Approve Claim
                            </button>
                            <button type="button" class="btn btn-sm btn-outline-warning text-dark fw-bold py-1 px-2" style="font-size: 0.73rem;" onclick="openRequestInfoModal('${c.claimId}')">
                                <i class="bi bi-chat-dots me-1"></i>Request More Info
                            </button>
                            <button type="button" class="btn btn-sm btn-outline-danger fw-bold py-1 px-2" style="font-size: 0.73rem;" onclick="openRejectModal('${c.claimId}')">
                                <i class="bi bi-x-lg me-1"></i>Reject Claim
                            </button>
                        </div>
                    ` : ''}
                    ${isApproved ? `
                        <button type="button" class="btn btn-sm btn-primary fw-bold py-1 px-2.5" style="font-size: 0.75rem;" onclick="openClaimChat('${c.claimId}')">
                            💬 Open Match Chat
                        </button>
                    ` : ''}
                    <button type="button" class="btn btn-sm btn-outline-secondary fw-semibold py-1 px-2.5 ms-auto" style="font-size: 0.75rem;" onclick="openReceivedClaimDetailModal('${c.claimId}')">
                        View Details <i class="bi bi-arrow-right ms-1"></i>
                    </button>
                </div>
            </div>
        `;
    });
}

function renderSubmittedClaims(userEmail) {
    let container = document.getElementById("submitted-claims-container");
    if (!container) return;

    let claims = getClaims();
    let sent = claims.filter(c => c.claimedByEmail && userEmail && c.claimedByEmail.toLowerCase().trim() === userEmail.toLowerCase().trim());

    if (sent.length === 0) {
        container.innerHTML = `<p class="text-muted small py-2 mb-0">No claim requests submitted yet.</p>`;
        return;
    }

    container.innerHTML = "";
    sent.forEach(c => {
        let isApproved = c.status === "Approved & Meeting Scheduled";
        let isRejected = c.status === "Rejected";
        let isMoreInfo = c.status === "More Info Requested";
        
        let badgeClass = isApproved ? "bg-success" : (isRejected ? "bg-danger" : (isMoreInfo ? "bg-warning text-dark" : "bg-warning text-dark"));
        let badgeIcon = isApproved ? "bi-check-circle" : (isRejected ? "bi-x-circle" : (isMoreInfo ? "bi-question-circle" : "bi-clock"));
        let founderName = c.reporter || "Founder";

        container.innerHTML += `
            <div class="card p-2.5 mb-2 border shadow-sm rounded-3 bg-light-subtle">
                <div class="d-flex justify-content-between align-items-center mb-1 flex-wrap gap-1">
                    <span class="badge ${badgeClass}" style="font-size: 0.72rem;">
                        <i class="bi ${badgeIcon} me-1"></i>${c.status}
                    </span>
                    <small class="text-muted" style="font-size: 0.72rem;"><i class="bi bi-clock me-1"></i>${c.date}</small>
                </div>
                <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mt-1">
                    <div>
                        <div class="fw-bold text-dark" style="font-size: 0.85rem;">
                            Item: <span class="text-primary">${c.itemName}</span>
                        </div>
                        <div class="small text-muted" style="font-size: 0.78rem;">
                            Founder Holding Item: <strong>${founderName}</strong>
                        </div>
                    </div>
                    <div class="d-flex gap-1 align-items-center">
                        <button type="button" class="btn btn-sm btn-primary fw-bold py-1 px-2.5" style="font-size: 0.75rem;" onclick="openClaimChat('${c.claimId}')">
                            💬 Open Match Chat
                        </button>
                        <button type="button" class="btn btn-sm btn-outline-secondary fw-semibold py-1 px-2.5" style="font-size: 0.75rem;" onclick="openSubmittedClaimDetailModal('${c.claimId}')">
                            View Details <i class="bi bi-arrow-right ms-1"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    });
}

function openSubmittedClaimDetailModal(claimId) {
    let claims = getClaims();
    let c = claims.find(item => item.claimId === claimId);
    if (!c) return;

    let modalBody = document.getElementById("modal-submitted-claim-details-body");
    if (!modalBody) return;

    let isApproved = c.status === "Approved & Meeting Scheduled";
    let isRejected = c.status === "Rejected";
    let isMoreInfo = c.status === "More Info Requested";
    
    let badgeClass = isApproved ? "bg-success" : (isRejected ? "bg-danger" : (isMoreInfo ? "bg-warning text-dark" : "bg-warning text-dark"));
    let badgeIcon = isApproved ? "bi-check-circle" : (isRejected ? "bi-x-circle" : (isMoreInfo ? "bi-question-circle" : "bi-clock"));
    let founderName = c.reporter || "Founder";

    modalBody.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
            <span class="badge ${badgeClass} fs-6">
                <i class="bi ${badgeIcon} me-1"></i>${c.status}
            </span>
            <small class="text-muted"><i class="bi bi-clock"></i> ${c.date}</small>
        </div>

        <h5 class="fw-bold mb-1 text-dark">
            Item: <span class="text-primary">${c.itemName}</span>
        </h5>
        <p class="small text-muted mb-3">
            <strong>Founder Holding Item:</strong> ${founderName} (${c.reporterEmail || 'finder@example.com'})
        </p>

        <div class="p-3 bg-light rounded border mb-3 small text-muted">
            <strong class="text-dark"><i class="bi bi-shield-lock text-primary me-1"></i>My Submitted Hidden Details:</strong> "${escapeHtml(c.providedProof)}"
        </div>

        ${isApproved && c.meetingDetails ? `
            <div class="p-3 bg-success bg-opacity-10 text-success rounded border small mb-3">
                <div class="fw-bold fs-6 mb-1"><i class="bi bi-geo-alt-fill me-1"></i>Meeting Scheduled by Founder</div>
                <div><strong>Location:</strong> ${c.meetingDetails.location}</div>
                <div><strong>Time:</strong> ${c.meetingDetails.time}</div>
                ${c.meetingDetails.note ? `<div class="mt-1 text-muted"><strong>Instructions:</strong> ${c.meetingDetails.note}</div>` : ''}
            </div>
        ` : isMoreInfo ? `
            <div class="p-3 bg-warning bg-opacity-10 rounded border small mb-3">
                <div class="fw-bold text-warning-emphasis mb-1">
                    <i class="bi bi-exclamation-triangle-fill text-warning me-1"></i>Founder (${founderName}) Requested Additional / Correct Details:
                </div>
                <div class="p-2 bg-white rounded border mb-2 text-dark">
                    "${escapeHtml(c.founderFeedback || 'Please provide more specific details.')}"
                </div>
                <button class="btn btn-sm btn-warning text-dark fw-bold w-100" onclick="bootstrap.Modal.getInstance(document.getElementById('submittedClaimDetailModal')).hide(); openUpdateDetailsModal('${c.claimId}')">
                    <i class="bi bi-pencil-square me-1"></i>Provide Additional / Correct Details
                </button>
            </div>
        ` : isRejected ? `
            <div class="p-3 bg-danger bg-opacity-10 text-danger rounded border small mb-3">
                <div class="fw-bold mb-1"><i class="bi bi-x-circle-fill me-1"></i>Claim Rejected by Founder (${founderName})</div>
                <div class="text-dark"><strong>Reason:</strong> ${escapeHtml(c.rejectionReason || 'The hidden details provided did not match the item found.')}</div>
            </div>
        ` : `
            <div class="p-3 bg-light rounded border small text-muted mb-3">
                <i class="bi bi-hourglass-split text-warning me-1"></i>
                <strong>Awaiting Founder Approval:</strong> Founder <strong>${founderName}</strong> is reviewing your hidden details. Once approved, the Founder will schedule the meeting location and time.
            </div>
        `}

        <div class="d-flex justify-content-end pt-2 border-top">
            <button class="btn btn-primary fw-bold" onclick="bootstrap.Modal.getInstance(document.getElementById('submittedClaimDetailModal')).hide(); openClaimChat('${c.claimId}')">
                <i class="bi bi-chat-dots-fill me-1"></i>💬 Open Match Chat
            </button>
        </div>
    `;

    let modalEl = document.getElementById("submittedClaimDetailModal");
    if (modalEl) {
        let bsModal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        bsModal.show();
    }
}

window.activeNotifTab = 'all';

function switchNotifTab(tabName) {
    window.activeNotifTab = tabName;
    ['all', 'unread', 'action', 'messages', 'activity'].forEach(t => {
        let btn = document.getElementById(`notif-tab-${t}`);
        if (btn) {
            btn.classList.toggle('active', t === tabName);
        }
    });

    let currentUser = getCurrentUser();
    if (currentUser && currentUser.useremail) {
        renderNotificationsFeed(currentUser.useremail);
    }
}

function renderNotificationsFeed(userEmail) {
    let container = document.getElementById("notifications-container");
    let clearBtn = document.getElementById("btn-clear-notifications");
    if (!container) return;

    let notifs = getNotifications(userEmail);

    if (clearBtn) {
        clearBtn.disabled = notifs.length === 0;
        clearBtn.style.opacity = notifs.length === 0 ? "0.5" : "1";
    }

    let activeTab = window.activeNotifTab || 'all';

    let filteredNotifs = notifs.filter(n => {
        let isUnread = n.read !== true;
        let isChatMsg = n.type === "chat_message" || n.type === "chat_start" || n.chatId;
        let isActionReq = n.type === "claim_request" || n.type === "more_info_requested" || n.type === "owner_notification" || (n.message && (n.message.includes("submitted hidden details") || n.message.includes("More Info Needed") || n.message.includes("Good News")));
        let isActivity = n.type === "claim_approved" || n.type === "claim_rejected" || n.type === "item_recovered" || (n.message && (n.message.includes("Approved") || n.message.includes("Rejected") || n.message.includes("Recovered")));

        if (activeTab === 'unread') return isUnread;
        if (activeTab === 'action') return isActionReq;
        if (activeTab === 'messages') return isChatMsg;
        if (activeTab === 'activity') return isActivity;
        return true; // 'all'
    });

    // Display sorting: Newest notifications first!
    filteredNotifs.sort((a, b) => {
        let timeA = new Date(a.date || a.timestamp || 0).getTime();
        let timeB = new Date(b.date || b.timestamp || 0).getTime();
        if (isNaN(timeA) || isNaN(timeB)) return 0;
        return timeB - timeA;
    });

    if (filteredNotifs.length === 0) {
        let tabLabel = activeTab === 'unread' ? 'unread' : (activeTab === 'action' ? 'action required' : (activeTab === 'messages' ? 'message' : (activeTab === 'activity' ? 'activity' : '')));
        container.innerHTML = `
            <div class="p-4 text-muted text-center small">
                <i class="bi bi-bell-slash fs-3 d-block text-secondary mb-2 opacity-50"></i>
                No ${tabLabel} notifications for this account.<br>
                <span class="extra-small text-muted">When relevant updates occur, they will appear in this category.</span>
            </div>
        `;
        return;
    }

    container.innerHTML = "";
    filteredNotifs.forEach(n => {
        let isUnread = n.read !== true;
        let isChatMsg = n.type === "chat_message" || n.type === "chat_start" || n.chatId;
        let isOwnerAlert = n.type === "owner_notification" || (n.message && n.message.includes("Good News"));
        let isApproved = n.type === "claim_approved" || (n.message && n.message.includes("Claim Approved"));
        let isMoreInfo = n.type === "more_info_requested" || (n.message && n.message.includes("More Info Needed"));
        let isRejected = n.type === "claim_rejected" || (n.message && n.message.includes("Claim Rejected"));
        
        let badgeText = isChatMsg ? "New Chat Message" : (isOwnerAlert ? "Item Found Alert" : (isApproved ? "Claim Approved" : (isMoreInfo ? "More Info Needed" : (isRejected ? "Claim Rejected" : "Hidden Details Received"))));
        let badgeClass = isChatMsg ? "bg-primary text-white" : (isOwnerAlert ? "bg-warning text-dark" : (isApproved ? "bg-success text-white" : (isMoreInfo ? "bg-warning text-dark" : (isRejected ? "bg-danger text-white" : "bg-info text-dark"))));

        let cardStyleClass = isUnread ? "notif-card-unread" : "notif-card-read";

        container.innerHTML += `
            <div class="p-3 mb-2 rounded-3 border shadow-sm position-relative ${cardStyleClass}">
                <div class="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-1">
                    <div class="d-flex align-items-center gap-1">
                        <span class="badge ${badgeClass} extra-small fw-bold px-2.5 py-1">${badgeText}</span>
                        ${isUnread ? '<span class="badge bg-danger rounded-pill extra-small px-2 py-0.5" style="font-size:0.65rem;"><i class="bi bi-circle-fill me-1" style="font-size:0.45rem;"></i>UNREAD</span>' : '<span class="badge bg-secondary-subtle text-muted extra-small px-2 py-0.5" style="font-size:0.65rem;">Read</span>'}
                    </div>
                    <div class="d-flex align-items-center gap-2">
                        <small class="text-muted extra-small"><i class="bi bi-clock me-1"></i>${n.date}</small>
                        ${isUnread ? `
                            <button type="button" class="btn btn-sm btn-success text-white py-0.5 px-2.5 rounded-pill extra-small fw-bold shadow-sm" onclick="handleMarkNotificationRead('${n.id}', '${n.chatId || ''}')" title="Mark as Read">
                                <i class="bi bi-check-circle-fill me-1"></i>Mark Read
                            </button>
                        ` : ''}
                        <button type="button" class="btn btn-link text-secondary p-0 lh-1 hover-danger ms-1" onclick="handleDeleteSingleNotification('${n.id}')" title="Delete notification" style="font-size: 0.9rem;">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </div>
                <p class="small mb-2 text-light fw-medium" style="line-height: 1.4;">${escapeHtml(n.message)}</p>
                
                ${n.chatId ? `
                    <div class="mt-2 pt-2 border-top border-secondary-subtle d-flex justify-content-between align-items-center">
                        <span class="extra-small text-muted"><i class="bi bi-shield-lock-fill text-success me-1"></i>Private Match Chat</span>
                        <a href="chat.html?chatId=${n.chatId}" class="btn btn-sm btn-primary fw-bold py-1 px-3 extra-small rounded-pill" onclick="handleMarkNotificationRead('${n.id}')">
                            💬 Open Chat <i class="bi bi-arrow-right ms-1"></i>
                        </a>
                    </div>
                ` : (n.senderPhone || n.senderEmail ? `
                    <div class="small text-muted border-top border-secondary-subtle pt-2 mt-2 extra-small d-flex flex-wrap gap-2">
                        ${n.senderPhone ? `<span><i class="bi bi-telephone-fill text-primary me-1"></i>${n.senderPhone}</span>` : ''}
                        ${n.senderEmail ? `<span><i class="bi bi-envelope-fill text-primary me-1"></i><a href="mailto:${n.senderEmail}" class="text-info">${n.senderEmail}</a></span>` : ''}
                    </div>
                ` : '')}
            </div>
        `;
    });
}

function handleMarkNotificationRead(notifId, chatId) {
    let currentUser = getCurrentUser();
    if (!currentUser || !currentUser.useremail) return;

    markNotificationAsRead(notifId);
    renderNotificationsFeed(currentUser.useremail);
    renderFoundNotices(currentUser.useremail);
    renderNavbarUser();

    if (chatId) {
        window.location.href = `chat.html?chatId=${chatId}`;
    }
}


function handleClearAllNotifications() {
    let currentUser = getCurrentUser();
    if (!currentUser || !currentUser.useremail) return;

    let notifs = getNotifications(currentUser.useremail);
    if (notifs.length === 0) {
        alert("No notifications to delete.");
        return;
    }

    if (confirm("Delete all notifications?\nThis will remove your notification history.")) {
        clearNotifications(currentUser.useremail);
        renderNotificationsFeed(currentUser.useremail);
        renderFoundNotices(currentUser.useremail);
        renderNavbarUser(); // Update top navbar unread count badge instantly!
    }
}

function handleDeleteSingleNotification(notifId) {
    let currentUser = getCurrentUser();
    if (!currentUser || !currentUser.useremail) return;

    deleteNotification(notifId);
    renderNotificationsFeed(currentUser.useremail);
    renderFoundNotices(currentUser.useremail);
    renderNavbarUser(); // Update top navbar unread count badge instantly!
}

function renderReceivedClaims(userEmail) {
    let container = document.getElementById("received-claims-container");
    if (!container) return;

    let claims = getClaims();
    let received = claims.filter(c => c.reporterEmail && userEmail && c.reporterEmail.toLowerCase().trim() === userEmail.toLowerCase().trim());

    if (received.length === 0) {
        container.innerHTML = `<p class="text-muted small py-2 mb-0">No claim requests received for your found items yet.</p>`;
        return;
    }

    container.innerHTML = "";
    received.forEach(c => {
        let isMoreInfo = c.status === "More Info Requested";
        let isApproved = c.status === "Approved & Meeting Scheduled";
        let isRejected = c.status === "Rejected";

        let badgeClass = isApproved ? "bg-success" : (isRejected ? "bg-danger" : (isMoreInfo ? "bg-warning text-dark" : "bg-warning text-dark"));

        container.innerHTML += `
            <div class="card p-2.5 mb-2 border shadow-sm rounded-3 bg-light-subtle">
                <div class="d-flex justify-content-between align-items-center mb-1 flex-wrap gap-1">
                    <span class="badge ${badgeClass}" style="font-size: 0.72rem;">
                        ${isApproved ? '<i class="bi bi-check-circle me-1"></i>' : (isRejected ? '<i class="bi bi-x-circle me-1"></i>' : '<i class="bi bi-clock me-1"></i>')}${c.status}
                    </span>
                    <small class="text-muted" style="font-size: 0.72rem;"><i class="bi bi-clock me-1"></i>${c.date}</small>
                </div>
                <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mt-1">
                    <div>
                        <div class="fw-bold text-dark" style="font-size: 0.85rem;">
                            Item: <span class="text-primary">${c.itemName}</span>
                        </div>
                        <div class="small text-muted" style="font-size: 0.78rem;">
                            Claimant: <strong>${c.claimedBy}</strong>
                        </div>
                    </div>
                    <div class="d-flex gap-1 align-items-center">
                        ${isApproved ? `
                            <button type="button" class="btn btn-sm btn-primary fw-bold py-1 px-2.5" style="font-size: 0.75rem;" onclick="openClaimChat('${c.claimId}')">
                                💬 Open Match Chat
                            </button>
                        ` : ''}
                        <button type="button" class="btn btn-sm btn-outline-secondary fw-semibold py-1 px-2.5" style="font-size: 0.75rem;" onclick="openReceivedClaimDetailModal('${c.claimId}')">
                            View Details <i class="bi bi-arrow-right ms-1"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    });
}

function openReceivedClaimDetailModal(claimId) {
    let claims = getClaims();
    let c = claims.find(item => item.claimId === claimId);
    if (!c) return;

    let modalBody = document.getElementById("modal-received-claim-details-body");
    if (!modalBody) return;

    let isPending = c.status === "Pending Founder Approval" || c.status === "Pending Approval";
    let isMoreInfo = c.status === "More Info Requested";
    let isApproved = c.status === "Approved & Meeting Scheduled";
    let isRejected = c.status === "Rejected";

    let badgeClass = isApproved ? "bg-success" : (isRejected ? "bg-danger" : (isMoreInfo ? "bg-warning text-dark" : "bg-warning text-dark"));

    modalBody.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
            <span class="badge ${badgeClass} fs-6">
                ${isApproved ? '<i class="bi bi-check-circle me-1"></i>' : (isRejected ? '<i class="bi bi-x-circle me-1"></i>' : '<i class="bi bi-clock me-1"></i>')}${c.status}
            </span>
            <small class="text-muted"><i class="bi bi-clock"></i> ${c.date}</small>
        </div>

        <h5 class="fw-bold mb-1 text-dark">
            Item: <span class="text-primary">${c.itemName}</span>
        </h5>
        <p class="small text-muted mb-3">
            <strong>Claimant (Lost Item Owner):</strong> ${c.claimedBy} (${c.claimedByEmail})
        </p>
        
        <!-- Submitted Hidden Details Box -->
        <div class="p-3 bg-light rounded-3 border mb-3 small">
            <div class="fw-bold text-dark mb-1">
                <i class="bi bi-bell-fill text-warning me-1"></i>Someone believes this is their item.
            </div>
            <strong class="text-dark d-block mb-1 mt-2">
                <i class="bi bi-shield-lock-fill text-primary me-1"></i>Claimant's answer:
            </strong>
            <div class="p-2.5 bg-white rounded border text-dark fw-bold">
                "${escapeHtml(c.providedProof)}"
            </div>
            <div class="fw-semibold text-dark mt-2 mb-1">
                <i class="bi bi-question-circle text-primary me-1"></i>Does this answer correctly describe the item you found?
            </div>
        </div>

        ${isMoreInfo ? `
            <div class="p-2.5 bg-warning bg-opacity-10 text-dark rounded border small mb-3">
                <i class="bi bi-hourglass-split text-warning me-1"></i>
                <strong>You requested more info:</strong> "${escapeHtml(c.founderFeedback || 'Please provide more details')}". Awaiting claimant response.
            </div>
        ` : ''}
        
        ${(isPending || isMoreInfo) ? `
            <!-- Primary Options for Founder: Accept or Reject -->
            <div class="d-flex flex-wrap gap-2 pt-2 border-top">
                <button class="btn btn-sm btn-success fw-bold flex-fill py-2" onclick="bootstrap.Modal.getInstance(document.getElementById('receivedClaimDetailModal')).hide(); openApproveClaimModal('${c.claimId}')">
                    <i class="bi bi-check2-circle me-1"></i>✓ Approve Claim
                </button>
                <button class="btn btn-sm btn-outline-danger fw-bold flex-fill py-2" onclick="bootstrap.Modal.getInstance(document.getElementById('receivedClaimDetailModal')).hide(); openRejectModal('${c.claimId}')">
                    <i class="bi bi-x-circle me-1"></i>✕ Reject Claim
                </button>
                <button class="btn btn-sm btn-outline-warning text-dark fw-bold py-2" onclick="bootstrap.Modal.getInstance(document.getElementById('receivedClaimDetailModal')).hide(); openRequestInfoModal('${c.claimId}')">
                    <i class="bi bi-question-circle me-1"></i>Request More Info
                </button>
            </div>
        ` : isApproved ? `
            <div class="p-2.5 bg-success bg-opacity-10 text-success rounded border small mb-3">
                <div class="fw-bold mb-1"><i class="bi bi-check-circle-fill me-1"></i>Claim Approved</div>
                <div class="text-dark small">Ownership verified. Chat is now unlocked so you can coordinate the return.</div>
            </div>
            <div class="d-flex justify-content-end">
                <button class="btn btn-primary fw-bold" onclick="bootstrap.Modal.getInstance(document.getElementById('receivedClaimDetailModal')).hide(); openClaimChat('${c.claimId}')">
                    <i class="bi bi-chat-dots-fill me-1"></i>💬 Open Match Chat
                </button>
            </div>
        ` : `
            <div class="p-2.5 bg-danger bg-opacity-10 text-danger rounded border small">
                <div class="fw-bold mb-1"><i class="bi bi-x-circle-fill me-1"></i>Claim Rejected</div>
                <div class="text-dark">Reason: ${escapeHtml(c.rejectionReason || 'Details did not match')}</div>
            </div>
        `}
    `;

    let modalEl = document.getElementById("receivedClaimDetailModal");
    if (modalEl) {
        let bsModal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        bsModal.show();
    }
}

function openClaimChat(claimId) {
    let claim = getClaims().find(c => c.claimId === claimId);
    if (!claim) {
        alert("Could not load this claim conversation.");
        return;
    }

    let reports = getReports();
    let linkedReport = reports.find(r => r.id === claim.itemId);
    if (!linkedReport) {
        alert("Could not find the report connected to this claim.");
        return;
    }

    let lostReport;
    let foundReport;
    if (linkedReport.type === "found") {
        foundReport = linkedReport;
        lostReport = reports.find(r =>
            r.type === "lost" &&
            r.postedByEmail &&
            claim.claimedByEmail &&
            r.postedByEmail.toLowerCase().trim() === claim.claimedByEmail.toLowerCase().trim()
        );
    } else {
        lostReport = linkedReport;
        foundReport = reports.find(r =>
            r.type === "found" &&
            r.postedByEmail &&
            claim.reporterEmail &&
            r.postedByEmail.toLowerCase().trim() === claim.reporterEmail.toLowerCase().trim()
        );
    }

    if (!lostReport || !foundReport) {
        alert("Could not find both reports for this match chat.");
        return;
    }

    openOrCreateChat(lostReport.id, foundReport.id);
}

// -------------------------------------------------------------
// Founder Option: Approve Ownership Claim (No Meeting Form)
// -------------------------------------------------------------
function openApproveClaimModal(claimId) {
    let claims = getClaims();
    let claim = claims.find(c => c.claimId === claimId);
    if (!claim) return;

    let claimIdInput = document.getElementById("modal-approve-claim-id");
    if (claimIdInput) claimIdInput.value = claimId;

    let displayBox = document.getElementById("modal-approve-claimant-display");
    if (displayBox) {
        displayBox.innerHTML = `
            <div class="mb-1"><strong>Item:</strong> <span class="text-primary fw-bold">${escapeHtml(claim.itemName)}</span></div>
            <div class="mb-1"><strong>Claimant:</strong> ${escapeHtml(claim.claimedBy)} (${escapeHtml(claim.claimedByEmail)})</div>
            <div class="p-2.5 bg-white rounded border mt-2">
                <strong class="text-dark d-block mb-1"><i class="bi bi-shield-lock-fill text-primary me-1"></i>Claimant's Submitted Hidden Detail:</strong>
                <div class="text-dark fw-bold fs-6">"${escapeHtml(claim.providedProof)}"</div>
            </div>
            <div class="fw-semibold text-dark mt-2">
                <i class="bi bi-question-circle text-primary me-1"></i>Does this information correctly identify the item you found?
            </div>
        `;
    }

    let modalEl = document.getElementById("approveClaimModal");
    if (modalEl) {
        let modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    }
}

function handleApproveClaimSubmit(event) {
    event.preventDefault();
    let claimId = document.getElementById("modal-approve-claim-id").value;

    let claims = getClaims();
    let claim = claims.find(c => c.claimId === claimId);
    if (!claim) return;

    // Update claim status to "Approved & Meeting Scheduled" (to ensure compatibility with existing chat checks)
    updateClaimStatus(claimId, "Approved & Meeting Scheduled");

    // Send notification to Claimant (Person who lost the item)
    sendNotification({
        id: "NOTIF-" + Date.now(),
        recipientEmail: claim.claimedByEmail,
        senderName: claim.reporter,
        senderEmail: claim.reporterEmail,
        itemName: claim.itemName,
        message: `🎉 Claim Approved! Founder ${claim.reporter} verified your ownership for "${claim.itemName}". Chat is now unlocked so you can coordinate the return.`,
        date: new Date().toLocaleString(),
        type: "claim_approved",
        claimId: claimId
    });

    let modalEl = document.getElementById("approveClaimModal");
    if (modalEl) {
        let modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
    }

    // Open chat for this claim directly
    openClaimChat(claimId);
}

function openRejectModalFromApprove() {
    let claimIdInput = document.getElementById("modal-approve-claim-id");
    let claimId = claimIdInput ? claimIdInput.value : "";
    if (claimId) {
        openRejectModal(claimId);
    }
}

// -------------------------------------------------------------
// Founder Option 1: Accept & Schedule Meeting
// -------------------------------------------------------------
function openScheduleModal(claimId) {
    let claims = getClaims();
    let claim = claims.find(c => c.claimId === claimId);
    if (!claim) return;

    let claimIdInput = document.getElementById("modal-claim-id");
    if (claimIdInput) claimIdInput.value = claimId;

    // Reset location select and custom location input
    let meetingLocationSelect = document.getElementById("meeting-location");
    if (meetingLocationSelect) {
        meetingLocationSelect.value = "";
    }
    let customContainer = document.getElementById("custom-location-container");
    let customInput = document.getElementById("custom-meeting-location");
    if (customContainer) customContainer.classList.add("d-none");
    if (customInput) {
        customInput.value = "";
        customInput.required = false;
    }

    let displayBox = document.getElementById("modal-claimant-details-display");
    if (displayBox) {
        displayBox.innerHTML = `
            <div class="mb-1"><strong>Item:</strong> <span class="text-primary fw-bold">${claim.itemName}</span></div>
            <div class="mb-1"><strong>Claimant:</strong> ${claim.claimedBy} (${claim.claimedByEmail})</div>
            <div class="p-2 bg-white rounded border mt-2">
                <strong class="text-dark">Submitted Hidden Details:</strong>
                <div class="text-primary fw-bold mt-1">"${claim.providedProof}"</div>
            </div>
        `;
    }

    let modalEl = document.getElementById("scheduleMeetingModal");
    if (modalEl) {
        let modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    }
}

function handleScheduleSubmit(event) {
    event.preventDefault();
    let claimId = document.getElementById("modal-claim-id").value;
    let location = document.getElementById("meeting-location").value;
    if (location === "Other") {
        location = document.getElementById("custom-meeting-location").value.trim();
        if (!location) {
            alert("Please enter a custom meeting location.");
            return;
        }
    }
    let time = document.getElementById("meeting-time").value;
    let note = document.getElementById("meeting-note").value;

    let claims = getClaims();
    let claim = claims.find(c => c.claimId === claimId);
    if (!claim) return;

    let meetingDetails = { location: location, time: time, note: note };

    // Update claim status to "Approved & Meeting Scheduled"
    updateClaimStatus(claimId, "Approved & Meeting Scheduled", { meetingDetails: meetingDetails });

    // Send notification back to Claimant (Person who lost the item)
    sendNotification({
        id: "NOTIF-" + Date.now(),
        recipientEmail: claim.claimedByEmail,
        senderName: claim.reporter,
        senderEmail: claim.reporterEmail,
        itemName: claim.itemName,
        message: `🎉 Claim Approved! Founder ${claim.reporter} verified your hidden details for "${claim.itemName}". Meeting scheduled at: ${location} on ${time}. Instructions: ${note}`,
        date: new Date().toLocaleString(),
        type: "claim_approved",
        claimId: claimId
    });

    alert("Meeting scheduled successfully! Notification sent to claimant (" + claim.claimedBy + ").");

    let modalEl = document.getElementById("scheduleMeetingModal");
    if (modalEl) {
        let modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
    }

    window.location.reload();
}

// -------------------------------------------------------------
// Founder Option 2: Request More Information / Correct Details
// -------------------------------------------------------------
function openRequestInfoModal(claimId) {
    let claims = getClaims();
    let claim = claims.find(c => c.claimId === claimId);
    if (!claim) return;

    let claimIdInput = document.getElementById("modal-request-info-claim-id");
    if (claimIdInput) claimIdInput.value = claimId;

    let displayBox = document.getElementById("modal-request-info-display");
    if (displayBox) {
        displayBox.innerHTML = `
            <div class="mb-1"><strong>Item:</strong> <span class="text-primary fw-bold">${claim.itemName}</span></div>
            <div class="mb-1"><strong>Claimant:</strong> ${claim.claimedBy} (${claim.claimedByEmail})</div>
            <div class="p-2 bg-white rounded border mt-2">
                <strong class="text-dark">Current Hidden Details:</strong>
                <div class="text-dark mt-1">"${claim.providedProof}"</div>
            </div>
        `;
    }

    let msgInput = document.getElementById("request-info-message");
    if (msgInput) msgInput.value = "";

    let modalEl = document.getElementById("requestInfoModal");
    if (modalEl) {
        let modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    }
}

function handleRequestInfoSubmit(event) {
    event.preventDefault();
    let claimId = document.getElementById("modal-request-info-claim-id").value;
    let message = document.getElementById("request-info-message").value.trim();

    if (!message) {
        alert("Please specify what details are missing or needed.");
        return;
    }

    let claims = getClaims();
    let claim = claims.find(c => c.claimId === claimId);
    if (!claim) return;

    // Update claim status to "More Info Requested"
    updateClaimStatus(claimId, "More Info Requested", { founderFeedback: message });

    // Send notification to Claimant
    sendNotification({
        id: "NOTIF-" + Date.now(),
        recipientEmail: claim.claimedByEmail,
        senderName: claim.reporter,
        senderEmail: claim.reporterEmail,
        itemName: claim.itemName,
        message: `⚠️ More Info Needed! Founder ${claim.reporter} requested additional details for "${claim.itemName}": "${message}". Please update details on your Dashboard.`,
        date: new Date().toLocaleString(),
        type: "more_info_requested",
        claimId: claimId
    });

    alert("Request for more information sent to " + claim.claimedBy + "!");

    let modalEl = document.getElementById("requestInfoModal");
    if (modalEl) {
        let modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
    }

    window.location.reload();
}

// -------------------------------------------------------------
// Founder Option 3: Reject Claim
// -------------------------------------------------------------
function openRejectModal(claimId) {
    let claims = getClaims();
    let claim = claims.find(c => c.claimId === claimId);
    if (!claim) return;

    let claimIdInput = document.getElementById("modal-reject-claim-id");
    if (claimIdInput) claimIdInput.value = claimId;

    let displayBox = document.getElementById("modal-reject-display");
    if (displayBox) {
        displayBox.innerHTML = `
            <div class="mb-1"><strong>Item:</strong> <span class="text-primary fw-bold">${claim.itemName}</span></div>
            <div class="mb-1"><strong>Claimant:</strong> ${claim.claimedBy} (${claim.claimedByEmail})</div>
            <div class="p-2 bg-white rounded border mt-2">
                <strong class="text-dark">Submitted Hidden Details:</strong>
                <div class="text-danger fw-medium mt-1">"${claim.providedProof}"</div>
            </div>
        `;
    }

    let modalEl = document.getElementById("rejectClaimModal");
    if (modalEl) {
        let modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    }
}

function handleRejectClaimSubmit(event) {
    event.preventDefault();
    let claimId = document.getElementById("modal-reject-claim-id").value;
    let reason = document.getElementById("reject-reason").value.trim();

    if (!reason) {
        alert("Please enter a reason for rejecting this claim.");
        return;
    }

    let claims = getClaims();
    let claim = claims.find(c => c.claimId === claimId);
    if (!claim) return;

    // Update claim status to "Rejected"
    updateClaimStatus(claimId, "Rejected", { rejectionReason: reason });

    // Send notification to Claimant
    sendNotification({
        id: "NOTIF-" + Date.now(),
        recipientEmail: claim.claimedByEmail,
        senderName: claim.reporter,
        senderEmail: claim.reporterEmail,
        itemName: claim.itemName,
        message: `❌ Claim Rejected! Founder ${claim.reporter} declined your claim for "${claim.itemName}". Reason: "${reason}"`,
        date: new Date().toLocaleString(),
        type: "claim_rejected",
        claimId: claimId
    });

    alert("Claim rejected. Notification sent to " + claim.claimedBy + ".");

    let modalEl = document.getElementById("rejectClaimModal");
    if (modalEl) {
        let modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
    }

    window.location.reload();
}

// -------------------------------------------------------------
// Claimant Resubmission: Update Hidden Details After More Info Request
// -------------------------------------------------------------
function openUpdateDetailsModal(claimId) {
    let claims = getClaims();
    let claim = claims.find(c => c.claimId === claimId);
    if (!claim) return;

    let claimIdInput = document.getElementById("modal-update-claim-id");
    if (claimIdInput) claimIdInput.value = claimId;

    let displayBox = document.getElementById("modal-update-feedback-display");
    if (displayBox) {
        displayBox.innerHTML = `
            <div class="mb-1"><strong>Founder (${claim.reporter}) Asked:</strong></div>
            <div class="fw-medium text-dark">"${claim.founderFeedback || 'Please provide more details.'}"</div>
            <div class="mt-2 text-muted extra-small">Your previous details: "${claim.providedProof}"</div>
        `;
    }

    let inputEl = document.getElementById("update-hidden-details-text");
    if (inputEl) inputEl.value = "";

    let modalEl = document.getElementById("updateHiddenDetailsModal");
    if (modalEl) {
        let modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    }
}

function handleUpdateDetailsSubmit(event) {
    event.preventDefault();
    let claimId = document.getElementById("modal-update-claim-id").value;
    let newDetails = document.getElementById("update-hidden-details-text").value.trim();

    if (!newDetails) {
        alert("Please enter the additional / correct hidden details.");
        return;
    }

    let claims = getClaims();
    let claim = claims.find(c => c.claimId === claimId);
    if (!claim) return;

    // Update claim status back to "Pending Founder Approval" with new details
    updateClaimStatus(claimId, "Pending Founder Approval", { providedProof: newDetails });

    // Send notification to Founder
    sendNotification({
        id: "NOTIF-" + Date.now(),
        recipientEmail: claim.reporterEmail,
        senderName: claim.claimedBy,
        senderEmail: claim.claimedByEmail,
        itemName: claim.itemName,
        message: `🔄 Hidden Details Updated! ${claim.claimedBy} provided updated hidden details for "${claim.itemName}": "${newDetails}". Please review to Accept, Reject, or Request Info.`,
        date: new Date().toLocaleString(),
        type: "claim_request",
        claimId: claimId
    });

    alert("Updated details submitted to Founder (" + claim.reporter + ")! They will re-verify your claim.");

    let modalEl = document.getElementById("updateHiddenDetailsModal");
    if (modalEl) {
        let modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
    }

    window.location.reload();
}

// Render Quick Statistics Cards (Lost Items, Found Items, Potential Matches)
function renderDashboardQuickStats(userEmail) {
    let lostEl = document.getElementById("dash-stat-lost-count");
    let foundEl = document.getElementById("dash-stat-found-count");
    let matchesEl = document.getElementById("dash-stat-matches-count");

    if (!lostEl && !foundEl && !matchesEl) return;

    let reports = typeof getReports === "function" ? getReports() : [];
    let myReports = reports.filter(r => r.postedByEmail && userEmail && r.postedByEmail.toLowerCase().trim() === userEmail.toLowerCase().trim());

    let lostCount = myReports.filter(r => r.type === "lost").length;
    let foundCount = myReports.filter(r => r.type === "found").length;

    // Calculate total potential matches across user's reports using matching.js findMatches
    let totalMatches = 0;
    if (typeof findMatches === "function") {
        myReports.forEach(myReport => {
            let matches = findMatches(myReport, reports);
            let highMatches = matches.filter(m => m.matchScore >= 40);
            totalMatches += highMatches.length;
        });
    }

    if (lostEl) lostEl.innerText = lostCount;
    if (foundEl) foundEl.innerText = foundCount;
    if (matchesEl) matchesEl.innerText = totalMatches;
}

function isReportEligibleForRecovery(item) {
    if (!item || item.type !== "lost" || item.status === "Recovered") return false;

    let currentUser = typeof getCurrentUser === "function" ? getCurrentUser() : null;
    if (currentUser && currentUser.useremail && item.postedByEmail) {
        if (item.postedByEmail.toLowerCase().trim() !== currentUser.useremail.toLowerCase().trim()) {
            return false;
        }
    }

    let claims = typeof getClaims === "function" ? getClaims() : [];
    let chats = typeof getChats === "function" ? getChats() : [];

    // 1. Check if any chat linked to this lost report is verified/approved
    let hasVerifiedChat = chats.some(ch => {
        if (!ch) return false;
        var isVerifiedStatus = (ch.status === "Verified" || ch.status === "Recovery Arranged" || ch.status === "Approved" || ch.status === "Approved & Meeting Scheduled");
        if (!isVerifiedStatus) return false;

        if (sameIdString(ch.lostItemId, item.id)) return true;
        if (ch.lostUserEmail && item.postedByEmail && ch.lostUserEmail.toLowerCase().trim() === item.postedByEmail.toLowerCase().trim() &&
            ch.lostItemName && item.itemName && ch.lostItemName.toLowerCase().trim() === item.itemName.toLowerCase().trim()) {
            return true;
        }
        return false;
    });

    if (hasVerifiedChat) return true;

    // 2. Check if any claim submitted by this lost item owner is approved/verified
    let hasApprovedClaim = claims.some(c => {
        if (!c) return false;
        var isApprovedStatus = (c.status === "Approved & Meeting Scheduled" || c.status === "Verified" || c.status === "Recovery Arranged" || c.status === "Approved");
        if (!isApprovedStatus) return false;

        // Direct ID match
        if (sameIdString(c.itemId, item.id) || sameIdString(c.lostItemId, item.id) || sameIdString(c.targetItemId, item.id)) return true;

        // Claimant email match (lost item owner) + item name match
        if (c.claimedByEmail && item.postedByEmail && c.claimedByEmail.toLowerCase().trim() === item.postedByEmail.toLowerCase().trim()) {
            if (c.itemName && item.itemName && c.itemName.toLowerCase().trim() === item.itemName.toLowerCase().trim()) return true;
        }

        return false;
    });

    return hasApprovedClaim;
}

function confirmMyReportRecovery(reportId) {
    if (!reportId) return;

    let reports = typeof getReports === "function" ? getReports() : [];
    let rep = reports.find(r => r.id === reportId);
    if (!rep || rep.status === "Recovered") return;

    rep.status = "Recovered";

    let chats = typeof getChats === "function" ? getChats() : [];
    let linkedChat = chats.find(c => c.lostItemId === reportId || c.foundItemId === reportId);
    if (linkedChat) {
        if (typeof updateChatStatus === "function") {
            updateChatStatus(linkedChat.chatId, "Recovered");
        }
        let otherId = (linkedChat.lostItemId === reportId) ? linkedChat.foundItemId : linkedChat.lostItemId;
        let otherRep = reports.find(r => r.id === otherId);
        if (otherRep && otherRep.status !== "Recovered") {
            otherRep.status = "Recovered";
        }
    }

    if (typeof saveReports === "function") {
        saveReports(reports);
    } else {
        localStorage.setItem("campus_reports", JSON.stringify(reports));
    }

    let recoveredStatEl = document.getElementById("stat-recovered");
    if (recoveredStatEl) {
        let count = reports.filter(r => r.type === "lost" && r.status === "Recovered").length;
        recoveredStatEl.innerText = count;
    }

    let currentUser = typeof getCurrentUser === "function" ? getCurrentUser() : null;
    if (currentUser && currentUser.useremail) {
        if (typeof renderMyReports === "function") {
            renderMyReports(currentUser.useremail);
        }
        if (typeof renderMyReportsPage === "function") {
            renderMyReportsPage(currentUser.useremail);
        }
    }
}

function renderMyReports(userEmail) {
    let legacyContainer = document.getElementById("my-lost-container");
    let lostContainer = document.getElementById("my-lost-items-container");
    let foundContainer = document.getElementById("my-found-items-container");

    let currentUser = (typeof getCurrentUser === "function") ? getCurrentUser() : null;
    let showDeleteBtn = (typeof isAdminUser === "function") && currentUser && isAdminUser(currentUser);

    let reports = getReports();
    let myReports = reports.filter(r => r.postedByEmail && userEmail && r.postedByEmail.toLowerCase().trim() === userEmail.toLowerCase().trim());

    let lostItems = myReports.filter(r => r.type === "lost");
    let foundItems = myReports.filter(r => r.type === "found");

    // Populate legacy container if present
    if (legacyContainer) {
        if (myReports.length === 0) {
            legacyContainer.innerHTML = `<p class="text-muted py-2 mb-0">No reports submitted yet.</p>`;
        } else {
            legacyContainer.innerHTML = myReports.map(item => `
                <div class="card p-3 mb-3 border shadow-sm rounded-3">
                    <div class="d-flex justify-content-between align-items-center flex-wrap">
                        <div>
                            <span class="badge ${item.type === 'lost' ? 'badge-lost' : 'badge-found'} mb-1">${item.type.toUpperCase()}</span>
                            <h6 class="fw-bold mb-0">${escapeHtml(item.itemName)}</h6>
                            <small class="text-muted">Zone: ${item.zone} | Date: ${item.date}</small>
                        </div>
                        <div>
                            <a href="matches.html?id=${item.id}" class="btn btn-sm btn-outline-primary me-2">View Matches</a>
                            ${showDeleteBtn ? `<button class="btn btn-sm btn-outline-danger" onclick="removeReport('${item.id}')">Delete</button>` : ''}
                        </div>
                    </div>
                </div>
            `).join('');
        }
    }

    // Render "Your Lost Items" section
    if (lostContainer) {
        if (lostItems.length === 0) {
            lostContainer.innerHTML = `<div class="p-3 bg-light rounded-3 text-muted small text-center"><i class="bi bi-inbox me-1"></i>You haven't reported any lost items yet.</div>`;
        } else {
            lostContainer.innerHTML = lostItems.map(item => {
                let matches = (typeof findMatches === "function") ? findMatches(item, reports).filter(m => m.matchScore >= 40) : [];
                let isEligible = isReportEligibleForRecovery(item);
                let isRecovered = item.status === "Recovered";

                return `
                    <div class="card user-item-card p-2.5 shadow-sm border">
                        <div class="d-flex flex-column h-100 justify-content-between">
                            <div>
                                <div class="d-flex align-items-start gap-2 mb-2">
                                    ${item.image && !item.image.includes("placeholder") ? `
                                        <img src="${item.image}" alt="${escapeHtml(item.itemName)}" class="rounded border flex-shrink-0" style="width: 46px; height: 46px; object-fit: cover;">
                                    ` : `
                                        <div class="rounded bg-light d-flex align-items-center justify-content-center border flex-shrink-0" style="width: 46px; height: 46px;">
                                            <i class="bi bi-tag text-muted fs-5"></i>
                                        </div>
                                    `}
                                    <div class="flex-grow-1 min-w-0">
                                        <div class="d-flex align-items-center flex-wrap gap-1 mb-1">
                                            <span class="badge badge-lost rounded-pill px-2 py-0.5" style="font-size: 0.68rem;">LOST</span>
                                            <span class="badge bg-secondary-subtle text-light border border-secondary-subtle px-2 py-0.5" style="font-size: 0.68rem;">${escapeHtml(item.category)}</span>
                                            ${item.color ? `<span class="badge bg-dark-subtle text-light border border-secondary-subtle px-2 py-0.5" style="font-size: 0.68rem;">${escapeHtml(item.color)}</span>` : ''}
                                        </div>
                                        <h6 class="fw-bold mb-1 text-dark text-truncate" title="${escapeHtml(item.itemName)}" style="font-size: 0.88rem;">${escapeHtml(item.itemName)}</h6>
                                        <div class="extra-small text-muted text-truncate" title="${escapeHtml(item.zone)}">
                                            <i class="bi bi-geo-alt-fill text-cyan me-1"></i>${escapeHtml(item.zone)}
                                        </div>
                                        <div class="extra-small text-muted">
                                            <i class="bi bi-calendar-event me-1"></i>${item.date}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <div class="pt-2 border-top mt-1 d-flex align-items-center justify-content-between gap-1 flex-wrap">
                                    ${matches.length > 0 ? `
                                        <a href="matches.html?id=${item.id}" class="btn btn-sm btn-primary fw-bold rounded-pill px-2.5 py-1" style="font-size: 0.75rem;">
                                            <i class="bi bi-cpu me-1"></i>Matches (${matches.length})
                                        </a>
                                    ` : `
                                        <a href="matches.html?id=${item.id}" class="btn btn-sm btn-outline-primary fw-semibold rounded-pill px-2.5 py-1" style="font-size: 0.75rem;">
                                            <i class="bi bi-search me-1"></i>View Matches
                                        </a>
                                    `}
                                    ${showDeleteBtn ? `
                                        <button type="button" class="btn btn-sm btn-outline-danger rounded-circle p-0 d-inline-flex align-items-center justify-content-center" style="width: 30px; height: 30px;" onclick="removeReport('${item.id}')" title="Delete report">
                                            <i class="bi bi-trash3" style="font-size: 0.8rem;"></i>
                                        </button>
                                    ` : ''}
                                </div>
                                ${isRecovered ? `
                                    <div class="mt-2 pt-1 border-top d-flex align-items-center justify-content-between">
                                        <span class="badge bg-success-subtle text-success border border-success-subtle px-2 py-0.5 rounded-pill fw-bold" style="font-size: 0.7rem;">
                                            <i class="bi bi-patch-check-fill me-1"></i>🎉 Item Recovered
                                        </span>
                                    </div>
                                ` : (isEligible ? `
                                    <div class="mt-2 pt-1.5 border-top d-flex align-items-center justify-content-between gap-1 p-1.5 rounded-3" style="background-color: rgba(25, 135, 84, 0.08); border: 1px dashed rgba(25, 135, 84, 0.3);">
                                        <span class="extra-small fw-semibold text-dark">Received?</span>
                                        <button type="button" class="btn btn-sm btn-success fw-bold rounded-pill px-2 py-0.5" style="font-size: 0.72rem;" onclick="confirmMyReportRecovery('${item.id}')">
                                            Yes, I received it
                                        </button>
                                    </div>
                                ` : '')}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    // Render "Your Found Items" section
    if (foundContainer) {
        if (foundItems.length === 0) {
            foundContainer.innerHTML = `<div class="p-3 bg-light rounded-3 text-muted small text-center"><i class="bi bi-inbox me-1"></i>You haven't reported any found items yet.</div>`;
        } else {
            foundContainer.innerHTML = foundItems.map(item => {
                let matches = (typeof findMatches === "function") ? findMatches(item, reports).filter(m => m.matchScore >= 40) : [];
                let isEligible = isReportEligibleForRecovery(item);
                let isRecovered = item.status === "Recovered";

                return `
                    <div class="card user-item-card p-2.5 shadow-sm border">
                        <div class="d-flex flex-column h-100 justify-content-between">
                            <div>
                                <div class="d-flex align-items-start gap-2 mb-2">
                                    ${item.image && !item.image.includes("placeholder") ? `
                                        <img src="${item.image}" alt="${escapeHtml(item.itemName)}" class="rounded border flex-shrink-0" style="width: 46px; height: 46px; object-fit: cover;">
                                    ` : `
                                        <div class="rounded bg-light d-flex align-items-center justify-content-center border flex-shrink-0" style="width: 46px; height: 46px;">
                                            <i class="bi bi-check-circle text-success fs-5"></i>
                                        </div>
                                    `}
                                    <div class="flex-grow-1 min-w-0">
                                        <div class="d-flex align-items-center flex-wrap gap-1 mb-1">
                                            <span class="badge badge-found rounded-pill px-2 py-0.5" style="font-size: 0.68rem;">FOUND</span>
                                            <span class="badge bg-secondary-subtle text-light border border-secondary-subtle px-2 py-0.5" style="font-size: 0.68rem;">${escapeHtml(item.category)}</span>
                                            ${item.color ? `<span class="badge bg-dark-subtle text-light border border-secondary-subtle px-2 py-0.5" style="font-size: 0.68rem;">${escapeHtml(item.color)}</span>` : ''}
                                        </div>
                                        <h6 class="fw-bold mb-1 text-dark text-truncate" title="${escapeHtml(item.itemName)}" style="font-size: 0.88rem;">${escapeHtml(item.itemName)}</h6>
                                        <div class="extra-small text-muted text-truncate" title="${escapeHtml(item.zone)}">
                                            <i class="bi bi-geo-alt-fill text-success me-1"></i>${escapeHtml(item.zone)}
                                        </div>
                                        <div class="extra-small text-muted">
                                            <i class="bi bi-calendar-event me-1"></i>${item.date}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <div class="pt-2 border-top mt-1 d-flex align-items-center justify-content-between gap-1 flex-wrap">
                                    ${matches.length > 0 ? `
                                        <a href="matches.html?id=${item.id}" class="btn btn-sm btn-success fw-bold rounded-pill px-2.5 py-1" style="font-size: 0.75rem;">
                                            <i class="bi bi-cpu me-1"></i>Matches (${matches.length})
                                        </a>
                                    ` : `
                                        <a href="matches.html?id=${item.id}" class="btn btn-sm btn-outline-success fw-semibold rounded-pill px-2.5 py-1" style="font-size: 0.75rem;">
                                            <i class="bi bi-search me-1"></i>View Matches
                                        </a>
                                    `}
                                    ${showDeleteBtn ? `
                                        <button type="button" class="btn btn-sm btn-outline-danger rounded-circle p-0 d-inline-flex align-items-center justify-content-center" style="width: 30px; height: 30px;" onclick="removeReport('${item.id}')" title="Delete report">
                                            <i class="bi bi-trash3" style="font-size: 0.8rem;"></i>
                                        </button>
                                    ` : ''}
                                </div>
                                ${isRecovered ? `
                                    <div class="mt-2 pt-1 border-top d-flex align-items-center justify-content-between">
                                        <span class="badge bg-success-subtle text-success border border-success-subtle px-2 py-0.5 rounded-pill fw-bold" style="font-size: 0.7rem;">
                                            <i class="bi bi-patch-check-fill me-1"></i>🎉 Item Recovered
                                        </span>
                                    </div>
                                ` : (isEligible ? `
                                    <div class="mt-2 pt-1.5 border-top d-flex align-items-center justify-content-between gap-1 p-1.5 rounded-3" style="background-color: rgba(25, 135, 84, 0.08); border: 1px dashed rgba(25, 135, 84, 0.3);">
                                        <span class="extra-small fw-semibold text-dark">Received?</span>
                                        <button type="button" class="btn btn-sm btn-success fw-bold rounded-pill px-2 py-0.5" style="font-size: 0.72rem;" onclick="confirmMyReportRecovery('${item.id}')">
                                            Yes, I received it
                                        </button>
                                    </div>
                                ` : '')}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }
}

function removeReport(id) {
    if (confirm("Delete this report?")) {
        deleteReport(id);
        window.location.reload();
    }
}

// -------------------------------------------------------------
// 6. ADMIN LOGIC
// -------------------------------------------------------------
function initAdminPage() {
    // ── Access guard: only whitelisted admins may see this page ──
    let currentUser = getCurrentUser();
    if (!currentUser) {
        alert("Please log in to continue.");
        window.location.href = "login.html";
        return;
    }
    if (!isAdminUser(currentUser)) {
        alert("Access denied. This page is restricted to administrators.");
        window.location.href = "index.html";
        return;
    }

    renderAdminStats();
    renderAdminReports();
    renderAdminUsers();
    renderAdminClaims();

    let resetBtn = document.getElementById("btn-reset-sample-data");
    if (resetBtn) {
        resetBtn.onclick = () => {
            if (confirm("Reset dataset back to sample default items?")) {
                resetData();
                window.location.reload();
            }
        };
    }
}

function renderAdminStats() {
    let statsRow = document.getElementById("admin-stats-row");
    if (!statsRow) return;

    let reports = getReports();
    let users = getUsers().filter(u => u.useremail);
    let claims = getClaims();

    let lostCount = reports.filter(r => r.type === "lost").length;
    let foundCount = reports.filter(r => r.type === "found").length;
    let pendingClaims = claims.filter(c => c.status === "Pending Founder Approval" || c.status === "Pending Approval").length;
    let resolvedClaims = claims.filter(c => c.status === "Approved & Meeting Scheduled").length;

    let stats = [
        { label: "Total Users", value: users.length, icon: "bi-people-fill", color: "primary" },
        { label: "Reports (Lost / Found)", value: `${lostCount} / ${foundCount}`, icon: "bi-clipboard-data", color: "warning" },
        { label: "Pending Claims", value: pendingClaims, icon: "bi-hourglass-split", color: "danger" },
        { label: "Resolved Recoveries", value: resolvedClaims, icon: "bi-check-circle-fill", color: "success" }
    ];

    statsRow.innerHTML = stats.map(s => `
        <div class="col-6 col-lg-3">
            <div class="bg-white rounded-3 border shadow-sm p-3 h-100">
                <div class="d-flex align-items-center gap-3">
                    <div class="rounded-circle bg-${s.color} bg-opacity-10 text-${s.color} d-flex align-items-center justify-content-center" style="width:44px; height:44px; flex-shrink:0;">
                        <i class="bi ${s.icon} fs-5"></i>
                    </div>
                    <div>
                        <div class="fs-4 fw-bold lh-1">${s.value}</div>
                        <div class="small text-muted">${s.label}</div>
                    </div>
                </div>
            </div>
        </div>
    `).join("");
}

function renderAdminReports() {
    let tbody = document.getElementById("admin-table-body");
    if (!tbody) return;

    let searchInput = document.getElementById("admin-report-search");
    let typeFilter = document.getElementById("admin-report-type-filter");
    let query = (searchInput ? searchInput.value : "").toLowerCase().trim();
    let typeVal = typeFilter ? typeFilter.value : "all";

    let reports = getReports().filter(r => {
        let matchesType = typeVal === "all" || r.type === typeVal;
        let matchesQuery = !query ||
            (r.itemName && r.itemName.toLowerCase().includes(query)) ||
            (r.postedBy && r.postedBy.toLowerCase().includes(query)) ||
            (r.zone && r.zone.toLowerCase().includes(query));
        return matchesType && matchesQuery;
    });

    tbody.innerHTML = "";
    if (reports.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">No reports match.</td></tr>`;
    }
    reports.forEach(r => {
        tbody.innerHTML += `
            <tr>
                <td><strong>${r.id}</strong></td>
                <td><span class="badge ${r.type === 'lost' ? 'badge-lost' : 'badge-found'}">${r.type.toUpperCase()}</span></td>
                <td>${escapeHtml(r.itemName)}</td>
                <td><span class="badge bg-light text-dark border">${escapeHtml(r.postedBy)}</span></td>
                <td>${escapeHtml(r.zone)}</td>
                <td>${escapeHtml(r.date)}</td>
                <td>
                    <button class="btn btn-sm btn-outline-danger" onclick="removeReport('${r.id}')"><i class="bi bi-trash"></i> Delete</button>
                </td>
            </tr>
        `;
    });

    if (searchInput) searchInput.oninput = renderAdminReports;
    if (typeFilter) typeFilter.onchange = renderAdminReports;
}

function renderAdminUsers() {
    let tbody = document.getElementById("admin-users-table-body");
    if (!tbody) return;

    let users = getUsers().filter(u => u.useremail);
    tbody.innerHTML = "";
    if (users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">No registered users.</td></tr>`;
    }
    users.forEach(u => {
        let isAdmin = isAdminUser(u);
        let isBanned = !!u.banned;
        tbody.innerHTML += `
            <tr>
                <td>${escapeHtml(u.username || "—")}</td>
                <td>${escapeHtml(u.useremail)}${isAdmin ? ' <span class="badge bg-warning text-dark ms-1">Admin</span>' : ''}</td>
                <td>${escapeHtml(u.studentId || "—")}</td>
                <td>${escapeHtml(u.department || "—")}</td>
                <td>${isBanned ? '<span class="badge bg-danger">Banned</span>' : '<span class="badge bg-success">Active</span>'}</td>
                <td class="text-end">
                    ${isAdmin ? '' : (isBanned
                        ? `<button class="btn btn-sm btn-outline-success me-1" onclick="adminUnbanUser('${escapeHtml(u.useremail)}')"><i class="bi bi-check-circle"></i> Unban</button>`
                        : `<button class="btn btn-sm btn-outline-warning me-1" onclick="adminBanUser('${escapeHtml(u.useremail)}')"><i class="bi bi-slash-circle"></i> Ban</button>`)}
                    ${isAdmin ? '' : `<button class="btn btn-sm btn-outline-danger" onclick="adminDeleteUser('${escapeHtml(u.useremail)}')"><i class="bi bi-trash"></i> Delete</button>`}
                </td>
            </tr>
        `;
    });
}

function adminBanUser(email) {
    if (!confirm(`Ban ${email}? They won't be able to log in until unbanned.`)) return;
    setUserBanned(email, true);
    renderAdminUsers();
    renderAdminStats();
}

function adminUnbanUser(email) {
    setUserBanned(email, false);
    renderAdminUsers();
    renderAdminStats();
}

function adminDeleteUser(email) {
    if (!confirm(`Permanently delete the account for ${email}? This cannot be undone.`)) return;
    deleteUser(email);
    renderAdminUsers();
    renderAdminStats();
}

function renderAdminClaims() {
    let tbody = document.getElementById("admin-claims-table-body");
    if (!tbody) return;

    let claims = getClaims();
    tbody.innerHTML = "";
    if (claims.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">No claims yet.</td></tr>`;
    }
    claims.forEach(c => {
        let badgeClass = c.status === "Approved & Meeting Scheduled" ? "bg-success"
            : c.status === "Rejected" ? "bg-danger"
            : "bg-warning text-dark";
        tbody.innerHTML += `
            <tr>
                <td><strong>${escapeHtml(c.claimId)}</strong></td>
                <td>${escapeHtml(c.itemName)}</td>
                <td>${escapeHtml(c.claimedBy)}<br><span class="small text-muted">${escapeHtml(c.claimedByEmail)}</span></td>
                <td>${escapeHtml(c.reporter || "—")}<br><span class="small text-muted">${escapeHtml(c.reporterEmail || "")}</span></td>
                <td><span class="badge ${badgeClass}">${escapeHtml(c.status)}</span></td>
                <td>${escapeHtml(c.date || "—")}</td>
            </tr>
        `;
    });
}

function getDefaultImage(cat) {
    if (cat === "Bags") return "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=600&q=80";
    if (cat === "Electronics") return "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=600&q=80";
    if (cat === "Wallets") return "https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=600&q=80";
    return "https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?auto=format&fit=crop&w=600&q=80";
}

// Theme Toggle Helper Functions
function toggleTheme() {
    let isLight = document.documentElement.classList.toggle("light-theme");
    localStorage.setItem("theme", isLight ? "light" : "dark");
    
    // Update icons and tooltips across the page
    updateThemeToggleIcons();
}

function updateThemeToggleIcons() {
    let isLight = document.documentElement.classList.contains("light-theme");
    let toggles = document.querySelectorAll(".btn-theme-toggle");
    toggles.forEach(btn => {
        let icon = btn.querySelector("i");
        if (icon) {
            if (isLight) {
                icon.className = "bi bi-moon-stars";
                btn.title = "Switch to Dark Mode";
            } else {
                icon.className = "bi bi-sun";
                btn.title = "Switch to Light Mode";
            }
        }
    });
}

// Date Formatter Helper
function formatDate(dateStr) {
    if (!dateStr) return "";
    try {
        let parts = dateStr.split("-");
        if (parts.length === 3) {
            let months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            let year = parts[0];
            let month = months[parseInt(parts[1], 10) - 1] || parts[1];
            let day = parseInt(parts[2], 10);
            return `${month} ${day}, ${year}`;
        }
        return dateStr;
    } catch (e) {
        return dateStr;
    }
}

// Smooth Vanilla JS Number Count-Up Animation (Real Application Data)
function animateCountUp(elementId, targetValue) {
    let el = document.getElementById(elementId);
    if (!el) return;
    
    let target = parseInt(targetValue, 10) || 0;
    if (target === 0) {
        el.innerText = "0";
        return;
    }

    let duration = 1200; // ms
    let startTime = null;

    function step(timestamp) {
        if (!startTime) startTime = timestamp;
        let progress = Math.min((timestamp - startTime) / duration, 1);
        
        // Ease out quadratic progression curve
        let easeOutProgress = progress * (2 - progress);
        let current = Math.floor(easeOutProgress * target);
        
        el.innerText = current;

        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            el.innerText = target;
        }
    }

    window.requestAnimationFrame(step);
}

// -------------------------------------------------------------
// HOW IT WORKS — SEQUENTIAL PROCESS TIMELINE ANIMATION
// -------------------------------------------------------------
function initHowItWorksAnimation() {
    let section = document.getElementById("how-it-works-section");
    if (!section) return;

    let observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                section.classList.add("is-visible");

                // Timed Sequential Process Workflow Sequence:
                // Heading: 0ms
                // Step 01 Report: 300ms
                // Line 01 Draw: 900ms
                // Step 02 Smart Match: 1300ms
                // Line 02 Draw: 1900ms
                // Step 03 Verify: 2300ms
                // Line 03 Draw: 2900ms
                // Step 04 Recover: 3300ms

                setTimeout(() => {
                    let col1 = document.getElementById("step-col-1");
                    if (col1) col1.classList.add("step-active");
                }, 300);

                setTimeout(() => {
                    let line1 = document.getElementById("timeline-line-1");
                    if (line1) line1.classList.add("line-active");
                }, 900);

                setTimeout(() => {
                    let col2 = document.getElementById("step-col-2");
                    if (col2) col2.classList.add("step-active");
                }, 1300);

                setTimeout(() => {
                    let line2 = document.getElementById("timeline-line-2");
                    if (line2) line2.classList.add("line-active");
                }, 1900);

                setTimeout(() => {
                    let col3 = document.getElementById("step-col-3");
                    if (col3) col3.classList.add("step-active");
                }, 2300);

                setTimeout(() => {
                    let line3 = document.getElementById("timeline-line-3");
                    if (line3) line3.classList.add("line-active");
                }, 2900);

                setTimeout(() => {
                    let col4 = document.getElementById("step-col-4");
                    if (col4) col4.classList.add("step-active");
                }, 3300);

                observer.unobserve(section);
            }
        });
    }, { threshold: 0.2 });

    observer.observe(section);
}

// -------------------------------------------------------------
// LIGHTWEIGHT CUSTOM THEMED DROPDOWN COMPONENT (#151329 / #6B3FBF)
// -------------------------------------------------------------
function setupCustomSelect(selectId) {
    let nativeSelect = document.getElementById(selectId);
    if (!nativeSelect) return;

    if (nativeSelect.dataset.customized === "true") return;
    nativeSelect.dataset.customized = "true";

    nativeSelect.style.display = "none";

    let wrapper = document.createElement("div");
    wrapper.className = "custom-select-wrapper";

    nativeSelect.parentNode.insertBefore(wrapper, nativeSelect);
    wrapper.appendChild(nativeSelect);

    let trigger = document.createElement("div");
    trigger.className = "custom-select-trigger";
    
    let currentOpt = nativeSelect.options[nativeSelect.selectedIndex] || nativeSelect.options[0];
    let triggerText = document.createElement("span");
    triggerText.className = "trigger-text";
    triggerText.innerText = currentOpt ? currentOpt.text : "";

    let chevron = document.createElement("i");
    chevron.className = "bi bi-chevron-down chevron-icon";

    trigger.appendChild(triggerText);
    trigger.appendChild(chevron);
    wrapper.appendChild(trigger);

    let menu = document.createElement("div");
    menu.className = "custom-select-menu";

    Array.from(nativeSelect.options).forEach(opt => {
        let optionItem = document.createElement("div");
        optionItem.className = `custom-select-option ${opt.selected ? 'is-selected' : ''}`;
        optionItem.innerText = opt.text;
        optionItem.dataset.value = opt.value;

        optionItem.addEventListener("click", (e) => {
            e.stopPropagation();
            
            nativeSelect.value = opt.value;
            triggerText.innerText = opt.text;

            menu.querySelectorAll(".custom-select-option").forEach(el => el.classList.remove("is-selected"));
            optionItem.classList.add("is-selected");

            wrapper.classList.remove("is-open");

            nativeSelect.dispatchEvent(new Event("change"));
        });

        menu.appendChild(optionItem);
    });

    wrapper.appendChild(menu);

    trigger.addEventListener("click", (e) => {
        e.stopPropagation();
        document.querySelectorAll(".custom-select-wrapper.is-open").forEach(w => {
            if (w !== wrapper) w.classList.remove("is-open");
        });
        wrapper.classList.toggle("is-open");
    });
}

// Global click listener to close open custom select menus when clicking outside
document.addEventListener("click", () => {
    document.querySelectorAll(".custom-select-wrapper.is-open").forEach(w => w.classList.remove("is-open"));
});

// -------------------------------------------------------------
// Quick Help / FAQ Accordion Toggle Handler
// -------------------------------------------------------------
function toggleHelpAccordion(cardEl) {
    if (!cardEl) return;
    let isActive = cardEl.classList.contains("active-item");

    // Close all accordion cards in the section
    let allCards = document.querySelectorAll(".help-item-card");
    allCards.forEach(c => {
        c.classList.remove("active-item");
        let body = c.querySelector(".help-item-body");
        if (body) body.style.display = "none";
    });

    // If clicked card was not active, open it
    if (!isActive) {
        cardEl.classList.add("active-item");
        let body = cardEl.querySelector(".help-item-body");
        if (body) body.style.display = "block";
    }
}

// -------------------------------------------------------------
// DEDICATED MY REPORTS PAGE LOGIC (my-reports.html)
// -------------------------------------------------------------
function initMyReportsPage() {
    let currentUser = getCurrentUser();
    let container = document.getElementById("my-reports-grid-container");

    if (!currentUser || !currentUser.useremail) {
        if (container) {
            container.innerHTML = `
                <div class="col-12 text-center py-5">
                    <div class="p-4 bg-white rounded-3 border shadow-sm max-w-md mx-auto" style="max-width: 500px;">
                        <i class="bi bi-person-lock fs-1 text-muted d-block mb-3"></i>
                        <h4 class="fw-bold text-dark mb-2">Please Sign In</h4>
                        <p class="text-muted small mb-4">You must be logged in to view your reports.</p>
                        <a href="login.html" class="btn btn-primary fw-bold px-4 rounded-pill">Sign In</a>
                    </div>
                </div>
            `;
        }
        return;
    }

    renderMyReportsPage(currentUser.useremail);

    let searchInput = document.getElementById("my-reports-search-input");
    let typeFilter = document.getElementById("my-reports-type-filter");
    let catFilter = document.getElementById("my-reports-category-filter");

    function applyFilters() {
        let q = searchInput ? searchInput.value.toLowerCase().trim() : "";
        let t = typeFilter ? typeFilter.value : "all";
        let c = catFilter ? catFilter.value : "all";
        renderMyReportsPage(currentUser.useremail, q, t, c);
    }

    if (searchInput) searchInput.addEventListener("input", applyFilters);
    if (typeFilter) typeFilter.addEventListener("change", applyFilters);
    if (catFilter) catFilter.addEventListener("change", applyFilters);

    setupCustomSelect("my-reports-type-filter");
    setupCustomSelect("my-reports-category-filter");
}

function renderMyReportsPage(userEmail, searchQuery = "", typeQuery = "all", catQuery = "all") {
    let container = document.getElementById("my-reports-grid-container");
    if (!container) return;

    let reports = getReports();
    let myReports = reports.filter(r => r.postedByEmail && userEmail && r.postedByEmail.toLowerCase().trim() === userEmail.toLowerCase().trim());

    if (myReports.length === 0) {
        container.innerHTML = `
            <div class="col-12 text-center py-5">
                <div class="p-4 bg-white rounded-3 border shadow-sm mx-auto" style="max-width: 500px;">
                    <i class="bi bi-inbox fs-1 text-muted d-block mb-3"></i>
                    <h5 class="fw-bold text-dark mb-2">No reports yet</h5>
                    <p class="text-muted small mb-4">You haven't reported any lost or found items.</p>
                    <div class="d-flex justify-content-center gap-2 flex-wrap">
                        <a href="report.html" class="btn btn-lost btn-sm fw-bold px-3">
                            <i class="bi bi-plus-circle me-1"></i>Report Lost Item
                        </a>
                        <a href="report-found.html" class="btn btn-found btn-sm fw-bold px-3">
                            <i class="bi bi-plus-circle me-1"></i>Report Found Item
                        </a>
                    </div>
                </div>
            </div>
        `;
        return;
    }

    let filteredReports = myReports.filter(item => {
        let matchQ = !searchQuery || 
            (item.itemName && item.itemName.toLowerCase().includes(searchQuery)) || 
            (item.description && item.description.toLowerCase().includes(searchQuery)) || 
            (item.zone && item.zone.toLowerCase().includes(searchQuery));
        let matchT = typeQuery === "all" || item.type === typeQuery;
        let matchC = catQuery === "all" || item.category === catQuery;
        return matchQ && matchT && matchC;
    });

    if (filteredReports.length === 0) {
        container.innerHTML = `
            <div class="col-12 text-center py-5 text-muted">
                <i class="bi bi-search fs-3 d-block mb-2"></i>
                No reports match your search criteria.
            </div>
        `;
        return;
    }

    container.innerHTML = filteredReports.map((item, index) => {
        let matches = (typeof findMatches === "function") ? findMatches(item, reports).filter(m => m.matchScore >= 40) : [];
        let isEligible = (typeof isReportEligibleForRecovery === "function") ? isReportEligibleForRecovery(item) : false;
        let isRecovered = item.status === "Recovered";
        let animDelay = Math.min(index * 90, 900);

        return `
            <div class="col-12 col-md-6 col-lg-4 my-reports-card-anim" style="animation-delay: ${animDelay}ms;">
                <div class="card user-item-card p-3 h-100 shadow-sm border d-flex flex-column justify-content-between">
                    <div>
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <span class="badge ${item.type === 'lost' ? 'badge-lost' : 'badge-found'} rounded-pill px-2.5 py-1" style="font-size: 0.72rem;">
                                ${item.type ? item.type.toUpperCase() : 'REPORT'}
                            </span>
                            <button type="button" class="btn btn-sm btn-outline-danger rounded-circle p-0 d-inline-flex align-items-center justify-content-center" style="width: 30px; height: 30px;" onclick="removeReport('${item.id}')" title="Delete report">
                                <i class="bi bi-trash3"></i>
                            </button>
                        </div>
                        ${item.image && !item.image.includes("placeholder") ? `
                            <img src="${item.image}" alt="${escapeHtml(item.itemName)}" class="rounded border w-100 mb-3" style="height: 150px; object-fit: cover;">
                        ` : `
                            <div class="rounded bg-light d-flex align-items-center justify-content-center border w-100 mb-3" style="height: 150px;">
                                <i class="bi ${item.type === 'found' ? 'bi-check-circle text-success' : 'bi-tag text-muted'} fs-1"></i>
                            </div>
                        `}
                        <h5 class="fw-bold mb-1 text-dark">${escapeHtml(item.itemName)}</h5>
                        <p class="small text-muted mb-2 line-clamp-2">${escapeHtml(item.description || 'No description provided.')}</p>
                        <div class="d-flex flex-wrap gap-1 mb-2">
                            <span class="badge bg-secondary-subtle text-light border border-secondary-subtle extra-small">${escapeHtml(item.category)}</span>
                            ${item.color ? `<span class="badge bg-dark-subtle text-light border border-secondary-subtle extra-small">${escapeHtml(item.color)}</span>` : ''}
                        </div>
                        <div class="extra-small text-muted mb-3">
                            <i class="bi bi-geo-alt-fill ${item.type === 'found' ? 'text-success' : 'text-cyan'} me-1"></i>${escapeHtml(item.zone)} &nbsp;|&nbsp;
                            <i class="bi bi-calendar-event me-1"></i>${item.date}
                        </div>
                    </div>
                    <div>
                        <div class="d-flex align-items-center justify-content-between gap-2 pt-2 border-top">
                            ${matches.length > 0 ? `
                                <a href="matches.html?id=${item.id}" class="btn btn-sm ${item.type === 'found' ? 'btn-success' : 'btn-primary'} fw-bold rounded-pill px-3 flex-grow-1 text-center">
                                    <i class="bi bi-cpu me-1"></i>Matches (${matches.length})
                                </a>
                            ` : `
                                <a href="matches.html?id=${item.id}" class="btn btn-sm ${item.type === 'found' ? 'btn-outline-success' : 'btn-outline-primary'} fw-semibold rounded-pill px-3 flex-grow-1 text-center">
                                    <i class="bi bi-search me-1"></i>View Matches
                                </a>
                            `}
                        </div>
                        ${isRecovered ? `
                            <div class="mt-2 pt-2 border-top d-flex align-items-center justify-content-center">
                                <span class="badge bg-success-subtle text-success border border-success-subtle px-2.5 py-1 rounded-pill fw-bold" style="font-size: 0.75rem;">
                                    <i class="bi bi-patch-check-fill me-1"></i>🎉 Item Recovered
                                </span>
                            </div>
                        ` : (isEligible ? `
                            <div class="mt-2 pt-2 border-top d-flex align-items-center justify-content-between flex-wrap gap-2 p-2 rounded-3" style="background-color: rgba(25, 135, 84, 0.08); border: 1px dashed rgba(25, 135, 84, 0.3);">
                                <span class="small fw-semibold text-dark">🎉 Did you receive this item?</span>
                                <button type="button" class="btn btn-sm btn-success fw-bold rounded-pill px-3 shadow-sm" onclick="confirmMyReportRecovery('${item.id}')">
                                    Yes, I received it
                                </button>
                            </div>
                        ` : '')}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// -------------------------------------------------------------
// DEDICATED ALL CAMPUS REPORTS PAGE LOGIC (all-reports.html)
// -------------------------------------------------------------
function initAllReportsPage() {
    renderAllReportsPage();

    let searchInput = document.getElementById("all-reports-search-input");
    let typeFilter = document.getElementById("all-reports-type-filter");
    let catFilter = document.getElementById("all-reports-category-filter");

    function applyFilters() {
        let q = searchInput ? searchInput.value.toLowerCase().trim() : "";
        let t = typeFilter ? typeFilter.value : "all";
        let c = catFilter ? catFilter.value : "all";
        renderAllReportsPage(q, t, c);
    }

    if (searchInput) searchInput.addEventListener("input", applyFilters);
    if (typeFilter) typeFilter.addEventListener("change", applyFilters);
    if (catFilter) catFilter.addEventListener("change", applyFilters);

    setupCustomSelect("all-reports-type-filter");
    setupCustomSelect("all-reports-category-filter");
}

function renderAllReportsPage(searchQuery = "", typeQuery = "all", catQuery = "all") {
    let container = document.getElementById("all-reports-grid-container");
    if (!container) return;

    let reports = getReports();
    let currentUser = getCurrentUser();
    let myEmail = currentUser ? currentUser.useremail.toLowerCase().trim() : "";

    if (reports.length === 0) {
        container.innerHTML = `
            <div class="col-12 text-center py-5">
                <div class="p-4 bg-white rounded-3 border shadow-sm mx-auto" style="max-width: 500px;">
                    <i class="bi bi-inbox fs-1 text-muted d-block mb-3"></i>
                    <h5 class="fw-bold text-dark mb-2">No reports found</h5>
                    <p class="text-muted small mb-4">There are currently no lost or found reports in the system.</p>
                    <div class="d-flex justify-content-center gap-2 flex-wrap">
                        <a href="report.html" class="btn btn-lost btn-sm fw-bold px-3">
                            <i class="bi bi-plus-circle me-1"></i>Report Lost Item
                        </a>
                        <a href="report-found.html" class="btn btn-found btn-sm fw-bold px-3">
                            <i class="bi bi-plus-circle me-1"></i>Report Found Item
                        </a>
                    </div>
                </div>
            </div>
        `;
        return;
    }

    let filteredReports = reports.filter(item => {
        let matchQ = !searchQuery || 
            (item.itemName && item.itemName.toLowerCase().includes(searchQuery)) || 
            (item.description && item.description.toLowerCase().includes(searchQuery)) || 
            (item.zone && item.zone.toLowerCase().includes(searchQuery));
        let matchT = typeQuery === "all" || item.type === typeQuery;
        let matchC = catQuery === "all" || item.category === catQuery;
        return matchQ && matchT && matchC;
    });

    if (filteredReports.length === 0) {
        container.innerHTML = `
            <div class="col-12 text-center py-5 text-muted">
                <i class="bi bi-search fs-3 d-block mb-2"></i>
                No campus reports match your search criteria.
            </div>
        `;
        return;
    }

    container.innerHTML = filteredReports.map(item => {
        let isMine = item.postedByEmail && myEmail && item.postedByEmail.toLowerCase().trim() === myEmail;
        let isRecovered = item.status === "Recovered";

        return `
            <div class="col-12 col-md-6 col-lg-4">
                <div class="card user-item-card p-3 h-100 shadow-sm border d-flex flex-column justify-content-between">
                    <div>
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <span class="badge ${item.type === 'lost' ? 'badge-lost' : 'badge-found'} rounded-pill px-2.5 py-1" style="font-size: 0.72rem;">
                                ${item.type ? item.type.toUpperCase() : 'REPORT'}
                            </span>
                            ${isMine ? `
                                <span class="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill px-2 py-0.5 extra-small fw-bold">
                                    <i class="bi bi-person-fill me-1"></i>Your Report
                                </span>
                            ` : ''}
                        </div>
                        ${item.image && !item.image.includes("placeholder") ? `
                            <img src="${item.image}" alt="${escapeHtml(item.itemName)}" class="rounded border w-100 mb-3" style="height: 150px; object-fit: cover;">
                        ` : `
                            <div class="rounded bg-light d-flex align-items-center justify-content-center border w-100 mb-3" style="height: 150px;">
                                <i class="bi ${item.type === 'found' ? 'bi-check-circle text-success' : 'bi-tag text-muted'} fs-1"></i>
                            </div>
                        `}
                        <h5 class="fw-bold mb-1 text-dark">${escapeHtml(item.itemName)}</h5>
                        <p class="small text-muted mb-2 line-clamp-2">${escapeHtml(item.description || 'No description provided.')}</p>
                        <div class="d-flex flex-wrap gap-1 mb-2">
                            <span class="badge bg-secondary-subtle text-light border border-secondary-subtle extra-small">${escapeHtml(item.category)}</span>
                            ${item.color ? `<span class="badge bg-dark-subtle text-light border border-secondary-subtle extra-small">${escapeHtml(item.color)}</span>` : ''}
                        </div>
                        <div class="extra-small text-muted mb-3">
                            <i class="bi bi-geo-alt-fill ${item.type === 'found' ? 'text-success' : 'text-cyan'} me-1"></i>${escapeHtml(item.zone)} &nbsp;|&nbsp;
                            <i class="bi bi-calendar-event me-1"></i>${item.date}
                        </div>
                    </div>
                    <div>
                        <div class="d-flex align-items-center justify-content-between gap-2 pt-2 border-top">
                            <a href="matches.html?id=${item.id}" class="btn btn-sm ${item.type === 'found' ? 'btn-outline-success' : 'btn-outline-primary'} fw-bold rounded-pill px-3 flex-grow-1 text-center">
                                <i class="bi bi-cpu me-1"></i>View Item Matches
                            </a>
                        </div>
                        ${isRecovered ? `
                            <div class="mt-2 pt-2 border-top d-flex align-items-center justify-content-center">
                                <span class="badge bg-success-subtle text-success border border-success-subtle px-2.5 py-1 rounded-pill fw-bold" style="font-size: 0.75rem;">
                                    <i class="bi bi-patch-check-fill me-1"></i>🎉 Item Recovered
                                </span>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// -------------------------------------------------------------
// Campus Insights Data Visualization Controller
// -------------------------------------------------------------
function initCampusInsights() {
    let section = document.getElementById("campus-insights-section");
    if (!section) return;

    let reports = typeof getReports === "function" ? getReports() : [];
    let totalCount = reports.length;

    // 1. Process Category Breakdown
    let catCounts = {};
    reports.forEach(r => {
        let cat = (r.category || "Others").trim();
        cat = cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase();
        catCounts[cat] = (catCounts[cat] || 0) + 1;
    });

    let catList = Object.keys(catCounts).map(name => ({
        name: name,
        count: catCounts[name],
        pct: totalCount > 0 ? Math.round((catCounts[name] / totalCount) * 100) : 0
    }));

    catList.sort((a, b) => b.count - a.count);

    // Default top categories if array empty/small
    if (catList.length === 0) {
        catList = [
            { name: "Electronics", count: 0, pct: 0 },
            { name: "Accessories", count: 0, pct: 0 },
            { name: "Documents", count: 0, pct: 0 },
            { name: "Others", count: 0, pct: 0 }
        ];
    } else if (catList.length < 4) {
        let defaults = ["Electronics", "Accessories", "Documents", "Others"];
        defaults.forEach(d => {
            if (catList.length < 4 && !catList.some(c => c.name.toLowerCase() === d.toLowerCase())) {
                catList.push({ name: d, count: 0, pct: 0 });
            }
        });
    }

    let topCats = catList.slice(0, 4);

    let iconMap = {
        "accessories": { icon: "bi-backpack", boxClass: "icon-purple", pctClass: "text-purple" },
        "wallets": { icon: "bi-wallet2", boxClass: "icon-blue", pctClass: "text-blue" },
        "electronics": { icon: "bi-laptop", boxClass: "icon-cyan", pctClass: "text-cyan" },
        "documents": { icon: "bi-file-earmark-text", boxClass: "icon-amber", pctClass: "text-amber" },
        "clothing": { icon: "bi-bag-check", boxClass: "icon-purple", pctClass: "text-purple" },
        "keys": { icon: "bi-key", boxClass: "icon-cyan", pctClass: "text-cyan" },
        "others": { icon: "bi-box-seam", boxClass: "icon-purple", pctClass: "text-purple" }
    };

    let catContainer = document.getElementById("insights-category-list");
    if (catContainer) {
        catContainer.innerHTML = topCats.map((cat, idx) => {
            let key = cat.name.toLowerCase();
            let conf = iconMap[key] || { icon: "bi-box-seam", boxClass: "icon-purple", pctClass: "text-purple" };
            return `
                <div class="campus-insights-cat-row position-relative">
                    <div class="d-flex align-items-center justify-content-between mb-2">
                        <div class="d-flex align-items-center gap-2.5">
                            <div class="campus-insights-cat-box ${conf.boxClass}">
                                <i class="bi ${conf.icon}"></i>
                            </div>
                            <span class="campus-insights-cat-name">${escapeHtml(cat.name)}</span>
                        </div>
                        <span class="campus-insights-cat-pct ${conf.pctClass}">${cat.pct}%</span>
                    </div>
                    <div class="campus-insights-cat-track">
                        <div class="campus-insights-cat-fill" id="insights-bar-fill-${idx}" style="width: 0%;" data-target-width="${cat.pct}%"></div>
                    </div>
                    <div class="campus-insights-tooltip">
                        <i class="bi bi-info-circle me-1 text-purple"></i>${cat.count} ${cat.count === 1 ? 'report' : 'reports'}
                    </div>
                </div>
            `;
        }).join('');
    }

    // 2. Process Status Breakdown
    let countLost = reports.filter(r => r.type === "lost" && r.status !== "Recovered").length;
    let countFound = reports.filter(r => r.type === "found" && r.status !== "Recovered").length;
    let countRecovered = reports.filter(r => r.status === "Recovered").length;

    let pctLost = totalCount > 0 ? Math.round((countLost / totalCount) * 100) : 0;
    let pctFound = totalCount > 0 ? Math.round((countFound / totalCount) * 100) : 0;
    let pctRecovered = totalCount > 0 ? Math.round((countRecovered / totalCount) * 100) : 0;
    let recoveryRate = totalCount > 0 ? Math.round((countRecovered / totalCount) * 100) : 0;

    let elCountLost = document.getElementById("insights-count-lost");
    let elPctLost = document.getElementById("insights-pct-lost");
    if (elCountLost) elCountLost.textContent = `${countLost} ${countLost === 1 ? 'report' : 'reports'}`;
    if (elPctLost) elPctLost.textContent = `${pctLost}%`;

    let elCountFound = document.getElementById("insights-count-found");
    let elPctFound = document.getElementById("insights-pct-found");
    if (elCountFound) elCountFound.textContent = `${countFound} ${countFound === 1 ? 'report' : 'reports'}`;
    if (elPctFound) elPctFound.textContent = `${pctFound}%`;

    let elCountRecovered = document.getElementById("insights-count-recovered");
    let elPctRecovered = document.getElementById("insights-pct-recovered");
    if (elCountRecovered) elCountRecovered.textContent = `${countRecovered} ${countRecovered === 1 ? 'report' : 'reports'}`;
    if (elPctRecovered) elPctRecovered.textContent = `${pctRecovered}%`;

    let elRecRate = document.getElementById("insights-recovery-rate");
    if (elRecRate) elRecRate.textContent = `${recoveryRate}%`;

    // Calculate Donut Arcs (Circumference = 440)
    let CIRCUMFERENCE = 440;
    let arcLost = document.getElementById("donut-arc-lost");
    let arcFound = document.getElementById("donut-arc-found");
    let arcRecovered = document.getElementById("donut-arc-recovered");

    let lenLost = (pctLost / 100) * CIRCUMFERENCE;
    let lenFound = (pctFound / 100) * CIRCUMFERENCE;
    let lenRecovered = (pctRecovered / 100) * CIRCUMFERENCE;

    let rotLost = -90;
    let rotFound = -90 + (pctLost / 100) * 360;
    let rotRecovered = -90 + ((pctLost + pctFound) / 100) * 360;

    // 3. Intersection Observer for Entrance Animation
    let observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                section.classList.add("is-visible");

                // Animate Category Progress Bars Fill
                topCats.forEach((_, idx) => {
                    let fillBar = document.getElementById(`insights-bar-fill-${idx}`);
                    if (fillBar) {
                        let targetWidth = fillBar.getAttribute("data-target-width");
                        setTimeout(() => {
                            fillBar.style.width = targetWidth;
                        }, idx * 100 + 100);
                    }
                });

                // Animate Donut SVG Arcs
                if (arcLost) {
                    arcLost.setAttribute("transform", `rotate(${rotLost} 100 100)`);
                    arcLost.style.strokeDasharray = `${lenLost} ${CIRCUMFERENCE}`;
                }
                if (arcFound) {
                    arcFound.setAttribute("transform", `rotate(${rotFound} 100 100)`);
                    arcFound.style.strokeDasharray = `${lenFound} ${CIRCUMFERENCE}`;
                }
                if (arcRecovered) {
                    arcRecovered.setAttribute("transform", `rotate(${rotRecovered} 100 100)`);
                    arcRecovered.style.strokeDasharray = `${lenRecovered} ${CIRCUMFERENCE}`;
                }

                // Count up numbers
                if (typeof animateCountUp === "function") {
                    animateCountUp("insights-cat-total-count", totalCount);
                    animateCountUp("insights-donut-total-count", totalCount);
                } else {
                    let catTotEl = document.getElementById("insights-cat-total-count");
                    let donutTotEl = document.getElementById("insights-donut-total-count");
                    if (catTotEl) catTotEl.textContent = totalCount;
                    if (donutTotEl) donutTotEl.textContent = totalCount;
                }

                observer.unobserve(section);
            }
        });
    }, { threshold: 0.2 });

    observer.observe(section);

    // 4. Donut Segment Interactive Click Handler & Information Popup
    let popup = document.getElementById("donut-segment-popup");
    let popupTitle = document.getElementById("donut-popup-title");
    let popupCount = document.getElementById("donut-popup-count");
    let popupPct = document.getElementById("donut-popup-pct");
    let popupClose = document.getElementById("donut-popup-close");
    let donutWrapper = document.getElementById("campus-insights-donut-wrapper");

    let donutSegments = [
        {
            el: arcLost,
            title: "Lost Items",
            count: countLost,
            pct: pctLost,
            colorDark: "#a855f7",
            colorLight: "#7c3aed",
            titleDark: "#c084fc",
            titleLight: "#7c3aed",
            glow: "rgba(168, 85, 247, 0.35)"
        },
        {
            el: arcFound,
            title: "Found Items",
            count: countFound,
            pct: pctFound,
            colorDark: "#06b6d4",
            colorLight: "#0891b2",
            titleDark: "#38bdf8",
            titleLight: "#0891b2",
            glow: "rgba(6, 182, 212, 0.35)"
        },
        {
            el: arcRecovered,
            title: "Recovered Items",
            count: countRecovered,
            pct: pctRecovered,
            colorDark: "#10b981",
            colorLight: "#059669",
            titleDark: "#34d399",
            titleLight: "#059669",
            glow: "rgba(16, 185, 129, 0.35)"
        }
    ];

    function closeDonutPopup() {
        if (popup) popup.classList.add("d-none");
        donutSegments.forEach(s => {
            if (s.el) s.el.classList.remove("is-selected");
        });
    }

    donutSegments.forEach(seg => {
        if (!seg.el) return;

        // Hover In: Show tooltip & highlight segment
        seg.el.addEventListener("mouseenter", function(e) {
            donutSegments.forEach(s => {
                if (s.el) s.el.classList.remove("is-selected");
            });
            seg.el.classList.add("is-selected");

            let isLight = document.documentElement.classList.contains("light-theme");
            let borderColor = isLight ? seg.colorLight : seg.colorDark;
            let titleColor = isLight ? seg.titleLight : seg.titleDark;

            if (popup) {
                popup.style.setProperty("--popup-border", borderColor);
                popup.style.setProperty("--popup-title-color", titleColor);
                popup.style.setProperty("--popup-glow", seg.glow);

                if (popupTitle) popupTitle.textContent = seg.title;
                if (popupCount) popupCount.textContent = `${seg.count} ${seg.count === 1 ? 'report' : 'reports'}`;
                if (popupPct) popupPct.textContent = `${seg.pct}% of total reports`;

                popup.classList.remove("d-none");

                // Restart popup animation for smooth transition
                popup.style.animation = 'none';
                popup.offsetHeight; /* trigger reflow */
                popup.style.animation = 'donutPopupFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards';
            }
        });

        // Hover Out: Hide tooltip & un-highlight segment
        seg.el.addEventListener("mouseleave", function(e) {
            closeDonutPopup();
        });
    });

    if (donutWrapper) {
        donutWrapper.addEventListener("mouseleave", function() {
            closeDonutPopup();
        });
    }
}


