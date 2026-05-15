// ========== FEED FUNCTIONS ==========

let currentPage = 0;
const POSTS_PER_PAGE = 10;
let isLoading = false;
let hasMorePosts = true;
window.isProfileView = false;
window.isFriendsView = false;

// Video autoplay variables
let videoObserver = null;
let currentPlayingVideo = null;

// Safe avatar function - prevents 400 errors
function getSafeAvatarHtml(avatarUrl, userId, size = 40) {
    const isValidUrl = avatarUrl && avatarUrl.trim() !== '' && avatarUrl.startsWith('http');
    
    if (isValidUrl) {
        return `<img src="${avatarUrl}" class="user-avatar" onclick="viewProfile('${userId}')" style="cursor: pointer; width: ${size}px; height: ${size}px; border-radius: 50%; object-fit: cover;" loading="lazy" onerror="this.onerror=null; this.style.display='none'; this.nextElementSibling.style.display='flex';">`;
    } else {
        return `<div class="avatar-placeholder" onclick="viewProfile('${userId}')" style="cursor: pointer; width: ${size}px; height: ${size}px; border-radius: 50%; background: #333; display: flex; align-items: center; justify-content: center; font-size: ${size/2}px;">👤</div>`;
    }
}

// Check if URL is video
function isVideoUrl(url) {
    return url && (url.endsWith('.mp4') || url.endsWith('.mov') || url.endsWith('.webm') || url.includes('video'));
}

// Close all popups when clicking outside
document.addEventListener('click', function(e) {
    document.querySelectorAll('.post-menu-dropdown, .profile-post-menu-dropdown').forEach(menu => {
        if (!menu.contains(e.target) && !menu.previousElementSibling?.contains(e.target)) {
            menu.style.display = 'none';
        }
    });
});

// ========== NEW VIDEO AUTOPLAY FUNCTIONS ==========

// Setup Intersection Observer for video autoplay
function setupVideoAutoplay() {
    if (videoObserver) videoObserver.disconnect();
    
    videoObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const video = entry.target;
            if (entry.isIntersecting) {
                if (currentPlayingVideo && currentPlayingVideo !== video) {
                    currentPlayingVideo.pause();
                }
                video.play().catch(e => console.log("Autoplay prevented:", e));
                currentPlayingVideo = video;
            } else {
                if (currentPlayingVideo === video) {
                    video.pause();
                    currentPlayingVideo = null;
                }
            }
        });
    }, { threshold: 0.5 });
}

// Toggle video mute/unmute
function toggleVideoMute(videoId) {
    const video = document.getElementById(`video-${videoId}`);
    if (video) {
        video.muted = !video.muted;
        const muteBtn = document.getElementById(`mute-btn-${videoId}`);
        if (muteBtn) {
            muteBtn.innerHTML = video.muted ? '<i class="fas fa-volume-mute"></i>' : '<i class="fas fa-volume-up"></i>';
        }
    }
}

// Double-tap to like
let lastTap = 0;
function handleVideoDoubleTap(postId, element) {
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTap;
    
    if (tapLength < 500 && tapLength > 0) {
        likePost(postId);
        showHeartAnimation(element);
    }
    lastTap = currentTime;
}

function showHeartAnimation(element) {
    const heart = document.createElement('div');
    heart.className = 'heart-animation';
    heart.innerHTML = '<i class="fas fa-heart"></i>';
    heart.style.position = 'absolute';
    heart.style.top = '50%';
    heart.style.left = '50%';
    heart.style.transform = 'translate(-50%, -50%)';
    heart.style.fontSize = '80px';
    heart.style.color = '#FE2C55';
    heart.style.zIndex = '100';
    heart.style.pointerEvents = 'none';
    heart.style.animation = 'heartPop 0.5s ease-out';
    
    element.style.position = 'relative';
    element.appendChild(heart);
    
    setTimeout(() => {
        heart.remove();
    }, 500);
}

// Setup snap-to-video scrolling on mobile
function setupSnapScrolling() {
    const feedDiv = document.getElementById("feed");
    if (!feedDiv) return;
    
    let isScrolling = false;
    let scrollTimeout;
    
    const handleScroll = () => {
        if (isScrolling) return;
        isScrolling = true;
        
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            const videos = document.querySelectorAll('.video-feed-item');
            let bestIndex = -1;
            let bestVisibility = 0;
            
            videos.forEach((video, index) => {
                const rect = video.getBoundingClientRect();
                const visibility = Math.min(1, Math.max(0, 
                    (Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0)) / rect.height
                ));
                if (visibility > bestVisibility) {
                    bestVisibility = visibility;
                    bestIndex = index;
                }
            });
            
            if (bestIndex >= 0 && bestVisibility > 0.3) {
                videos[bestIndex].scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            
            isScrolling = false;
        }, 100);
    };
    
    feedDiv.addEventListener('scroll', handleScroll);
}

// Observe videos after feed loads
function observeVideoElements() {
    setTimeout(() => {
        const videos = document.querySelectorAll('.video-feed-item video');
        videos.forEach(video => {
            if (videoObserver) videoObserver.observe(video);
        });
    }, 500);
}

// ========== LOAD FEED ==========
async function loadFeed(reset = true) {
    if (window.isProfileView || window.isFriendsView) {
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
            const isPostOwner = USER && p.user_id === USER.id;
            
            // FIX: Get real comment count from database
            const { count: realCommentCount } = await SB
                .from("comments")
                .select("*", { count: 'exact', head: true })
                .eq("post_id", p.id);
            let totalCount = realCommentCount || 0;
            
            // Also count replies
            const { count: replyCount } = await SB
                .from("comment_replies")
                .select("*", { count: 'exact', head: true })
                .eq("post_id", p.id);
            if (replyCount > 0) {
                totalCount = totalCount + replyCount;
            }
            
            let displayName = 'Poik Poik';
            let avatarHtml = '';
            let timestamp = p.created_at ? timeAgo(p.created_at) : '';
            
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
            
            // Media (image or video) - UPDATED for autoplay
            let mediaHtml = '';
            if (p.is_video || isVideoUrl(p.image_url)) {
                mediaHtml = `
                    <div class="video-feed-item" style="position: relative;">
                        <div class="volume-toggle" onclick="event.stopPropagation(); toggleVideoMute(${p.id})" id="mute-btn-${p.id}" style="position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.5); border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 20;">
                            <i class="fas fa-volume-mute"></i>
                        </div>
                        <video id="video-${p.id}" 
                               src="${p.image_url}" 
                               poster="${p.thumbnail_url || ''}"
                               loop 
                               muted 
                               playsinline
                               style="width: 100%; max-height: 500px; background: black; object-fit: contain;"
                               onclick="handleVideoDoubleTap(${p.id}, this.parentElement)">
                        </video>
                    </div>
                `;
            } else {
                mediaHtml = `<img class="post-image" src="${p.image_url}" onclick="openModal('${p.image_url}')" loading="lazy">`;
            }
            
            html += `
                <div class="post" data-post-id="${p.id}">
                    <div class="post-header">
                        <div class="post-header-left">
                            ${avatarHtml}
                            <div class="post-username" onclick="viewProfile('${p.user_id}')" style="cursor: pointer;">${escapeHtml(displayName)}</div>
                            ${timestamp ? `<span class="post-time" data-timestamp="${p.created_at}">${timestamp}</span>` : ''}
                        </div>
                        ${isPostOwner ? `
                        <div class="post-header-right">
                            <button class="post-menu-btn" onclick="event.stopPropagation(); toggleFeedPostMenu(${p.id})" style="background: none; border: none; color: white; font-size: 20px; cursor: pointer;">⋮</button>
                            <div id="feed-post-menu-${p.id}" class="post-menu-dropdown" style="display:none;">
                                <div class="post-menu-option" onclick="changeFeedPostPrivacy(${p.id}, 'public', true)">Public</div>
                                <div class="post-menu-option" onclick="changeFeedPostPrivacy(${p.id}, 'friends', true)">Friends</div>
                                <div class="post-menu-option" onclick="changeFeedPostPrivacy(${p.id}, 'private', true)">Only Me</div>
                                <div class="post-menu-option delete-option" onclick="deleteFeedPost(${p.id}, true)">Delete</div>
                            </div>
                        </div>
                        ` : ''}
                    </div>
                    ${mediaHtml}
                    <div class="post-caption">${escapeHtml(p.caption || '')}</div>
                    <div class="post-actions-right">
                        <div id="like-btn-${p.id}" class="action-icon ${isLiked ? 'liked' : ''}" onclick="likePost(${p.id})">
                            <i class="fas fa-heart"></i>
                            <span id="likes-${p.id}">${p.likes || 0}</span>
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
        
        // Observe videos for autoplay
        observeVideoElements();
        
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

// Feed post privacy change
async function changeFeedPostPrivacy(postId, newPrivacy, fromFeed = true) {
    if (!confirm(`Change privacy to ${newPrivacy}?`)) return;
    await SB.from("posts").update({ privacy: newPrivacy }).eq("id", postId);
    if (fromFeed) {
        window.isProfileView = false;
        window.isFriendsView = false;
        currentPage = 0;
        hasMorePosts = true;
        isLoading = false;
        await loadFeed(true);
    }
}

// Delete feed post
async function deleteFeedPost(postId, fromFeed = true) {
    if (!confirm('Delete this post? This cannot be undone.')) return;
    await SB.from("posts").delete().eq("id", postId);
    if (fromFeed) {
        window.isProfileView = false;
        window.isFriendsView = false;
        currentPage = 0;
        hasMorePosts = true;
        isLoading = false;
        await loadFeed(true);
    }
}

function toggleFeedPostMenu(postId) {
    document.querySelectorAll('.post-menu-dropdown').forEach(menu => {
        if (menu.id !== `feed-post-menu-${postId}`) {
            menu.style.display = 'none';
        }
    });
    const menu = document.getElementById(`feed-post-menu-${postId}`);
    if (menu) {
        menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    }
}

function setupInfiniteScroll() {
    window.addEventListener('scroll', () => {
        if (isLoading) return;
        if (!hasMorePosts) return;
        if (window.isProfileView || window.isFriendsView) return;
        const scrollPosition = window.innerHeight + window.scrollY;
        const bottomPosition = document.body.offsetHeight - 500;
        if (scrollPosition >= bottomPosition) {
            loadFeed(false);
        }
    });
}

function refreshFeed() {
    window.isProfileView = false;
    window.isFriendsView = false;
    currentPage = 0;
    hasMorePosts = true;
    isLoading = false;
    loadFeed(true);
}

// ========== LOAD PROFILE ==========
async function loadProfile() {
    window.isProfileView = true;
    window.isFriendsView = false;
    
    if (!USER) { 
        alert('Please login'); 
        openAuthModal(); 
        return; 
    }
    
    const feedDiv = document.getElementById("feed");
    if (!feedDiv) return;
    
    feedDiv.innerHTML = '<div class="loading">Loading profile...</div>';
    
    const topNav = document.querySelector('.top-nav');
    if (topNav) topNav.style.display = 'none';
    
    try {
        const { data: profile, error: profileError } = await SB
            .from("profiles")
            .select("*")
            .eq("id", USER.id)
            .single();
        
        if (profileError) throw profileError;
        
        const { data: posts, error: postsError } = await SB
            .from("posts")
            .select("*")
            .eq("user_id", USER.id)
            .order("created_at", { ascending: false });
        
        if (postsError) throw postsError;
        
        const { count: postCount } = await SB
            .from("posts")
            .select("*", { count: 'exact', head: true })
            .eq("user_id", USER.id);
        
        const { count: followerCount } = await SB
            .from("follows")
            .select("*", { count: 'exact', head: true })
            .eq("following", USER.id);
        
        const { count: followingCount } = await SB
            .from("follows")
            .select("*", { count: 'exact', head: true })
            .eq("follower", USER.id);
        
        const isValidAvatar = profile?.avatar_url && profile.avatar_url.trim() !== '' && profile.avatar_url.startsWith('http');
        const profileAvatarHtml = isValidAvatar ?
            `<img src="${profile.avatar_url}" class="profile-avatar-img" onclick="document.getElementById('avatarInput').click()" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; cursor: pointer;" onerror="this.onerror=null; this.style.display='none'; this.nextElementSibling.style.display='flex';">` :
            `<div class="profile-avatar-placeholder" onclick="document.getElementById('avatarInput').click()" style="width: 80px; height: 80px; border-radius: 50%; background: #333; display: flex; align-items: center; justify-content: center; font-size: 40px; cursor: pointer;">👤</div>`;
        
        const displayName = profile?.username || USER.email?.split('@')[0] || 'User';
        const bio = profile?.bio || 'No bio yet';
        const userAvatarUrl = isValidAvatar ? profile.avatar_url : null;
        
        let html = `
            <div class="profile-container" style="max-width: 600px; margin: 0 auto; padding: 20px; padding-bottom: 80px;">
                <div class="profile-header" style="text-align: center; background: #0a0a0a; border-radius: 20px; padding: 30px; margin-bottom: 20px;">
                    <div style="width: 100px; height: 100px; margin: 0 auto 15px;">
                        ${profileAvatarHtml}
                    </div>
                    <h2>${escapeHtml(displayName)}</h2>
                    <div style="color: #888; margin-bottom: 10px;">@${escapeHtml(displayName)}</div>
                    <div class="profile-bio" style="color: #aaa; margin-bottom: 20px;">${escapeHtml(bio)}</div>
                    <div class="profile-stats" style="display: flex; justify-content: center; gap: 30px; margin-bottom: 20px;">
                        <div class="profile-stat-clickable" onclick="refreshFeed()"><strong>${postCount || 0}</strong><br>posts</div>
                        <div class="profile-stat-clickable" onclick="if(typeof showFollowers==='function')showFollowers()"><strong>${followerCount || 0}</strong><br>followers</div>
                        <div class="profile-stat-clickable" onclick="if(typeof showFollowing==='function')showFollowing()"><strong>${followingCount || 0}</strong><br>following</div>
                    </div>
                    <button class="edit-profile-btn" onclick="openEditProfile()" style="background: #333; color: white; border: none; padding: 10px 30px; border-radius: 30px; font-weight: bold; cursor: pointer; margin-right: 10px;">Edit Profile</button>
                    <button onclick="goToHome()" style="background: #00ff88; color: black; border: none; padding: 10px 30px; border-radius: 30px; font-weight: bold; cursor: pointer;">Back to Feed</button>
                </div>
                <h3 style="margin-bottom: 15px; padding-left: 10px;">Your Posts</h3>
                <div id="profile-posts-list">
        `;
        
        if (posts && posts.length > 0) {
            for (const p of posts) {
                let privacyText = p.privacy === 'public' ? 'Public' : (p.privacy === 'friends' ? 'Friends' : 'Only Me');
                let timestamp = p.created_at ? timeAgo(p.created_at) : '';
                const isLiked = USER && userLikedPosts.has(Number(p.id));
                
                // FIX: Get real comment count from database
                const { count: realCommentCount } = await SB
                    .from("comments")
                    .select("*", { count: 'exact', head: true })
                    .eq("post_id", p.id);
                let totalComments = realCommentCount || 0;
                
                let mediaHtml = '';
                if (p.is_video || isVideoUrl(p.image_url)) {
                    mediaHtml = `<video class="post-image" controls style="width:100%; max-height:400px; background:black;" src="${p.image_url}" poster="${p.thumbnail_url || ''}"></video>`;
                } else {
                    mediaHtml = `<img class="post-image" src="${p.image_url}" style="width:100%;" onclick="openModal('${p.image_url}')" loading="lazy">`;
                }
                
                html += `
                    <div class="post profile-post" data-post-id="${p.id}" style="margin-bottom: 20px; background: #0a0a0a; border-radius: 16px; overflow: hidden;">
                        <div class="post-header" style="display: flex; justify-content: space-between; align-items: center; padding: 12px;">
                            <div class="post-header-left" style="display: flex; align-items: center; gap: 10px;">
                                ${userAvatarUrl ? `<img src="${userAvatarUrl}" class="user-avatar" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">` : `<div class="avatar-placeholder" style="width: 40px; height: 40px; border-radius: 50%; background: #333; display: flex; align-items: center; justify-content: center; font-size: 20px;">👤</div>`}
                                <div class="post-username" style="font-weight: bold;">${escapeHtml(displayName)}</div>
                                ${timestamp ? `<span class="post-time" data-timestamp="${p.created_at}" style="font-size: 11px; color: #888;">${timestamp}</span>` : ''}
                            </div>
                            <div class="post-privacy-menu" style="position: relative;">
                                <button class="privacy-badge" onclick="event.stopPropagation(); toggleProfilePostMenu(${p.id})" style="border: none; padding: 4px 12px; border-radius: 20px; cursor: pointer; background: #00ff88; color: black; font-size: 12px; font-weight: bold !important;">${privacyText}</button>
                                <div id="profile-post-menu-${p.id}" class="profile-post-menu-dropdown" style="display:none; position: absolute; right: 0; top: 100%; background: #1a1a1a; border-radius: 10px; padding: 5px 0; z-index: 100; min-width: 120px;">
                                    <div class="post-menu-option" onclick="changeProfilePostPrivacy(${p.id}, 'public')">Public</div>
                                    <div class="post-menu-option" onclick="changeProfilePostPrivacy(${p.id}, 'friends')">Friends</div>
                                    <div class="post-menu-option" onclick="changeProfilePostPrivacy(${p.id}, 'private')">Only Me</div>
                                    <div class="post-menu-option delete-option" onclick="deleteProfilePost(${p.id})">Delete</div>
                                </div>
                            </div>
                        </div>
                        ${mediaHtml}
                        <div class="post-caption" style="padding: 12px;">${escapeHtml(p.caption || '')}</div>
                        <div class="profile-post-actions">
                            <div id="like-btn-${p.id}" class="profile-action-icon ${isLiked ? 'liked' : ''}" onclick="likePost(${p.id})">
                                <i class="fas fa-heart"></i> <span id="likes-${p.id}">${p.likes || 0}</span>
                            </div>
                            <div class="profile-action-icon" onclick="toggleComments(${p.id})">
                                <i class="far fa-comment-dots"></i> <span id="comment-count-${p.id}">${totalComments || 0}</span>
                            </div>
                            <div class="profile-action-icon share-icon" onclick="openShareModal('${p.image_url}')">
                                <i class="fas fa-paper-plane"></i> <span>Share</span>
                            </div>
                            <div class="profile-action-icon" onclick="alert('Saved!')">
                                <i class="far fa-bookmark"></i> <span>Save</span>
                            </div>
                        </div>
                        <div class="comments-section" id="comments-${p.id}" style="display:none">
                            <div class="comments-header">
                                <span class="comments-title">💬 Comments (${totalComments || 0})</span>
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
        } else {
            html += '<div style="text-align: center; padding: 40px; color: #888;">No posts yet. Click + to upload!</div>';
        }
        
        html += `</div></div>`;
        feedDiv.innerHTML = html;
        
        document.querySelectorAll('.bottom-nav-item').forEach(item => item.classList.remove('active'));
        const profileBtn = document.querySelector('.bottom-nav-item:last-child');
        if (profileBtn) profileBtn.classList.add('active');
        
    } catch (err) {
        console.error("Load profile error:", err);
        feedDiv.innerHTML = `<div class="loading" style="color: #ff4444;">Error loading profile: ${err.message}</div>`;
    }
}

function toggleProfilePostMenu(postId) {
    document.querySelectorAll('.profile-post-menu-dropdown').forEach(menu => {
        if (menu.id !== `profile-post-menu-${postId}`) {
            menu.style.display = 'none';
        }
    });
    const menu = document.getElementById(`profile-post-menu-${postId}`);
    if (menu) {
        menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    }
}

async function changeProfilePostPrivacy(postId, newPrivacy) {
    if (!confirm(`Change privacy to ${newPrivacy}?`)) return;
    await SB.from("posts").update({ privacy: newPrivacy }).eq("id", postId);
    await loadProfile();
}

async function deleteProfilePost(postId) {
    if (!confirm('Delete this post? This cannot be undone.')) return;
    await SB.from("posts").delete().eq("id", postId);
    await loadProfile();
}

// ========== VIEW PROFILE (other user) ==========
async function viewProfile(userId) {
    if (!userId) return;
    if (!USER) {
        alert('Please login to view profiles');
        openAuthModal();
        return;
    }
    
    window.isProfileView = true;
    window.isFriendsView = false;
    
    const feedDiv = document.getElementById("feed");
    feedDiv.innerHTML = '<div class="loading">Loading profile...</div>';
    
    const topNav = document.querySelector('.top-nav');
    if (topNav) topNav.style.display = 'none';
    
    try {
        const { data: profile, error } = await SB.from("profiles").select("*").eq("id", userId).single();
        if (error) throw error;
        
        const { data: posts } = await SB.from("posts").select("*").eq("user_id", userId).order("created_at", { ascending: false });
        
        let isFollowing = false;
        if (USER && userId !== USER.id) {
            const { data: followCheck } = await SB.from("follows").select("*").eq("follower", USER.id).eq("following", userId);
            isFollowing = followCheck && followCheck.length > 0;
        }
        
        const { count: followerCount } = await SB
            .from("follows")
            .select("*", { count: 'exact', head: true })
            .eq("following", userId);
        
        const { count: followingCount } = await SB
            .from("follows")
            .select("*", { count: 'exact', head: true })
            .eq("follower", userId);
        
        const isValidAvatar = profile?.avatar_url && profile.avatar_url.trim() !== '' && profile.avatar_url.startsWith('http');
        const avatarHtml = isValidAvatar ?
            `<img src="${profile.avatar_url}" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover;">` :
            '<div style="width: 80px; height: 80px; border-radius: 50%; background: #333; display: flex; align-items: center; justify-content: center; font-size: 40px;">👤</div>';
        
        const userAvatarUrl = isValidAvatar ? profile.avatar_url : null;
        const displayName = profile?.username || 'User';
        
        let html = `
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; padding-bottom: 80px;">
                <button onclick="goToHome()" style="background: #333; color: white; border: none; padding: 8px 16px; border-radius: 20px; margin-bottom: 20px; cursor: pointer;">← Back to Feed</button>
                <div style="text-align: center; background: #0a0a0a; border-radius: 20px; padding: 30px; margin-bottom: 20px;">
                    <div style="width: 100px; height: 100px; margin: 0 auto 15px;">${avatarHtml}</div>
                    <h2>${escapeHtml(profile?.username || 'User')}</h2>
                    <div style="color: #888; margin-bottom: 10px;">@${escapeHtml(profile?.username || 'user')}</div>
                    <div style="color: #aaa; margin-bottom: 20px;">${escapeHtml(profile?.bio || 'No bio yet')}</div>
                    <div style="display: flex; justify-content: center; gap: 30px; margin-bottom: 20px;">
                        <div><strong>${posts?.length || 0}</strong><br>posts</div>
                        <div><strong>${followerCount || 0}</strong><br>followers</div>
                        <div><strong>${followingCount || 0}</strong><br>following</div>
                    </div>
                    ${userId !== USER?.id ? `
                        <div style="display: flex; gap: 10px; justify-content: center;">
                            <button id="profile-follow-btn" onclick="toggleFollowFromProfile('${userId}')" style="background: ${isFollowing ? '#333' : '#00ff88'}; color: ${isFollowing ? '#fff' : '#000'}; border: none; padding: 10px 30px; border-radius: 30px; font-weight: bold; cursor: pointer;">
                                ${isFollowing ? 'Following' : 'Follow'}
                            </button>
                            <button onclick="openChatFromProfile('${userId}')" style="background: #333; color: white; border: none; padding: 10px 30px; border-radius: 30px; font-weight: bold; cursor: pointer;">
                                💬 Message
                            </button>
                        </div>
                    ` : ''}
                </div>
                <div style="margin-top: 20px;">
                    <h3 style="margin-bottom: 15px; padding-left: 10px;">Posts</h3>
                    <div id="profile-posts-list">
        `;
        
        if (posts && posts.length > 0) {
            for (const p of posts) {
                let timestamp = p.created_at ? timeAgo(p.created_at) : '';
                const isLiked = USER && userLikedPosts.has(Number(p.id));
                
                // FIX: Get real comment count from database
                const { count: realCommentCount } = await SB
                    .from("comments")
                    .select("*", { count: 'exact', head: true })
                    .eq("post_id", p.id);
                let totalComments = realCommentCount || 0;
                
                let mediaHtml = '';
                if (p.is_video || isVideoUrl(p.image_url)) {
                    mediaHtml = `<video class="post-image" controls style="width:100%; max-height:400px; background:black;" src="${p.image_url}" poster="${p.thumbnail_url || ''}"></video>`;
                } else {
                    mediaHtml = `<img src="${p.image_url}" style="width:100%;" onclick="openModal('${p.image_url}')" loading="lazy">`;
                }
                
                html += `
                    <div style="margin-bottom: 20px; background: #0a0a0a; border-radius: 16px; overflow: hidden;">
                        <div style="display: flex; align-items: center; gap: 10px; padding: 12px;">
                            ${userAvatarUrl ? `<img src="${userAvatarUrl}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">` : `<div style="width: 40px; height: 40px; border-radius: 50%; background: #333; display: flex; align-items: center; justify-content: center; font-size: 20px;">👤</div>`}
                            <div style="font-weight: bold;">${escapeHtml(displayName)}</div>
                            ${timestamp ? `<span style="font-size: 11px; color: #888;">${timestamp}</span>` : ''}
                        </div>
                        ${mediaHtml}
                        <div style="padding: 12px;">${escapeHtml(p.caption || '')}</div>
                        <div class="profile-post-actions">
                            <div id="like-btn-${p.id}" class="profile-action-icon ${isLiked ? 'liked' : ''}" onclick="likePost(${p.id})">
                                <i class="fas fa-heart"></i> <span id="likes-${p.id}">${p.likes || 0}</span>
                            </div>
                            <div class="profile-action-icon" onclick="toggleComments(${p.id})">
                                <i class="far fa-comment-dots"></i> <span id="comment-count-${p.id}">${totalComments || 0}</span>
                            </div>
                            <div class="profile-action-icon share-icon" onclick="openShareModal('${p.image_url}')">
                                <i class="fas fa-paper-plane"></i> <span>Share</span>
                            </div>
                            <div class="profile-action-icon" onclick="alert('Saved!')">
                                <i class="far fa-bookmark"></i> <span>Save</span>
                            </div>
                        </div>
                        <div class="comments-section" id="comments-${p.id}" style="display:none">
                            <div class="comments-header">
                                <span class="comments-title">💬 Comments (${totalComments || 0})</span>
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
        } else {
            html += '<div style="text-align: center; padding: 40px; color: #888;">No posts yet</div>';
        }
        
        html += `</div></div>`;
        feedDiv.innerHTML = html;
        
        document.querySelectorAll('.bottom-nav-item').forEach(item => item.classList.remove('active'));
        const profileBtn = document.querySelector('.bottom-nav-item:last-child');
        if (profileBtn) profileBtn.classList.add('active');
        
    } catch (err) {
        console.error("View profile error:", err);
        feedDiv.innerHTML = `<div class="loading" style="color: #ff4444;">Error loading profile: ${err.message}</div>`;
    }
}

async function openChatFromProfile(userId) {
    bottomNav('inbox');
    setTimeout(() => {
        if (typeof openChat === 'function') {
            openChat(userId);
        }
    }, 500);
}

function goToHome() {
    window.isProfileView = false;
    window.isFriendsView = false;
    
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
        
        if (typeof createNotification === 'function') {
            await createNotification('follow', userId, USER.id, null);
        }
    }
}

async function likePost(postId) {
    if (!USER) { alert('Login to like'); openAuthModal(); return; }
    
    const { data: post } = await SB.from("posts").select("user_id").eq("id", postId).single();
    const { data: existing } = await SB.from("post_likes").select("*").eq("post_id", postId).eq("user_id", USER.id);
    
    if (existing && existing.length > 0) {
        await SB.from("post_likes").delete().eq("post_id", postId).eq("user_id", USER.id);
        userLikedPosts.delete(Number(postId));
    } else {
        await SB.from("post_likes").insert({ post_id: postId, user_id: USER.id });
        userLikedPosts.add(Number(postId));
        
        if (post && post.user_id !== USER.id && typeof createNotification === 'function') {
            await createNotification('like_post', post.user_id, USER.id, postId);
        }
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

function toggleComments(postId) {
    const section = document.getElementById(`comments-${postId}`);
    if (section) {
        const isHidden = section.style.display === 'none';
        section.style.display = isHidden ? 'block' : 'none';
        if (isHidden && typeof loadCommentsOnly === 'function') {
            loadCommentsOnly(postId);
        }
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
        goToHome();
    }
    if (page === 'friends') {
        document.querySelector('.bottom-nav-item:nth-child(2)').classList.add('active');
        window.isFriendsView = true;
        window.isProfileView = false;
        if (typeof loadFriends === 'function') {
            loadFriends();
        } else {
            document.getElementById("feed").innerHTML = '<div class="loading">Loading friends...</div>';
        }
    }
    if (page === 'inbox') {
        document.querySelector('.bottom-nav-item:nth-child(4)').classList.add('active');
        if (typeof loadInbox === 'function') {
            loadInbox();
        } else {
            document.getElementById("feed").innerHTML = '<div class="loading">Loading inbox...</div>';
        }
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
    if (!file) { alert("Select an image or video"); return; }
    
    const isVideo = file.type.startsWith('video/');
    const fileName = `${USER.id}_${Date.now()}.${file.name.split('.').pop()}`;
    
    await SB.storage.from("post-images").upload(fileName, file);
    const { data } = SB.storage.from("post-images").getPublicUrl(fileName);
    
    await SB.from("posts").insert({ 
        image_url: data.publicUrl, 
        caption: caption, 
        user_id: USER.id, 
        privacy: privacy, 
        is_ai: false, 
        likes: 0,
        is_video: isVideo
    });
    alert("Posted!");
    closeUploadModal();
    refreshFeed();
}

// Setup video autoplay and snap scrolling on page load
setupVideoAutoplay();
setupSnapScrolling();
setupInfiniteScroll();

// ========== MAKE FUNCTIONS GLOBAL ==========
window.loadFeed = loadFeed;
window.refreshFeed = refreshFeed;
window.viewProfile = viewProfile;
window.loadProfile = loadProfile;
window.toggleFollowFromProfile = toggleFollowFromProfile;
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
window.toggleFeedPostMenu = toggleFeedPostMenu;
window.changeFeedPostPrivacy = changeFeedPostPrivacy;
window.deleteFeedPost = deleteFeedPost;
window.toggleProfilePostMenu = toggleProfilePostMenu;
window.changeProfilePostPrivacy = changeProfilePostPrivacy;
window.deleteProfilePost = deleteProfilePost;
window.openChatFromProfile = openChatFromProfile;

// New video functions
window.toggleVideoMute = toggleVideoMute;
window.handleVideoDoubleTap = handleVideoDoubleTap;
