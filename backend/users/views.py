from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from .serializers import RegisterSerializer, LoginSerializer
from .repositories import UserRepository
from .services import AuthService
from .adapters import JwtAdapter
from .exceptions import EmailAlreadyRegistered, InvalidCredentials

def make_auth_service():
    return AuthService(UserRepository(), JwtAdapter())

class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        s = RegisterSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        svc = make_auth_service()
        try:
            user = svc.register(s.validated_data["email"], s.validated_data["password"])
        except EmailAlreadyRegistered as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"message": "Usuario creado correctamente", "user": user},
                        status=status.HTTP_201_CREATED)

class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        s = LoginSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        svc = make_auth_service()
        try:
            data = svc.login(s.validated_data["email"], s.validated_data["password"])
        except InvalidCredentials as e:
            return Response({"detail": str(e)}, status=status.HTTP_401_UNAUTHORIZED)
        return Response(data)

class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        u = request.user
        return Response({"id": u.id, "email": u.email})


class UserListView(APIView):
    permission_classes = [permissions.IsAuthenticated, permissions.IsAdminUser]
    def get(self, request):
        from django.contrib.auth.models import User
        users = User.objects.filter(is_staff=False).values("id", "username", "email")
        return Response(list(users))

class UserDeleteView(APIView):
    permission_classes = [permissions.IsAuthenticated, permissions.IsAdminUser]
    def delete(self, request, pk):
        from django.contrib.auth.models import User
        try:
            user = User.objects.get(id=pk, is_staff=False)
            user.delete()
            return Response({"message": "Usuario eliminado correctamente"}, status=status.HTTP_200_OK)
        except User.DoesNotExist:
            return Response({"detail": "Usuario no encontrado."}, status=status.HTTP_404_NOT_FOUND)
