export type OrderProductType = 'physical' | 'digital' | 'course';

export interface OrderFulfillmentData {
  is_digital_only?: boolean;
  has_physical_items?: boolean;
  is_pickup?: boolean;
  items?: Array<{ product_type?: string | null }>;
}

export function isDigitalOnlyOrder(order: OrderFulfillmentData): boolean {
  if (typeof order.is_digital_only === 'boolean') return order.is_digital_only;
  const productTypes = (order.items || []).map((item) => item.product_type);
  return productTypes.length > 0
    && productTypes.every((productType) => productType === 'digital' || productType === 'course');
}

export function hasPhysicalOrderItems(order: OrderFulfillmentData): boolean {
  if (typeof order.has_physical_items === 'boolean') return order.has_physical_items;
  return !isDigitalOnlyOrder(order);
}

export function hasDigitalOrderItems(order: OrderFulfillmentData): boolean {
  return isDigitalOnlyOrder(order)
    || (order.items || []).some((item) => item.product_type === 'digital' || item.product_type === 'course');
}

export function getDigitalFulfillmentLabel(order: OrderFulfillmentData): string {
  const digitalTypes = (order.items || [])
    .map((item) => item.product_type)
    .filter((type) => type === 'digital' || type === 'course');
  if (digitalTypes.length > 0 && digitalTypes.every((type) => type === 'course')) {
    return 'Acesso ao curso';
  }
  if (digitalTypes.length > 0 && digitalTypes.every((type) => type === 'digital')) {
    return 'Download digital';
  }
  return 'Acesso digital';
}

export function getOrderFulfillmentLabel(order: OrderFulfillmentData): string {
  if (hasPhysicalOrderItems(order)) {
    return order.is_pickup ? 'Levantamento na loja' : 'Entrega ao domicílio';
  }
  return getDigitalFulfillmentLabel(order);
}
