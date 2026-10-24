from django.db import models
from django.utils import timezone
from django.utils.html import strip_tags
from apps.core.models import BaseModel


class BlogPost(BaseModel):
    slug = models.SlugField(max_length=255, unique=True)
    title = models.CharField(max_length=500)
    excerpt = models.TextField()
    content = models.TextField()
    image = models.ImageField(upload_to='blog/', blank=True)
    author_name = models.CharField(max_length=255)
    category = models.CharField(max_length=100)
    read_time = models.CharField(max_length=20, blank=True)
    is_published = models.BooleanField(default=False)
    published_at = models.DateTimeField(null=True, blank=True)

    def save(self, *args, **kwargs):
        word_count = len(strip_tags(self.content).split())
        self.read_time = f'{max(1, (word_count + 199) // 200)} min'
        if self.is_published and self.published_at is None:
            self.published_at = timezone.now()
            if kwargs.get('update_fields') is not None:
                kwargs['update_fields'] = set(kwargs['update_fields']) | {'published_at'}
        if kwargs.get('update_fields') is not None:
            kwargs['update_fields'] = set(kwargs['update_fields']) | {'read_time'}
        super().save(*args, **kwargs)

    def __str__(self):
        return self.title
