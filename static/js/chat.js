const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
if (sendBtn) sendBtn.addEventListener('click', sendMessage);
if (chatInput) chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });

// SVG del Perro
const dogSvg = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M30 60 Q30 30 50 30 Q70 30 70 60 Z" fill="#d4a373"/><ellipse cx="50" cy="60" rx="15" ry="12" fill="#f3e5ab"/><circle cx="50" cy="55" r="4" fill="#333"/><circle cx="40" cy="45" r="3" fill="#333"/><circle cx="60" cy="45" r="3" fill="#333"/><rect x="30" y="38" width="20" height="14" rx="5" fill="none" stroke="#3b82f6" stroke-width="2"/><rect x="50" y="38" width="20" height="14" rx="5" fill="none" stroke="#3b82f6" stroke-width="2"/></svg>`;

async function sendMessage() {
    const mensaje = chatInput.value.trim();
    if (!mensaje) return;
    addMessage(mensaje, 'user');
    chatInput.value = '';
    const typing = showTyping();
    try {
        const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mensaje }) });
        const data = await res.json();
        typing.remove();
        addMessage(data.respuesta, 'bot');
    } catch { typing.remove(); addMessage('❌ Error de conexión. Intentá de nuevo.', 'bot'); }
}

function addMessage(text, type) {
    const div = document.createElement('div');
    div.className =  `message ${type}` ;
    const avatarHtml = type === 'bot' ? dogSvg : '👤';
    const formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
    div.innerHTML =  `<div class="message-avatar">${avatarHtml}</div><div class="message-content"><p>${formatted}</p></div>`;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showTyping() {
    const div = document.createElement('div');
    div.className = 'message bot';
    div.innerHTML =  `<div class="message-avatar">${dogSvg}</div><div class="message-content"><div class="typing-indicator"><span></span><span></span><span></span></div></div>`;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return div;
}