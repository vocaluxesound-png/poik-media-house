// ========== INBOX PAGE (Chats + Activity) ==========

let inboxCurrentTab = 'chats';
let currentChatUser = null;
let chatMessages = [];
let chatInterval = null;

// Main inbox render function
async function loadInbox() {
    const feedDiv = document.getElementById("feed");
    if (!feedDiv) return;
    
    if (!USER) {
        alert('Please login');
        openAuthModal();
        return;
    }
    
    window.isProfileView = true;
    window.isFriendsView = false;
    
    const topNav = document.querySelector('.top-nav');
    if (topNav) topNav.style.display = 'none';
    
    // Mark all notifications as read when opening inbox
    await markAllNotificationsRead();
    
    feedDiv.innerHTML = '<div class="loading">Loading inbox...</div>';
    
    await renderInboxView();
}

async function renderInboxView() {
    const feedDiv = document.getElementById("feed");
    
    let html = `
        <div style="max-width: 600px; margin: 0 auto;">
            <div style="padding: 16px; border-bottom: 1px solid #222;">
                <h2 style="font-size: 20px;">Inbox</h2>
            </div>
            <div style="display: flex; border-bottom: 1px solid #333;">
                <button onclick="switchInboxTab('chats')" style="flex: 1; background: none; border: none; padding: 12px; color: ${inboxCurrentTab === 'chats' ? '#00ff88' : '#888'}; border-bottom: 2px solid ${inboxCurrentTab === 'chats' ? '#00ff88' : 'transparent'}; cursor: pointer; font-weight: bold;">
                    💬 Chats
                </button>
                <button onclick="switchInboxTab('activity')" style="flex: 1; background: none; border: none; padding: 12px; color: ${inboxCurrentTab === 'activity' ? '#00ff88' : '#888'}; border-bottom: 2px solid ${inboxCurrentTab === 'activity' ? '#00ff88' : 'transparent'}; cursor: pointer; font-weight: bold;">
                    🔔 Activity
                </button>
            </div>
            <div id="inbox-content">
                ${inboxCurrentTab === 'chats' ? '<div class="loading">Loading chats...</div>' : '<div class="loading">Loading activity...</div>'}
            </div>
        </div>
    `;
    
    feedDiv.innerHTML = html;
    
    if (inboxCurrentTab === 'chats') {
        await renderChatsList();
    } else {
        await renderActivityList();
    }
}

// Render Chats tab
async function renderChatsList() {
    const container = document.getElementById('inbox-content');
    if (!container) return;
    
    const conversations = await getConversations();
    
    if (conversations.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; color: #888;">
                <i class="fas fa-comment-dots" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
                <p>No messages yet</p>
                <p style="font-size: 12px; margin-top: 8px;">When you message someone, it will appear here</p>
            </div>
        `;
        return;
    }
    
    let html = '<div style="padding: 8px 0;">';
    
    for (const conv of conversations) {
        const timeAgoText = timeAgo(conv.lastMessageTime);
        const onlineIndicator = conv.isOnline 
            ? '<span style="background: #00ff88; width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-left: 6px;"></span>' 
            : '';
        
        html += `
            <div class="chat-item" onclick="openChat('${conv.userId}')" style="display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid #1a1a1a; cursor: pointer;">
                <div style="position: relative;">
                    ${conv.avatarUrl ? 
                        `<img src="${conv.avatarUrl}" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover;">` : 
                        `<div style="width: 50px; height: 50px; border-radius: 50%; background: #333; display: flex; align-items: center; justify-content: center; font-size: 24px;">👤</div>`
                    }
                    ${conv.isOnline ? '<div style="position: absolute; bottom: 2px; right: 2px; width: 12px; height: 12px; background: #00ff88; border-radius: 50%; border: 2px solid #0a0a0a;"></div>' : ''}
                </div>
                <div style="flex: 1;">
                    <div style="display: flex; justify-content: space-between; align-items: baseline;">
                        <span style="font-weight: bold;">${escapeHtml(conv.username)} ${onlineIndicator}</span>
                        <span style="font-size: 10px; color: #888;">${timeAgoText}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 13px; color: ${conv.unreadCount > 0 ? '#00ff88' : '#888'}; ${conv.unreadCount > 0 ? 'font-weight: bold;' : ''}">
                            ${escapeHtml(conv.lastMessage.substring(0, 40))}${conv.lastMessage.length > 40 ? '...' : ''}
                        </span>
                        ${conv.unreadCount > 0 ? `<span style="background: #00ff88; color: black; border-radius: 12px; padding: 2px 8px; font-size: 10px; font-weight: bold;">${conv.unreadCount}</span>` : ''}
                    </div>
                </div>
            </div>
        `;
    }
    
    html += '</div>';
    container.innerHTML = html;
}

// Open chat with specific user
async function openChat(userId) {
    currentChatUser = userId;
    
    // Mark messages as read
    await markConversationAsRead(userId);
    await updateNotificationBarCounts();
    
    // Get user profile
    const { data: profile } = await SB.from("profiles").select("username, avatar_url, last_seen").eq("id", userId).single();
    
    const container = document.getElementById('inbox-content');
    if (!container) return;
    
    const isOnline = isUserOnline(profile?.last_seen);
    const onlineStatusText = isOnline ? '🟢 Active now' : (profile?.last_seen ? `Last seen ${timeAgo(profile.last_seen)}` : 'Offline');
    
    container.innerHTML = `
        <div style="display: flex; flex-direction: column; height: calc(100vh - 180px);">
            <div style="display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid #333; background: #0a0a0a;">
                <button onclick="renderChatsList()" style="background: none; border: none; color: #00ff88; font-size: 20px; cursor: pointer;">←</button>
                <div style="position: relative;">
                    ${profile?.avatar_url ? 
                        `<img src="${profile.avatar_url}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">` : 
                        `<div style="width: 40px; height: 40px; border-radius: 50%; background: #333; display: flex; align-items: center; justify-content: center;">👤</div>`
                    }
                    ${isOnline ? '<div style="position: absolute; bottom: 0px; right: 0px; width: 10px; height: 10px; background: #00ff88; border-radius: 50%; border: 2px solid #0a0a0a;"></div>' : ''}
                </div>
                <div>
                    <div style="font-weight: bold;">${escapeHtml(profile?.username || 'User')}</div>
                    <div style="font-size: 10px; color: ${isOnline ? '#00ff88' : '#888'};">${onlineStatusText}</div>
                </div>
            </div>
            <div id="chat-messages" style="flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 8px;">
                <div class="loading">Loading messages...</div>
            </div>
            <div style="display: flex; gap: 8px; padding: 12px; border-top: 1px solid #333; background: #0a0a0a;">
                <input type="text" id="chat-input" placeholder="Message..." style="flex: 1; padding: 10px; border-radius: 20px; border: none; background: #222; color: white;" onkeypress="if(event.key==='Enter') sendChatMessage()">
                <button onclick="sendChatMessage()" style="background: #00ff88; color: black; border: none; width: 44px; height: 44px; border-radius: 50%; cursor: pointer; font-weight: bold;">➤</button>
            </div>
        </div>
    `;
    
    await loadChatMessages();
    
    // Poll for new messages every 3 seconds
    if (chatInterval) clearInterval(chatInterval);
    chatInterval = setInterval(loadChatMessages, 3000);
}

async function loadChatMessages() {
    if (!currentChatUser) return;
    
    const messages = await getMessagesWithUser(currentChatUser, 100);
    chatMessages = messages;
    
    const container = document.getElementById('chat-messages');
    if (!container) return;
    
    if (messages.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: #888; padding: 40px;">No messages yet. Say hi!</div>';
        return;
    }
    
    let html = '';
    for (const msg of messages) {
        const isMine = msg.sender_id === USER.id;
        html += `
            <div style="display: flex; justify-content: ${isMine ? 'flex-end' : 'flex-start'};">
                <div style="max-width: 70%; padding: 10px 14px; border-radius: 20px; background: ${isMine ? '#00ff88' : '#222'}; color: ${isMine ? 'black' : 'white'}; word-wrap: break-word;">
                    ${escapeHtml(msg.message)}
                    <div style="font-size: 9px; color: ${isMine ? '#006644' : '#888'}; margin-top: 4px;">${timeAgo(msg.created_at)}</div>
                </div>
            </div>
        `;
    }
    
    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
}

async function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    if (!message) return;
    
    input.value = '';
    await sendMessage(currentChatUser, message);
    await loadChatMessages();
}
// Render Activity tab (notifications) - FIXED VERSION
async function renderActivityList() {
    const container = document.getElementById('inbox-content');
    if (!container) return;
    
    container.innerHTML = '<div class="loading">Loading notifications...</div>';
    
    try {
        // DIRECT QUERY to notifications table (bypass getNotifications)
        const { data: notifications, error } = await SB
            .from("notifications")
            .select(`
                *,
                actor:actor_id(id, username, avatar_url)
            `)
            .eq("user_id", window.USER.id)
            .order("created_at", { ascending: false })
            .limit(100);
        
        console.log("🔔 Notifications found:", notifications?.length || 0);
        
        if (error) {
            console.error("Error loading notifications:", error);
            container.innerHTML = '<div style="text-align:center;padding:60px;color:#888;">Error loading notifications</div>';
            return;
        }
        
        if (!notifications || notifications.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; color: #888;">
                    <i class="fas fa-bell" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
                    <p>No notifications yet</p>
                    <p style="font-size: 12px; margin-top: 8px;">When someone interacts with you, it will appear here</p>
                </div>
            `;
            return;
        }
        
        // Group by date
        const today = [];
        const yesterday = [];
        const thisWeek = [];
        const older = [];
        
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterdayStart = new Date(todayStart);
        yesterdayStart.setDate(yesterdayStart.getDate() - 1);
        const weekStart = new Date(todayStart);
        weekStart.setDate(weekStart.getDate() - 7);
        
        for (const n of notifications) {
            const notifDate = new Date(n.created_at);
            if (notifDate >= todayStart) today.push(n);
            else if (notifDate >= yesterdayStart) yesterday.push(n);
            else if (notifDate >= weekStart) thisWeek.push(n);
            else older.push(n);
        }
        
        let html = '<div style="padding: 8px 0;">';
        
        // Render each group
        if (today.length > 0) html += renderNotificationGroupSimple(today, 'Today');
        if (yesterday.length > 0) html += renderNotificationGroupSimple(yesterday, 'Yesterday');
        if (thisWeek.length > 0) html += renderNotificationGroupSimple(thisWeek, 'This Week');
        if (older.length > 0) html += renderNotificationGroupSimple(older, 'Older');
        
        html += '</div>';
        container.innerHTML = html;
        
        // Mark notifications as read after viewing
        await SB.from("notifications").update({ is_read: true }).eq("user_id", window.USER.id);
        
        // Update badges and green pill
        if (typeof updateTabBadges === 'function') await updateTabBadges();
        if (typeof updateNotificationBarCounts === 'function') await updateNotificationBarCounts();
        
    } catch (err) {
        console.error("Render activity error:", err);
        container.innerHTML = '<div style="text-align:center;padding:60px;color:#888;">Error loading notifications</div>';
    }
}

// Simple render function for notification groups
function renderNotificationGroupSimple(notifications, title) {
    if (!notifications || notifications.length === 0) return '';
    
    let html = `<div style="padding: 12px 16px; font-weight: bold; color: #00ff88; border-bottom: 1px solid #333;">${title}</div>`;
    
    for (const n of notifications) {
        const actor = n.actor;
        const actorName = actor?.username || 'Someone';
        const actorId = n.actor_id;
        const timeText = timeAgo(n.created_at);
        
        let icon = '📢';
        let actionText = '';
        let clickHandler = '';
        
        if (n.type === 'follow') {
            icon = '👤';
            actionText = 'started following you';
            clickHandler = `viewProfile('${actorId}')`;
        }
        else if (n.type === 'like_post' || n.type === 'like_comment' || n.type === 'like_reply') {
            icon = '❤️';
            actionText = 'liked your post';
            clickHandler = `viewPostAndComments(${n.target_id})`;
        }
        else if (n.type === 'comment' || n.type === 'reply') {
            icon = '💬';
            actionText = 'commented on your post';
            clickHandler = `viewPostAndComments(${n.target_id})`;
        }
        
        html += `
            <div onclick="${clickHandler}" style="display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid #1a1a1a; cursor: pointer;">
                <div style="width: 40px; height: 40px; border-radius: 50%; background: #1a1a1a; display: flex; align-items: center; justify-content: center; font-size: 20px;">
                    ${icon}
                </div>
                <div style="flex: 1;">
                    <div><strong>${escapeHtml(actorName)}</strong> ${actionText}</div>
                    <div style="font-size: 10px; color: #888; margin-top: 4px;">${timeText}</div>
                </div>
                ${!n.is_read ? '<div style="width: 8px; height: 8px; background: #00ff88; border-radius: 50%;"></div>' : ''}
            </div>
        `;
    }
    
    return html;
}

    
    // Group by date
    const today = [];
    const yesterday = [];
    const thisWeek = [];
    const older = [];
    
    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0));
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    
    for (const n of notifications) {
        const notifDate = new Date(n.created_at);
        if (notifDate >= todayStart) today.push(n);
        else if (notifDate >= yesterdayStart) yesterday.push(n);
        else if (notifDate >= weekStart) thisWeek.push(n);
        else older.push(n);
    }
    
    let html = '<div style="padding: 8px 0;">';
    
    html += await renderNotificationGroup(today, 'Today');
    html += await renderNotificationGroup(yesterday, 'Yesterday');
    html += await renderNotificationGroup(thisWeek, 'This Week');
    html += await renderNotificationGroup(older, 'Older');
    
    html += '</div>';
    container.innerHTML = html;
}

async function renderNotificationGroup(notifications, title) {
    if (notifications.length === 0) return '';
    
    let html = `<div style="padding: 12px 16px; font-weight: bold; color: #00ff88; border-bottom: 1px solid #333;">${title}</div>`;
    
    for (const n of notifications) {
        const actor = n.actor;
        const actorName = actor?.username || 'Someone';
        const timeText = timeAgo(n.created_at);
        
        let icon = '📢';
        let actionText = '';
        let clickHandler = '';
        
        switch (n.type) {
            case 'follow':
                icon = '👤';
                actionText = `started following you`;
                clickHandler = `viewProfile('${n.actor_id}')`;
                break;
            case 'like_post':
                icon = '❤️';
                actionText = `liked your post`;
                clickHandler = `viewPostAndComments(${n.target_id})`;
                break;
            case 'like_comment':
                icon = '❤️';
                actionText = `liked your comment`;
                clickHandler = `viewPostAndComments(${n.target_id})`;
                break;
            case 'like_reply':
                icon = '❤️';
                actionText = `liked your reply`;
                clickHandler = `viewPostAndComments(${n.target_id})`;
                break;
            case 'comment':
                icon = '💬';
                actionText = `commented on your post`;
                clickHandler = `viewPostAndComments(${n.target_id})`;
                break;
            case 'reply':
                icon = '💬';
                actionText = `replied to your comment`;
                clickHandler = `viewPostAndComments(${n.target_id})`;
                break;
        }
        
        html += `
            <div class="notification-item" onclick="${clickHandler}" style="display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid #1a1a1a; cursor: pointer;">
                <div style="width: 40px; height: 40px; border-radius: 50%; background: #1a1a1a; display: flex; align-items: center; justify-content: center; font-size: 20px;">
                    ${icon}
                </div>
                <div style="flex: 1;">
                    <div><strong>${escapeHtml(actorName)}</strong> ${actionText}</div>
                    <div style="font-size: 10px; color: #888;">${timeText}</div>
                </div>
                ${!n.is_read ? '<div style="width: 8px; height: 8px; background: #00ff88; border-radius: 50%;"></div>' : ''}
            </div>
        `;
    }
    
    return html;
}

async function switchInboxTab(tab) {
    inboxCurrentTab = tab;
    if (chatInterval) clearInterval(chatInterval);
    currentChatUser = null;
    await renderInboxView();
}

// Helper to view post and comments
async function viewPostAndComments(postId) {
    // Close inbox and show feed with post comments open
    goToHome();
    setTimeout(() => {
        const commentsSection = document.getElementById(`comments-${postId}`);
        if (commentsSection) {
            commentsSection.style.display = 'block';
            loadCommentsOnly(postId);
            document.getElementById(`post-${postId}`)?.scrollIntoView({ behavior: 'smooth' });
        }
    }, 500);
}

// Make functions global
window.loadInbox = loadInbox;
window.switchInboxTab = switchInboxTab;
window.openChat = openChat;
window.sendChatMessage = sendChatMessage;
window.renderChatsList = renderChatsList;
window.viewPostAndComments = viewPostAndComments;
