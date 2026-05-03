// ========== SEARCH FUNCTIONALITY ==========

async function openSearchModal() {
    const modal = document.getElementById('searchModal');
    if (modal) {
        modal.style.display = 'flex';
        document.getElementById('searchInput').focus();
        document.getElementById('searchInput').value = '';
        document.getElementById('searchResults').innerHTML = '';
    }
}

function closeSearchModal() {
    const modal = document.getElementById('searchModal');
    if (modal) modal.style.display = 'none';
}

// Close modal when clicking outside
document.addEventListener('click', (e) => {
    const modal = document.getElementById('searchModal');
    if (modal && modal.style.display === 'flex') {
        if (!modal.contains(e.target) && !e.target.closest('.fa-search')) {
            closeSearchModal();
        }
    }
});

// Search as you type
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(async (e) => {
            const query = e.target.value.trim();
            if (query.length < 2) {
                document.getElementById('searchResults').innerHTML = '<div style="padding: 20px; text-align: center; color: #888;">Type at least 2 characters to search</div>';
                return;
            }
            await performSearch(query);
        }, 300));
    }
});

function debounce(func, delay) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

async function performSearch(query) {
    const resultsDiv = document.getElementById('searchResults');
    resultsDiv.innerHTML = '<div style="padding: 20px; text-align: center; color: #888;">Searching...</div>';
    
    try {
        // Search users by username
        const { data: users } = await SB
            .from("profiles")
            .select("*")
            .ilike("username", `%${query}%`)
            .limit(20);
        
        // Search posts by caption
        const { data: posts } = await SB
            .from("posts")
            .select("*")
            .ilike("caption", `%${query}%`)
            .limit(20);
        
        let html = '';
        
        // Users section
        if (users && users.length > 0) {
            html += `<div style="padding: 10px 15px; background: #1a1a1a; font-weight: bold; color: #00ff88;">USERS</div>`;
            for (const user of users) {
                if (user.id === USER?.id) continue;
                html += `
                    <div class="search-result-item" onclick="viewProfile('${user.id}'); closeSearchModal();">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            ${user.avatar_url ? `<img src="${user.avatar_url}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">` : `<div style="width: 40px; height: 40px; border-radius: 50%; background: #333; display: flex; align-items: center; justify-content: center; font-size: 20px;">👤</div>`}
                            <div>
                                <div style="font-weight: bold;">${escapeHtml(user.username || 'User')}</div>
                                <div style="font-size: 12px; color: #888;">@${escapeHtml(user.username || 'user')}</div>
                            </div>
                        </div>
                    </div>
                `;
            }
        }
        
        // Posts section
        if (posts && posts.length > 0) {
            html += `<div style="padding: 10px 15px; background: #1a1a1a; font-weight: bold; color: #00ff88; margin-top: 10px;">POSTS</div>`;
            for (const post of posts) {
                html += `
                    <div class="search-result-item" onclick="viewPost('${post.id}'); closeSearchModal();">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <img src="${post.image_url}" style="width: 50px; height: 50px; border-radius: 8px; object-fit: cover;">
                            <div>
                                <div style="font-weight: bold;">${escapeHtml(post.caption || 'No caption')}</div>
                                <div style="font-size: 12px; color: #888;">Post</div>
                            </div>
                        </div>
                    </div>
                `;
            }
        }
        
        if ((!users || users.length === 0) && (!posts || posts.length === 0)) {
            html = '<div style="padding: 20px; text-align: center; color: #888;">No results found for "' + escapeHtml(query) + '"</div>';
        }
        
        resultsDiv.innerHTML = html;
        
    } catch (err) {
        console.error("Search error:", err);
        resultsDiv.innerHTML = '<div style="padding: 20px; text-align: center; color: #ff4444;">Error searching</div>';
    }
}

function viewPost(postId) {
    // Scroll to the post in feed
    const post = document.getElementById(`post-${postId}`);
    if (post) {
        post.scrollIntoView({ behavior: 'smooth' });
    } else {
        // Load feed and then scroll
        loadFeed().then(() => {
            setTimeout(() => {
                const post = document.getElementById(`post-${postId}`);
                if (post) post.scrollIntoView({ behavior: 'smooth' });
            }, 500);
        });
    }
}
