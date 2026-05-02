// ========== COMMENT FUNCTIONS ==========
async function addComment(postId) {
    const { data: { user } } = await SB.auth.getUser();
    if (!user) { alert('Login to comment'); openAuthModal(); return; }
    const input = document.getElementById(`comment-input-${postId}`);
    const text = input.value.trim();
    if (!text) { alert('Write a comment first'); return; }
    const { error } = await SB.from("comments").insert({ post_id: postId, user_id: user.id, text: text });
    if (error) { alert("Failed: " + error.message); return; }
    input.value = '';
    await loadCommentsOnly(postId);
    const { count } = await SB.from("comments").select("*", { count: 'exact', head: true }).eq("post_id", postId);
    const countSpan = document.getElementById(`comment-count-${postId}`);
    if (countSpan) countSpan.innerText = count || 0;
}

function toggleComments(postId) {
    const section = document.getElementById(`comments-${postId}`);
    if (section) { const isHidden = section.style.display === 'none'; section.style.display = isHidden ? 'block' : 'none'; if (isHidden) { loadCommentsOnly(postId); } }
}

// ========== COMMENT LIKE/DISLIKE ==========
async function likeComment(commentId) {
    if (!USER) { alert('Login to like'); return; }
    commentId = Number(commentId);
    if (userDislikedComments.has(commentId)) {
        await SB.from("comment_dislikes").delete().eq("comment_id", commentId).eq("user_id", USER.id);
        userDislikedComments.delete(commentId);
        const dislikeBtn = document.getElementById(`comment-dislike-btn-${commentId}`);
        if (dislikeBtn) dislikeBtn.classList.remove('disliked');
    }
    if (userLikedComments.has(commentId)) {
        await SB.from("comment_likes").delete().eq("comment_id", commentId).eq("user_id", USER.id);
        userLikedComments.delete(commentId);
        const likeBtn = document.getElementById(`comment-like-btn-${commentId}`);
        if (likeBtn) likeBtn.classList.remove('liked');
    } else {
        await SB.from("comment_likes").insert({ comment_id: commentId, user_id: USER.id });
        userLikedComments.add(commentId);
        const likeBtn = document.getElementById(`comment-like-btn-${commentId}`);
        if (likeBtn) likeBtn.classList.add('liked');
    }
    const { count: likeCount } = await SB.from("comment_likes").select("*", { count: 'exact', head: true }).eq("comment_id", commentId);
    const { count: dislikeCount } = await SB.from("comment_dislikes").select("*", { count: 'exact', head: true }).eq("comment_id", commentId);
    const likeSpan = document.getElementById(`comment-like-${commentId}`);
    if (likeSpan) likeSpan.innerText = likeCount || 0;
    const dislikeSpan = document.getElementById(`comment-dislike-${commentId}`);
    if (dislikeSpan) dislikeSpan.innerText = dislikeCount || 0;
}

async function dislikeComment(commentId) {
    if (!USER) { alert('Login to dislike'); return; }
    commentId = Number(commentId);
    if (userLikedComments.has(commentId)) {
        await SB.from("comment_likes").delete().eq("comment_id", commentId).eq("user_id", USER.id);
        userLikedComments.delete(commentId);
        const likeBtn = document.getElementById(`comment-like-btn-${commentId}`);
        if (likeBtn) likeBtn.classList.remove('liked');
    }
    if (userDislikedComments.has(commentId)) {
        await SB.from("comment_dislikes").delete().eq("comment_id", commentId).eq("user_id", USER.id);
        userDislikedComments.delete(commentId);
        const dislikeBtn = document.getElementById(`comment-dislike-btn-${commentId}`);
        if (dislikeBtn) dislikeBtn.classList.remove('disliked');
    } else {
        await SB.from("comment_dislikes").insert({ comment_id: commentId, user_id: USER.id });
        userDislikedComments.add(commentId);
        const dislikeBtn = document.getElementById(`comment-dislike-btn-${commentId}`);
        if (dislikeBtn) dislikeBtn.classList.add('disliked');
    }
    const { count: likeCount } = await SB.from("comment_likes").select("*", { count: 'exact', head: true }).eq("comment_id", commentId);
    const { count: dislikeCount } = await SB.from("comment_dislikes").select("*", { count: 'exact', head: true }).eq("comment_id", commentId);
    const likeSpan = document.getElementById(`comment-like-${commentId}`);
    if (likeSpan) likeSpan.innerText = likeCount || 0;
    const dislikeSpan = document.getElementById(`comment-dislike-${commentId}`);
    if (dislikeSpan) dislikeSpan.innerText = dislikeCount || 0;
}

// ========== REPLY FUNCTIONS (ALL FIXED) ==========
async function addReplyToComment(commentId, postId) {
    const { data: { user } } = await SB.auth.getUser();
    if (!user) { alert('Login to reply'); openAuthModal(); return; }
    const input = document.getElementById(`reply-comment-text-${commentId}`);
    const text = input.value.trim();
    if (!text) return;
    const { error } = await SB.from("comment_replies").insert({ comment_id: commentId, user_id: user.id, text: text });
    if (error) { alert("Reply failed: " + error.message); return; }
    input.value = '';
    document.getElementById(`reply-comment-input-${commentId}`).style.display = 'none';
    await loadCommentsOnly(postId);
}

async function addReplyToReply(commentId, parentReplyId, postId) {
    const { data: { user } } = await SB.auth.getUser();
    if (!user) { alert('Login to reply'); openAuthModal(); return; }
    const input = document.getElementById(`reply-text-${parentReplyId}`);
    const text = input.value.trim();
    if (!text) return;
    const { error } = await SB.from("comment_replies").insert({ comment_id: commentId, parent_reply_id: parentReplyId, user_id: user.id, text: text });
    if (error) { alert("Reply failed: " + error.message); return; }
    input.value = '';
    await loadCommentsOnly(postId);
}

// FIXED: Like Reply with proper color toggling
async function likeReply(replyId) {
    if (!USER) { alert('Login to like'); return; }
    replyId = Number(replyId);
    
    // Remove dislike if exists
    if (userDislikedReplies.has(replyId)) {
        await SB.from("reply_dislikes").delete().eq("reply_id", replyId).eq("user_id", USER.id);
        userDislikedReplies.delete(replyId);
        const dislikeBtn = document.getElementById(`reply-dislike-btn-${replyId}`);
        if (dislikeBtn) dislikeBtn.classList.remove('disliked');
    }
    
    // Toggle like
    if (userLikedReplies.has(replyId)) {
        await SB.from("reply_likes").delete().eq("reply_id", replyId).eq("user_id", USER.id);
        userLikedReplies.delete(replyId);
        const likeBtn = document.getElementById(`reply-like-btn-${replyId}`);
        if (likeBtn) likeBtn.classList.remove('liked');
    } else {
        await SB.from("reply_likes").insert({ reply_id: replyId, user_id: USER.id });
        userLikedReplies.add(replyId);
        const likeBtn = document.getElementById(`reply-like-btn-${replyId}`);
        if (likeBtn) likeBtn.classList.add('liked');
    }
    
    // Update counts
    const { count } = await SB.from("reply_likes").select("*", { count: 'exact', head: true }).eq("reply_id", replyId);
    const likeSpan = document.getElementById(`reply-like-${replyId}`);
    if (likeSpan) likeSpan.innerText = count || 0;
}

// FIXED: Dislike Reply with proper color toggling
async function dislikeReply(replyId) {
    if (!USER) { alert('Login to dislike'); return; }
    replyId = Number(replyId);
    
    // Remove like if exists
    if (userLikedReplies.has(replyId)) {
        await SB.from("reply_likes").delete().eq("reply_id", replyId).eq("user_id", USER.id);
        userLikedReplies.delete(replyId);
        const likeBtn = document.getElementById(`reply-like-btn-${replyId}`);
        if (likeBtn) likeBtn.classList.remove('liked');
    }
    
    // Toggle dislike
    if (userDislikedReplies.has(replyId)) {
        await SB.from("reply_dislikes").delete().eq("reply_id", replyId).eq("user_id", USER.id);
        userDislikedReplies.delete(replyId);
        const dislikeBtn = document.getElementById(`reply-dislike-btn-${replyId}`);
        if (dislikeBtn) dislikeBtn.classList.remove('disliked');
    } else {
        await SB.from("reply_dislikes").insert({ reply_id: replyId, user_id: USER.id });
        userDislikedReplies.add(replyId);
        const dislikeBtn = document.getElementById(`reply-dislike-btn-${replyId}`);
        if (dislikeBtn) dislikeBtn.classList.add('disliked');
    }
    
    // Update counts
    const { count } = await SB.from("reply_dislikes").select("*", { count: 'exact', head: true }).eq("reply_id", replyId);
    const dislikeSpan = document.getElementById(`reply-dislike-${replyId}`);
    if (dislikeSpan) dislikeSpan.innerText = count || 0;
}

// FIXED: Delete Comment
async function deleteComment(commentId, postId) {
    if (!confirm('Delete this comment?')) return;
    const { error } = await SB.from("comments").delete().eq("id", commentId);
    if (error) { alert("Delete failed: " + error.message); return; }
    await SB.from("comment_replies").delete().eq("comment_id", commentId);
    await loadCommentsOnly(postId);
    const { count } = await SB.from("comments").select("*", { count: 'exact', head: true }).eq("post_id", postId);
    const countSpan = document.getElementById(`comment-count-${postId}`);
    if (countSpan) countSpan.innerText = count || 0;
}

// FIXED: Delete Reply (WORKING)
async function deleteReply(replyId, postId) {
    console.log("Delete reply - ID:", replyId, "Post ID:", postId);
    
    if (!replyId) {
        alert("Cannot delete: Reply ID missing");
        return;
    }
    
    if (!confirm('Delete this reply?')) return;
    
    const { error } = await SB.from("comment_replies").delete().eq("id", replyId);
    
    if (error) {
        console.error("Delete reply error:", error);
        alert("Failed to delete: " + error.message);
        return;
    }
    
    console.log("Reply deleted successfully!");
    await loadCommentsOnly(postId);
}

// ========== LOAD COMMENTS ONLY (COMPLETE FIXED VERSION) ==========
async function loadCommentsOnly(postId) {
    const commentsList = document.getElementById(`comments-list-${postId}`);
    if (!commentsList) return;
    commentsList.innerHTML = '<div class="comment">Loading comments...</div>';
    
    try {
        const { data: comments } = await SB.from("comments").select("*").eq("post_id", postId).order("created_at", { ascending: true });
        if (!comments || comments.length === 0) { commentsList.innerHTML = '<div class="comment">No comments yet. Be the first!</div>'; return; }
        
        const userIds = [...new Set(comments.map(c => c.user_id).filter(id => id))];
        let profiles = {};
        if (userIds.length > 0) {
            const { data: profileData } = await SB.from("profiles").select("id, username, avatar_url").in("id", userIds);
            if (profileData) { profileData.forEach(p => { profiles[p.id] = p; }); }
        }
        
        const commentIds = comments.map(c => c.id);
        let allReplies = [];
        if (commentIds.length > 0) {
            const { data: replies } = await SB.from("comment_replies").select("*").in("comment_id", commentIds).order("created_at", { ascending: true });
            allReplies = replies || [];
        }
        
        const replyUserIds = [...new Set(allReplies.map(r => r.user_id).filter(id => id))];
        if (replyUserIds.length > 0) {
            const { data: replyProfileData } = await SB.from("profiles").select("id, username, avatar_url").in("id", replyUserIds);
            if (replyProfileData) { replyProfileData.forEach(p => { if (!profiles[p.id]) profiles[p.id] = p; }); }
        }
        
        let html = '';
        for (const c of comments) {
            const { count: likeCount } = await SB.from("comment_likes").select("*", { count: 'exact', head: true }).eq("comment_id", c.id);
            const { count: dislikeCount } = await SB.from("comment_dislikes").select("*", { count: 'exact', head: true }).eq("comment_id", c.id);
            const isLiked = USER && userLikedComments.has(Number(c.id));
            const isDisliked = USER && userDislikedComments.has(Number(c.id));
            const isOwner = USER && USER.id === c.user_id;
            const profile = profiles[c.user_id];
            const commenterName = profile?.username || 'User';
            const commenterAvatar = profile?.avatar_url;
            const commentReplies = allReplies.filter(r => r.comment_id === c.id && !r.parent_reply_id);
            
            let repliesHtml = '';
            for (const r of commentReplies) {
                const { count: rLikes } = await SB.from("reply_likes").select("*", { count: 'exact', head: true }).eq("reply_id", r.id);
                const { count: rDislikes } = await SB.from("reply_dislikes").select("*", { count: 'exact', head: true }).eq("reply_id", r.id);
                const isReplyLiked = USER && userLikedReplies.has(Number(r.id));
                const isReplyDisliked = USER && userDislikedReplies.has(Number(r.id));
                const isReplyOwner = USER && USER.id === r.user_id;
                const replyProfile = profiles[r.user_id];
                const replyerName = replyProfile?.username || 'User';
                const replyerAvatar = replyProfile?.avatar_url;
                
                repliesHtml += `<div class="reply">
                    <div class="reply-header">
                        <div style="display: flex; align-items: center; gap: 6px;">
                            ${replyerAvatar ? `<img src="${replyerAvatar}" class="reply-avatar">` : `<div class="reply-avatar">👤</div>`}
                            <span class="reply-username">${escapeHtml(replyerName)}</span>
                            <span class="reply-time" data-timestamp="${r.created_at}">${timeAgo(r.created_at)}</span>
                        </div>
                        ${isReplyOwner ? `<div class="reply-menu">
                            <button class="reply-menu-btn" onclick="toggleReplyMenu(${r.id})">⋮</button>
                            <div id="reply-menu-${r.id}" class="reply-menu-dropdown" style="display:none;">
                                <div class="reply-menu-option delete" onclick="deleteReply(${r.id}, ${postId})">Delete</div>
                            </div>
                        </div>` : ''}
                    </div>
                    <div class="reply-text">${escapeHtml(r.text)}</div>
                    <div class="reply-actions">
                        <span id="reply-like-btn-${r.id}" class="reply-action ${isReplyLiked ? 'liked' : ''}" onclick="likeReply(${r.id})">❤️ <span id="reply-like-${r.id}">${rLikes || 0}</span></span>
                        <span id="reply-dislike-btn-${r.id}" class="reply-action ${isReplyDisliked ? 'disliked' : ''}" onclick="dislikeReply(${r.id})">👍 <span id="reply-dislike-${r.id}">${rDislikes || 0}</span></span>
                        <span class="reply-action" onclick="showReplyInputForReply(${c.id}, ${r.id}, ${postId})">💬 Reply</span>
                    </div>
                    <div id="reply-input-${r.id}" class="reply-input" style="display:none;">
                        <input type="text" id="reply-text-${r.id}" placeholder="Write a reply...">
                        <button onclick="addReplyToReply(${c.id}, ${r.id}, ${postId})">Reply</button>
                    </div>
                </div>`;
            }
            
            html += `<div class="comment">
                <div class="comment-header">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        ${commenterAvatar ? `<img src="${commenterAvatar}" class="comment-avatar">` : `<div class="comment-avatar">👤</div>`}
                        <span class="comment-username">${escapeHtml(commenterName)}</span>
                        <span class="comment-time" data-timestamp="${c.created_at}">${timeAgo(c.created_at)}</span>
                    </div>
                    ${isOwner ? `<div class="comment-menu">
                        <button class="comment-menu-btn" onclick="toggleCommentMenu(${c.id})">⋮</button>
                        <div id="comment-menu-${c.id}" class="comment-menu-dropdown" style="display:none;">
                            <div class="comment-menu-option delete" onclick="deleteComment(${c.id}, ${postId})">Delete</div>
                        </div>
                    </div>` : ''}
                </div>
                <div class="comment-text">${escapeHtml(c.text)}</div>
                <div class="comment-actions">
                    <span id="comment-like-btn-${c.id}" class="comment-action ${isLiked ? 'liked' : ''}" onclick="likeComment(${c.id})">❤️ <span id="comment-like-${c.id}">${likeCount || 0}</span></span>
                    <span id="comment-dislike-btn-${c.id}" class="comment-action ${isDisliked ? 'disliked' : ''}" onclick="dislikeComment(${c.id})">👍 <span id="comment-dislike-${c.id}">${dislikeCount || 0}</span></span>
                    <span class="comment-action" onclick="showReplyInputForComment(${c.id}, ${postId})">💬 Reply</span>
                </div>
                <div id="reply-comment-input-${c.id}" class="reply-input" style="display:none;">
                    <input type="text" id="reply-comment-text-${c.id}" placeholder="Write a reply...">
                    <button onclick="addReplyToComment(${c.id}, ${postId})">Reply</button>
                </div>
                <div id="replies-container-${c.id}" class="replies">${repliesHtml}</div>
            </div>`;
        }
        commentsList.innerHTML = html;
        updateAllTimestamps();
    } catch (err) {
        console.error("Load comments error:", err);
        commentsList.innerHTML = '<div class="comment">Error loading comments. Please refresh.</div>';
    }
}

// ========== UI MENU FUNCTIONS ==========
function toggleCommentMenu(commentId) { 
    const menu = document.getElementById(`comment-menu-${commentId}`); 
    if (menu) menu.style.display = menu.style.display === 'none' ? 'block' : 'none'; 
}
function toggleReplyMenu(replyId) { 
    const menu = document.getElementById(`reply-menu-${replyId}`); 
    if (menu) menu.style.display = menu.style.display === 'none' ? 'block' : 'none'; 
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('.comment-menu')) { 
        document.querySelectorAll('.comment-menu-dropdown').forEach(m => m.style.display = 'none'); 
    }
    if (!e.target.closest('.reply-menu')) { 
        document.querySelectorAll('.reply-menu-dropdown').forEach(m => m.style.display = 'none'); 
    }
});

// ========== REPLY INPUT TOGGLE ==========
let activeReplyCommentId = null;
let activeReplyReplyId = null;

function showReplyInputForComment(commentId, postId) {
    if (activeReplyCommentId) { 
        const prev = document.getElementById(`reply-comment-input-${activeReplyCommentId}`); 
        if (prev) prev.style.display = 'none'; 
    }
    if (activeReplyReplyId) { 
        const prev = document.getElementById(`reply-input-${activeReplyReplyId}`); 
        if (prev) prev.style.display = 'none'; 
    }
    const replyDiv = document.getElementById(`reply-comment-input-${commentId}`);
    if (replyDiv) { 
        replyDiv.style.display = replyDiv.style.display === 'none' ? 'flex' : 'none'; 
        activeReplyCommentId = commentId; 
        activeReplyReplyId = null; 
    }
}

function showReplyInputForReply(commentId, replyId, postId) {
    if (activeReplyReplyId) { 
        const prev = document.getElementById(`reply-input-${activeReplyReplyId}`); 
        if (prev) prev.style.display = 'none'; 
    }
    if (activeReplyCommentId) { 
        const prev = document.getElementById(`reply-comment-input-${activeReplyCommentId}`); 
        if (prev) prev.style.display = 'none'; 
    }
    const replyDiv = document.getElementById(`reply-input-${replyId}`);
    if (replyDiv) { 
        replyDiv.style.display = replyDiv.style.display === 'none' ? 'flex' : 'none'; 
        activeReplyReplyId = replyId; 
        activeReplyCommentId = null; 
    }
}
