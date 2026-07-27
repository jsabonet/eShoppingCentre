"""
Comando para criar as categorias base em produção.
Uso: docker compose exec backend python manage.py seed_categories
"""
from django.core.management.base import BaseCommand
from apps.products.models import Category


class Command(BaseCommand):
    help = 'Cria as categorias base do marketplace em produção'

    # Categorias pai e respetivas subcategorias
    CATEGORY_TREE = {
        # (slug, nome, sort_order) → [(slug_filho, nome_filho), ...]
        ('eletronicos',      'Eletrónicos',         1): [
            ('smartphones',            'Smartphones'),
            ('laptops',                'Laptops'),
            ('laptops-computadores',   'Laptops & Computadores'),
            ('tablets',                'Tablets'),
            ('audio-fones',            'Áudio & Fones'),
            ('tv-home-theater',        'TV & Home Theater'),
            ('acessorios-tech',        'Acessórios Tech'),
        ],
        ('moda',             'Moda',                 2): [
            ('roupa-feminina',         'Roupa Feminina'),
            ('roupa-masculina',        'Roupa Masculina'),
            ('roupa-infantil',         'Roupa Infantil'),
            ('calcado',                'Calçado'),
            ('acessorios-moda',        'Acessórios'),
            ('bolsas-malas',           'Bolsas & Malas'),
        ],
        ('casa-jardim',      'Casa & Jardim',        3): [
            ('moveis',                 'Móveis'),
            ('decoracao',              'Decoração'),
            ('cozinha',                'Cozinha'),
            ('eletrodomesticos',       'Eletrodomésticos'),
            ('jardim-exterior',        'Jardim & Exterior'),
            ('ferramentas',            'Ferramentas'),
        ],
        ('esportes',         'Esportes & Lazer',     4): [
            ('fitness',                'Fitness'),
            ('fitness-musculacao',     'Fitness & Musculação'),
            ('futebol',                'Futebol'),
            ('ciclismo',               'Ciclismo'),
            ('natacao',                'Natação'),
            ('camping',                'Camping'),
            ('camping-ar-livre',       'Camping & Ar Livre'),
        ],
        ('livros',           'Livros & Papelaria',   5): [
            ('ficcao',                 'Ficção'),
            ('nao-ficcao',             'Não-Ficção'),
            ('infantil',               'Infantil'),
            ('infantil-juvenil',       'Infantil & Juvenil'),
            ('escolar',                'Escolar'),
            ('escolar-academico',      'Escolar & Académico'),
            ('papelaria',              'Papelaria'),
        ],
        ('beleza',           'Beleza & Saúde',       6): [],
        ('brinquedos-games', 'Brinquedos & Games',   7): [],
        ('automotivo',       'Automotivo',           8): [],
    }

    def handle(self, *args, **options):
        created_count = 0
        product_type = 'physical'

        for (slug, name, sort_order), children in self.CATEGORY_TREE.items():
            parent, created = Category.objects.update_or_create(
                slug=slug,
                defaults={
                    'name': name,
                    'product_type': product_type,
                    'is_active': True,
                    'sort_order': sort_order,
                    'parent': None,
                }
            )
            status = '✓ CRIADA' if created else '  já existia'
            self.stdout.write(f'  [{status}]  {slug:22s} → {name}')
            if created:
                created_count += 1

            for child_slug, child_name in children:
                child, c_created = Category.objects.update_or_create(
                    slug=child_slug,
                    defaults={
                        'name': child_name,
                        'product_type': product_type,
                        'is_active': True,
                        'sort_order': 0,
                        'parent': parent,
                    }
                )
                c_status = '✓ CRIADA' if c_created else '  já existia'
                self.stdout.write(f'         [{c_status}]  {child_slug:22s} → {child_name}')
                if c_created:
                    created_count += 1

        total = Category.objects.filter(is_active=True).count()
        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(
            f'✅ {created_count} categorias criadas. Total activas: {total}'
        ))
        self.stdout.write(self.style.WARNING(
            'Nota: categorias locais "ter", "testcat", "categoria-teste" foram ignoradas (dados de teste).'
        ))
