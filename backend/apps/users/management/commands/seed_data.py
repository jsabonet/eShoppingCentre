from django.core.management.base import BaseCommand
from apps.users.models import User
from apps.stores.models import Store
from apps.products.models import Category, Product, ProductImage
from apps.courses.models import Course, CourseModule, CourseLesson
from apps.blog.models import BlogPost
from apps.wallet.models import Wallet


class Command(BaseCommand):
    help = 'Popula a BD com dados de teste para desenvolvimento'

    def handle(self, *args, **options):
        self.stdout.write('A criar dados de teste...')

        # Admin
        if not User.objects.filter(email='admin@eshopping.co.mz').exists():
            User.objects.create_superuser(
                email='admin@eshopping.co.mz', username='admin',
                password='Admin123!', roles=['admin']
            )

        # Comprador
        buyer, _ = User.objects.get_or_create(
            email='cliente@email.com', username='cliente',
            defaults={'first_name': 'João', 'last_name': 'Silva', 'roles': ['buyer']}
        )
        buyer.set_password('Cliente123!')
        buyer.save()

        # Vendedor
        seller, _ = User.objects.get_or_create(
            email='vendedor@email.com', username='vendedor',
            defaults={'first_name': 'Maria', 'last_name': 'Santos', 'roles': ['seller', 'buyer']}
        )
        seller.set_password('Vendedor123!')
        seller.save()

        # Loja
        store, _ = Store.objects.get_or_create(
            owner=seller, slug='tecnomoz',
            defaults={
                'name': 'TechnoMoz', 'description': 'Especialistas em tecnologia',
                'category': 'eletronicos', 'phone': '+258 84 123 4567',
                'email': 'info@tecnomoz.co.mz', 'location': 'Maputo',
                'status': 'active', 'total_products': 6,
            }
        )

        # Categorias
        cats = [
            ('eletronicos', 'Eletrônicos'),
            ('moda', 'Moda'),
            ('casa-jardim', 'Casa & Jardim'),
            ('esportes', 'Esportes'),
            ('livros', 'Livros & Papelaria'),
            ('beleza', 'Beleza & Saúde'),
            ('brinquedos-games', 'Brinquedos & Games'),
            ('automotivo', 'Automotivo'),
        ]
        categories = {}
        for slug, name in cats:
            cat, _ = Category.objects.get_or_create(slug=slug, defaults={'name': name})
            categories[slug] = cat

        # Produtos
        products_data = [
            ('eletronicos', 'Smartphone Pro Max 256GB', 'smartphone-pro-max', 4999.99, 5999.99),
            ('eletronicos', 'Fone Bluetooth Premium', 'fone-bluetooth-premium', 899.90, 1199.90),
            ('eletronicos', 'Laptop Ultrabook 15', 'laptop-ultrabook-15', 6499.00, 7299.00),
            ('eletronicos', 'Smartwatch Sport GPS', 'smartwatch-sport', 1299.00, None),
            ('eletronicos', 'Tablet 10 com Stylus', 'tablet-10-pol', 2199.00, 2599.00),
            ('eletronicos', 'Caixa de Som Bluetooth', 'caixa-som-bluetooth', 449.90, 599.90),
        ]
        for cat_slug, name, slug, price, compare in products_data:
            prod, created = Product.objects.get_or_create(
                store=store, slug=slug,
                defaults={
                    'name': name, 'category': categories[cat_slug],
                    'description': f'{name} - Produto de alta qualidade.',
                    'price': price, 'compare_price': compare,
                    'status': 'active', 'stock': 50,
                    'product_type': 'physical',
                }
            )
            if created:
                self.stdout.write(f'  Produto: {name}')

        # Blog
        blog_posts = [
            ('como-escolher-o-smartphone-ideal', 'Como Escolher o Smartphone Ideal em 2026',
             'Guia completo para escolher o smartphone perfeito.', 'Maria Santos', 'Tecnologia'),
            ('tendencias-moda-2026', 'Tendências de Moda para o Inverno 2026',
             'Descubra as principais tendências da estação.', 'Ana Mondlane', 'Moda'),
            ('compras-online-seguras-mocambique', 'Como Fazer Compras Online Seguras em Moçambique',
             'Dicas essenciais para compras online seguras.', 'Equipa eShoppingCentre', 'Segurança'),
        ]
        for slug, title, excerpt, author, cat in blog_posts:
            BlogPost.objects.get_or_create(
                slug=slug,
                defaults={
                    'title': title, 'excerpt': excerpt,
                    'content': f'<p>{excerpt}</p><p>Conteúdo completo do artigo sobre {title.lower()}.</p>',
                    'author_name': author, 'category': cat, 'read_time': '5 min',
                }
            )

        # Wallet
        for user in User.objects.all():
            Wallet.objects.get_or_create(user=user)

        self.stdout.write(self.style.SUCCESS('Dados de teste criados com sucesso!'))
