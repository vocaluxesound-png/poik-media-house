// ========== DUAL-PANE CHAT WITH VOICE/IMAGE/VIDEO MESSAGES ==========

let chatContacts = [];
let currentChatUser = null;
let chatMessages = [];
let chatPollInterval = null;
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let recordingStartTime = null;

// Voice recording timer
let recordingTimer = null;

// Open chat from profile or inbox
async function openAdvancedChat(userId) {
    currentChatUser = userId;
    
    // Mark messages as read
    await markMessagesRead(userId);
    await showGreenPill();
    await updateGreenDot();
    
    // Get user profile
    const { data: profile } = await SB
        .from("profiles")
        .select("id, username, avatar_url, last_seen")
        .eq("id", userId)
        .single();
    
    const chatContainer = document.getElementById('chat-container-main');
    if (!chatContainer) {
        // If called from profile, load inbox first
        if (typeof loadSimpleInbox === 'function') {
            await loadSimpleInbox();
            setTimeout(() => openAdvancedChat(userId), 500);
        }
        return;
    }
    
    const isOnline = profile?.last_seen ? (new Date() - new Date(profile.last_seen)) < 120000 : false;
    
    // Render chat pane
    chatContainer.innerHTML = `
        <div class="chat-messages-pane">
            <div style="display:flex; align-items:center; gap:12px; padding:12px 16px; border-bottom:1px solid #333; background:#0a0a0a;">
                <button onclick="closeAdvancedChat()" class="close-chat-btn" style="background:none; border:none; color:#00ff88; font-size:20px; cursor:pointer;">←</button>
                <div onclick="goToProfileFromChat('${userId}')" style="display:flex; align-items:center; gap:12px; cursor:pointer; flex:1;">
                    <div style="position:relative;">
                        ${profile?.avatar_url ? `<img src="${profile.avatar_url}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;">` : `<div style="width:40px; height:40px; border-radius:50%; background:#333; display:flex; align-items:center; justify-content:center;">👤</div>`}
                        ${isOnline ? '<div style="position:absolute; bottom:0px; right:0px; width:10px; height:10px; background:#00ff88; border-radius:50%; border:2px solid #0a0a0a;"></div>' : ''}
                    </div>
                    <div>
                        <div style="font-weight:bold;">${escapeHtml(profile?.username || 'User')}</div>
                        <div style="font-size:10px; color:${isOnline ? '#00ff88' : '#888'};">${isOnline ? '🟢 Active now' : (profile?.last_seen ? `Last seen ${timeAgo(profile.last_seen)}` : 'Offline')}</div>
                    </div>
                </div>
            </div>
            <div id="advanced-chat-messages" class="chat-messages-area" style="flex:1; overflow-y:auto; padding:16px; display:flex; flex-direction:column; gap:8px;">
                <div class="loading">Loading messages...</div>
            </div>
            
            <!-- Glass-morphism Input Area -->
            <div class="chat-attachments">
                <button class="attach-btn" onclick="sendImageMessage()" title="Send Image">
                    <i class="fas fa-image"></i>
                </button>
                <button class="attach-btn" onclick="sendVideoMessage()" title="Send Video">
                    <i class="fas fa-video"></i>
                </button>
                <button id="voiceRecordBtn" class="attach-btn voice-record-btn" title="Hold to Record Voice">
                    <i class="fas fa-microphone"></i>
                </button>
            </div>
            <div class="chat-input-glass">
                <input type="text" id="advanced-chat-input" placeholder="Message..." 
                    onkeypress="if(event.key==='Enter') sendAdvancedChatMessage()">
                <button onclick="sendAdvancedChatMessage()">
                    <i class="fas fa-paper-plane"></i>
                </button>
            </div>
        </div>
    `;
    
    // Setup voice recording
    setupVoiceRecording();
    
    // Load messages
    await loadAdvancedChatMessages();
    
    // Start polling for new messages
    if (chatPollInterval) clearInterval(chatPollInterval);
    chatPollInterval = setInterval(loadAdvancedChatMessages, 2000);
    
    // Focus input
    setTimeout(() => {
        const input = document.getElementById('advanced-chat-input');
        if (input) input.focus();
    }, 100);
}

async function loadAdvancedChatMessages() {
    if (!currentChatUser) return;
    
    const result = await getAdvancedMessages(currentChatUser);
    const messages = result.messages;
    const profile = result.profile;
    
    const container = document.getElementById('advanced-chat-messages');
    if (!container) return;
    
    if (messages.length === 0) {
        container.innerHTML = '<div style="text-align:center; color:#888; padding:40px;">No messages yet. Say hi!</div>';
        return;
    }
    
    // Group messages by date
    let currentDate = null;
    let html = '';
    
    for (const msg of messages) {
        const msgDate = new Date(msg.created_at);
        const dateStr = msgDate.toLocaleDateString();
        
        if (currentDate !== dateStr) {
            currentDate = dateStr;
            const displayDate = getDateDisplay(msgDate);
            html += `<div class="date-header">${displayDate}</div>`;
        }
        
        const isMine = msg.sender_id === window.USER.id;
        let contentHtml = '';
        
        // Handle different message types
        if (msg.message_type === 'image' && msg.image_url) {
            contentHtml = `<img src="${msg.image_url}" style="max-width:200px; max-height:200px; border-radius:12px; cursor:pointer;" onclick="openModal('${msg.image_url}')">`;
        } else if (msg.message_type === 'video' && msg.video_url) {
            contentHtml = `
                <div class="video-message" onclick="playVideoMessage('${msg.video_url}')">
                    <video src="${msg.video_url}" style="max-width:200px; max-height:200px; border-radius:12px;"></video>
                    <div class="video-play-icon"><i class="fas fa-play"></i></div>
                </div>
            `;
        } else if (msg.message_type === 'voice' && msg.voice_url) {
            contentHtml = `<audio controls src="${msg.voice_url}" style="max-width:200px; border-radius:20px;"></audio>`;
        } else {
            contentHtml = escapeHtml(msg.message);
        }
        
        html += `
            <div style="display:flex; justify-content:${isMine ? 'flex-end' : 'flex-start'}; margin-bottom:8px;">
                <div style="max-width:70%;">
                    <div class="message-bubble ${isMine ? 'message-bubble-mine' : 'message-bubble-theirs'}">
                        ${contentHtml}
                        <div style="font-size:9px; color:${isMine ? '#006644' : '#888'}; margin-top:4px;">${timeAgo(msg.created_at)}</div>
                    </div>
                </div>
            </div>
        `;
    }
    
    const oldScrollHeight = container.scrollHeight;
    const oldScrollTop = container.scrollTop;
    const wasAtBottom = oldScrollTop + container.clientHeight >= oldScrollHeight - 50;
    
    container.innerHTML = html;
    
    if (wasAtBottom) {
        container.scrollTop = container.scrollHeight;
    } else {
        container.scrollTop = oldScrollTop;
    }
}

async function getAdvancedMessages(userId) {
    if (!window.USER) return { messages: [], profile: null };
    try {
        const { data } = await SB
            .from("messages")
            .select("*")
            .or(`and(sender_id.eq.${window.USER.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${window.USER.id})`)
            .order("created_at", { ascending: true });
        
        const { data: profile } = await SB
            .from("profiles")
            .select("avatar_url, username, last_seen, id")
            .eq("id", userId)
            .single();
        
        return { messages: data || [], profile: profile };
    } catch(e) {
        return { messages: [], profile: null };
    }
}

async function sendAdvancedChatMessage() {
    const input = document.getElementById('advanced-chat-input');
    const message = input?.value.trim();
    if (!message || !currentChatUser) return;
    
    input.value = '';
    await sendSimpleMessage(currentChatUser, message);
    await loadAdvancedChatMessages();
}

// Voice Recording Functions
function setupVoiceRecording() {
    const voiceBtn = document.getElementById('voiceRecordBtn');
    if (!voiceBtn) return;
    
    voiceBtn.addEventListener('mousedown', startVoiceRecording);
    voiceBtn.addEventListener('mouseup', stopVoiceRecording);
    voiceBtn.addEventListener('mouseleave', cancelVoiceRecording);
    voiceBtn.addEventListener('touchstart', startVoiceRecording);
    voiceBtn.addEventListener('touchend', stopVoiceRecording);
}

async function startVoiceRecording(e) {
    e.preventDefault();
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        
        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };
        
        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            await sendVoiceMessage(audioBlob);
            stream.getTracks().forEach(track => track.stop());
        };
        
        mediaRecorder.start();
        isRecording = true;
        recordingStartTime = Date.now();
        
        // Update UI
        const voiceBtn = document.getElementById('voiceRecordBtn');
        voiceBtn.classList.add('recording');
        voiceBtn.innerHTML = '<i class="fas fa-stop"></i>';
        
        // Auto-stop after 60 seconds
        if (recordingTimer) clearTimeout(recordingTimer);
        recordingTimer = setTimeout(() => {
            if (isRecording) stopVoiceRecording();
        }, 60000);
        
    } catch (err) {
        console.error("Microphone error:", err);
        alert("Could not access microphone. Please check permissions.");
    }
}

function stopVoiceRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;
        
        const voiceBtn = document.getElementById('voiceRecordBtn');
        voiceBtn.classList.remove('recording');
        voiceBtn.innerHTML = '<i class="fas fa-microphone"></i>';
        
        if (recordingTimer) clearTimeout(recordingTimer);
    }
}

function cancelVoiceRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;
        
        const voiceBtn = document.getElementById('voiceRecordBtn');
        voiceBtn.classList.remove('recording');
        voiceBtn.innerHTML = '<i class="fas fa-microphone"></i>';
        
        if (recordingTimer) clearTimeout(recordingTimer);
    }
}

async function sendVoiceMessage(audioBlob) {
    if (!currentChatUser) return;
    
    const fileName = `voice_${window.USER.id}_${Date.now()}.webm`;
    await SB.storage.from("chat-media").upload(fileName, audioBlob);
    const { data } = SB.storage.from("chat-media").getPublicUrl(fileName);
    
    await SB.from("messages").insert({
        sender_id: window.USER.id,
        receiver_id: currentChatUser,
        message: "🎤 Voice message",
        message_type: "voice",
        voice_url: data.publicUrl,
        is_read: false
    });
    
    await loadAdvancedChatMessages();
}

// Image message
async function sendImageMessage() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file || !currentChatUser) return;
        
        const fileName = `img_${window.USER.id}_${Date.now()}.jpg`;
        await SB.storage.from("chat-media").upload(fileName, file);
        const { data } = SB.storage.from("chat-media").getPublicUrl(fileName);
        
        await SB.from("messages").insert({
            sender_id: window.USER.id,
            receiver_id: currentChatUser,
            message: "📷 Image",
            message_type: "image",
            image_url: data.publicUrl,
            is_read: false
        });
        
        await loadAdvancedChatMessages();
        await showGreenPill();
        await updateGreenDot();
    };
    input.click();
}

// Video message
async function sendVideoMessage() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file || !currentChatUser) return;
        
        const fileName = `vid_${window.USER.id}_${Date.now()}.mp4`;
        await SB.storage.from("chat-media").upload(fileName, file);
        const { data } = SB.storage.from("chat-media").getPublicUrl(fileName);
        
        await SB.from("messages").insert({
            sender_id: window.USER.id,
            receiver_id: currentChatUser,
            message: "🎥 Video",
            message_type: "video",
            video_url: data.publicUrl,
            is_read: false
        });
        
        await loadAdvancedChatMessages();
        await showGreenPill();
        await updateGreenDot();
    };
    input.click();
}

function playVideoMessage(videoUrl) {
    openModal(videoUrl);
}

function closeAdvancedChat() {
    if (chatPollInterval) clearInterval(chatPollInterval);
    chatPollInterval = null;
    currentChatUser = null;
    
    // Reload chats list
    if (typeof renderSimpleChats === 'function') {
        renderSimpleChats();
    }
}

function getDateDisplay(date) {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Expose functions
window.openAdvancedChat = openAdvancedChat;
window.closeAdvancedChat = closeAdvancedChat;
window.sendAdvancedChatMessage = sendAdvancedChatMessage;
window.sendImageMessage = sendImageMessage;
window.sendVideoMessage = sendVideoMessage;
window.playVideoMessage = playVideoMessage;
