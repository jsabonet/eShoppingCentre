from rest_framework import serializers
from .models import Course, CourseModule, CourseLesson, Enrollment, LessonProgress


class CourseLessonSerializer(serializers.ModelSerializer):
    completed = serializers.SerializerMethodField()
    duration = serializers.SerializerMethodField()
    watched_duration = serializers.SerializerMethodField()

    class Meta:
        model = CourseLesson
        fields = ('id', 'title', 'description', 'duration', 'is_free_preview',
                  'completed', 'watched_duration', 'sort_order', 'video_url', 'video_provider',
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


class CourseModuleSerializer(serializers.ModelSerializer):
    lessons = CourseLessonSerializer(many=True, read_only=True)

    class Meta:
        model = CourseModule
        fields = ('id', 'title', 'description', 'sort_order', 'lessons')


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
