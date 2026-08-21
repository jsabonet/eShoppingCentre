"use client";

import { useState } from 'react';
import { Star, Truck, Shield, RotateCcw, ShoppingCart, Tag, BadgeCheck, Clock, Play, Download, Monitor, FileText, GraduationCap, BookOpen, Award, Users, ChevronDown, Store, MessageCircle, Link2, Copy, Check, Loader2, X } from 'lucide-react';
import ChatButton from './ChatButton';
import ProductReviews from './ProductReviews';
import { CartProvider, useCart } from '../contexts/CartContext';
import { useAuth } from '@/src/hooks/useAuth';
import { affiliatesAPI } from '@/src/lib/api';
import ProductCard from './ProductCard';
import CartDrawer from './CartDrawer';
import ProductImageGallery from './ProductImageGallery';
import PaymentBadges from './PaymentBadges';
import type { Product } from '../data/marketplace';

interface ProductDetailShopProps {
  product: Product;
  categoryName?: string;
  categorySlug?: string;
  relatedProducts: Product[];
}

function formatPrice(price: number): string {
  return price.toFixed(2).replace('.', ',');
}

function StarRating({ rating }: { rating: number }) {
  return (
    <>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          size={16}
          className={i < Math.floor(rating) ? 'fill-accent text-accent' : 'text-muted-foreground'}
        />
      ))}
    </>
  );
}

function StarRatingLg({ rating }: { rating: number }) {
  return (
    <>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          size={18}
          className={i < Math.floor(rating) ? 'fill-accent text-accent' : 'text-muted-foreground'}
        />
      ))}
    </>
  );
}

function ProductDetailContent({ product, categoryName, categorySlug, relatedProducts }: ProductDetailShopProps) {
  const { addToCart } = useCart();
  const { isAuthenticated, isAffiliate, refreshUser } = useAuth();
  const [affiliateOpen, setAffiliateOpen] = useState(false);
  const [affiliateLoading, setAffiliateLoading] = useState(false);
  const [affiliateLink, setAffiliateLink] = useState<string | null>(null);
  const [affiliateError, setAffiliateError] = useState('');
  const [copied, setCopied] = useState(false);

  const promoteProduct = async () => {
    setAffiliateLoading(true);
    setAffiliateError('');
    try {
      if (!isAffiliate) {
        await affiliatesAPI.register();
        await refreshUser();
      }
      const { data } = await affiliatesAPI.createLink(product.id);
      setAffiliateLink(data.short_url);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setAffiliateError(typeof detail === 'string' ? detail : 'Não foi possível criar o link. Tente novamente.');
    } finally {
      setAffiliateLoading(false);
    }
  };

  const copyAffiliateLink = async () => {
    if (!affiliateLink) return;
    try {
      await navigator.clipboard.writeText(affiliateLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const isDigital = product.productType === 'digital';
  const isCourse = product.productType === 'course';
  const isPhysical = !product.productType || product.productType === 'physical';
  const courseData = product.course;
  const variants = product.variants || [];
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

  const selectedVariant = variants.find((v) => v.id === selectedVariantId) || null;
  const displayPrice = selectedVariant?.price ?? product.price;
  const displayStock = selectedVariant ? selectedVariant.stock : (product.inStock ? 1 : 0);

  // Build image gallery — pass all images to ProductImageGallery
  const galleryImages: string[] = product.images && product.images.length > 0
    ? product.images
    : (product.image ? [product.image] : []);

  // Cart thumbnail uses variant image, or first gallery image
  const variantImage = selectedVariant?.image || undefined;
  const cartImage = variantImage || galleryImages[0] || product.image || '';

  // Group variant attributes for rendering selectors
  const attrKeys = variants.length > 0
    ? [...new Set(variants.flatMap((v) => Object.keys(v.attributes || {})))]
    : [];

  const groupedByAttr = (key: string) => {
    const seen = new Set<string>();
    return variants.filter((v) => {
      const val = v.attributes?.[key];
      if (!val || seen.has(val)) return false;
      seen.add(val);
      return true;
    });
  };

  const buyNowDisabled = (variants.length > 0 && !selectedVariant) || (!isDigital && !isCourse && displayStock <= 0);

  const handleBuyNow = () => {
    addToCart({
      ...product,
      price: displayPrice,
      inStock: isDigital || isCourse || displayStock > 0,
      image: cartImage,
    });
    window.location.href = '/checkout';
  };

  return (
    <>
      {/* Product Detail */}
      <section id="product-detail" className="py-8 px-4">
        <div className="max-w-[1500px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Product Image Gallery */}
            <div className="lg:col-span-5">
              <div className="sticky top-32">
                {galleryImages.length > 0 ? (
                  <ProductImageGallery
                    gallery={galleryImages}
                    productName={selectedVariant ? `${product.name} - ${selectedVariant.name}` : product.name}
                  />
                ) : (
                  <div className="aspect-square bg-card border border-border rounded-lg overflow-hidden">
                    <div className="w-full h-full bg-muted flex items-center justify-center text-muted-foreground text-sm">Sem imagem</div>
                  </div>
                )}
              </div>
            </div>

            {/* Product Info */}
            <div className="lg:col-span-4">
              <h1 className="text-2xl md:text-3xl font-bold mb-3">{product.name}</h1>

              {/* Rating */}
              <div className="flex items-center gap-2 mb-4">
                <div className="flex">
                  <StarRating rating={product.rating} />
                </div>
                <a href="#reviews" className="text-sm text-accent hover:underline">
                  {product.reviewCount} avaliações
                </a>
              </div>

              {/* Description */}
              <div className="mb-6">
                <h3 className="font-bold mb-2">
                  {isCourse ? 'Sobre este curso' : isDigital ? 'Sobre este produto digital' : 'Sobre este produto'}
                </h3>
                <p className="text-muted-foreground leading-relaxed">{product.description}</p>
              </div>

              {/* Product Details — brand, condition, warranty, video */}
              <div className="mb-6 space-y-2">
                {product.brand && (
                  <div className="flex items-center gap-2 text-sm">
                    <Tag size={14} className="text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">Marca:</span>
                    <span className="font-medium">{product.brand}</span>
                  </div>
                )}
                {product.condition && (
                  <div className="flex items-center gap-2 text-sm">
                    <BadgeCheck size={14} className="text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">Condição:</span>
                    <span className="font-medium">
                      {product.condition === 'new' ? 'Novo' : product.condition === 'used' ? 'Usado' : 'Recondicionado'}
                    </span>
                  </div>
                )}
                {product.warrantyDays ? (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock size={14} className="text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">Garantia:</span>
                    <span className="font-medium text-green-600">{product.warrantyDays} dias</span>
                  </div>
                ) : null}
              </div>

              {/* Video */}
              {product.videoUrl && (
                <div className="mb-6">
                  <h3 className="font-bold mb-2 flex items-center gap-2"><Play size={16} /> Vídeo</h3>
                  <div className="aspect-video rounded-lg overflow-hidden bg-black">
                    <iframe
                      src={product.videoUrl.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')}
                      className="w-full h-full"
                      allowFullScreen
                      title="Vídeo do produto"
                    />
                  </div>
                </div>
              )}

              {/* Benefits */}
              <div className="space-y-3 mb-6">
                {isCourse && courseData ? (
                  <>
                    <div className="flex items-center gap-3 text-sm">
                      <GraduationCap size={18} className="text-purple-500" />
                      <span className="font-medium">Instrutor: {courseData.instructor_name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <BookOpen size={18} className="text-accent" />
                      <span>{courseData.total_lessons} aulas · {courseData.duration}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <Award size={18} className="text-amber-500" />
                      <span>{courseData.certificate_enabled ? 'Certificado de conclusão incluído' : 'Sem certificado'}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <Users size={18} className="text-accent" />
                      <span>Acesso vitalício ao conteúdo</span>
                    </div>
                  </>
                ) : isDigital ? (
                  <>
                    <div className="flex items-center gap-3 text-sm">
                      <Download size={18} className="text-green-500" />
                      <span className="font-medium text-green-600">Download Imediato</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <Shield size={18} className="text-accent" />
                      <span>
                        {product.digitalLicense === 'commercial' ? 'Licença Comercial incluída' :
                         product.digitalLicense === 'extended' ? 'Licença Extended (revenda)' :
                         'Licença Pessoal'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <Clock size={18} className="text-accent" />
                      <span>
                        {product.downloadExpiryDays && product.downloadExpiryDays > 0
                          ? `Acesso por ${product.downloadExpiryDays} dias`
                          : 'Acesso vitalício'}
                        {' · '}
                        {product.downloadLimit} download{product.downloadLimit !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {product.digitalCompatibility && (
                      <div className="flex items-center gap-3 text-sm">
                        <Monitor size={18} className="text-accent" />
                        <span className="text-muted-foreground">{product.digitalCompatibility}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-3 text-sm">
                      <Truck size={18} className="text-accent" />
                      <span>Frete grátis para todo Moçambique</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <Shield size={18} className="text-accent" />
                      <span>Garantia de 12 meses</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <RotateCcw size={18} className="text-accent" />
                      <span>Devolução gratuita em até 30 dias</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Buy Box */}
            <div className="lg:col-span-3">
              <div className="sticky top-32 border border-border rounded-lg p-4 bg-card">
                {/* Price (única fonte) */}
                <div className="pb-3 border-b border-border mb-3">
                  {product.originalPrice && (
                    <p className="price-original mb-1">MZN {formatPrice(product.originalPrice)}</p>
                  )}
                  <p className="text-3xl font-bold mb-1">MZN {formatPrice(displayPrice)}</p>
                  {selectedVariant && selectedVariant.price !== null && selectedVariant.price !== product.price && (
                    <p className="text-xs text-muted-foreground mb-1">Preço base: MZN {formatPrice(product.price)}</p>
                  )}
                  {product.discount && (
                    <p className="price-discount">
                      Economize {product.discount}% (MZN {formatPrice(product.originalPrice! - product.price)})
                    </p>
                  )}
                  {isPhysical ? (
                    <p className="text-sm text-muted-foreground mt-2">
                      ou 12x de MZN {formatPrice(displayPrice / 12)} sem juros
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-2">
                      Pagamento único · {isCourse ? 'acesso imediato ao curso' : 'download imediato'}
                    </p>
                  )}
                </div>

                {/* Variant Selector (na caixa de compra, padrão internacional) */}
                {variants.length > 0 && attrKeys.map((key) => (
                  <div key={key} className="mb-3">
                    <p className="text-sm font-medium mb-2">{key}</p>
                    <div className="flex flex-wrap gap-2">
                      {groupedByAttr(key).map((v) => {
                        const isSelected = selectedVariantId === v.id;
                        const attrVal = v.attributes?.[key];
                        return (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => setSelectedVariantId(v.id)}
                            className={`px-3 py-1.5 border rounded-lg text-sm transition-all ${
                              isSelected
                                ? 'border-accent bg-accent/10 text-accent font-medium'
                                : 'border-border hover:border-accent/50'
                            } ${!v.is_active ? 'opacity-40 cursor-not-allowed' : ''}`}
                            disabled={!v.is_active}
                          >
                            {attrVal || v.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {isCourse ? (
                  <>
                    <p className="text-sm text-purple-600 font-medium mb-4 flex items-center gap-1">
                      <GraduationCap size={14} /> Acesso imediato apos inscricao
                    </p>
                    {courseData && (
                      <div className="mb-4 space-y-1.5">
                        <span className="inline-block px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-xs font-medium mr-1.5">
                          📚 {courseData.total_lessons} aulas
                        </span>
                        <span className="inline-block px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-xs font-medium mr-1.5">
                          {courseData.level_display || courseData.level}
                        </span>
                        {courseData.certificate_enabled && (
                          <span className="inline-block px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs font-medium">
                            🏅 Certificado
                          </span>
                        )}
                      </div>
                    )}
                  </>
                ) : isDigital ? (
                  <>
                    <p className="text-sm text-green-600 font-medium mb-4 flex items-center gap-1">
                      <Download size={14} /> Download imediato após pagamento
                    </p>
                    <div className="mb-4 space-y-1.5">
                      {product.digitalFormat && (
                        <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium mr-1.5">
                          📎 {product.digitalFormat}
                        </span>
                      )}
                      {product.digitalVersion && (
                        <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-medium">
                          {product.digitalVersion}
                        </span>
                      )}
                      {product.digitalFileSize && (
                        <p className="text-xs text-muted-foreground">{product.digitalFileSize}</p>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-green-600 font-medium mb-4">
                      <Truck size={14} className="inline" /> Frete grátis
                    </p>
                    <p className="text-sm mb-2">
                      {displayStock > 0 ? (
                        <span className="text-green-600 font-semibold">
                          {variants.length > 0 ? `${displayStock} em estoque` : 'Em estoque'}
                        </span>
                      ) : (
                        <span className="text-red-600 font-semibold">Fora de estoque</span>
                      )}
                    </p>
                  </>
                )}
                {selectedVariant && <p className="text-xs text-muted-foreground mb-4">{selectedVariant.name}</p>}
                {!selectedVariant && variants.length > 0 && (
                  <p className="text-xs text-amber-600 mb-4">Seleccione as opções acima</p>
                )}
                {(!variants.length || selectedVariant) && (
                  <>
                    <p className="text-sm text-muted-foreground mb-4">
                      {isCourse ? 'Acesso vitalicio ao conteudo do curso' : isDigital ? 'Acesso imediato apos confirmacao do pagamento' : 'Entrega em 3-5 dias uteis'}
                    </p>
                    <button
                      onClick={() => addToCart({ ...product, price: displayPrice, inStock: isDigital || isCourse || displayStock > 0, image: cartImage })}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold rounded-md transition-colors mb-2"
                    >
                      <ShoppingCart size={18} /> Adicionar ao Carrinho
                    </button>
                  </>
                )}

                <button
                  onClick={handleBuyNow}
                  disabled={buyNowDisabled}
                  className="block w-full text-center px-4 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCourse ? 'Inscrever-me' : isDigital ? 'Comprar e Baixar' : 'Comprar Agora'}
                </button>

                {/* Store link */}
                {product.storeName && product.storeSlug && (
                  <a
                    href={`/store/${product.storeSlug}`}
                    className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-accent transition-colors"
                  >
                    <Store size={12} />
                    Vendido por <span className="font-medium text-foreground">{product.storeName}</span>
                  </a>
                )}

                {/* Chat button */}
                {product.storeId && product.storeName && (
                  <div className="mt-2">
                    <ChatButton
                      storeId={product.storeId}
                      storeName={product.storeName}
                      subject={`Duvida sobre: ${product.name}`}
                      productId={product.id}
                      variant="link"
                      className="justify-center w-full"
                    />
                  </div>
                )}

                {/* Área de Afiliação (padrão internacional) */}
                {product.affiliateEnabled && (
                  <div className="mt-3 rounded-lg border border-green-200 bg-green-50/70 p-3">
                    <button onClick={() => setAffiliateOpen(true)} className="w-full text-left group">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-green-800 flex items-center gap-1.5">
                          <Link2 size={14} /> Programa de Afiliados
                        </span>
                        <span className="text-xs font-bold text-green-700 bg-white border border-green-200 rounded-full px-2 py-0.5">
                          +{product.affiliateCommission ?? 10}%
                        </span>
                      </div>
                      <p className="text-[11px] text-green-700/80 mt-1">
                        Ganhe {product.affiliateCommission ?? 10}% por cada venda gerada com o seu link.
                      </p>
                      <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-green-700 group-hover:text-green-800 transition-colors">
                        Promover este produto <ChevronDown size={12} className="transition-transform group-hover:translate-y-0.5" />
                      </span>
                    </button>
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-border text-xs text-muted-foreground space-y-1">
                  {isCourse ? (
                    <>
                      <p className="flex items-center gap-1"><GraduationCap size={12} /> Acesso ao curso completo online</p>
                      {product.storeName && <p>Por <strong>{product.storeName}</strong></p>}
                    </>
                  ) : isDigital ? (
                    <>
                      <p className="flex items-center gap-1"><Download size={12} /> Entrega digital — nada de envio fisico</p>
                      {product.storeName && <p>Por <strong>{product.storeName}</strong></p>}
                    </>
                  ) : (<></>
                  )}
                  <PaymentBadges />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Product Details Section */}
      <section id="product-info" className="py-8 px-4 bg-card border-t border-border">
        <div className="max-w-[1500px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-bold mb-4">
                {isCourse ? 'Detalhes do Curso' : isDigital ? 'Detalhes do Produto Digital' : 'Detalhes do Produto'}
              </h3>
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b border-border">
                    <td className="py-2 font-medium text-muted-foreground">Categoria</td>
                    <td className="py-2">{categoryName || 'Geral'}</td>
                  </tr>
                  {isCourse && courseData ? (
                    <>
                      <tr className="border-b border-border">
                        <td className="py-2 font-medium text-muted-foreground">Instrutor</td>
                        <td className="py-2">{courseData.instructor_name}</td>
                      </tr>
                      <tr className="border-b border-border">
                        <td className="py-2 font-medium text-muted-foreground">Nivel</td>
                        <td className="py-2">
                          <span className="px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded text-xs font-medium">
                            {courseData.level_display || courseData.level}
                          </span>
                        </td>
                      </tr>
                      <tr className="border-b border-border">
                        <td className="py-2 font-medium text-muted-foreground">Aulas</td>
                        <td className="py-2">{courseData.total_lessons} aulas</td>
                      </tr>
                      <tr className="border-b border-border">
                        <td className="py-2 font-medium text-muted-foreground">Duracao</td>
                        <td className="py-2">{courseData.duration}</td>
                      </tr>
                      <tr className="border-b border-border">
                        <td className="py-2 font-medium text-muted-foreground">Modulos</td>
                        <td className="py-2">{courseData.modules_count} modulos</td>
                      </tr>
                      <tr className="border-b border-border">
                        <td className="py-2 font-medium text-muted-foreground">Certificado</td>
                        <td className="py-2">
                          {courseData.certificate_enabled
                            ? <span className="text-green-600 font-medium flex items-center gap-1"><Award size={14} /> Sim, incluido</span>
                            : <span className="text-muted-foreground">Nao</span>}
                        </td>
                      </tr>
                      <tr className="border-b border-border">
                        <td className="py-2 font-medium text-muted-foreground">Acesso</td>
                        <td className="py-2"><span className="text-green-600 font-medium">Vitalicio</span></td>
                      </tr>
                    </>
                  ) : isDigital ? (
                    <>
                      {product.digitalFormat && (
                        <tr className="border-b border-border">
                          <td className="py-2 font-medium text-muted-foreground">Formato</td>
                          <td className="py-2"><span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">{product.digitalFormat}</span></td>
                        </tr>
                      )}
                      {product.digitalVersion && (
                        <tr className="border-b border-border">
                          <td className="py-2 font-medium text-muted-foreground">Versao</td>
                          <td className="py-2">{product.digitalVersion}</td>
                        </tr>
                      )}
                      {product.digitalFileSize && (
                        <tr className="border-b border-border">
                          <td className="py-2 font-medium text-muted-foreground">Tamanho</td>
                          <td className="py-2">{product.digitalFileSize}</td>
                        </tr>
                      )}
                      <tr className="border-b border-border">
                        <td className="py-2 font-medium text-muted-foreground">Licenca</td>
                        <td className="py-2">
                          {product.digitalLicense === 'commercial' ? '🏢 Comercial' :
                           product.digitalLicense === 'extended' ? '🌐 Extended' : '👤 Pessoal'}
                        </td>
                      </tr>
                      <tr className="border-b border-border">
                        <td className="py-2 font-medium text-muted-foreground">Downloads</td>
                        <td className="py-2">Ate {product.downloadLimit}x{product.downloadExpiryDays && product.downloadExpiryDays > 0 ? ` em ${product.downloadExpiryDays} dias` : ', sem expirar'}</td>
                      </tr>
                      {product.digitalCompatibility && (
                        <tr className="border-b border-border">
                          <td className="py-2 font-medium text-muted-foreground">Compatibilidade</td>
                          <td className="py-2">{product.digitalCompatibility}</td>
                        </tr>
                      )}
                    </>
                  ) : (
                    <>
                      {product.sku && (
                        <tr className="border-b border-border">
                          <td className="py-2 font-medium text-muted-foreground">SKU</td>
                          <td className="py-2">{product.sku}</td>
                        </tr>
                      )}
                      {product.barcode && (
                        <tr className="border-b border-border">
                          <td className="py-2 font-medium text-muted-foreground">Cod. Barras</td>
                          <td className="py-2">{product.barcode}</td>
                        </tr>
                      )}
                      {product.brand && (
                        <tr className="border-b border-border">
                          <td className="py-2 font-medium text-muted-foreground">Marca</td>
                          <td className="py-2">{product.brand}</td>
                        </tr>
                      )}
                      {product.condition && (
                        <tr className="border-b border-border">
                          <td className="py-2 font-medium text-muted-foreground">Condicao</td>
                          <td className="py-2">{{new:'Novo',used:'Usado',refurbished:'Recondicionado'}[product.condition] || product.condition}</td>
                        </tr>
                      )}
                      {(product.weight || product.height || product.width || product.length) && (
                        <tr className="border-b border-border">
                          <td className="py-2 font-medium text-muted-foreground">Dimensoes</td>
                          <td className="py-2">{[product.weight && `${product.weight}kg`, product.height && `${product.height}cm(A)`, product.width && `${product.width}cm(L)`, product.length && `${product.length}cm(C)`].filter(Boolean).join(' × ')}</td>
                        </tr>
                      )}
                      <tr className="border-b border-border">
                        <td className="py-2 font-medium text-muted-foreground">Disponibilidade</td>
                        <td className="py-2">{product.inStock ? <span className="text-green-600 font-medium">Em estoque</span> : <span className="text-red-600 font-medium">Fora de estoque</span>}</td>
                      </tr>
                      {product.warrantyDays ? (
                        <tr className="border-b border-border">
                          <td className="py-2 font-medium text-muted-foreground">Garantia</td>
                          <td className="py-2">{product.warrantyDays} dias</td>
                        </tr>
                      ) : null}
                    </>
                  )}
                  {product.salesCount != null && (
                    <tr className="border-b border-border">
                      <td className="py-2 font-medium text-muted-foreground">Vendidos</td>
                      <td className="py-2">{product.salesCount}</td>
                    </tr>
                  )}
                  {product.storeName && (
                    <tr className="border-b border-border">
                      <td className="py-2 font-medium text-muted-foreground">Loja</td>
                      <td className="py-2">{product.storeName}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div>
              <h3 className="text-xl font-bold mb-4" id="reviews">Avaliações dos Clientes</h3>
              <div className="flex items-center gap-4 mb-4">
                <div className="text-4xl font-bold">{product.rating}</div>
                <div>
                  <div className="flex mb-1">
                    <StarRatingLg rating={product.rating} />
                  </div>
                  <p className="text-sm text-muted-foreground">{product.reviewCount} avaliações</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Course Curriculum — only for course products with modules */}
      {isCourse && courseData?.curriculum && courseData.curriculum.length > 0 && (
        <section id="course-curriculum" className="py-8 px-4 bg-card border-t border-border">
          <div className="max-w-[1500px] mx-auto">
            <h2 className="text-2xl font-bold mb-2">Conteudo do Curso</h2>
            <p className="text-sm text-muted-foreground mb-6">
              {courseData.total_lessons} aulas · {courseData.modules_count} modulos · {courseData.duration}
            </p>
            <div className="space-y-3">
              {courseData.curriculum.map((mod, mi) => (
                <details key={mod.id} className="border border-border rounded-xl bg-background group" open={mi === 0}>
                  <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors rounded-xl list-none">
                    <div className="flex items-center gap-3">
                      <BookOpen size={18} className="text-accent" />
                      <div>
                        <h4 className="font-bold text-sm">{mod.title}</h4>
                        <p className="text-xs text-muted-foreground">{mod.lessons.length} aulas</p>
                      </div>
                    </div>
                    <ChevronDown size={16} className="text-muted-foreground group-open:rotate-180 transition-transform" />
                  </summary>
                  <div className="px-4 pb-4 space-y-1">
                    {mod.lessons.map((lesson, li) => (
                      <div key={lesson.id} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-muted/20 transition-colors">
                        {lesson.is_free_preview ? (
                          <Play size={14} className="text-green-500 shrink-0" />
                        ) : (
                          <Play size={14} className="text-muted-foreground shrink-0" />
                        )}
                        <span className="text-sm flex-1">{lesson.title}</span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {lesson.is_free_preview && (
                            <span className="text-green-500 font-medium mr-2">Gratis</span>
                          )}
                          {lesson.duration || ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Preview Video — course */}
      {isCourse && courseData?.preview_video_url && (
        <section id="course-preview" className="py-8 px-4">
          <div className="max-w-[1500px] mx-auto">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Play size={22} className="text-accent" /> Video de Apresentacao
            </h2>
            <div className="aspect-video max-w-3xl rounded-xl overflow-hidden bg-black shadow-lg">
              <iframe
                src={courseData.preview_video_url.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')}
                className="w-full h-full"
                allowFullScreen
                title="Video de apresentacao do curso"
              />
            </div>
          </div>
        </section>
      )}

      {/* Reviews */}
      <div className="max-w-[1500px] mx-auto px-4">
        <ProductReviews
          productId={product.id}
          productName={product.name}
          rating={product.rating}
          reviewCount={product.reviewCount}
        />
      </div>

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <section id="related" className="py-12 px-4">
          <div className="max-w-[1500px] mx-auto">
            <h2 className="text-2xl font-bold mb-6">Produtos Relacionados</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {relatedProducts.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Área de Afiliação Modal */}
      {affiliateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setAffiliateOpen(false)} />
          <div className="relative bg-card rounded-2xl p-6 w-full max-w-md shadow-2xl border border-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2"><Link2 size={18} className="text-green-600" /> Área de Afiliação</h3>
              <button onClick={() => setAffiliateOpen(false)} className="p-1 hover:bg-muted rounded"><X size={18} /></button>
            </div>

            {/* Comissão em destaque */}
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-center">
              <p className="text-2xl font-bold text-green-700">{product.affiliateCommission ?? 10}%</p>
              <p className="text-xs text-green-700/80">de comissão por venda</p>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground shrink-0">Produto</span>
                <span className="font-medium text-right truncate">{product.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Janela de Cookie</span>
                <span>{product.affiliateCookieDays ? `${product.affiliateCookieDays} dias` : 'Padrão da plataforma'}</span>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Termos</p>
                <p className="text-xs text-muted-foreground/80">{product.affiliateTerms || 'Termos padrão do programa de afiliados da plataforma.'}</p>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-border text-[11px] text-muted-foreground space-y-1">
              <p>1. Gere o seu link único</p>
              <p>2. Partilhe no WhatsApp, Facebook ou site</p>
              <p>3. Receba comissão por cada venda concluída</p>
            </div>

            <div className="mt-5">
              {!isAuthenticated ? (
                <a href={`/login?redirect=/product/${product.slug}`} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors">
                  Entrar para Promover
                </a>
              ) : affiliateLink ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-mono break-all">{affiliateLink}</p>
                  <button onClick={copyAffiliateLink} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors">
                    {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Copiado!' : 'Copiar Link'}
                  </button>
                </div>
              ) : (
                <button onClick={promoteProduct} disabled={affiliateLoading} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50">
                  {affiliateLoading ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />} Promover este Produto
                </button>
              )}
              {affiliateError && <p className="text-xs text-red-600 mt-2">{affiliateError}</p>}
            </div>
          </div>
        </div>
      )}

      <CartDrawer />
    </>
  );
}

export default function ProductDetailShop(props: ProductDetailShopProps) {
  return (
    <CartProvider>
      <ProductDetailContent {...props} />
    </CartProvider>
  );
}
