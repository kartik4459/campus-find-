// ============================================================
// lostFound.js  — Lost & Found Map Page
// Self-contained. Does NOT depend on app.js, storage.js, etc.
// ============================================================

// ─── 1. DATA ──────────────────────────────────────────────────────────────────
// Each item: id, name, category, description, location, x (%), y (%), status,
//            date (display string), reportedBy (optional)
// x/y are percentage-based so hotspots stay positioned correctly on any screen size.

let lostFoundItems = [
    {
        id: 1,
        name: "Black Leather Wallet",
        category: "Wallets",
        description: "Black bi-fold leather wallet with university ID and 2 bank cards inside. Has a small scratch on the back cover.",
        location: "Academic Block A",
        x: 38, y: 42,
        status: "found",
        date: "Aug 21, 2026",
        reportedBy: "Security Desk"
    },
    {
        id: 2,
        name: "Apple AirPods Pro",
        category: "Electronics",
        description: "White AirPods Pro in a white MagSafe case. Case has a small blue sticker on the back.",
        location: "Library – Reading Hall",
        x: 62, y: 30,
        status: "found",
        date: "Aug 22, 2026",
        reportedBy: "Library Staff"
    },
    {
        id: 3,
        name: "Blue Hydro Flask Bottle",
        category: "Accessories",
        description: "32 oz navy blue Hydro Flask with stickers on the side. Name 'Priya' written at the bottom.",
        location: "Sports Complex",
        x: 75, y: 65,
        status: "lost",
        date: "Aug 20, 2026",
        reportedBy: "Student"
    },
    {
        id: 4,
        name: "University ID Card",
        category: "ID Cards",
        description: "Student ID card — name 'Arjun Mehta', Roll No. 2023CS042. Found near the main gate.",
        location: "Main Gate / Entry",
        x: 25, y: 78,
        status: "found",
        date: "Aug 22, 2026",
        reportedBy: "Guard Post"
    },
    {
        id: 5,
        name: "Red Backpack",
        category: "Bags",
        description: "Medium red Wildcraft backpack with laptop pocket. Contains notebooks and a water bottle holder.",
        location: "Cafeteria",
        x: 52, y: 58,
        status: "lost",
        date: "Aug 19, 2026",
        reportedBy: "Student"
    },
    {
        id: 6,
        name: "Scientific Calculator (Casio)",
        category: "Electronics",
        description: "Casio FX-991EX ClassWiz. Has 'ROHAN' written in marker on the back.",
        location: "Examination Hall 3",
        x: 44, y: 22,
        status: "found",
        date: "Aug 21, 2026",
        reportedBy: "Invigilator"
    },
    {
        id: 7,
        name: "Set of 3 Keys",
        category: "Keys",
        description: "3 keys on a red lanyard keychain with a small compass charm. Includes what looks like a hostel room key.",
        location: "Hostel Block B",
        x: 82, y: 40,
        status: "found",
        date: "Aug 22, 2026",
        reportedBy: "Hostel Warden"
    },
    {
        id: 8,
        name: "Engineering Drawing Book",
        category: "Books",
        description: "A4-size engineering drawing sheets folder — name 'Kavya S.' on cover, 1st year batch.",
        location: "Design Studio",
        x: 30, y: 55,
        status: "lost",
        date: "Aug 18, 2026",
        reportedBy: "Student"
    },
    {
        id: 9,
        name: "Prescription Glasses",
        category: "Accessories",
        description: "Round-frame black glasses, prescription lenses. Found in a grey hard case.",
        location: "Admin Block – Corridor",
        x: 18, y: 35,
        status: "found",
        date: "Aug 20, 2026",
        reportedBy: "Admin Staff"
    },
    {
        id: 10,
        name: "Samsung Galaxy Watch",
        category: "Electronics",
        description: "Black Samsung Galaxy Watch 5 with a dark grey strap. Watch face slightly scratched.",
        location: "Gym / Fitness Centre",
        x: 68, y: 82,
        status: "lost",
        date: "Aug 21, 2026",
        reportedBy: "Student"
    }
];

// ─── 2. STATE ─────────────────────────────────────────────────────────────────
let currentMode        = 'lost';   // 'lost' | 'found'
let activeHotspotId    = null;     // currently selected hotspot id
let isPlacingPin       = false;    // true while user clicks map to place a new pin
let pendingPinCoords   = null;     // { x, y } percentages after click while placing

// Map zoom/pan state
let mapScale   = 1;
let mapTransX  = 0;
let mapTransY  = 0;
const MAP_MIN_SCALE = 1;
const MAP_MAX_SCALE = 4;

// ─── 3. INIT ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
    renderItemCards('lost');          // Default: show Lost items
    renderHotspots();                 // Draw all pins on map
    initMapControls();                // Zoom + Pan
    initModeToggle();                 // Tab buttons
    initFilterListeners();            // Search + category dropdowns
    initFoundForm();                  // "I Found Something" form
});

// ─── 4. MODE TOGGLE ──────────────────────────────────────────────────────────
function initModeToggle() {
    var btnLost  = document.getElementById('lf-btn-mode-lost');
    var btnFound = document.getElementById('lf-btn-mode-found');
    if (!btnLost || !btnFound) return;

    btnLost.addEventListener('click', function () { switchMode('lost'); });
    btnFound.addEventListener('click', function () { switchMode('found'); });
}

function switchMode(mode) {
    currentMode = mode;

    var btnLost   = document.getElementById('lf-btn-mode-lost');
    var btnFound  = document.getElementById('lf-btn-mode-found');
    var panelLost = document.getElementById('lf-panel-lost');
    var panelFound= document.getElementById('lf-panel-found');

    // Reset button states
    btnLost.classList.remove('lf-mode-active-lost',  'lf-mode-active-found');
    btnFound.classList.remove('lf-mode-active-lost', 'lf-mode-active-found');

    // Activate correct button
    if (mode === 'lost') {
        btnLost.classList.add('lf-mode-active-lost');
        panelLost.classList.add('lf-panel-active');
        panelFound.classList.remove('lf-panel-active');
    } else {
        btnFound.classList.add('lf-mode-active-found');
        panelFound.classList.add('lf-panel-active');
        panelLost.classList.remove('lf-panel-active');
    }

    // Cancel any ongoing pin placement when switching modes
    cancelPinPlacement();

    // Re-render cards for the active mode
    applyFilters();
}

// ─── 5. ITEM CARDS ────────────────────────────────────────────────────────────
function renderItemCards(filterStatus, searchTerm, filterCategory) {
    var grid = document.getElementById('lf-cards-grid');
    if (!grid) return;

    // Determine which items to show
    var items = lostFoundItems.filter(function (item) {
        // Status filter (lost/found)
        var matchStatus = !filterStatus || filterStatus === 'all' || item.status === filterStatus;

        // Search filter (name, description, location)
        var matchSearch = true;
        if (searchTerm && searchTerm.trim() !== '') {
            var q = searchTerm.toLowerCase();
            matchSearch = item.name.toLowerCase().includes(q) ||
                          item.description.toLowerCase().includes(q) ||
                          item.location.toLowerCase().includes(q);
        }

        // Category filter
        var matchCat = !filterCategory || filterCategory === 'all' || item.category === filterCategory;

        return matchStatus && matchSearch && matchCat;
    });

    // Update count badge
    var countEl = document.getElementById('lf-result-count');
    if (countEl) countEl.textContent = items.length + ' item' + (items.length !== 1 ? 's' : '');

    // Build card HTML
    if (items.length === 0) {
        grid.innerHTML = '<div class="lf-no-items"><i class="bi bi-search"></i>No items match your search. Try different keywords or filters.</div>';
        return;
    }

    grid.innerHTML = items.map(function (item) {
        var badgeClass = item.status === 'found' ? 'lf-badge-found' : 'lf-badge-lost';
        var cardClass  = item.status === 'found' ? 'lf-card-found' : 'lf-card-lost';
        var statusIcon = item.status === 'found' ? 'bi-check-circle-fill' : 'bi-search';
        var statusLabel= item.status === 'found' ? 'Found' : 'Lost';

        return [
            '<div class="lf-item-card ' + cardClass + '" ',
            '     id="lf-card-' + item.id + '" ',
            '     onclick="onCardClick(' + item.id + ')" ',
            '     title="Click to highlight on map">',
            '  <div class="lf-card-header">',
            '    <div class="lf-card-name">' + escapeHtml(item.name) + '</div>',
            '    <span class="lf-badge ' + badgeClass + '">',
            '      <i class="bi ' + statusIcon + '"></i>' + statusLabel,
            '    </span>',
            '  </div>',
            '  <div class="lf-card-category">',
            '    <i class="bi bi-tag"></i>' + escapeHtml(item.category),
            '    <span class="ms-2 text-muted" style="font-size:0.72rem;">' + item.date + '</span>',
            '  </div>',
            '  <div class="lf-card-location">',
            '    <i class="bi bi-geo-alt-fill"></i>' + escapeHtml(item.location),
            '  </div>',
            '</div>'
        ].join('');
    }).join('');
}

// Called when user clicks a card
function onCardClick(id) {
    highlightHotspot(id);
    openDetailPanel(id);

    // Scroll map into view smoothly
    var mapSection = document.getElementById('lf-map-section-lost');
    if (!mapSection) mapSection = document.getElementById('lf-map-section-found');
    if (mapSection) mapSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // Highlight card
    var allCards = document.querySelectorAll('.lf-item-card');
    allCards.forEach(function (c) { c.classList.remove('lf-card-highlighted'); });
    var card = document.getElementById('lf-card-' + id);
    if (card) card.classList.add('lf-card-highlighted');
}

// ─── 6. HOTSPOT RENDERING ────────────────────────────────────────────────────
function renderHotspots() {
    var mapInner = document.getElementById('lf-map-inner');
    if (!mapInner) return;

    // Remove old hotspots (keep the map image and placing-banner)
    var oldPins = mapInner.querySelectorAll('.lf-hotspot');
    oldPins.forEach(function (p) { p.remove(); });

    // Render each item
    lostFoundItems.forEach(function (item) {
        var pin = buildHotspotElement(item);
        mapInner.appendChild(pin);
    });
}

function buildHotspotElement(item) {
    var pinClass = 'lf-pin-' + item.status;

    var el = document.createElement('div');
    el.className = 'lf-hotspot';
    el.id = 'lf-hotspot-' + item.id;
    el.setAttribute('data-id', item.id);
    el.title = item.name + ' — ' + item.location;
    el.style.left = item.x + '%';
    el.style.top  = item.y + '%';

    el.innerHTML = [
        '<div class="lf-pin ' + pinClass + '">',
        '  <div class="lf-pin-head"><div class="lf-pin-head-inner"></div></div>',
        '  <div class="lf-pin-tail"></div>',
        '</div>'
    ].join('');

    el.addEventListener('click', function (e) {
        e.stopPropagation(); // Don't trigger map click while placing
        if (isPlacingPin) return; // Ignore hotspot clicks when in placing mode
        onHotspotClick(item.id);
    });

    return el;
}

function onHotspotClick(id) {
    highlightHotspot(id);
    openDetailPanel(id);

    // Highlight the matching card too
    var allCards = document.querySelectorAll('.lf-item-card');
    allCards.forEach(function (c) { c.classList.remove('lf-card-highlighted'); });
    var card = document.getElementById('lf-card-' + id);
    if (card) {
        card.classList.add('lf-card-highlighted');
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function highlightHotspot(id) {
    // Clear previous active
    document.querySelectorAll('.lf-hotspot').forEach(function (h) {
        h.classList.remove('lf-hs-active');
    });
    var hs = document.getElementById('lf-hotspot-' + id);
    if (hs) hs.classList.add('lf-hs-active');
    activeHotspotId = id;
}

// ─── 7. DETAIL PANEL ─────────────────────────────────────────────────────────
function openDetailPanel(id) {
    var item = lostFoundItems.find(function (i) { return i.id === id; });
    if (!item) return;

    var panel = document.getElementById('lf-detail-panel');
    if (!panel) return;

    var statusClass = item.status === 'found' ? 'lf-badge-found' : 'lf-badge-lost';
    var statusIcon  = item.status === 'found' ? 'bi-check-circle-fill' : 'bi-search';
    var statusLabel = item.status === 'found' ? 'Found' : 'Lost';

    panel.innerHTML = [
        '<button class="lf-detail-close" onclick="closeDetailPanel()" title="Close"><i class="bi bi-x"></i></button>',
        '<div class="d-flex align-items-center gap-2 mb-1">',
        '  <h5 style="font-family:\'Space Grotesk\',sans-serif;font-weight:700;color:var(--text-heading);margin:0;font-size:1.1rem;">' + escapeHtml(item.name) + '</h5>',
        '  <span class="lf-badge ' + statusClass + '"><i class="bi ' + statusIcon + '"></i>' + statusLabel + '</span>',
        '</div>',
        '<div class="lf-location-note">',
        '  <i class="bi bi-exclamation-triangle-fill"></i>',
        '  <span>This pin shows the <strong>last reported/found location</strong> — actual item may have moved.</span>',
        '</div>',
        '<div class="lf-detail-meta">',
        '  <div class="lf-detail-field">',
        '    <div class="lf-detail-field-label"><i class="bi bi-tag me-1"></i>Category</div>',
        '    <div class="lf-detail-field-value">' + escapeHtml(item.category) + '</div>',
        '  </div>',
        '  <div class="lf-detail-field">',
        '    <div class="lf-detail-field-label"><i class="bi bi-geo-alt me-1"></i>Location</div>',
        '    <div class="lf-detail-field-value">' + escapeHtml(item.location) + '</div>',
        '  </div>',
        '  <div class="lf-detail-field">',
        '    <div class="lf-detail-field-label"><i class="bi bi-calendar3 me-1"></i>Date</div>',
        '    <div class="lf-detail-field-value">' + escapeHtml(item.date) + '</div>',
        '  </div>',
        '  <div class="lf-detail-field">',
        '    <div class="lf-detail-field-label"><i class="bi bi-person me-1"></i>Reported By</div>',
        '    <div class="lf-detail-field-value">' + escapeHtml(item.reportedBy || 'Anonymous') + '</div>',
        '  </div>',
        '</div>',
        '<div class="lf-detail-desc">' + escapeHtml(item.description) + '</div>'
    ].join('');

    panel.classList.add('lf-panel-open');
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function closeDetailPanel() {
    var panel = document.getElementById('lf-detail-panel');
    if (panel) panel.classList.remove('lf-panel-open');

    // Clear active hotspot highlight
    document.querySelectorAll('.lf-hotspot').forEach(function (h) {
        h.classList.remove('lf-hs-active');
    });
    document.querySelectorAll('.lf-item-card').forEach(function (c) {
        c.classList.remove('lf-card-highlighted');
    });
    activeHotspotId = null;
}

// ─── 8. SEARCH & FILTER ───────────────────────────────────────────────────────
function initFilterListeners() {
    var searchInput = document.getElementById('lf-search-input');
    var catFilter   = document.getElementById('lf-cat-filter');
    if (searchInput) searchInput.addEventListener('input', applyFilters);
    if (catFilter)   catFilter.addEventListener('change', applyFilters);
}

function applyFilters() {
    var searchVal = (document.getElementById('lf-search-input') || {}).value || '';
    var catVal    = (document.getElementById('lf-cat-filter')   || {}).value || 'all';
    // Always filter by current mode's status (lost/found)
    renderItemCards(currentMode === 'lost' ? 'lost' : 'found', searchVal, catVal);
}

// ─── 9. MAP CONTROLS (Zoom + Pan) ────────────────────────────────────────────
function initMapControls() {
    var viewport = document.getElementById('lf-map-viewport');
    var inner    = document.getElementById('lf-map-inner');
    if (!viewport || !inner) return;

    // ── Zoom buttons
    document.getElementById('lf-zoom-in')  && document.getElementById('lf-zoom-in').addEventListener('click',  function () { zoomMap(0.35); });
    document.getElementById('lf-zoom-out') && document.getElementById('lf-zoom-out').addEventListener('click', function () { zoomMap(-0.35); });
    document.getElementById('lf-zoom-reset')&& document.getElementById('lf-zoom-reset').addEventListener('click',function () { resetMap(); });

    // ── Mouse-wheel zoom
    viewport.addEventListener('wheel', function (e) {
        e.preventDefault();
        zoomMap(e.deltaY < 0 ? 0.2 : -0.2);
    }, { passive: false });

    // ── Pan (drag) — Mouse
    var isDragging  = false;
    var dragStartX  = 0;
    var dragStartY  = 0;
    var dragStartTX = 0;
    var dragStartTY = 0;

    viewport.addEventListener('mousedown', function (e) {
        if (isPlacingPin) return; // In placing mode, mousedown is handled by map click
        if (mapScale <= 1) return; // No drag when not zoomed
        isDragging  = true;
        dragStartX  = e.clientX;
        dragStartY  = e.clientY;
        dragStartTX = mapTransX;
        dragStartTY = mapTransY;
        viewport.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', function (e) {
        if (!isDragging) return;
        var dx = e.clientX - dragStartX;
        var dy = e.clientY - dragStartY;
        mapTransX = dragStartTX + dx;
        mapTransY = dragStartTY + dy;
        clampPan();
        applyMapTransform();
    });

    document.addEventListener('mouseup', function () {
        if (isDragging) {
            isDragging = false;
            viewport.style.cursor = isPlacingPin ? 'crosshair' : (mapScale > 1 ? 'grab' : 'default');
        }
    });

    // ── Touch pinch-to-zoom + pan
    var lastTouchDist = 0;
    var touchStartTX  = 0;
    var touchStartTY  = 0;
    var touchStartX   = 0;
    var touchStartY   = 0;

    viewport.addEventListener('touchstart', function (e) {
        if (e.touches.length === 2) {
            lastTouchDist = getTouchDist(e.touches);
            touchStartTX  = mapTransX;
            touchStartTY  = mapTransY;
        } else if (e.touches.length === 1 && mapScale > 1) {
            touchStartX  = e.touches[0].clientX;
            touchStartY  = e.touches[0].clientY;
            touchStartTX = mapTransX;
            touchStartTY = mapTransY;
        }
    }, { passive: true });

    viewport.addEventListener('touchmove', function (e) {
        if (e.touches.length === 2) {
            e.preventDefault();
            var dist  = getTouchDist(e.touches);
            var delta = (dist - lastTouchDist) / 180;
            zoomMap(delta);
            lastTouchDist = dist;
        } else if (e.touches.length === 1 && mapScale > 1) {
            e.preventDefault();
            mapTransX = touchStartTX + (e.touches[0].clientX - touchStartX);
            mapTransY = touchStartTY + (e.touches[0].clientY - touchStartY);
            clampPan();
            applyMapTransform();
        }
    }, { passive: false });
}

function zoomMap(delta) {
    mapScale = Math.min(MAP_MAX_SCALE, Math.max(MAP_MIN_SCALE, mapScale + delta));
    if (mapScale <= 1) { mapTransX = 0; mapTransY = 0; }
    clampPan();
    applyMapTransform();

    // Update cursor
    var vp = document.getElementById('lf-map-viewport');
    if (vp && !isPlacingPin) {
        vp.style.cursor = mapScale > 1 ? 'grab' : 'default';
    }
}

function resetMap() {
    mapScale  = 1;
    mapTransX = 0;
    mapTransY = 0;
    applyMapTransform();
    var vp = document.getElementById('lf-map-viewport');
    if (vp && !isPlacingPin) vp.style.cursor = 'default';
}

function applyMapTransform() {
    var inner = document.getElementById('lf-map-inner');
    if (inner) {
        inner.style.transform = 'scale(' + mapScale + ') translate(' + (mapTransX / mapScale) + 'px, ' + (mapTransY / mapScale) + 'px)';
    }
}

// Prevent panning past the image edges
function clampPan() {
    var vp    = document.getElementById('lf-map-viewport');
    if (!vp) return;
    var maxX  = vp.clientWidth  * (mapScale - 1);
    var maxY  = vp.clientHeight * (mapScale - 1);
    mapTransX = Math.max(-maxX, Math.min(0, mapTransX));
    mapTransY = Math.max(-maxY, Math.min(0, mapTransY));
}

function getTouchDist(touches) {
    var dx = touches[0].clientX - touches[1].clientX;
    var dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

// ─── 10. "I FOUND SOMETHING" FORM ────────────────────────────────────────────
function initFoundForm() {
    var placeBtn   = document.getElementById('lf-place-btn');
    var submitBtn  = document.getElementById('lf-submit-btn');
    var viewport   = document.getElementById('lf-map-viewport');

    if (placeBtn)  placeBtn.addEventListener('click',   onPlaceBtnClick);
    if (submitBtn) submitBtn.addEventListener('click',  onSubmitFoundItem);

    // Map click handler for placing pin
    if (viewport) {
        viewport.addEventListener('click', function (e) {
            if (!isPlacingPin) return;
            onMapClickForPin(e, viewport);
        });
    }
}

// Toggle "Place Hotspot" mode
function onPlaceBtnClick() {
    if (isPlacingPin) {
        cancelPinPlacement();
    } else {
        enterPinPlacement();
    }
}

function enterPinPlacement() {
    isPlacingPin = true;
    pendingPinCoords = null;

    // Update UI
    var placeBtn = document.getElementById('lf-place-btn');
    if (placeBtn) {
        placeBtn.classList.add('lf-placing-active');
        placeBtn.innerHTML = '<i class="bi bi-x-circle"></i> Cancel Placement';
    }

    var viewport = document.getElementById('lf-map-viewport');
    if (viewport) viewport.classList.add('lf-placing-mode');

    var banner = document.getElementById('lf-placing-banner');
    if (banner) banner.classList.add('lf-banner-visible');

    var coordsDisplay = document.getElementById('lf-pin-coords');
    if (coordsDisplay) {
        coordsDisplay.classList.remove('lf-coords-set');
        coordsDisplay.innerHTML = '<i class="bi bi-geo-alt"></i> Click anywhere on the map to place the hotspot…';
    }
}

function cancelPinPlacement() {
    isPlacingPin = false;
    pendingPinCoords = null;

    var placeBtn = document.getElementById('lf-place-btn');
    if (placeBtn) {
        placeBtn.classList.remove('lf-placing-active');
        placeBtn.innerHTML = '<i class="bi bi-geo-alt-fill"></i> Place Hotspot on Map';
    }

    var viewport = document.getElementById('lf-map-viewport');
    if (viewport) {
        viewport.classList.remove('lf-placing-mode');
        viewport.style.cursor = mapScale > 1 ? 'grab' : 'default';
    }

    var banner = document.getElementById('lf-placing-banner');
    if (banner) banner.classList.remove('lf-banner-visible');

    // Remove any preview pin
    var previewPin = document.getElementById('lf-preview-pin');
    if (previewPin) previewPin.remove();
}

// User clicked on the map while in placing mode
function onMapClickForPin(e, viewport) {
    var rect = viewport.getBoundingClientRect();
    var inner = document.getElementById('lf-map-inner');
    if (!inner) return;

    // Convert click position to percentage relative to the unscaled image
    // Account for transform: the inner is scaled from top-left
    var clickX = (e.clientX - rect.left - mapTransX) / mapScale;
    var clickY = (e.clientY - rect.top  - mapTransY) / mapScale;
    var pctX   = (clickX / inner.offsetWidth)  * 100;
    var pctY   = (clickY / inner.offsetHeight) * 100;

    // Clamp to [0, 100]
    pctX = Math.max(0, Math.min(100, pctX));
    pctY = Math.max(0, Math.min(100, pctY));

    pendingPinCoords = { x: pctX, y: pctY };

    // Show preview pin
    var previewPin = document.getElementById('lf-preview-pin');
    if (!previewPin) {
        previewPin = document.createElement('div');
        previewPin.id = 'lf-preview-pin';
        previewPin.className = 'lf-hotspot lf-hs-active';
        previewPin.style.pointerEvents = 'none';
        previewPin.innerHTML = '<div class="lf-pin lf-pin-new"><div class="lf-pin-head"><div class="lf-pin-head-inner"></div></div><div class="lf-pin-tail"></div></div>';
        inner.appendChild(previewPin);
    }
    previewPin.style.left = pctX + '%';
    previewPin.style.top  = pctY + '%';

    // Update coords display
    var coordsDisplay = document.getElementById('lf-pin-coords');
    if (coordsDisplay) {
        coordsDisplay.classList.add('lf-coords-set');
        coordsDisplay.innerHTML = '<i class="bi bi-check-circle-fill"></i> Pin placed at (' + pctX.toFixed(1) + '%, ' + pctY.toFixed(1) + '%) — click again to reposition, or submit below.';
    }

    // Exit placing mode after pin is placed
    isPlacingPin = false;
    var placeBtn = document.getElementById('lf-place-btn');
    if (placeBtn) {
        placeBtn.classList.remove('lf-placing-active');
        placeBtn.innerHTML = '<i class="bi bi-arrow-repeat"></i> Reposition Pin';
    }
    var viewport2 = document.getElementById('lf-map-viewport');
    if (viewport2) viewport2.classList.remove('lf-placing-mode');
    var banner = document.getElementById('lf-placing-banner');
    if (banner) banner.classList.remove('lf-banner-visible');

    // Re-enable placing mode on next click
    var placeBtnEl = document.getElementById('lf-place-btn');
    if (placeBtnEl) {
        placeBtnEl.onclick = function () {
            if (isPlacingPin) { cancelPinPlacement(); } else { enterPinPlacement(); }
        };
    }
}

// Submit new found item
function onSubmitFoundItem() {
    var nameInput = document.getElementById('lf-found-name');
    var catInput  = document.getElementById('lf-found-cat');
    var descInput = document.getElementById('lf-found-desc');
    var locInput  = document.getElementById('lf-found-loc');

    // Basic validation
    var errors = [];
    if (!nameInput || nameInput.value.trim() === '') errors.push('Item name is required.');
    if (!catInput  || catInput.value  === 'all')     errors.push('Please select a category.');
    if (!descInput || descInput.value.trim() === '')  errors.push('Description is required.');
    if (!locInput  || locInput.value.trim() === '')   errors.push('Location description is required.');
    if (!pendingPinCoords) errors.push('Please place a hotspot on the map first.');

    if (errors.length > 0) {
        showValidationError(errors.join(' '));
        return;
    }

    // Build new item
    var today = new Date();
    var dateStr = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    var newItem = {
        id:          lostFoundItems.length + 1,
        name:        nameInput.value.trim(),
        category:    catInput.value,
        description: descInput.value.trim(),
        location:    locInput.value.trim(),
        x:           Math.round(pendingPinCoords.x * 10) / 10,
        y:           Math.round(pendingPinCoords.y * 10) / 10,
        status:      'found',
        date:        dateStr,
        reportedBy:  'You'
    };

    lostFoundItems.push(newItem);

    // Remove preview pin and render real hotspot
    var previewPin = document.getElementById('lf-preview-pin');
    if (previewPin) previewPin.remove();

    renderHotspots();

    // Reset form
    nameInput.value = '';
    catInput.value  = 'all';
    descInput.value = '';
    locInput.value  = '';
    pendingPinCoords = null;

    var placeBtn = document.getElementById('lf-place-btn');
    if (placeBtn) {
        placeBtn.classList.remove('lf-placing-active');
        placeBtn.innerHTML = '<i class="bi bi-geo-alt-fill"></i> Place Hotspot on Map';
    }
    var coordsDisplay = document.getElementById('lf-pin-coords');
    if (coordsDisplay) {
        coordsDisplay.classList.remove('lf-coords-set');
        coordsDisplay.innerHTML = '<i class="bi bi-geo-alt"></i> No pin placed yet. Click "Place Hotspot on Map" first.';
    }

    // Switch to Lost mode to show the new item in list (or stay on found, just update)
    applyFilters();

    // Show success toast
    showToast('Item Reported!', '"' + newItem.name + '" has been added to the map.');

    // Highlight the new hotspot
    setTimeout(function () {
        highlightHotspot(newItem.id);
        openDetailPanel(newItem.id);
    }, 300);
}

// ─── 11. HELPERS ──────────────────────────────────────────────────────────────

// Escape HTML to prevent XSS
function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Simple inline validation error
function showValidationError(msg) {
    var existing = document.getElementById('lf-validation-error');
    if (existing) existing.remove();

    var el = document.createElement('div');
    el.id = 'lf-validation-error';
    el.style.cssText = 'background:var(--danger-bg);border:1px solid var(--danger-border);color:var(--danger-color);border-radius:var(--radius-sm);padding:0.6rem 0.9rem;font-size:0.85rem;font-weight:600;margin-top:0.75rem;display:flex;align-items:center;gap:0.4rem;';
    el.innerHTML = '<i class="bi bi-exclamation-triangle-fill"></i>' + escapeHtml(msg);

    var submitBtn = document.getElementById('lf-submit-btn');
    if (submitBtn) submitBtn.parentNode.insertBefore(el, submitBtn.nextSibling);

    setTimeout(function () { if (el.parentNode) el.remove(); }, 5000);
}

// Success toast notification
function showToast(title, message) {
    var toast = document.getElementById('lf-toast');
    if (!toast) return;

    toast.querySelector('.lf-toast-title').textContent = title;
    toast.querySelector('.lf-toast-msg').textContent   = message;

    toast.classList.add('lf-toast-visible');
    setTimeout(function () {
        toast.classList.remove('lf-toast-visible');
    }, 4000);
}
