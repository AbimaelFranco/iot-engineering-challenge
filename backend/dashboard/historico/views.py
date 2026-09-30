from django.shortcuts import render


def historico(request):
    context = {
        "temp_min": 18,
        "temp_max": 30,
        "temp_avg": 24.5,
        "temp_avg_a": 25.2,
        "temp_avg_b": 23.8,
        "hum_min": 30,
        "hum_max": 70,
        "hum_avg": 55,
        "hum_avg_a": 58,
        "hum_avg_b": 52,
    }
    return render(request, "historico.html", context)
