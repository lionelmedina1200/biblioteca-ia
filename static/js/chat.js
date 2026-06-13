const chatMessages = document.getElementById('chat-messages');
const chatInput    = document.getElementById('chat-input');
const sendBtn      = document.getElementById('send-btn');

// Historial de la sesión actual para dar contexto a la IA
let _historialSesion = [];

if (sendBtn) sendBtn.addEventListener('click', sendMessage);
if (chatInput) chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });

async function sendMessage() {
    if (window.isChatUnlocked && !window.isChatUnlocked()) {
        const m = document.getElementById('login-modal');
        if (m) m.style.display = 'flex';
        return;
    }
    const mensaje = chatInput.value.trim();
    if (!mensaje) return;

    addMessage(mensaje, 'user');
    if (window.guardarMensajeChat) window.guardarMensajeChat('user', mensaje);
    chatInput.value = '';

    // Agregar al historial local
    _historialSesion.push({ rol: 'user', mensaje });

    const typing = showTyping();
    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mensaje,
                historial: _historialSesion.slice(-8) // últimos 8 mensajes de contexto
            })
        });
        const data = await res.json();
        typing.remove();
        addMessage(data.respuesta, 'bot');
        if (window.guardarMensajeChat) window.guardarMensajeChat('bot', data.respuesta);

        // Agregar respuesta al historial
        _historialSesion.push({ rol: 'bot', mensaje: data.respuesta });

        // Limitar historial a 20 mensajes
        if (_historialSesion.length > 20) _historialSesion = _historialSesion.slice(-20);

    } catch {
        typing.remove();
        addMessage('Error de conexión. Intentá de nuevo.', 'bot');
    }
}

// Limpiar historial al cambiar de sesión
window._limpiarHistorialSesion = function() {
    _historialSesion = [];
};

function addMessage(text, type) {
    const div = document.createElement('div');
    div.className = `message ${type}`;
    const iaAvatar = '<svg viewBox="0 0 36 36" width="36" height="36"><circle cx="18" cy="18" r="18" fill="#1e3a5f"/><text x="18" y="23" font-size="16" text-anchor="middle" fill="#fff">IA</text></svg>';
    const userAvatar = window.getAvatarHTML ? window.getAvatarHTML(window.getCurrentUser ? window.getCurrentUser() : null, 32) : '👤';
    const avatar   = type === 'bot' ? iaAvatar : userAvatar;
    const formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
    div.innerHTML = `<div class="message-avatar">${avatar}</div><div class="message-content"><p>${formatted}</p></div>`;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showTyping() {
    const div = document.createElement('div');
    div.className = 'message bot';
    const iaAvatar = '<svg viewBox="0 0 36 36" width="36" height="36"><circle cx="18" cy="18" r="18" fill="#1e3a5f"/><text x="18" y="23" font-size="16" text-anchor="middle" fill="#fff">IA</text></svg>';
    div.innerHTML = `<div class="message-avatar">${iaAvatar}</div><div class="message-content"><div class="typing-indicator"><span></span><span></span><span></span></div></div>`;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return div;
}
