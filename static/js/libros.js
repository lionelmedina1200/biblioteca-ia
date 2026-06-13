// ══════════════════════════════════════════════════════════
// libros.js — gestión completa de libros
// ══════════════════════════════════════════════════════════

function getNuevoBadge() {
    var span = document.createElement('span');
    span.textContent = 'NUEVO';
    span.style.cssText = 'background:#1e40af;color:#93c5fd;font-size:0.65rem;font-weight:800;padding:2px 6px;border-radius:4px;margin-left:4px;';
    return span.outerHTML;
}

let currentPage = 1;
let perPage = 10;
let tipoEstructura = 'ninguno'; // 'ninguno' | 'capitulos' | 'bloques'
let bloquesCount = 0;
let capsCount = 0;
let modoEdicion = false;

// ── Cargar tabla ─────────────────────────────────────────
async function loadLibros(page = 1) {
    currentPage = page;
    _librosAdminCache = []; // limpiar cache al recargar
    const busqueda = document.getElementById('admin-search')?.value || '';
    try {
        const res  = await fetch(`/api/libros?page=${page}&per_page=${perPage}&busqueda=${encodeURIComponent(busqueda)}`);
        const data = await res.json();
        const tbody = document.getElementById('admin-tbody');
        if (!tbody) return;

        // Badge NUEVO: los 10 IDs más altos de esta página
        const todosIds = [...data.libros].map(l => l.id).sort((a,b) => b-a);
        const idsNuevos = new Set(todosIds.slice(0, Math.min(10, todosIds.length)));

        tbody.innerHTML = data.libros.map(l => {
            const esNuevo = idsNuevos.has(l.id);
            return `
            <tr id="fila-${l.id}" style="cursor:pointer;" onclick="abrirDetalleLibro(${l.id}, event)">
                <td>${l.id} ${esNuevo ? getNuevoBadge() : ''}</td>
                <td><strong>${l.titulo}</strong></td>
                <td>${l.autor || '-'}</td>
                <td>${l.editorial || '-'}</td>
                <td>${l.categoria || '-'}</td>
                <td>
                    <div class="stock-control" onclick="event.stopPropagation()">
                        <input type="number" min="0" value="${l.disponible}" class="stock-input" data-libro-id="${l.id}">
                        <button onclick="actualizarStock(${l.id})" class="btn-stock">OK</button>
                    </div>
                </td>
                <td>
                    <span class="badge ${l.disponible > 0 ? 'disponible' : 'no-disponible'}">
                        ${l.disponible > 0 ? l.disponible + ' en stock' : 'Sin stock'}
                    </span>
                </td>
                <td onclick="event.stopPropagation()">
                    <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
                        <button class="btn-editar" onclick="abrirModalEditar(${l.id})">Editar</button>
                        <button class="btn-eliminar-libro" onclick="eliminarLibro(${l.id}, '${(l.titulo||'').replace(/'/g, '').replace(/"/g, '')}')">Eliminar</button>
                    </div>
                </td>
            </tr>`;
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
        if (i === 1 || i === totalPages || (i >= current-1 && i <= current+1)) {
            html += `<button class="page-btn ${i===current?'active':''}" onclick="loadLibros(${i})">${i}</button>`;
        } else if (i === current-2 || i === current+2) {
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
        const res  = await fetch(`/api/libros?per_page=1000`);
        const data = await res.json();
        const libro = data.libros.find(l => l.id === id);
        if (!libro) return;

        document.getElementById('edit-id').value    = id;
        document.getElementById('nuevo-titulo').value    = libro.titulo    || '';
        document.getElementById('nuevo-autor').value     = libro.autor     || '';
        document.getElementById('nuevo-editorial').value = libro.editorial || '';
        document.getElementById('nuevo-categoria').value = libro.categoria || '';
        document.getElementById('nuevo-stock').value     = libro.disponible || 1;

        // Cargar estructura si tiene capitulos guardados
        if (libro.capitulo && libro.capitulo.trim()) {
            const raw = libro.capitulo;
            // detectar si tiene bloques (formato "BLOQUE:nombre||cap1||cap2||---BLOQUE:...")
            if (raw.includes('BLOQUE:')) {
                setTipo('bloques');
                // parsear bloques
                const bloques = raw.split('---').filter(b => b.trim());
                bloques.forEach(b => {
                    const lines = b.split('||');
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
    } catch(e) {
        console.error(e);
    }
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
    document.getElementById('agregar-ok').style.display = 'none';
    document.getElementById('edit-id').value = '';
    setTipo('ninguno');
}

// ── Tipo estructura ───────────────────────────────────────
function setTipo(tipo) {
    tipoEstructura = tipo;
    document.querySelectorAll('.tipo-btn').forEach((b, i) => {
        b.classList.toggle('active', ['ninguno','capitulos','bloques'][i] === tipo);
    });
    document.getElementById('panel-capitulos').style.display = tipo === 'capitulos' ? 'block' : 'none';
    document.getElementById('panel-bloques').style.display   = tipo === 'bloques'   ? 'block' : 'none';
    if (tipo !== 'capitulos') { document.getElementById('caps-lista').innerHTML = ''; capsCount = 0; document.getElementById('caps-hint').style.display = 'block'; }
    if (tipo !== 'bloques')   { document.getElementById('bloques-lista').innerHTML = ''; bloquesCount = 0; }
    if (tipo === 'bloques')   { renumerarBloques(); }
}

// ── Solo capítulos ────────────────────────────────────────
function addCap(parentId, valor) {
    const lista = parentId
        ? document.getElementById('caps-bloque-' + parentId)
        : document.getElementById('caps-lista');
    if (!lista) return;
    if (!parentId) document.getElementById('caps-hint').style.display = 'none';
    const uniqueId = Date.now();
    const id = parentId ? 'bc-' + parentId + '-' + uniqueId : 'cap-' + uniqueId;
    const num = lista.children.length + 1; // numero visible correcto
    const row = document.createElement('div');
    row.className = 'cap-row';
    row.id = 'row-' + id;
    row.innerHTML = `<span class="cap-num">${num}.</span>
        <input type="text" id="${id}" class="cap-input" value="${valor||''}" placeholder="Nombre del capítulo" onkeydown="capKeydown(event, '${parentId||''}')">
        <button type="button" class="btn-del-cap" onclick="delCap('row-${id}', '${parentId||''}')">✕</button>`;
    lista.appendChild(row);
    document.getElementById(id)?.focus();
}

function delCap(rowId, parentId) {
    document.getElementById(rowId)?.remove();
    if (!parentId) {
        const lista = document.getElementById('caps-lista');
        if (lista && lista.children.length === 0) {
            document.getElementById('caps-hint').style.display = 'block';
        }
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

function capKeydown(e, parentId) {
    if (e.key === 'Enter') { e.preventDefault(); addCap(parentId || null); }
}

// ── Bloques ───────────────────────────────────────────────
function addBloque(nombre, caps) {
    const bid = Date.now(); // ID interno unico
    const lista_actual = document.getElementById('bloques-lista');
    const numVisible = lista_actual ? lista_actual.querySelectorAll('.bloque-wrap').length + 1 : 1;
    const lista = document.getElementById('bloques-lista');
    const wrap = document.createElement('div');
    wrap.className = 'bloque-wrap';
    wrap.id = 'bloque-' + bid;
    wrap.innerHTML = `
        <div class="bloque-header">
            <span class="bloque-num-label" style="color:var(--azul-claro);font-weight:700;font-size:0.88rem;">Bloque ${numVisible}</span>
            <input type="text" id="bloque-nombre-${bid}" class="bloque-titulo-input" value="${nombre||''}" placeholder="Nombre del bloque (ej: Unidad 1)">
            <button type="button" class="btn-del-bloque" onclick="delBloque(${bid})">✕</button>
        </div>
        <div id="caps-bloque-${bid}" class="caps-lista-bloque"></div>
        <button type="button" class="btn-add-cap" style="margin-top:6px;" onclick="addCap(${bid})">＋ Capítulo</button>`;
    lista.appendChild(wrap);
    // Si vienen caps preloaded
    if (caps && caps.length) {
        caps.forEach(c => addCap(bid, c));
    }
}

function delBloque(bid) {
    document.getElementById('bloque-' + bid)?.remove();
    renumerarBloques();
}

function renumerarBloques() {
    const lista = document.getElementById('bloques-lista');
    if (!lista) return;
    const bloques = lista.querySelectorAll('.bloque-wrap');
    bloquesCount = bloques.length;
    bloques.forEach((bw, i) => {
        const span = bw.querySelector('.bloque-num-label');
        if (span) span.textContent = 'Bloque ' + (i + 1);
    });
}

// ── Recolectar estructura ─────────────────────────────────
function getEstructura() {
    if (tipoEstructura === 'ninguno') return '';

    if (tipoEstructura === 'capitulos') {
        const caps = [];
        document.querySelectorAll('#caps-lista .cap-input').forEach(inp => {
            if (inp.value.trim()) caps.push(inp.value.trim());
        });
        return caps.join(' || ');
    }

    if (tipoEstructura === 'bloques') {
        const partes = [];
        document.querySelectorAll('.bloque-wrap').forEach(bw => {
            const bid = bw.id.replace('bloque-', '');
            const nombre = document.getElementById('bloque-nombre-' + bid)?.value.trim() || 'Bloque ' + bid;
            const caps = [];
            bw.querySelectorAll('.cap-input').forEach(inp => {
                if (inp.value.trim()) caps.push(inp.value.trim());
            });
            partes.push('BLOQUE:' + nombre + (caps.length ? ' || ' + caps.join(' || ') : ''));
        });
        return partes.join(' --- ');
    }
    return '';
}

// ── Guardar libro (nuevo o editado) ──────────────────────
async function guardarLibro() {
    const titulo    = document.getElementById('nuevo-titulo').value.trim();
    const autor     = document.getElementById('nuevo-autor').value.trim();
    const editorial = document.getElementById('nuevo-editorial').value.trim();
    const categoria = document.getElementById('nuevo-categoria').value.trim();
    const stock     = parseInt(document.getElementById('nuevo-stock').value) || 1;
    const estructura = getEstructura();
    const editId    = document.getElementById('edit-id').value;
    const errorEl   = document.getElementById('agregar-error');
    const okEl      = document.getElementById('agregar-ok');

    errorEl.style.display = 'none';
    okEl.style.display = 'none';

    if (!titulo || !autor) {
        errorEl.textContent = 'Título y autor son obligatorios.';
        errorEl.style.display = 'block'; return;
    }
    if (!categoria) {
        errorEl.textContent = 'La categoría es obligatoria.';
        errorEl.style.display = 'block'; return;
    }

    const body = { titulo, autor, editorial, categoria, capitulo: estructura, stock };

    try {
        let res;
        if (modoEdicion && editId) {
            res = await fetch(`/api/libros/${editId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
        } else {
            res = await fetch('/api/libros', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
        }
        const data = await res.json();
        if (res.ok) {
            okEl.textContent = data.mensaje || 'Guardado correctamente.';
            okEl.style.display = 'block';
            setTimeout(() => { cerrarModal(); loadLibros(currentPage); }, 1000);
        } else {
            errorEl.textContent = data.error || 'Error al guardar.';
            errorEl.style.display = 'block';
        }
    } catch(e) {
        errorEl.textContent = 'Error de conexión.';
        errorEl.style.display = 'block';
    }
}

// ── Eliminar ──────────────────────────────────────────────
async function eliminarLibro(id, titulo) {
    titulo = titulo || 'este libro';
    const ok = await modalConfirm({
        titulo: 'Eliminar libro',
        mensaje: `Vas a eliminar "${titulo}". Esta acción no se puede deshacer.`,
        icono: '🗑️', peligro: true, btnOk: 'Eliminar', btnNo: 'Cancelar'
    });
    if (!ok) return;
    try {
        const res  = await fetch(`/api/libros/${id}`, { method: 'DELETE', headers: {'Content-Type':'application/json'} });
        const data = await res.json();
        if (res.ok) { loadLibros(currentPage); }
        else { await modalAlert({ titulo:'Error', mensaje: data.error || 'No se pudo eliminar.', tipo:'error' }); }
    } catch(e) {
        await modalAlert({ titulo:'Error de conexión', mensaje:'No se pudo eliminar. Intentá de nuevo.', tipo:'error' });
    }
}

// ── Stock ─────────────────────────────────────────────────
async function actualizarStock(id) {
    const input = document.querySelector(`.stock-input[data-libro-id="${id}"]`);
    try {
        const res  = await fetch(`/api/libros/${id}/stock`, {
            method: 'PUT', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ cantidad: input.value })
        });
        const data = await res.json();
        if (res.ok) { loadLibros(currentPage); }
        else { await modalAlert({ titulo:'Error', mensaje: data.error || 'Error al actualizar stock.', tipo:'error' }); }
    } catch(e) {
        await modalAlert({ titulo:'Error de conexión', mensaje:'No se pudo actualizar el stock.', tipo:'error' });
    }
}

// ── Cerrar con Escape ─────────────────────────────────────
document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarModal(); });

// ── Búsqueda con debounce ─────────────────────────────────
let searchDebounce = null;
document.getElementById('admin-search')?.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => loadLibros(1), 350);
});
document.getElementById('admin-per-page')?.addEventListener('change', e => {
    perPage = parseInt(e.target.value);
    loadLibros(1);
});

if (document.getElementById('admin-tbody')) loadLibros(1);

// ── Panel detalle libro (bibliotecaria) ──────────────────
let _librosAdminCache = [];

async function abrirDetalleLibro(id, event) {
    // No abrir si click en botones de acción
    if (event && event.target.closest('button, input')) return;

    // Buscar el libro en cache o cargarlo
    if (!_librosAdminCache.length) {
        const res  = await fetch('/api/libros?per_page=500');
        const data = await res.json();
        _librosAdminCache = data.libros || [];
    }
    const libro = _librosAdminCache.find(l => l.id === id);
    if (!libro) return;

    // Crear o actualizar panel
    let panel = document.getElementById('panel-detalle-admin');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'panel-detalle-admin';
        panel.style.cssText = 'position:fixed;right:0;top:0;bottom:0;width:340px;max-width:90vw;background:var(--bg-card);border-left:1px solid var(--border);z-index:2000;padding:1.4rem;overflow-y:auto;box-shadow:-8px 0 30px rgba(0,0,0,0.4);animation:slideFromRight 0.2s ease;';
        document.body.appendChild(panel);
    }

    const disp = libro.disponible > 0 ? libro.disponible + ' en stock' : 'Sin stock';
    const dispColor = libro.disponible > 0 ? '#22c55e' : '#f87171';

    let capsHTML = '';
    if (libro.capitulo && libro.capitulo.trim()) {
        const raw = libro.capitulo;
        if (raw.includes('BLOQUE:')) {
            const bloques = raw.split('---').filter(b => b.trim());
            capsHTML = '<div style="margin-top:1rem;"><div style="color:var(--azul-claro);font-weight:700;font-size:0.82rem;margin-bottom:0.5rem;">CONTENIDO</div>' +
                bloques.map(b => {
                    const lines  = b.split('||');
                    const nombre = lines[0].replace('BLOQUE:', '').trim();
                    const caps   = lines.slice(1).filter(c => c.trim());
                    return '<div style="margin-bottom:0.8rem;">' +
                           '<div style="font-weight:700;color:var(--text-heading);font-size:0.82rem;margin-bottom:3px;">' + nombre + '</div>' +
                           caps.map(c => '<div style="padding:3px 8px;background:var(--bg-input);border-radius:5px;font-size:0.78rem;color:var(--text-main);margin-bottom:2px;">' + c + '</div>').join('') +
                           '</div>';
                }).join('') + '</div>';
        } else {
            const caps = raw.split('||').filter(c => c.trim());
            capsHTML = '<div style="margin-top:1rem;"><div style="color:var(--azul-claro);font-weight:700;font-size:0.82rem;margin-bottom:0.5rem;">CAPÍTULOS</div>' +
                caps.map((c,i) => '<div style="padding:3px 8px;background:var(--bg-input);border-radius:5px;font-size:0.78rem;color:var(--text-main);margin-bottom:2px;">' + (i+1) + '. ' + c + '</div>').join('') +
                '</div>';
        }
    }

    panel.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.2rem;">
            <span style="color:var(--azul-claro);font-size:0.75rem;font-weight:700;">${libro.categoria || 'Sin categoría'}</span>
            <button onclick="cerrarDetalleAdmin()" style="background:none;border:none;color:var(--text-muted);font-size:1.4rem;cursor:pointer;padding:0;">✕</button>
        </div>
        <div style="font-size:1.1rem;font-weight:800;color:var(--text-heading);line-height:1.3;margin-bottom:0.3rem;">${libro.titulo}</div>
        <div style="color:var(--text-muted);font-size:0.85rem;margin-bottom:1.2rem;">${libro.autor || ''}</div>
        <div style="display:flex;flex-direction:column;gap:0.5rem;">
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);font-size:0.85rem;">
                <span style="color:var(--text-muted);">Editorial</span>
                <span style="color:var(--text-heading);font-weight:500;">${libro.editorial || '-'}</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);font-size:0.85rem;">
                <span style="color:var(--text-muted);">Stock</span>
                <span style="color:${dispColor};font-weight:700;">${disp}</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:8px 0;font-size:0.85rem;">
                <span style="color:var(--text-muted);">ID</span>
                <span style="color:var(--text-heading);">#${libro.id}</span>
            </div>
        </div>
        ${capsHTML}
        <div style="display:flex;gap:0.6rem;margin-top:1.4rem;">
            <button onclick="abrirModalEditar(${libro.id});cerrarDetalleAdmin();"
                style="flex:1;padding:10px;background:rgba(59,130,246,0.15);border:1.5px solid var(--azul-claro);color:var(--azul-claro);border-radius:8px;cursor:pointer;font-weight:600;font-size:0.88rem;">
                Editar
            </button>
            <button onclick="eliminarLibro(${libro.id},'${(libro.titulo||'').replace(/'/g,'').replace(/"/g,'')}');cerrarDetalleAdmin();"
                style="flex:1;padding:10px;background:transparent;border:1.5px solid #7f1d1d;color:#f87171;border-radius:8px;cursor:pointer;font-weight:600;font-size:0.88rem;">
                Eliminar
            </button>
        </div>`;

    // Cerrar al hacer click fuera
    setTimeout(() => {
        document.addEventListener('click', cerrarDetalleClickAfuera);
    }, 100);
}

function cerrarDetalleAdmin() {
    const panel = document.getElementById('panel-detalle-admin');
    if (panel) panel.remove();
    document.removeEventListener('click', cerrarDetalleClickAfuera);
}

function cerrarDetalleClickAfuera(e) {
    const panel = document.getElementById('panel-detalle-admin');
    if (panel && !panel.contains(e.target) && !e.target.closest('#admin-tbody')) {
        cerrarDetalleAdmin();
    }
}
