"""Catálogo de carreras y comparación carrera ↔ disciplina requerida.

La carrera del estudiante y las disciplinas que pide una problemática se escriben
de muchas formas ("Ing. Informática", "informático", "Informática"). Aquí se
reducen a una carrera canónica para decidir si coinciden.
"""
import re
import unicodedata

# Carrera canónica -> formas en que suele escribirse (sin acentos, minúsculas).
# El nombre canónico también cuenta como forma válida.
CARRERAS: dict[str, list[str]] = {
    "Informática": ["informatica", "informatico", "informatica administrativa"],
    "Sistemas Computacionales": ["sistemas computacionales", "sistemas computacional", "computacion",
                                 "ciencias computacionales", "ciencias de la computacion", "isc"],
    "Tecnologías de la Información y Comunicaciones": ["tecnologias de la informacion", "tic", "tics"],
    "Agronomía": ["agronomia", "agronomo", "agronoma", "agronomica", "agricola", "innovacion agricola",
                  "innovacion agricola sustentable", "agroindustrial"],
    "Contaduría": ["contaduria", "contaduria publica", "contador", "contadora", "contador publico",
                   "contadora publica", "contabilidad", "contable"],
    "Administración": ["administracion", "administrador", "administradora", "administracion de empresas"],
    "Gestión Empresarial": ["gestion empresarial"],
    "Industrial": ["industrial"],
    "Civil": ["civil"],
    "Arquitectura": ["arquitectura", "arquitecto", "arquitecta"],
    "Mecatrónica": ["mecatronica", "mecatronico"],
    "Mecánica": ["mecanica", "mecanico"],
    "Electrónica": ["electronica", "electronico"],
    "Eléctrica": ["electrica", "electricista"],
    "Química": ["quimica", "quimico"],
    "Bioquímica": ["bioquimica", "bioquimico"],
    "Biotecnología": ["biotecnologia"],
    "Ambiental": ["ambiental"],
    "Energías Renovables": ["energias renovables", "energia renovable"],
    "Industrias Alimentarias": ["industrias alimentarias", "alimentaria", "alimentos"],
    "Logística": ["logistica"],
    "Materiales": ["materiales"],
    "Diseño Gráfico": ["diseno grafico", "disenador grafico", "disenadora grafica"],
    "Mercadotecnia": ["mercadotecnia", "marketing"],
    "Turismo": ["turismo"],
    "Pedagogía": ["pedagogia", "pedagogo", "pedagoga"],
    "Psicología": ["psicologia", "psicologo", "psicologa"],
    "Derecho": ["derecho", "abogado", "abogada"],
    "Enfermería": ["enfermeria", "enfermero", "enfermera"],
    "Medicina": ["medicina", "medico"],
}

# Palabras que no distinguen una carrera de otra
_GENERICAS = {
    "ing", "ingenieria", "ingeniero", "ingeniera", "lic", "licenciatura", "licenciado", "licenciada",
    "tecnico", "tecnica", "superior", "universitario", "carrera", "en", "de", "la", "el", "y", "del", "e",
}


def _norm(text: str) -> str:
    text = unicodedata.normalize("NFKD", text.lower())
    text = "".join(c for c in text if not unicodedata.combining(c))
    return " ".join(re.findall(r"[a-z0-9]+", text))


def _significant(text: str) -> set[str]:
    """Palabras que sí identifican la carrera (sin 'ingeniería', 'licenciatura', plurales…)."""
    return {w.rstrip("s") if len(w) > 4 else w for w in _norm(text).split() if w not in _GENERICAS}


# Formas ordenadas de la más larga a la más corta: "tecnologias de la informacion" antes que "tic"
_FORMAS = sorted(
    ((_norm(f), key) for key, forms in CARRERAS.items() for f in [key, *forms]),
    key=lambda x: len(x[0]), reverse=True,
)


def canonical_career(text: str | None) -> str | None:
    """'Ing. en Sistemas Computacionales' -> 'Sistemas Computacionales'; None si no está en el catálogo."""
    if not text:
        return None
    padded = f" {_norm(text)} "
    for form, key in _FORMAS:
        if f" {form} " in padded:
            return key
    return None


def career_matches(career: str | None, disciplines: list[str]) -> str | None:
    """Devuelve la disciplina requerida que coincide con la carrera, o None."""
    if not career:
        return None
    ck = canonical_career(career)
    cw = _significant(career)
    for d in disciplines:
        dk = canonical_career(d)
        if ck and dk:
            if ck == dk:
                return d
            continue
        # Alguna de las dos no está en el catálogo: todas las palabras clave de la disciplina
        # deben aparecer en la carrera ("Minería" ~ "Ingeniería en Minería")
        dw = _significant(d)
        if dw and dw <= cw:
            return d
    return None
