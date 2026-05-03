// ========== FRIENDS PAGE ==========
let friendsCurrentTab = 'following';

async function loadFriends() {
    const feedDiv = document.getElementById("feed");
    if (!USER) { 
        alert('Please login'); 
        openAuthModal(); 
        return; 
    }
    
    feedDiv.innerHTML = '<div class="loading">Loading friends...</div>';
    
    try {
        // Get all users (for search)
        const { data: allUsers, error: usersError } = await SB.from("profiles").select("*").neq("id", USER.id);
        if (usersError) throw usersError;
        
        // Get users you follow
        const { data: followingData, error: followingError } = await SB.from("follows").select("following_id").eq("follower_id", USER.id);
        if (followingError) throw followingError;
        
        const followingIds = new Set(followingData?.map(f => f.following_id) || []);
        
        // Get detailed following users
        let following = [];
        if (followingIds.size > 0) {
            const { data: followingUsers } = await SB.from("profiles").select("*").in("id", [...followingIds]);
            following = followingUsers || [];
        }
        
        // Get users who follow you
        const { data: followersData, error: followersError } = await SB.from("follows").select("follower_id").eq("following_id", USER.id);
        if (followersError) throw followersError;
        
        const followerIds = new Set(followersData?.map(f => f.follower_id) || []);
        
        let followers = [];
        if (followerIds.size > 0) {
            const { data: followerUsers } = await SB.from("profiles").select("*").in("id", [...followerIds]);
            followers = followerUsers || [];
        }
        
        // Get suggestions (users you don't follow)
        const suggestions = allUsers?.filter(u => !followingIds.has(u.id)) || [];
        
        let html = `
            <div style="padding: 16px;">
                <!-- Search Bar -->
                <div style="margin-bottom: 20px;">
                    <input type="text" id="searchUsersInput" placeholder="🔍 Search users..." style="width: 100%; padding: 12px; border-radius: 30px; border: none; background: #222; color: white; font-size: 16px;">
                </div>
                
                <!-- Tabs -->
                <div style="display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 1px solid #333;">
                    <button id="tabFollowing" class="friends-tab" onclick="switchFriendsTab('following')" style="background: none; border: none; color: ${friendsCurrentTab === 'following' ? '#00ff88' : '#888'}; padding: 10px 20px; font-size: 16px; cursor: pointer; border-bottom: 2px solid ${friendsCurrentTab === 'following' ? '#00ff88' : 'transparent'};">Following (${following.length})</button>
                    <button id="tabFollowers" class="friends-tab" onclick="switchFriendsTab('followers')" style="background: none; border: none; color: ${friendsCurrentTab === 'followers' ? '#00ff88' : '#888'}; padding: 10px 20px; font-size: 16px; cursor: pointer; border-bottom: 2px solid ${friendsCurrentTab === 'followers' ? '#00ff88' : 'transparent'};">Followers (${followers.length})</button>
                    <button id="tabSuggestions" class="friends-tab" onclick="switchFriendsTab('suggestions')" style="background: none; border: none; color: ${friendsCurrentTab === 'suggestions' ? '#00ff88' : '#888'}; padding: 10px 20px; font-size: 16px; cursor: pointer; border-bottom: 2px solid ${friendsCurrentTab === 'suggestions' ? '#00ff88' : 'transparent'};">Suggestions (${suggestions.length})</button>
                </div>
                
                <div id="friendsList">
        `;
        
        // Display based on current tab
        let usersToShow = [];
        if (friendsCurrentTab === 'following') usersToShow = following;
        else if (friendsCurrentTab === 'followers') usersToShow = followers;
        else usersToShow = suggestions;
        
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
                            ${user.avatar_url ? `<img src="${user.avatar_url}" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover;">` : `<div style="width: 50px; height: 50px; border-radius: 50%; background: #333; display: flex; align-items: center; justify-content: center; font-size: 24px;">👤</div>`}
                            <div>
                                <div style="font-weight: bold;">${escapeHtml(user.username || 'User')}</div>
                                <div style="font-size: 12px; color: #888;">@${escapeHtml(user.username || 'user')}</div>
                            </div>
                        </div>
                        ${user.id !== USER?.id ? `
                            <button id="follow-btn-${user.id}" class="follow-action-btn" onclick="toggleFollow('${user.id}')" style="background: ${isFollowing ? '#333' : '#00ff88'}; color: ${isFollowing ? '#fff' : '#000'}; border: none; padding: 8px 20px; border-radius: 20px; cursor: pointer; font-weight: bold;">
                                ${isFollowing ? 'Following' : 'Follow'}
                            </button>
                        ` : ''}
                    </div>
                `;
            }
        }
        
        html += `</div></div>`;
        feedDiv.innerHTML = html;
        
        // Setup search listener
        const searchInput = document.getElementById('searchUsersInput');
        if (searchInput) {
            const newSearchInput = searchInput.cloneNode(true);
            searchInput.parentNode.replaceChild(newSearchInput, searchInput);
            newSearchInput.addEventListener('input', (e) => {
                filterFriendsList(e.target.value, usersToShow, followingIds);
            });
        }
        
    } catch (err) {
        console.error("Friends page error:", err);
        feedDiv.innerHTML = `<div class="loading" style="color: #ff4444;">Error loading friends: ${err.message}</div>`;
    }
}

async function switchFriendsTab(tab) {
    friendsCurrentTab = tab;
    await loadFriends();
}

function filterFriendsList(searchTerm, users, followingIds) {
    if (!users) return;
    
    const filtered = users.filter(user => 
        (user.username || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    const container = document.getElementById('friendsList');
    if (!container) return;
    
    if (filtered.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: #888;">No users found</div>';
        return;
    }
    
    let html = '';
    for (const user of filtered) {
        const isFollowing = followingIds.has(user.id);
        html += `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px; border-bottom: 1px solid #222;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    ${user.avatar_url ? `<img src="${user.avatar_url}" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover;">` : `<div style="width: 50px; height: 50px; border-radius: 50%; background: #333; display: flex; align-items: center; justify-content: center; font-size: 24px;">👤</div>`}
                    <div>
                        <div style="font-weight: bold;">${escapeHtml(user.username || 'User')}</div>
                        <div style="font-size: 12px; color: #888;">@${escapeHtml(user.username || 'user')}</div>
                    </div>
                </div>
                ${user.id !== USER?.id ? `
                    <button class="follow-action-btn" onclick="toggleFollow('${user.id}')" style="background: ${isFollowing ? '#333' : '#00ff88'}; color: ${isFollowing ? '#fff' : '#000'}; border: none; padding: 8px 20px; border-radius: 20px; cursor: pointer; font-weight: bold;">
                        ${isFollowing ? 'Following' : 'Follow'}
                    </button>
                ` : ''}
            </div>
        `;
    }
    container.innerHTML = html;
}

async function toggleFollow(userId) {
    if (!USER) { 
        alert('Login to follow'); 
        openAuthModal(); 
        return; 
    }
    if (userId === USER.id) { 
        alert("You can't follow yourself"); 
        return; 
    }
    
    try {
        const { data: existing } = await SB.from("follows").select("*").eq("follower_id", USER.id).eq("following_id", userId);
        
        if (existing && existing.length > 0) {
            await SB.from("follows").delete().eq("follower_id", USER.id).eq("following_id", userId);
            const btn = document.getElementById(`follow-btn-${userId}`);
            if (btn) {
                btn.innerText = "Follow";
                btn.style.background = "#00ff88";
                btn.style.color = "#000";
            }
        } else {
            await SB.from("follows").insert({ follower_id: USER.id, following_id: userId });
            const btn = document.getElementById(`follow-btn-${userId}`);
            if (btn) {
                btn.innerText = "Following";
                btn.style.background = "#333";
                btn.style.color = "#fff";
            }
        }
        await loadFriends();
    } catch (err) {
        console.error("Toggle follow error:", err);
        alert("Error: " + err.message);
    }
}
