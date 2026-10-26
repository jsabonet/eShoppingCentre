from django.utils import timezone

from .models import (
    CourseCertificate, CourseCertificateEvent, CourseLesson, Enrollment, Quiz, QuizAttempt,
)


def refresh_enrollment_completion(enrollment):
    total_lessons = CourseLesson.objects.filter(module__course=enrollment.course).count()
    completed_lessons = enrollment.lesson_progress.filter(completed=True).count()
    required_quiz_ids = Quiz.objects.filter(
        module__course=enrollment.course, is_required=True
    ).values_list('id', flat=True)
    passed_quiz_ids = QuizAttempt.objects.filter(
        enrollment=enrollment,
        quiz_id__in=required_quiz_ids,
        passed=True,
        completed_at__isnull=False,
    ).values_list('quiz_id', flat=True).distinct()
    all_required_quizzes_passed = not (
        set(required_quiz_ids) - set(passed_quiz_ids)
    )
    is_complete = (
        total_lessons > 0
        and completed_lessons >= total_lessons
        and all_required_quizzes_passed
    )

    enrollment.progress = (
        (completed_lessons / total_lessons) * 100 if total_lessons else 0
    )
    enrollment.completed = is_complete
    if is_complete:
        if enrollment.completed_at is None:
            enrollment.completed_at = timezone.now()
    else:
        enrollment.completed_at = None
    enrollment.save(update_fields=['progress', 'completed', 'completed_at', 'updated_at'])
    return is_complete


def issue_course_certificate(enrollment):
    certificate = CourseCertificate.objects.filter(enrollment=enrollment).first()
    if certificate:
        if certificate.status == 'revoked':
            return None, 'Este certificado foi revogado.'
        return certificate, None
    if not enrollment.has_access:
        return None, 'O acesso a este curso expirou.'
    if not enrollment.course.certificate_enabled:
        return None, 'Este curso não emite certificados.'
    if not refresh_enrollment_completion(enrollment):
        return None, 'Conclua todas as aulas e passe nos quizzes obrigatórios para obter o certificado.'

    certificate, created = CourseCertificate.objects.get_or_create(
        enrollment=enrollment,
        defaults={
            'recipient_name': enrollment.user.get_full_name().strip() or enrollment.user.username,
            'course_title': enrollment.course.product.name,
            'issued_at': timezone.now(),
        },
    )
    if created:
        CourseCertificateEvent.objects.create(
            certificate=certificate,
            actor=enrollment.user,
            action='issued',
            reason='Emitido após conclusão dos requisitos do curso.',
        )
    if certificate.status == 'revoked':
        return None, 'Este certificado foi revogado.'
    return certificate, None
