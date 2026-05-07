// ========== PROFILE ==========

// Safe avatar function for profile
function getSafeProfileAvatarHtml(avatarUrl) {
    const isValidUrl = avatarUrl && avatarUrl.trim() !== '' && avatarUrl.startsWith('http');
    
    if (isValidUrl) {
        return `<img src="${avatarUrl}" class="profile-avatar-img" onclick="document.getElementById('avatarInput').click()" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; cursor: pointer;" onerror="this.onerror=null; this.style.display='none'; this.nextElementSibling.style.display='flex';">`;
    } else {
        return `<div class="profile-avatar-placeholder" onclick="document.getElementById('avatarInput').click()" style="width: 80px; height: 80px; border-radius: 50%; background: #333; display: flex; align-items: center; justify-content: center; font-size: 40px; cursor: pointer;">👤</div>`;
    }
}

async function uploadAvatar(file) {
    if (!USER) return;
    const fileName = `${USER.id}_${Date.now()}.jpg`;
    await SB.storage.from("avatars").upload(fileName, file, { upsert: true });
    const { data } = SB.storage.from("avatars").getPublicUrl(fileName);
    await SB.from("profiles").update({ avatar_url: data.publicUrl }).eq("id", USER.id);
    alert("Profile picture updated!");
    loadProfile();
    if (typeof refreshFeed === 'function') refreshFeed();
}

document.getElementById('avatarInput').onchange = async (e) => { 
    if (e.target.files && e.target.files[0]) {
        await uploadAvatar(e.target.files[0]);
    }
};

async function saveProfile() {
    if (!USER) return;
    const username = document.getElementById("editUsername").value;
    const bio = document.getElementById("editBio").value;
    await SB.from("profiles").upsert({ id: USER.id, username: username, bio: bio });
    alert("Profile updated!");
    document.getElementById('editProfileModal').style.display = 'none';
    loadProfile();
    if (typeof refreshFeed === 'function') refreshFeed();
}

function openEditProfile() {
    // Fetch latest profile data first
    SB.from("profiles").select("username, bio").eq("id", USER.id).single().then(({ data }) => {
        document.getElementById('editUsername').value = data?.username || USER.email?.split('@')[0] || '';
        document.getElementById('editBio').value = data?.bio || '';
    });
    document.getElementById('editProfileModal').style.display = 'flex';
}

document.getElementById('closeEditModal').onclick = () => document.getElementById('editProfileModal').style.display = 'none';
document.getElementById('saveProfileBtn').onclick = saveProfile;

// ========== ONLINE STATUS - UPDATE LAST SEEN ==========
async function updateLastSeen() {
    if (!USER) return;
    try {
        await SB.from("profiles").update({ last_seen: new Date().toISOString() }).eq("id", USER.id);
    } catch (e) {
        console.error("Update last_seen error:", e);
    }
}

// Update last_seen every 30 seconds and on page visibility
if (USER) {
    updateLastSeen();
    setInterval(updateLastSeen, 30000);
}

// Update when page becomes visible again
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && USER) {
        updateLastSeen();
    }
});

async function loadProfile() {
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
        
        // Get user's posts
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
        const avatarHtml = getSafeProfileAvatarHtml(profile?.avatar_url);
        
        const displayName = profile?.username || USER.email?.split('@')[0] || 'User';
        const bio = profile?.bio || 'No bio yet';
        
        let html = `
            <div class="profile-header">
                <div class="profile-avatar">
                    ${avatarHtml}
                </div>
                <h3>${escapeHtml(displayName)}</h3>
                <div class="profile-bio">${escapeHtml(bio)}</div>
                <div class="profile-stats">
                    <div><strong>${postCount || 0}</strong><br>posts</div>
                    <div><strong>0</strong><br>followers</div>
                    <div><strong>0</strong><br>following</div>
                </div>
                <button class="edit-profile-btn" onclick="openEditProfile()">Edit Profile</button>
                <button onclick="goToHome()" style="background:#00ff88; color:black; border:none; padding:8px 20px; border-radius:20px; margin-top:10px; margin-left:10px; cursor:pointer;">Back to Feed</button>
            </div>
        `;
        
        // Display user's posts
        if (posts && posts.length > 0) {
            for (const p of posts) {
                let privacyIcon = p.privacy === 'public' ? '🌍' : (p.privacy === 'friends' ? '👥' : '🔒');
                let privacyText = p.privacy === 'public' ? 'Public' : (p.privacy === 'friends' ? 'Friends' : 'Only Me');
                
                // Safe avatar for post header in profile
                const isValidAvatar = profile?.avatar_url && profile.avatar_url.trim() !== '' && profile.avatar_url.startsWith('http');
                const postAvatarHtml = isValidAvatar ?
                    `<img src="${profile.avatar_url}" class="user-avatar" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;" onerror="this.onerror=null; this.style.display='none';">` :
                    `<div class="m-logo" style="width: 40px; height: 40px;"><div class="tri tri1"></div><div class="tri tri2"></div><div class="tri tri3"></div><div class="tri tri4"></div></div>`;
                
                html += `
                    <div class="post">
                        <div class="post-header">
                            <div class="post-header-left">
                                ${postAvatarHtml}
                                <div class="post-username">${escapeHtml(displayName)}</div>
                            </div>
                            <div class="post-privacy-menu">
                                <button class="privacy-badge privacy-${p.privacy || 'public'}" onclick="togglePostMenu(${p.id})">${privacyIcon} ${privacyText}</button>
                                <div id="post-menu-${p.id}" class="post-menu-dropdown" style="display:none;">
                                    <div class="post-menu-option" onclick="changePostPrivacy(${p.id}, 'public')">🌍 Public</div>
                                    <div class="post-menu-option" onclick="changePostPrivacy(${p.id}, 'friends')">👥 Friends Only</div>
                                    <div class="post-menu-option" onclick="changePostPrivacy(${p.id}, 'private')">🔒 Only Me</div>
                                    <div class="post-menu-option delete-option" onclick="deletePost(${p.id})">🗑️ Delete</div>
                                </div>
                            </div>
                        </div>
                        <img class="post-image" src="${p.image_url}" onclick="openModal('${p.image_url}')" loading="lazy">
                        <div class="post-caption">${escapeHtml(p.caption || 'Fashion visual')}</div>
                    </div>
                `;
            }
        } else {
            html += '<div style="text-align: center; padding: 40px; color: #888;">No posts yet. Click + to upload!</div>';
        }
        
        feedDiv.innerHTML = html;
        
    } catch (err) {
        console.error("Load profile error:", err);
        feedDiv.innerHTML = `<div class="loading" style="color: #ff4444;">Error loading profile: ${err.message}</div>`;
    }
}
