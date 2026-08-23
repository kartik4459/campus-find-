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

    // Check if claim is approved for this chat room
    let claims = typeof getClaims === "function" ? getClaims() : [];
    let linkedClaim = claims.find(c =>
        (c.itemId === currentChat.foundItemId || c.itemId === currentChat.lostItemId) &&
        (
            (c.claimedByEmail && c.claimedByEmail.toLowerCase().trim() === lostUserEmail.toLowerCase().trim()) ||
            (c.reporterEmail && c.reporterEmail.toLowerCase().trim() === finderEmail.toLowerCase().trim())
        )
    );

    let isApproved = (linkedClaim && (
        linkedClaim.status === "Approved & Meeting Scheduled" ||
        linkedClaim.status === "Verified" ||
        linkedClaim.status === "Recovery Arranged" ||
        linkedClaim.status === "Recovered"
    )) || currentChat.status === "Verified" || currentChat.status === "Recovery Arranged" || currentChat.status === "Recovered" || currentChatId === "CHAT-DEMO-001";

    let isRejected = (linkedClaim && linkedClaim.status === "Rejected") || currentChat.status === "Rejected";

    // Mark messages sent by the other user as read
    markChatMessagesRead(currentChatId, currentUser.useremail);

    // Render UI according to role & approval state
    renderChatSidebar(isApproved, isRejected);
    renderChatHeader(isApproved, isRejected);
    renderFinderActionPanel(isFinder, isApproved, isRejected, linkedClaim);
    renderChatInputState(isApproved, isFinder, isRejected);
    renderQuickActionChips(isApproved);
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

function renderChatSidebar(isApproved, isRejected) {
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
        if (isApproved) {
            badgeEl.innerText = "✓ Ownership Verified";
            badgeEl.className = "badge bg-success text-white rounded-pill px-3 py-1 fw-bold";
        } else if (isRejected) {
            badgeEl.innerText = "Claim Rejected";
            badgeEl.className = "badge bg-danger text-white rounded-pill px-3 py-1 fw-bold";
        } else {
            badgeEl.innerText = "Verification Pending";
            badgeEl.className = "badge bg-warning text-dark rounded-pill px-3 py-1 fw-bold";
        }
    }
}

function renderChatHeader(isApproved, isRejected) {
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
        if (isApproved) {
            headerStatus.innerText = "✓ Ownership Verified";
            headerStatus.className = "badge bg-success text-white rounded-pill px-3 py-1 fw-bold extra-small";
        } else if (isRejected) {
            headerStatus.innerText = "Claim Rejected";
            headerStatus.className = "badge bg-danger text-white rounded-pill px-3 py-1 fw-bold extra-small";
        } else {
            headerStatus.innerText = "Verification Pending";
            headerStatus.className = "badge bg-warning text-dark rounded-pill px-3 py-1 fw-bold extra-small";
        }
    }
}

function renderFinderActionPanel(isFinder, isApproved, isRejected, linkedClaim) {
    let panel = document.getElementById("finder-action-bar");
    let proofDisplay = document.getElementById("finder-claim-proof-display");
    if (!panel) return;

    // Show action bar ONLY to Finder during Pending state
    if (isFinder && !isApproved && !isRejected) {
        panel.classList.remove("d-none");
        if (proofDisplay) {
            let proofText = linkedClaim && linkedClaim.providedProof ? linkedClaim.providedProof : "No details provided";
            proofDisplay.innerHTML = `
                <strong class="d-block mb-1 text-dark"><i class="bi bi-shield-lock-fill text-primary me-1"></i>Claimant's Submitted Hidden Detail:</strong>
                <div class="text-dark fw-bold fs-6">"${escapeHtml(proofText)}"</div>
            `;
        }
    } else {
        panel.classList.add("d-none");
    }
}

function renderChatInputState(isApproved, isFinder, isRejected) {
    let chatInput = document.getElementById("chat-input");
    let sendBtn = document.getElementById("chat-send-btn");
    let lockBanner = document.getElementById("chat-lock-banner");
    let safetyTip = document.getElementById("chat-safety-tip");
    let chipsRow = document.getElementById("chat-chips-row");

    if (isApproved) {
        if (chatInput) {
            chatInput.disabled = false;
            chatInput.placeholder = "Type a message to coordinate recovery...";
        }
        if (sendBtn) sendBtn.disabled = false;
        if (lockBanner) lockBanner.classList.add("d-none");
        if (safetyTip) safetyTip.classList.remove("d-none");
        if (chipsRow) chipsRow.classList.remove("d-none");
    } else {
        if (chatInput) {
            chatInput.disabled = true;
            chatInput.placeholder = isRejected ? "Chat is locked (Claim Rejected)" : "Chat is locked (Verification Pending)";
        }
        if (sendBtn) sendBtn.disabled = true;
        if (safetyTip) safetyTip.classList.add("d-none");
        if (chipsRow) chipsRow.classList.add("d-none");

        if (lockBanner) {
            lockBanner.classList.remove("d-none");
            if (isRejected) {
                lockBanner.innerHTML = `
                    <div class="d-flex align-items-center gap-2 text-danger">
                        <i class="bi bi-x-circle-fill fs-5"></i>
                        <div>
                            <strong class="d-block">✕ Claim Rejected</strong>
                            <span class="small">The finder did not accept the submitted ownership proof. Chat remains locked.</span>
                        </div>
                    </div>
                `;
            } else if (isFinder) {
                lockBanner.innerHTML = `
                    <div class="d-flex align-items-center gap-2 text-dark">
                        <i class="bi bi-shield-lock-fill text-warning fs-5"></i>
                        <div>
                            <strong class="d-block">🔒 Verification Pending</strong>
                            <span class="small">Please review the claimant's submitted hidden detail in the panel above and click <strong>Approve Ownership</strong> or <strong>Reject Claim</strong>. Chat messaging unlocks upon approval.</span>
                        </div>
                    </div>
                `;
            } else {
                lockBanner.innerHTML = `
                    <div class="d-flex align-items-center gap-2 text-dark">
                        <i class="bi bi-clock-history text-primary fs-5"></i>
                        <div>
                            <strong class="d-block">🔒 Verification Pending</strong>
                            <span class="small">Your ownership claim has been sent to the finder. Chat messaging will unlock once the finder approves your claim.</span>
                        </div>
                    </div>
                `;
            }
        }
    }
}

function renderQuickActionChips(isApproved) {
    let chipsRow = document.getElementById("chat-chips-row");
    if (!chipsRow) return;
    if (!isApproved) {
        chipsRow.classList.add("d-none");
    } else {
        chipsRow.classList.remove("d-none");
    }
}

let recoveryTimerInterval = null;

function renderRecoveryStatusBar() {
    let bar = document.getElementById("recovery-status-bar");
    if (!bar || !currentChat) return;

    if (recoveryTimerInterval) {
        clearInterval(recoveryTimerInterval);
        recoveryTimerInterval = null;
    }

    let currentUser = getCurrentUser();
    let myEmail = currentUser ? currentUser.useremail.toLowerCase().trim() : "";
    let isLostOwner = (currentChat.lostUserEmail || "").toLowerCase().trim() === myEmail;

    let users = getUsers();
    let lostUser = users.find(u => u.useremail && u.useremail.toLowerCase() === (currentChat.lostUserEmail || "").toLowerCase());
    let lostOwnerName = lostUser ? lostUser.username : ((currentChat.lostUserEmail || "").split('@')[0]);

    if (currentChat.status === "Recovered") {
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
        return;
    }

    if (currentChat.status === "Verified" || currentChat.status === "Recovery Arranged") {
        bar.classList.remove("d-none");

        // Check if recovery details are set with a date & time
        let rec = currentChat.recoveryDetails;
        let targetTime = null;
        if (rec && rec.date && rec.time) {
            try {
                targetTime = new Date(`${rec.date}T${rec.time}`);
            } catch (e) {
                targetTime = null;
            }
        }

        let now = new Date();

        if (targetTime && !isNaN(targetTime.getTime()) && now.getTime() < targetTime.getTime()) {
            // COUNTDOWN STATE: Recovery time is in the future
            bar.className = "p-3 border-bottom bg-primary-subtle text-dark d-flex justify-content-between align-items-center flex-wrap gap-2";
            bar.innerHTML = `
                <div>
                    <strong class="text-primary d-block small mb-0.5">
                        <i class="bi bi-clock-history me-1"></i>⏳ Recovery Scheduled
                    </strong>
                    <span class="text-muted extra-small">
                        Location: <strong>${escapeHtml(rec.location)}</strong> · ${rec.date} @ ${rec.time}
                    </span>
                </div>
                <div class="d-flex align-items-center gap-3">
                    <div class="text-end">
                        <span class="extra-small text-muted d-block uppercase fw-bold" style="font-size: 0.65rem;">Recovery in:</span>
                        <span id="recovery-countdown-display" class="badge bg-primary fs-6 font-monospace py-1.5 px-2.5">00 : 00 : 00</span>
                    </div>
                    <button class="btn btn-sm btn-outline-primary fw-bold extra-small py-1 px-2.5" onclick="openArrangeRecoveryModal()">
                        <i class="bi bi-pencil me-1"></i>Update Time
                    </button>
                </div>
            `;

            let updateCountdown = () => {
                let currentNow = new Date();
                let diff = targetTime.getTime() - currentNow.getTime();
                if (diff <= 0) {
                    clearInterval(recoveryTimerInterval);
                    recoveryTimerInterval = null;
                    renderRecoveryStatusBar(); // Re-render to show confirmation!
                    return;
                }
                let hours = Math.floor(diff / (1000 * 60 * 60));
                let mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                let secs = Math.floor((diff % (1000 * 60)) / 1000);
                let displayEl = document.getElementById("recovery-countdown-display");
                if (displayEl) {
                    displayEl.innerText = `${String(hours).padStart(2, '0')} : ${String(mins).padStart(2, '0')} : ${String(secs).padStart(2, '0')}`;
                }
            };

            updateCountdown();
            recoveryTimerInterval = setInterval(updateCountdown, 1000);
            return;
        } else if (targetTime && !isNaN(targetTime.getTime()) && now.getTime() >= targetTime.getTime()) {
            // CONFIRMATION STATE: Timer reached 00:00!
            if (isLostOwner) {
                // Lost owner prompt: "Did you receive your item?"
                bar.className = "p-3 border-bottom bg-warning-subtle text-dark d-flex justify-content-between align-items-center flex-wrap gap-2";
                bar.innerHTML = `
                    <div>
                        <strong class="text-dark d-block fs-6 mb-0.5">
                            <i class="bi bi-bell-fill text-warning me-1"></i>🔔 Recovery Confirmation
                        </strong>
                        <span class="text-dark small fw-semibold">Did you receive your item? Your scheduled recovery time has passed.</span>
                    </div>
                    <div class="d-flex gap-2 flex-wrap">
                        <button class="btn btn-sm btn-success fw-bold py-1.5 px-3" onclick="confirmItemReceipt(true)">
                            <i class="bi bi-check-circle-fill me-1"></i>✓ Yes, I received my item
                        </button>
                        <button class="btn btn-sm btn-outline-secondary fw-bold py-1.5 px-3" onclick="confirmItemReceipt(false)">
                            Not yet
                        </button>
                    </div>
                `;
                return;
            } else {
                // Finder prompt: Confirmation Pending from Lost Owner
                bar.className = "p-3 border-bottom bg-light text-dark d-flex justify-content-between align-items-center flex-wrap gap-2";
                bar.innerHTML = `
                    <div class="d-flex align-items-center gap-2">
                        <i class="bi bi-clock-history text-warning fs-4"></i>
                        <div>
                            <strong class="text-dark d-block">🔔 Recovery Confirmation Pending</strong>
                            <small class="text-muted extra-small">Scheduled recovery time has passed. Awaiting confirmation from lost owner (<strong>${escapeHtml(lostOwnerName)}</strong>).</small>
                        </div>
                    </div>
                    <span class="badge bg-warning text-dark rounded-pill px-3 py-1.5 fw-bold extra-small">Awaiting Owner Confirmation</span>
                `;
                return;
            }
        }

        // DEFAULT VERIFIED STATE: No date set yet or 'Not yet' clicked
        let recInfo = rec
            ? `<strong>${rec.location}</strong> · ${rec.date} @ ${rec.time}`
            : `Ownership Verified by Finder`;

        bar.className = "p-3 border-bottom bg-success-subtle text-dark d-flex justify-content-between align-items-center flex-wrap gap-2";
        bar.innerHTML = `
            <div class="d-flex align-items-center gap-2">
                <i class="bi bi-shield-check-fill text-success fs-5"></i>
                <div class="small">
                    <strong class="text-success d-block">✓ Ownership Verified</strong>
                    <span class="text-muted extra-small">${recInfo}</span>
                </div>
            </div>
            <div class="d-flex gap-2 flex-wrap">
                <button class="btn btn-sm btn-primary fw-bold extra-small py-1.5 px-3" onclick="openArrangeRecoveryModal()">
                    <i class="bi bi-calendar-event me-1"></i>${rec ? 'Update Recovery Plan' : 'Arrange Recovery'}
                </button>
                ${isLostOwner ? `
                    <button class="btn btn-sm btn-success fw-bold extra-small py-1.5 px-3" onclick="confirmItemReceipt(true)">
                        <i class="bi bi-check-circle-fill me-1"></i>Mark Item as Recovered
                    </button>
                ` : ''}
            </div>
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

    // Also update matching claim in campus_claims
    let claims = typeof getClaims === "function" ? getClaims() : [];
    let linkedClaim = claims.find(c =>
        (c.itemId === currentChat.foundItemId || c.itemId === currentChat.lostItemId) &&
        (
            (c.claimedByEmail && c.claimedByEmail.toLowerCase().trim() === currentChat.lostUserEmail.toLowerCase().trim()) ||
            (c.reporterEmail && c.reporterEmail.toLowerCase().trim() === currentChat.finderEmail.toLowerCase().trim())
        )
    );
    if (linkedClaim) {
        updateClaimStatus(linkedClaim.claimId, "Approved & Meeting Scheduled");
    }
    
    // Post System message inside chat
    let systemMsg = {
        id: "MSG-" + Date.now(),
        senderId: "SYSTEM",
        senderName: "FindIt System",
        text: `✓ Ownership Verified by Finder (${currentUser.username}). Status updated to VERIFIED. Chat is now unlocked so you can coordinate the return.`,
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
        message: `🎉 Claim Approved! Finder ${currentUser.username} verified your ownership for "${currentChat.lostItemName}". Chat is now unlocked so you can coordinate the return.`,
        chatId: currentChatId,
        type: "claim_approved",
        date: new Date().toLocaleString()
    });

    initChatPage();
}

function finderRejectClaim() {
    let currentUser = getCurrentUser();
    let reason = prompt("Enter a brief reason for rejecting this claim (optional):", "Details provided do not match the found item.");
    if (reason === null) return;

    updateChatStatus(currentChatId, "Rejected");

    // Also update matching claim in campus_claims
    let claims = typeof getClaims === "function" ? getClaims() : [];
    let linkedClaim = claims.find(c =>
        (c.itemId === currentChat.foundItemId || c.itemId === currentChat.lostItemId) &&
        (
            (c.claimedByEmail && c.claimedByEmail.toLowerCase().trim() === currentChat.lostUserEmail.toLowerCase().trim()) ||
            (c.reporterEmail && c.reporterEmail.toLowerCase().trim() === currentChat.finderEmail.toLowerCase().trim())
        )
    );
    if (linkedClaim) {
        updateClaimStatus(linkedClaim.claimId, "Rejected", { rejectionReason: reason });
    }

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

    initChatPage();
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

function confirmItemReceipt(isReceived) {
    let currentUser = getCurrentUser();
    let myEmail = currentUser ? currentUser.useremail.toLowerCase().trim() : "";
    let isLostOwner = (currentChat.lostUserEmail || "").toLowerCase().trim() === myEmail;

    // Strict Role Check: ONLY Lost Owner can confirm receipt!
    if (!isLostOwner) {
        alert("Only the lost item owner can confirm receipt of the item.");
        return;
    }

    if (isReceived) {
        // Lost Owner confirms "Yes, I received my item"
        updateChatStatus(currentChatId, "Recovered");

        // System message in chat
        let systemMsg = {
            id: "MSG-" + Date.now(),
            senderId: "SYSTEM",
            senderName: "FindIt System",
            text: `🎉 Item receipt confirmed by owner (${currentUser.username}). Status updated to RECOVERED!`,
            type: "system",
            timestamp: new Date().toISOString(),
            read: true
        };
        sendChatMessage(currentChatId, systemMsg);

        // Update status in campus_reports to "Recovered" (increments landing page stat!)
        let reports = getReports();
        let lostRep = reports.find(r => r.id === currentChat.lostItemId);
        let foundRep = reports.find(r => r.id === currentChat.foundItemId);
        if (lostRep) lostRep.status = "Recovered";
        if (foundRep) foundRep.status = "Recovered";
        localStorage.setItem("campus_reports", JSON.stringify(reports));

        // Notify Finder
        sendNotification({
            id: "NOTIF-" + Date.now(),
            recipientEmail: currentChat.finderEmail,
            senderName: currentUser.username,
            senderEmail: currentUser.useremail,
            itemName: currentChat.lostItemName,
            message: `🎉 Item Recovered! Owner ${currentUser.username} confirmed receipt of "${currentChat.lostItemName}". Thank you for helping our campus community!`,
            chatId: currentChatId,
            type: "item_recovered",
            date: new Date().toLocaleString()
        });

        alert("🎉 Item Recovered! Your item has been successfully marked as recovered.");
        initChatPage();
    } else {
        // Lost Owner clicks "Not yet"
        let systemMsg = {
            id: "MSG-" + Date.now(),
            senderId: "SYSTEM",
            senderName: "FindIt System",
            text: `⏳ Owner indicated item is not yet received. Recovery coordination continues in chat.`,
            type: "system",
            timestamp: new Date().toISOString(),
            read: true
        };
        sendChatMessage(currentChatId, systemMsg);

        // Clear target time so standard verified bar is shown with option to confirm later
        if (currentChat.recoveryDetails) {
            delete currentChat.recoveryDetails.date;
            delete currentChat.recoveryDetails.time;
            updateChatStatus(currentChatId, "Verified", currentChat.recoveryDetails);
        }

        alert("⏳ Recovery confirmation is still pending. You can continue coordinating with the finder through chat.");
        initChatPage();
    }
}

function markItemAsRecovered() {
    confirmItemReceipt(true);
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
