// ========== POST MENU ==========
function togglePostMenu(postId) { const menu = document.getElementById(`post-menu-${postId}`); document.querySelectorAll('.post-menu-dropdown').forEach(m => m.style.display = 'none'); menu.style.display = menu.style.display === 'none' ? 'block' : 'none'; }
async function changePostPrivacy(postId, newPrivacy) { await SB.from("posts").update({ privacy: newPrivacy }).eq("id", postId); loadFeed(); }
async function deletePost(postId) { if (confirm('Delete this post?')) { await SB.from("posts").delete().eq("id", postId); loadFeed(); if (CURRENT_TAB === 'profile') loadProfile(); } }
document.addEventListener('click', (e) => { if (!e.target.closest('.post-privacy-menu')) { document.querySelectorAll('.post-menu-dropdown').forEach(m => m.style.display = 'none'); } });

// ========== SHARE ==========
function openShareModal(url) { SHARE_URL = url; document.getElementById('shareModal').style.display = 'block'; }
function closeShareModal() { document.getElementById('shareModal').style.display = 'none'; }
function shareTo(platform) {
    const url = encodeURIComponent(SHARE_URL);
    let link = '';
    if (platform === 'facebook') link = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
    if (platform === 'whatsapp') link = `https://wa.me/?text=${url}`;
    if (platform === 'twitter') link = `https://twitter.com/intent/tweet?url=${url}`;
    if (platform === 'instagram') { alert('Save image first, then post manually.'); closeShareModal(); return; }
    if (link) window.open(link, '_blank');
    closeShareModal();
}
function copyLink() { navigator.clipboard.writeText(SHARE_URL); alert('Link copied!'); closeShareModal(); }

// ========== UI ==========
function openModal(img) { document.getElementById('modalImage').src = img; document.getElementById('imageModal').style.display = 'flex'; }
function closeModal() { document.getElementById('imageModal').style.display = 'none'; }
function openUploadModal() { if (!USER) { alert('Please login first'); openAuthModal(); return; } document.getElementById('uploadModal').style.display = 'block'; }
function closeUploadModal() { document.getElementById('uploadModal').style.display = 'none'; document.getElementById('uploadFile').value = ''; document.getElementById('uploadCaption').value = ''; }
function switchTab(tab) { CURRENT_TAB = tab; loadFeed(); }
function bottomNav(page) {
    document.querySelectorAll('.bottom-nav-item').forEach(item => item.classList.remove('active'));
    if (page === 'home') { document.querySelector('.bottom-nav-item:first-child').classList.add('active'); switchTab('feed'); }
    if (page === 'profile') { document.querySelector('.bottom-nav-item:last-child').classList.add('active'); loadProfile(); }
}

// ========== POST LIKE ==========
async function likePost(postId) {
    if (!USER) { alert('Login to like'); openAuthModal(); return; }
    const { data: existing } = await SB.from("post_likes").select("*").eq("post_id", postId).eq("user_id", USER.id);
    if (existing && existing.length > 0) {
        await SB.from("post_likes").delete().eq("post_id", postId).eq("user_id", USER.id);
        userLikedPosts.delete(Number(postId));
    } else {
        await SB.from("post_likes").insert({ post_id: postId, user_id: USER.id });
        userLikedPosts.add(Number(postId));
    }
    const { count } = await SB.from("post_likes").select("*", { count: 'exact', head: true }).eq("post_id", postId);
    const likeSpan = document.getElementById(`likes-${postId}`);
    if (likeSpan) likeSpan.innerText = count || 0;
    const likeBtn = document.getElementById(`like-btn-${postId}`);
    if (likeBtn) {
        if (userLikedPosts.has(Number(postId))) likeBtn.classList.add('liked');
        else likeBtn.classList.remove('liked');
    }
}

// ========== UPLOAD POST ==========
async function uploadPost() {
    if (!USER) { alert('Login first'); return; }
    const file = document.getElementById("uploadFile").files[0];
    const caption = document.getElementById("uploadCaption").value;
    const privacy = document.getElementById("uploadPrivacy").value;
    if (!file) { alert("Select an image"); return; }
    const fileName = `${USER.id}_${Date.now()}.jpg`;
    await SB.storage.from("post-images").upload(fileName, file);
    const { data } = SB.storage.from("post-images").getPublicUrl(fileName);
    await SB.from("posts").insert({ image_url: data.publicUrl, caption: caption, user_id: USER.id, privacy: privacy, is_ai: false, likes: 0 });
    alert("Posted!"); closeUploadModal(); loadFeed();
}

// ========== LOAD USER INTERACTIONS ==========
async function loadUserInteractions() {
    if (!USER) return;
    userLikedPosts.clear(); userLikedComments.clear(); userDislikedComments.clear(); userLikedReplies.clear(); userDislikedReplies.clear();
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

// ========== LOAD FEED ==========
async function loadFeed() {
    const feedDiv = document.getElementById("feed");
    feedDiv.innerHTML = '<div class="loading">Loading posts...</div>';
    await loadUserInteractions();
    const { data: posts, error } = await SB.from("posts").select("*").order("id", { ascending: false });
    if (error || !posts || posts.length === 0) { feedDiv.innerHTML = '<div class="loading">No posts yet. AI Ghost is creating...</div>'; return; }
    const userIds = [...new Set(posts.filter(p => p.user_id && !p.is_ai).map(p => p.user_id))];
    let profiles = {};
    if (userIds.length > 0) {
        const { data: profileData } = await SB.from("profiles").select("id, username, avatar_url").in("id", userIds);
        if (profileData) profileData.forEach(p => { profiles[p.id] = p; });
    }
    let html = '';
    for (const p of posts) {
        const { count: likeCount } = await SB.from("post_likes").select("*", { count: 'exact', head: true }).eq("post_id", p.id);
        const isLiked = userLikedPosts.has(Number(p.id));
        const { data: commentsData } = await SB.from("comments").select("*").eq("post_id", p.id);
        let totalCommentCount = commentsData.length;
        for (const c of commentsData) {
            const { count: replyCount } = await SB.from("comment_replies").select("*", { count: 'exact', head: true }).eq("comment_id", c.id);
            totalCommentCount += replyCount;
        }
        const isOwner = USER && USER.id === p.user_id;
        let privacyIcon = p.privacy === 'public' ? '🌍' : (p.privacy === 'friends' ? '👥' : '🔒');
        let privacyText = p.privacy === 'public' ? 'Public' : (p.privacy === 'friends' ? 'Friends' : 'Only Me');
        let displayName = 'Poik Poik';
        let avatarHtml = '';
        if (p.is_ai) { displayName = 'Poik Poik'; avatarHtml = `<div class="m-logo"><div class="tri tri1"></div><div class="tri tri2"></div><div class="tri tri3"></div><div class="tri tri4"></div></div>`; }
        else if (p.user_id && profiles[p.user_id]) { displayName = profiles[p.user_id].username || 'Member'; avatarHtml = profiles[p.user_id].avatar_url ? `<img src="${profiles[p.user_id].avatar_url}" class="user-avatar">` : `<div class="m-logo"><div class="tri tri1"></div><div class="tri tri2"></div><div class="tri tri3"></div><div class="tri tri4"></div></div>`; }
        else { displayName = 'Member'; avatarHtml = `<div class="m-logo"><div class="tri tri1"></div><div class="tri tri2"></div><div class="tri tri3"></div><div class="tri tri4"></div></div>`; }
        html += `<div class="post"><div class="post-header"><div class="post-header-left">${avatarHtml}<div class="post-username">${escapeHtml(displayName)}</div></div>${isOwner ? `<div class="post-privacy-menu"><button class="privacy-badge privacy-${p.privacy || 'public'}" onclick="togglePostMenu(${p.id})">${privacyIcon} ${privacyText}</button><div id="post-menu-${p.id}" class="post-menu-dropdown" style="display:none;"><div class="post-menu-option" onclick="changePostPrivacy(${p.id}, 'public')">🌍 Public</div><div class="post-menu-option" onclick="changePostPrivacy(${p.id}, 'friends')">👥 Friends Only</div><div class="post-menu-option" onclick="changePostPrivacy(${p.id}, 'private')">🔒 Only Me</div><div class="post-menu-option delete-option" onclick="deletePost(${p.id})">🗑️ Delete</div></div></div>` : ''}</div><img class="post-image" src="${p.image_url}" onclick="openModal('${p.image_url}')" loading="lazy"><div class="post-caption">${escapeHtml(p.caption || 'Fashion visual')}</div><div class="post-actions-right"><div id="like-btn-${p.id}" class="action-icon ${isLiked ? 'liked' : ''}" onclick="likePost(${p.id})"><i class="fas fa-heart"></i><span id="likes-${p.id}">${likeCount || 0}</span></div><div class="action-icon" onclick="toggleComments(${p.id})"><i class="far fa-comment-dots"></i><span id="comment-count-${p.id}">${totalCommentCount || 0}</span></div><div class="action-icon share-icon" onclick="openShareModal('${p.image_url}')"><i class="fas fa-paper-plane"></i><span>Share</span></div><div class="action-icon" onclick="alert('Saved!')"><i class="far fa-bookmark"></i><span>Save</span></div></div><div class="comments-section" id="comments-${p.id}" style="display:none"><div class="comments-header"><span class="comments-title">💬 Comments (${totalCommentCount || 0})</span><button class="close-comments" onclick="document.getElementById('comments-${p.id}').style.display='none'">✕</button></div><div id="comments-list-${p.id}">Loading comments...</div><div class="comment-input"><input type="text" id="comment-input-${p.id}" placeholder="Add comment..."><button onclick="addComment(${p.id})">Post</button></div></div></div>`;
    }
    feedDiv.innerHTML = html;
    startTimestampUpdater();
}
