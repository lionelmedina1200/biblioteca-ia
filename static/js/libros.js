// ══════════════════════════════════════════════════════════
// libros.js — gestión completa de libros (versión estable)
// ══════════════════════════════════════════════════════════

let currentPage = 1;
let perPage = 10;
let tipoEstructura = 'ninguno';
let bloquesCount = 0;
let capsCount = 0;
let modoEdicion = false;

function getNuevoBadge() {
    return '<span style="background:#1e40af;color:#93c5fd;font-size:0.65rem;font-weight:800;padding:2px 6px;border-radius:4px;margin-left:4px;">NUEVO</span>';
}

async function loadLibros(page = 1) {
    currentPage = page;
    const busqueda = document.getElementById('admin-search')?.value || '';
    try {
        const res  = await fetch(`/api/libros?page=${page}&per_page=${perPage}&busqueda=${encodeURIComponent(busqueda)}`);
        const data = await res.json();
        const tbody = document.getElementById('admin-tbody');
        if (!tbody) return;

        const todosIds = [...data.libros].map(l => l.id).sort((a,b) => b-a);
        const idsNuevos = new Set(todosIds.slice(0, Math.min(10, todosIds.length)));

        tbody.innerHTML = data.libros.map(l => {
            const esNuevo = idsNuevos.has(l.id);
            return '<tr id="fila-' + l.id + '">'
                + '<td>' + l.id + (esNuevo ? getNuevoBadge() : '') + '</td>'
                + '<td><strong>' + (l.titulo||'') + '</strong></td>'
                + '<td>' + (l.autor||'-') + '</td>'
                + '<td>' + (l.editorial||'-') + '</td>'
                + '<td>' + (l.categoria||'-') + '</td>'
                + '<td><div class="stock-control">'
                    + '<input type="number" min="0" value="' + l.disponible + '" class="stock-input" data-libro-id="' + l.id + '">'
                    + '<button onclick="actualizarStock(' + l.id + ')" class="btn-stock">OK</button>'
                + '</div></td>'
                + '<td><span class="badge ' + (l.disponible > 0 ? 'disponible' : 'no-disponible') + '">'
                    + (l.disponible > 0 ? l.disponible + ' en stock' : 'Sin stock')
                + '</span></td>'
                + '<td><div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">'
                    + '<button class="btn-editar" onclick="abrirModalEditar(' + l.id + ')">Editar</button>'
                    + '<button class="btn-eliminar-libro" onclick="eliminarLibro(' + l.id + ',\'' + (l.titulo||'').replace(/'/g,'').replace(/"/g,'') + '\')">Eliminar</button>'
                + '</div></td>'
            + '</tr>';
        }).join('');

        renderPagination(data.total_pages, page);
    } catch(err) {
        console.error('Error cargando libros:', err);
    }
}

function renderPagination(totalPages, current) {
    const container = document.getElementById('pagination');
    if (!container) return;
    let html = `<button class="page-btn" onclick="loadLibros(${current-1})" ${current===1?'disabled':''}>◀ Ant</button>`;
    for (let i = 1; i <= totalPages; i++) {
        if (i===1||i===totalPages||(i>=current-1&&i<=current+1)) {
            html += `<button class="page-btn ${i===current?'active':''}" onclick="loadLibros(${i})">${i}</button>`;
        } else if (i===current-2||i===current+2) {
            html += `<span style="padding:8px">...</span>`;
        }
    }
    html += `<button class="page-btn" onclick="loadLibros(${current+1})" ${current===totalPages?'disabled':''}>Sig ▶</button>`;
    container.innerHTML = html;
}

// ── Modal ─────────────────────────────────────────────────
async function abrirModalNuevo() {
    modoEdicion = false;
    document.getElementById('modal-libro-titulo').textContent = 'Agregar Libro';
    document.getElementById('edit-id').value = '';
    limpiarModal();
    await cargarCategorias();
    document.getElementById('modal-libro').classList.add('open');
    document.getElementById('nuevo-titulo').focus();
}

async function cargarCategorias() {
    try {
        const res  = await fetch('/api/libros?per_page=500');
        const data = await res.json();
        const cats = [...new Set((data.libros || []).map(l => l.categoria).filter(Boolean))].sort();
        const dl   = document.getElementById('categorias-list');
        if (!dl) return;
        dl.innerHTML = cats.map(c => `<option value="${c}">`).join('');
    } catch(e) {}
}

async function abrirModalEditar(id) {
    modoEdicion = true;
    document.getElementById('modal-libro-titulo').textContent = 'Editar Libro';
    limpiarModal();
    try {
        const res  = await fetch('/api/libros?per_page=1000');
        const data = await res.json();
        const libro = data.libros.find(l => l.id === id);
        if (!libro) return;
        document.getElementById('edit-id').value           = id;
        document.getElementById('nuevo-titulo').value      = libro.titulo    || '';
        document.getElementById('nuevo-autor').value       = libro.autor     || '';
        document.getElementById('nuevo-editorial').value   = libro.editorial || '';
        document.getElementById('nuevo-categoria').value   = libro.categoria || '';
        document.getElementById('nuevo-stock').value       = libro.disponible || 1;
        if (libro.capitulo && libro.capitulo.trim()) {
            const raw = libro.capitulo;
            if (raw.includes('BLOQUE:')) {
                setTipo('bloques');
                raw.split('---').filter(b => b.trim()).forEach(b => {
                    const lines  = b.split('||');
                    const nombre = lines[0].replace('BLOQUE:', '').trim();
                    const caps   = lines.slice(1).filter(c => c.trim());
                    addBloque(nombre, caps);
                });
            } else {
                setTipo('capitulos');
                raw.split('||').filter(c => c.trim()).forEach(c => addCap(null, c.trim()));
            }
        }
        document.getElementById('modal-libro').classList.add('open');
        document.getElementById('nuevo-titulo').focus();
    } catch(e) { console.error(e); }
}

function cerrarModal() {
    document.getElementById('modal-libro').classList.remove('open');
    limpiarModal();
}

function limpiarModal() {
    ['nuevo-titulo','nuevo-autor','nuevo-editorial','nuevo-categoria'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    document.getElementById('nuevo-stock').value = '1';
    document.getElementById('agregar-error').style.display = 'none';
    document.getElementById('agregar-ok').style.display    = 'none';
    document.getElementById('edit-id').value = '';
    setTipo('ninguno');
}

function setTipo(tipo) {
    tipoEstructura = tipo;
    document.querySelectorAll('.tipo-btn').forEach((b, i) => {
        b.classList.toggle('active', ['ninguno','capitulos','bloques'][i] === tipo);
    });
    document.getElementById('panel-capitulos').style.display = tipo === 'capitulos' ? 'block' : 'none';
    document.getElementById('panel-bloques').style.display   = tipo === 'bloques'   ? 'block' : 'none';
    if (tipo !== 'capitulos') { document.getElementById('caps-lista').innerHTML = ''; capsCount = 0; document.getElementById('caps-hint').style.display = 'block'; }
    if (tipo !== 'bloques')   { document.getElementById('bloques-lista').innerHTML = ''; bloquesCount = 0; }
}

function addCap(parentId, valor) {
    const lista = parentId ? document.getElementById('caps-bloque-' + parentId) : document.getElementById('caps-lista');
    if (!lista) return;
    if (!parentId) document.getElementById('caps-hint').style.display = 'none';
    const uniqueId = Date.now();
    const id  = parentId ? 'bc-' + parentId + '-' + uniqueId : 'cap-' + uniqueId;
    const num = lista.children.length + 1;
    const row = document.createElement('div');
    row.className = 'cap-row';
    row.id = 'row-' + id;
    row.innerHTML = `<span class="cap-num">${num}.</span>
        <input type="text" id="${id}" class="cap-input" value="${valor||''}" placeholder="Nombre del capítulo">
        <button type="button" class="btn-del-cap" onclick="delCap('row-${id}','${parentId||''}')">✕</button>`;
    lista.appendChild(row);
    document.getElementById(id)?.focus();
}

function delCap(rowId, parentId) {
    document.getElementById(rowId)?.remove();
    if (!parentId) {
        const lista = document.getElementById('caps-lista');
        if (lista && lista.children.length === 0) document.getElementById('caps-hint').style.display = 'block';
        renumerarCaps(null);
    } else {
        renumerarCaps(parentId);
    }
}

function renumerarCaps(parentId) {
    const selector = parentId ? '#caps-bloque-' + parentId + ' .cap-row' : '#caps-lista .cap-row';
    document.querySelectorAll(selector).forEach((r, i) => {
        r.querySelector('.cap-num').textContent = (i+1) + '.';
    });
}

function addBloque(nombre, caps) {
    const bid = Date.now();
    const lista_actual = document.getElementById('bloques-lista');
    const numVisible = lista_actual ? lista_actual.querySelectorAll('.bloque-wrap').length + 1 : 1;
    const wrap = document.createElement('div');
    wrap.className = 'bloque-wrap';
    wrap.id = 'bloque-' + bid;
    wrap.innerHTML = `
        <div class="bloque-header">
            <span class="bloque-num-label" style="color:var(--azul-claro);font-weight:700;font-size:0.88rem;">Bloque ${numVisible}</span>
            <input type="text" id="bloque-nombre-${bid}" class="bloque-titulo-input" value="${nombre||''}" placeholder="Nombre del bloque">
            <button type="button" class="btn-del-bloque" onclick="delBloque(${bid})">✕</button>
        </div>
        <div id="caps-bloque-${bid}" class="caps-lista-bloque"></div>
        <button type="button" class="btn-add-cap" style="margin-top:6px;" onclick="addCap(${bid})">＋ Capítulo</button>`;
    lista_actual.appendChild(wrap);
    if (caps && caps.length) caps.forEach(c => addCap(bid, c));
}

function delBloque(bid) {
    document.getElementById('bloque-' + bid)?.remove();
    renumerarBloques();
}

function renumerarBloques() {
    const lista = document.getElementById('bloques-lista');
    if (!lista) return;
    lista.querySelectorAll('.bloque-wrap').forEach((bw, i) => {
        const span = bw.querySelector('.bloque-num-label');
        if (span) span.textContent = 'Bloque ' + (i + 1);
    });
}

function getEstructura() {
    if (tipoEstructura === 'ninguno') return '';
    if (tipoEstructura === 'capitulos') {
        const caps = [];
        document.querySelectorAll('#caps-lista .cap-input').forEach(inp => { if (inp.value.trim()) caps.push(inp.value.trim()); });
        return caps.join(' || ');
    }
    if (tipoEstructura === 'bloques') {
        const partes = [];
        document.querySelectorAll('.bloque-wrap').forEach(bw => {
            const bid    = bw.id.replace('bloque-', '');
            const nombre = document.getElementById('bloque-nombre-' + bid)?.value.trim() || 'Bloque';
            const caps   = [];
            bw.querySelectorAll('.cap-input').forEach(inp => { if (inp.value.trim()) caps.push(inp.value.trim()); });
            partes.push('BLOQUE:' + nombre + (caps.length ? ' || ' + caps.join(' || ') : ''));
        });
        return partes.join(' --- ');
    }
    return '';
}

async function guardarLibro() {
    const titulo     = document.getElementById('nuevo-titulo').value.trim();
    const autor      = document.getElementById('nuevo-autor').value.trim();
    const editorial  = document.getElementById('nuevo-editorial').value.trim();
    const categoria  = document.getElementById('nuevo-categoria').value.trim();
    const stock      = parseInt(document.getElementById('nuevo-stock').value) || 1;
    const estructura = getEstructura();
    const editId     = document.getElementById('edit-id').value;
    const errorEl    = document.getElementById('agregar-error');
    const okEl       = document.getElementById('agregar-ok');
    errorEl.style.display = 'none';
    okEl.style.display    = 'none';
    if (!titulo || !autor) { errorEl.textContent = 'Título y autor son obligatorios.'; errorEl.style.display = 'block'; return; }
    if (!categoria)        { errorEl.textContent = 'La categoría es obligatoria.';     errorEl.style.display = 'block'; return; }
    const body = { titulo, autor, editorial, categoria, capitulo: estructura, stock };
    try {
        const res = modoEdicion && editId
            ? await fetch(`/api/libros/${editId}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) })
            : await fetch('/api/libros',            { method:'POST',headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
        const data = await res.json();
        if (res.ok) {
            okEl.textContent = data.mensaje || 'Guardado correctamente.';
            okEl.style.display = 'block';
            setTimeout(() => { cerrarModal(); loadLibros(currentPage); }, 1000);
        } else {
            errorEl.textContent = data.error || 'Error al guardar.';
            errorEl.style.display = 'block';
        }
    } catch(e) { errorEl.textContent = 'Error de conexión.'; errorEl.style.display = 'block'; }
}

async function eliminarLibro(id, titulo) {
    titulo = titulo || 'este libro';
    const ok = await modalConfirm({ titulo:'Eliminar libro', mensaje:`Vas a eliminar "${titulo}". Esta acción no se puede deshacer.`, icono:'🗑️', peligro:true, btnOk:'Eliminar', btnNo:'Cancelar' });
    if (!ok) return;
    try {
        const res  = await fetch(`/api/libros/${id}`, { method:'DELETE', headers:{'Content-Type':'application/json'} });
        const data = await res.json();
        if (res.ok) { loadLibros(currentPage); }
        else { await modalAlert({ titulo:'Error', mensaje: data.error || 'No se pudo eliminar.', tipo:'error' }); }
    } catch(e) { await modalAlert({ titulo:'Error de conexión', mensaje:'No se pudo eliminar.', tipo:'error' }); }
}

async function actualizarStock(id) {
    const input = document.querySelector(`.stock-input[data-libro-id="${id}"]`);
    try {
        const res  = await fetch(`/api/libros/${id}/stock`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ cantidad: input.value }) });
        const data = await res.json();
        if (res.ok) { loadLibros(currentPage); }
        else { await modalAlert({ titulo:'Error', mensaje: data.error || 'Error al actualizar stock.', tipo:'error' }); }
    } catch(e) { await modalAlert({ titulo:'Error de conexión', mensaje:'No se pudo actualizar el stock.', tipo:'error' }); }
}

async function importarExcel() {
    const input = document.getElementById('excel-input');
    const msg   = document.getElementById('import-msg');
    if (!input.files[0]) return;
    msg.style.display = 'block'; msg.style.color = 'var(--text-muted)'; msg.textContent = 'Importando...';
    const form = new FormData();
    form.append('archivo', input.files[0]);
    try {
        const res  = await fetch('/api/libros/importar-excel', { method:'POST', body:form, credentials:'include' });
        const data = await res.json();
        if (res.ok) { msg.style.color = '#22c55e'; msg.textContent = data.mensaje; loadLibros(1); }
        else        { msg.style.color = '#f87171'; msg.textContent = data.error || 'Error al importar'; }
    } catch(e) { msg.style.color = '#f87171'; msg.textContent = 'Error de conexión'; }
    input.value = '';
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarModal(); });

let searchDebounce = null;
document.getElementById('admin-search')?.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => loadLibros(1), 350);
});
document.getElementById('admin-per-page')?.addEventListener('change', e => {
    perPage = parseInt(e.target.value);
    loadLibros(1);
});

loadLibros(1);
