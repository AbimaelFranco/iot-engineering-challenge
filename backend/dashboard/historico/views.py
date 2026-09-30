from django.shortcuts import render


def historico(request):
    context = {
        "temp_min": 18,
        "temp_max": 30,
        "hum_min": 30,
        "hum_max": 70,
    }
    return render(request, "historico.html", context)
