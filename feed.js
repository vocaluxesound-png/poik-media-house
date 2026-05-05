// ========== FEED FUNCTIONS ==========

let currentPage = 0;
const POSTS_PER_PAGE = 10;
let isLoading = false;
let hasMorePosts = true;
window.isProfileView = false;
window.isFriendsView = false;  // NEW: For friends page

// Safe avatar function - prevents 400 errors
function getSafeAvatarHtml(avatarUrl, userId, size = 40) {
    const isValidUrl = avatarUrl && avatarUrl.trim() !== '' && avatarUrl.startsWith('http');
    
    if (isValidUrl) {
        return `<img src="${avatarUrl}" class="user-avatar" onclick="viewProfile('${userId}')" style="cursor: pointer; width: ${size}px; height: ${size}px; border-radius: 50%; object-fit: cover;" loading="lazy" onerror="this.onerror=null; this.style.display='none'; this.nextElementSibling.style.display='flex';">`;
    } else {
        return `<div class="avatar-placeholder" onclick="viewProfile('${userId}')" style="cursor: pointer; width: ${size}px; height: ${size}px; border-radius: 50%; background: #333; display: flex; align-items: center; justify-content: center; font-size: ${size/2}px;">👤</div>`;
    }
}

async function loadFeed(reset = true) {
    // DON'T load feed if viewing profile or friends
    if (isProfileView || isFriendsView) {
        console.log("🚫 Skipping feed - other view active");
        return;
    }
    
    const feedDiv = document.getElementById("feed");
    if (!feedDiv) return;
    
    if (reset) {
        currentPage = 0;
        hasMorePosts = true;
        feedDiv.innerHTML = '<div class="loading">Loading posts...</div>';
    }
    if (isLoading) return;
    isLoading = true;
    
    try {
        if (typeof loadUserInteractions === 'function') {
            await loadUserInteractions();
        }
        
        const { data: postsData, error } = await SB
            .rpc('get_fast_feed', {
                limit_num: POSTS_PER_PAGE,
                offset_num: currentPage * POSTS_PER_PAGE
            });
        
        if (error) throw error;
        
        let posts = [];
        if (postsData && typeof postsData === 'string') {
            posts = JSON.parse(postsData);
        } else if (Array.isArray(postsData)) {
            posts = postsData;
        }
        
        if (reset) {
            feedDiv.innerHTML = '';
        }
        
        if (!posts || posts.length === 0) {
            if (reset) {
                feedDiv.innerHTML = '<div class="loading">No posts yet. Create your first post!</div>';
            }
            hasMorePosts = false;
            isLoading = false;
            return;
        }
        
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
            const isLiked = USER && userLikedPosts.has(Number(p.id));
            
            let totalCount = p.comments_count || 0;
            const { count: replyCount } = await SB
                .from("comment_replies")
                .select("*", { count: 'exact', head: true })
                .eq("post_id", p.id);
            if (replyCount > 0) {
                totalCount = totalCount + replyCount;
            }
            
            let displayName = 'Poik Poik';
            let avatarHtml = '';
            
            if (p.is_ai) {
                displayName = 'Poik Poik';
                avatarHtml = '<div class="m-logo"><div class="tri tri1"></div><div class="tri tri2"></div><div class="tri tri3"></div><div class="tri tri4"></div></div>';
            } else if (p.user_id && profiles[p.user_id]) {
                displayName = profiles[p.user_id].username || 'Member';
                avatarHtml = getSafeAvatarHtml(profiles[p.user_id].avatar_url, p.user_id, 40);
            } else {
                displayName = 'Member';
                avatarHtml = '<div class="m-logo"><div class="tri tri1"></div><div class="tri tri2"></div><div class="tri tri3"></div><div class="tri tri4"></div></div>';
            }
            
            html += `
                <div class="post" data-post-id="${p.id}">
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
                            <span id="likes-${p.id}">${p.likes_count || 0}</span>
                        </div>
                        <div class="action-icon" onclick="toggleComments(${p.id})">
                            <i class="far fa-comment-dots"></i>
                            <span id="comment-count-${p.id}">${totalCount || 0}</span>
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
                            <span class="comments-title">💬 Comments (${totalCount || 0})</span>
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
        
        if (reset) {
            feedDiv.innerHTML = html;
        } else {
            feedDiv.insertAdjacentHTML('beforeend', html);
        }
        
        currentPage++;
        if (posts.length < POSTS_PER_PAGE) {
            hasMorePosts = false;
        }
        
    } catch (err) {
        console.error("Feed error:", err);
        if (reset) {
            feedDiv.innerHTML = `<div class="loading" style="color: #ff4444;">Error: ${err.message}</div>`;
        }
    }
    isLoading = false;
}

function setupInfiniteScroll() {
    window.addEventListener('scroll', () => {
        if (isLoading) return;
        if (!hasMorePosts) return;
        if (isProfileView || isFriendsView) return;
        const scrollPosition = window.innerHeight + window.scrollY;
        const bottomPosition = document.body.offsetHeight - 500;
        if (scrollPosition >= bottomPosition) {
            loadFeed(false);
        }
    });
}

function refreshFeed() {
    // Reset all view flags
    isProfileView = false;
    isFriendsView = false;
    currentPage = 0;
    hasMorePosts = true;
    isLoading = false;
    loadFeed(true);
}

// ========== LOAD PROFILE - FIXED ==========
async function loadProfile() {
    // Set flag to prevent feed from loading
    isProfileView = true;
    isFriendsView = false;
    
    if (!USER) { 
        alert('Please login'); 
        openAuthModal(); 
        return; 
    }
    
    const feedDiv = document.getElementById("feed");
    if (!feedDiv) return;
    
    feedDiv.innerHTML = '<div class="loading">Loading profile...</div>';
    
    try {
        // Get profile data
        const { data: profile, error: profileError } = await SB
            .from("profiles")
            .select("*")
            .eq("id", USER.id)
            .single();
        
        if (profileError) throw profileError;
        
        // Get user's posts only
        const { data: posts, error: postsError } = await SB
            .from("posts")
            .select("*")
            .eq("user_id", USER.id)
            .order("created_at", { ascending: false });
        
        if (postsError) throw postsError;
        
        // Get post count
        const { count: postCount } = await SB
            .from("posts")
            .select("*", { count: 'exact', head: true })
            .eq("user_id", USER.id);
        
        // Safe avatar HTML
        const isValidAvatar = profile?.avatar_url && profile.avatar_url.trim() !== '' && profile.avatar_url.startsWith('http');
        const avatarHtml = isValidAvatar ?
            `<img src="${profile.avatar_url}" class="profile-avatar-img" onclick="document.getElementById('avatarInput').click()" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; cursor: pointer;" onerror="this.onerror=null; this.style.display='none'; this.nextElementSibling.style.display='flex';">` :
            `<div class="profile-avatar-placeholder" onclick="document.getElementById('avatarInput').click()" style="width: 80px; height: 80px; border-radius: 50%; background: #333; display: flex; align-items: center; justify-content: center; font-size: 40px; cursor: pointer;">👤</div>`;
        
        const displayName = profile?.username || USER.email?.split('@')[0] || 'User';
        const bio = profile?.bio || 'No bio yet';
        
        let html = `
            <div class="profile-header" style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; background: #0a0a0a; border-radius: 20px; padding: 30px; margin-bottom: 20px;">
                    <div style="width: 100px; height: 100px; margin: 0 auto 15px;">
                        ${avatarHtml}
                    </div>
                    <h2>${escapeHtml(displayName)}</h2>
                    <div style="color: #888; margin-bottom: 10px;">@${escapeHtml(displayName)}</div>
                    <div class="profile-bio" style="color: #aaa; margin-bottom: 20px;">${escapeHtml(bio)}</div>
                    <div class="profile-stats" style="display: flex; justify-content: center; gap: 30px; margin-bottom: 20px;">
                        <div><strong>${postCount || 0}</strong><br>posts</div>
                        <div><strong>0</strong><br>followers</div>
                        <div><strong>0</strong><br>following</div>
                    </div>
                    <button class="edit-profile-btn" onclick="openEditProfile()" style="background: #333; color: white; border: none; padding: 10px 30px; border-radius: 30px; font-weight: bold; cursor: pointer; margin-right: 10px;">Edit Profile</button>
                    <button onclick="goToHome()" style="background: #00ff88; color: black; border: none; padding: 10px 30px; border-radius: 30px; font-weight: bold; cursor: pointer;">Back to Feed</button>
                </div>
                <h3 style="margin-bottom: 15px; padding-left: 10px;">Your Posts</h3>
                <div id="profile-posts-list">
        `;
        
        // Display user's posts
        if (posts && posts.length > 0) {
            for (const p of posts) {
                let privacyIcon = p.privacy === 'public' ? '🌍' : (p.privacy === 'friends' ? '👥' : '🔒');
                let privacyText = p.privacy === 'public' ? 'Public' : (p.privacy === 'friends' ? 'Friends' : 'Only Me');
                
                html += `
                    <div class="post" style="margin-bottom: 20px; background: #0a0a0a; border-radius: 16px; overflow: hidden;">
                        <div class="post-header" style="display: flex; justify-content: space-between; align-items: center; padding: 12px;">
                            <div class="post-header-left" style="display: flex; align-items: center; gap: 10px;">
                                <div class="post-username" style="font-weight: bold;">${escapeHtml(displayName)}</div>
                            </div>
                            <div class="post-privacy-menu" style="position: relative;">
                                <button class="privacy-badge privacy-${p.privacy || 'public'}" onclick="togglePostMenu(${p.id})" style="background: #222; border: none; padding: 4px 10px; border-radius: 20px; cursor: pointer;">${privacyIcon} ${privacyText}</button>
                                <div id="post-menu-${p.id}" class="post-menu-dropdown" style="display:none; position: absolute; right: 0; top: 100%; background: #1a1a1a; border-radius: 10px; padding: 5px; z-index: 100;">
                                    <div class="post-menu-option" onclick="changePostPrivacy(${p.id}, 'public')" style="padding: 8px 15px; cursor: pointer;">🌍 Public</div>
                                    <div class="post-menu-option" onclick="changePostPrivacy(${p.id}, 'friends')" style="padding: 8px 15px; cursor: pointer;">👥 Friends Only</div>
                                    <div class="post-menu-option" onclick="changePostPrivacy(${p.id}, 'private')" style="padding: 8px 15px; cursor: pointer;">🔒 Only Me</div>
                                    <div class="post-menu-option delete-option" onclick="deletePost(${p.id})" style="padding: 8px 15px; cursor: pointer; color: #ff4444;">🗑️ Delete</div>
                                </div>
                            </div>
                        </div>
                        <img class="post-image" src="${p.image_url}" style="width: 100%;" onclick="openModal('${p.image_url}')" loading="lazy">
                        <div class="post-caption" style="padding: 12px;">${escapeHtml(p.caption || 'Fashion visual')}</div>
                    </div>
                `;
            }
        } else {
            html += '<div style="text-align: center; padding: 40px; color: #888;">No posts yet. Click + to upload!</div>';
        }
        
        html += `
                </div>
            </div>
        `;
        
        feedDiv.innerHTML = html;
        
        // Update bottom nav highlight
        document.querySelectorAll('.bottom-nav-item').forEach(item => item.classList.remove('active'));
        const profileBtn = document.querySelector('.bottom-nav-item:last-child');
        if (profileBtn) profileBtn.classList.add('active');
        
        // Hide top nav
        const topNav = document.querySelector('.top-nav');
        if (topNav) topNav.style.display = 'none';
        
    } catch (err) {
        console.error("Load profile error:", err);
        feedDiv.innerHTML = `<div class="loading" style="color: #ff4444;">Error loading profile: ${err.message}</div>`;
    }
}

// ========== VIEW PROFILE (other user) ==========
async function viewProfile(userId) {
    if (!userId) return;
    if (!USER) {
        alert('Please login to view profiles');
        openAuthModal();
        return;
    }
    
    isProfileView = true;
    isFriendsView = false;
    
    const feedDiv = document.getElementById("feed");
    feedDiv.innerHTML = '<div class="loading">Loading profile...</div>';
    
    try {
        const { data: profile, error } = await SB.from("profiles").select("*").eq("id", userId).single();
        if (error) throw error;
        
        const { data: posts } = await SB.from("posts").select("*").eq("user_id", userId).order("created_at", { ascending: false });
        
        let isFollowing = false;
        if (USER && userId !== USER.id) {
            const { data: followCheck } = await SB.from("follows").select("*").eq("follower", USER.id).eq("following", userId);
            isFollowing = followCheck && followCheck.length > 0;
        }
        
        const isValidAvatar = profile?.avatar_url && profile.avatar_url.trim() !== '' && profile.avatar_url.startsWith('http');
        const avatarHtml = isValidAvatar ?
            `<img src="${profile.avatar_url}" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover;">` :
            '<div style="width: 80px; height: 80px; border-radius: 50%; background: #333; display: flex; align-items: center; justify-content: center; font-size: 40px;">👤</div>';
        
        let html = `
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <button onclick="goToHome()" style="background: #333; color: white; border: none; padding: 8px 16px; border-radius: 20px; margin-bottom: 20px; cursor: pointer;">← Back to Feed</button>
                <div style="text-align: center; background: #0a0a0a; border-radius: 20px; padding: 30px; margin-bottom: 20px;">
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
                        <button id="profile-follow-btn" onclick="toggleFollowFromProfile('${userId}')" style="background: ${isFollowing ? '#333' : '#00ff88'}; color: ${isFollowing ? '#fff' : '#000'}; border: none; padding: 10px 30px; border-radius: 30px; font-weight: bold; cursor: pointer;">
                            ${isFollowing ? 'Following' : 'Follow'}
                        </button>
                    ` : ''}
                </div>
                <div style="margin-top: 20px;">
                    <h3 style="margin-bottom: 15px; padding-left: 10px;">Posts</h3>
                    <div id="profile-posts-list">
                        ${posts?.length === 0 ? '<div style="color: #888; text-align: center; padding: 40px;">No posts yet</div>' : ''}
                        ${posts?.map(p => `
                            <div style="margin-bottom: 20px; background: #0a0a0a; border-radius: 16px; overflow: hidden;">
                                <img src="${p.image_url}" style="width: 100%;" onclick="openModal('${p.image_url}')" loading="lazy">
                                <div style="padding: 12px;">${escapeHtml(p.caption || '')}</div>
                            </div>
                        `).join('') || ''}
                    </div>
                </div>
            </div>
        `;
        
        feedDiv.innerHTML = html;
        
        // Update bottom nav highlight
        document.querySelectorAll('.bottom-nav-item').forEach(item => item.classList.remove('active'));
        const profileBtn = document.querySelector('.bottom-nav-item:last-child');
        if (profileBtn) profileBtn.classList.add('active');
        
        // Hide top nav
        const topNav = document.querySelector('.top-nav');
        if (topNav) topNav.style.display = 'none';
        
    } catch (err) {
        console.error("View profile error:", err);
        feedDiv.innerHTML = `<div class="loading" style="color: #ff4444;">Error loading profile: ${err.message}</div>`;
    }
}

function goToHome() {
    // Reset all flags
    isProfileView = false;
    isFriendsView = false;
    
    document.querySelectorAll('.bottom-nav-item').forEach(item => item.classList.remove('active'));
    const homeBtn = document.querySelector('.bottom-nav-item:first-child');
    if (homeBtn) homeBtn.classList.add('active');
    
    const topNav = document.querySelector('.top-nav');
    if (topNav) topNav.style.display = 'flex';
    
    refreshFeed();
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

function togglePostMenu(postId) {
    const menu = document.getElementById(`post-menu-${postId}`);
    if (menu) menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

async function changePostPrivacy(postId, newPrivacy) {
    await SB.from("posts").update({ privacy: newPrivacy }).eq("id", postId);
    refreshFeed();
}

async function deletePost(postId) {
    if (confirm('Delete this post?')) {
        await SB.from("posts").delete().eq("id", postId);
        refreshFeed();
    }
}

function openShareModal(url) {
    SHARE_URL = url;
    document.getElementById('shareModal').style.display = 'block';
}

function closeShareModal() {
    document.getElementById('shareModal').style.display = 'none';
}

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

function copyLink() {
    navigator.clipboard.writeText(SHARE_URL);
    alert('Link copied!');
    closeShareModal();
}

function openModal(img) {
    document.getElementById('modalImage').src = img;
    document.getElementById('imageModal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('imageModal').style.display = 'none';
}

function openUploadModal() {
    if (!USER) { alert('Please login first'); openAuthModal(); return; }
    document.getElementById('uploadModal').style.display = 'block';
}

function closeUploadModal() {
    document.getElementById('uploadModal').style.display = 'none';
    document.getElementById('uploadFile').value = '';
    document.getElementById('uploadCaption').value = '';
}

function switchTab(tab) {
    CURRENT_TAB = tab;
    refreshFeed();
}

function bottomNav(page) {
    document.querySelectorAll('.bottom-nav-item').forEach(item => item.classList.remove('active'));
    
    if (page === 'home') {
        document.querySelector('.bottom-nav-item:first-child').classList.add('active');
        goToHome();  // Use goToHome instead of switchTab directly
    }
    if (page === 'friends') {
        document.querySelector('.bottom-nav-item:nth-child(2)').classList.add('active');
        if (typeof loadFriends === 'function') {
            loadFriends();
        } else {
            document.getElementById("feed").innerHTML = '<div class="loading">Loading friends...</div>';
        }
    }
    if (page === 'inbox') {
        document.querySelector('.bottom-nav-item:nth-child(4)').classList.add('active');
        document.getElementById("feed").innerHTML = '<div class="loading">Inbox coming soon...</div>';
    }
    if (page === 'profile') {
        document.querySelector('.bottom-nav-item:last-child').classList.add('active');
        loadProfile();
    }
}

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
    alert("Posted!");
    closeUploadModal();
    refreshFeed();
}

// Initialize infinite scroll
setupInfiniteScroll();

// ========== MAKE FUNCTIONS GLOBAL ==========
window.loadFeed = loadFeed;
window.refreshFeed = refreshFeed;
window.viewProfile = viewProfile;
window.loadProfile = loadProfile;
window.toggleFollowFromProfile = toggleFollowFromProfile;
window.likePost = likePost;
window.toggleComments = toggleComments;
window.openModal = openModal;
window.closeModal = closeModal;
window.openShareModal = openShareModal;
window.closeShareModal = closeShareModal;
window.shareTo = shareTo;
window.copyLink = copyLink;
window.openUploadModal = openUploadModal;
window.closeUploadModal = closeUploadModal;
window.switchTab = switchTab;
window.bottomNav = bottomNav;
window.uploadPost = uploadPost;
window.togglePostMenu = togglePostMenu;
window.changePostPrivacy = changePostPrivacy;
window.deletePost = deletePost;
window.goToHome = goToHome;
