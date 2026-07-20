from django.db import models
from apps.core.models import BaseModel


class BlogPost(BaseModel):
    slug = models.SlugField(max_length=255, unique=True)
    title = models.CharField(max_length=500)
    excerpt = models.TextField()
    content = models.TextField()
    image = models.ImageField(upload_to='blog/', blank=True)
    author_name = models.CharField(max_length=255)
    category = models.CharField(max_length=100)
    read_time = models.CharField(max_length=20)
    is_published = models.BooleanField(default=True)
    published_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title
