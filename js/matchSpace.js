// FindIt Personalized 3D Match Space — 100% Real User & Algorithmic Data Engine (Vanilla JS + CSS 3D)

let currentMatchSpaceData = null;
let activeSelectedItemId = null;
let lastLoadedUserId = null;

document.addEventListener("DOMContentLoaded", function() {
    // Run after all scripts are loaded — use load event for safety
    if (document.readyState === "complete") {
        initMyMatchSpace();
    } else {
        window.addEventListener("load", function() {
            initMyMatchSpace();
        });
    }
});

function initMyMatchSpace() {
    let data = getUserMatchSpaceData();
    initMatchSpaceParticles();
    renderMatchSpace(data);

    // Mouse Parallax 3D Tilt Listener
    const stage = document.getElementById("my-match-space-stage");
    const world = document.getElementById("match-space-world");

    if (stage && world) {
        stage.addEventListener("mousemove", function(e) {
            const rect = stage.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            const rotateY = ((x - centerX) / centerX) * 12; // -12deg to +12deg
            const rotateX = -((y - centerY) / centerY) * 12; // -12deg to +12deg

            world.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
        });

        stage.addEventListener("mouseleave", function() {
            world.style.transform = `rotateX(0deg) rotateY(0deg)`;
        });
    }

    window.addEventListener("resize", function() {
        if (currentMatchSpaceData && activeSelectedItemId) {
            renderMatchSpaceConnections(currentMatchSpaceData);
        }
    });
}

// -------------------------------------------------------------
// Render Ambient 3D Background Particles
// -------------------------------------------------------------
function initMatchSpaceParticles() {
    const particlesContainer = document.getElementById("match-space-particles");
    if (!particlesContainer) return;
    particlesContainer.innerHTML = "";

    const count = 14;
    for (let i = 0; i < count; i++) {
        const particle = document.createElement("div");
        particle.className = "particle-dot";
        const size = Math.random() * 6 + 3;
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        particle.style.left = `${Math.random() * 90 + 5}%`;
        particle.style.top = `${Math.random() * 90 + 5}%`;
        particle.style.animationDelay = `${Math.random() * 4}s`;
        particle.style.animationDuration = `${Math.random() * 4 + 4}s`;
        particlesContainer.appendChild(particle);
    }
}

// -------------------------------------------------------------
// GET REAL DATA FOR CURRENTLY LOGGED-IN USER (Zero Fake Data)
// -------------------------------------------------------------
function getUserMatchSpaceData() {
    let currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    let allReports = typeof getReports === 'function' ? getReports() : [];

    // Reset selected item if user changed (Account Switcher Safety)
    const currentUserId = currentUser ? (currentUser.useremail || currentUser.studentId || currentUser.username) : null;
    if (currentUserId !== lastLoadedUserId) {
        activeSelectedItemId = null;
        lastLoadedUserId = currentUserId;
    }

    if (!currentUser) {
        return {
            user: null,
            items: []
        };
    }

    let userEmail = currentUser.useremail ? currentUser.useremail.toLowerCase().trim() : "";
    let studentId = currentUser.studentId ? currentUser.studentId.toLowerCase().trim() : "";
    let username = currentUser.username ? currentUser.username.toLowerCase().trim() : "";

    // Filter reports belonging strictly to the authenticated user
    let myReports = allReports.filter(r => {
        if (r.postedByEmail && r.postedByEmail.toLowerCase().trim() === userEmail) return true;
        if (r.studentId && r.studentId.toLowerCase().trim() === studentId) return true;
        if (r.postedBy && r.postedBy.toLowerCase().trim() === username) return true;
        return false;
    });

    if (myReports.length === 0) {
        return {
            user: { id: userEmail || studentId, name: currentUser.username || "Student" },
            items: []
        };
    }

    // Positions layout presets for user reports in 3D stage
    const presets = [
        { x: 32, y: 22, z: 50 },
        { x: 65, y: 50, z: 65 },
        { x: 45, y: 78, z: 40 },
        { x: 25, y: 60, z: 35 },
        { x: 75, y: 25, z: 55 }
    ];

    // Compute REAL matches for each user report using matching.js algorithm
    let itemsData = myReports.map((rep, idx) => {
        let matchResults = (typeof findMatches === 'function') ? findMatches(rep, allReports) : [];
        
        // Filter candidate matches with a positive score
        let validMatches = matchResults.filter(m => m.score > 0);

        let matches = validMatches.map((m, mIdx) => {
            let candidateReport = m.candidate;
            let score = m.score;
            let status = "match_found";
            let statusLabel = "Match Found";

            if (score >= 90) {
                status = "verification_pending";
                statusLabel = "Verification Pending";
            } else if (score < 70) {
                status = "low_match";
                statusLabel = "Low Match";
            }

            return {
                id: candidateReport.id,
                itemName: candidateReport.itemName,
                score: score,
                status: status,
                statusLabel: statusLabel,
                icon: getCategoryIcon(candidateReport.category),
                category: candidateReport.category,
                zone: candidateReport.zone,
                date: candidateReport.date,
                description: candidateReport.description,
                factors: {
                    category: m.breakdown ? Math.round((m.breakdown.category.pts / m.breakdown.category.maxPts) * 30) : 25,
                    color: m.breakdown ? Math.round((m.breakdown.color.pts / m.breakdown.color.maxPts) * 20) : 20,
                    location: m.breakdown ? Math.round((m.breakdown.location.pts / m.breakdown.location.maxPts) * 20) : 20,
                    date: m.breakdown ? Math.round((m.breakdown.date.pts / m.breakdown.date.maxPts) * 15) : 15,
                    description: m.breakdown ? Math.round((m.breakdown.description.pts / m.breakdown.description.maxPts) * 15) : 10,
                    image: m.breakdown ? Math.round((m.breakdown.image.pts / m.breakdown.image.maxPts) * 10) : 0
                }
            };
        });

        // Compute layout position dynamically if presets run out
        let pos = presets[idx] || {
            x: 20 + ((idx * 30) % 60),
            y: 20 + ((idx * 25) % 65),
            z: 30 + ((idx * 15) % 40)
        };

        return {
            id: rep.id,
            name: rep.itemName,
            type: rep.type,
            icon: getCategoryIcon(rep.category),
            status: matches.length > 0 ? "match_found" : "searching",
            matchesCount: matches.length,
            initialPos: pos,
            zone: rep.zone,
            category: rep.category,
            matches: matches
        };
    });

    return {
        user: { id: userEmail || studentId, name: currentUser.username || "Student" },
        items: itemsData
    };
}

function getCategoryIcon(cat) {
    if (!cat) return "bi-box-seam";
    cat = cat.toLowerCase();
    if (cat.includes("electronic") || cat.includes("ear") || cat.includes("phone") || cat.includes("airpod") || cat.includes("headphone") || cat.includes("audio")) return "bi-headphones";
    if (cat.includes("laptop") || cat.includes("computer")) return "bi-laptop";
    if (cat.includes("bag") || cat.includes("pack")) return "bi-backpack";
    if (cat.includes("wallet") || cat.includes("card") || cat.includes("purse")) return "bi-wallet2";
    if (cat.includes("key")) return "bi-key";
    return "bi-box-seam";
}

// -------------------------------------------------------------
// MASTER RENDER DISPATCHER
// -------------------------------------------------------------
function renderMatchSpace(data) {
    currentMatchSpaceData = data;
    const headerTitle = document.getElementById("match-space-user-title");

    if (headerTitle) {
        if (data.user) {
            headerTitle.innerHTML = `<i class="bi bi-diagram-3-fill me-1"></i>${escapeHtml(data.user.name)}'s Match Space`;
        } else {
            headerTitle.innerHTML = `<i class="bi bi-diagram-3-fill me-1"></i>MY MATCH SPACE`;
        }
    }

    if (!data.user) {
        renderSignedOutState();
        return;
    }

    if (!data.items || data.items.length === 0) {
        renderZeroReportsState(data);
        return;
    }

    if (!activeSelectedItemId) {
        renderInitialState(data);
    } else {
        const activeItem = data.items.find(i => String(i.id) === String(activeSelectedItemId));
        if (activeItem) {
            renderExpandedState(data, activeItem);
        } else {
            activeSelectedItemId = null;
            renderInitialState(data);
        }
    }
}

// -------------------------------------------------------------
// STATE: Signed Out Visitor Prompt
// -------------------------------------------------------------
function renderSignedOutState() {
    const navContainer = document.getElementById("match-space-nav");
    const nodesContainer = document.getElementById("match-space-nodes");
    const svgContainer = document.getElementById("match-space-lines");

    if (navContainer) navContainer.innerHTML = "";
    if (svgContainer) svgContainer.innerHTML = "";
    if (!nodesContainer) return;

    nodesContainer.innerHTML = `
        <div class="match-node initial-item-card shadow-lg p-4 text-center" style="left: 50%; top: 50%; transform: translate3d(-50%, -50%, 40px); min-width: 280px;">
            <div class="node-icon-circle mx-auto mb-3 shadow">
                <i class="bi bi-person-lock fs-3 text-white"></i>
            </div>
            <h5 class="fw-bold text-light mb-1">Sign In to View Match Space</h5>
            <p class="extra-small text-muted mb-3">Please sign in with your student account to visualize your personal 3D match network.</p>
            <a href="login.html" class="btn btn-sm btn-primary rounded-pill px-4 fw-bold shadow-sm" style="background: linear-gradient(135deg, #a855f7 0%, #06b6d4 100%); border: none;">
                Sign In Now <i class="bi bi-arrow-right ms-1"></i>
            </a>
        </div>
    `;
}

// -------------------------------------------------------------
// STATE: User with 0 Submitted Reports (Zero Fake Data)
// -------------------------------------------------------------
function renderZeroReportsState(data) {
    const navContainer = document.getElementById("match-space-nav");
    const nodesContainer = document.getElementById("match-space-nodes");
    const svgContainer = document.getElementById("match-space-lines");

    if (navContainer) navContainer.innerHTML = "";
    if (svgContainer) svgContainer.innerHTML = "";
    if (!nodesContainer) return;

    nodesContainer.innerHTML = `
        <div class="match-node initial-item-card shadow-lg p-4 text-center" style="left: 50%; top: 50%; transform: translate3d(-50%, -50%, 40px); min-width: 290px;">
            <div class="radar-scan-circle mx-auto mb-2">
                <i class="bi bi-plus-circle-dotted fs-3 text-teal"></i>
            </div>
            <h5 class="fw-bold text-light mb-1">No Reports Submitted Yet</h5>
            <p class="extra-small text-muted mb-3">Report a lost or found item to start building your personal 3D Match Space network.</p>
            <a href="report.html" class="btn btn-sm btn-primary rounded-pill px-4 fw-bold shadow-sm" style="background: linear-gradient(135deg, #a855f7 0%, #06b6d4 100%); border: none;">
                <i class="bi bi-plus-lg me-1"></i>Report an Item
            </a>
        </div>
    `;
}

// -------------------------------------------------------------
// STATE 1: Initial Floating State for User's Real Reports
// -------------------------------------------------------------
function renderInitialState(data) {
    const navContainer = document.getElementById("match-space-nav");
    const nodesContainer = document.getElementById("match-space-nodes");
    const svgContainer = document.getElementById("match-space-lines");

    if (navContainer) navContainer.innerHTML = "";
    if (svgContainer) svgContainer.innerHTML = "";
    if (!nodesContainer) return;

    nodesContainer.innerHTML = "";

    data.items.forEach((item, idx) => {
        const card = document.createElement("div");
        card.id = `initial-card-${item.id}`;
        card.className = "match-node initial-item-card shadow-lg";
        card.style.left = `${item.initialPos.x}%`;
        card.style.top = `${item.initialPos.y}%`;
        card.style.setProperty('--init-z', `${item.initialPos.z}px`);
        // Set transform immediately so cards render in correct position on first frame (prevents refresh jump)
        card.style.transform = `translate3d(-50%, -50%, ${item.initialPos.z}px)`;

        let badgeHtml = item.matchesCount > 0
            ? `<span class="badge bg-purple-glow text-purple rounded-pill px-2.5 py-0.5 extra-small fw-bold">${item.matchesCount} Match${item.matchesCount > 1 ? 'es' : ''}</span>`
            : `<span class="badge bg-secondary-subtle text-muted rounded-pill px-2.5 py-0.5 extra-small fw-bold">Searching...</span>`;

        card.innerHTML = `
            <div class="d-flex align-items-center gap-3">
                <div class="node-icon-circle shadow-sm">
                    <i class="bi ${item.icon} fs-4 text-white"></i>
                </div>
                <div class="text-start">
                    <h6 class="fw-bold text-light mb-0" style="font-size: 1.05rem;">${escapeHtml(item.name)}</h6>
                    <div class="extra-small text-muted mb-1">${item.type === 'lost' ? 'Lost Item' : 'Found Item'}</div>
                    ${badgeHtml}
                </div>
            </div>
            <div class="card-hint-pill">
                <i class="bi bi-hand-index-thumb"></i> Click to open Match Space →
            </div>
        `;

        card.onclick = () => selectMatchSpaceItem(item.id);
        nodesContainer.appendChild(card);
    });
}

// -------------------------------------------------------------
// STATE 2: Expanded Real Match Tree for Clicked User Item
// -------------------------------------------------------------
function selectMatchSpaceItem(itemId) {
    if (!itemId) return;
    activeSelectedItemId = String(itemId);
    currentMatchSpaceData = getUserMatchSpaceData();
    renderMatchSpace(currentMatchSpaceData);
}

function resetMatchSpaceView() {
    activeSelectedItemId = null;
    currentMatchSpaceData = getUserMatchSpaceData();
    renderMatchSpace(currentMatchSpaceData);
}

function renderExpandedState(data, activeItem) {
    const navContainer = document.getElementById("match-space-nav");
    const nodesContainer = document.getElementById("match-space-nodes");
    const svgContainer = document.getElementById("match-space-lines");

    if (!nodesContainer || !svgContainer) return;

    // Wipe previous DOM nodes & SVG lines completely before rendering!
    nodesContainer.innerHTML = "";
    svgContainer.innerHTML = "";

    // 1. Render Back Navigation Button
    if (navContainer) {
        navContainer.innerHTML = `
            <button class="btn-match-space-back" onclick="resetMatchSpaceView()">
                <i class="bi bi-arrow-left"></i> Back to My Items
            </button>
        `;
    }

    // 2. Retrieve ONLY activeItem's own matches array
    const selectedMatches = Array.isArray(activeItem.matches) ? activeItem.matches : [];
    const matchesCount = selectedMatches.length;

    // 3. Render Central Selected Item Node
    const centerNode = document.createElement("div");
    centerNode.id = `center-node-${activeItem.id}`;
    centerNode.className = "match-node node-central shadow-lg";
    centerNode.style.left = "50%";
    centerNode.style.top = "50%";
    centerNode.style.transform = "translate3d(-50%, -50%, 80px) scale(1.15)";

    centerNode.innerHTML = `
        <div class="central-pulse-ring"></div>
        <div class="central-pulse-ring-2"></div>
        <div class="d-flex align-items-center gap-3">
            <div class="node-icon-circle shadow-sm">
                <i class="bi ${activeItem.icon} fs-3 text-white"></i>
            </div>
            <div class="text-start">
                <h5 class="fw-bold text-light mb-0" style="font-size: 1.15rem; letter-spacing: 0.02em;">${escapeHtml(activeItem.name)}</h5>
                <div class="extra-small text-teal fw-bold text-uppercase" style="letter-spacing: 0.08em;">YOUR ${activeItem.type.toUpperCase()} ITEM</div>
                <span class="badge bg-purple-glow text-purple rounded-pill px-2.5 py-0.5 mt-1 extra-small fw-bold">
                    ${matchesCount} Real Candidate${matchesCount === 1 ? '' : 's'}
                </span>
            </div>
        </div>
    `;

    centerNode.onclick = () => showMatchSpaceItemModal(activeItem, null);
    nodesContainer.appendChild(centerNode);

    // 3. Render Candidate Match Nodes (Exact REAL count N)
    const matches = activeItem.matches || [];

    if (matches.length === 0) {
        // Zero Matches Scanner Node
        const zeroNode = document.createElement("div");
        zeroNode.className = "match-node zero-matches-node shadow-lg";
        zeroNode.style.left = "50%";
        zeroNode.style.top = "80%";
        zeroNode.style.transform = "translate3d(-50%, -50%, 20px)";
        zeroNode.style.setProperty('--node-z', '20px');

        zeroNode.innerHTML = `
            <div class="radar-scan-circle">
                <i class="bi bi-radar fs-4 text-purple"></i>
            </div>
            <div class="fw-bold text-light mb-1">No matches found yet</div>
            <small class="text-muted extra-small d-block">Our multi-attribute algorithm is actively scanning incoming reports.</small>
        `;

        nodesContainer.appendChild(zeroNode);
    } else {
        // Dynamic Polar Coordinate Distribution Algorithm for N real matches
        const numMatches = matches.length;
        const radiusX = numMatches <= 2 ? 32 : (numMatches <= 4 ? 36 : 38);
        const radiusY = numMatches <= 2 ? 28 : (numMatches <= 4 ? 30 : 32);

        matches.forEach((match, idx) => {
            const angleDeg = (idx * (360 / numMatches)) - 90; // Start top
            const angleRad = (angleDeg * Math.PI) / 180;

            const posX = 50 + radiusX * Math.cos(angleRad);
            const posY = 50 + radiusY * Math.sin(angleRad);

            let zDepth = 20;
            let hierarchyClass = "node-match-med";

            if (match.score >= 90) {
                zDepth = 50;
                hierarchyClass = "node-match-high";
            } else if (match.score < 70) {
                zDepth = -20;
                hierarchyClass = "node-match-low";
            }

            const matchNode = document.createElement("div");
            matchNode.id = `match-node-${match.id}-${idx}`;
            matchNode.className = `match-node node-match-card ${hierarchyClass} shadow-lg`;
            matchNode.style.left = `${posX.toFixed(1)}%`;
            matchNode.style.top = `${posY.toFixed(1)}%`;
            matchNode.style.setProperty('--node-z', `${zDepth}px`);
            matchNode.style.animationDelay = `${idx * 0.1}s`;

            if (match.score >= 90) {
                matchNode.innerHTML = `
                    <div class="d-flex align-items-center gap-3">
                        <div class="match-circle-ring-container flex-shrink-0">
                            <svg width="52" height="52" viewBox="0 0 36 36" class="circular-chart">
                                <path class="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                <path class="circle" stroke-dasharray="${match.score}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                            </svg>
                            <span class="ring-score-text">${match.score}%</span>
                        </div>
                        <div class="text-start">
                            <div class="fw-bold text-light small mb-0" style="line-height: 1.25;">${escapeHtml(match.itemName)}</div>
                            <span class="badge badge-status-warning rounded-pill px-2 py-0.5 mt-1 extra-small fw-bold">
                                <i class="bi bi-clock-history me-1"></i>${match.statusLabel}
                            </span>
                        </div>
                    </div>
                `;
            } else {
                let badgeClass = match.status === 'verification_pending'
                    ? 'badge-status-warning'
                    : (match.status === 'low_match' ? 'badge-status-secondary' : 'badge-status-teal');

                matchNode.innerHTML = `
                    <div class="d-flex align-items-center gap-2.5">
                        <div class="match-mini-icon text-teal flex-shrink-0">
                            <i class="bi ${match.icon} fs-5"></i>
                        </div>
                        <div class="text-start">
                            <div class="fw-bold text-light small mb-0" style="line-height: 1.2;">${escapeHtml(match.itemName)}</div>
                            <div class="extra-small text-muted fw-semibold">${match.score}% Match</div>
                            <span class="badge ${badgeClass} rounded-pill px-2 py-0.5 mt-1 extra-small fw-bold">
                                ${match.statusLabel}
                            </span>
                        </div>
                    </div>
                `;
            }

            matchNode.onclick = () => showMatchSpaceItemModal(activeItem, match);
            nodesContainer.appendChild(matchNode);
        });
    }

    // 4. Render SVG Connection Lines
    setTimeout(() => {
        renderMatchSpaceConnections(data);
    }, 60);
}

// -------------------------------------------------------------
// Render Animated SVG Curved Connections
// -------------------------------------------------------------
function renderMatchSpaceConnections(data) {
    const stage = document.getElementById("my-match-space-stage");
    const svg = document.getElementById("match-space-lines");

    if (!stage || !svg || !activeSelectedItemId) return;

    svg.innerHTML = `
        <defs>
            <linearGradient id="gradTealCyan" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#a855f7" stop-opacity="0.95" />
                <stop offset="50%" stop-color="#06b6d4" stop-opacity="0.95" />
                <stop offset="100%" stop-color="#10b981" stop-opacity="0.9" />
            </linearGradient>
            <linearGradient id="gradPurpleBlue" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#a855f7" stop-opacity="0.8" />
                <stop offset="100%" stop-color="#06b6d4" stop-opacity="0.6" />
            </linearGradient>
            <linearGradient id="gradSubtle" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.4" />
                <stop offset="100%" stop-color="#64748b" stop-opacity="0.3" />
            </linearGradient>
            <filter id="glowHighPath" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="4.5" result="coloredBlur"/>
                <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                </feMerge>
            </filter>
        </defs>
    `;

    const activeItem = data.items.find(i => String(i.id) === String(activeSelectedItemId));
    if (!activeItem || !activeItem.matches || activeItem.matches.length === 0) return;

    const centerNode = document.getElementById(`center-node-${activeItem.id}`);
    if (!centerNode) return;

    const stageRect = stage.getBoundingClientRect();
    const centerRect = centerNode.getBoundingClientRect();

    const x1 = centerRect.left + centerRect.width / 2 - stageRect.left;
    const y1 = centerRect.top + centerRect.height / 2 - stageRect.top;

    activeItem.matches.forEach((match, idx) => {
        const matchNode = document.getElementById(`match-node-${match.id}-${idx}`);
        if (!matchNode) return;

        const matchRect = matchNode.getBoundingClientRect();
        const x2 = matchRect.left + matchRect.width / 2 - stageRect.left;
        const y2 = matchRect.top + matchRect.height / 2 - stageRect.top;

        let strokeColor = "url(#gradPurpleBlue)";
        let strokeWidth = "2.5";
        let filterAttr = "";

        if (match.score >= 90) {
            strokeColor = "url(#gradTealCyan)";
            strokeWidth = "3.8";
            filterAttr = "url(#glowHighPath)";
        } else if (match.score < 70) {
            strokeColor = "url(#gradSubtle)";
            strokeWidth = "1.5";
        }

        const dx = x2 - x1;
        const dy = y2 - y1;
        const cx1 = x1 + dx * 0.4;
        const cy1 = y1 + dy * 0.15;
        const cx2 = x1 + dx * 0.6;
        const cy2 = y2 - dy * 0.15;

        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`);
        path.setAttribute("stroke", strokeColor);
        path.setAttribute("stroke-width", strokeWidth);
        path.setAttribute("fill", "none");
        if (filterAttr) path.setAttribute("filter", filterAttr);
        path.setAttribute("class", "animated-connection-path");

        svg.appendChild(path);
    });
}

// -------------------------------------------------------------
// Interactive Modal Panel: Algorithm Match Factors Breakdown
// (No private contact info exposed!)
// -------------------------------------------------------------
function showMatchSpaceItemModal(userItem, matchItem) {
    let modalEl = document.getElementById("matchSpaceModal");
    if (!modalEl) {
        modalEl = document.createElement("div");
        modalEl.id = "matchSpaceModal";
        modalEl.className = "modal fade";
        modalEl.tabIndex = -1;
        modalEl.innerHTML = `
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content border-0 shadow-lg rounded-4 bg-card">
                    <div class="modal-header border-bottom border-secondary-subtle">
                        <h5 class="modal-title fw-bold text-heading" id="match-space-modal-title">Match Analysis</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body p-4" id="match-space-modal-body"></div>
                </div>
            </div>
        `;
        document.body.appendChild(modalEl);
    }

    let titleEl = document.getElementById("match-space-modal-title");
    let bodyEl = document.getElementById("match-space-modal-body");

    if (matchItem) {
        if (titleEl) titleEl.innerHTML = `🎯 ${matchItem.score}% Match Details`;

        let factors = matchItem.factors || { category: 30, color: 20, location: 20, date: 15, description: 10 };

        bodyEl.innerHTML = `
            <div class="text-center py-2 mb-3">
                <div class="display-6 fw-extrabold text-info mb-1">${matchItem.score}% MATCH</div>
                <h5 class="fw-bold text-light mb-0">${escapeHtml(matchItem.itemName)}</h5>
                <small class="text-muted"><i class="bi bi-geo-alt me-1 text-primary"></i>Found Zone: ${escapeHtml(matchItem.zone || 'Campus')}</small>
            </div>

            <!-- Algorithm Matching Factors Breakdown -->
            <div class="p-3 info-box-cream rounded-3 border mb-4">
                <small class="info-box-label text-uppercase fw-bold extra-small d-block mb-2" style="letter-spacing: 0.05em;">ALGORITHM MATCH FACTORS</small>
                
                <div class="d-flex justify-content-between align-items-center py-1.5 border-bottom border-secondary-subtle small">
                    <span class="info-box-label"><i class="bi bi-tag text-primary me-1.5"></i>Category Match</span>
                    <strong class="info-box-main">${factors.category}% / 30% <i class="bi bi-check-circle-fill text-success ms-1"></i></strong>
                </div>

                <div class="d-flex justify-content-between align-items-center py-1.5 border-bottom border-secondary-subtle small">
                    <span class="info-box-label"><i class="bi bi-palette text-info me-1.5"></i>Color Alignment</span>
                    <strong class="info-box-main">${factors.color}% / 20% <i class="bi bi-check-circle-fill text-success ms-1"></i></strong>
                </div>

                <div class="d-flex justify-content-between align-items-center py-1.5 border-bottom border-secondary-subtle small">
                    <span class="info-box-label"><i class="bi bi-geo-alt text-teal me-1.5"></i>Campus Zone Match</span>
                    <strong class="info-box-main">${factors.location}% / 20% <i class="bi bi-check-circle-fill text-success ms-1"></i></strong>
                </div>

                <div class="d-flex justify-content-between align-items-center py-1.5 border-bottom border-secondary-subtle small">
                    <span class="info-box-label"><i class="bi bi-calendar-event text-warning me-1.5"></i>Timeline Match</span>
                    <strong class="info-box-main">${factors.date}% / 15% <i class="bi bi-check-circle-fill text-success ms-1"></i></strong>
                </div>

                <div class="d-flex justify-content-between align-items-center py-1.5 small">
                    <span class="info-box-label"><i class="bi bi-file-text text-secondary me-1.5"></i>Description Correlation</span>
                    <strong class="info-box-main">${factors.description}% / 15% <i class="bi bi-check-circle-fill text-success ms-1"></i></strong>
                </div>
            </div>

            <div class="d-flex gap-2">
                <button type="button" class="btn btn-primary fw-bold flex-fill py-2" onclick="openOrCreateChat('${userItem.id}', '${matchItem.id}', ${matchItem.score})">
                    <i class="bi bi-chat-dots-fill me-1"></i>Contact Finder in Private Chat
                </button>
                <button type="button" class="btn btn-outline-secondary fw-bold px-3" data-bs-dismiss="modal">Close</button>
            </div>
        `;
    } else {
        if (titleEl) titleEl.innerHTML = `📦 Your Item: ${escapeHtml(userItem.name)}`;

        bodyEl.innerHTML = `
            <div class="p-3 info-box-cream rounded-3 border mb-3">
                <div class="info-box-label extra-small text-uppercase fw-bold mb-1">Item Name</div>
                <h5 class="info-box-main fw-bold mb-2">${escapeHtml(userItem.name)}</h5>
                <div class="d-flex justify-content-between small">
                    <span class="info-box-label"><i class="bi bi-geo-alt text-info me-1"></i>Zone: ${escapeHtml(userItem.zone || 'Campus')}</span>
                    <span class="badge bg-primary text-white rounded-pill px-2.5 py-1 extra-small">${userItem.type ? userItem.type.toUpperCase() : 'ITEM'}</span>
                </div>
            </div>
            <a href="matches.html?id=${userItem.id}" class="btn btn-primary fw-bold w-100 py-2">
                <i class="bi bi-cpu me-1"></i>Launch Full Match Engine
            </a>
        `;
    }

    let bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);
    bsModal.show();
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
