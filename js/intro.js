/* ==========================================================================
   CampusFind - Isolated Animated Loading / Intro Screen JavaScript
   Encapsulated IIFE to ensure zero global scope pollution or side effects
   ========================================================================== */

(function () {
    'use strict';

    function initCampusIntro() {
        const overlay = document.getElementById('campus-intro-overlay');
        if (!overlay) return;

        // Check if this is a manual page reload (F5 / Refresh)
        let isReload = false;
        try {
            const navEntries = performance.getEntriesByType('navigation');
            if (navEntries && navEntries.length > 0 && navEntries[0].type === 'reload') {
                isReload = true;
            }
        } catch (e) {
            /* ignore fallback */
        }

        const alreadyShown = sessionStorage.getItem('campusFindLoadingShown') === 'true';

        // Skip loading screen on internal navigation if already shown and not a manual page refresh
        if (alreadyShown && !isReload) {
            overlay.style.display = 'none';
            document.documentElement.style.overflow = '';
            document.body.style.overflow = '';
            return;
        }

        // Set sessionStorage flag so internal navigation skips loading screen
        sessionStorage.setItem('campusFindLoadingShown', 'true');

        // Prevent document & body scroll during startup intro sequence
        const origBodyOverflow = document.body.style.overflow;
        const origHtmlOverflow = document.documentElement.style.overflow;
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';

        const stages = {
            lost: overlay.querySelector('.campus-intro-stage[data-stage="lost"]'),
            searching: overlay.querySelector('.campus-intro-stage[data-stage="searching"]'),
            found: overlay.querySelector('.campus-intro-stage[data-stage="found"]'),
            reunited: overlay.querySelector('.campus-intro-stage[data-stage="reunited"]')
        };

        const connectors = {
            c1: overlay.querySelector('.campus-intro-connector[data-connector="1"]'),
            c2: overlay.querySelector('.campus-intro-connector[data-connector="2"]'),
            c3: overlay.querySelector('.campus-intro-connector[data-connector="3"]')
        };

        const fillBar = overlay.querySelector('.campus-intro-progress-fill');
        const percentText = overlay.querySelector('.campus-intro-progress-percent');

        // Animation Timeline Parameters
        const TOTAL_DURATION = 2300; // 2.3s to reach 100%
        const FADE_DELAY = 2500;     // 2.5s start smooth fade out
        const REMOVE_DELAY = 3100;   // 3.1s completely hide overlay

        let startTime = null;

        function animateProgress(timestamp) {
            if (!startTime) startTime = timestamp;
            const elapsed = timestamp - startTime;
            const progressRatio = Math.min(elapsed / TOTAL_DURATION, 1);
            const currentPercentage = Math.floor(progressRatio * 100);

            if (fillBar) fillBar.style.width = currentPercentage + '%';
            if (percentText) percentText.textContent = currentPercentage + '%';

            if (progressRatio < 1) {
                requestAnimationFrame(animateProgress);
            } else {
                if (percentText) {
                    percentText.style.color = '#00f5c4';
                    percentText.style.textShadow = '0 0 10px rgba(0, 245, 196, 0.6)';
                }
            }
        }

        // Start progress interpolation immediately
        requestAnimationFrame(animateProgress);

        // Timeline Step 1: LOST activates at 0.5s
        setTimeout(() => {
            if (stages.lost) stages.lost.classList.add('active');
        }, 500);

        // Timeline Step 2: Connector 1 fills & SEARCHING activates at 1.0s
        setTimeout(() => {
            if (connectors.c1) connectors.c1.classList.add('active-1');
            if (stages.searching) stages.searching.classList.add('active');
        }, 1000);

        // Timeline Step 3: Connector 2 fills & FOUND activates at 1.5s
        setTimeout(() => {
            if (connectors.c2) connectors.c2.classList.add('active-2');
            if (stages.found) stages.found.classList.add('active');
        }, 1500);

        // Timeline Step 4: Connector 3 fills & REUNITED activates at 2.0s
        setTimeout(() => {
            if (connectors.c3) connectors.c3.classList.add('active-3');
            if (stages.reunited) stages.reunited.classList.add('active');
        }, 2000);

        // Timeline Step 5: Smooth fade out overlay at 2.5s
        setTimeout(() => {
            overlay.classList.add('fade-out');
        }, FADE_DELAY);

        // Timeline Step 6: Hide overlay completely & restore body scrolling
        setTimeout(() => {
            overlay.style.display = 'none';
            document.documentElement.style.overflow = origHtmlOverflow || '';
            document.body.style.overflow = origBodyOverflow || '';
        }, REMOVE_DELAY);
    }

    // Initialize as soon as DOM structure is parsed
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCampusIntro);
    } else {
        initCampusIntro();
    }
})();
