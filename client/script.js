// Global variables
let videoElement = document.getElementById('video');
let videoUpload = document.getElementById('videoUpload');
let captionList = document.getElementById('captionList');
let realTimeCaption = document.getElementById('realTimeCaption');
let sourceLanguage = document.getElementById('sourceLanguage');
let targetLanguage = document.getElementById('targetLanguage');
let fontStyle = document.getElementById('fontStyle');
let fontColor = document.getElementById('fontColor');
let volumeControl = document.getElementById('volumeControl');
let manualModeBtn = document.getElementById('manualMode');
let autoModeBtn = document.getElementById('autoMode');
let stopAutoBtn = document.getElementById('stopAuto');
let addCaptionBtn = document.getElementById('addCaptionBtn');
let saveBtn = document.getElementById('saveBtn');
let status = document.getElementById('status');
let intro = document.getElementById('intro');
let dashboard = document.getElementById('dashboard');
let loginModal = document.getElementById('loginModal');
let loginStatus = document.getElementById('loginStatus');
let adSection = document.getElementById('adSection');
let captions = [];
let autoCaptions = [];
let currentMode = 'manual';
let audioContext, source, ws;
let isPremium = false;
let userLoggedIn = false;

// Show login modal initially
loginModal.style.display = 'flex';

// Login system
function sendOTP() {
    const email = document.getElementById('emailInput').value;
    if (email) {
        loginStatus.textContent = 'OTP sent to ' + email;
        document.getElementById('otpInput').style.display = 'block';
        document.getElementById('verifyBtn').style.display = 'block';
        setTimeout(() => loginStatus.textContent = 'Enter OTP (e.g., 1234)', 1000);
    } else {
        loginStatus.textContent = 'Please enter a valid email';
    }
}

function verifyOTP() {
    const otp = document.getElementById('otpInput').value;
    if (otp === '1234') {
        userLoggedIn = true;
        loginModal.style.display = 'none';
        intro.style.display = 'block';
        setTimeout(() => {
            intro.style.display = 'none';
            dashboard.style.display = 'block';
        }, 3000);
        status.textContent = 'Status: Logged in successfully';
    } else {
        loginStatus.textContent = 'Invalid OTP';
    }
}

function logout() {
    userLoggedIn = false;
    dashboard.style.display = 'none';
    loginModal.style.display = 'flex';
    loginStatus.textContent = '';
    document.getElementById('otpInput').style.display = 'none';
    document.getElementById('verifyBtn').style.display = 'none';
}

// Load video when uploaded
videoUpload.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        videoElement.src = URL.createObjectURL(file);
        videoElement.load();
        status.textContent = 'Status: Video loaded';
    }
});

// Set mode (manual or automatic)
function setMode(mode) {
    if (!userLoggedIn) return;
    currentMode = mode;
    if (mode === 'manual') {
        manualModeBtn.classList.add('active');
        autoModeBtn.classList.remove('active');
        stopAutoBtn.style.display = 'none';
        targetLanguage.disabled = true;
        addCaptionBtn.style.display = 'block';
        saveBtn.style.display = 'block';
        realTimeCaption.textContent = '';
        status.textContent = 'Status: Manual mode active';
        if (audioContext) audioContext.close();
        if (ws) ws.close();
    } else {
        autoModeBtn.classList.add('active');
        manualModeBtn.classList.remove('active');
        stopAutoBtn.style.display = 'inline-block';
        targetLanguage.disabled = false;
        addCaptionBtn.style.display = 'none';
        saveBtn.style.display = 'block';
        autoCaptions = [];
        startRealTimeCaptions();
    }
}

// Start real-time captions from video audio with retry logic
function startRealTimeCaptions(attempt = 1) {
    if (attempt > 3) {
        status.textContent = 'Status: Failed to connect to server after 3 attempts';
        realTimeCaption.textContent = 'Server unavailable - Start the server on port 5000';
        console.error('All connection attempts failed. Ensure server.js is running.');
        return;
    }

    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    source = audioContext.createMediaElementSource(videoElement);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);

    source.connect(processor);
    processor.connect(audioContext.destination);

    ws = new WebSocket('ws://localhost:5000');

    ws.onopen = () => {
        console.log('WebSocket connected successfully');
        ws.send(JSON.stringify({ config: true, language: sourceLanguage.value }));
        videoElement.play();
        status.textContent = 'Status: Listening to video audio...';
    };

    processor.onaudioprocess = (e) => {
        const audioData = e.inputBuffer.getChannelData(0);
        const buffer = new Float32Array(audioData).buffer;
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(buffer);
        }
    };

    ws.onmessage = (event) => {
        if (currentMode === 'auto') {
            const data = JSON.parse(event.data);
            const targetLang = targetLanguage.value;
            translateText(data.text, targetLang).then(translated => {
                realTimeCaption.textContent = translated;
                realTimeCaption.className = `real-time-caption ${fontStyle.value}-caption`;
                realTimeCaption.style.color = fontColor.value;
                const emoji = translated.includes('happy') ? '😊' : '🎥';
                realTimeCaption.textContent += ` ${emoji}`;
                autoCaptions.push({
                    text: translated,
                    start: videoElement.currentTime - 1,
                    end: videoElement.currentTime
                });
            });
        }
    };

    ws.onerror = (error) => {
        console.error(`WebSocket error on attempt ${attempt}:`, error);
        status.textContent = `Status: Server connection failed (Attempt ${attempt}/3)`;
        realTimeCaption.textContent = 'Retrying connection...';
        if (audioContext) audioContext.close();
        if (ws) ws.close();
        setTimeout(() => startRealTimeCaptions(attempt + 1), 2000);
    };

    ws.onclose = () => {
        if (currentMode === 'auto') {
            console.log('WebSocket closed');
            status.textContent = 'Status: Server disconnected, retrying...';
        }
    };
}

// Stop auto mode
function stopAutoMode() {
    if (audioContext) audioContext.close();
    if (ws) ws.close();
    setMode('manual');
    status.textContent = 'Status: Auto mode stopped';
}

// Real translation function using Google Translate API
async function translateText(text, targetLang) {
    if (!text) return '';
    try {
        const apiKey = 'YOUR_GOOGLE_TRANSLATE_API_KEY'; // Replace with your API key
        const response = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${apiKey}`, {
            method: 'POST',
            body: JSON.stringify({
                q: text,
                target: targetLang,
                format: 'text'
            }),
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        return data.data.translations[0].translatedText;
    } catch (error) {
        console.error('Translation error:', error);
        status.textContent = 'Status: Translation failed';
        return text;
    }
}

// Add a manual caption
function addCaption() {
    if (currentMode === 'manual') {
        const caption = { 
            text: 'New Caption', 
            start: 0, 
            end: 2, 
            style: fontStyle.value, 
            color: fontColor.value 
        };
        captions.push(caption);
        renderCaptions();
        status.textContent = 'Status: Caption added';
    }
}

// Render manual captions in the editor
function renderCaptions() {
    captionList.innerHTML = '';
    captions.forEach((caption, index) => {
        const div = document.createElement('div');
        div.innerHTML = `
            <input type="text" value="${caption.text}" oninput="updateCaption(${index}, 'text', this.value)">
            <input type="number" value="${caption.start}" placeholder="Start (s)" oninput="updateCaption(${index}, 'start', this.value)">
            <input type="number" value="${caption.end}" placeholder="End (s)" oninput="updateCaption(${index}, 'end', this.value)">
        `;
        captionList.appendChild(div);
    });
    updateVideoCaptions();
}

// Update caption data
function updateCaption(index, field, value) {
    if (field === 'start' || field === 'end') {
        captions[index][field] = parseFloat(value);
    } else {
        captions[index][field] = value;
    }
    captions[index].style = fontStyle.value;
    captions[index].color = fontColor.value;
    updateVideoCaptions();
    status.textContent = 'Status: Caption updated';
}

// Apply template to manual captions
function applyTemplate(template) {
    if (currentMode === 'manual') {
        captions.forEach(caption => caption.style = template);
        updateVideoCaptions();
        status.textContent = 'Status: Template applied';
    }
}

// Update video captions (manual mode)
function updateVideoCaptions() {
    videoElement.addEventListener('timeupdate', () => {
        if (currentMode === 'manual') {
            const currentTime = videoElement.currentTime;
            let activeCaption = captions.find(c => currentTime >= c.start && currentTime <= c.end);
            
            const existingManual = document.querySelector('.manual-caption');
            existingManual?.remove();
            
            if (activeCaption) {
                const captionDiv = document.createElement('div');
                captionDiv.textContent = activeCaption.text;
                captionDiv.className = `${activeCaption.style}-caption manual-caption`;
                captionDiv.style.color = activeCaption.color;
                captionDiv.style.position = 'absolute';
                captionDiv.style.bottom = '10%';
                captionDiv.style.left = '50%';
                captionDiv.style.transform = 'translateX(-50%)';
                videoElement.parentElement.appendChild(captionDiv);
            }
        }
    });
}

// Trim video (mock implementation)
function trimVideo() {
    status.textContent = 'Status: Video trimming not fully implemented';
}

// Enhance video (mock 2X quality improvement)
function enhanceVideo() {
    if (isPremium) {
        status.textContent = 'Status: Video enhanced (2X quality)';
    } else {
        status.textContent = 'Status: Upgrade to Premium for video enhancement';
    }
}

// Volume control
volumeControl.addEventListener('input', () => {
    videoElement.volume = volumeControl.value;
    status.textContent = `Status: Volume set to ${Math.round(volumeControl.value * 100)}%`;
});

// Save subtitles as SRT file
function saveSubtitles() {
    const subtitleData = currentMode === 'manual' ? captions : autoCaptions;
    if (subtitleData.length === 0) {
        status.textContent = 'Status: No subtitles to save';
        return;
    }

    let srtContent = '';
    subtitleData.forEach((caption, index) => {
        const startTime = formatTime(caption.start);
        const endTime = formatTime(caption.end);
        srtContent += `${index + 1}\n${startTime} --> ${endTime}\n${caption.text}\n\n`;
    });

    const blob = new Blob([srtContent], { type: 'text/srt' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vidzora_subtitles.srt';
    a.click();
    URL.revokeObjectURL(url);
    status.textContent = 'Status: Subtitles saved as SRT';
}

// Format time for SRT
function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.floor((seconds % 1) * 1000);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
}

// Premium membership upgrade
function upgradeToPremium() {
    isPremium = true;
    adSection.style.display = 'none';
    status.textContent = 'Status: Upgraded to Premium - Enjoy ad-free experience!';
}

// Extra settings functions (mock)
function showHelp() { alert('Help & Support: FAQs, Tutorials, Contact Us'); }
function showLegal() { alert('Legal & Privacy Policy: Terms of Service'); }
function showTeam() { alert('Team & Credits: Vidzora AI Team'); }
