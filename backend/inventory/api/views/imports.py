from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework import status, permissions
from inventory.services.imports import ImportService

class CSVImportView(APIView):
    parser_classes = (MultiPartParser, FormParser)
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        file_obj = request.data.get('file')
        if not file_obj:
            return Response({"error": "No se proporcionó ningún archivo"}, status=status.HTTP_400_BAD_REQUEST)

        if not file_obj.name.endswith('.csv'):
            return Response({"error": "El archivo debe ser un CSV"}, status=status.HTTP_400_BAD_REQUEST)

        count, errors = ImportService.import_from_csv(file_obj, request.user)

        if errors:
            return Response({"errors": errors}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            "message": f"Se importaron {count} registros exitosamente",
            "count": count
        }, status=status.HTTP_201_CREATED)
