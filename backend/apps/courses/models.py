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


# ─── Quizzes / Avaliações ───

class Quiz(BaseModel):
    """Quiz vinculado a um módulo (e opcionalmente a uma aula específica)."""
    module = models.ForeignKey(CourseModule, on_delete=models.CASCADE, related_name='quizzes')
    lesson = models.ForeignKey(
        CourseLesson, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='quizzes',
        help_text='Opcional: vincular o quiz a uma aula específica.'
    )
    title = models.CharField(max_length=500)
    description = models.TextField(blank=True)
    pass_percentage = models.PositiveIntegerField(
        default=70,
        help_text='Percentagem mínima para aprovação (ex: 70).'
    )
    max_attempts = models.PositiveIntegerField(
        null=True, blank=True, default=3,
        help_text='Número máximo de tentativas. Null = ilimitado.'
    )
    is_required = models.BooleanField(
        default=False,
        help_text='Se True, o aluno precisa passar neste quiz para concluir o módulo.'
    )
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name_plural = 'Quizzes'
        ordering = ['sort_order']

    def __str__(self):
        return f'Quiz: {self.title}'


class Question(BaseModel):
    """Questão individual dentro de um quiz."""
    QUESTION_TYPES = (
        ('multiple_choice', 'Múltipla Escolha'),
        ('true_false', 'Verdadeiro/Falso'),
        ('open_text', 'Texto Livre'),
        ('multiple_select', 'Seleção Múltipla'),
    )

    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE, related_name='questions')
    text = models.TextField(help_text='Enunciado da questão.')
    question_type = models.CharField(max_length=20, choices=QUESTION_TYPES, default='multiple_choice')
    sort_order = models.PositiveIntegerField(default=0)
    points = models.PositiveIntegerField(default=1, help_text='Pontuação da questão.')

    class Meta:
        ordering = ['sort_order']

    def __str__(self):
        return f'Q: {self.text[:80]}'


class AnswerOption(BaseModel):
    """Opção de resposta para questões de escolha (multiple_choice, true_false, multiple_select)."""
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name='options')
    text = models.TextField()
    is_correct = models.BooleanField(default=False)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['sort_order']

    def __str__(self):
        return f'{self.text[:60]} {"✓" if self.is_correct else ""}'


class QuizAttempt(BaseModel):
    """Tentativa de resolução de um quiz por um aluno."""
    enrollment = models.ForeignKey(Enrollment, on_delete=models.CASCADE, related_name='quiz_attempts')
    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE, related_name='attempts')
    score = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    total_points = models.PositiveIntegerField(default=0)
    earned_points = models.PositiveIntegerField(default=0)
    passed = models.BooleanField(null=True, blank=True)
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    attempt_number = models.PositiveIntegerField(default=1)

    class Meta:
        unique_together = [['enrollment', 'quiz', 'attempt_number']]
        ordering = ['-attempt_number']

    def __str__(self):
        return f'{self.enrollment.user.email} — {self.quiz.title} (Tentativa #{self.attempt_number})'


class QuizAnswer(BaseModel):
    """Resposta do aluno a uma questão específica dentro de uma tentativa."""
    attempt = models.ForeignKey(QuizAttempt, on_delete=models.CASCADE, related_name='answers')
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    selected_option = models.ForeignKey(
        AnswerOption, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='quiz_answers'
    )
    selected_options = models.ManyToManyField(
        AnswerOption, blank=True,
        related_name='quiz_answers_multi',
        help_text='Opções selecionadas para questões do tipo multiple_select.'
    )
    open_text_answer = models.TextField(blank=True)
    is_correct = models.BooleanField(null=True, blank=True)

    class Meta:
        unique_together = [['attempt', 'question']]

    def __str__(self):
        return f'Resposta: {self.question.text[:50]}'


# ─── Course Reviews ───

class CourseReview(BaseModel):
    """
    Review de curso feita por um aluno.
    Permite múltiplas reviews por utilizador (sem unique_together).
    Ligada ao Enrollment para garantir que o aluno está matriculado.
    """
    enrollment = models.ForeignKey(
        Enrollment, on_delete=models.CASCADE, related_name='reviews',
        help_text='Matrícula do aluno que fez a review.'
    )
    course = models.ForeignKey(
        Course, on_delete=models.CASCADE, related_name='reviews',
        help_text='Curso avaliado (denormalizado para queries mais rápidas).'
    )
    rating = models.PositiveSmallIntegerField(
        help_text='Avaliação de 1 a 5 estrelas.'
    )
    title = models.CharField(max_length=255, blank=True, help_text='Título da review.')
    body = models.TextField(help_text='Comentário da review.')
    is_public = models.BooleanField(default=True, help_text='Se False, visível apenas para o autor.')
    is_edited = models.BooleanField(default=False, help_text='Indica se a review foi editada.')

    # Seller reply
    seller_reply = models.TextField(blank=True, help_text='Resposta do instrutor.')
    seller_replied_at = models.DateTimeField(null=True, blank=True)

    # Moderation
    report_count = models.PositiveIntegerField(default=0)
    is_hidden = models.BooleanField(default=False, help_text='Ocultado por moderação.')

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['course', '-created_at']),
            models.Index(fields=['enrollment']),
        ]

    def __str__(self):
        return f'{self.enrollment.user.email} — {self.course.product.name} ({self.rating}★)'
