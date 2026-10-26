from rest_framework import filters, generics, permissions
from .models import Course, CourseCertificate, CourseModule, CourseLesson
from .serializers import AdminCourseCertificateSerializer, CourseListSerializer


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


class AdminCourseCertificateListView(generics.ListAPIView):
    serializer_class = AdminCourseCertificateSerializer
    permission_classes = [permissions.IsAdminUser]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['certificate_number', 'recipient_name', 'course_title', 'enrollment__user__email']
    ordering_fields = ['issued_at', 'status', 'recipient_name', 'course_title']
    ordering = ['-issued_at']

    def get_queryset(self):
        queryset = CourseCertificate.objects.select_related(
            'enrollment__user'
        ).prefetch_related('events__actor')
        status_filter = self.request.query_params.get('status')
        if status_filter in ('valid', 'revoked'):
            queryset = queryset.filter(status=status_filter)
        return queryset


class AdminCourseCertificateDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = AdminCourseCertificateSerializer
    permission_classes = [permissions.IsAdminUser]
    queryset = CourseCertificate.objects.select_related(
        'enrollment__user'
    ).prefetch_related('events__actor')
