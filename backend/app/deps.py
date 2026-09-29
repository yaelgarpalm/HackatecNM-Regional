"""Dependencias reutilizables: usuario autenticado, control de roles y paginación."""
from collections.abc import Callable

from fastapi import Depends, HTTPException, Query, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import decode_token
from app.models import User
from app.models.enums import Role

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_PREFIX}/auth/token")
optional_oauth2 = OAuth2PasswordBearer(tokenUrl=f"{settings.API_PREFIX}/auth/token", auto_error=False)


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    user_id = decode_token(token, "access")
    user = db.get(User, user_id) if user_id else None
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas o sesión expirada",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def get_optional_user(token: str | None = Depends(optional_oauth2), db: Session = Depends(get_db)) -> User | None:
    """Para endpoints públicos que muestran más datos si hay sesión."""
    if not token:
        return None
    user_id = decode_token(token, "access")
    user = db.get(User, user_id) if user_id else None
    return user if user and user.is_active else None


def require_roles(*roles: Role) -> Callable[[User], User]:
    """Permite el acceso solo a los roles indicados (el admin siempre pasa)."""
    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role != Role.ADMIN and user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "No tienes permisos para esta acción")
        return user
    return checker


class Pagination:
    def __init__(self, page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
        self.page = page
        self.size = size

    def apply_list(self, items: list, mapper: Callable = lambda x: x) -> dict:
        """Como apply(), para resultados que se filtran en Python antes de paginar."""
        total = len(items)
        page = items[(self.page - 1) * self.size: self.page * self.size]
        return {
            "items": [mapper(r) for r in page],
            "total": total,
            "page": self.page,
            "size": self.size,
            "pages": (total + self.size - 1) // self.size,
        }

    def apply(self, db: Session, stmt, mapper: Callable = lambda x: x) -> dict:
        total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
        rows = db.scalars(stmt.offset((self.page - 1) * self.size).limit(self.size)).all()
        return {
            "items": [mapper(r) for r in rows],
            "total": total,
            "page": self.page,
            "size": self.size,
            "pages": (total + self.size - 1) // self.size,
        }
