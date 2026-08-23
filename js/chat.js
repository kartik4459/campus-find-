// FindIt Secure Match Chat Logic (chat.js)

let currentChatId = null;
let currentChat = null;

document.addEventListener("DOMContentLoaded", function() {
    initChatPage();
});

function initChatPage() {
    let currentUser = getCurrentUser();
    if (!currentUser) {
        alert("Please sign in to access the private match chat.");
        window.location.href = "login.html";
        return;
    }

    let params = new URLSearchParams(window.location.search);
    currentChatId = params.get("chatId");

    // If no chatId provided, try to load demo chat
    if (!currentChatId) {
        currentChatId = "CHAT-DEMO-001";
    }

    currentChat = getChatById(currentChatId);

    if (!currentChat) {
        showChatError("Chat conversation not found.");
        return;
    }

    // Resolve participant emails from the linked reports as a fallback for older chats.
    let reports = getReports();
    let lostReport = reports.find(r => r.id === currentChat.lostItemId);
    let foundReport = reports.find(r => r.id === currentChat.foundItemId);
    let lostUserEmail = (lostReport && lostReport.postedByEmail) || currentChat.lostUserEmail || "";
    let finderEmail = (foundReport && foundReport.postedByEmail) || currentChat.finderEmail || "";

    currentChat.lostUserEmail = lostUserEmail;
    currentChat.finderEmail = finderEmail;
    if (!currentChat.lostUserEmail || !currentChat.finderEmail) {
        showChatError("Chat participants could not be identified.");
        return;
    }

    // Privacy & Access Control Check: Only lost item owner or finder can access!
    let myEmail = currentUser.useremail.toLowerCase().trim();
    let isLostOwner = lostUserEmail.toLowerCase().trim() === myEmail;
    let isFinder = finderEmail.toLowerCase().trim() === myEmail;

    if (!isLostOwner && !isFinder) {
        showChatError("Access Restricted. This chat is private to the lost item owner and finder.");
        return;
    }

    // Mark messages sent by the other user as read
    markChatMessagesRead(currentChatId, currentUser.useremail);

    // Render UI
    renderChatSidebar();
    renderChatHeader();
    renderFinderActionPanel(isFinder);
    renderQuickActionChips();
    renderRecoveryStatusBar();
    renderChatMessages();

    // Default dates in recovery modal
    let today = new Date().toISOString().split('T')[0];
    let dateInput = document.getElementById("recovery-date");
    let timeInput = document.getElementById("recovery-time");
    if (dateInput) dateInput.value = today;
    if (timeInput) timeInput.value = "16:30";
}

function showChatError(msg) {
    let mainContainer = document.getElementById("chat-main-container");
    let errorContainer = document.getElementById("chat-error-container");
    if (mainContainer) mainContainer.classList.add("d-none");
    if (errorContainer) {
        errorContainer.classList.remove("d-none");
        let p = errorContainer.querySelector("p");
        if (p) p.innerText = msg;
    }
}

function renderChatSidebar() {
    if (!currentChat) return;

    let scoreEl = document.getElementById("sidebar-match-score");
    let nameEl = document.getElementById("sidebar-item-name");
    let badgeEl = document.getElementById("sidebar-status-badge");
    let lostZoneEl = document.getElementById("sidebar-lost-zone");
    let foundZoneEl = document.getElementById("sidebar-found-zone");
    let lostOwnerEl = document.getElementById("sidebar-lost-owner");
    let finderNameEl = document.getElementById("sidebar-finder-name");

    let users = getUsers();
    let lostUser = users.find(u => u.useremail && u.useremail.toLowerCase() === currentChat.lostUserEmail.toLowerCase());
    let finderUser = users.find(u => u.useremail && u.useremail.toLowerCase() === currentChat.finderEmail.toLowerCase());

    let lostOwnerName = lostUser ? lostUser.username : (currentChat.lostUserEmail.split('@')[0]);
    let finderName = finderUser ? finderUser.username : (currentChat.finderEmail.split('@')[0]);

    if (scoreEl) scoreEl.innerText = `${currentChat.matchScore}% Match`;
    if (nameEl) nameEl.innerText = currentChat.lostItemName;
    if (lostZoneEl) lostZoneEl.innerText = currentChat.lostZone || "Campus";
    if (foundZoneEl) foundZoneEl.innerText = currentChat.foundZone || "Campus";
    if (lostOwnerEl) lostOwnerEl.innerText = lostOwnerName;
    if (finderNameEl) finderNameEl.innerText = finderName;

    if (badgeEl) {
        badgeEl.innerText = currentChat.status;
        badgeEl.className = getStatusBadgeClass(currentChat.status);
    }
}

function renderChatHeader() {
    if (!currentChat) return;

    let headerItem = document.getElementById("chat-header-item");
    let headerFinder = document.getElementById("chat-header-finder");
    let headerStatus = document.getElementById("chat-header-status");

    let users = getUsers();
    let finderUser = users.find(u => u.useremail && u.useremail.toLowerCase() === currentChat.finderEmail.toLowerCase());
    let finderName = finderUser ? finderUser.username : (currentChat.finderEmail.split('@')[0]);

    if (headerItem) headerItem.innerText = currentChat.lostItemName;
    if (headerFinder) headerFinder.innerText = `Finder: ${finderName}`;
    if (headerStatus) {
        headerStatus.innerText = currentChat.status;
        headerStatus.className = getStatusBadgeClass(currentChat.status);
    }
}

function getStatusBadgeClass(status) {
    if (status === "Verified") return "badge bg-success text-white rounded-pill px-3 py-1 fw-bold extra-small";
    if (status === "Recovery Arranged") return "badge bg-primary text-white rounded-pill px-3 py-1 fw-bold extra-small";
    if (status === "Recovered") return "badge bg-info text-dark rounded-pill px-3 py-1 fw-bold extra-small";
    if (status === "Rejected") return "badge bg-danger text-white rounded-pill px-3 py-1 fw-bold extra-small";
    return "badge bg-warning text-dark rounded-pill px-3 py-1 fw-bold extra-small";
}

function renderFinderActionPanel(isFinder) {
    let panel = document.getElementById("finder-action-bar");
    if (!panel) return;

    // Show action bar ONLY to the person who FOUND the item, and only if not yet recovered/rejected
    if (isFinder && currentChat.status !== "Recovered" && currentChat.status !== "Rejected") {
        panel.classList.remove("d-none");
    } else {
        panel.classList.add("d-none");
    }
}

function renderQuickActionChips() {
    const currentUser = getCurrentUser();
    const chip = document.getElementById("quick-chip-ask-item");
    if (!currentUser || !chip || !currentChat) return;

    const isLostOwner = (currentChat.lostUserEmail || "").toLowerCase().trim() === currentUser.useremail.toLowerCase().trim();
    chip.classList.toggle("d-none", !isLostOwner);
}

function renderRecoveryStatusBar() {
    let bar = document.getElementById("recovery-status-bar");
    if (!bar || !currentChat) return;

    if (currentChat.status === "Verified" || currentChat.status === "Recovery Arranged") {
        bar.classList.remove("d-none");
        bar.className = "p-3 border-bottom bg-success-subtle text-dark d-flex justify-content-between align-items-center flex-wrap gap-2";
        
        let recInfo = currentChat.recoveryDetails 
            ? `<strong>${currentChat.recoveryDetails.location}</strong> · ${currentChat.recoveryDetails.date} @ ${currentChat.recoveryDetails.time}`
            : `Ownership Verified by Finder`;

        bar.innerHTML = `
            <div class="d-flex align-items-center gap-2">
                <i class="bi bi-shield-check-fill text-success fs-5"></i>
                <div class="small">
                    <strong class="text-success d-block">✓ Ownership Verified</strong>
                    <span class="text-muted extra-small">${recInfo}</span>
                </div>
            </div>
            <div class="d-flex gap-2 flex-wrap">
                ${currentChat.status !== "Recovery Arranged" ? `
                    <button class="btn btn-sm btn-primary fw-bold extra-small py-1.5 px-3" onclick="openArrangeRecoveryModal()">
                        <i class="bi bi-calendar-event me-1"></i>Arrange Recovery
                    </button>
                ` : `
                    <button class="btn btn-sm btn-outline-primary fw-bold extra-small py-1.5 px-3" onclick="openArrangeRecoveryModal()">
                        <i class="bi bi-pencil me-1"></i>Update Recovery Plan
                    </button>
                `}
                <button class="btn btn-sm btn-success fw-bold extra-small py-1.5 px-3" onclick="markItemAsRecovered()">
                    <i class="bi bi-check-circle-fill me-1"></i>Mark Item as Recovered
                </button>
            </div>
        `;
    } else if (currentChat.status === "Recovered") {
        bar.classList.remove("d-none");
        bar.className = "p-3 border-bottom bg-info-subtle text-dark d-flex justify-content-between align-items-center";
        bar.innerHTML = `
            <div class="d-flex align-items-center gap-2">
                <i class="bi bi-patch-check-fill text-info fs-4"></i>
                <div>
                    <strong class="text-dark d-block">🎉 ITEM RECOVERED & RETURNED</strong>
                    <small class="text-muted extra-small">This match has been successfully completed and saved to recovery history.</small>
                </div>
            </div>
            <span class="badge bg-info text-dark rounded-pill px-3 py-1 fw-bold extra-small">RECOVERED</span>
        `;
    } else {
        bar.classList.add("d-none");
    }
}

function renderChatMessages() {
    let container = document.getElementById("chat-messages-container");
    if (!container || !currentChat) return;

    let currentUser = getCurrentUser();
    let myEmail = currentUser ? currentUser.useremail.toLowerCase().trim() : "";

    container.innerHTML = "";

    currentChat.messages.forEach(msg => {
        if (msg.type === "system") {
            container.innerHTML += `
                <div class="text-center my-2">
                    <div class="d-inline-block px-3 py-1.5 bg-dark-subtle rounded-pill border border-secondary-subtle extra-small text-muted shadow-sm">
                        ${msg.text}
                    </div>
                </div>
            `;
        } else {
            let isMe = msg.senderId.toLowerCase().trim() === myEmail;
            let bubbleClass = isMe ? "chat-bubble-self" : "chat-bubble-other";
            let alignClass = isMe ? "ms-auto text-end" : "me-auto text-start";
            
            let timeStr = "";
            try {
                timeStr = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } catch(e) {
                timeStr = "Just now";
            }

            container.innerHTML += `
                <div class="d-flex flex-column ${alignClass}" style="max-width: 80%;">
                    <div class="extra-small text-muted mb-1 px-1">${isMe ? 'You' : msg.senderName}</div>
                    <div class="p-3 rounded-4 shadow-sm ${bubbleClass} text-break">
                        ${escapeHtml(msg.text)}
                    </div>
                    <div class="extra-small text-muted mt-1 px-1 opacity-75">${timeStr}</div>
                </div>
            `;
        }
    });

    // Auto-scroll to latest message
    setTimeout(() => {
        container.scrollTop = container.scrollHeight;
    }, 50);
}

function handleSendMessage(event) {
    event.preventDefault();
    let input = document.getElementById("chat-input");
    if (!input) return;

    let text = input.value.trim();
    if (!text) return;

    let currentUser = getCurrentUser();
    let msgObj = {
        id: "MSG-" + Date.now(),
        senderId: currentUser.useremail,
        senderName: currentUser.username,
        text: text,
        type: "text",
        timestamp: new Date().toISOString(),
        read: false
    };

    sendChatMessage(currentChatId, msgObj);
    input.value = "";

    // Refresh memory and view
    currentChat = getChatById(currentChatId);
    renderChatMessages();

    // Send notification to recipient
    let recipientEmail = (currentUser.useremail.toLowerCase() === currentChat.lostUserEmail.toLowerCase()) 
        ? currentChat.finderEmail 
        : currentChat.lostUserEmail;

    sendNotification({
        id: "NOTIF-" + Date.now(),
        recipientEmail: recipientEmail,
        senderName: currentUser.username,
        senderEmail: currentUser.useremail,
        itemName: currentChat.lostItemName,
        message: `💬 New message from ${currentUser.username}: "${text.length > 40 ? text.substring(0, 40) + '...' : text}"`,
        chatId: currentChatId,
        type: "chat_message",
        date: new Date().toLocaleString()
    });
}

function sendQuickChip(chipText) {
    let input = document.getElementById("chat-input");
    if (!input) return;

    if (chipText === "Ask About Item") {
        input.value = "Hi! Could you share a few more details about where and when you found this item?";
    } else if (chipText === "Request Verification") {
        input.value = "Could you please check if there are any specific marks, stickers, or items inside?";
    } else if (chipText === "Arrange Recovery") {
        input.value = "I'd like to arrange a meeting to verify and recover the item. When and where are you available on campus?";
    } else if (chipText === "Report Suspicious Claim") {
        input.value = "[System Alert] Flagged: Requesting additional verification to ensure authentic ownership.";
    } else if (chipText === "Share Verification Photo") {
        input.value = "Sending item verification photo / detailed proof description.";
    } else {
        input.value = chipText;
    }

    input.focus();
}

// -------------------------------------------------------------
// FINDER VERIFICATION ACTIONS
// -------------------------------------------------------------
function finderApproveOwnership() {
    let currentUser = getCurrentUser();
    if (!confirm("Confirm that you have verified ownership and wish to APPROVE this claim?")) return;

    updateChatStatus(currentChatId, "Verified");
    
    // Post System message inside chat
    let systemMsg = {
        id: "MSG-" + Date.now(),
        senderId: "SYSTEM",
        senderName: "FindIt System",
        text: `✓ Ownership Verified by Finder (${currentUser.username}). Status updated to VERIFIED.`,
        type: "system",
        timestamp: new Date().toISOString(),
        read: true
    };
    sendChatMessage(currentChatId, systemMsg);

    // Notify Lost User
    sendNotification({
        id: "NOTIF-" + Date.now(),
        recipientEmail: currentChat.lostUserEmail,
        senderName: currentUser.username,
        senderEmail: currentUser.useremail,
        itemName: currentChat.lostItemName,
        message: `🎉 Claim Approved! Finder ${currentUser.username} verified your ownership for "${currentChat.lostItemName}". You can now arrange recovery in chat!`,
        chatId: currentChatId,
        type: "claim_approved",
        date: new Date().toLocaleString()
    });

    currentChat = getChatById(currentChatId);
    renderChatSidebar();
    renderChatHeader();
    renderRecoveryStatusBar();
    renderChatMessages();
}

function finderRejectClaim() {
    let currentUser = getCurrentUser();
    let reason = prompt("Enter a brief reason for rejecting this claim (optional):", "Details provided do not match the found item.");
    if (reason === null) return;

    updateChatStatus(currentChatId, "Rejected");

    let systemMsg = {
        id: "MSG-" + Date.now(),
        senderId: "SYSTEM",
        senderName: "FindIt System",
        text: `✕ Claim Rejected by Finder (${currentUser.username}): "${reason}"`,
        type: "system",
        timestamp: new Date().toISOString(),
        read: true
    };
    sendChatMessage(currentChatId, systemMsg);

    sendNotification({
        id: "NOTIF-" + Date.now(),
        recipientEmail: currentChat.lostUserEmail,
        senderName: currentUser.username,
        senderEmail: currentUser.useremail,
        itemName: currentChat.lostItemName,
        message: `✕ Claim Rejected for "${currentChat.lostItemName}". Reason: ${reason}`,
        chatId: currentChatId,
        type: "claim_rejected",
        date: new Date().toLocaleString()
    });

    currentChat = getChatById(currentChatId);
    renderChatSidebar();
    renderChatHeader();
    renderFinderActionPanel(false);
    renderRecoveryStatusBar();
    renderChatMessages();
}

function finderRequestMoreInfo() {
    let currentUser = getCurrentUser();
    let q = prompt("What additional details do you need from the claimant?", "Please describe the contents or any unique identifying marks inside.");
    if (!q) return;

    let systemMsg = {
        id: "MSG-" + Date.now(),
        senderId: "SYSTEM",
        senderName: "FindIt System",
        text: `❓ Finder (${currentUser.username}) requested more information: "${q}"`,
        type: "system",
        timestamp: new Date().toISOString(),
        read: true
    };
    sendChatMessage(currentChatId, systemMsg);

    sendNotification({
        id: "NOTIF-" + Date.now(),
        recipientEmail: currentChat.lostUserEmail,
        senderName: currentUser.username,
        senderEmail: currentUser.useremail,
        itemName: currentChat.lostItemName,
        message: `❓ Finder ${currentUser.username} requested more info for "${currentChat.lostItemName}": ${q}`,
        chatId: currentChatId,
        type: "more_info_needed",
        date: new Date().toLocaleString()
    });

    currentChat = getChatById(currentChatId);
    renderChatMessages();
}

// -------------------------------------------------------------
// RECOVERY ARRANGEMENT & MARK AS RECOVERED
// -------------------------------------------------------------
function openArrangeRecoveryModal() {
    let modalEl = document.getElementById("arrangeRecoveryModal");
    if (modalEl) {
        let modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    }
}

function handleConfirmRecoveryPlan(event) {
    event.preventDefault();
    let location = document.getElementById("recovery-location").value;
    let date = document.getElementById("recovery-date").value;
    let time = document.getElementById("recovery-time").value;
    let notes = document.getElementById("recovery-notes") ? document.getElementById("recovery-notes").value.trim() : "";

    let recDetails = { location: location, date: date, time: time, notes: notes };

    updateChatStatus(currentChatId, "Recovery Arranged", recDetails);

    let systemMsg = {
        id: "MSG-" + Date.now(),
        senderId: "SYSTEM",
        senderName: "FindIt System",
        text: `📦 Recovery Arranged — ${location} | ${date} · ${time} ${notes ? '(' + notes + ')' : ''}`,
        type: "system",
        timestamp: new Date().toISOString(),
        read: true
    };
    sendChatMessage(currentChatId, systemMsg);

    let currentUser = getCurrentUser();
    let recipientEmail = (currentUser.useremail.toLowerCase() === currentChat.lostUserEmail.toLowerCase()) 
        ? currentChat.finderEmail 
        : currentChat.lostUserEmail;

    sendNotification({
        id: "NOTIF-" + Date.now(),
        recipientEmail: recipientEmail,
        senderName: currentUser.username,
        senderEmail: currentUser.useremail,
        itemName: currentChat.lostItemName,
        message: `📦 Recovery Arranged at ${location} on ${date} @ ${time}!`,
        chatId: currentChatId,
        type: "recovery_arranged",
        date: new Date().toLocaleString()
    });

    let modalEl = document.getElementById("arrangeRecoveryModal");
    if (modalEl) {
        let modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
    }

    currentChat = getChatById(currentChatId);
    renderChatSidebar();
    renderChatHeader();
    renderRecoveryStatusBar();
    renderChatMessages();
}

function markItemAsRecovered() {
    if (!confirm("Are you sure this item has been returned and recovered by its rightful owner?")) return;

    updateChatStatus(currentChatId, "Recovered");

    let systemMsg = {
        id: "MSG-" + Date.now(),
        senderId: "SYSTEM",
        senderName: "FindIt System",
        text: `🎉 Item recovered successfully.`,
        type: "system",
        timestamp: new Date().toISOString(),
        read: true
    };
    sendChatMessage(currentChatId, systemMsg);

    // Update status in campus_reports if present
    let reports = getReports();
    let lostRep = reports.find(r => r.id === currentChat.lostItemId);
    let foundRep = reports.find(r => r.id === currentChat.foundItemId);
    if (lostRep) lostRep.status = "Recovered";
    if (foundRep) foundRep.status = "Recovered";
    localStorage.setItem("campus_reports", JSON.stringify(reports));

    currentChat = getChatById(currentChatId);
    renderChatSidebar();
    renderChatHeader();
    renderRecoveryStatusBar();
    renderChatMessages();
}

function openMatchDetailsModal() {
    if (!currentChat) return;

    let body = document.getElementById("match-details-modal-body");
    if (!body) return;

    let reports = getReports();
    let lostReport = reports.find(r => r.id === currentChat.lostItemId);
    let foundReport = reports.find(r => r.id === currentChat.foundItemId);

    let score = currentChat.matchScore || 94;

    body.innerHTML = `
        <div class="text-center py-2 mb-3">
            <span class="badge bg-primary fs-5 px-3 py-2 rounded-pill shadow-sm">🎯 ${score}% Match Score</span>
        </div>
        <div class="row g-3 mb-3">
            <div class="col-6">
                <div class="p-3 info-box-cream rounded-3 border shadow-sm">
                    <small class="info-box-label text-uppercase fw-bold extra-small d-block mb-1">Lost Item</small>
                    <strong class="info-box-main d-block">${currentChat.lostItemName}</strong>
                    <span class="small info-box-label">${currentChat.lostZone || 'Campus'}</span>
                </div>
            </div>
            <div class="col-6">
                <div class="p-3 info-box-cream rounded-3 border shadow-sm">
                    <small class="info-box-label text-uppercase fw-bold extra-small d-block mb-1">Found Item</small>
                    <strong class="info-box-main d-block">${currentChat.foundItemName}</strong>
                    <span class="small info-box-label">${currentChat.foundZone || 'Campus'}</span>
                </div>
            </div>
        </div>
        <div class="p-3 info-box-cream rounded-3 border shadow-sm extra-small mb-3">
            <strong class="info-box-main d-block mb-1"><i class="bi bi-shield-check text-success me-1"></i>Algorithm Verification Factors:</strong>
            <ul class="mb-0 ps-3 info-box-label">
                <li>Same category matching</li>
                <li>Identical campus zone / nearby location</li>
                <li>Similar submission timeline</li>
                <li>Attribute color & description keywords correlation</li>
            </ul>
        </div>
    `;

    let modalEl = document.getElementById("matchDetailsModal");
    if (modalEl) {
        let modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
