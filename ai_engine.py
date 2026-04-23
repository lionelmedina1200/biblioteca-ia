import os
import requests
import difflib
from database import get_db

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent"

def obtener_categorias():
    """Obtiene todas las categorías únicas de la base de datos"""
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT DISTINCT categoria FROM libros WHERE categoria IS NOT NULL AND categoria != '' ORDER BY categoria")
    cats = [row[0] for row in c.fetchall()]
    conn.close()
    return cats

def buscar_por_categoria_exacta(categoria_buscada):
    """Busca SOLO libros de la categoría específica"""
    conn = get_db()
    conn.row_factory = lambda c, r: dict(zip([col[0] for col in c.description], r))
    cur = conn.cursor()
    
    cur.execute("""
        SELECT * FROM libros 
        WHERE LOWER(categoria) = LOWER(?)
        ORDER BY titulo
    """, (categoria_buscada,))
    
    results = [dict(row) for row in cur.fetchall()]
    conn.close()
    return results

def buscar_libros_general(consulta):
    """Búsqueda general por título, autor, etc."""
    conn = get_db()
    conn.row_factory = lambda c, r: dict(zip([col[0] for col in c.description], r))
    cur = conn.cursor()
    q = consulta.lower().strip()
    
    cur.execute("""
        SELECT * FROM libros 
        WHERE LOWER(titulo) LIKE ? OR LOWER(autor) LIKE ? OR LOWER(categoria) LIKE ? OR LOWER(editorial) LIKE ?
        ORDER BY categoria, titulo
    """, (f"%{q}%", f"%{q}%", f"%{q}%", f"%{q}%"))
    
    resultados = [dict(row) for row in cur.fetchall()]
    conn.close()
    return resultados

def formatear_libro_simple(libro):
    """Formatea un solo libro en el formato limpio solicitado"""
    disponible = "Sí" if libro.get("disponible", 0) == 1 else "No"
    
    formato = f"""Nombre: {libro.get('titulo', 'N/A')}
Capítulos: {libro.get('capitulo', 'N/A') or 'N/A'}
Editorial: {libro.get('editorial', 'N/A') or 'N/A'}
Autor: {libro.get('autor', 'N/A') or 'N/A'}
Disponible: {disponible}
Categoría: {libro.get('categoria', 'N/A') or 'N/A'}"""
    
    return formato

def formatear_lista_libros(libros):
    """Formatea una lista de libros de forma organizada"""
    if not libros:
        return "No se encontraron libros."
    
    resultado = ""
    
    for i, libro in enumerate(libros, 1):
        if i > 1:
            resultado += "\n\n"
        resultado += f"{i}. "
        resultado += formatear_libro_simple(libro)
    
    return resultado

def detectar_categoria_en_consulta(consulta):
    """Detecta si la consulta menciona una categoría específica"""
    consulta_lower = consulta.lower().strip()
    categorias = obtener_categorias()
    
    for cat in categorias:
        cat_lower = cat.lower()
        # Verificar si la categoría está en la consulta
        if cat_lower in consulta_lower or consulta_lower in cat_lower:
            return cat
        # Verificar similitud alta (para errores ortográficos)
        if difflib.SequenceMatcher(None, cat_lower, consulta_lower).ratio() > 0.7:
            return cat
    
    return None

def construir_prompt_sistema():
    """Construye el prompt del sistema para la IA"""
    return """Eres Chaca, una bibliotecaria amable y profesional del Colegio Chacabuco.

REGLAS:
1. Respondé SIEMPRE en español
2. Sé clara, organizada y profesional
3. NO uses emojis en las respuestas
4. Si te preguntan por una categoría ESPECÍFICA, mostrá SOLO libros de ESA categoría
5. NUNCA mezcles libros de diferentes categorías

FORMATO:
Para cada libro, usá EXACTAMENTE este formato:

Nombre: [título]
Capítulos: [capítulo]
Editorial: [editorial]
Autor: [autor]
Disponible: [Sí/No]
Categoría: [categoría]

Dejá una línea en blanco entre cada libro."""

def llamar_gemini(mensaje_usuario, contexto_libros=""):
    """Llama a la API de Gemini"""
    if not GEMINI_API_KEY:
        print("⚠️ WARNING: No hay GEMINI_API_KEY configurada")
        return None
    
    prompt_sistema = construir_prompt_sistema()
    
    if contexto_libros:
        prompt_completo = f"{prompt_sistema}\n\nCATÁLOGO DE LIBROS DISPONIBLES:\n{contexto_libros}\n\nPREGUNTA DEL USUARIO: {mensaje_usuario}"
    else:
        prompt_completo = f"{prompt_sistema}\n\nPREGUNTA DEL USUARIO: {mensaje_usuario}"
    
    payload = {
        "contents": [{"parts": [{"text": prompt_completo}]}],
        "generationConfig": {
            "temperature": 0.3,
            "maxOutputTokens": 2000
        }
    }
    
    headers = {"Content-Type": "application/json"}
    url = f"{GEMINI_API_URL}?key={GEMINI_API_KEY}"
    
    try:
        print(f"📡 Llamando a Gemini API (URL: {GEMINI_API_URL})...")
        response = requests.post(url, json=payload, headers=headers, timeout=15)
        response.raise_for_status()
        
        data = response.json()
        
        if "candidates" in data and len(data["candidates"]) > 0:
            respuesta = data["candidates"][0]["content"]["parts"][0]["text"].strip()
            print(f"✅ Respuesta de Gemini recibida")
            return respuesta
        else:
            print("❌ No hay candidates en la respuesta")
            return None
            
    except requests.exceptions.Timeout:
        print("❌ Timeout en la API de Gemini")
        return None
    except requests.exceptions.RequestException as e:
        print(f"❌ Error en la petición: {e}")
        return None
    except Exception as e:
        print(f"❌ Error procesando respuesta: {e}")
        return None

def procesar_consulta(consulta):
    """Función principal que procesa la consulta del usuario"""
    
    print(f"\n🔍 Consulta recibida: {consulta}")
    print(f"🔑 API Key configurada: {'Sí' if GEMINI_API_KEY else 'No'}")
    
    consulta_lower = consulta.lower().strip()
    
    # 1. Saludos - USAR GEMINI
    if any(s in consulta_lower for s in ["hola", "buenas", "hey", "hi"]):
        contexto = "El usuario te está saludando. Respondé de forma cordial y preguntá en qué libro podés ayudar."
        respuesta = llamar_gemini(consulta, contexto)
        if respuesta:
            return respuesta
        return "Hola! Soy ChacaBot, el asistente de la biblioteca. En qué libro te puedo ayudar hoy?"
    
    # 2. Consulta de categorías - USAR GEMINI
    if any(k in consulta_lower for k in ["categorias", "materias", "tipos de libros", "que tienen", "catalogo", "q tipos"]):
        cats = obtener_categorias()
        if cats:
            contexto_categorias = "Categorías disponibles:\n\n" + "\n".join(f"- {cat}" for cat in cats)
            respuesta = llamar_gemini(consulta, contexto_categorias)
            if respuesta:
                return respuesta
            return "Categorías disponibles:\n\n" + "\n".join(f"- {cat}" for cat in cats)
        return "No hay categorías cargadas."
    
    # 3. Búsqueda por categoría ESPECÍFICA - USAR GEMINI
    categoria_detectada = detectar_categoria_en_consulta(consulta)
    
    if categoria_detectada:
        print(f"📚 Categoría detectada: {categoria_detectada}")
        libros = buscar_por_categoria_exacta(categoria_detectada)
        
        if libros:
            print(f"✅ Encontrados {len(libros)} libros de {categoria_detectada}")
            contexto = formatear_lista_libros(libros)
            
            respuesta_gemini = llamar_gemini(consulta, contexto)
            
            if respuesta_gemini:
                return respuesta_gemini
            else:
                # Fallback si falla la IA: mostrar los datos crudos
                return f"Libros de {categoria_detectada}:\n\n{contexto}"
        else:
            return f"No hay libros cargados de la categoría '{categoria_detectada}'."
    
    # 4. Búsqueda general - USAR GEMINI
    if len(consulta_lower.split()) >= 2:
        libros = buscar_libros_general(consulta)
        
        if libros:
            print(f"✅ Búsqueda general: {len(libros)} libros encontrados")
            contexto = formatear_lista_libros(libros)
            
            respuesta_gemini = llamar_gemini(consulta, contexto)
            
            if respuesta_gemini:
                return respuesta_gemini
            else:
                return f"Libros encontrados:\n\n{contexto}"
        else:
            return "No encontré libros que coincidan con tu búsqueda. Probá con otro término o consultá las categorías disponibles."
    
    # 5. Consulta muy corta - USAR GEMINI
    contexto = "El usuario hizo una consulta corta. Respondé amablemente y preguntá en qué podés ayudar."
    respuesta = llamar_gemini(consulta, contexto)
    if respuesta:
        return respuesta
    return "Hola! Soy ChacaBot, el asistente de la biblioteca. Podés preguntarme por:\n- Una categoría específica (ej: 'libros de biología')\n- Un título o autor\n- Las categorías disponibles\n\nEn qué te ayudo?"

if __name__ == "__main__":
    print("=== TEST DE AI_ENGINE ===")
    print(f"API Key: {'Configurada' if GEMINI_API_KEY else 'NO CONFIGURADA'}")
    
    print("\n--- Test 1: Obtener categorías ---")
    cats = obtener_categorias()
    print(f"Categorías: {cats}")