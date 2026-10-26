from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.courses.models import Course, Enrollment
from apps.products.models import Product
from apps.stores.models import Store
from apps.users.models import User


class CourseAccessDurationTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email='course-owner@example.test',
            username='course-owner',
            password='test-password',
        )
        store = Store.objects.create(
            owner=self.owner,
            name='Course store',
            description='Course test store',
            category='education',
            phone='840000000',
            email=self.owner.email,
            location='Maputo',
        )
        product = Product.objects.create(
            store=store,
            name='Course test',
            description='Course description',
            price='100.00',
            product_type='course',
        )
        self.course = Course.objects.create(
            product=product,
            instructor=self.owner,
            duration='1 hour',
            access_duration_days=14,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.owner)

    def test_seller_can_update_and_reload_access_duration(self):
        update_response = self.client.patch(
            f'/api/v1/courses/{self.course.id}/update/',
            {'access_duration_days': 45},
            format='json',
        )

        self.assertEqual(update_response.status_code, 200)
        self.course.refresh_from_db()
        self.assertEqual(self.course.access_duration_days, 45)

        products_response = self.client.get('/api/v1/products/my/?product_type=course')

        self.assertEqual(products_response.status_code, 200)
        course_product = next(
            item for item in products_response.data['results']
            if item['course']['course_id'] == str(self.course.id)
        )
        self.assertEqual(course_product['course']['access_duration_days'], 45)

    def test_updating_duration_restores_expired_enrollments_only(self):
        now = timezone.now()
        expired_enrollment = Enrollment.objects.create(
            user=self.owner,
            course=self.course,
            access_expires_at=now - timedelta(days=1),
        )
        active_student = User.objects.create_user(
            email='active-student@example.test',
            username='active-student',
            password='test-password',
        )
        active_expiration = now + timedelta(days=3)
        active_enrollment = Enrollment.objects.create(
            user=active_student,
            course=self.course,
            access_expires_at=active_expiration,
        )

        response = self.client.patch(
            f'/api/v1/courses/{self.course.id}/update/',
            {'access_duration_days': 45},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        expired_enrollment.refresh_from_db()
        active_enrollment.refresh_from_db()
        self.assertGreater(
            expired_enrollment.access_expires_at,
            now + timedelta(days=44),
        )
        self.assertEqual(active_enrollment.access_expires_at, active_expiration)

    def test_removing_duration_restores_expired_enrollment_as_lifetime(self):
        expired_enrollment = Enrollment.objects.create(
            user=self.owner,
            course=self.course,
            access_expires_at=timezone.now() - timedelta(days=1),
        )

        response = self.client.patch(
            f'/api/v1/courses/{self.course.id}/update/',
            {'access_duration_days': None},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        expired_enrollment.refresh_from_db()
        self.assertIsNone(expired_enrollment.access_expires_at)
