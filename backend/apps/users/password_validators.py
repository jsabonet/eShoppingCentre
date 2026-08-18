"""Validadores de complexidade de password."""
import re

from django.core.exceptions import ValidationError


class MixedCharacterValidator:
    """Exige letras maiúsculas, minúsculas, números e símbolos."""

    def validate(self, password, user=None):
        rules = (
            (r'[A-Z]', 'pelo menos uma letra maiúscula'),
            (r'[a-z]', 'pelo menos uma letra minúscula'),
            (r'[0-9]', 'pelo menos um número'),
            (r'[^A-Za-z0-9]', 'pelo menos um símbolo (ex.: !@#$%)'),
        )
        missing = [msg for pattern, msg in rules if not re.search(pattern, password)]
        if missing:
            raise ValidationError('A password deve conter ' + ', '.join(missing) + '.')

    def get_help_text(self):
        return 'A password deve conter letras maiúsculas, minúsculas, números e símbolos.'
