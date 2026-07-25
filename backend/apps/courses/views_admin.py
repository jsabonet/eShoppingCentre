from rest_framework import generics, permissions
from .models import Course, CourseModule, CourseLesson
from .serializers import CourseListSerializer


class AdminCourseListCreateView(generics.ListCreateAPIView):
    """Admin: listar e criar cursos"""
    queryset = Course.objects.all()
    serializer_class = CourseListSerializer
    permission_classes = [permissions.IsAdminUser]


class AdminCourseDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Admin: ver, editar e eliminar curso"""
    queryset = Course.objects.all()
    serializer_class = CourseListSerializer
    permission_classes = [permissions.IsAdminUser]
    lookup_field = 'pk'
