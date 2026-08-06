from django.contrib import admin
from .models import Course, CourseModule, CourseLesson, Enrollment

class CourseLessonInline(admin.TabularInline):
    model = CourseLesson
    extra = 1

class CourseModuleInline(admin.TabularInline):
    model = CourseModule
    extra = 1

@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ('product', 'instructor', 'level', 'total_lessons', 'access_duration_days')
    fields = ('product', 'instructor', 'level', 'duration', 'total_lessons', 'certificate_enabled', 'preview_video_url', 'access_duration_days')
    inlines = [CourseModuleInline]

@admin.register(Enrollment)
class EnrollmentAdmin(admin.ModelAdmin):
    list_display = ('user', 'course', 'progress', 'completed')
