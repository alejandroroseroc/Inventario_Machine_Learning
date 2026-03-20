from django.urls import path
from .views import RegisterView, LoginView, MeView, UserListView, UserDeleteView

urlpatterns = [
    path("auth/register", RegisterView.as_view(), name="auth-register"),
    path("auth/login",    LoginView.as_view(),    name="auth-login"),
    path("auth/me",       MeView.as_view(),       name="auth-me"),
    path("auth/users",    UserListView.as_view(),  name="auth-users"),
    path("auth/users/<int:pk>", UserDeleteView.as_view(), name="auth-user-delete"),
]
