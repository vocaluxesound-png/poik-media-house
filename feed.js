// ========== FEED FUNCTIONS ==========

// Make sure loadCommentsOnly is available (from comments.js)
window.loadCommentsOnly = loadCommentsOnly;

async function loadFeed() {
    const feedDiv = document.getElementById("feed");
    if (!feedDiv) return;
    
    feedDiv.innerHTML = '<div class="loading">Loading posts...</div>';
    
    try {
        const { data: posts, error } = await SB.from("posts").select("*").order("id", { ascending: false });
        
        if (error) throw error;
        
        if (!posts || posts.length === 0) {
            feedDiv.innerHTML = '<div class="loading">No posts yet. Create your first post!</div>';
            return;
        }
        
        // Get user profiles
        const userIds = [...new Set(posts.filter(p => p.user_id && !p.is_ai).map(p => p.user_id))];
        let profiles = {};
        
        if (userIds.length > 0) {
            const { data: profileData } = await SB.from("profiles").select("id, username, avatar_url").in("id", userIds);
            if (profileData) {
                profileData.forEach(p => { profiles[p.id] = p; });
            }
        }
        
        let html = '';
        
        for (const p of posts) {
            const { count: likeCount } = await SB.from("post_likes").select("*", { count: 'exact', head: true }).eq("post_id", p.id);
            const isLiked = USER && userLikedPosts.has(Number(p.id));
            
            // Get comment count
            const { count: commentCount } = await SB.from("comments").select("*", { count: 'exact', head: true }).eq("post_id", p.id);
            
            let displayName = 'Poik Poik';
            let avatarHtml = '';
            
            if (p.is_ai) {
                displayName = 'Poik Poik';
                avatarHtml = '<div class="m-logo"><div class="tri tri1"></div><div class="tri tri2"></div><div class="tri tri3"></div><div class="tri tri4"></div></div>';
            } else if (p.user_id && profiles[p.user_id]) {
                displayName = profiles[p.user_id].username || 'Member';
                avatarHtml = profiles[p.user_id].avatar_url ? 
                    `<img src="${profiles[p.user_id].avatar_url}" class="user-avatar" onclick="viewProfile('${p.user_id}')" style="cursor: pointer;">` : 
                    '<div class="m-logo"><div class="tri tri1"></div><div class="tri tri2"></div><div class="tri tri3"></div><div class="tri tri4"></div></div>';
            } else {
                displayName = 'Member';
                avatarHtml = '<div class="m-logo"><div class="tri tri1"></div><div class="tri tri2"></div><div class="tri tri3"></div><div class="tri tri4"></div></div>';
            }
            
            html += `
                <div class="post">
                    <div class="post-header">
                        <div class="post-header-left">
                            ${avatarHtml}
                            <div class="post-username" onclick="viewProfile('${p.user_id}')" style="cursor: pointer;">${escapeHtml(displayName)}</div>
                        </div>
                    </div>
                    <img class="post-image" src="${p.image_url}" onclick="openModal('${p.image_url}')" loading="lazy">
                    <div class="post-caption">${escapeHtml(p.caption || '')}</div>
                    <div class="post-actions-right">
                        <div id="like-btn-${p.id}" class="action-icon ${isLiked ? 'liked' : ''}" onclick="likePost(${p.id})">
                            <i class="fas fa-heart"></i>
                            <span id="likes-${p.id}">${likeCount || 0}</span>
                        </div>
                        <div class="action-icon" onclick="toggleComments(${p.id})">
                            <i class="far fa-comment-dots"></i>
                            <span id="comment-count-${p.id}">${commentCount || 0}</span>
                        </div>
                        <div class="action-icon share-icon" onclick="openShareModal('${p.image_url}')">
                            <i class="fas fa-paper-plane"></i>
                            <span>Share</span>
                        </div>
                        <div class="action-icon" onclick="alert('Saved!')">
                            <i class="far fa-bookmark"></i>
                            <span>Save</span>
                        </div>
                    </div>
                    <div class="comments-section" id="comments-${p.id}" style="display:none">
                        <div class="comments-header">
                            <span class="comments-title">💬 Comments (${commentCount || 0})</span>
                            <button class="close-comments" onclick="document.getElementById('comments-${p.id}').style.display='none'">✕</button>
                        </div>
                        <div id="comments-list-${p.id}">Click to load comments</div>
                        <div class="comment-input">
                            <input type="text" id="comment-input-${p.id}" placeholder="Add comment...">
                            <button onclick="addComment(${p.id})">Post</button>
                        </div>
                    </div>
                </div>
            `;
        }
        
        feedDiv.innerHTML = html;
        
    } catch (err) {
        console.error("Feed error:", err);
        feedDiv.innerHTML = `<div class="loading" style="color: #ff4444;">Error: ${err.message}</div>`;
    }
}

// View Profile function
async function viewProfile(userId) {
    if (!USER) { alert('Please login'); openAuthModal(); return; }
    
    const feedDiv = document.getElementById("feed");
    feedDiv.innerHTML = '<div class="loading">Loading profile...</div>';
    
    try {
        const { data: profile, error } = await SB.from("profiles").select("*").eq("id", userId).single();
        if (error) throw error;
        
        const { data: posts } = await SB.from("posts").select("*").eq("user_id", userId).order("id", { ascending: false });
        
        const avatarHtml = profile?.avatar_url ? `<img src="${profile.avatar_url}" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover;">` : '👤';
        
        let html = `
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <button onclick="loadFeed()" style="background: #333; color: white; border: none; padding: 8px 16px; border-radius: 20px; margin-bottom: 20px; cursor: pointer;">← Back to Feed</button>
                <div style="text-align: center;">
                    <div style="width: 100px; height: 100px; margin: 0 auto 15px;">${avatarHtml}</div>
                    <h2>${escapeHtml(profile?.username || 'User')}</h2>
                    <div style="color: #888; margin-bottom: 10px;">@${escapeHtml(profile?.username || 'user')}</div>
                    <div style="color: #aaa; margin-bottom: 20px;">${escapeHtml(profile?.bio || 'No bio yet')}</div>
                    <div style="display: flex; justify-content: center; gap: 30px; margin-bottom: 20px;">
                        <div><strong>${posts?.length || 0}</strong><br>posts</div>
                        <div><strong>0</strong><br>followers</div>
                        <div><strong>0</strong><br>following</div>
                    </div>
                    ${userId !== USER?.id ? `
                        <button id="profile-follow-btn" onclick="toggleFollowFromProfile('${userId}')" style="background: #00ff88; color: black; border: none; padding: 10px 30px; border-radius: 30px; font-weight: bold; cursor: pointer;">Follow</button>
                    ` : ''}
                </div>
                <div style="margin-top: 30px;">
                    <h3 style="margin-bottom: 15px;">Posts</h3>
                    ${posts?.length === 0 ? '<div style="color: #888; text-align: center;">No posts yet</div>' : ''}
                    ${posts?.map(p => `<div style="margin-bottom: 20px; background: #0a0a0a; border-radius: 16px; overflow: hidden;">
                        <img src="${p.image_url}" style="width: 100%;" onclick="openModal('${p.image_url}')">
                        <div style="padding: 12px;">${escapeHtml(p.caption || '')}</div>
                    </div>`).join('') || ''}
                </div>
            </div>
        `;
        
        feedDiv.innerHTML = html;
        
        // Update follow button state
        if (userId !== USER?.id) {
            const { data: follows } = await SB.from("follows").select("*").eq("follower", USER.id).eq("following", userId);
            const btn = document.getElementById('profile-follow-btn');
            if (btn && follows && follows.length > 0) {
                btn.innerText = 'Following';
                btn.style.background = '#333';
                btn.style.color = 'white';
            }
        }
        
    } catch (err) {
        console.error("View profile error:", err);
        feedDiv.innerHTML = `<div class="loading" style="color: #ff4444;">Error loading profile</div>`;
    }
}

async function toggleFollowFromProfile(userId) {
    const btn = document.getElementById('profile-follow-btn');
    if (!btn) return;
    
    const { data: existing } = await SB.from("follows").select("*").eq("follower", USER.id).eq("following", userId);
    
    if (existing && existing.length > 0) {
        await SB.from("follows").delete().eq("follower", USER.id).eq("following", userId);
        btn.innerText = 'Follow';
        btn.style.background = '#00ff88';
        btn.style.color = 'black';
    } else {
        await SB.from("follows").insert({ follower: USER.id, following: userId });
        btn.innerText = 'Following';
        btn.style.background = '#333';
        btn.style.color = 'white';
    }
}

// Make sure functions are global
window.loadFeed = loadFeed;
window.viewProfile = viewProfile;
window.toggleFollowFromProfile = toggleFollowFromProfile;
