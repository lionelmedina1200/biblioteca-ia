document.addEventListener('DOMContentLoaded', () => {
    const userMenu = document.getElementById('user-menu');
    const navDashboard = document.getElementById('nav-dashboard');
    const navRegistro = document.getElementById('nav-registro');
    const navLibros = document.getElementById('nav-libros');
    const navLogs = document.getElementById('nav-logs');
    const navMisLibros = document.getElementById('nav-mis-libros');
    const loginModal = document.getElementById('login-modal');
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
    const closeModal = document.getElementById('close-login');

    function clearChat() {
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) {
            chatMessages.innerHTML = `
                <div class="message bot">
                    <div class="message-avatar">
                        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M30 60 Q30 30 50 30 Q70 30 70 60 Z" fill="#d4a373"/><ellipse cx="50" cy="60" rx="15" ry="12" fill="#f3e5ab"/><circle cx="50" cy="55" r="4" fill="#333"/><circle cx="40" cy="45" r="3" fill="#333"/><circle cx="60" cy="45" r="3" fill="#333"/><rect x="30" y="38" width="20" height="14" rx="5" fill="none" stroke="#3b82f6" stroke-width="2"/><rect x="50" y="38" width="20" height="14" rx="5" fill="none" stroke="#3b82f6" stroke-width="2"/></svg>
                    </div>
                    <div class="message-content"><p>¡Hola! 🐶 Soy ChacaBot, el asistente de la biblioteca. ¿En qué libro te puedo ayudar hoy?</p></div>
                </div>`;
        }
    }

    function updateUI(usuario) {
        if (!userMenu) return;
        if (!usuario) {
            userMenu.innerHTML = `<div class="avatar" id="avatar-login" title="Iniciar sesión"><svg viewBox="0 0 100 100" width="40" height="40"><circle cx="50" cy="35" r="22" fill="#fff"/><ellipse cx="50" cy="85" rx="35" ry="25" fill="#fff"/><circle cx="50" cy="50" r="48" fill="none" stroke="#c0392b" stroke-width="4"/></svg></div>`;
            document.getElementById('avatar-login').onclick = () => { if(loginModal) loginModal.style.display = 'block'; };
            if(navDashboard) navDashboard.style.display = 'none';
            if(navRegistro) navRegistro.style.display = 'none';
            if(navLibros) navLibros.style.display = 'none';
            if(navLogs) navLogs.style.display = 'none';
            if(navMisLibros) navMisLibros.style.display = 'none';
        } else {
            userMenu.innerHTML = `<div class="user-info"><span>Hola, ${usuario.nombre}</span><button id="btn-logout" class="btn-logout">Salir</button></div>`;
            document.getElementById('btn-logout').onclick = async () => {
                await fetch('/api/logout', { method: 'POST' });
                alert('✅ Se cerró tu sesión correctamente.');
                clearChat();
                window.location.href = '/';
            };

            if (usuario.rol === 'bibliotecario') {
                if(navDashboard) navDashboard.style.display = 'block';
                if(navRegistro) navRegistro.style.display = 'block';
                if(navLibros) navLibros.style.display = 'block';
                if(navMisLibros) navMisLibros.style.display = 'none'; // OCULTO PARA BIBLIO
                if(navLogs) navLogs.style.display = 'none';
            } else if (usuario.rol === 'admin') {
                if(navLogs) navLogs.style.display = 'block';
                if(navMisLibros) navMisLibros.style.display = 'block';
            } else {
                if(navMisLibros) navMisLibros.style.display = 'block';
            }
        }
    }

    fetch('/api/session')
        .then(res => res.json())
        .then(data => {
            updateUI(data.logged_in ? data.usuario : null);
            clearChat();
        })
        .catch(() => { updateUI(null); clearChat(); });

    if (closeModal) closeModal.onclick = () => loginModal.style.display = 'none';
    window.onclick = (e) => { if (e.target == loginModal) loginModal.style.display = 'none'; };

    if (loginForm) {
        loginForm.onsubmit = async (e) => {
            e.preventDefault();
            const username = document.getElementById('login-username').value.trim();
            const password = document.getElementById('login-password').value;
            try {
                const res = await fetch('/api/login', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await res.json();
                if (res.ok) {
                    loginModal.style.display = 'none';
                    updateUI(data.usuario);
                    clearChat();
                    loginError.style.display = 'none';
                } else {
                    loginError.textContent = data.error;
                    loginError.style.display = 'block';
                }
            } catch {
                loginError.textContent = 'Error de conexión';
                loginError.style.display = 'block';
            }
        };
    }
});