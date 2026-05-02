// ========== PROFILE ==========
async function uploadAvatar(file) {
    if (!USER) return;
    const fileName = `${USER.id}_${Date.now()}.jpg`;
    await SB.storage.from("avatars").upload(fileName, file, { upsert: true });
    const { data } = SB.storage.from("avatars").getPublicUrl(fileName);
    await SB.from("profiles").update({ avatar_url: data.publicUrl }).eq("id", USER.id);
    alert("Profile picture updated!");
    loadProfile(); loadFeed();
}
document.getElementById('avatarInput').onchange = async (e) => { if (e.target.files[0]) await uploadAvatar(e.target.files[0]); };

async function saveProfile() {
    if (!USER) return;
    const username = document.getElementById("editUsername").value;
    const bio = document.getElementById("editBio").value;
    await SB.from("profiles").upsert({ id: USER.id, username: username, bio: bio });
    alert("Profile updated!");
    document.getElementById('editProfileModal').style.display = 'none';
    loadProfile(); loadFeed();
}
function openEditProfile() {
    document.getElementById('editUsername').value = USER?.user_metadata?.username || '';
    document.getElementById('editBio').value = USER?.user_metadata?.bio || '';
    document.getElementById('editProfileModal').style.display = 'flex';
}
document.getElementById('closeEditModal').onclick = () => document.getElementById('editProfileModal').style.display = 'none';
document.getElementById('saveProfileBtn').onclick = saveProfile;

async function loadProfile() {
    if (!USER) { alert('Please login'); openAuthModal(); return; }
    const feedDiv = document.getElementById("feed");
    feedDiv.innerHTML = '<div class="loading">Loading profile...</div>';
    const { data: profile } = await SB.from("profiles").select("*").eq("id", USER.id).single();
    const { data: posts } = await SB.from("posts").select("*").eq("user_id", USER.id).order("id", { ascending: false });
    const { count } = await SB.from("posts").select("*", { count: 'exact', head: true }).eq("user_id", USER.id);
    const avatarHtml = profile?.avatar_url ? `<img src="${profile.avatar_url}">` : '👤';
    let html = `<div class="profile-header"><div class="profile-avatar" onclick="document.getElementById('avatarInput').click()">${avatarHtml}</div><h3>${profile?.username || USER.email.split('@')[0]}</h3><div class="profile-bio">${profile?.bio || 'No bio yet'}</div><div class="profile-stats"><div><strong>${count || 0}</strong><br>posts</div><div><strong>0</strong><br>followers</div><div><strong>0</strong><br>following</div></div><button class="edit-profile-btn" onclick="openEditProfile()">Edit Profile</button><button onclick="switchTab('feed')" style="background:#00ff88; color:black; border:none; padding:8px 20px; border-radius:20px; margin-top:10px; margin-left:10px;">Back to Feed</button></div>`;
    for (const p of posts || []) {
        let privacyIcon = p.privacy === 'public' ? '🌍' : (p.privacy === 'friends' ? '👥' : '🔒');
        let privacyText = p.privacy === 'public' ? 'Public' : (p.privacy === 'friends' ? 'Friends' : 'Only Me');
        let avatarDisplay = profile?.avatar_url ? `<img src="${profile.avatar_url}" class="user-avatar">` : `<div class="m-logo"><div class="tri tri1"></div><div class="tri tri2"></div><div class="tri tri3"></div><div class="tri tri4"></div></div>`;
        html += `<div class="post"><div class="post-header"><div class="post-header-left">${avatarDisplay}<div class="post-username">${profile?.username || 'User'}</div></div><div class="post-privacy-menu"><button class="privacy-badge privacy-${p.privacy || 'public'}" onclick="togglePostMenu(${p.id})">${privacyIcon} ${privacyText}</button><div id="post-menu-${p.id}" class="post-menu-dropdown" style="display:none;"><div class="post-menu-option" onclick="changePostPrivacy(${p.id}, 'public')">🌍 Public</div><div class="post-menu-option" onclick="changePostPrivacy(${p.id}, 'friends')">👥 Friends Only</div><div class="post-menu-option" onclick="changePostPrivacy(${p.id}, 'private')">🔒 Only Me</div><div class="post-menu-option delete-option" onclick="deletePost(${p.id})">🗑️ Delete</div></div></div></div><img class="post-image" src="${p.image_url}" onclick="openModal('${p.image_url}')" loading="lazy"><div class="post-caption">${p.caption || 'Fashion visual'}</div></div>`;
    }
    feedDiv.innerHTML = html;
}
