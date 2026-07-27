"""
Comando para criar as categorias base em produção.
Uso: docker compose exec backend python manage.py seed_categories
"""
from django.core.management.base import BaseCommand
from apps.products.models import Category


class Command(BaseCommand):
    help = 'Cria as categorias base do marketplace em produção'

    CATEGORIES = [
        # (slug, nome, product_type, sort_order)
        ('eletronicos',      'Eletrónicos',         'physical', 1),
        ('moda',             'Moda',                 'physical', 2),
        ('casa-jardim',      'Casa & Jardim',        'physical', 3),
        ('esportes',         'Esportes & Lazer',     'physical', 4),
        ('livros',           'Livros & Papelaria',   'physical', 5),
        ('beleza',           'Beleza & Saúde',       'physical', 6),
        ('brinquedos-games', 'Brinquedos & Games',   'physical', 7),
        ('automotivo',       'Automotivo',           'physical', 8),
    ]

    def handle(self, *args, **options):
        created_count = 0

        for slug, name, product_type, sort_order in self.CATEGORIES:
            cat, created = Category.objects.update_or_create(
                slug=slug,
                defaults={
                    'name': name,
                    'product_type': product_type,
                    'is_active': True,
                    'sort_order': sort_order,
                }
            )
            status = '✓ CRIADA' if created else '  já existia'
            self.stdout.write(f'  [{status}]  {slug:20s} → {name}')
            if created:
                created_count += 1

        total = Category.objects.filter(is_active=True).count()
        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(
            f'✅ {created_count} categorias criadas. Total activas: {total}'
        ))
