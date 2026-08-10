from django.contrib import admin
from .models import (
    Course, CourseModule, CourseLesson, Enrollment,
    Quiz, Question, AnswerOption, QuizAttempt, QuizAnswer,
    CourseReview,
)

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


# ─── Quizzes ───

class AnswerOptionInline(admin.TabularInline):
    model = AnswerOption
    extra = 2


class QuestionInline(admin.TabularInline):
    model = Question
    extra = 1


@admin.register(Quiz)
class QuizAdmin(admin.ModelAdmin):
    list_display = ('title', 'module', 'pass_percentage', 'max_attempts', 'is_required')
    list_filter = ('module__course', 'is_required')
    search_fields = ('title',)


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ('text_preview', 'quiz', 'question_type', 'points', 'sort_order')
    list_filter = ('question_type', 'quiz')
    inlines = [AnswerOptionInline]

    def text_preview(self, obj):
        return obj.text[:80]
    text_preview.short_description = 'Enunciado'


@admin.register(AnswerOption)
class AnswerOptionAdmin(admin.ModelAdmin):
    list_display = ('text_preview', 'question', 'is_correct', 'sort_order')
    list_filter = ('is_correct',)

    def text_preview(self, obj):
        return obj.text[:60]
    text_preview.short_description = 'Texto'


@admin.register(QuizAttempt)
class QuizAttemptAdmin(admin.ModelAdmin):
    list_display = ('enrollment', 'quiz', 'score', 'passed', 'attempt_number', 'completed_at')
    list_filter = ('passed', 'quiz')
    readonly_fields = ('started_at', 'completed_at')


@admin.register(QuizAnswer)
class QuizAnswerAdmin(admin.ModelAdmin):
    list_display = ('attempt', 'question_preview', 'is_correct')
    list_filter = ('is_correct',)

    def question_preview(self, obj):
        return obj.question.text[:60]
    question_preview.short_description = 'Questão'


# ─── Course Reviews ───

@admin.register(CourseReview)
class CourseReviewAdmin(admin.ModelAdmin):
    list_display = ('enrollment', 'course_title', 'rating', 'is_public', 'is_hidden', 'created_at')
    list_filter = ('rating', 'is_public', 'is_hidden', 'course')
    search_fields = ('enrollment__user__email', 'body', 'course__product__name')
    readonly_fields = ('created_at', 'updated_at', 'is_edited')

    def course_title(self, obj):
        return obj.course.product.name[:60]
    course_title.short_description = 'Curso'
