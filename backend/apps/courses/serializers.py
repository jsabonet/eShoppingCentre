from rest_framework import serializers
from django.db.models import Sum
from .models import (
    Course, CourseModule, CourseLesson, Enrollment, LessonProgress,
    Quiz, Question, AnswerOption, QuizAttempt, QuizAnswer,
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
        fields = ('id', 'title', 'description', 'sort_order', 'lessons', 'quizzes')


class CourseModuleWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = CourseModule
        fields = ('id', 'title', 'description', 'sort_order')


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
    price = serializers.DecimalField(source='product.price', max_digits=12, decimal_places=2, read_only=True)
    compare_price = serializers.DecimalField(source='product.compare_price', max_digits=12, decimal_places=2, read_only=True)
    image = serializers.SerializerMethodField()
    rating = serializers.DecimalField(source='product.rating', max_digits=3, decimal_places=2, read_only=True)
    students_count = serializers.SerializerMethodField()
    instructor_name = serializers.CharField(source='instructor.first_name', read_only=True)

    class Meta:
        model = Course
        fields = ('id', 'slug', 'title', 'instructor_name', 'level', 'duration',
                  'total_lessons', 'image', 'price', 'compare_price', 'rating',
                  'students_count', 'access_duration_days')

    def get_image(self, obj):
        img = obj.product.images.filter(is_primary=True).first()
        if img:
            request = self.context.get('request')
            return request.build_absolute_uri(img.image.url) if request else img.image.url
        return None

    def get_students_count(self, obj):
        return obj.enrollments.count()


class CourseDetailSerializer(serializers.ModelSerializer):
    title = serializers.CharField(source='product.name', read_only=True)
    description = serializers.CharField(source='product.description', read_only=True)
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
    total_lessons = serializers.IntegerField(source='course.total_lessons', read_only=True)
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


# ─── Quizzes / Avaliações ───

class AnswerOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnswerOption
        fields = ('id', 'text', 'is_correct', 'sort_order')


class AnswerOptionWriteSerializer(serializers.ModelSerializer):
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
                    AnswerOption.objects.create(question=instance, **opt_data)
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
