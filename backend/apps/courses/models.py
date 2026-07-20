from django.db import models
from apps.core.models import BaseModel


class Course(BaseModel):
    product = models.OneToOneField('products.Product', on_delete=models.CASCADE, related_name='course')
    instructor = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='courses_teaching')
    level = models.CharField(max_length=50, default='beginner')
    duration = models.CharField(max_length=50)
    total_lessons = models.PositiveIntegerField(default=0)
    certificate_enabled = models.BooleanField(default=True)
    preview_video_url = models.URLField(blank=True)

    def __str__(self):
        return self.product.name


class CourseModule(BaseModel):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='modules')
    title = models.CharField(max_length=500)
    description = models.TextField(blank=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['sort_order']

    def __str__(self):
        return f'{self.course.product.name} - {self.title}'


class CourseLesson(BaseModel):
    module = models.ForeignKey(CourseModule, on_delete=models.CASCADE, related_name='lessons')
    title = models.CharField(max_length=500)
    description = models.TextField(blank=True)
    video_url = models.URLField()
    video_provider = models.CharField(max_length=50, default='vimeo')
    duration = models.CharField(max_length=20)
    content = models.TextField(blank=True)
    is_free_preview = models.BooleanField(default=False)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['sort_order']

    def __str__(self):
        return self.title


class Enrollment(BaseModel):
    user = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='enrollments')
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='enrollments')
    order = models.ForeignKey('orders.Order', on_delete=models.SET_NULL, null=True)
    progress = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = [['user', 'course']]

    def __str__(self):
        return f'{self.user.email} - {self.course.product.name}'


class LessonProgress(BaseModel):
    enrollment = models.ForeignKey(Enrollment, on_delete=models.CASCADE, related_name='lesson_progress')
    lesson = models.ForeignKey(CourseLesson, on_delete=models.CASCADE)
    completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)
    watched_duration = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = [['enrollment', 'lesson']]
