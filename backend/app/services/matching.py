"""Motor de recomendación (matching) por afinidad de etiquetas y disciplinas.

Es deliberadamente simple y explicable: cada resultado trae una lista de
"razones" que la web/app puede mostrar al usuario. Más adelante puede
sustituirse por embeddings o un modelo de IA sin cambiar la API.
"""
import re
import unicodedata

from app.models import Capability, Challenge, User

_STOP = {"de", "la", "el", "y", "en", "para", "con", "los", "las", "del", "a", "un", "una", "por", "e"}


def normalize(text: str) -> str:
    text = unicodedata.normalize("NFKD", text.lower())
    return "".join(c for c in text if not unicodedata.combining(c)).strip()


def tokens(*texts: str | None) -> set[str]:
    out: set[str] = set()
    for t in texts:
        if t:
            out |= {w for w in re.findall(r"[a-z0-9+#.]+", normalize(t)) if len(w) > 1 and w not in _STOP}
    return out


def terms(items: list[str] | None) -> set[str]:
    return {normalize(i) for i in (items or []) if i}


def _discipline_hit(career: str | None, disciplines: list[str]) -> str | None:
    """Coincidencia flexible: 'Ing. en Sistemas Computacionales' ~ 'sistemas computacionales'."""
    if not career:
        return None
    c = tokens(career)
    for d in disciplines:
        dt = tokens(d)
        if dt and len(dt & c) >= max(1, len(dt) // 2):
            return d
    return None


def _skill_overlap(user: User, ch: Challenge) -> tuple[float, set[str]]:
    """Proporción de etiquetas del reto cubiertas por las habilidades del usuario."""
    user_terms = terms(user.skills) | tokens(" ".join(user.skills or []))
    ch_tags = terms(ch.tags)
    ch_terms = ch_tags | tokens(ch.title, ch.category, " ".join(ch.tags or []))
    common = user_terms & ch_terms
    if not common:
        return 0.0, set()
    return min(1.0, len(common) / max(len(ch_tags), 1)), common


def _pretty(user: User, common: set[str]) -> str:
    """Muestra las habilidades tal como el usuario las escribió (sin fragmentos repetidos)."""
    shown = [sk for sk in (user.skills or []) if normalize(sk) in common or tokens(sk) & common]
    return ", ".join(shown[:5]) or ", ".join(sorted(common)[:5])


def score_challenge_for_user(user: User, ch: Challenge) -> tuple[float, list[str]]:
    reasons: list[str] = []
    score = 0.0

    hit = _discipline_hit(user.career, ch.required_disciplines)
    if hit:
        score += 0.4
        reasons.append(f"Tu carrera coincide con la disciplina requerida: {hit}")

    ratio, common = _skill_overlap(user, ch)
    if common:
        score += 0.45 * ratio
        reasons.append("Habilidades afines: " + _pretty(user, common))

    if not reasons:  # sin afinidad real no se recomienda, aunque haya bonos
        return 0.0, []

    if ch.offers_stipend or (ch.budget_mxn or 0) > 0:
        score += 0.1
        reasons.append("Ofrece apoyo económico")
    if ch.modalities:
        score += 0.05
        reasons.append("Válido como " + ", ".join(m.replace("_", " ") for m in ch.modalities))

    return round(min(score, 1.0), 3), reasons


def score_user_for_challenge(user: User, ch: Challenge) -> tuple[float, list[str]]:
    """Talento sugerido para un reto (vista de la empresa)."""
    reasons: list[str] = []
    score = 0.0
    hit = _discipline_hit(user.career, ch.required_disciplines)
    if hit:
        score += 0.4
        reasons.append(f"Carrera afín: {hit}")
    ratio, common = _skill_overlap(user, ch)
    if common:
        score += 0.45 * ratio
        reasons.append("Habilidades: " + _pretty(user, common))
    if user.rating_count:
        score += 0.15 * (user.rating_avg / 5)
        reasons.append(f"Reputación {user.rating_avg:.1f}/5 ({user.rating_count} evaluaciones)")
    return round(min(score, 1.0), 3), reasons


def score_capability_for_challenge(cap: Capability, ch: Challenge) -> tuple[float, list[str]]:
    ch_terms = terms(ch.tags) | tokens(ch.title, ch.summary, ch.category)
    cap_terms = terms(cap.tags) | tokens(cap.name, cap.description)
    common = ch_terms & cap_terms
    if not common:
        return 0.0, []
    score = min(1.0, len(common) / max(len(terms(ch.tags)) or 3, 3))
    if not cap.available:
        score *= 0.5
    return round(score, 3), ["Coincide en: " + ", ".join(sorted(common)[:6])]


def discipline_coverage(members: list[User], required: list[str]) -> float:
    """Porcentaje de disciplinas requeridas cubiertas por el equipo."""
    if not required:
        return 1.0
    covered = {d for d in required for m in members if _discipline_hit(m.career, [d])}
    return round(len(covered) / len(required), 3)
