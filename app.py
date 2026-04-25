from flask import Flask, render_template, request, jsonify, session
from database import init_db, get_db, verificar_usuario, registrar_usuario, agregar_log
from ai_engine import procesar_consulta
from auth import login_required, bibliotecario_required, admin_required
import traceback

app = Flask(__name__)
app.secret_key = "biblioteca_secreta_segura_2026_cambiame"

@app.before_request
def setup_db():
    init_db()

@app.route("/")
def index():
    return render_template("index.html")

# --- AUTENTICACIÓN ---

@app.route("/api/login", methods=["POST"])
def api_login():
    try:
        data = request.json or {}
        username = data.get("username", "").strip()
        password = data.get("password", "")
        
        if not username or not password:
            return jsonify({"error": "Usuario y contraseña son obligatorios"}), 400
        
        usuario = verificar_usuario(username, password)
        if usuario:
            session["usuario"] = {
                "id": usuario["id"],
                "username": usuario["username"],
                "nombre": usuario["nombre"],
                "email": usuario["email"],
                "rol": usuario["rol"]
            }
            
            # Log de inicio de sesión
            agregar_log(usuario["id"], usuario["nombre"], "Inicio de sesión", "usuarios", usuario["id"], f"Usuario {usuario['username']} inició sesión")
            
            return jsonify({
                "mensaje": f"Bienvenido {usuario['nombre']}",
                "usuario": session["usuario"],
                "es_biblio": usuario["rol"] == "bibliotecario",
                "es_admin": usuario["rol"] == "admin"
            })
        else:
            return jsonify({"error": "Usuario o contraseña incorrectos"}), 401
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": "Error interno del servidor"}), 500

@app.route("/api/logout", methods=["POST"])
@login_required
def api_logout():
    usuario = session.get("usuario")
    if usuario:
        agregar_log(usuario["id"], usuario["nombre"], "Cierre de sesión", "usuarios", usuario["id"], f"Usuario {usuario['username']} cerró sesión")
    session.clear()
    return jsonify({"mensaje": "Sesión cerrada correctamente"})

@app.route("/api/registro", methods=["POST"])
@bibliotecario_required
def api_registro():
    try:
        data = request.json or {}
        username = data.get("username", "").strip()
        password = data.get("password", "")
        nombre = data.get("nombre", "").strip()
        email = data.get("email", "").strip()
        
        if not all([username, password, nombre, email]):
            return jsonify({"error": "Todos los campos son obligatorios"}), 400
        
        if registrar_usuario(username, password, nombre, email, "alumno"):
            usuario_biblio = session.get("usuario")
            agregar_log(usuario_biblio["id"], usuario_biblio["nombre"], "Registro de alumno", "usuarios", None, f"Registró al alumno {nombre} ({username})")
            return jsonify({"mensaje": f"Alumno {nombre} registrado correctamente"})
        else:
            return jsonify({"error": "El username o email ya existen"}), 400
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": "Error al registrar usuario"}), 500

# --- IA ---

@app.route("/api/chat", methods=["POST"])
def chat():
    try:
        data = request.json or {}
        consulta = data.get("mensaje", "").strip()
        if not consulta:
            return jsonify({"error": "El mensaje está vacío"}), 400
        respuesta = procesar_consulta(consulta)
        return jsonify({"respuesta": respuesta})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": "Error interno del servidor"}), 500

# --- LIBROS (CATÁLOGO GENERAL) ---

@app.route("/api/libros")
def api_libros():
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 10, type=int)
    busqueda = request.args.get("busqueda", "")
    conn = get_db()
    c = conn.cursor()
    like = f"%{busqueda}%"
    
    if busqueda:
        c.execute("SELECT COUNT(*) FROM libros WHERE titulo LIKE ? OR autor LIKE ? OR categoria LIKE ?", (like, like, like))
    else:
        c.execute("SELECT COUNT(*) FROM libros")
    
    total = c.fetchone()[0]
    offset = (page - 1) * per_page
    
    if busqueda:
        c.execute("""SELECT * FROM libros WHERE titulo LIKE ? OR autor LIKE ? OR categoria LIKE ? 
                     ORDER BY id DESC LIMIT ? OFFSET ?""", (like, like, like, per_page, offset))
    else:
        c.execute("SELECT * FROM libros ORDER BY id DESC LIMIT ? OFFSET ?", (per_page, offset))
    
    libros = [dict(row) for row in c.fetchall()]
    conn.close()
    
    return jsonify({
        "libros": libros,
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": max(1, (total + per_page - 1) // per_page)
    })

# --- CRUD LIBROS (SOLO BIBLIOTECARIO) ---

@app.route("/api/libros", methods=["POST"])
@bibliotecario_required
def crear_libro():
    try:
        data = request.json or {}
        titulo = data.get("titulo", "").strip()
        autor = data.get("autor", "").strip()
        categoria = data.get("categoria", "").strip()
        editorial = data.get("editorial", "").strip()
        capitulo = data.get("capitulo", "").strip()
        ubicacion = data.get("ubicacion", "").strip()
        cantidad = int(data.get("cantidad", 1))
        
        if not all([titulo, autor, categoria]):
            return jsonify({"error": "Título, autor y categoría son obligatorios"}), 400
        
        conn = get_db()
        c = conn.cursor()
        c.execute("""INSERT INTO libros (titulo, autor, categoria, editorial, capitulo, ubicacion, cantidad, disponible)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (titulo, autor, categoria, editorial, capitulo, ubicacion, cantidad, 1 if cantidad > 0 else 0))
        libro_id = c.lastrowid
        conn.commit()
        conn.close()
        
        usuario = session.get("usuario")
        agregar_log(usuario["id"], usuario["nombre"], "Crear libro", "libros", libro_id, f"Creó el libro '{titulo}' ({cantidad} ejemplares)")
        
        return jsonify({"mensaje": "Libro creado correctamente", "id": libro_id})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": "Error al crear libro"}), 500

@app.route("/api/libros/<int:libro_id>", methods=["PUT"])
@bibliotecario_required
def actualizar_libro(libro_id):
    try:
        data = request.json or {}
        conn = get_db()
        c = conn.cursor()
        
        # Log anterior
        c.execute("SELECT titulo FROM libros WHERE id = ?", (libro_id,))
        libro_actual = c.fetchone()
        titulo_anterior = libro_actual["titulo"] if libro_actual else "Desconocido"
        
        campos = []
        valores = []
        
        for key in ["titulo", "autor", "categoria", "editorial", "capitulo", "ubicacion"]:
            if key in data:
                campos.append(f"{key} = ?")
                valores.append(data[key])
        
        if "cantidad" in data:
            campos.append("cantidad = ?")
            valores.append(int(data["cantidad"]))
            # Actualizar disponible según cantidad
            campos.append("disponible = ?")
            valores.append(1 if int(data["cantidad"]) > 0 else 0)
        
        if campos:
            valores.append(libro_id)
            c.execute(f"UPDATE libros SET {', '.join(campos)} WHERE id = ?", valores)
            conn.commit()
            
            usuario = session.get("usuario")
            detalles = ", ".join([f"{k}: {v}" for k, v in data.items()])
            agregar_log(usuario["id"], usuario["nombre"], "Editar libro", "libros", libro_id, f"Editó '{titulo_anterior}': {detalles}")
        
        conn.close()
        return jsonify({"mensaje": "Libro actualizado"})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": "Error al actualizar libro"}), 500

@app.route("/api/libros/<int:libro_id>", methods=["DELETE"])
@bibliotecario_required
def eliminar_libro(libro_id):
    try:
        conn = get_db()
        c = conn.cursor()
        c.execute("SELECT titulo FROM libros WHERE id = ?", (libro_id,))
        libro = c.fetchone()
        titulo = libro["titulo"] if libro else "Desconocido"
        
        c.execute("DELETE FROM libros WHERE id = ?", (libro_id,))
        conn.commit()
        conn.close()
        
        usuario = session.get("usuario")
        agregar_log(usuario["id"], usuario["nombre"], "Eliminar libro", "libros", libro_id, f"Eliminó el libro '{titulo}'")
        
        return jsonify({"mensaje": "Libro eliminado"})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": "Error al eliminar libro"}), 500

# --- RESERVAS ---

@app.route("/api/reservas", methods=["POST"])
@login_required
def crear_reserva():
    try:
        data = request.json or {}
        nombre = data.get("nombre", "")
        email = data.get("email", "")
        libro_id = data.get("libro_id")
        usuario_id = session["usuario"]["id"]
        
        if not nombre or not email:
            return jsonify({"error": "Nombre y email son obligatorios"}), 400
        
        conn = get_db()
        c = conn.cursor()
        c.execute("INSERT INTO reservas (usuario_id, nombre, email, libro_id, estado) VALUES (?, ?, ?, ?, 'pendiente')", 
                  (usuario_id, nombre, email, libro_id))
        reserva_id = c.lastrowid
        conn.commit()
        
        usuario = session.get("usuario")
        agregar_log(usuario["id"], usuario["nombre"], "Crear reserva", "reservas", reserva_id, f"Reservó libro_id={libro_id}")
        
        conn.close()
        return jsonify({"mensaje": "Reserva creada correctamente", "id": reserva_id})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": "Error al crear reserva"}), 500

@app.route("/api/reservas")
@login_required
def listar_reservas():
    conn = get_db()
    c = conn.cursor()
    usuario = session.get("usuario")
    
    if usuario["rol"] in ["bibliotecario", "admin"]:
        c.execute("""SELECT r.*, l.titulo as libro_titulo, l.cantidad as libro_cantidad, u.nombre as usuario_nombre
        FROM reservas r
        LEFT JOIN libros l ON r.libro_id = l.id
        LEFT JOIN usuarios u ON r.usuario_id = u.id
        ORDER BY r.fecha_reserva DESC""")
    else:
        c.execute("""SELECT r.*, l.titulo as libro_titulo, l.cantidad as libro_cantidad
        FROM reservas r
        LEFT JOIN libros l ON r.libro_id = l.id
        WHERE r.usuario_id = ?
        ORDER BY r.fecha_reserva DESC""", (usuario["id"],))
    
    reservas = [dict(row) for row in c.fetchall()]
    conn.close()
    return jsonify(reservas)

@app.route("/api/reservas/<int:reserva_id>/estado", methods=["PUT"])
@bibliotecario_required
def actualizar_estado_reserva(reserva_id):
    try:
        data = request.json or {}
        nuevo_estado = data.get("estado", "")
        
        if nuevo_estado not in ["pendiente", "prestado", "devuelto", "cancelada"]:
            return jsonify({"error": "Estado no válido"}), 400
        
        conn = get_db()
        c = conn.cursor()
        
        c.execute("SELECT * FROM reservas WHERE id = ?", (reserva_id,))
        reserva = c.fetchone()
        estado_anterior = reserva["estado"] if reserva else "desconocido"
        
        c.execute("UPDATE reservas SET estado = ? WHERE id = ?", (nuevo_estado, reserva_id))
        conn.commit()
        
        usuario = session.get("usuario")
        agregar_log(usuario["id"], usuario["nombre"], "Actualizar reserva", "reservas", reserva_id, f"Cambió estado de '{estado_anterior}' a '{nuevo_estado}'")
        
        conn.close()
        return jsonify({"mensaje": "Estado actualizado"})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": "Error al actualizar estado"}), 500

# --- MÉTRICAS ---

@app.route("/api/metricas")
@bibliotecario_required
def metricas():
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT COUNT(*) as total_consultas FROM metricas")
    total = c.fetchone()["total_consultas"]
    c.execute("SELECT AVG(resultados) as avg_res FROM metricas")
    avg = c.fetchone()["avg_res"] or 0
    c.execute("SELECT consulta, resultados, timestamp FROM metricas ORDER BY timestamp DESC LIMIT 10")
    recientes = [dict(row) for row in c.fetchall()]
    c.execute("SELECT COUNT(*) as total FROM libros")
    total_libros = c.fetchone()["total"]
    c.execute("SELECT COUNT(*) as disp FROM libros WHERE disponible = 1")
    disponibles = c.fetchone()["disp"]
    c.execute("SELECT COUNT(*) as pend FROM reservas WHERE estado = 'pendiente'")
    pendientes = c.fetchone()["pend"]
    c.execute("SELECT COUNT(*) as alumnos FROM usuarios WHERE rol = 'alumno'")
    total_alumnos = c.fetchone()["alumnos"]
    conn.close()
    return jsonify({
        "total_consultas": total,
        "promedio_resultados": round(avg, 2),
        "consultas_recientes": recientes,
        "total_libros": total_libros,
        "disponibles": disponibles,
        "reservas_pendientes": pendientes,
        "total_alumnos": total_alumnos
    })

# --- LOGS (SOLO ADMIN) ---

@app.route("/api/logs")
@admin_required
def listar_logs():
    try:
        conn = get_db()
        c = conn.cursor()
        c.execute("SELECT * FROM logs ORDER BY timestamp DESC LIMIT 100")
        logs = [dict(row) for row in c.fetchall()]
        conn.close()
        return jsonify(logs)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": "Error al obtener logs"}), 500

# --- RUTAS DE VISTAS ---

@app.route("/dashboard")
@bibliotecario_required
def dashboard():
    return render_template("dashboard.html")

@app.route("/registro")
@bibliotecario_required
def registro():
    return render_template("registro.html")

@app.route("/libros")
@bibliotecario_required
def libros():
    return render_template("libros.html")

@app.route("/logs")
@admin_required
def logs_view():
    return render_template("logs.html")

@app.route("/mis-libros")
@login_required
def mis_libros():
    return render_template("mis_libros.html")

@app.route("/checkin")
def checkin():
    return render_template("checkin.html")

@app.route("/api/session")
def get_session():
    if "usuario" in session:
        return jsonify({
            "logged_in": True,
            "usuario": session["usuario"],
            "es_biblio": session["usuario"]["rol"] == "bibliotecario",
            "es_admin": session["usuario"]["rol"] == "admin"
        })
    return jsonify({"logged_in": False})

if __name__ == "__main__":
    print("🚀 Iniciando Biblioteca IA en http://localhost:5000")
    print("📝 Bibliotecario: biblio / biblio123")
    print("👑 Admin: admin / admin123")
    app.run(debug=True, host="0.0.0.0", port=5000)