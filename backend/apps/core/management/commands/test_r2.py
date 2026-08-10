"""
Comando Django para testar conectividade com Cloudflare R2.

Uso:
    python manage.py test_r2
    
Este comando:
1. Lê as credenciais R2 do .env
2. Conecta ao bucket via boto3
3. Escreve um ficheiro de teste
4. Lê o ficheiro de volta
5. Remove o ficheiro de teste
6. Reporta sucesso ou falha

⚠️ Não altera nenhuma configuração do Django — usa boto3 directamente.
⚠️ Não afecta o storage existente (FileSystemStorage).
"""

import io
import uuid
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Testa conectividade com Cloudflare R2 (escrita + leitura + remocao)'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('=' * 60))
        self.stdout.write(self.style.SUCCESS('  TESTE DE CONECTIVIDADE — CLOUDFLARE R2'))
        self.stdout.write(self.style.SUCCESS('=' * 60))
        self.stdout.write('')

        # ─── Passo 1: Verificar credenciais ───
        from decouple import config as decouple_config

        access_key = decouple_config('AWS_ACCESS_KEY_ID', default='')
        secret_key = decouple_config('AWS_SECRET_ACCESS_KEY', default='')
        bucket_name = decouple_config('AWS_STORAGE_BUCKET_NAME', default='')
        region = decouple_config('AWS_S3_REGION_NAME', default='auto')
        endpoint = decouple_config('AWS_S3_ENDPOINT_URL', default='')

        if not all([access_key, secret_key, bucket_name, endpoint]):
            self.stdout.write(self.style.ERROR('❌ Credenciais R2 em falta no .env:'))
            self.stdout.write(f'   AWS_ACCESS_KEY_ID      = {"✅" if access_key else "❌ VAZIO"}')
            self.stdout.write(f'   AWS_SECRET_ACCESS_KEY  = {"✅" if secret_key else "❌ VAZIO"}')
            self.stdout.write(f'   AWS_STORAGE_BUCKET_NAME = {"✅" if bucket_name else "❌ VAZIO"}')
            self.stdout.write(f'   AWS_S3_ENDPOINT_URL     = {"✅" if endpoint else "❌ VAZIO"}')
            self.stdout.write('')
            self.stdout.write('   Verifica o ficheiro backend/.env')
            return

        self.stdout.write(self.style.SUCCESS('✅ Credenciais encontradas:'))
        self.stdout.write(f'   Bucket:   {bucket_name}')
        self.stdout.write(f'   Endpoint: {endpoint}')
        self.stdout.write(f'   Region:   {region}')
        self.stdout.write(f'   Key ID:   {access_key[:12]}...')
        self.stdout.write('')

        # ─── Passo 2: Verificar boto3 ───
        try:
            import boto3
            from botocore.exceptions import ClientError, EndpointConnectionError
            self.stdout.write(self.style.SUCCESS('✅ boto3 disponível'))
        except ImportError:
            self.stdout.write(self.style.ERROR('❌ boto3 não instalado. Corre: pip install boto3'))
            return

        self.stdout.write('')

        # ─── Passo 3: Conectar ao R2 ───
        self.stdout.write('🔗 A conectar ao Cloudflare R2...')

        try:
            s3 = boto3.client(
                's3',
                region_name=region,
                endpoint_url=endpoint,
                aws_access_key_id=access_key,
                aws_secret_access_key=secret_key,
            )
            self.stdout.write(self.style.SUCCESS('✅ Ligação estabelecida'))
        except EndpointConnectionError as e:
            self.stdout.write(self.style.ERROR(f'❌ Falha ao conectar: {e}'))
            return
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'❌ Erro inesperado: {e}'))
            return

        self.stdout.write('')

        # ─── Passo 4: Verificar bucket ───
        self.stdout.write(f'📦 A verificar bucket "{bucket_name}"...')

        try:
            s3.head_bucket(Bucket=bucket_name)
            self.stdout.write(self.style.SUCCESS(f'✅ Bucket "{bucket_name}" existe e está acessível'))
        except ClientError as e:
            code = e.response['Error']['Code']
            if code == '404':
                self.stdout.write(self.style.ERROR(f'❌ Bucket "{bucket_name}" NÃO encontrado'))
                self.stdout.write('   Verifica se criaste o bucket no dashboard Cloudflare.')
            elif code == '403':
                self.stdout.write(self.style.ERROR(f'❌ Acesso negado ao bucket "{bucket_name}"'))
                self.stdout.write('   Verifica as permissões do API token.')
            else:
                self.stdout.write(self.style.ERROR(f'❌ Erro ao aceder ao bucket: {e}'))
            return

        self.stdout.write('')

        # ─── Passo 5: Escrever ficheiro de teste ───
        test_key = f'_test_r2_connectivity_{uuid.uuid4().hex[:8]}.txt'
        test_content = f'R2 Connectivity Test — {uuid.uuid4()}\nTimestamp: {__import__("datetime").datetime.now().isoformat()}\n'
        test_bytes = test_content.encode('utf-8')

        self.stdout.write(f'📝 A escrever ficheiro de teste: {test_key}')

        try:
            s3.put_object(
                Bucket=bucket_name,
                Key=test_key,
                Body=io.BytesIO(test_bytes),
                ContentType='text/plain',
                ContentLength=len(test_bytes),
            )
            self.stdout.write(self.style.SUCCESS(f'✅ Escrita OK — {len(test_bytes)} bytes'))
        except ClientError as e:
            self.stdout.write(self.style.ERROR(f'❌ Erro ao escrever: {e}'))
            return

        self.stdout.write('')

        # ─── Passo 6: Ler ficheiro de teste ───
        self.stdout.write(f'📖 A ler ficheiro de teste: {test_key}')

        try:
            response = s3.get_object(Bucket=bucket_name, Key=test_key)
            content = response['Body'].read().decode('utf-8')
            if content.strip() == test_content.strip():
                self.stdout.write(self.style.SUCCESS(f'✅ Leitura OK — conteúdo coincide ({len(content)} bytes)'))
            else:
                self.stdout.write(self.style.WARNING(f'⚠️  Conteúdo NÃO coincide!'))
                self.stdout.write(f'   Esperado: {test_content[:80]}')
                self.stdout.write(f'   Obtido:   {content[:80]}')
        except ClientError as e:
            self.stdout.write(self.style.ERROR(f'❌ Erro ao ler: {e}'))
            return

        self.stdout.write('')

        # ─── Passo 7: Remover ficheiro de teste ───
        self.stdout.write(f'🗑️  A remover ficheiro de teste: {test_key}')

        try:
            s3.delete_object(Bucket=bucket_name, Key=test_key)
            self.stdout.write(self.style.SUCCESS('✅ Remoção OK'))
        except ClientError as e:
            self.stdout.write(self.style.WARNING(f'⚠️  Erro ao remover (não crítico): {e}'))

        self.stdout.write('')

        # ─── Passo 8: Resumo ───
        self.stdout.write(self.style.SUCCESS('=' * 60))
        self.stdout.write(self.style.SUCCESS('  🎉 TUDO PRONTO! R2 está configurado e funcional.'))
        self.stdout.write(self.style.SUCCESS('=' * 60))
        self.stdout.write('')
        self.stdout.write('  Próximos passos:')
        self.stdout.write('  1. O storage local (FileSystemStorage) continua activo em dev')
        self.stdout.write('  2. Em produção (production.py), o S3Boto3Storage será usado')
        self.stdout.write('  3. Podes agora implementar o download digital seguro')
        self.stdout.write('')
