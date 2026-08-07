from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path('django-admin/', admin.site.urls),
    path('api/v1/auth/', include('apps.users.urls_auth')),
    path('api/v1/users/', include('apps.users.urls')),
    path('api/v1/stores/', include('apps.stores.urls')),
    path('api/v1/products/', include('apps.products.urls')),
    path('api/v1/categories/', include('apps.products.urls_categories')),
    path('api/v1/orders/', include('apps.orders.urls')),
    path('api/v1/payments/', include('apps.payments.urls')),
    path('api/v1/affiliates/', include('apps.affiliates.urls')),
    path('api/v1/wallet/', include('apps.wallet.urls')),
    path('api/v1/courses/', include('apps.courses.urls')),
    path('api/v1/blog/', include('apps.blog.urls')),
    path('api/v1/reviews/', include('apps.reviews.urls')),
    path('api/v1/chat/', include('apps.chat.urls')),
    path('api/v1/admin/', include('apps.users.urls_admin')),
    path('api/v1/admin/categories/', include('apps.products.urls_admin')),
    path('api/v1/admin/blog/', include('apps.blog.urls_admin')),
    path('api/v1/admin/courses/', include('apps.courses.urls_admin')),
    path('api/v1/admin/chat/', include('apps.chat.urls_admin')),
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='docs'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
