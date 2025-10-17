class DomainError(Exception):
    """Base para errores de dominio."""


class EmailAlreadyRegistered(DomainError):
    """El email ya está registrado."""


class InvalidCredentials(DomainError):
    """Credenciales inválidas."""
