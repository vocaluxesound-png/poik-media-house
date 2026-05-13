// ========== GREEN NOTIFICATION PILL ==========

let lastNotificationCounts = { likes: 0, comments: 0, follows: 0, messages: 0 };
let pillTimeout = null;

async function updateNotificationBarCounts() {
    if (!USER) {
        hideNotificationPill();
        return;
    }
    
    const notificationCounts = await getNotificationCounts();
    const messageCount = await getUnreadMessagesCount();
    
    const totalNew = notificationCounts.likes + notificationCounts.comments + notificationCounts.follows + messageCount;
    
    if (totalNew === 0) {
        hideNotificationPill();
        return;
    }
    
    // Only show pill if counts changed (avoid flashing on every update)
    const hasChanged = lastNotificationCounts.likes !== notificationCounts.likes ||
                       lastNotificationCounts.comments !== notificationCounts.comments ||
                       lastNotificationCounts.follows !== notificationCounts.follows ||
                       lastNotificationCounts.messages !== messageCount;
    
    lastNotificationCounts = {
        likes: notificationCounts.likes,
        comments: notificationCounts.comments,
        follows: notificationCounts.follows,
        messages: messageCount
    };
    
    if (hasChanged || totalNew > 0) {
        showNotificationPill(notificationCounts.likes, notificationCounts.comments, notificationCounts.follows, messageCount);
    }
    
    // Auto-hide after 10 seconds if no change
    if (pillTimeout) clearTimeout(pillTimeout);
    pillTimeout = setTimeout(() => {
        if (document.getElementById('notification-pill')) {
            hideNotificationPill();
        }
    }, 10000);
}

function showNotificationPill(likes, comments, follows, messages) {
    let existingPill = document.getElementById('notification-pill');
    if (existingPill) {
        existingPill.remove();
    }
    
    // Build pill HTML only showing items with counts > 0
    let pillContent = '';
    
    if (likes > 0) pillContent += `<span class="pill-item"><i class="fas fa-heart" style="color: black;"></i> ${likes}</span>`;
    if (comments > 0) pillContent += `<span class="pill-item"><i class="fas fa-comment" style="color: black;"></i> ${comments}</span>`;
    if (follows > 0) pillContent += `<span class="pill-item"><i class="fas fa-user-plus" style="color: black;"></i> ${follows}</span>`;
    if (messages > 0) pillContent += `<span class="pill-item"><i class="fas fa-envelope" style="color: black;"></i> ${messages}</span>`;
    
    if (pillContent === '') return;
    
    const pill = document.createElement('div');
    pill.id = 'notification-pill';
    pill.className = 'notification-pill';
    pill.innerHTML = `
        <div class="pill-inner">
            ${pillContent}
        </div>
        <div class="pill-pointer"></div>
    `;
    pill.onclick = () => {
        hideNotificationPill();
        bottomNav('inbox');
    };
    
    document.body.appendChild(pill);
}

function hideNotificationPill() {
    const pill = document.getElementById('notification-pill');
    if (pill) {
        pill.remove();
    }
}

// Poll for new counts every 10 seconds
if (USER) {
    updateNotificationBarCounts();
    setInterval(updateNotificationBarCounts, 10000);
}

// Update when page becomes visible again
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && USER) {
        updateNotificationBarCounts();
    }
});

window.updateNotificationBarCounts = updateNotificationBarCounts;
window.showNotificationPill = showNotificationPill;
window.hideNotificationPill = hideNotificationPill;
