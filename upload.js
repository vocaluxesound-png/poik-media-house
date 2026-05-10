// ========== ADVANCED VIDEO UPLOAD WITH THUMBNAIL ==========

let selectedVideoFile = null;
let videoPreviewElement = null;

// Open enhanced upload modal
function openEnhancedUploadModal() {
    if (!USER) { alert('Please login first'); openAuthModal(); return; }
    
    const modalHtml = `
        <div id="enhancedUploadModal" class="upload-modal" style="display:flex; z-index:1000;">
            <div style="background:#1a1a1a; padding:20px; border-radius:20px; width:90%; max-width:500px;">
                <h3 style="margin-bottom:15px;">Create Post</h3>
                
                <!-- Media Preview -->
                <div id="uploadPreview" style="background:#0a0a0a; border-radius:12px; margin-bottom:15px; min-height:200px; display:flex; align-items:center; justify-content:center;">
                    <div style="text-align:center; color:#888;">
                        <i class="fas fa-cloud-upload-alt" style="font-size:48px;"></i>
                        <p>Select image or video</p>
                    </div>
                </div>
                
                <input type="file" id="enhancedUploadFile" accept="image/*,video/*" style="margin-bottom:15px;">
                
                <!-- Caption -->
                <input type="text" id="enhancedCaption" placeholder="Write a caption..." style="width:100%; padding:12px; margin-bottom:15px; background:#222; border:none; border-radius:10px; color:white;">
                
                <!-- Tags -->
                <input type="text" id="enhancedTags" placeholder="Add tags (comma separated)..." style="width:100%; padding:12px; margin-bottom:15px; background:#222; border:none; border-radius:10px; color:white;">
                
                <!-- High Quality Toggle -->
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                    <span>📱 High Quality Upload</span>
                    <label class="switch">
                        <input type="checkbox" id="highQualityToggle" checked>
                        <span class="slider round"></span>
                    </label>
                </div>
                
                <!-- Privacy -->
                <select id="enhancedPrivacy" style="width:100%; padding:12px; margin-bottom:15px; background:#222; border:none; border-radius:10px; color:white;">
                    <option value="public">🌍 Public</option>
                    <option value="friends">👥 Friends Only</option>
                    <option value="private">🔒 Only Me</option>
                </select>
                
                <!-- Comments Toggle -->
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                    <span>💬 Allow Comments</span>
                    <label class="switch">
                        <input type="checkbox" id="allowCommentsToggle" checked>
                        <span class="slider round"></span>
                    </label>
                </div>
                
                <!-- Duet/Remix Toggle -->
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <span>🎵 Allow Duet/Remix</span>
                    <label class="switch">
                        <input type="checkbox" id="allowDuetToggle" checked>
                        <span class="slider round"></span>
                    </label>
                </div>
                
                <div style="display:flex; gap:10px;">
                    <button onclick="uploadEnhancedPost()" style="flex:1; background:#00ff88; color:black; border:none; padding:12px; border-radius:30px; font-weight:bold; cursor:pointer;">Post</button>
                    <button onclick="closeEnhancedUploadModal()" style="flex:1; background:#333; color:white; border:none; padding:12px; border-radius:30px; cursor:pointer;">Cancel</button>
                </div>
            </div>
        </div>
    `;
    
    // Add modal to body
    let modal = document.getElementById('enhancedUploadModal');
    if (modal) modal.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Handle file selection
    const fileInput = document.getElementById('enhancedUploadFile');
    fileInput.onchange = handleFilePreview;
}

function closeEnhancedUploadModal() {
    const modal = document.getElementById('enhancedUploadModal');
    if (modal) modal.remove();
    if (videoPreviewElement) {
        videoPreviewElement.pause();
        videoPreviewElement = null;
    }
    selectedVideoFile = null;
}

async function handleFilePreview(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    selectedVideoFile = file;
    const isVideo = file.type.startsWith('video/');
    const previewDiv = document.getElementById('uploadPreview');
    
    if (isVideo) {
        // Create video element
        const video = document.createElement('video');
        video.src = URL.createObjectURL(file);
        video.controls = true;
        video.style.width = '100%';
        video.style.maxHeight = '300px';
        video.style.borderRadius = '12px';
        video.onloadedmetadata = () => {
            // Auto-generate thumbnail from first frame
            generateThumbnailFromVideo(video);
        };
        previewDiv.innerHTML = '';
        previewDiv.appendChild(video);
        videoPreviewElement = video;
    } else {
        // Image preview
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        img.style.width = '100%';
        img.style.maxHeight = '300px';
        img.style.borderRadius = '12px';
        previewDiv.innerHTML = '';
        previewDiv.appendChild(img);
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
            video.thumbnailUrl = thumbnailUrl;
            resolve(thumbnailUrl);
        };
    });
}

async function uploadEnhancedPost() {
    if (!USER) { alert('Login first'); return; }
    
    const file = selectedVideoFile || document.getElementById('enhancedUploadFile').files[0];
    const caption = document.getElementById('enhancedCaption').value;
    const privacy = document.getElementById('enhancedPrivacy').value;
    const tagsInput = document.getElementById('enhancedTags').value;
    const highQuality = document.getElementById('highQualityToggle').checked;
    const allowComments = document.getElementById('allowCommentsToggle').checked;
    const allowDuet = document.getElementById('allowDuetToggle').checked;
    
    if (!file) { alert("Select an image or video"); return; }
    
    const isVideo = file.type.startsWith('video/');
    const fileName = `${USER.id}_${Date.now()}.${file.name.split('.').pop()}`;
    
    // Show uploading indicator
    const postBtn = document.querySelector('#enhancedUploadModal button:first-child');
    const originalText = postBtn.innerText;
    postBtn.innerText = 'Uploading...';
    postBtn.disabled = true;
    
    try {
        // Upload file
        await SB.storage.from("post-images").upload(fileName, file);
        const { data } = SB.storage.from("post-images").getPublicUrl(fileName);
        
        let thumbnailUrl = null;
        if (isVideo && videoPreviewElement && videoPreviewElement.thumbnailUrl) {
            // Upload thumbnail
            const thumbnailBlob = await fetch(videoPreviewElement.thumbnailUrl).then(r => r.blob());
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

// Add toggle switch CSS
const toggleStyles = document.createElement('style');
toggleStyles.textContent = `
.switch {
    position: relative;
    display: inline-block;
    width: 50px;
    height: 24px;
}
.switch input {
    opacity: 0;
    width: 0;
    height: 0;
}
.slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #ccc;
    transition: .3s;
    border-radius: 24px;
}
.slider:before {
    position: absolute;
    content: "";
    height: 18px;
    width: 18px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: .3s;
    border-radius: 50%;
}
input:checked + .slider {
    background-color: #00ff88;
}
input:checked + .slider:before {
    transform: translateX(26px);
}
`;

document.head.appendChild(toggleStyles);

// Expose functions
window.openEnhancedUploadModal = openEnhancedUploadModal;
window.closeEnhancedUploadModal = closeEnhancedUploadModal;
window.uploadEnhancedPost = uploadEnhancedPost;
