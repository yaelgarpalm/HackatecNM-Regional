"""Catálogo de carreras y comparación carrera ↔ carreras requeridas.

La carrera del estudiante y las que pide una problemática se escriben de muchas
formas ("Ing. Informática", "informático", "Informática"). Aquí se reducen a las
carreras del catálogo para decidir si coinciden.
"""
import re
import unicodedata

# Carreras del catálogo: todas las del TecNM y las licenciaturas más comunes del país
CARRERAS: list[str] = sorted([
    # --- Ingenierías (TecNM y otras universidades)
    "Ingeniería Aeronáutica",
    "Ingeniería Agroindustrial",
    "Ingeniería Ambiental",
    "Ingeniería Biomédica",
    "Ingeniería Bioquímica",
    "Ingeniería Civil",
    "Ingeniería Eléctrica",
    "Ingeniería Electromecánica",
    "Ingeniería Electrónica",
    "Ingeniería en Acuicultura",
    "Ingeniería en Administración",
    "Ingeniería en Agronomía",
    "Ingeniería en Alimentos",
    "Ingeniería en Animación Digital y Efectos Visuales",
    "Ingeniería en Biotecnología",
    "Ingeniería en Ciberseguridad",
    "Ingeniería en Ciencia de Datos",
    "Ingeniería en Computación",
    "Ingeniería en Desarrollo Comunitario",
    "Ingeniería en Desarrollo de Aplicaciones",
    "Ingeniería en Diseño Industrial",
    "Ingeniería en Energías Renovables",
    "Ingeniería en Geociencias",
    "Ingeniería en Gestión Empresarial",
    "Ingeniería en Industrias Alimentarias",
    "Ingeniería en Innovación Agrícola Sustentable",
    "Ingeniería en Inteligencia Artificial",
    "Ingeniería en Logística",
    "Ingeniería en Materiales",
    "Ingeniería en Nanotecnología",
    "Ingeniería en Pesquerías",
    "Ingeniería en Robótica",
    "Ingeniería en Semiconductores",
    "Ingeniería en Sistemas Automotrices",
    "Ingeniería en Sistemas Computacionales",
    "Ingeniería en Software",
    "Ingeniería en Tecnologías de la Información y Comunicaciones",
    "Ingeniería en Telecomunicaciones",
    "Ingeniería Ferroviaria",
    "Ingeniería Forestal",
    "Ingeniería Hidrológica",
    "Ingeniería Industrial",
    "Ingeniería Informática",
    "Ingeniería Mecánica",
    "Ingeniería Mecatrónica",
    "Ingeniería Minera",
    "Ingeniería Naval",
    "Ingeniería Petrolera",
    "Ingeniería Química",
    "Ingeniería Textil",
    "Ingeniería Topográfica",
    # --- Licenciaturas
    "Arquitectura",
    "Licenciatura en Actuaría",
    "Licenciatura en Administración",
    "Licenciatura en Administración Pública",
    "Licenciatura en Antropología",
    "Licenciatura en Artes Visuales",
    "Licenciatura en Biología",
    "Licenciatura en Ciencias de la Educación",
    "Licenciatura en Ciencias Políticas",
    "Licenciatura en Comercio Internacional",
    "Licenciatura en Comunicación",
    "Licenciatura en Contaduría",
    "Licenciatura en Criminología",
    "Licenciatura en Cultura Física y Deporte",
    "Licenciatura en Derecho",
    "Licenciatura en Diseño de Modas",
    "Licenciatura en Diseño Gráfico",
    "Licenciatura en Economía",
    "Licenciatura en Educación Preescolar",
    "Licenciatura en Educación Primaria",
    "Licenciatura en Enfermería",
    "Licenciatura en Enseñanza de Idiomas",
    "Licenciatura en Finanzas",
    "Licenciatura en Física",
    "Licenciatura en Fisioterapia",
    "Licenciatura en Gastronomía",
    "Licenciatura en Geografía",
    "Licenciatura en Historia",
    "Licenciatura en Hotelería",
    "Licenciatura en Letras",
    "Licenciatura en Matemáticas",
    "Licenciatura en Mercadotecnia",
    "Licenciatura en Música",
    "Licenciatura en Negocios Internacionales",
    "Licenciatura en Nutrición",
    "Licenciatura en Pedagogía",
    "Licenciatura en Periodismo",
    "Licenciatura en Psicología",
    "Licenciatura en Química",
    "Licenciatura en Recursos Humanos",
    "Licenciatura en Relaciones Internacionales",
    "Licenciatura en Sociología",
    "Licenciatura en Trabajo Social",
    "Licenciatura en Turismo",
    "Médico Cirujano",
    "Cirujano Dentista",
    "Médico Veterinario Zootecnista",
    "Químico Farmacéutico Biólogo",
], key=lambda c: c.lower())

# Otras formas de nombrar una carrera (profesión, siglas, nombres antiguos)
_ALIAS: dict[str, list[str]] = {
    "Ingeniería Informática": ["informatico", "informatica"],
    "Ingeniería en Sistemas Computacionales": ["isc", "sistemas computacionales", "sistemas"],
    "Ingeniería en Computación": ["computacion", "ciencias de la computacion", "ciencias computacionales"],
    "Ingeniería en Tecnologías de la Información y Comunicaciones": [
        "tic", "tics", "tecnologias de la informacion"],
    "Ingeniería en Agronomía": ["agronomo", "agronoma", "agronomia", "ingeniero agronomo"],
    "Ingeniería en Innovación Agrícola Sustentable": ["innovacion agricola", "agricola"],
    "Licenciatura en Contaduría": ["contador", "contadora", "contador publico", "contadora publica",
                                   "contaduria publica", "contabilidad", "contable"],
    "Licenciatura en Administración": ["administrador", "administradora", "administracion de empresas"],
    "Licenciatura en Pedagogía": ["pedagogo", "pedagoga"],
    "Licenciatura en Psicología": ["psicologo", "psicologa"],
    "Licenciatura en Derecho": ["abogado", "abogada", "licenciado en derecho"],
    "Licenciatura en Enfermería": ["enfermero", "enfermera"],
    "Licenciatura en Economía": ["economista"],
    "Licenciatura en Diseño Gráfico": ["disenador grafico", "disenadora grafica"],
    "Licenciatura en Mercadotecnia": ["marketing", "mercadologo"],
    "Licenciatura en Nutrición": ["nutriologo", "nutriologa"],
    "Licenciatura en Actuaría": ["actuario", "actuaria"],
    "Arquitectura": ["arquitecto", "arquitecta"],
    "Médico Cirujano": ["medicina", "medico"],
    "Cirujano Dentista": ["odontologia", "odontologo", "dentista", "estomatologia"],
    "Médico Veterinario Zootecnista": ["veterinaria", "veterinario", "zootecnia", "mvz"],
    "Químico Farmacéutico Biólogo": ["qfb", "quimico farmaceutico"],
    "Ingeniería Mecatrónica": ["mecatronico"],
    "Ingeniería Mecánica": ["mecanico"],
    "Ingeniería Electrónica": ["electronico"],
    "Ingeniería Eléctrica": ["electricista"],
    "Ingeniería Química": ["quimico"],
}

# Abreviaturas y formas personales que se reducen al nombre de la carrera
_ABREV = {
    "ing": "ingenieria", "ingeniero": "ingenieria", "ingeniera": "ingenieria",
    "lic": "licenciatura", "licenciado": "licenciatura", "licenciada": "licenciatura",
}
_GENERICAS = {"ingenieria", "licenciatura", "tecnico", "superior", "carrera",
              "en", "de", "la", "el", "y", "del", "e", "las", "los"}


def _norm(text: str) -> str:
    text = unicodedata.normalize("NFKD", text.lower())
    text = "".join(c for c in text if not unicodedata.combining(c))
    return " ".join(_ABREV.get(w, w) for w in re.findall(r"[a-z0-9]+", text))


def _short(name: str) -> str:
    """'ingenieria en sistemas computacionales' -> 'sistemas computacionales'."""
    return re.sub(r"^(ingenieria|licenciatura)( en)? ", "", _norm(name))


def _significant(text: str) -> set[str]:
    """Palabras que sí identifican la carrera (sin 'ingeniería', 'licenciatura', plurales…)."""
    return {w.rstrip("s") if len(w) > 4 else w for w in _norm(text).split() if w not in _GENERICAS}


_FORMAS: dict[str, set[str]] = {}
for _c in CARRERAS:
    for _f in {_norm(_c), _short(_c), *(_norm(a) for a in _ALIAS.get(_c, []))}:
        _FORMAS.setdefault(_f, set()).add(_c)


def career_keys(text: str | None) -> set[str]:
    """Carreras del catálogo a las que se refiere el texto (la coincidencia más larga gana).

    'Ing. en Sistemas Computacionales' -> {'Ingeniería en Sistemas Computacionales'}
    'Administración' -> {'Ingeniería en Administración', 'Licenciatura en Administración'}
    """
    if not text:
        return set()
    padded = f" {_norm(text)} "
    found = [(len(f), keys) for f, keys in _FORMAS.items() if f" {f} " in padded]
    if not found:
        return set()
    longest = max(n for n, _ in found)
    return set().union(*(keys for n, keys in found if n == longest))


def canonical_career(text: str | None) -> str | None:
    """Nombre oficial del catálogo si el texto se refiere a una sola carrera; si no, None."""
    keys = career_keys(text)
    return next(iter(keys)) if len(keys) == 1 else None


def career_matches(career: str | None, disciplines: list[str]) -> str | None:
    """Devuelve la carrera requerida que coincide con la del estudiante, o None."""
    if not career:
        return None
    ck = career_keys(career)
    cw = _significant(career)
    for d in disciplines:
        dk = career_keys(d)
        if ck and dk:
            if ck & dk:
                return d
            continue
        # Alguna de las dos no está en el catálogo: todas las palabras clave de la requerida
        # deben aparecer en la carrera ("Minería" ~ "Ingeniería en Minería")
        dw = _significant(d)
        if dw and dw <= cw:
            return d
    return None
