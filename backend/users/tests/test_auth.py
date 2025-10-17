from django.test import TestCase
from django.urls import reverse
from django.contrib.auth.models import User
from rest_framework.test import APIClient

class AuthApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_register_success(self):
        url = reverse("register")
        r = self.client.post(url, {"email": "nuevo@demo.test", "password": "Fuerte123!"}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertTrue(User.objects.filter(username="nuevo@demo.test").exists())

    def test_register_duplicate_email(self):
        User.objects.create_user(username="dup@demo.test", email="dup@demo.test", password="X1x2x3x4!")
        url = reverse("register")
        r = self.client.post(url, {"email": "dup@demo.test", "password": "OtraFuerte1!"}, format="json")
        self.assertEqual(r.status_code, 400)
        data_str = str(r.data).lower()
        self.assertTrue(("email" in r.data) or ("detail" in r.data))
        self.assertIn("registrad", data_str)

    def test_register_weak_password(self):
        url = reverse("register")
        r = self.client.post(url, {"email": "weak@demo.test", "password": "12345678"}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertTrue(("password" in r.data) or ("detail" in r.data))

    def test_login_success(self):
        User.objects.create_user(username="ok@demo.test", email="ok@demo.test", password="Demo1234!")
        url = reverse("login")
        r = self.client.post(url, {"email": "ok@demo.test", "password": "Demo1234!"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertIn("access", r.data)
        self.assertIn("refresh", r.data)

    def test_login_invalid(self):
        url = reverse("login")
        r = self.client.post(url, {"email": "no@existe.test", "password": "X"}, format="json")
        self.assertEqual(r.status_code, 401)
        self.assertIn("detail", r.data)
