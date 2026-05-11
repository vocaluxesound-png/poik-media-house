// ============================================================
// NOTIFICATIONS.JS - All notification-related functions
// ============================================================

// ========== COUNT UNREAD NOTIFICATIONS ==========
async function getUnreadNotificationsCount() {
    if (!window.USER) return { likes: 0, comments: 0, follows: 0, total: 0 };
    try {
        let likes = 0, comments = 0, follows = 0;
        const { data: notifications } = await SB
            .from("notifications")
            .select("type")
            .eq("user_id", window.USER.id)
            .eq("is_read", false);
        
        if (notifications) {
            for (const n of notifications) {
                if (n.type === 'like_post' || n.type === 'like_comment' || n.type === 'like_reply') likes++;
                else if (n.type === 'comment' || n.type === 'reply') comments++;
                else if (n.type === 'follow') follows++;
            }
        }
        return { likes, comments, follows, total: likes + comments + follows };
    } catch(e) {
        console.error("Get notifications count error:", e);
        return { likes: 0, comments: 0, follows: 0, total: 0 };
    }
}

// ========== COUNT UNREAD MESSAGES ==========
async function getUnreadMessagesCount() {
    if (!window.USER) return 0;
    try {
        let query = SB
            .from("messages")
            .select("*", { count: 'exact', head: true })
            .eq("receiver_id", window.USER.id)
            .eq("is_read", false);
        
        if (window.currentOpenChatUserId) {
            query = query.neq("sender_id", window.currentOpenChatUserId);
        }
        const { count } = await query;
        return count || 0;
    } catch(e) {
        console.error("Get messages count error:", e);
        return 0;
    }
}

// ========== LOAD ALL COUNTS FOR GREEN PILL ==========
async function loadNotificationCounts() {
    if (!window.USER) return;
    const notifCounts = await getUnreadNotificationsCount();
    const msgCount = await getUnreadMessagesCount();
    
    if (typeof window.showGreenPill === 'function') {
        window.showGreenPill(notifCounts, msgCount);
    }
    if (typeof window.updateInboxBadge === 'function') {
        window.updateInboxBadge(msgCount);
    }
    if (typeof window.updateTabBadges === 'function') {
        window.updateTabBadges();
    }
    
    return { notifCounts, msgCount };
}

// ========== MARK ALL NOTIFICATIONS AS READ ==========
async function markAllNotificationsRead() {
    if (!window.USER) return;
    await SB.from("notifications").update({ is_read: true }).eq("user_id", window.USER.id);
    await loadNotificationCounts();
}

// ========== LOAD ACTIVITY FEED ==========
async function loadActivity() {
    if (!window.USER) return [];
    try {
        const { data: notifications } = await SB
            .from("notifications")
            .select(`
                *,
                actor:actor_id(id, username, avatar_url),
                post:posts(id, image_url, caption)
            `)
            .eq("user_id", window.USER.id)
            .order("created_at", { ascending: false })
            .limit(50);
        
        return notifications || [];
    } catch(e) {
        console.error("Load activity error:", e);
        return [];
    }
}

// ========== CREATE NOTIFICATION ==========
async function createNotification(type, userId, actorId, targetId, postId = null) {
    if (!userId || userId === actorId) return;
    try {
        const { data: recent } = await SB
            .from("notifications")
            .select("id")
            .eq("user_id", userId)
            .eq("actor_id", actorId)
            .eq("type", type)
            .eq("target_id", targetId || 0)
            .gte("created_at", new Date(Date.now() - 10000).toISOString());
        
        if (recent && recent.length > 0) return;
        
        await SB.from("notifications").insert({
            user_id: userId,
            actor_id: actorId,
            type: type,
            target_id: targetId || 0,
            is_read: false
        });
        
        await loadNotificationCounts();
    } catch(e) {
        console.error("Create notification error:", e);
    }
}

// ========== RENDER ACTIVITY TAB HTML ==========
function renderActivityHTML(notifications) {
    if (!notifications || notifications.length === 0) {
        return '<div style="text-align:center;padding:60px;color:#888;">No notifications yet</div>';
    }
    
    let html = '<div style="padding:8px 0;">';
    for (const n of notifications) {
        const actorName = n.actor?.username || 'Someone';
        const actorId = n.actor_id;
        const postId = n.target_id;
        const postImage = n.post?.image_url;
        const postCaption = n.post?.caption;
        const timeText = window.timeAgo ? window.timeAgo(n.created_at) : 'recently';
        
        let icon = '📢';
        let actionText = '';
        let clickAction = '';
        
        if (n.type === 'follow') {
            icon = '👤';
            actionText = 'started following you';
            clickAction = `viewProfile('${actorId}')`;
        }
        else if (n.type === 'like_post' || n.type === 'like_comment' || n.type === 'like_reply') {
            icon = '❤️';
            actionText = 'liked your post';
            clickAction = `viewPostAndComments(${postId})`;
        }
        else if (n.type === 'comment' || n.type === 'reply') {
            icon = '💬';
            actionText = 'commented on your post';
            clickAction = `viewPostAndComments(${postId})`;
        }
        
        html += `
            <div onclick="${clickAction}" style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid #1a1a1a;cursor:pointer;">
                <div style="width:40px;height:40px;border-radius:50%;background:#1a1a1a;display:flex;align-items:center;justify-content:center;font-size:20px;">${icon}</div>
                <div style="flex:1;">
                    <div><strong>${window.escapeHtml ? window.escapeHtml(actorName) : actorName}</strong> ${actionText}</div>
                    ${postImage ? `<div style="display:flex;align-items:center;gap:8px;margin-top:5px;"><img src="${postImage}" style="width:40px;height:40px;border-radius:8px;object-fit:cover;"><span style="font-size:11px;color:#888;">${window.escapeHtml ? window.escapeHtml(postCaption?.substring(0,40) || 'Post') : (postCaption?.substring(0,40) || 'Post')}</span></div>` : ''}
                    <div style="font-size:10px;color:#888;margin-top:4px;">${timeText}</div>
                </div>
                ${!n.is_read ? '<div style="width:8px;height:8px;background:#00ff88;border-radius:50%;"></div>' : ''}
            </div>
        `;
    }
    html += '</div>';
    return html;
}

// ========== SHOW GREEN PILL ==========
function showGreenPill(notifCounts, msgCount) {
    const total = (notifCounts?.total || 0) + (msgCount || 0);
    if (total === 0) {
        hideGreenPill();
        return;
    }
    
    let existingPill = document.getElementById('notification-pill');
    if (existingPill) existingPill.remove();
    
    let pillContent = '';
    if (notifCounts?.likes > 0) pillContent += `<span class="pill-item"><i class="fas fa-heart" style="color:black;"></i> ${notifCounts.likes}</span>`;
    if (notifCounts?.comments > 0) pillContent += `<span class="pill-item"><i class="fas fa-comment" style="color:black;"></i> ${notifCounts.comments}</span>`;
    if (notifCounts?.follows > 0) pillContent += `<span class="pill-item"><i class="fas fa-user-plus" style="color:black;"></i> ${notifCounts.follows}</span>`;
    if (msgCount > 0) pillContent += `<span class="pill-item"><i class="fas fa-envelope" style="color:black;"></i> ${msgCount}</span>`;
    
    if (pillContent === '') return;
    
    const inboxBtn = document.getElementById('inboxNavBtn');
    if (inboxBtn) {
        const rect = inboxBtn.getBoundingClientRect();
        const pill = document.createElement('div');
        pill.id = 'notification-pill';
        pill.className = 'notification-pill';
        pill.style.position = 'fixed';
        pill.style.bottom = (window.innerHeight - rect.top + 5) + 'px';
        pill.style.left = (rect.left + rect.width / 2) + 'px';
        pill.style.transform = 'translateX(-50%)';
        pill.style.zIndex = '1002';
        pill.style.cursor = 'pointer';
        pill.innerHTML = `<div class="pill-inner">${pillContent}</div><div class="pill-pointer"></div>`;
        pill.onclick = () => {
            hideGreenPill();
            if (typeof window.bottomNav === 'function') window.bottomNav('inbox');
            setTimeout(() => {
                if (typeof window.switchInboxTab === 'function') window.switchInboxTab('activity');
            }, 200);
        };
        document.body.appendChild(pill);
    }
}

function hideGreenPill() {
    const pill = document.getElementById('notification-pill');
    if (pill) pill.remove();
}

// ========== UPDATE INBOX BADGE (only messages) ==========
function updateInboxBadge(msgCount) {
    const greenDot = document.getElementById('inboxGreenDot');
    if (greenDot) {
        if (msgCount > 0) greenDot.classList.add('show');
        else greenDot.classList.remove('show');
    }
}

// ========== UPDATE TAB BADGES ==========
async function updateTabBadges() {
    const notifCounts = await getUnreadNotificationsCount();
    const msgCount = await getUnreadMessagesCount();
    
    const chatsBadge = document.getElementById('chats-badge');
    if (chatsBadge) {
        if (msgCount > 0) {
            chatsBadge.style.display = 'inline-block';
            chatsBadge.innerText = msgCount;
        } else {
            chatsBadge.style.display = 'none';
        }
    }
    
    const activityBadge = document.getElementById('activity-badge');
    if (activityBadge) {
        if (notifCounts.total > 0) {
            activityBadge.style.display = 'inline-block';
            activityBadge.innerText = notifCounts.total;
        } else {
            activityBadge.style.display = 'none';
        }
    }
}

// Expose functions globally
window.getUnreadNotificationsCount = getUnreadNotificationsCount;
window.getUnreadMessagesCount = getUnreadMessagesCount;
window.loadNotificationCounts = loadNotificationCounts;
window.markAllNotificationsRead = markAllNotificationsRead;
window.loadActivity = loadActivity;
window.createNotification = createNotification;
window.renderActivityHTML = renderActivityHTML;
window.showGreenPill = showGreenPill;
window.hideGreenPill = hideGreenPill;
window.updateInboxBadge = updateInboxBadge;
window.updateTabBadges = updateTabBadges;
