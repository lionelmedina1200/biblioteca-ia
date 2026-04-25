import sqlite3
import os
from werkzeug.security import generate_password_hash, check_password_hash

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "biblioteca.db")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    c = conn.cursor()
    
    # Tabla de usuarios (Alumno, Bibliotecario, Admin)
    c.execute("""CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        nombre TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        rol TEXT DEFAULT 'alumno',
        activo INTEGER DEFAULT 1,
        fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )""")
    
    # Tabla de libros (AGREGADO campo CANTIDAD)
    c.execute("""CREATE TABLE IF NOT EXISTS libros (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        titulo TEXT NOT NULL,
        capitulo TEXT,
        editorial TEXT,
        autor TEXT NOT NULL,
        categoria TEXT NOT NULL,
        descripcion TEXT,
        isbn TEXT UNIQUE,
        cantidad INTEGER DEFAULT 1,
        disponible INTEGER DEFAULT 1,
        ubicacion TEXT,
        fecha_alta TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )""")
    
    # Tabla de reservas
    c.execute("""CREATE TABLE IF NOT EXISTS reservas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER,
        nombre TEXT NOT NULL,
        email TEXT NOT NULL,
        libro_id INTEGER,
        fecha_reserva TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        estado TEXT DEFAULT 'pendiente',
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
        FOREIGN KEY (libro_id) REFERENCES libros(id)
    )""")
    
    # Tabla de metricas
    c.execute("""CREATE TABLE IF NOT EXISTS metricas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        consulta TEXT,
        resultados INTEGER,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )""")
    
    # NUEVA: Tabla de LOGS para Admin
    c.execute("""CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER,
        usuario_nombre TEXT,
        accion TEXT NOT NULL,
        tabla_afectada TEXT,
        registro_id INTEGER,
        detalles TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )""")
    
    # --- CREACIÓN DE USUARIOS POR DEFECTO ---
    
    # Bibliotecario
    c.execute("SELECT COUNT(*) FROM usuarios WHERE rol = 'bibliotecario'")
    if c.fetchone()[0] == 0:
        hashed_pw = generate_password_hash("biblio123", method='pbkdf2:sha256')
        c.execute("""INSERT INTO usuarios (username, password, nombre, email, rol) 
                     VALUES (?, ?, ?, ?, ?)""",
                  ("biblio", hashed_pw, "Bibliotecaria", "biblio@biblioteca.com", "bibliotecario"))
    
    # ADMIN (NUEVO)
    c.execute("SELECT COUNT(*) FROM usuarios WHERE rol = 'admin'")
    if c.fetchone()[0] == 0:
        hashed_pw = generate_password_hash("admin123", method='pbkdf2:sha256')
        c.execute("""INSERT INTO usuarios (username, password, nombre, email, rol) 
                     VALUES (?, ?, ?, ?, ?)""",
                  ("admin", hashed_pw, "Administrador", "admin@biblioteca.com", "admin"))
                  
    conn.commit()
    conn.close()

def verificar_usuario(username, password):
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT * FROM usuarios WHERE username = ? AND activo = 1", (username,))
    usuario = c.fetchone()
    conn.close()
    if usuario and check_password_hash(usuario["password"], password):
        return dict(usuario)
    return None

def registrar_usuario(username, password, nombre, email, rol="alumno"):
    try:
        conn = get_db()
        c = conn.cursor()
        hashed_pw = generate_password_hash(password, method='pbkdf2:sha256')
        c.execute("""INSERT INTO usuarios (username, password, nombre, email, rol)
        VALUES (?, ?, ?, ?, ?)""",
        (username, hashed_pw, nombre, email, rol))
        conn.commit()
        conn.close()
        return True
    except sqlite3.IntegrityError:
        return False

def agregar_log(usuario_id, usuario_nombre, accion, tabla_afectada, registro_id, detalles):
    """Función auxiliar para registrar logs"""
    try:
        conn = get_db()
        c = conn.cursor()
        c.execute("""INSERT INTO logs (usuario_id, usuario_nombre, accion, tabla_afectada, registro_id, detalles)
        VALUES (?, ?, ?, ?, ?, ?)""",
        (usuario_id, usuario_nombre, accion, tabla_afectada, registro_id, detalles))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Error al registrar log: {e}")

if __name__ == "__main__":
    init_db()
    print("✅ Base de datos inicializada correctamente.")
    print("📝 Bibliotecario: biblio / biblio123")
    print("👑 Admin: admin / admin123")