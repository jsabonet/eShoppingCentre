from django.urls import path
from .views_admin import AdminCourseListCreateView, AdminCourseDetailView

urlpatterns = [
    path('', AdminCourseListCreateView.as_view(), name='admin_course_list'),
    path('<uuid:pk>/', AdminCourseDetailView.as_view(), name='admin_course_detail'),
]
