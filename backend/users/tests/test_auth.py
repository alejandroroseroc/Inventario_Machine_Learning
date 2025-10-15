from django.test import TestCase
from django.urls import reverse
from django.contrib.auth.models import User
from rest_framework.test import APIClient

class AuthTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_register_success(self):
        url = reverse("register")
        data = {"email": "nuevo@demo.test", "password": "Fuerte123!"}
        r = self.client.post(url, data, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertTrue(User.objects.filter(username="nuevo@demo.test").exists())

    def test_register_duplicate_email(self):
        User.objects.create_user(username="dup@demo.test", email="dup@demo.test", password="X1x2x3x4!")
        url = reverse("register")
        r = self.client.post(url, {"email": "dup@demo.test", "password": "OtraFuerte1!"}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("El correo ya está registrado", str(r.data))

    def test_register_weak_password(self):
        url = reverse("register")
        r = self.client.post(url, {"email": "weak@demo.test", "password": "12345678"}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("password", r.data)
