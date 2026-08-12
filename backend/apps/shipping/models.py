from django.db import models
from apps.core.models import BaseModel

# 11 províncias de Moçambique
MOZAMBIQUE_PROVINCES = [
    ('cabo_delgado', 'Cabo Delgado'),
    ('gaza', 'Gaza'),
    ('inhambane', 'Inhambane'),
    ('manica', 'Manica'),
    ('maputo_cidade', 'Maputo Cidade'),
    ('maputo_provincia', 'Maputo Província'),
    ('nampula', 'Nampula'),
    ('niassa', 'Niassa'),
    ('sofala', 'Sofala'),
    ('tete', 'Tete'),
    ('zambezia', 'Zambézia'),
]


class ShippingZone(BaseModel):
    """
    Zona geográfica definida pelo vendedor.
    Ex: "Maputo Cidade", "Zona Sul", "Nacional"
    """
    store = models.ForeignKey('stores.Store', on_delete=models.CASCADE, related_name='shipping_zones')
    name = models.CharField(max_length=255, help_text='Nome da zona (ex: "Maputo Cidade", "Zona Sul")')
    provinces = models.JSONField(
        default=list,
        help_text='Lista de províncias cobertas. Ex: ["maputo_cidade", "maputo_provincia"]'
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['name']
        unique_together = [['store', 'name']]
        verbose_name = 'Zona de Entrega'
        verbose_name_plural = 'Zonas de Entrega'

    def __str__(self):
        return f'{self.store.name} — {self.name}'

    def covers_province(self, province_slug: str) -> bool:
        """Verifica se esta zona cobre uma determinada província."""
        return province_slug in (self.provinces or [])


class ShippingMethod(BaseModel):
    """
    Método de envio oferecido pelo vendedor.
    Ex: "Standard", "Expresso", "Transportadora Própria", "Levantamento em Loja"
    """
    METHOD_TYPES = [
        ('delivery', 'Entrega ao Domicílio'),
        ('pickup', 'Levantamento em Loja'),
    ]

    store = models.ForeignKey('stores.Store', on_delete=models.CASCADE, related_name='shipping_methods')
    name = models.CharField(max_length=255, help_text='Nome do método (ex: "Standard", "Expresso")')
    method_type = models.CharField(max_length=20, choices=METHOD_TYPES, default='delivery', help_text='Tipo: entrega ou levantamento')
    description = models.TextField(blank=True, help_text='Descrição visível para o cliente')
    pickup_address = models.TextField(blank=True, help_text='Morada de levantamento (se method_type=pickup)')
    estimated_days_min = models.PositiveIntegerField(default=1, help_text='Prazo mínimo em dias')
    estimated_days_max = models.PositiveIntegerField(default=7, help_text='Prazo máximo em dias')
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['name']
        unique_together = [['store', 'name']]
        verbose_name = 'Método de Envio'
        verbose_name_plural = 'Métodos de Envio'

    def __str__(self):
        return f'{self.store.name} — {self.name}'

    @property
    def estimated_days_display(self):
        if self.estimated_days_min == self.estimated_days_max:
            return f'{self.estimated_days_min} dia(s)'
        return f'{self.estimated_days_min}-{self.estimated_days_max} dias'


class ShippingRate(BaseModel):
    """
    Tarifa: preço para uma combinação zona × método.
    """
    method = models.ForeignKey(ShippingMethod, on_delete=models.CASCADE, related_name='rates')
    zone = models.ForeignKey(ShippingZone, on_delete=models.CASCADE, related_name='rates')
    base_price = models.DecimalField(
        max_digits=10, decimal_places=2, default=0,
        help_text='Preço base em MZN (independente do peso)'
    )
    per_kg_price = models.DecimalField(
        max_digits=10, decimal_places=2, default=0,
        help_text='Preço adicional por kg em MZN (0 = preço fixo)'
    )
    free_shipping_min = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True,
        help_text='Valor mínimo do pedido para frete grátis. Null = nunca grátis.'
    )
    max_weight_kg = models.DecimalField(
        max_digits=8, decimal_places=2, null=True, blank=True,
        help_text='Peso máximo em kg. Null = sem limite.'
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['base_price']
        verbose_name = 'Tarifa de Envio'
        verbose_name_plural = 'Tarifas de Envio'

    def __str__(self):
        return f'{self.method.name} → {self.zone.name}: {self.base_price} MZN'

    def calculate(self, total_weight_kg: float, subtotal: float = 0) -> dict:
        """
        Calcula o preço do frete para um pedido.

        Retorna um dict com:
            price: preço final em MZN
            is_free: True se frete grátis
            estimated_days: string com prazo estimado
        """
        # Verificar peso máximo
        if self.max_weight_kg is not None and total_weight_kg > float(self.max_weight_kg):
            return None  # Excede peso máximo — método indisponível

        # Frete grátis?
        if self.free_shipping_min is not None and subtotal >= float(self.free_shipping_min):
            return {
                'price': 0,
                'is_free': True,
                'free_shipping_min': float(self.free_shipping_min),
                'estimated_days': self.method.estimated_days_display,
            }

        # Calcular preço: base + peso × taxa_por_kg
        price = float(self.base_price) + (total_weight_kg * float(self.per_kg_price))
        price = max(0, round(price, 2))

        return {
            'price': price,
            'is_free': price == 0,
            'estimated_days': self.method.estimated_days_display,
        }
