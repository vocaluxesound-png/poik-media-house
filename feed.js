// ========== FEED FUNCTIONS WITH TAP TO PLAY/PAUSE ==========

let currentPage = 0;
const POSTS_PER_PAGE = 10;
let isLoading = false;
let hasMorePosts = true;
window.isProfileView = false;
window.isFriendsView = false;

// Video autoplay variables
let videoObserver = null;
let currentPlayingVideo = null;

// Safe avatar function
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

// ========== VIDEO AUTOPLAY FUNCTIONS ==========

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
    }, { threshold: 0.6 });
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

// Tap to play/pause (single tap)
function toggleVideoPlayPause(videoId) {
    const video = document.getElementById(`video-${videoId}`);
    if (video) {
        if (video.paused) {
            video.play();
        } else {
            video.pause();
        }
    }
}

// Double-tap to like
let lastTap = 0;
function handleVideoDoubleTap(postId, element) {
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTap;
    
    if (tapLength < 500 && tapLength > 0) {
        // Double tap detected - like the post
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
        
        let html = '<div class="video-feed-container">';
        
        for (const p of posts) {
            const isLiked = USER && userLikedPosts.has(Number(p.id));
            const isPostOwner = USER && p.user_id === USER.id;
            
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
            
            const videoId = p.id;
            const posterUrl = p.thumbnail_url || '';
            const videoUrl = p.image_url;
            
            html += `
                <div class="video-feed-item" data-post-id="${p.id}">
                    <!-- Volume Toggle -->
                    <div class="volume-toggle" onclick="event.stopPropagation(); toggleVideoMute(${videoId})" id="mute-btn-${videoId}">
                        <i class="fas fa-volume-mute"></i>
                    </div>
                    
                    <!-- Video Element - tap to play/pause, double-tap to like -->
                    <video id="video-${videoId}" 
                           src="${videoUrl}" 
                           poster="${posterUrl}"
                           loop 
                           muted 
                           playsinline
                           style="width: 100%; height: 100%; object-fit: cover;"
                           onclick="event.stopPropagation(); toggleVideoPlayPause(${videoId})"
                           ondblclick="event.stopPropagation(); handleVideoDoubleTap(${p.id}, this.parentElement)">
                    </video>
                    
                    <!-- Overlay for username, caption and actions -->
                    <div class="video-overlay">
                        <div class="video-overlay-content">
                            <div class="video-info">
                                <div class="video-username" onclick="viewProfile('${p.user_id}')">
                                    ${escapeHtml(displayName)}
                                </div>
                                <div class="video-caption">${escapeHtml(p.caption || '')}</div>
                            </div>
                            <div class="video-actions">
                                <div class="video-action-btn ${isLiked ? 'liked' : ''}" onclick="event.stopPropagation(); likePost(${p.id})">
                                    <i class="fas fa-heart" style="font-size: 28px;"></i>
                                    <span id="likes-${p.id}">${p.likes_count || 0}</span>
                                </div>
                                <div class="video-action-btn" onclick="event.stopPropagation(); toggleComments(${p.id})">
                                    <i class="far fa-comment-dots" style="font-size: 28px;"></i>
                                    <span id="comment-count-${p.id}">${totalCount || 0}</span>
                                </div>
                                <div class="video-action-btn share-icon" onclick="event.stopPropagation(); openShareModal('${p.image_url}')">
                                    <i class="fas fa-paper-plane" style="font-size: 28px;"></i>
                                    <span>Share</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Comments Section -->
                    <div class="comments-section" id="comments-${p.id}" style="display:none; position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.9); backdrop-filter: blur(10px); max-height: 50%; overflow-y: auto; border-radius: 20px 20px 0 0; z-index: 50;">
                        <div class="comments-header" style="display: flex; justify-content: space-between; padding: 12px;">
                            <span class="comments-title">💬 Comments (${totalCount || 0})</span>
                            <button class="close-comments" onclick="document.getElementById('comments-${p.id}').style.display='none'" style="background:none; border:none; color:white; font-size:20px;">✕</button>
                        </div>
                        <div id="comments-list-${p.id}" style="padding: 12px;">Click to load comments</div>
                        <div class="comment-input" style="display: flex; gap: 8px; padding: 12px;">
                            <input type="text" id="comment-input-${p.id}" placeholder="Add comment..." style="flex:1; padding:10px; border-radius:20px; border:none; background:#222; color:white;">
                            <button onclick="addComment(${p.id})" style="background:#00ff88; color:black; border:none; padding:8px 16px; border-radius:20px;">Post</button>
                        </div>
                    </div>
                </div>
            `;
        }
        
        html += '</div>';
        
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
    const feedDiv = document.getElementById("feed");
    if (!feedDiv) return;
    
    feedDiv.addEventListener('scroll', () => {
        if (isLoading) return;
        if (!hasMorePosts) return;
        if (window.isProfileView || window.isFriendsView) return;
        
        const scrollPosition = feedDiv.scrollTop + feedDiv.clientHeight;
        const bottomPosition = feedDiv.scrollHeight - 500;
        
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

// ========== PROFILE PAGE WITH VIDEO AUTOPLAY ==========
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
                <div id="profile-posts-list" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 3px;">
        `;
        
        if (posts && posts.length > 0) {
            for (const p of posts) {
                const isVideo = p.is_video || isVideoUrl(p.image_url);
                html += `
                    <div class="profile-video-item" onclick="if(${isVideo}){ const video = this.querySelector('video'); if(video) video.paused ? video.play() : video.pause(); } else { openModal('${p.image_url}'); }">
                        ${isVideo ? 
                            `<video src="${p.image_url}" poster="${p.thumbnail_url || ''}" loop muted playsinline style="width:100%; height:100%; object-fit:cover;"></video>` :
                            `<img src="${p.image_url}" style="width:100%; height:100%; object-fit:cover;">`
                        }
                        <div class="profile-video-overlay">
                            <i class="fas fa-${isVideo ? 'play' : 'image'}"></i>
                        </div>
                    </div>
                `;
            }
        } else {
            html += '<div style="text-align: center; padding: 40px; color: #888; grid-column: span 3;">No posts yet. Click + to upload!</div>';
        }
        
        html += `</div></div>`;
        feedDiv.innerHTML = html;
        
        // Observe profile videos for autoplay
        setTimeout(() => {
            const profileVideos = document.querySelectorAll('.profile-video-item video');
            profileVideos.forEach(video => {
                if (videoObserver) videoObserver.observe(video);
            });
        }, 500);
        
        document.querySelectorAll('.bottom-nav-item').forEach(item => item.classList.remove('active'));
        const profileBtn = document.querySelector('.bottom-nav-item:last-child');
        if (profileBtn) profileBtn.classList.add('active');
        
    } catch (err) {
        console.error("Load profile error:", err);
        feedDiv.innerHTML = `<div class="loading" style="color: #ff4444;">Error loading profile: ${err.message}</div>`;
    }
}

// View other user's profile
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
                    <div id="profile-posts-list" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 3px;">
        `;
        
        if (posts && posts.length > 0) {
            for (const p of posts) {
                const isVideo = p.is_video || isVideoUrl(p.image_url);
                html += `
                    <div class="profile-video-item" onclick="if(${isVideo}){ const video = this.querySelector('video'); if(video) video.paused ? video.play() : video.pause(); } else { openModal('${p.image_url}'); }">
                        ${isVideo ? 
                            `<video src="${p.image_url}" poster="${p.thumbnail_url || ''}" loop muted playsinline style="width:100%; height:100%; object-fit:cover;"></video>` :
                            `<img src="${p.image_url}" style="width:100%; height:100%; object-fit:cover;">`
                        }
                        <div class="profile-video-overlay">
                            <i class="fas fa-${isVideo ? 'play' : 'image'}"></i>
                        </div>
                    </div>
                `;
            }
        } else {
            html += '<div style="text-align: center; padding: 40px; color: #888; grid-column: span 3;">No posts yet</div>';
        }
        
        html += `</div></div>`;
        feedDiv.innerHTML = html;
        
        // Observe profile videos for autoplay
        setTimeout(() => {
            const profileVideos = document.querySelectorAll('.profile-video-item video');
            profileVideos.forEach(video => {
                if (videoObserver) videoObserver.observe(video);
            });
        }, 500);
        
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
        if (typeof openDualChat === 'function') {
            openDualChat(userId);
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

// Initialize video autoplay
setupVideoAutoplay();
setupSnapScrolling();
setupInfiniteScroll();

// Expose functions
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
window.switchTab = switchTab;
window.bottomNav = bottomNav;
window.toggleFeedPostMenu = toggleFeedPostMenu;
window.changeFeedPostPrivacy = changeFeedPostPrivacy;
window.deleteFeedPost = deleteFeedPost;
window.openChatFromProfile = openChatFromProfile;
window.toggleVideoMute = toggleVideoMute;
window.toggleVideoPlayPause = toggleVideoPlayPause;
window.handleVideoDoubleTap = handleVideoDoubleTap;
