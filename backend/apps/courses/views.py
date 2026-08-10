from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.db import transaction
from .models import (
    Course, CourseModule, CourseLesson, Enrollment, LessonProgress, LessonAttachment,
    Quiz, Question, AnswerOption, QuizAttempt, QuizAnswer,
)
from .serializers import (
    CourseListSerializer, CourseDetailSerializer,
    EnrollmentSerializer, CourseLessonDetailSerializer,
    CourseModuleSerializer, CourseModuleWriteSerializer, CourseLessonWriteSerializer,
    QuizSerializer, QuizWriteSerializer, QuizListSerializer,
    QuizAttemptSerializer, QuizAttemptListSerializer, QuizSubmitSerializer,
)


class CourseListView(generics.ListAPIView):
    queryset = Course.objects.filter(product__status='active').select_related('product', 'instructor')
    serializer_class = CourseListSerializer
    permission_classes = [permissions.AllowAny]


class CourseDetailView(generics.RetrieveAPIView):
    queryset = Course.objects.filter(product__status='active')
    serializer_class = CourseDetailSerializer
    lookup_field = 'product__slug'
    permission_classes = [permissions.AllowAny]


class MyEnrollmentsView(generics.ListAPIView):
    serializer_class = EnrollmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Enrollment.objects.filter(user=self.request.user).select_related('course__product')


class CompleteLessonView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, lesson_id):
        try:
            lesson = CourseLesson.objects.get(id=lesson_id)
            enrollment = Enrollment.objects.get(
                user=request.user,
                course=lesson.module.course,
            )
            progress, _ = LessonProgress.objects.get_or_create(
                enrollment=enrollment,
                lesson=lesson,
            )
            progress.completed = True
            progress.save()

            # Atualizar progresso do curso
            total = enrollment.course.total_lessons
            completed_count = enrollment.lesson_progress.filter(completed=True).count()
            enrollment.progress = (completed_count / total) * 100 if total > 0 else 0
            if enrollment.progress == 100:
                enrollment.completed = True
            enrollment.save()

            return Response({'progress': enrollment.progress, 'completed': enrollment.completed})
        except (CourseLesson.DoesNotExist, Enrollment.DoesNotExist):
            return Response({'detail': 'Lição ou matrícula não encontrada.'},
                          status=status.HTTP_404_NOT_FOUND)


class WatchProgressView(APIView):
    """PATCH /api/v1/courses/me/lessons/{lesson_id}/watch-progress/ — Guarda tempo de visualização."""
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, lesson_id):
        try:
            lesson = CourseLesson.objects.get(id=lesson_id)
            enrollment = Enrollment.objects.get(
                user=request.user,
                course=lesson.module.course,
            )
            watched = request.data.get('watched_seconds', 0)
            progress, _ = LessonProgress.objects.get_or_create(
                enrollment=enrollment, lesson=lesson
            )
            if watched > progress.watched_duration:
                progress.watched_duration = watched
                progress.save()
            return Response({'watched_duration': progress.watched_duration})
        except (CourseLesson.DoesNotExist, Enrollment.DoesNotExist):
            return Response({'detail': 'Lição ou matrícula não encontrada.'}, status=404)


# ─── Course Builder (Seller) ───

class CourseBuilderView(APIView):
    """GET /api/v1/courses/{course_id}/builder/ — Retorna estrutura completa do curso."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, course_id):
        course = get_object_or_404(Course, id=course_id)
        if course.product.store.owner != request.user:
            return Response({'detail': 'Nao autorizado.'}, status=403)

        modules = course.modules.all().prefetch_related('lessons')

        # Actualizar status de videos Cloudflare que ainda nao estao ready/error
        from .services.cloudflare_stream import get_video_status as cf_status
        for module in modules:
            for lesson in module.lessons.all():
                if lesson.cloudflare_video_uid and lesson.cloudflare_video_status not in ('ready', 'error'):
                    try:
                        status_data = cf_status(lesson.cloudflare_video_uid)
                        if status_data.get('ready_to_stream'):
                            lesson.cloudflare_video_status = 'ready'
                            lesson.video_duration_seconds = status_data.get('duration', 0)
                            lesson.video_thumbnail = status_data.get('thumbnail', '')
                            lesson.save()
                        elif status_data.get('status') == 'error':
                            lesson.cloudflare_video_status = 'error'
                            lesson.save()
                    except Exception:
                        pass  # Ignorar erros de rede ao verificar Cloudflare

        return Response({
            'course_id': str(course.id),
            'course_title': course.product.name,
            'modules': CourseModuleSerializer(modules, many=True).data,
        })


class CourseLearnView(APIView):
    """GET /api/v1/courses/{course_id}/learn/ — Estrutura do curso para alunos matriculados."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, course_id):
        course = get_object_or_404(Course, id=course_id)
        try:
            enrollment = Enrollment.objects.get(user=request.user, course=course)
        except Enrollment.DoesNotExist:
            return Response({'detail': 'Nao matriculado neste curso.'}, status=403)

        # Verificar se o acesso expirou
        if not enrollment.has_access:
            return Response({'detail': 'O seu acesso a este curso expirou.'}, status=403)

        modules = course.modules.all().prefetch_related('lessons', 'quizzes')

        # Marcar aulas concluidas para o aluno
        completed_ids = set(
            LessonProgress.objects.filter(
                enrollment=enrollment, completed=True
            ).values_list('lesson_id', flat=True)
        )

        modules_data = CourseModuleSerializer(
            modules, many=True,
            context={'request': request, 'enrollment': enrollment}
        ).data

        # Quiz attempts status for all quizzes in this course
        quiz_attempts = {}
        for attempt in QuizAttempt.objects.filter(
            enrollment=enrollment, completed_at__isnull=False
        ).select_related('quiz').order_by('-attempt_number'):
            quiz_id = str(attempt.quiz_id)
            if quiz_id not in quiz_attempts:
                quiz_attempts[quiz_id] = {
                    'passed': attempt.passed,
                    'score': float(attempt.score) if attempt.score is not None else None,
                    'attempt_number': attempt.attempt_number,
                }

        return Response({
            'course_id': str(course.id),
            'course_title': course.product.name,
            'modules': modules_data,
            'progress': float(enrollment.progress),
            'completed': enrollment.completed,
            'completed_ids': list(completed_ids),
            'quiz_attempts': quiz_attempts,
        })


class ModuleCreateView(generics.CreateAPIView):
    """POST /api/v1/courses/{course_id}/modules/"""
    serializer_class = CourseModuleWriteSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        course = get_object_or_404(Course, id=self.kwargs['course_id'])
        if course.product.store.owner != self.request.user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Nao autorizado.')
        last = course.modules.order_by('-sort_order').first()
        sort_order = (last.sort_order + 1) if last else 0
        serializer.save(course=course, sort_order=sort_order)


class ModuleUpdateView(generics.UpdateAPIView):
    """PUT /api/v1/courses/modules/{module_id}/"""
    queryset = CourseModule.objects.all()
    serializer_class = CourseModuleWriteSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = 'id'
    lookup_url_kwarg = 'module_id'

    def perform_update(self, serializer):
        if self.get_object().course.product.store.owner != self.request.user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Nao autorizado.')
        serializer.save()


class ModuleDeleteView(generics.DestroyAPIView):
    """DELETE /api/v1/courses/modules/{module_id}/"""
    queryset = CourseModule.objects.all()
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = 'id'
    lookup_url_kwarg = 'module_id'

    def perform_destroy(self, instance):
        if instance.course.product.store.owner != self.request.user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Nao autorizado.')
        instance.delete()


class ModuleReorderView(APIView):
    """PATCH /api/v1/courses/{course_id}/modules/reorder/ — Recebe lista de IDs na nova ordem."""
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, course_id):
        course = get_object_or_404(Course, id=course_id)
        if course.product.store.owner != request.user:
            return Response({'detail': 'Nao autorizado.'}, status=403)

        ordered_ids = request.data.get('ordered_ids', [])
        for idx, module_id in enumerate(ordered_ids):
            CourseModule.objects.filter(id=module_id, course=course).update(sort_order=idx)
        return Response({'ok': True})


class LessonCreateView(generics.CreateAPIView):
    """POST /api/v1/courses/modules/{module_id}/lessons/"""
    serializer_class = CourseLessonWriteSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        module = get_object_or_404(CourseModule, id=self.kwargs['module_id'])
        if module.course.product.store.owner != self.request.user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Nao autorizado.')
        last = module.lessons.order_by('-sort_order').first()
        sort_order = (last.sort_order + 1) if last else 0
        serializer.save(module=module, sort_order=sort_order)


class LessonUpdateView(generics.UpdateAPIView):
    """PUT/PATCH /api/v1/courses/lessons/{lesson_id}/ — Suporta partial updates."""
    queryset = CourseLesson.objects.all()
    serializer_class = CourseLessonWriteSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = 'id'
    lookup_url_kwarg = 'lesson_id'

    def get_serializer(self, *args, **kwargs):
        kwargs['partial'] = True
        return super().get_serializer(*args, **kwargs)

    def perform_update(self, serializer):
        if self.get_object().module.course.product.store.owner != self.request.user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Nao autorizado.')
        serializer.save()


class LessonDeleteView(generics.DestroyAPIView):
    """DELETE /api/v1/courses/lessons/{lesson_id}/"""
    queryset = CourseLesson.objects.all()
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = 'id'
    lookup_url_kwarg = 'lesson_id'

    def perform_destroy(self, instance):
        if instance.module.course.product.store.owner != self.request.user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Nao autorizado.')
        instance.delete()


class LessonReorderView(APIView):
    """PATCH /api/v1/courses/modules/{module_id}/lessons/reorder/"""
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, module_id):
        module = get_object_or_404(CourseModule, id=module_id)
        if module.course.product.store.owner != request.user:
            return Response({'detail': 'Nao autorizado.'}, status=403)

        ordered_ids = request.data.get('ordered_ids', [])
        for idx, lesson_id in enumerate(ordered_ids):
            CourseLesson.objects.filter(id=lesson_id, module=module).update(sort_order=idx)
        return Response({'ok': True})


# ─── Enrollment ───

class EnrollView(APIView):
    """POST /api/v1/courses/{course_id}/enroll/ — Matricula o utilizador apos compra."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, course_id):
        course = get_object_or_404(Course, id=course_id)
        enrollment, created = Enrollment.objects.get_or_create(
            user=request.user,
            course=course,
        )
        if created:
            return Response({'detail': 'Matriculado com sucesso.'}, status=201)
        return Response({'detail': 'Ja esta matriculado.', 'enrollment_id': str(enrollment.id)})


class CourseProgressView(APIView):
    """GET /api/v1/courses/{course_id}/progress/ — Progresso do aluno no curso."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, course_id):
        course = get_object_or_404(Course, id=course_id)
        try:
            enrollment = Enrollment.objects.get(user=request.user, course=course)
        except Enrollment.DoesNotExist:
            return Response({'detail': 'Nao matriculado.'}, status=404)

        lessons = CourseLesson.objects.filter(module__course=course)
        completed_ids = set(
            LessonProgress.objects.filter(
                enrollment=enrollment, completed=True
            ).values_list('lesson_id', flat=True)
        )

        total = lessons.count()
        done = len(completed_ids)

        return Response({
            'progress': float(enrollment.progress),
            'completed': enrollment.completed,
            'total_lessons': total,
            'completed_lessons': done,
            'completed_ids': list(completed_ids),
        })


# ─── Course Update (Seller) ───

class CourseUpdateView(APIView):
    """PATCH /api/v1/courses/{course_id}/update/ — Editar metadados do curso."""
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, course_id):
        course = get_object_or_404(Course, id=course_id)
        if course.product.store.owner != request.user:
            return Response({'detail': 'Nao autorizado.'}, status=403)

        # Campos editaveis no modelo Course
        course_fields = ['level', 'duration', 'certificate_enabled', 'preview_video_url']
        for field in course_fields:
            if field in request.data:
                setattr(course, field, request.data[field])

        # Campos editaveis no Product (nome, preco, descricao, slug)
        product = course.product
        product_fields = ['name', 'price', 'compare_price', 'description', 'short_description', 'slug']
        for field in product_fields:
            if field in request.data:
                setattr(product, field, request.data[field])

        # Update product status if provided
        if 'status' in request.data:
            product.status = request.data['status']

        # Update total_lessons count
        course.total_lessons = CourseLesson.objects.filter(module__course=course).count()

        course.save()
        product.save()

        return Response({
            'course_id': str(course.id),
            'title': product.name,
            'slug': product.slug,
            'price': float(product.price),
            'level': course.level,
            'duration': course.duration,
            'total_lessons': course.total_lessons,
            'certificate_enabled': course.certificate_enabled,
            'preview_video_url': course.preview_video_url,
            'status': product.status,
        })


class CourseDeleteView(APIView):
    """DELETE /api/v1/courses/{course_id}/delete/ — Eliminar curso e produto associado."""
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, course_id):
        course = get_object_or_404(Course, id=course_id)
        if course.product.store.owner != request.user:
            return Response({'detail': 'Nao autorizado.'}, status=403)

        product = course.product
        course_name = product.name
        # Soft-delete: mark product as deleted instead of hard delete
        product.status = 'deleted'
        product.save()
        return Response({'detail': f'Curso "{course_name}" removido com sucesso.'})


# ─── Students (Seller) ───

class CourseStudentListView(APIView):
    """GET /api/v1/courses/{course_id}/students/ — Lista alunos matriculados."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, course_id):
        course = get_object_or_404(Course, id=course_id)
        if course.product.store.owner != request.user:
            return Response({'detail': 'Nao autorizado.'}, status=403)

        enrollments = Enrollment.objects.filter(course=course).select_related('user')
        students = []
        for enr in enrollments:
            completed_lessons = enr.lesson_progress.filter(completed=True).count()
            students.append({
                'enrollment_id': str(enr.id),
                'user_id': str(enr.user.id),
                'name': enr.user.get_full_name() or enr.user.email,
                'email': enr.user.email,
                'progress': float(enr.progress),
                'completed': enr.completed,
                'completed_lessons': completed_lessons,
                'enrolled_at': enr.created_at.isoformat(),
            })
        return Response({
            'course_title': course.product.name,
            'total_students': len(students),
            'total_lessons': course.total_lessons,
            'students': students,
        })


# ─── Lesson Attachments ───

class LessonAttachmentListView(APIView):
    """GET /api/v1/courses/lessons/{lesson_id}/attachments/"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, lesson_id):
        lesson = get_object_or_404(CourseLesson, id=lesson_id)
        attachments = lesson.attachments.all().order_by('sort_order')
        data = [{
            'id': str(a.id),
            'title': a.title,
            'file_url': request.build_absolute_uri(a.file.url) if a.file else None,
            'file_name': a.file.name.rsplit('/', 1)[-1] if a.file else '',
            'file_size': a.file_size,
            'file_type': a.file_type,
            'sort_order': a.sort_order,
        } for a in attachments]
        return Response(data)


class LessonAttachmentUploadView(APIView):
    """POST /api/v1/courses/lessons/{lesson_id}/attachments/"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, lesson_id):
        lesson = get_object_or_404(CourseLesson, id=lesson_id)
        if lesson.module.course.product.store.owner != request.user:
            return Response({'detail': 'Nao autorizado.'}, status=403)

        file = request.FILES.get('file')
        if not file:
            return Response({'detail': 'Ficheiro obrigatorio.'}, status=400)

        title = request.data.get('title', file.name.rsplit('.', 1)[0])
        last = lesson.attachments.order_by('-sort_order').first()
        sort_order = (last.sort_order + 1) if last else 0

        attachment = LessonAttachment.objects.create(
            lesson=lesson,
            title=title,
            file=file,
            sort_order=sort_order,
        )
        return Response({
            'id': str(attachment.id),
            'title': attachment.title,
            'file_url': request.build_absolute_uri(attachment.file.url),
            'file_name': attachment.file.name.rsplit('/', 1)[-1],
            'file_size': attachment.file_size,
            'file_type': attachment.file_type,
            'sort_order': attachment.sort_order,
        }, status=201)


class LessonAttachmentDeleteView(APIView):
    """DELETE /api/v1/courses/lessons/attachments/{attachment_id}/"""
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, attachment_id):
        attachment = get_object_or_404(LessonAttachment, id=attachment_id)
        if attachment.lesson.module.course.product.store.owner != request.user:
            return Response({'detail': 'Nao autorizado.'}, status=403)
        attachment.delete()
        return Response({'detail': 'Anexo removido.'})


# ═══════════════════════════════════════════
#  QUIZZES / AVALIAÇÕES
# ═══════════════════════════════════════════

class QuizListByCourseView(generics.ListAPIView):
    """GET /api/v1/courses/{course_id}/quizzes/ — Lista quizzes de um curso."""
    serializer_class = QuizListSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None  # desabilita paginação para retornar array simples

    def get_queryset(self):
        course_id = self.kwargs['course_id']
        return Quiz.objects.filter(
            module__course_id=course_id
        ).select_related('module', 'lesson').order_by('module__sort_order', 'sort_order')


class QuizDetailView(generics.RetrieveAPIView):
    """GET /api/v1/courses/quizzes/{quiz_id}/ — Detalhe completo do quiz (com questões e opções)."""
    queryset = Quiz.objects.all().prefetch_related('questions__options')
    serializer_class = QuizSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = 'id'
    lookup_url_kwarg = 'quiz_id'


class QuizCreateView(generics.CreateAPIView):
    """POST /api/v1/courses/modules/{module_id}/quizzes/ — Criar quiz num módulo."""
    serializer_class = QuizWriteSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        module = get_object_or_404(CourseModule, id=self.kwargs['module_id'])
        if module.course.product.store.owner != self.request.user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Nao autorizado.')
        last = module.quizzes.order_by('-sort_order').first()
        sort_order = (last.sort_order + 1) if last else 0
        serializer.save(module=module, sort_order=sort_order)


class QuizUpdateView(generics.UpdateAPIView):
    """PUT /api/v1/courses/quizzes/{quiz_id}/ — Editar quiz."""
    queryset = Quiz.objects.all()
    serializer_class = QuizWriteSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = 'id'
    lookup_url_kwarg = 'quiz_id'

    def perform_update(self, serializer):
        if self.get_object().module.course.product.store.owner != self.request.user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Nao autorizado.')
        serializer.save()


class QuizDeleteView(generics.DestroyAPIView):
    """DELETE /api/v1/courses/quizzes/{quiz_id}/ — Remover quiz."""
    queryset = Quiz.objects.all()
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = 'id'
    lookup_url_kwarg = 'quiz_id'

    def perform_destroy(self, instance):
        if instance.module.course.product.store.owner != self.request.user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Nao autorizado.')
        instance.delete()


# ─── Questions CRUD ───

from .serializers import QuestionWriteSerializer, QuestionSerializer


class QuestionCreateView(generics.CreateAPIView):
    """POST /api/v1/courses/quizzes/{quiz_id}/questions/ — Adicionar questão ao quiz."""
    serializer_class = QuestionWriteSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        quiz = get_object_or_404(Quiz, id=self.kwargs['quiz_id'])
        if quiz.module.course.product.store.owner != self.request.user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Nao autorizado.')
        last = quiz.questions.order_by('-sort_order').first()
        sort_order = (last.sort_order + 1) if last else 0
        serializer.save(quiz=quiz, sort_order=sort_order)


class QuestionUpdateView(generics.UpdateAPIView):
    """PUT /api/v1/courses/quizzes/questions/{question_id}/ — Editar questão (inclui opções)."""
    queryset = Question.objects.all()
    serializer_class = QuestionWriteSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = 'id'
    lookup_url_kwarg = 'question_id'

    def perform_update(self, serializer):
        if self.get_object().quiz.module.course.product.store.owner != self.request.user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Nao autorizado.')
        serializer.save()


class QuestionDeleteView(generics.DestroyAPIView):
    """DELETE /api/v1/courses/quizzes/questions/{question_id}/ — Remover questão."""
    queryset = Question.objects.all()
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = 'id'
    lookup_url_kwarg = 'question_id'

    def perform_destroy(self, instance):
        if instance.quiz.module.course.product.store.owner != self.request.user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Nao autorizado.')
        instance.delete()


# ─── Quiz Attempt (Aluno) ───

class QuizStartAttemptView(APIView):
    """POST /api/v1/courses/quizzes/{quiz_id}/attempt/ — Iniciar tentativa de quiz."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, quiz_id):
        quiz = get_object_or_404(Quiz, id=quiz_id)

        # Verificar matrícula
        enrollment = get_object_or_404(
            Enrollment, user=request.user, course=quiz.module.course
        )

        if not enrollment.has_access:
            return Response({'detail': 'O seu acesso a este curso expirou.'}, status=403)

        # Verificar número máximo de tentativas
        if quiz.max_attempts is not None:
            existing_attempts = QuizAttempt.objects.filter(
                enrollment=enrollment, quiz=quiz
            ).count()
            if existing_attempts >= quiz.max_attempts:
                return Response(
                    {'detail': f'Limite de {quiz.max_attempts} tentativa(s) atingido.'},
                    status=400
                )

        # Contar tentativas anteriores para definir attempt_number
        last_attempt = QuizAttempt.objects.filter(
            enrollment=enrollment, quiz=quiz
        ).order_by('-attempt_number').first()
        attempt_number = (last_attempt.attempt_number + 1) if last_attempt else 1

        attempt = QuizAttempt.objects.create(
            enrollment=enrollment,
            quiz=quiz,
            attempt_number=attempt_number,
        )

        # Retornar o quiz completo com questoes (sem opcoes corretas visiveis)
        quiz_data = QuizSerializer(quiz, context={'request': request}).data

        # Remover is_correct das opcoes — o aluno nao pode ver as respostas
        for question in quiz_data.get('questions', []):
            for option in question.get('options', []):
                option.pop('is_correct', None)

        return Response({
            'attempt_id': str(attempt.id),
            'attempt_number': attempt_number,
            'quiz': quiz_data,
            'started_at': attempt.started_at,
        }, status=201)


class QuizSubmitView(APIView):
    """POST /api/v1/courses/quizzes/{quiz_id}/submit/ — Submeter respostas do quiz."""
    permission_classes = [permissions.IsAuthenticated]

    @transaction.atomic
    def post(self, request, quiz_id):
        quiz = get_object_or_404(Quiz.objects.select_related('module__course'), id=quiz_id)

        enrollment = get_object_or_404(
            Enrollment, user=request.user, course=quiz.module.course
        )

        if not enrollment.has_access:
            return Response({'detail': 'O seu acesso a este curso expirou.'}, status=403)

        # Obter a tentativa mais recente não completada, ou criar uma nova
        attempt = QuizAttempt.objects.filter(
            enrollment=enrollment, quiz=quiz, completed_at__isnull=True
        ).order_by('-attempt_number').first()

        if not attempt:
            # Verificar limite de tentativas
            if quiz.max_attempts is not None:
                existing = QuizAttempt.objects.filter(
                    enrollment=enrollment, quiz=quiz
                ).count()
                if existing >= quiz.max_attempts:
                    return Response(
                        {'detail': f'Limite de {quiz.max_attempts} tentativa(s) atingido.'},
                        status=400
                    )

            last = QuizAttempt.objects.filter(
                enrollment=enrollment, quiz=quiz
            ).order_by('-attempt_number').first()
            attempt_number = (last.attempt_number + 1) if last else 1

            attempt = QuizAttempt.objects.create(
                enrollment=enrollment, quiz=quiz, attempt_number=attempt_number
            )

        # Validar submission
        submit_serializer = QuizSubmitSerializer(data=request.data)
        if not submit_serializer.is_valid():
            return Response(submit_serializer.errors, status=400)

        answers_data = submit_serializer.validated_data['answers']

        # Processar respostas
        total_points = 0
        earned_points = 0
        questions = {str(q.id): q for q in quiz.questions.all().prefetch_related('options')}

        for answer_data in answers_data:
            question_id = str(answer_data['question_id'])
            question = questions.get(question_id)
            if not question:
                continue

            total_points += question.points

            # Criar/atualizar resposta
            quiz_answer, _ = QuizAnswer.objects.update_or_create(
                attempt=attempt,
                question_id=question_id,
                defaults={
                    'open_text_answer': answer_data.get('open_text_answer', ''),
                }
            )

            # Limpar opções anteriores para reseleção
            quiz_answer.selected_options.clear()

            is_correct = None

            if question.question_type in ('multiple_choice', 'true_false'):
                selected_id = answer_data.get('selected_option_id')
                if selected_id:
                    quiz_answer.selected_option_id = selected_id
                    # Verificar se está correta
                    correct_option = question.options.filter(id=selected_id, is_correct=True).exists()
                    is_correct = correct_option
                    if correct_option:
                        earned_points += question.points

            elif question.question_type == 'multiple_select':
                selected_ids = answer_data.get('selected_option_ids', [])
                if selected_ids:
                    quiz_answer.selected_options.set(selected_ids)
                    # Verificar se todas as opções corretas (e apenas elas) foram selecionadas
                    correct_ids = set(
                        question.options.filter(is_correct=True).values_list('id', flat=True)
                    )
                    selected_set = set(selected_ids)
                    is_correct = (selected_set == correct_ids)
                    if is_correct:
                        earned_points += question.points

            elif question.question_type == 'open_text':
                # Texto livre — marcar como correto (avaliação manual depois)
                quiz_answer.open_text_answer = answer_data.get('open_text_answer', '')
                quiz_answer.selected_option = None
                is_correct = None  # Precisa de revisão manual

            quiz_answer.is_correct = is_correct
            quiz_answer.save()

        # Calcular score
        score = (earned_points / total_points * 100) if total_points > 0 else 0
        passed = score >= quiz.pass_percentage

        # Atualizar tentativa
        from django.utils import timezone
        attempt.score = round(score, 2)
        attempt.total_points = total_points
        attempt.earned_points = earned_points
        attempt.passed = passed
        attempt.completed_at = timezone.now()
        attempt.save()

        # Se passou e é required, podemos atualizar progresso do módulo
        if passed and quiz.is_required:
            # Marcar como "quiz concluído" — pode ser usado para desbloquear próximos módulos
            pass

        return Response({
            'attempt_id': str(attempt.id),
            'attempt_number': attempt.attempt_number,
            'score': float(attempt.score),
            'earned_points': earned_points,
            'total_points': total_points,
            'passed': passed,
            'pass_percentage': quiz.pass_percentage,
            'completed_at': attempt.completed_at,
        })


class QuizResultsView(generics.RetrieveAPIView):
    """GET /api/v1/courses/quizzes/{quiz_id}/results/ — Ver resultado da última tentativa."""
    serializer_class = QuizAttemptSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = 'quiz_id'
    lookup_url_kwarg = 'quiz_id'

    def get_object(self):
        quiz = get_object_or_404(Quiz, id=self.kwargs['quiz_id'])
        enrollment = get_object_or_404(
            Enrollment, user=self.request.user, course=quiz.module.course
        )
        # Última tentativa completada
        attempt = QuizAttempt.objects.filter(
            enrollment=enrollment, quiz=quiz, completed_at__isnull=False
        ).order_by('-attempt_number').first()

        if not attempt:
            from rest_framework.exceptions import NotFound
            raise NotFound('Nenhuma tentativa concluída encontrada.')

        return attempt


class QuizAttemptListView(generics.ListAPIView):
    """GET /api/v1/courses/quizzes/{quiz_id}/attempts/ — Listar tentativas do aluno neste quiz."""
    serializer_class = QuizAttemptListSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        quiz = get_object_or_404(Quiz, id=self.kwargs['quiz_id'])
        enrollment = get_object_or_404(
            Enrollment, user=self.request.user, course=quiz.module.course
        )
        return QuizAttempt.objects.filter(
            enrollment=enrollment, quiz=quiz
        ).order_by('-attempt_number')
