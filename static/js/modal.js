// modal.js — sistema de modales personalizados
window.modalConfirm = function(o) {
    return new Promise(function(resolve) {
        var overlay = document.createElement('div');
        overlay.className = 'custom-modal-overlay';
        overlay.innerHTML =
            '<div class="custom-modal-box">' +
                '<span class="custom-modal-icon">' + (o.icono||'❓') + '</span>' +
                '<div class="custom-modal-title">' + (o.titulo||'Confirmá') + '</div>' +
                '<div class="custom-modal-msg">' + (o.mensaje||'') + '</div>' +
                '<div class="custom-modal-btns">' +
                    '<button class="custom-modal-btn-cancel" id="cm-no">' + (o.btnNo||'Cancelar') + '</button>' +
                    '<button class="custom-modal-btn-confirm ' + (o.peligro?'danger':'') + '" id="cm-si">' + (o.btnOk||'Confirmar') + '</button>' +
                '</div>' +
            '</div>';
        document.body.appendChild(overlay);
        function cerrar(r){ document.body.removeChild(overlay); resolve(r); }
        overlay.querySelector('#cm-si').onclick  = function(){ cerrar(true); };
        overlay.querySelector('#cm-no').onclick  = function(){ cerrar(false); };
        overlay.onclick = function(e){ if(e.target===overlay) cerrar(false); };
    });
};

window.modalAlert = function(o) {
    return new Promise(function(resolve) {
        var iconos = {success:'✅', error:'❌', info:'ℹ️', warning:'⚠️'};
        var overlay = document.createElement('div');
        overlay.className = 'custom-modal-overlay';
        overlay.innerHTML =
            '<div class="custom-modal-box">' +
                '<span class="custom-modal-icon">' + (iconos[o.tipo]||'ℹ️') + '</span>' +
                '<div class="custom-modal-title">' + (o.titulo||'Aviso') + '</div>' +
                '<div class="custom-modal-msg">' + (o.mensaje||'') + '</div>' +
                '<div class="custom-modal-btns">' +
                    '<button class="custom-modal-btn-ok" id="cm-ok">Entendido</button>' +
                '</div>' +
            '</div>';
        document.body.appendChild(overlay);
        function cerrar(){ document.body.removeChild(overlay); resolve(); }
        overlay.querySelector('#cm-ok').onclick = cerrar;
        overlay.onclick = function(e){ if(e.target===overlay) cerrar(); };
    });
};
