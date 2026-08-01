from rest_framework import permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import CourseLesson, Enrollment
from .services.cloudflare_stream import (
    create_direct_upload,
    get_video_status,
    delete_video,
    generate_stream_token,
    get_stream_url,
)


class LessonUploadURLCreateView(APIView):
    """
    POST /api/v1/courses/lessons/{lesson_id}/upload-url/
    Obtem um URL de upload directo do Cloudflare Stream.
    So o dono do curso pode aceder.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, lesson_id):
        lesson = get_object_or_404(CourseLesson, id=lesson_id)

        # Verificar que o request.user e o dono da loja do curso
        course = lesson.module.course
        if course.product.store.owner != request.user:
            return Response({'detail': 'Nao autorizado.'}, status=403)

        try:
            upload_data = create_direct_upload()

            # Actualizar a aula com o video_uid
            lesson.cloudflare_video_uid = upload_data['video_uid']
            lesson.cloudflare_video_status = 'uploading'
            lesson.video_provider = 'cloudflare'
            lesson.save()

            return Response({
                'upload_url': upload_data['upload_url'],
                'video_uid': upload_data['video_uid'],
            })
        except Exception as e:
            return Response({'detail': str(e)}, status=500)


class LessonVideoStatusView(APIView):
    """
    GET /api/v1/courses/lessons/{lesson_id}/video-status/
    Verifica o estado do video (pending, processing, ready, error).
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, lesson_id):
        lesson = get_object_or_404(CourseLesson, id=lesson_id)

        course = lesson.module.course
        if course.product.store.owner != request.user:
            return Response({'detail': 'Nao autorizado.'}, status=403)

        if not lesson.cloudflare_video_uid:
            return Response({'status': 'pending', 'ready_to_stream': False})

        try:
            status_data = get_video_status(lesson.cloudflare_video_uid)

            # Actualizar estado local
            if status_data['ready_to_stream'] and lesson.cloudflare_video_status != 'ready':
                lesson.cloudflare_video_status = 'ready'
                lesson.video_duration_seconds = status_data.get('duration', 0)
                lesson.video_thumbnail = status_data.get('thumbnail', '')
                lesson.save()
            elif status_data['status'] == 'error':
                lesson.cloudflare_video_status = 'error'
                lesson.save()

            return Response(status_data)
        except Exception as e:
            return Response({'detail': str(e)}, status=500)


class LessonStreamTokenView(APIView):
    """
    POST /api/v1/courses/lessons/{lesson_id}/stream-token/
    Gera token JWT para o player. So alunos matriculados podem aceder.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, lesson_id):
        lesson = get_object_or_404(CourseLesson, id=lesson_id)

        course = lesson.module.course

        # Aulas gratis: qualquer pessoa autenticada pode ver
        if lesson.is_free_preview:
            pass
        else:
            # Verificar matricula
            has_access = Enrollment.objects.filter(
                user=request.user,
                course=course,
                completed=False,
            ).exists()
            if not has_access:
                return Response({'detail': 'Nao esta matriculado neste curso.'}, status=403)

        if not lesson.cloudflare_video_uid:
            return Response({'detail': 'Video ainda nao disponivel.'}, status=404)

        token = generate_stream_token(lesson.cloudflare_video_uid)
        stream_url = get_stream_url(lesson.cloudflare_video_uid)

        return Response({
            'token': token,
            'stream_url': stream_url,
            'video_uid': lesson.cloudflare_video_uid,
        })


class CloudflareWebhookView(APIView):
    """
    POST /api/v1/courses/webhooks/cloudflare/
    Cloudflare envia notificacao quando o video termina de processar.
    """
    permission_classes = []  # Validado por assinatura secreta

    def post(self, request):
        # Validar assinatura do webhook
        signature = request.headers.get('Webhook-Signature')
        if not self._verify_signature(request.body, signature):
            return Response({'detail': 'Assinatura invalida.'}, status=403)

        payload = request.data
        video_uid = payload.get('uid')
        state = payload.get('status', {}).get('state')

        if video_uid and state == 'ready':
            try:
                lesson = CourseLesson.objects.get(cloudflare_video_uid=video_uid)
                lesson.cloudflare_video_status = 'ready'
                lesson.video_duration_seconds = payload.get('duration', 0)
                lesson.video_thumbnail = payload.get('thumbnail', '')
                lesson.save()
            except CourseLesson.DoesNotExist:
                pass

        return Response({'ok': True})

    def _verify_signature(self, body, signature):
        import hmac
        import hashlib
        from django.conf import settings
        secret = getattr(settings, 'CLOUDFLARE_STREAM_SIGNING_SECRET', '')
        if not secret:
            return True  # Skip verification if not configured
        expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, signature or '')
