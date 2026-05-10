// ========== ENHANCED VIDEO UPLOAD WITH VISIBLE THUMBNAIL ==========

let selectedMediaFile = null;
let mediaPreviewElement = null;

function openEnhancedUploadModal() {
    if (!USER) { alert('Please login first'); openAuthModal(); return; }
    
    const modalHtml = `
        <div id="enhancedUploadModal" class="upload-modal-enhanced">
            <div class="upload-modal-content">
                <h3 style="margin-bottom:15px; text-align:center;">Create New Post</h3>
                
                <!-- File input -->
                <input type="file" id="enhancedUploadFile" accept="image/*,video/*" style="width:100%; padding:10px; margin-bottom:15px; background:#222; border:none; border-radius:10px; color:white;">
                
                <!-- Preview Area -->
                <div id="uploadPreview" class="upload-preview">
                    <div style="text-align:center; color:#888;">
                        <i class="fas fa-cloud-upload-alt" style="font-size:48px;"></i>
                        <p>Select an image or video</p>
                    </div>
                </div>
                
                <!-- Caption -->
                <input type="text" id="enhancedCaption" placeholder="Write a caption..." style="width:100%; padding:12px; margin-bottom:15px; background:#222; border:none; border-radius:10px; color:white;">
                
                <!-- Tags -->
                <input type="text" id="enhancedTags" placeholder="Add tags (comma separated)..." style="width:100%; padding:12px; margin-bottom:15px; background:#222; border:none; border-radius:10px; color:white;">
                
                <!-- High Quality Toggle -->
                <div class="upload-toggle">
                    <span class="upload-toggle-label">🎬 High Quality Upload</span>
                    <label class="switch">
                        <input type="checkbox" id="highQualityToggle" checked>
                        <span class="slider"></span>
                    </label>
                </div>
                
                <!-- Privacy -->
                <select id="enhancedPrivacy" style="width:100%; padding:12px; margin-bottom:15px; background:#222; border:none; border-radius:10px; color:white;">
                    <option value="public">🌍 Public</option>
                    <option value="friends">👥 Friends Only</option>
                    <option value="private">🔒 Only Me</option>
                </select>
                
                <!-- Allow Comments Toggle -->
                <div class="upload-toggle">
                    <span class="upload-toggle-label">💬 Allow Comments</span>
                    <label class="switch">
                        <input type="checkbox" id="allowCommentsToggle" checked>
                        <span class="slider"></span>
                    </label>
                </div>
                
                <!-- Allow Duet Toggle -->
                <div class="upload-toggle">
                    <span class="upload-toggle-label">🎵 Allow Duet/Remix</span>
                    <label class="switch">
                        <input type="checkbox" id="allowDuetToggle" checked>
                        <span class="slider"></span>
                    </label>
                </div>
                
                <div style="display:flex; gap:10px; margin-top:15px;">
                    <button onclick="uploadEnhancedPost()" style="flex:1; background:#00ff88; color:black; border:none; padding:12px; border-radius:30px; font-weight:bold; cursor:pointer;">Post</button>
                    <button onclick="closeEnhancedUploadModal()" style="flex:1; background:#333; color:white; border:none; padding:12px; border-radius:30px; cursor:pointer;">Cancel</button>
                </div>
            </div>
        </div>
    `;
    
    let modal = document.getElementById('enhancedUploadModal');
    if (modal) modal.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    const fileInput = document.getElementById('enhancedUploadFile');
    fileInput.onchange = handleMediaPreview;
}

function closeEnhancedUploadModal() {
    const modal = document.getElementById('enhancedUploadModal');
    if (modal) modal.remove();
    if (mediaPreviewElement) {
        if (mediaPreviewElement.pause) mediaPreviewElement.pause();
        mediaPreviewElement = null;
    }
    selectedMediaFile = null;
}

async function handleMediaPreview(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    selectedMediaFile = file;
    const isVideo = file.type.startsWith('video/');
    const previewDiv = document.getElementById('uploadPreview');
    
    if (isVideo) {
        const video = document.createElement('video');
        video.src = URL.createObjectURL(file);
        video.controls = true;
        video.style.width = '100%';
        video.style.maxHeight = '300px';
        video.style.borderRadius = '12px';
        video.onloadedmetadata = () => {
            generateThumbnailFromVideo(video);
        };
        previewDiv.innerHTML = '';
        previewDiv.appendChild(video);
        mediaPreviewElement = video;
    } else {
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        img.style.width = '100%';
        img.style.maxHeight = '300px';
        img.style.borderRadius = '12px';
        previewDiv.innerHTML = '';
        previewDiv.appendChild(img);
        mediaPreviewElement = img;
    }
}

function generateThumbnailFromVideo(video) {
    return new Promise((resolve) => {
        video.currentTime = 0.1;
        video.onseeked = () => {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
            const thumbnailUrl = canvas.toDataURL('image/jpeg');
            video.thumbnailDataUrl = thumbnailUrl;
            resolve(thumbnailUrl);
        };
    });
}

async function uploadEnhancedPost() {
    if (!USER) { alert('Login first'); return; }
    
    const file = selectedMediaFile || document.getElementById('enhancedUploadFile').files[0];
    const caption = document.getElementById('enhancedCaption').value;
    const privacy = document.getElementById('enhancedPrivacy').value;
    const tagsInput = document.getElementById('enhancedTags').value;
    const highQuality = document.getElementById('highQualityToggle').checked;
    const allowComments = document.getElementById('allowCommentsToggle').checked;
    const allowDuet = document.getElementById('allowDuetToggle').checked;
    
    if (!file) { alert("Select an image or video"); return; }
    
    const isVideo = file.type.startsWith('video/');
    const fileExt = file.name.split('.').pop();
    const fileName = `${USER.id}_${Date.now()}.${fileExt}`;
    
    const postBtn = document.querySelector('#enhancedUploadModal button:first-child');
    const originalText = postBtn.innerText;
    postBtn.innerText = 'Uploading...';
    postBtn.disabled = true;
    
    try {
        await SB.storage.from("post-images").upload(fileName, file);
        const { data } = SB.storage.from("post-images").getPublicUrl(fileName);
        
        let thumbnailUrl = null;
        if (isVideo && mediaPreviewElement && mediaPreviewElement.thumbnailDataUrl) {
            const thumbnailBlob = await fetch(mediaPreviewElement.thumbnailDataUrl).then(r => r.blob());
            const thumbFileName = `${USER.id}_thumb_${Date.now()}.jpg`;
            await SB.storage.from("post-images").upload(thumbFileName, thumbnailBlob);
            const thumbData = SB.storage.from("post-images").getPublicUrl(thumbFileName);
            thumbnailUrl = thumbData.publicUrl;
        }
        
        const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(t => t) : [];
        
        await SB.from("posts").insert({ 
            image_url: data.publicUrl, 
            caption: caption, 
            user_id: USER.id, 
            privacy: privacy, 
            is_ai: false, 
            likes: 0,
            is_video: isVideo,
            thumbnail_url: thumbnailUrl,
            tags: tags,
            allow_comments: allowComments,
            allow_duet: allowDuet
        });
        
        alert("Posted successfully!");
        closeEnhancedUploadModal();
        if (typeof refreshFeed === 'function') refreshFeed();
        
    } catch (err) {
        console.error("Upload error:", err);
        alert("Upload failed: " + err.message);
    } finally {
        postBtn.innerText = originalText;
        postBtn.disabled = false;
    }
}

window.openEnhancedUploadModal = openEnhancedUploadModal;
window.closeEnhancedUploadModal = closeEnhancedUploadModal;
window.uploadEnhancedPost = uploadEnhancedPost;
