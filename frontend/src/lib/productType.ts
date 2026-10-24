export type ProductType = 'physical' | 'digital' | 'course';

/**
 * Infoprodutos (produtos digitais e cursos) são vendidos em unidade única:
 * não faz sentido comprar várias cópias do mesmo ficheiro/curso.
 */
export function isInfoProduct(productType?: string | null): boolean {
  return productType === 'digital' || productType === 'course';
}
