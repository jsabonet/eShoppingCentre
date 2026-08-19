from rest_framework import serializers
from django.db.models import Sum, Avg
from .models import (
    Course, CourseModule, CourseLesson, Enrollment, LessonProgress,
    Quiz, Question, AnswerOption, QuizAttempt, QuizAnswer,
    CourseReview,
)


class CourseLessonSerializer(serializers.ModelSerializer):
    completed = serializers.SerializerMethodField()
    duration = serializers.SerializerMethodField()
    watched_duration = serializers.SerializerMethodField()
    video_status = serializers.CharField(source='cloudflare_video_status', read_only=True)

    class Meta:
        model = CourseLesson
        fields = ('id', 'title', 'description', 'duration', 'is_free_preview',
                  'completed', 'watched_duration', 'video_status', 'sort_order', 'video_url', 'video_provider',
                  'content', 'cloudflare_video_uid', 'cloudflare_video_status')

    def get_completed(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            enrollment = self.context.get('enrollment')
            if enrollment:
                return enrollment.lesson_progress.filter(lesson=obj, completed=True).exists()
        return False

    def get_watched_duration(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            enrollment = self.context.get('enrollment')
            if enrollment:
                try:
                    lp = enrollment.lesson_progress.get(lesson=obj)
                    return lp.watched_duration
                except Exception:
                    return 0
        return 0

    def get_duration(self, obj):
        """Converte video_duration_seconds para formato legivel HH:MM:SS ou MM:SS."""
        secs = int(obj.video_duration_seconds or 0)
        if secs <= 0:
            return ''
        hours = secs // 3600
        mins = (secs % 3600) // 60
        secs_rem = secs % 60
        if hours > 0:
            return f'{hours}:{mins:02d}:{secs_rem:02d}'
        return f'{mins}:{secs_rem:02d}'


class CourseLessonDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = CourseLesson
        fields = '__all__'


class QuizListSerializer(serializers.ModelSerializer):
    """Versão simplificada para listagem (sem questions completas)."""
    total_questions = serializers.SerializerMethodField()
    total_points = serializers.SerializerMethodField()
    module_title = serializers.CharField(source='module.title', read_only=True)

    class Meta:
        model = Quiz
        fields = ('id', 'title', 'description', 'pass_percentage', 'max_attempts',
                  'is_required', 'sort_order', 'module_id', 'lesson_id',
                  'module_title', 'total_questions', 'total_points', 'created_at')

    def get_total_questions(self, obj):
        return obj.questions.count()

    def get_total_points(self, obj):
        return obj.questions.aggregate(total=Sum('points'))['total'] or 0


class CourseModuleSerializer(serializers.ModelSerializer):
    lessons = CourseLessonSerializer(many=True, read_only=True)
    quizzes = QuizListSerializer(many=True, read_only=True)

    class Meta:
        model = CourseModule
        fields = ('id', 'title', 'description', 'sort_order', 'drip_days', 'lessons', 'quizzes')


class CourseModuleWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = CourseModule
        fields = ('id', 'title', 'description', 'sort_order', 'drip_days')


class CourseLessonWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = CourseLesson
        fields = ('id', 'title', 'description', 'video_url', 'video_provider',
                  'content', 'is_free_preview', 'sort_order',
                  'cloudflare_video_uid', 'cloudflare_video_status',
                  'video_duration_seconds', 'video_thumbnail')
        extra_kwargs = {
            'title': {'required': True},
            'video_url': {'required': False, 'allow_blank': True},
        }


class CourseListSerializer(serializers.ModelSerializer):
    title = serializers.CharField(source='product.name', read_only=True)
    slug = serializers.CharField(source='product.slug', read_only=True)
    store_slug = serializers.CharField(source='product.store.slug', read_only=True)
    price = serializers.DecimalField(source='product.price', max_digits=12, decimal_places=2, read_only=True)
    compare_price = serializers.DecimalField(source='product.compare_price', max_digits=12, decimal_places=2, read_only=True)
    image = serializers.SerializerMethodField()
    rating = serializers.DecimalField(source='product.rating', max_digits=3, decimal_places=2, read_only=True)
    students_count = serializers.SerializerMethodField()
    instructor_name = serializers.CharField(source='instructor.first_name', read_only=True)
    total_lessons = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = ('id', 'slug', 'store_slug', 'title', 'instructor_name', 'level', 'duration',
                  'total_lessons', 'image', 'price', 'compare_price', 'rating',
                  'students_count', 'access_duration_days')

    def get_image(self, obj):
        img = obj.product.images.filter(is_primary=True).first()
        if img:
            request = self.context.get('request')
            return request.build_absolute_uri(img.image.url) if request else img.image.url
        return None

    def get_students_count(self, obj):
        if hasattr(obj, 'students_count') and obj.students_count is not None:
            return obj.students_count
        return obj.enrollments.count()

    def get_total_lessons(self, obj):
        """Conta as aulas reais. Usa campo anotado se disponivel, senao conta via DB. Fallback: total_lessons do modelo."""
        if hasattr(obj, '_real_lesson_count') and obj._real_lesson_count is not None:
            count = obj._real_lesson_count
        else:
            count = CourseLesson.objects.filter(module__course=obj).count()
        return count if count > 0 else obj.total_lessons


class CourseDetailSerializer(serializers.ModelSerializer):
    title = serializers.CharField(source='product.name', read_only=True)
    description = serializers.CharField(source='product.description', read_only=True)
    store_slug = serializers.CharField(source='product.store.slug', read_only=True)
    price = serializers.DecimalField(source='product.price', max_digits=12, decimal_places=2, read_only=True)
    compare_price = serializers.DecimalField(source='product.compare_price', max_digits=12, decimal_places=2, read_only=True)
    rating = serializers.DecimalField(source='product.rating', max_digits=3, decimal_places=2, read_only=True)
    students_count = serializers.SerializerMethodField()
    instructor_name = serializers.CharField(source='instructor.first_name', read_only=True)
    modules = CourseModuleSerializer(many=True, read_only=True)
    image = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = '__all__'

    def get_image(self, obj):
        img = obj.product.images.filter(is_primary=True).first()
        if img:
            request = self.context.get('request')
            return request.build_absolute_uri(img.image.url) if request else img.image.url
        return None

    def get_students_count(self, obj):
        return obj.enrollments.count()


class EnrollmentSerializer(serializers.ModelSerializer):
    course_title = serializers.CharField(source='course.product.name', read_only=True)
    course_slug = serializers.CharField(source='course.product.slug', read_only=True)
    course_id = serializers.UUIDField(source='course.id', read_only=True)
    total_lessons = serializers.SerializerMethodField()
    progress = serializers.SerializerMethodField()
    access_duration_days = serializers.IntegerField(source='course.access_duration_days', read_only=True)
    image = serializers.SerializerMethodField()

    class Meta:
        model = Enrollment
        fields = ('id', 'course_id', 'course_title', 'course_slug', 'total_lessons',
                  'image', 'progress', 'completed', 'completed_at', 'created_at',
                  'access_expires_at', 'access_duration_days')

    def get_image(self, obj):
        img = obj.course.product.images.filter(is_primary=True).first()
        if img:
            request = self.context.get('request')
            return request.build_absolute_uri(img.image.url) if request else img.image.url
        return None

    def get_total_lessons(self, obj):
        """Conta as aulas reais. Usa campo anotado se disponivel. Fallback: total_lessons do modelo."""
        if hasattr(obj, '_real_lesson_count') and obj._real_lesson_count is not None:
            count = obj._real_lesson_count
        else:
            count = CourseLesson.objects.filter(module__course=obj.course).count()
        return count if count > 0 else obj.course.total_lessons

    def get_progress(self, obj):
        """Calcula o progresso real: aulas concluidas / total de aulas reais * 100."""
        total = self.get_total_lessons(obj)
        if total == 0:
            return 0.0

        if hasattr(obj, '_completed_lesson_count') and obj._completed_lesson_count is not None:
            completed = obj._completed_lesson_count
        else:
            completed = obj.lesson_progress.filter(completed=True).count()

        return round((completed / total) * 100, 2)


# ─── Quizzes / Avaliações ───

class AnswerOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnswerOption
        fields = ('id', 'text', 'is_correct', 'sort_order')


class AnswerOptionWriteSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(required=False)  # Explicito — editable=False no modelo faz DRF tratar como read_only

    class Meta:
        model = AnswerOption
        fields = ('id', 'text', 'is_correct', 'sort_order')


class QuestionSerializer(serializers.ModelSerializer):
    options = AnswerOptionSerializer(many=True, read_only=True)

    class Meta:
        model = Question
        fields = ('id', 'text', 'question_type', 'sort_order', 'points', 'options')


class QuestionWriteSerializer(serializers.ModelSerializer):
    options = AnswerOptionWriteSerializer(many=True)

    class Meta:
        model = Question
        fields = ('id', 'text', 'question_type', 'sort_order', 'points', 'options')

    def create(self, validated_data):
        options_data = validated_data.pop('options', [])
        question = Question.objects.create(**validated_data)
        for opt_data in options_data:
            opt_data.pop('id', None)  # Deixa o DB gerar novo UUID
            AnswerOption.objects.create(question=question, **opt_data)
        return question

    def update(self, instance, validated_data):
        options_data = validated_data.pop('options', None)
        instance = super().update(instance, validated_data)
        if options_data is not None:
            # Update existing options by ID, create new ones if no ID
            existing_ids = set(instance.options.values_list('id', flat=True))
            updated_ids = set()
            for opt_data in options_data:
                opt_id = opt_data.pop('id', None)
                if opt_id and opt_id in existing_ids:
                    AnswerOption.objects.filter(id=opt_id, question=instance).update(**opt_data)
                    updated_ids.add(opt_id)
                else:
                    new_opt = AnswerOption.objects.create(question=instance, **opt_data)
                    updated_ids.add(new_opt.id)  # Rastreia novas opcoes tambem
            # Remove options that were deleted in the frontend
            instance.options.exclude(id__in=updated_ids).delete()
        return instance


class QuizSerializer(serializers.ModelSerializer):
    questions = QuestionSerializer(many=True, read_only=True)
    total_questions = serializers.SerializerMethodField()
    total_points = serializers.SerializerMethodField()

    class Meta:
        model = Quiz
        fields = ('id', 'title', 'description', 'pass_percentage', 'max_attempts',
                  'is_required', 'sort_order', 'module_id', 'lesson_id',
                  'questions', 'total_questions', 'total_points', 'created_at', 'updated_at')

    def get_total_questions(self, obj):
        return obj.questions.count()

    def get_total_points(self, obj):
        return obj.questions.aggregate(total=Sum('points'))['total'] or 0


class QuizWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Quiz
        fields = ('id', 'title', 'description', 'pass_percentage', 'max_attempts',
                  'is_required', 'sort_order', 'module_id', 'lesson_id')


# ─── Quiz Attempt ───

class QuizAnswerSubmitSerializer(serializers.Serializer):
    """Serializer para submissão de uma resposta individual."""
    question_id = serializers.UUIDField()
    selected_option_id = serializers.UUIDField(required=False, allow_null=True)
    selected_option_ids = serializers.ListField(
        child=serializers.UUIDField(), required=False, allow_empty=True
    )
    open_text_answer = serializers.CharField(required=False, allow_blank=True)


class QuizSubmitSerializer(serializers.Serializer):
    """Serializer para submissão completa do quiz."""
    answers = QuizAnswerSubmitSerializer(many=True)


class QuizAnswerSerializer(serializers.ModelSerializer):
    question_text = serializers.CharField(source='question.text', read_only=True)
    question_type = serializers.CharField(source='question.question_type', read_only=True)
    selected_option_text = serializers.CharField(source='selected_option.text', read_only=True)
    selected_options_texts = serializers.SerializerMethodField()

    class Meta:
        model = QuizAnswer
        fields = ('id', 'question_id', 'question_text', 'question_type',
                  'selected_option_id', 'selected_option_text',
                  'selected_options_texts', 'open_text_answer', 'is_correct')

    def get_selected_options_texts(self, obj):
        return [opt.text for opt in obj.selected_options.all()]


class QuizAttemptSerializer(serializers.ModelSerializer):
    answers = QuizAnswerSerializer(many=True, read_only=True)
    quiz_title = serializers.CharField(source='quiz.title', read_only=True)
    user_email = serializers.CharField(source='enrollment.user.email', read_only=True)
    pass_percentage = serializers.IntegerField(source='quiz.pass_percentage', read_only=True)
    max_attempts = serializers.IntegerField(source='quiz.max_attempts', read_only=True)

    class Meta:
        model = QuizAttempt
        fields = ('id', 'quiz_id', 'quiz_title', 'user_email',
                  'score', 'total_points', 'earned_points', 'passed',
                  'pass_percentage', 'max_attempts',
                  'attempt_number', 'started_at', 'completed_at',
                  'answers')


class QuizAttemptListSerializer(serializers.ModelSerializer):
    """Versão simplificada para listagem de tentativas."""
    quiz_title = serializers.CharField(source='quiz.title', read_only=True)
    pass_percentage = serializers.IntegerField(source='quiz.pass_percentage', read_only=True)

    class Meta:
        model = QuizAttempt
        fields = ('id', 'quiz_id', 'quiz_title', 'score', 'total_points',
                  'earned_points', 'passed', 'pass_percentage',
                  'attempt_number', 'started_at', 'completed_at')


# ─── Course Reviews ───

class CourseReviewSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    user_avatar = serializers.SerializerMethodField()
    course_title = serializers.CharField(source='course.product.name', read_only=True)

    class Meta:
        model = CourseReview
        fields = (
            'id', 'enrollment_id', 'course_id', 'course_title',
            'user_name', 'user_avatar', 'rating', 'title', 'body',
            'is_public', 'is_edited', 'seller_reply', 'seller_replied_at',
            'report_count', 'created_at', 'updated_at',
        )
        read_only_fields = (
            'enrollment_id', 'course_id', 'course_title',
            'is_edited', 'seller_replied_at', 'report_count',
        )

    def get_user_name(self, obj):
        name = obj.enrollment.user.first_name
        if name:
            return name
        email = obj.enrollment.user.email
        return email.split('@')[0] if '@' in email else email

    def get_user_avatar(self, obj):
        user = obj.enrollment.user
        if hasattr(user, 'avatar') and user.avatar:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(user.avatar.url)
            return user.avatar.url
        return None


class CourseReviewCreateSerializer(serializers.ModelSerializer):
    """Serializer para criação de review — enrollment_id vem do body."""
    enrollment_id = serializers.UUIDField(write_only=True)

    class Meta:
        model = CourseReview
        fields = ('enrollment_id', 'rating', 'title', 'body', 'is_public')
        extra_kwargs = {
            'rating': {'required': True, 'min_value': 1, 'max_value': 5},
            'body': {'required': True},
        }

    def validate_enrollment_id(self, value):
        """Garante que o enrollment pertence ao user autenticado."""
        user = self.context['request'].user
        try:
            enrollment = Enrollment.objects.get(id=value, user=user)
        except Enrollment.DoesNotExist:
            raise serializers.ValidationError('Matrícula não encontrada ou não pertence a este utilizador.')
        return enrollment

    def create(self, validated_data):
        enrollment = validated_data.pop('enrollment_id')
        validated_data['enrollment'] = enrollment
        validated_data['course'] = enrollment.course
        return super().create(validated_data)


class CourseReviewUpdateSerializer(serializers.ModelSerializer):
    """Serializer para editar a própria review (aluno) ou responder (instrutor)."""

    class Meta:
        model = CourseReview
        fields = ('rating', 'title', 'body', 'is_public')


class SellerReplySerializer(serializers.ModelSerializer):
    """Serializer para o instrutor responder a uma review."""

    class Meta:
        model = CourseReview
        fields = ('seller_reply',)
