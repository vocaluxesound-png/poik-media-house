// ============================================================
// MESSAGES.JS - Direct Message Functions
// ============================================================

// ========== SEND MESSAGE ==========
async function sendMessage(receiverId, message) {
    if (!window.USER || !message.trim()) return false;
    try {
        const { error } = await SB.from("messages").insert({
            sender_id: window.USER.id,
            receiver_id: receiverId,
            message: message.trim(),
            is_read: false
        });
        if (error) return false;
        
        // Update notification counts
        if (typeof updateNotificationBarCounts === 'function') {
            updateNotificationBarCounts();
        }
        return true;
    } catch(e) { return false; }
}

// ========== GET CONVERSATIONS ==========
async function getConversations() {
    if (!window.USER) return [];
    try {
        const { data: messages } = await SB
            .from("messages")
            .select("*")
            .or(`sender_id.eq.${window.USER.id},receiver_id.eq.${window.USER.id}`)
            .order("created_at", { ascending: false });
        
        if (!messages || messages.length === 0) return [];
        
        const convMap = new Map();
        for (const msg of messages) {
            const otherId = msg.sender_id === window.USER.id ? msg.receiver_id : msg.sender_id;
            if (!convMap.has(otherId)) {
                convMap.set(otherId, {
                    userId: otherId,
                    lastMessage: msg.message,
                    lastMessageTime: msg.created_at,
                    unreadCount: (msg.receiver_id === window.USER.id && !msg.is_read) ? 1 : 0
                });
            } else if (new Date(msg.created_at) > new Date(convMap.get(otherId).lastMessageTime)) {
                convMap.get(otherId).lastMessage = msg.message;
                convMap.get(otherId).lastMessageTime = msg.created_at;
            }
        }
        
        const userIds = [...convMap.keys()];
        const { data: profiles } = await SB.from("profiles").select("id, username, avatar_url, last_seen").in("id", userIds);
        const profileMap = new Map();
        if (profiles) profiles.forEach(p => profileMap.set(p.id, p));
        
        const result = [];
        for (const [userId, conv] of convMap) {
            const profile = profileMap.get(userId);
            result.push({
                userId: userId,
                username: profile?.username || 'User',
                avatarUrl: profile?.avatar_url,
                lastMessage: conv.lastMessage,
                lastMessageTime: conv.lastMessageTime,
                unreadCount: conv.unreadCount,
                isOnline: profile?.last_seen ? (new Date() - new Date(profile.last_seen)) < 120000 : false
            });
        }
        result.sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));
        return result;
    } catch(e) { return []; }
}

// ========== GET MESSAGES WITH USER ==========
async function getMessagesWithUser(otherUserId, limit = 50) {
    if (!window.USER) return [];
    try {
        const { data } = await SB
            .from("messages")
            .select("*")
            .or(`and(sender_id.eq.${window.USER.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${window.USER.id})`)
            .order("created_at", { ascending: true })
            .limit(limit);
        return data || [];
    } catch(e) { return []; }
}

// ========== MARK CONVERSATION AS READ ==========
async function markConversationAsRead(otherUserId) {
    if (!window.USER) return;
    await SB.from("messages").update({ is_read: true }).eq("sender_id", otherUserId).eq("receiver_id", window.USER.id).eq("is_read", false);
    if (typeof updateNotificationBarCounts === 'function') {
        updateNotificationBarCounts();
    }
}

// ========== CHECK IF USER IS ONLINE ==========
function isUserOnline(lastSeen) {
    if (!lastSeen) return false;
    const lastSeenDate = new Date(lastSeen);
    const now = new Date();
    const diffMs = now - lastSeenDate;
    const diffMins = diffMs / 1000 / 60;
    return diffMins < 2;
}

// Expose functions globally
window.sendMessage = sendMessage;
window.getConversations = getConversations;
window.getMessagesWithUser = getMessagesWithUser;
window.markConversationAsRead = markConversationAsRead;
window.isUserOnline = isUserOnline;
