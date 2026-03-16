from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from .repositories import UserRepository
from .exceptions import EmailAlreadyRegistered, InvalidCredentials

class AuthService:
    def __init__(self, repo: UserRepository, jwt_adapter):
        self.repo = repo
        self.jwt = jwt_adapter

    def register(self, email: str, password: str):
        if self.repo.get_by_email(email):
            raise EmailAlreadyRegistered("El correo ya está registrado.")
        user = self.repo.create_user(email, password)
        return {"id": user.id, "email": user.email}

    def login(self, email: str, password: str):
        # Intentar buscar por email primero si no es el username
        try:
            target_user = User.objects.get(email=email)
            username = target_user.username
        except User.DoesNotExist:
            username = email

        user = authenticate(username=username, password=password)
        if not user:
            raise InvalidCredentials("Credenciales inválidas")
        
        access, refresh = self.jwt.issue_tokens_for(user)
        return {"access": access, "refresh": refresh,
                "user": {"id": user.id, "email": user.email, "is_admin": user.is_staff}}
