from django.urls import path

from . import views

urlpatterns = [
    path("", views.tiemporeal, name="tiemporeal"),
    path("api/latest/", views.tiemporeal_latest, name="tiemporeal_latest"),
]
