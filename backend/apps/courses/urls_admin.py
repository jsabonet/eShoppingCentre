from django.urls import path
from .views_admin import (
    AdminCourseCertificateDetailView, AdminCourseCertificateListView,
    AdminCourseListCreateView, AdminCourseDetailView,
)

urlpatterns = [
    path('certificates/', AdminCourseCertificateListView.as_view(), name='admin_course_certificates'),
    path('certificates/<uuid:pk>/', AdminCourseCertificateDetailView.as_view(), name='admin_course_certificate_detail'),
    path('', AdminCourseListCreateView.as_view(), name='admin_course_list'),
    path('<uuid:pk>/', AdminCourseDetailView.as_view(), name='admin_course_detail'),
]
