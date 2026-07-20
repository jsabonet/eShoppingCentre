import pytest
from django.contrib.auth import get_user_model

User = get_user_model()


@pytest.mark.django_db
def test_create_user():
    user = User.objects.create_user(
        email='teste@email.com',
        username='teste',
        password='SenhaForte123!',
    )
    assert user.email == 'teste@email.com'
    assert user.check_password('SenhaForte123!')


@pytest.mark.django_db
def test_create_superuser():
    user = User.objects.create_superuser(
        email='admin@email.com',
        username='admin',
        password='Admin123!',
    )
    assert user.is_superuser
    assert user.is_staff
