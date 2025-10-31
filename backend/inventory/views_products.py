from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from django.db import IntegrityError

from .serializers import ProductoSerializer
from .services import registrar_producto, obtener_productos, recalcular_productos

class ProductoListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        productos = obtener_productos()
        ser = ProductoSerializer(productos, many=True)
        return Response(ser.data, status=status.HTTP_200_OK)

    def post(self, request):
        ser = ProductoSerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
        try:
            producto = registrar_producto(ser.validated_data)
        except IntegrityError:
            return Response({"codigo": ["El código ya existe."]}, status=400)
        return Response(ProductoSerializer(producto).data, status=status.HTTP_201_CREATED)

class RecalcularProductosView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        res = recalcular_productos()
        return Response(res, status=status.HTTP_200_OK)
