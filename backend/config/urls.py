from django.contrib import admin
from django.urls import path
from trips.views import ping

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/ping/', ping),
]