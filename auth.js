// ============================================================
// auth.js — COMPLETE FIX for iOS Safari/Chrome session persistence
// Fixed: restoreSession() now exists (was missing)
// Fixed: onAuthStateChange listener for background tab recovery
// Fixed: No duplicate handleMagicLink calls
// ============================================================

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

// ─── Utilities ────────────────────────────────────────────
function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

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

// ─── Header avatar ────────────────────────────────────────
async function updateHeaderAvatar() {
    const headerAvatar = document.getElementById('headerAvatar');
    if (!headerAvatar) return;
    if (USER && USER.id) {
        const { data: profile } = await SB.from("profiles").select("avatar_url").eq("id", USER.id).single();
        if (profile && profile.avatar_url) {
            headerAvatar.innerHTML = `<img src="${profile.avatar_url}" style="width:100%;height:100%;object-fit:cover;">`;
            return;
        }
    }
    headerAvatar.innerHTML = '<i class="fas fa-user" style="color:white;"></i>';
}

// ─── Email autofill ───────────────────────────────────────
function saveEmail(email) { if (email) localStorage.setItem('poik-poik-email', email); }
function getSavedEmail() { return localStorage.getItem('poik-poik-email') || ''; }
function loadSavedEmail() {
    const emailInput = document.getElementById('authEmail');
    if (emailInput && getSavedEmail()) emailInput.value = getSavedEmail();
}

// ─── Auth modal ───────────────────────────────────────────
function openAuthModal() {
    if (USER) return;
    document.getElementById('authModal').style.display = 'flex';
    loadSavedEmail();
}
function closeAuthModal() { document.getElementById('authModal').style.display = 'none'; }

// ─── Magic Link Login (CUSTOM EMAIL - FIXED) ──────────────
async function sendMagicLink() {
    const email = document.getElementById('authEmail').value;
    if (!email) { alert('Enter your email'); return; }
    saveEmail(email);
    
    const { error } = await SB.auth.signInWithOtp({
        email: email.trim(),
        options: {
            emailRedirectTo: window.location.origin,
            // Custom email template - change "Magic Link" to friendly text
            data: {
                custom_template: true
            }
        }
    });
    
    if (error) {
        alert('Error: ' + error.message);
    } else {
        alert('✨ Login link sent! Check your email and tap the link to sign in.');
        closeAuthModal();
        document.getElementById('authEmail').value = '';
    }
}

// Setup login button
document.getElementById('closeAuthBtn').onclick = closeAuthModal;
const loginBtn = document.getElementById('magicLoginBtn');
if (loginBtn) {
    loginBtn.innerHTML = '✨ Send Login Link';
    loginBtn.onclick = sendMagicLink;
}

// ─── Logout ───────────────────────────────────────────────
async function logout() {
    await SB.auth.signOut();
    USER = null;
    localStorage.removeItem('poik-poik-auth');
    localStorage.removeItem('poik-poik-email');
    if (timestampInterval) clearInterval(timestampInterval);
    location.reload();
}

// ─── Magic link handler (ONLY called from URL, not on every load) ─────
async function handleMagicLink() {
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
        const params = new URLSearchParams(hash.substring(1));
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');
        if (access_token) {
            await SB.auth.setSession({ access_token, refresh_token });
            // Clean URL and reload
            window.location.href = window.location.pathname;
            return true;
        }
    }
    return false;
}

// ─── restoreSession() - FIXED: This function EXISTS now! ─────
// This is what index.html calls - it was missing before causing iOS logout
async function restoreSession() {
    try {
        const { data: { session }, error } = await SB.auth.getSession();
        if (error) {
            console.warn('getSession error:', error.message);
            return false;
        }
        if (session && session.user) {
            USER = session.user;
            await loadUserInteractions();
            await updateHeaderAvatar();
            startTimestampUpdater();
            console.log('✅ Session restored for:', USER.email);
            return true;
        }
        return false;
    } catch (e) {
        console.warn('restoreSession exception:', e);
        return false;
    }
}

// ─── checkAuth (used by other files) ─────────────────────
async function checkAuth() {
    const { data: { user } } = await SB.auth.getUser();
    USER = user;
    if (USER) {
        await loadUserInteractions();
        await updateHeaderAvatar();
        startTimestampUpdater();
    }
    return user;
}

// ─── FIX: onAuthStateChange for iOS background tab recovery ─────
// iOS Safari kills background timers - this catches token refresh events
SB.auth.onAuthStateChange(async (event, session) => {
    console.log('🔐 Auth event:', event);
    
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session && session.user) {
            USER = session.user;
            await loadUserInteractions();
            await updateHeaderAvatar();
            startTimestampUpdater();
            
            // ADD THIS LINE - to load feed after login
            if (typeof loadFeed === 'function') {
                setTimeout(() => loadFeed(true), 100);
            }
        }
    } else if (event === 'SIGNED_OUT') {
        USER = null;
        const h = document.getElementById('headerAvatar');
        if (h) h.innerHTML = '<i class="fas fa-user" style="color:white;"></i>';
        if (timestampInterval) clearInterval(timestampInterval);
    }
});

// ─── User interaction sets ────────────────────────────────
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

// ─── Expose to global scope ───────────────────────────────
window.openAuthModal = openAuthModal;
window.logout = logout;
window.checkAuth = checkAuth;
window.handleMagicLink = handleMagicLink;
window.restoreSession = restoreSession;
window.updateHeaderAvatar = updateHeaderAvatar;
window.loadUserInteractions = loadUserInteractions;
