def calcular_promedio(lista=[]):
    if len(lista) == 0:
        return 0
    return sum(lista) / len(lista)

print(calcular_promedio([4, 6, 8]))  
print(calcular_promedio())           