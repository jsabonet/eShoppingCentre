Os logos oficiais dos métodos de pagamento estão na RAIZ de /public:

- m-pesa.png      → M-Pesa (Vodacom)
- e-mola.png      → e-Mola (Movitel)
- visa.png        → Visa
- mastercard.png  → Mastercard

O componente PaymentBadges (src/components/PaymentBadges.tsx) lê estes ficheiros
directamente. Se quiser usar SVG ou outra localização, actualize a lista PAYMENT_METHODS.
