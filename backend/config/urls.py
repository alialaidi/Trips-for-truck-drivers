from django.contrib import admin
from django.urls import path
from trips.views import ping, plan, places

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/ping/', ping),
    path('api/plan/',plan),
    path('api/places/', places),
]