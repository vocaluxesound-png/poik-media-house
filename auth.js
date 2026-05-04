// Supabase Configuration with PERSISTENT SESSION (Fixes mobile logout)
const API_URL = "https://xxnuhisweolpibzthjcc.supabase.co";
const API_KEY = "sb_publishable_jDMX1LcHK465QrACNqeXVA_WmE7mW0P";
const SB = window.supabase.createClient(API_URL, API_KEY, {
    auth: {
        persistSession: true,
        storageKey: 'poik-poik-auth',
        storage: window.localStorage,
        autoRefreshToken: true,
        detectSessionInUrl: true
    }
});

let USER = null;
let CURRENT_TAB = 'feed';
let SHARE_URL = '';
let timestampInterval = null;

let userLikedPosts = new Set();
let userLikedComments = new Set();
let userDislikedComments = new Set();
let userLikedReplies = new Set();
let userDislikedReplies = new Set();

function escapeHtml(text) { if (!text) return ''; return text.replace(/[&<>]/g, function(m) { if (m === '&') return '&amp;'; if (m === '<') return '&lt;'; if (m === '>') return '&gt;'; return m; }); }

function timeAgo(dateString) {
    if (!dateString) return '';
    const now = new Date();
    const then = new Date(dateString);
    const seconds = Math.floor((now - then) / 1000);
    if (seconds < 60) return 'just now';
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return '1 day ago';
    if (days < 7) return `${days} days ago`;
    return `${Math.floor(days / 7)}w ago`;
}

function updateAllTimestamps() {
    document.querySelectorAll('.comment-time, .reply-time').forEach(el => {
        const timestamp = el.getAttribute('data-timestamp');
        if (timestamp) el.textContent = timeAgo(timestamp);
    });
}

function startTimestampUpdater() {
    if (timestampInterval) clearInterval(timestampInterval);
    timestampInterval = setInterval(updateAllTimestamps, 60000);
}

async function updateHeaderAvatar() {
    const headerAvatar = document.getElementById('headerAvatar');
    if (!headerAvatar) return;
    
    if (USER && USER.id) {
        const { data: profile } = await SB.from("profiles").select("avatar_url").eq("id", USER.id).single();
        if (profile && profile.avatar_url) {
            headerAvatar.innerHTML = `<img src="${profile.avatar_url}" style="width: 100%; height: 100%; object-fit: cover;">`;
            return;
        }
    }
    headerAvatar.innerHTML = '<i class="fas fa-user" style="color: white;"></i>';
}

async function refreshSession() {
    const { data: { session } } = await SB.auth.getSession();
    if (session) {
        const { error } = await SB.auth.refreshSession();
        if (error) console.log("Session refresh error:", error);
    }
}
setInterval(refreshSession, 30 * 60 * 1000);

function openAuthModal() { if (USER) return; document.getElementById('authModal').style.display = 'flex'; }
function closeAuthModal() { document.getElementById('authModal').style.display = 'none'; }
document.getElementById('closeAuthBtn').onclick = closeAuthModal;

document.getElementById('magicLoginBtn').onclick = async () => {
    const email = document.getElementById('authEmail').value;
    if (!email) { alert('Enter your email'); return; }
    const { error } = await SB.auth.signInWithOtp({ 
        email: email.trim(), 
        options: { 
            emailRedirectTo: window.location.origin,
            shouldCreateUser: true
        } 
    });
    if (error) { alert('Error: ' + error.message); } else { alert('Magic link sent! Check your email.'); closeAuthModal(); document.getElementById('authEmail').value = ''; }
};

async function logout() { await SB.auth.signOut(); USER = null; if (timestampInterval) clearInterval(timestampInterval); location.reload(); }

async function handleMagicLink() {
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
        const params = new URLSearchParams(hash.substring(1));
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');
        if (access_token) { await SB.auth.setSession({ access_token, refresh_token }); window.location.href = window.location.pathname; }
    }
}

async function checkAuth() { 
    const { data: { user } } = await SB.auth.getUser(); 
    USER = user; 
    if (USER) {
        await loadUserInteractions();
        await updateHeaderAvatar();
    }
    return user; 
}

async function loadUserInteractions() {
    if (!USER) return;
    
    userLikedPosts.clear();
    userLikedComments.clear();
    userDislikedComments.clear();
    userLikedReplies.clear();
    userDislikedReplies.clear();
    
    const { data: postLikes } = await SB.from("post_likes").select("post_id").eq("user_id", USER.id);
    if (postLikes) postLikes.forEach(l => userLikedPosts.add(Number(l.post_id)));
    
    const { data: commentLikes } = await SB.from("comment_likes").select("comment_id").eq("user_id", USER.id);
    if (commentLikes) commentLikes.forEach(l => userLikedComments.add(Number(l.comment_id)));
    
    const { data: commentDislikes } = await SB.from("comment_dislikes").select("comment_id").eq("user_id", USER.id);
    if (commentDislikes) commentDislikes.forEach(d => userDislikedComments.add(Number(d.comment_id)));
    
    const { data: replyLikes } = await SB.from("reply_likes").select("reply_id").eq("user_id", USER.id);
    if (replyLikes) replyLikes.forEach(l => userLikedReplies.add(Number(l.reply_id)));
    
    const { data: replyDislikes } = await SB.from("reply_dislikes").select("reply_id").eq("user_id", USER.id);
    if (replyDislikes) replyDislikes.forEach(d => userDislikedReplies.add(Number(d.reply_id)));
}

window.openAuthModal = openAuthModal;
window.logout = logout;
window.checkAuth = checkAuth;
window.handleMagicLink = handleMagicLink;
window.updateHeaderAvatar = updateHeaderAvatar;
window.loadUserInteractions = loadUserInteractions;
