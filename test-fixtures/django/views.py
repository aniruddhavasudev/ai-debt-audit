from django.views.decorators.csrf import csrf_exempt
from rest_framework.permissions import AllowAny
from .models import Document

@csrf_exempt
def upload(request):
    return None

class DocumentView:
    permission_classes = [AllowAny]

def search(request, term):
    return Document.objects.raw(f"SELECT * FROM documents WHERE title = '{term}'")
