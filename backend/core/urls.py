from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenRefreshView, TokenVerifyView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("inventory.urls")),
    path("api/", include("users.urls")),  # /api/auth/login, /api/auth/register, /api/auth/me
    path("api/auth/refresh", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/auth/verify", TokenVerifyView.as_view(), name="token_verify"),
]
