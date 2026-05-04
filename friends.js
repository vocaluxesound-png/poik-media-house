// ========== FRIENDS PAGE ==========
let friendsCurrentTab = 'following';

async function loadFriends() {
    const feedDiv = document.getElementById("feed");
    if (!USER) { 
        alert('Please login'); 
        openAuthModal(); 
        return; 
    }
    
    const topNav = document.querySelector('.top-nav');
    if (topNav) topNav.style.display = 'none';
    
    feedDiv.innerHTML = '<div class="loading">Loading friends...</div>';
    
    try {
        const { data: allUsers } = await SB.from("profiles").select("*").neq("id", USER.id);
        
        const { data: followingData } = await SB.from("follows").select("following").eq("follower", USER.id);
        const followingIds = new Set(followingData?.map(f => f.following) || []);
        
        let following = [];
        if (followingIds.size > 0) {
            const { data: followingUsers } = await SB.from("profiles").select("*").in("id", [...followingIds]);
            following = followingUsers || [];
        }
        
        const { data: followersData } = await SB.from("follows").select("follower").eq("following", USER.id);
        const followerIds = new Set(followersData?.map(f => f.follower) || []);
        
        let followers = [];
        if (followerIds.size > 0) {
            const { data: followerUsers } = await SB.from("profiles").select("*").in("id", [...followerIds]);
            followers = followerUsers || [];
        }
        
        const suggestions = allUsers?.filter(u => !followingIds.has(u.id)) || [];
        
        let usersToShow = [];
        if (friendsCurrentTab === 'following') usersToShow = following;
        else if (friendsCurrentTab === 'followers') usersToShow = followers;
        else usersToShow = suggestions;
        
        let html = `
            <div style="padding: 16px;">
                <div style="display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 1px solid #333;">
                    <button onclick="switchFriendsTab('following')" style="background: none; border: none; color: ${friendsCurrentTab === 'following' ? '#00ff88' : '#888'}; padding: 10px 20px; font-size: 16px; cursor: pointer; border-bottom: 2px solid ${friendsCurrentTab === 'following' ? '#00ff88' : 'transparent'};">Following (${following.length})</button>
                    <button onclick="switchFriendsTab('followers')" style="background: none; border: none; color: ${friendsCurrentTab === 'followers' ? '#00ff88' : '#888'}; padding: 10px 20px; font-size: 16px; cursor: pointer; border-bottom: 2px solid ${friendsCurrentTab === 'followers' ? '#00ff88' : 'transparent'};">Followers (${followers.length})</button>
                    <button onclick="switchFriendsTab('suggestions')" style="background: none; border: none; color: ${friendsCurrentTab === 'suggestions' ? '#00ff88' : '#888'}; padding: 10px 20px; font-size: 16px; cursor: pointer; border-bottom: 2px solid ${friendsCurrentTab === 'suggestions' ? '#00ff88' : 'transparent'};">Suggestions (${suggestions.length})</button>
                </div>
                <div id="friendsList">
        `;
        
        if (usersToShow.length === 0) {
            html += `<div style="text-align: center; padding: 40px; color: #888;">
                ${friendsCurrentTab === 'following' ? 'You are not following anyone yet' : 
                  friendsCurrentTab === 'followers' ? 'No one follows you yet' : 
                  'No suggestions available'}
            </div>`;
        } else {
            for (const user of usersToShow) {
                const isFollowing = followingIds.has(user.id);
                html += `
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px; border-bottom: 1px solid #222;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            ${user.avatar_url ? `<img src="${user.avatar_url}" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover; cursor: pointer;" onclick="viewProfile('${user.id}')">` : `<div style="width: 50px; height: 50px; border-radius: 50%; background: #333; display: flex; align-items: center; justify-content: center; font-size: 24px; cursor: pointer;" onclick="viewProfile('${user.id}')">👤</div>`}
                            <div>
                                <div style="font-weight: bold; cursor: pointer;" onclick="viewProfile('${user.id}')">${escapeHtml(user.username || 'User')}</div>
                                <div style="font-size: 12px; color: #888;">@${escapeHtml(user.username || 'user')}</div>
                            </div>
                        </div>
                        ${user.id !== USER?.id ? `
                            <button id="follow-btn-${user.id}" onclick="toggleFollow('${user.id}')" style="background: ${isFollowing ? '#333' : '#00ff88'}; color: ${isFollowing ? '#fff' : '#000'}; border: none; padding: 8px 20px; border-radius: 20px; cursor: pointer; font-weight: bold;">
                                ${isFollowing ? 'Following' : 'Follow'}
                            </button>
                        ` : ''}
                    </div>
                `;
            }
        }
        
        html += `</div></div>`;
        feedDiv.innerHTML = html;
        
    } catch (err) {
        console.error("Friends error:", err);
        feedDiv.innerHTML = `<div class="loading" style="color: #ff4444;">Error: ${err.message}</div>`;
    }
}

async function switchFriendsTab(tab) {
    friendsCurrentTab = tab;
    await loadFriends();
}

async function toggleFollow(userId) {
    if (!USER) { alert('Login to follow'); openAuthModal(); return; }
    if (userId === USER.id) { alert("You can't follow yourself"); return; }
    
    const { data: existing } = await SB.from("follows").select("*").eq("follower", USER.id).eq("following", userId);
    
    if (existing && existing.length > 0) {
        await SB.from("follows").delete().eq("follower", USER.id).eq("following", userId);
        const btn = document.getElementById(`follow-btn-${userId}`);
        if (btn) {
            btn.innerText = "Follow";
            btn.style.background = "#00ff88";
            btn.style.color = "#000";
        }
    } else {
        await SB.from("follows").insert({ follower: USER.id, following: userId });
        const btn = document.getElementById(`follow-btn-${userId}`);
        if (btn) {
            btn.innerText = "Following";
            btn.style.background = "#333";
            btn.style.color = "#fff";
        }
    }
    await loadFriends();
}

window.loadFriends = loadFriends;
window.switchFriendsTab = switchFriendsTab;
window.toggleFollow = toggleFollow;
