"""Encontra (e opcionalmente limpa) referências a ficheiros de media em falta.

Uso:
    python manage.py find_missing_media          # apenas listar
    python manage.py find_missing_media --fix    # listar e limpar

Útil quando o browser reporta 404 para imagens/ficheiros que estão referenciados
na base de dados mas não existem no storage (local, S3, Spaces...).
"""
from django.apps import apps
from django.core.management.base import BaseCommand
from django.db.models.fields.files import FileField


class Command(BaseCommand):
    help = 'Encontra referências a ficheiros de media que não existem no storage.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--fix',
            action='store_true',
            help='Limpa (apaga) as referências em falta.',
        )

    def handle(self, *args, **options):
        fix = options['fix']
        total_missing = 0

        for model in apps.get_models():
            for field in model._meta.get_fields():
                if not isinstance(field, FileField):
                    continue
                for obj in model.objects.all().iterator():
                    f = getattr(obj, field.name)
                    if not f or not f.name:
                        continue
                    try:
                        exists = field.storage.exists(f.name)
                    except Exception:
                        exists = False
                    if not exists:
                        total_missing += 1
                        label = f'{model._meta.label}.{field.name}'
                        self.stdout.write(f'  ✗ {label}: {f.name} (id={obj.pk})')
                        if fix:
                            setattr(obj, field.name, '')
                            obj.save(update_fields=[field.name])

        if total_missing == 0:
            self.stdout.write(self.style.SUCCESS('Nenhum ficheiro de media em falta.'))
        elif fix:
            self.stdout.write(self.style.SUCCESS(f'{total_missing} referência(s) removida(s).'))
        else:
            self.stdout.write(
                self.style.WARNING(
                    f'{total_missing} ficheiro(s) em falta. '
                    'Use --fix para limpar as referências.'
                )
            )
