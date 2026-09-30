from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.deps import Pagination, get_current_user
from app.models import Notification, Review, User
from app.models.enums import Role
from app.schemas import NotificationOut, Page, ReviewOut, UserOut, UserPublic, UserUpdate
from app.services.careers import career_matches
from app.services.common import get_or_404
from app.services.matching import normalize

router = APIRouter(prefix="/users", tags=["Usuarios"])


@router.patch("/me", response_model=UserOut)
def update_me(data: UserUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(user, k, v)
    db.commit()
    db.refresh(user)
    return user


@router.get("", response_model=Page[UserPublic])
def search_talent(
    q: str | None = Query(None, description="Nombre, carrera o habilidad"),
    role: Role | None = None,
    career: str | None = None,
    organization_id: int | None = None,
    pag: Pagination = Depends(),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Directorio de talento: estudiantes y académicos por carrera y habilidades.

    La carrera se compara con el catálogo ("Contaduría" encuentra "Contador Público") y el texto
    libre no distingue acentos ni mayúsculas ("lopez" encuentra "López").
    """
    stmt = select(User).where(User.is_active.is_(True), User.role != Role.ADMIN)
    if role:
        stmt = stmt.where(User.role == role)
    if organization_id:
        stmt = stmt.where(User.organization_id == organization_id)
    users = list(db.scalars(stmt.order_by(User.rating_avg.desc(), User.id)))
    if career:
        users = [u for u in users if career_matches(u.career, [career])]
    if q:
        words = normalize(q).split()
        def texto(u: User) -> str:
            return normalize(" ".join([u.full_name, u.career or "", *(u.skills or [])]))
        users = [u for u in users if all(w in texto(u) for w in words)]
    return pag.apply_list(users)


@router.get("/me/notifications", response_model=Page[NotificationOut])
def my_notifications(unread_only: bool = False, pag: Pagination = Depends(),
                     user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    stmt = select(Notification).where(Notification.user_id == user.id)
    if unread_only:
        stmt = stmt.where(Notification.read.is_(False))
    return pag.apply(db, stmt.order_by(Notification.created_at.desc()))


@router.post("/me/notifications/{notification_id}/read", status_code=204)
def read_one(notification_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Marca como leída una notificación propia (al abrirla desde la app)."""
    n = db.get(Notification, notification_id)
    if n and n.user_id == user.id and not n.read:
        n.read = True
        db.commit()


@router.post("/me/notifications/read-all", status_code=204)
def read_all(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    for n in db.scalars(select(Notification).where(Notification.user_id == user.id, Notification.read.is_(False))):
        n.read = True
    db.commit()


@router.get("/{user_id}", response_model=UserPublic)
def get_user(user_id: int, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return get_or_404(db, User, user_id, "Usuario")


@router.get("/{user_id}/reviews", response_model=list[ReviewOut])
def user_reviews(user_id: int, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Portafolio verificable: evaluaciones recibidas en problemáticas reales."""
    get_or_404(db, User, user_id, "Usuario")
    return db.scalars(select(Review).where(Review.reviewee_id == user_id)
                      .order_by(Review.created_at.desc())).all()
