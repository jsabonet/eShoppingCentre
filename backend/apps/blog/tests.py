from django.test import TestCase
from rest_framework.test import APIClient

from .models import BlogPost


class PublicBlogApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def create_post(self, slug, **overrides):
        fields = {
            'slug': slug,
            'title': slug.replace('-', ' ').title(),
            'excerpt': 'Resumo do artigo',
            'content': '<p>Conteúdo de teste com várias palavras.</p>',
            'author_name': 'Equipa e-Shopping Centre',
            'category': 'Tecnologia',
            'is_published': True,
        }
        fields.update(overrides)
        return BlogPost.objects.create(**fields)

    def test_public_list_excludes_drafts(self):
        published = self.create_post('artigo-publicado')
        draft = self.create_post('artigo-rascunho', is_published=False)

        response = self.client.get('/api/v1/blog/')

        self.assertEqual(response.status_code, 200)
        post_ids = {item['id'] for item in response.data['results']}
        self.assertIn(str(published.id), post_ids)
        self.assertNotIn(str(draft.id), post_ids)

    def test_public_detail_does_not_expose_drafts(self):
        draft = self.create_post('artigo-rascunho', is_published=False)

        response = self.client.get(f'/api/v1/blog/{draft.slug}/')

        self.assertEqual(response.status_code, 404)

    def test_public_list_filters_by_search_and_category(self):
        matching = self.create_post(
            'guia-tecnologia',
            title='Guia de Tecnologia',
            category='Tecnologia',
        )
        self.create_post(
            'guia-moda',
            title='Guia de Moda',
            category='Moda',
        )

        response = self.client.get('/api/v1/blog/?search=guia&category=Tecnologia')

        self.assertEqual(response.status_code, 200)
        self.assertEqual([item['id'] for item in response.data['results']], [str(matching.id)])

    def test_new_posts_are_drafts_and_read_time_is_generated(self):
        post = self.create_post(
            'novo-rascunho',
            is_published=False,
            content='<p>' + 'palavra ' * 401 + '</p>',
        )

        self.assertFalse(post.is_published)
        self.assertIsNone(post.published_at)
        self.assertEqual(post.read_time, '3 min')

    def test_first_publication_sets_timestamp_even_with_partial_save(self):
        post = self.create_post('novo-rascunho', is_published=False)

        post.is_published = True
        post.save(update_fields=['is_published'])

        post.refresh_from_db()
        self.assertIsNotNone(post.published_at)
