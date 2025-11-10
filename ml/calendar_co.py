from datetime import date

def is_carnaval(d: date) -> bool:
    # Carnaval de Negros y Blancos (Pasto): 2–7 de enero inclusive
    return d.month == 1 and 2 <= d.day <= 7
