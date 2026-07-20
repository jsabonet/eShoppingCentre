from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from .models import Course, CourseLesson, Enrollment, LessonProgress
from .serializers import (
    CourseListSerializer, CourseDetailSerializer,
    EnrollmentSerializer, CourseLessonDetailSerializer,
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
