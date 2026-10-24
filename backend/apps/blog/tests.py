import base64
import shutil
import tempfile
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.users.models import User

from .models import (
    META_DESCRIPTION_MAX,
    BlogComment,
    BlogInlineImage,
    BlogLike,
    BlogPost,
    NewsletterSubscription,
)


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


class BlogSeoFieldTests(TestCase):
    """Campos de SEO e de créditos da imagem de destaque."""

    def create_post(self, slug='artigo-seo', **overrides):
        fields = {
            'slug': slug,
            'title': 'Título original do artigo',
            'excerpt': 'Resumo curto do artigo para os leitores.',
            'content': '<p>Corpo do artigo.</p>',
            'author_name': 'Equipa',
            'category': 'Tecnologia',
            'is_published': True,
        }
        fields.update(overrides)
        return BlogPost.objects.create(**fields)

    def test_seo_falls_back_to_article_fields(self):
        post = self.create_post()

        self.assertEqual(post.seo_title, 'Título original do artigo')
        self.assertEqual(post.seo_description, 'Resumo curto do artigo para os leitores.')
        self.assertEqual(post.seo_og_title, 'Título original do artigo')

    def test_seo_prefers_explicit_values(self):
        post = self.create_post(
            meta_title='Título SEO personalizado',
            meta_description='Descrição definida manualmente.',
            og_title='Título de partilha',
            og_description='Descrição de partilha.',
        )

        self.assertEqual(post.seo_title, 'Título SEO personalizado')
        self.assertEqual(post.seo_description, 'Descrição definida manualmente.')
        self.assertEqual(post.seo_og_title, 'Título de partilha')
        self.assertEqual(post.seo_og_description, 'Descrição de partilha.')

    def test_robots_defaults_to_index_and_follow(self):
        post = self.create_post()

        self.assertEqual(post.seo_robots, 'index,follow')

    def test_robots_respects_noindex_and_nofollow(self):
        post = self.create_post(noindex=True, nofollow=True)

        self.assertEqual(post.seo_robots, 'noindex,nofollow')

    def test_meta_description_strips_markup_and_limits_length(self):
        post = self.create_post(excerpt='<strong>Texto</strong> com marcação ' + 'palavra ' * 60)
        description = post.seo_description

        self.assertNotIn('<', description)
        self.assertLessEqual(len(description), META_DESCRIPTION_MAX)

    def test_admin_can_store_seo_and_credit_fields(self):
        admin = User.objects.create_superuser(
            email='seo-admin@test.local', username='seoadmin', password='TestPass123!'
        )
        client = APIClient()
        client.force_authenticate(user=admin)

        response = client.post(
            '/api/v1/admin/blog/',
            {
                'title': 'Artigo com SEO',
                'excerpt': 'Resumo',
                'content': '<p>Conteúdo</p>',
                'category': 'Tecnologia',
                'author_name': 'Equipa',
                'is_published': True,
                'meta_title': 'Artigo com SEO otimizado',
                'meta_description': 'Descrição otimizada.',
                'canonical_url': 'https://exemplo.com/blog/artigo-com-seo',
                'focus_keyword': 'seo',
                'noindex': True,
                'nofollow': True,
                'og_title': 'Partilha SEO',
                'og_description': 'Descrição de partilha.',
                'twitter_card': 'summary',
                'image_caption': 'Fachada do centro comercial',
                'image_credit': 'Fotografia de Ana Silva',
                'image_source_url': 'https://exemplo.com/licenca',
            },
            format='multipart',
        )

        self.assertEqual(response.status_code, 201, response.data)
        post = BlogPost.objects.get(slug=response.data['slug'])
        self.assertEqual(post.meta_title, 'Artigo com SEO otimizado')
        self.assertEqual(post.canonical_url, 'https://exemplo.com/blog/artigo-com-seo')
        self.assertTrue(post.noindex)
        self.assertEqual(post.twitter_card, 'summary')
        self.assertEqual(post.image_credit, 'Fotografia de Ana Silva')
        self.assertEqual(response.data['seo']['robots'], 'noindex,nofollow')
        self.assertEqual(response.data['seo']['title'], 'Artigo com SEO otimizado')

    def test_admin_can_store_cover_image_url_and_public_api_uses_it(self):
        admin = User.objects.create_superuser(
            email='cover-url-admin@test.local', username='coverurladmin', password='TestPass123!'
        )
        client = APIClient()
        client.force_authenticate(user=admin)
        image_url = 'https://images.example.test/blog/capa.jpg'

        response = client.post(
            '/api/v1/admin/blog/',
            {
                'title': 'Artigo com capa remota',
                'excerpt': 'Resumo',
                'content': '<p>Conteúdo</p>',
                'category': 'Tecnologia',
                'author_name': 'Equipa',
                'is_published': True,
                'image_url': image_url,
            },
            format='multipart',
        )

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['image_url'], image_url)
        self.assertEqual(response.data['image'], image_url)

        public_response = self.client.get(f"/api/v1/blog/{response.data['slug']}/")
        self.assertEqual(public_response.status_code, 200)
        self.assertEqual(public_response.data['image'], image_url)

    def test_cover_image_url_requires_http_or_https_without_credentials(self):
        admin = User.objects.create_superuser(
            email='cover-url-validation@test.local', username='coverurlvalidation', password='TestPass123!'
        )
        client = APIClient()
        client.force_authenticate(user=admin)
        payload = {
            'title': 'Artigo com URL inválida',
            'excerpt': 'Resumo',
            'content': '<p>Conteúdo</p>',
            'category': 'Tecnologia',
            'author_name': 'Equipa',
            'image_url': 'javascript:alert(1)',
        }

        response = client.post('/api/v1/admin/blog/', payload, format='multipart')

        self.assertEqual(response.status_code, 400)
        self.assertIn('image_url', response.data)


class BlogEngagementTests(TestCase):
    """Comentários, gostos e newsletter."""

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(
            email='engagement-admin@test.local', username='engagementadmin', password='TestPass123!'
        )
        self.buyer = User.objects.create_user(
            email='engagement-buyer@test.local', username='engagementbuyer', password='TestPass123!'
        )
        self.post = BlogPost.objects.create(
            slug='artigo-engajamento',
            title='Artigo de engajamento',
            excerpt='Resumo',
            content='<p>Conteúdo do artigo.</p>',
            author_name='Equipa',
            category='Tecnologia',
            is_published=True,
        )

    def test_anonymous_can_list_approved_comments(self):
        BlogComment.objects.create(
            post=self.post, author=self.buyer, author_name='buyer', content='Primeiro', status='approved'
        )
        BlogComment.objects.create(
            post=self.post, author=self.buyer, author_name='buyer', content='Pendente', status='pending'
        )

        response = self.client.get(f'/api/v1/blog/{self.post.slug}/comments/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['content'], 'Primeiro')

    def test_authenticated_user_creates_pending_comment(self):
        self.client.force_authenticate(user=self.buyer)
        response = self.client.post(
            f'/api/v1/blog/{self.post.slug}/comments/', {'content': 'Comentário novo'}, format='json'
        )

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['status'], 'pending')
        comment = BlogComment.objects.get(id=response.data['id'])
        self.assertEqual(comment.author, self.buyer)
        self.assertEqual(comment.author_name, 'engagementbuyer')

    def test_anonymous_cannot_create_comment(self):
        response = self.client.post(
            f'/api/v1/blog/{self.post.slug}/comments/', {'content': 'Sem sessão'}, format='json'
        )

        self.assertIn(response.status_code, (401, 403))

    def test_like_toggle(self):
        self.client.force_authenticate(user=self.buyer)

        initial = self.client.get(f'/api/v1/blog/{self.post.slug}/like/')
        self.assertEqual(initial.status_code, 200)
        self.assertFalse(initial.data['liked'])
        self.assertEqual(initial.data['likes_count'], 0)

        first = self.client.post(f'/api/v1/blog/{self.post.slug}/like/')
        self.assertEqual(first.status_code, 200)
        self.assertTrue(first.data['liked'])
        self.assertEqual(first.data['likes_count'], 1)

        current = self.client.get(f'/api/v1/blog/{self.post.slug}/like/')
        self.assertTrue(current.data['liked'])

        second = self.client.post(f'/api/v1/blog/{self.post.slug}/like/')
        self.assertEqual(second.status_code, 200)
        self.assertFalse(second.data['liked'])
        self.assertEqual(second.data['likes_count'], 0)

    def test_anonymous_can_read_like_count_but_not_user_state(self):
        BlogLike.objects.create(post=self.post, user=self.buyer)

        response = self.client.get(f'/api/v1/blog/{self.post.slug}/like/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, {'liked': False, 'likes_count': 1})

    def test_anonymous_cannot_like(self):
        response = self.client.post(f'/api/v1/blog/{self.post.slug}/like/')

        self.assertIn(response.status_code, (401, 403))

    def test_admin_moderates_comment(self):
        comment = BlogComment.objects.create(
            post=self.post, author=self.buyer, author_name='buyer', content='A moderar', status='pending'
        )
        self.client.force_authenticate(user=self.admin)

        approve = self.client.patch(f'/api/v1/admin/blog/comments/{comment.id}/', {'status': 'approved'}, format='json')
        self.assertEqual(approve.status_code, 200)
        comment.refresh_from_db()
        self.assertEqual(comment.status, 'approved')

    def test_admin_bulk_rejects_comments(self):
        BlogComment.objects.create(post=self.post, author=self.buyer, content='A', status='pending')
        BlogComment.objects.create(post=self.post, author=self.buyer, content='B', status='pending')
        self.client.force_authenticate(user=self.admin)

        response = self.client.post(
            '/api/v1/admin/blog/comments/bulk/',
            {'action': 'reject', 'ids': list(BlogComment.objects.values_list('id', flat=True))},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['updated'], 2)
        self.assertEqual(BlogComment.objects.filter(status='rejected').count(), 2)

    @patch('apps.notifications.email_service.dispatch')
    def test_newsletter_subscribe_and_unsubscribe(self, dispatch):
        subscribe = self.client.post(
            '/api/v1/newsletter/subscribe/',
            {'email': 'Leitor@Exemplo.com', 'consent': True, 'source': 'blog'},
            format='json',
        )
        self.assertEqual(subscribe.status_code, 200, subscribe.data)
        self.assertIn('detail', subscribe.data)
        self.assertEqual(dispatch.call_count, 1)
        subscription = NewsletterSubscription.objects.get()
        self.assertEqual(subscription.email, 'leitor@exemplo.com')
        self.assertIsNotNone(subscription.consented_at)
        self.assertTrue(subscription.unsubscribe_token)

        resubscribe = self.client.post(
            '/api/v1/newsletter/subscribe/',
            {'email': 'leitor@exemplo.com', 'consent': True},
            format='json',
        )
        self.assertEqual(resubscribe.status_code, 200)
        self.assertEqual(NewsletterSubscription.objects.count(), 1)
        self.assertEqual(dispatch.call_count, 1)

        unsubscribe = self.client.post(
            '/api/v1/newsletter/unsubscribe/',
            {'token': str(subscription.unsubscribe_token)},
            format='json',
        )
        self.assertEqual(unsubscribe.status_code, 200)
        self.assertFalse(subscription.__class__.objects.get().is_active)

    def test_newsletter_requires_explicit_consent(self):
        response = self.client.post(
            '/api/v1/newsletter/subscribe/',
            {'email': 'leitor@exemplo.com'},
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('consent', response.data)
        self.assertFalse(NewsletterSubscription.objects.exists())

    def test_newsletter_rejects_non_string_email(self):
        response = self.client.post(
            '/api/v1/newsletter/subscribe/',
            {'email': ['reader@example.com'], 'consent': True},
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('email', response.data)

    @patch('apps.notifications.email_service.dispatch')
    def test_resubscribing_after_unsubscribe_rotates_token_and_records_consent(self, dispatch):
        subscription = NewsletterSubscription.objects.create(
            email='retorno@exemplo.com',
            is_active=False,
        )
        previous_token = subscription.unsubscribe_token

        response = self.client.post(
            '/api/v1/newsletter/subscribe/',
            {'email': subscription.email, 'consent': True},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        subscription.refresh_from_db()
        self.assertTrue(subscription.is_active)
        self.assertNotEqual(subscription.unsubscribe_token, previous_token)
        self.assertIsNotNone(subscription.consented_at)
        dispatch.assert_called_once()

    def test_invalid_unsubscribe_token_does_not_cancel_subscription(self):
        subscription = NewsletterSubscription.objects.create(email='ativo@exemplo.com')

        response = self.client.post(
            '/api/v1/newsletter/unsubscribe/',
            {'token': 'token-inválido'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        subscription.refresh_from_db()
        self.assertTrue(subscription.is_active)

    def test_newsletter_admin_list_is_restricted_and_can_delete_subscriber(self):
        subscription = NewsletterSubscription.objects.create(email='admin-list@example.com')

        anonymous = self.client.get('/api/v1/admin/blog/newsletter/')
        self.assertIn(anonymous.status_code, (401, 403))

        self.client.force_authenticate(user=self.admin)
        listing = self.client.get('/api/v1/admin/blog/newsletter/')
        self.assertEqual(listing.status_code, 200)
        self.assertEqual(listing.data['results'][0]['email'], subscription.email)

        deletion = self.client.delete(f'/api/v1/admin/blog/newsletter/{subscription.id}/')
        self.assertEqual(deletion.status_code, 204)
        self.assertFalse(NewsletterSubscription.objects.filter(id=subscription.id).exists())


class AdminBlogImageUploadTests(TestCase):
    """Upload de imagens locais para o corpo dos artigos."""

    PNG_1PX = base64.b64decode(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
    )

    def setUp(self):
        self.client = APIClient()
        self.media_dir = tempfile.mkdtemp(prefix='blog-media-tests-')
        self.addCleanup(shutil.rmtree, self.media_dir, True)
        self.settings_override = override_settings(MEDIA_ROOT=self.media_dir)
        self.settings_override.enable()
        self.addCleanup(self.settings_override.disable)

        self.admin = User.objects.create_superuser(
            email='blog-admin@test.local',
            username='blogadmin',
            password='TestPass123!',
        )
        self.buyer = User.objects.create_user(
            email='blog-buyer@test.local',
            username='blogbuyer',
            password='TestPass123!',
        )

    def upload_as(self, user, name='foto.png', content=None, content_type='image/png'):
        self.client.force_authenticate(user=user)
        upload = SimpleUploadedFile(name, content if content is not None else self.PNG_1PX, content_type=content_type)
        return self.client.post('/api/v1/admin/blog/images/', {'image': upload}, format='multipart')

    def test_admin_uploads_local_image(self):
        response = self.upload_as(self.admin)

        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data['url'].startswith('http'))
        self.assertIn('/media/blog/inline/', response.data['url'])
        self.assertEqual(response.data['name'], 'foto.png')
        self.assertEqual(BlogInlineImage.objects.count(), 1)
        stored = BlogInlineImage.objects.get()
        self.assertEqual(stored.uploaded_by, self.admin)

    def test_non_admin_cannot_upload(self):
        response = self.upload_as(self.buyer)

        self.assertEqual(response.status_code, 403)
        self.assertEqual(BlogInlineImage.objects.count(), 0)

    def test_anonymous_cannot_upload(self):
        upload = SimpleUploadedFile('foto.png', self.PNG_1PX, content_type='image/png')
        response = self.client.post('/api/v1/admin/blog/images/', {'image': upload}, format='multipart')

        self.assertIn(response.status_code, (401, 403))

    def test_rejects_non_image_file(self):
        response = self.upload_as(self.admin, name='nota.txt', content=b'nao sou imagem', content_type='text/plain')

        self.assertEqual(response.status_code, 400)
        self.assertIn('image', response.data)
        self.assertEqual(BlogInlineImage.objects.count(), 0)
    def test_rejects_image_above_size_limit(self):
        with patch('apps.blog.serializers.MAX_INLINE_IMAGE_SIZE', 10):
            response = self.upload_as(self.admin)

        self.assertEqual(response.status_code, 400)
        self.assertIn('image', response.data)
        self.assertEqual(BlogInlineImage.objects.count(), 0)
