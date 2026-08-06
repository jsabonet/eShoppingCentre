from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import Course, CourseModule, CourseLesson, Enrollment, LessonProgress
from .serializers import (
    CourseListSerializer, CourseDetailSerializer,
    EnrollmentSerializer, CourseLessonDetailSerializer,
    CourseModuleSerializer, CourseModuleWriteSerializer, CourseLessonWriteSerializer,
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

        modules = course.modules.all().prefetch_related('lessons')

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

        return Response({
            'course_id': str(course.id),
            'course_title': course.product.name,
            'modules': modules_data,
            'progress': float(enrollment.progress),
            'completed': enrollment.completed,
            'completed_ids': list(completed_ids),
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
