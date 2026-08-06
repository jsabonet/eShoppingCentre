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
    access_duration_days = models.PositiveIntegerField(null=True, blank=True,
        help_text='Dias de acesso apos matricula. Null = acesso vitalicio.')

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
    sort_order = models.PositiveIntegerField(default=0)
    is_free_preview = models.BooleanField(default=False)

    # --- Cloudflare Stream ---
    video_provider = models.CharField(max_length=20, default='cloudflare',
                                      choices=[('cloudflare', 'Cloudflare Stream'), ('vimeo', 'Vimeo'), ('youtube', 'YouTube')])
    cloudflare_video_uid = models.CharField(max_length=100, blank=True,
                                            help_text='UID do video no Cloudflare Stream')
    cloudflare_video_status = models.CharField(max_length=20, default='pending',
                                               choices=[
                                                   ('pending', 'Aguardando Upload'),
                                                   ('uploading', 'A Enviar'),
                                                   ('processing', 'A Processar'),
                                                   ('ready', 'Pronto'),
                                                   ('error', 'Erro'),
                                               ])
    video_duration_seconds = models.PositiveIntegerField(default=0, help_text='Duracao em segundos')
    video_thumbnail = models.URLField(blank=True)
    video_url = models.URLField(blank=True, help_text='URL publica do video (legado: Vimeo/YouTube)')
    # --- Fim Cloudflare ---

    content = models.TextField(blank=True)
    watched_duration = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['sort_order']

    def __str__(self):
        return self.title


class LessonAttachment(BaseModel):
    lesson = models.ForeignKey(CourseLesson, on_delete=models.CASCADE, related_name='attachments')
    title = models.CharField(max_length=300)
    file = models.FileField(upload_to='courses/attachments/%Y/%m/')
    file_size = models.PositiveIntegerField(default=0, help_text='Tamanho em bytes')
    file_type = models.CharField(max_length=100, blank=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['sort_order']

    def __str__(self):
        return f'{self.lesson.title} - {self.title}'

    def save(self, *args, **kwargs):
        if self.file and not self.file_size:
            try:
                self.file_size = self.file.size
            except Exception:
                pass
        if self.file and not self.file_type:
            self.file_type = self.file.name.rsplit('.', 1)[-1].lower() if '.' in self.file.name else ''
        super().save(*args, **kwargs)


class Enrollment(BaseModel):
    user = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='enrollments')
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='enrollments')
    order = models.ForeignKey('orders.Order', on_delete=models.SET_NULL, null=True)
    progress = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)
    access_expires_at = models.DateTimeField(null=True, blank=True,
        help_text='Data de expiracao do acesso. Null = vitalicio.')

    class Meta:
        unique_together = [['user', 'course']]

    @property
    def has_access(self):
        if self.access_expires_at is None:
            return True
        from django.utils import timezone
        return timezone.now() < self.access_expires_at

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
