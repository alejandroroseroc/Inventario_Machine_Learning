from django.contrib.auth.models import User

class UserRepository:
    def get_by_email(self, email: str) -> User | None:
        return User.objects.filter(username=email).first()

    def create_user(self, email: str, password: str) -> User:
        user = User(username=email, email=email)
        user.set_password(password)
        user.save()
        return user
