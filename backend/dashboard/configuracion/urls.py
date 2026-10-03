from django.urls import path

from . import views

urlpatterns = [
    path("", views.configuracion, name="configuracion"),
    path("api/actualizar/", views.configuracion_actualizar, name="configuracion_actualizar"),
    path("api/ack-latest/", views.configuracion_ack_latest, name="configuracion_ack_latest"),
]
