from django.contrib.auth.models import User
email = 'admin@admin.com'
password = 'admin1234'
if not User.objects.filter(username=email).exists():
    User.objects.create_superuser(username=email, email=email, password=password)
    print(f"Superusuario {email} creado con exito.")
else:
    user = User.objects.get(username=email)
    user.set_password(password)
    user.is_staff = True
    user.is_superuser = True
    user.save()
    print(f"Superusuario {email} actualizado con exito.")
