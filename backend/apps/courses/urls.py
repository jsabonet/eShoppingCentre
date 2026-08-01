from django.urls import path
from . import views
from .views_cloudflare import (
    LessonUploadURLCreateView,
    LessonVideoStatusView,
    LessonStreamTokenView,
    CloudflareWebhookView,
)

urlpatterns = [
    path('', views.CourseListView.as_view(), name='course_list'),
    path('<slug:product__slug>/', views.CourseDetailView.as_view(), name='course_detail'),
    # Enrollment & Progress
    path('<uuid:course_id>/enroll/', views.EnrollView.as_view(), name='enroll'),
    path('<uuid:course_id>/progress/', views.CourseProgressView.as_view(), name='course_progress'),
    path('<uuid:course_id>/builder/', views.CourseBuilderView.as_view(), name='course_builder'),
    path('<uuid:course_id>/update/', views.CourseUpdateView.as_view(), name='course_update'),
    path('<uuid:course_id>/delete/', views.CourseDeleteView.as_view(), name='course_delete'),
    path('<uuid:course_id>/students/', views.CourseStudentListView.as_view(), name='course_students'),
    # Modules
    path('<uuid:course_id>/modules/', views.ModuleCreateView.as_view(), name='module_create'),
    path('<uuid:course_id>/modules/reorder/', views.ModuleReorderView.as_view(), name='module_reorder'),
    path('modules/<uuid:module_id>/', views.ModuleUpdateView.as_view(), name='module_update'),
    path('modules/<uuid:module_id>/delete/', views.ModuleDeleteView.as_view(), name='module_delete'),
    # Lessons
    path('modules/<uuid:module_id>/lessons/', views.LessonCreateView.as_view(), name='lesson_create'),
    path('modules/<uuid:module_id>/lessons/reorder/', views.LessonReorderView.as_view(), name='lesson_reorder'),
    path('lessons/<uuid:lesson_id>/', views.LessonUpdateView.as_view(), name='lesson_update'),
    path('lessons/<uuid:lesson_id>/delete/', views.LessonDeleteView.as_view(), name='lesson_delete'),
    # Complete lesson
    path('me/lessons/<uuid:lesson_id>/complete/', views.CompleteLessonView.as_view(), name='complete_lesson'),
    # My enrollments
    path('me/enrollments/', views.MyEnrollmentsView.as_view(), name='my_enrollments'),
    # ─── Cloudflare Stream ───
    path('lessons/<uuid:lesson_id>/upload-url/', LessonUploadURLCreateView.as_view(), name='lesson-upload-url'),
    path('lessons/<uuid:lesson_id>/video-status/', LessonVideoStatusView.as_view(), name='lesson-video-status'),
    path('lessons/<uuid:lesson_id>/stream-token/', LessonStreamTokenView.as_view(), name='lesson-stream-token'),
    path('webhooks/cloudflare/', CloudflareWebhookView.as_view(), name='cloudflare-webhook'),
]
