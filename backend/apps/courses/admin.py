from django.contrib import admin
from django import forms
from django.utils import timezone
from .models import (
    Course, CourseModule, CourseLesson, Enrollment,
    CourseCertificate, CourseCertificateEvent,
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


class CourseCertificateAdminForm(forms.ModelForm):
    reason = forms.CharField(
        label='Motivo da alteração',
        required=False,
        widget=forms.Textarea(attrs={'rows': 3}),
    )

    class Meta:
        model = CourseCertificate
        fields = ('recipient_name', 'course_title', 'status', 'reason')

    def clean(self):
        cleaned_data = super().clean()
        if not self.instance.pk:
            return cleaned_data
        changed = any(
            cleaned_data.get(field) != getattr(self.instance, field)
            for field in ('recipient_name', 'course_title', 'status')
        )
        reason = cleaned_data.get('reason', '').strip()
        if changed and not reason:
            self.add_error('reason', 'Indique o motivo da correcção ou alteração de estado.')
        if cleaned_data.get('status') == 'revoked' and not reason:
            self.add_error('reason', 'O motivo é obrigatório para revogar um certificado.')
        return cleaned_data


class CourseCertificateEventInline(admin.TabularInline):
    model = CourseCertificateEvent
    extra = 0
    can_delete = False
    fields = ('created_at', 'action', 'actor', 'reason', 'changes')
    readonly_fields = fields

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(CourseCertificate)
class CourseCertificateAdmin(admin.ModelAdmin):
    form = CourseCertificateAdminForm
    list_display = ('certificate_number', 'recipient_name', 'course_title', 'issued_at', 'status')
    list_filter = ('status', 'issued_at')
    search_fields = ('certificate_number', 'recipient_name', 'course_title')
    readonly_fields = (
        'enrollment', 'certificate_number', 'issued_at', 'revoked_at',
        'revocation_reason',
    )
    inlines = [CourseCertificateEventInline]

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def save_model(self, request, obj, form, change):
        previous = CourseCertificate.objects.get(pk=obj.pk) if change else None
        reason = form.cleaned_data.get('reason', '').strip()
        old_status = previous.status if previous else None
        changes = {}
        if previous:
            for field in ('recipient_name', 'course_title', 'status'):
                old_value = getattr(previous, field)
                new_value = getattr(obj, field)
                if old_value != new_value:
                    changes[field] = {'from': old_value, 'to': new_value}

        if obj.status == 'revoked':
            obj.revoked_at = obj.revoked_at or timezone.now()
            obj.revocation_reason = reason or obj.revocation_reason
        else:
            obj.revoked_at = None
            obj.revocation_reason = ''
        super().save_model(request, obj, form, change)

        if changes:
            action = (
                'revoked' if old_status != 'revoked' and obj.status == 'revoked'
                else 'reinstated' if old_status == 'revoked' and obj.status == 'valid'
                else 'corrected'
            )
            CourseCertificateEvent.objects.create(
                certificate=obj,
                actor=request.user,
                action=action,
                reason=reason or obj.revocation_reason,
                changes=changes,
            )

    def get_queryset(self, request):
        return super().get_queryset(request).select_related(
            'enrollment__user', 'enrollment__course__product'
        )


@admin.register(CourseCertificateEvent)
class CourseCertificateEventAdmin(admin.ModelAdmin):
    list_display = ('certificate', 'action', 'actor', 'created_at')
    list_filter = ('action', 'created_at')
    search_fields = ('certificate__certificate_number', 'certificate__recipient_name', 'reason')
    readonly_fields = ('certificate', 'actor', 'action', 'reason', 'changes', 'created_at')

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


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
