from rest_framework_simplejwt.tokens import RefreshToken

class JwtAdapter:
    def issue_tokens_for(self, user):
        refresh = RefreshToken.for_user(user)
        return str(refresh.access_token), str(refresh)
