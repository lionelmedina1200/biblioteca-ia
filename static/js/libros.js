// ══════════════════════════════════════════════════════════
// libros.js — gestión completa de libros
// ══════════════════════════════════════════════════════════

let currentPage = 1;
let perPage = 10;
let tipoEstructura = 'ninguno'; // 'ninguno' | 'capitulos' | 'bloques'
let bloquesCount = 0;
let capsCount = 0;
let modoEdicion = false;

// ── Cargar tabla ─────────────────────────────────────────
async function loadLibros(page = 1) {
    currentPage = page;
    const busqueda = document.getElementById('admin-search')?.value || '';
    try {
        const res  = await fetch(`/api/libros?page=${page}&per_page=${perPage}&busqueda=${encodeURIComponent(busqueda)}`);
        const data = await res.json();
        const tbody = document.getElementById('admin-tbody');

        tbody.innerHTML = data.libros.map(l => `
            <tr id="fila-${l.id}">
                <td>${l.id}</td>
                <td><strong>${l.titulo}</strong></td>
                <td>${l.autor || '-'}</td>
                <td>${l.editorial || '-'}</td>
                <td>${l.categoria || '-'}</td>
                <td>
                    <div class="stock-control">
                        <input type="number" min="0" value="${l.disponible}" class="stock-input" data-libro-id="${l.id}">
                        <button onclick="actualizarStock(${l.id})" class="btn-stock">OK</button>
                    </div>
                </td>
                <td>
                    <span class="badge ${l.disponible > 0 ? 'disponible' : 'no-disponible'}">
                        ${l.disponible > 0 ? l.disponible + ' en stock' : 'Sin stock'}
                    </span>
                </td>
                <td>
                    <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
                        <button class="btn-editar" onclick="abrirModalEditar(${l.id})">Editar</button>
                        <button class="btn-eliminar-libro" onclick="eliminarLibro(${l.id}, '${(l.titulo||'').replace(/'/g, '').replace(/"/g, '')}')">Eliminar</button>
                    </div>
                </td>
            </tr>
        `).join('');

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
    capsCount++;
    const lista = parentId
        ? document.getElementById('caps-bloque-' + parentId)
        : document.getElementById('caps-lista');
    if (!parentId) document.getElementById('caps-hint').style.display = 'none';
    const id = parentId ? 'bc-' + parentId + '-' + capsCount : 'cap-' + capsCount;
    const row = document.createElement('div');
    row.className = 'cap-row';
    row.id = 'row-' + id;
    row.innerHTML = `<span class="cap-num">${lista.children.length + 1}.</span>
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
        // renumerar
        document.querySelectorAll('#caps-lista .cap-row').forEach((r, i) => {
            r.querySelector('.cap-num').textContent = (i+1) + '.';
        });
    }
}

function capKeydown(e, parentId) {
    if (e.key === 'Enter') { e.preventDefault(); addCap(parentId || null); }
}

// ── Bloques ───────────────────────────────────────────────
function addBloque(nombre, caps) {
    // usar cantidad real de bloques actuales + 1
    const lista_actual = document.getElementById('bloques-lista');
    bloquesCount = lista_actual ? lista_actual.querySelectorAll('.bloque-wrap').length + 1 : bloquesCount + 1;
    const bid = Date.now(); // ID unico para evitar colisiones
    const lista = document.getElementById('bloques-lista');
    const wrap = document.createElement('div');
    wrap.className = 'bloque-wrap';
    wrap.id = 'bloque-' + bid;
    wrap.innerHTML = `
        <div class="bloque-header">
            <span style="color:var(--azul-claro);font-weight:700;font-size:0.88rem;">Bloque ${bid}</span>
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
        const num = i + 1;
        const span = bw.querySelector('span[style*="azul-claro"]');
        if (span) span.textContent = 'Bloque ' + num;
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
