# backend/users/tests/test_auth.py
from django.test import TestCase
from django.urls import reverse, NoReverseMatch
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

User = get_user_model()

def url_for(name: str, fallback_path: str) -> str:
    """
    Intenta resolver 'users:<name>' y luego '<name>'.
    Si no existe ninguno, usa el path absoluto dado como fallback.
    """
    try:
        return reverse(f"users:{name}")
    except NoReverseMatch:
        try:
            return reverse(name)
        except NoReverseMatch:
            return fallback_path

class AuthApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        # Ajusta estos fallbacks si tu prefijo no es /api/auth/
        self.register_url = url_for("register", "/api/auth/register")
        self.login_url    = url_for("login",    "/api/auth/login")

    def test_register_success(self):
        r = self.client.post(
            self.register_url,
            {"email": "nuevo@demo.test", "password": "Fuerte123!"},
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.data if hasattr(r, "data") else r.content)
        self.assertTrue(User.objects.filter(username="nuevo@demo.test").exists())

    def test_register_duplicate_email(self):
        User.objects.create_user(username="dup@demo.test", email="dup@demo.test", password="X1x2x3x4!")
        r = self.client.post(
            self.register_url,
            {"email": "dup@demo.test", "password": "OtraFuerte1!"},
            format="json",
        )
        self.assertEqual(r.status_code, 400, r.data if hasattr(r, "data") else r.content)
        data_str = str(getattr(r, "data", r.content)).lower()
        # Acepta 'email' o 'detail' como fuente del mensaje de error
        self.assertTrue(("email" in getattr(r, "data", {})) or ("detail" in getattr(r, "data", {})))
        self.assertIn("registrad", data_str)  # "registrado/registrada"

    def test_register_weak_password(self):
        r = self.client.post(
            self.register_url,
            {"email": "weak@demo.test", "password": "12345678"},
            format="json",
        )
        self.assertEqual(r.status_code, 400, r.data if hasattr(r, "data") else r.content)
        self.assertTrue(("password" in getattr(r, "data", {})) or ("detail" in getattr(r, "data", {})))

    def test_login_success(self):
        User.objects.create_user(username="ok@demo.test", email="ok@demo.test", password="Demo1234!")
        r = self.client.post(
            self.login_url,
            {"email": "ok@demo.test", "password": "Demo1234!"},
            format="json",
        )
        self.assertEqual(r.status_code, 200, r.data if hasattr(r, "data") else r.content)
        self.assertIn("access", r.data)
        self.assertIn("refresh", r.data)

    def test_login_invalid(self):
        r = self.client.post(
            self.login_url,
            {"email": "no@existe.test", "password": "X"},
            format="json",
        )
        self.assertEqual(r.status_code, 401, r.data if hasattr(r, "data") else r.content)
        self.assertIn("detail", r.data)
