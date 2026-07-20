from django.urls import path
from . import views

urlpatterns = [
    path('', views.CourseListView.as_view(), name='course_list'),
    path('<slug:product__slug>/', views.CourseDetailView.as_view(), name='course_detail'),
    path('me/enrollments/', views.MyEnrollmentsView.as_view(), name='my_enrollments'),
    path('me/lessons/<uuid:lesson_id>/', views.CompleteLessonView.as_view(), name='complete_lesson'),
]
