from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from django.urls import reverse

from apps.products.models import Product
from apps.stores.models import Store
from apps.users.models import User
from .certificates import issue_course_certificate, refresh_enrollment_completion
from .models import (
    Course, CourseCertificateEvent, CourseModule, CourseLesson, Enrollment, LessonProgress, Quiz, QuizAttempt,
)


class CourseCertificateTests(TestCase):
    def setUp(self):
        self.instructor = User.objects.create_user(
            email='instructor@example.test',
            username='instructor',
            password='test-password',
        )
        self.student = User.objects.create_user(
            email='student@example.test',
            username='student',
            first_name='Ana',
            last_name='Mussa',
            password='test-password',
        )
        store = Store.objects.create(
            owner=self.instructor,
            name='Training store',
            description='Course test store',
            category='education',
            phone='840000000',
            email=self.instructor.email,
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
            instructor=self.instructor,
            duration='1 hour',
        )
        module = CourseModule.objects.create(course=self.course, title='Module 1')
        self.lesson = CourseLesson.objects.create(module=module, title='Lesson 1')
        self.quiz = Quiz.objects.create(
            module=module,
            title='Required quiz',
            is_required=True,
        )
        self.enrollment = Enrollment.objects.create(
            user=self.student,
            course=self.course,
        )

    def test_required_quiz_blocks_completion_and_certificate(self):
        LessonProgress.objects.create(
            enrollment=self.enrollment,
            lesson=self.lesson,
            completed=True,
        )

        self.assertFalse(refresh_enrollment_completion(self.enrollment))
        self.enrollment.refresh_from_db()
        self.assertFalse(self.enrollment.completed)

        certificate, error = issue_course_certificate(self.enrollment)

        self.assertIsNone(certificate)
        self.assertIn('quizzes obrigatórios', error)

    def test_passed_required_quiz_allows_single_certificate(self):
        LessonProgress.objects.create(
            enrollment=self.enrollment,
            lesson=self.lesson,
            completed=True,
        )
        QuizAttempt.objects.create(
            enrollment=self.enrollment,
            quiz=self.quiz,
            passed=True,
            completed_at=timezone.now(),
        )

        certificate, error = issue_course_certificate(self.enrollment)
        self.assertIsNone(error)
        self.assertEqual(certificate.recipient_name, 'Ana Mussa')
        self.assertEqual(certificate.course_title, 'Course test')

        repeated_certificate, repeated_error = issue_course_certificate(self.enrollment)

        self.assertIsNone(repeated_error)
        self.assertEqual(repeated_certificate.pk, certificate.pk)
        self.assertEqual(
            self.enrollment.certificate.certificate_number,
            certificate.certificate_number,
        )

    def test_student_can_issue_and_publicly_verify_certificate(self):
        LessonProgress.objects.create(
            enrollment=self.enrollment,
            lesson=self.lesson,
            completed=True,
        )
        QuizAttempt.objects.create(
            enrollment=self.enrollment,
            quiz=self.quiz,
            passed=True,
            completed_at=timezone.now(),
        )
        client = APIClient()
        client.force_authenticate(user=self.student)

        issue_response = client.post(
            reverse(
                'course_certificate_issue',
                kwargs={'enrollment_id': self.enrollment.id},
            )
        )

        self.assertEqual(issue_response.status_code, 200)
        certificate_number = issue_response.data['certificate_number']
        verify_response = client.get(
            reverse(
                'course_certificate_verify',
                kwargs={'certificate_number': certificate_number},
            )
        )

        self.assertEqual(verify_response.status_code, 200)
        self.assertEqual(verify_response.data['status'], 'valid')
        self.assertEqual(verify_response.data['recipient_name'], 'Ana Mussa')
        self.assertNotIn('student_email', verify_response.data)
        self.assertNotIn('revocation_reason', verify_response.data)
        self.assertTrue(
            CourseCertificateEvent.objects.filter(
                certificate__certificate_number=certificate_number,
                action='issued',
            ).exists()
        )

    def test_admin_can_revoke_correct_and_audit_certificate(self):
        LessonProgress.objects.create(
            enrollment=self.enrollment,
            lesson=self.lesson,
            completed=True,
        )
        QuizAttempt.objects.create(
            enrollment=self.enrollment,
            quiz=self.quiz,
            passed=True,
            completed_at=timezone.now(),
        )
        certificate, _ = issue_course_certificate(self.enrollment)
        admin = User.objects.create_superuser(
            email='admin@example.test',
            username='admin',
            password='test-password',
        )
        client = APIClient()
        client.force_authenticate(user=admin)
        detail_url = reverse(
            'admin_course_certificate_detail',
            kwargs={'pk': certificate.id},
        )

        missing_reason_response = client.patch(
            detail_url,
            {'status': 'revoked'},
            format='json',
        )
        self.assertEqual(missing_reason_response.status_code, 400)

        revoke_response = client.patch(
            detail_url,
            {'status': 'revoked', 'reason': 'Emissão reportada como irregular.'},
            format='json',
        )
        self.assertEqual(revoke_response.status_code, 200)
        self.assertEqual(revoke_response.data['status'], 'revoked')
        self.assertIsNotNone(revoke_response.data['revoked_at'])
        verification_response = client.get(
            reverse(
                'course_certificate_verify',
                kwargs={'certificate_number': certificate.certificate_number},
            )
        )
        self.assertEqual(verification_response.data['status'], 'revoked')
        self.assertNotIn('revocation_reason', verification_response.data)

        correction_response = client.patch(
            detail_url,
            {
                'status': 'valid',
                'recipient_name': 'Ana M. Mussa',
                'reason': 'Nome corrigido após validação documental.',
            },
            format='json',
        )
        self.assertEqual(correction_response.status_code, 200)
        self.assertEqual(correction_response.data['recipient_name'], 'Ana M. Mussa')
        self.assertEqual(correction_response.data['status'], 'valid')
        self.assertEqual(
            [event['action'] for event in correction_response.data['events'][:2]],
            ['reinstated', 'revoked'],
        )
