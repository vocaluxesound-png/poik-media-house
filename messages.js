// ========== DIRECT MESSAGES SYSTEM ==========

// Send a message
async function sendMessage(receiverId, message) {
    if (!USER) { alert('Login to send messages'); return false; }
    if (!message.trim()) return false;
    
    const { error } = await SB.from("messages").insert({
        sender_id: USER.id,
        receiver_id: receiverId,
        message: message.trim()
    });
    
    if (error) {
        console.error("Send message error:", error);
        return false;
    }
    
    await updateNotificationBarCounts();
    return true;
}

// Get all conversations for current user
async function getConversations() {
    if (!USER) return [];
    
    // Get all messages where user is sender or receiver
    const { data: messages } = await SB
        .from("messages")
        .select(`
            id,
            sender_id,
            receiver_id,
            message,
            is_read,
            created_at
        `)
        .or(`sender_id.eq.${USER.id},receiver_id.eq.${USER.id}`)
        .order("created_at", { ascending: false });
    
    if (!messages || messages.length === 0) return [];
    
    // Group by conversation partner
    const conversations = new Map();
    
    for (const msg of messages) {
        const otherUserId = msg.sender_id === USER.id ? msg.receiver_id : msg.sender_id;
        
        if (!conversations.has(otherUserId)) {
            conversations.set(otherUserId, {
                otherUserId: otherUserId,
                lastMessage: msg.message,
                lastMessageTime: msg.created_at,
                unreadCount: (msg.receiver_id === USER.id && !msg.is_read) ? 1 : 0,
                lastMessageId: msg.id
            });
        } else {
            const conv = conversations.get(otherUserId);
            if (msg.created_at > conv.lastMessageTime) {
                conv.lastMessage = msg.message;
                conv.lastMessageTime = msg.created_at;
                conv.lastMessageId = msg.id;
            }
            if (msg.receiver_id === USER.id && !msg.is_read) {
                conv.unreadCount++;
            }
        }
    }
    
    // Get user profiles for each conversation
    const userIds = [...conversations.keys()];
    const { data: profiles } = await SB
        .from("profiles")
        .select("id, username, avatar_url, last_seen")
        .in("id", userIds);
    
    const profileMap = new Map();
    if (profiles) {
        profiles.forEach(p => profileMap.set(p.id, p));
    }
    
    // Build final conversations array
    const result = [];
    for (const [userId, conv] of conversations) {
        const profile = profileMap.get(userId);
        result.push({
            userId: userId,
            username: profile?.username || 'User',
            avatarUrl: profile?.avatar_url,
            lastMessage: conv.lastMessage,
            lastMessageTime: conv.lastMessageTime,
            unreadCount: conv.unreadCount,
            isOnline: isUserOnline(profile?.last_seen)
        });
    }
    
    // Sort by last message time (newest first)
    result.sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));
    
    return result;
}

// Get messages with a specific user
async function getMessagesWithUser(otherUserId, limit = 50, offset = 0) {
    if (!USER) return [];
    
    const { data: messages } = await SB
        .from("messages")
        .select("*")
        .or(`and(sender_id.eq.${USER.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${USER.id})`)
        .order("created_at", { ascending: true })
        .range(offset, offset + limit - 1);
    
    return messages || [];
}

// Mark messages as read for a conversation
async function markConversationAsRead(otherUserId) {
    if (!USER) return;
    
    await SB
        .from("messages")
        .update({ is_read: true })
        .eq("sender_id", otherUserId)
        .eq("receiver_id", USER.id)
        .eq("is_read", false);
    
    await updateNotificationBarCounts();
}

// Get unread message count
async function getUnreadMessageCount() {
    if (!USER) return 0;
    
    const { count } = await SB
        .from("messages")
        .select("*", { count: 'exact', head: true })
        .eq("receiver_id", USER.id)
        .eq("is_read", false);
    
    return count || 0;
}

// Make functions global
window.sendMessage = sendMessage;
window.getConversations = getConversations;
window.getMessagesWithUser = getMessagesWithUser;
window.markConversationAsRead = markConversationAsRead;
window.getUnreadMessageCount = getUnreadMessageCount;
