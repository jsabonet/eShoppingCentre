"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard, Package, ShoppingCart, LogOut, Plus, Edit, Trash2,
  TrendingUp, Users, DollarSign, Eye, X, ChevronLeft, ChevronRight,
  Search, Filter, AlertCircle, CheckCircle, Clock, Truck, XCircle, Store, Building2, BookOpen, RotateCcw, RefreshCw, LifeBuoy, TicketPercent, Wallet, ShieldCheck, Download, Award
} from 'lucide-react';
import { adminAPI, productsAPI, ordersAPI, storesAPI, type Product as APIProduct } from '@/src/lib/api';
import { useAuth } from '@/src/hooks/useAuth';
import UserAvatar from '@/src/components/UserAvatar';
import AdminReturns from './admin/AdminReturns';
import AdminOrders from './admin/AdminOrders';
import AdminTickets from './admin/AdminTickets';
import AdminCoupons from './admin/AdminCoupons';
import AdminAbandonedCarts from './admin/AdminAbandonedCarts';
import AdminAffiliates from './admin/AdminAffiliates';
import AdminWallet from './admin/AdminWallet';
import AdminBlogManagement from './admin/AdminBlogManagement';
import AdminBlogCategories from './admin/AdminBlogCategories';
import AdminAuditTrail from './admin/AdminAuditTrail';
import AdminCertificates from './admin/AdminCertificates';
import { downloadReportFromObjects, type ReportFormat } from '@/src/lib/export';

const BACKEND_READY = true;

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  physical: 'Físicos',
  digital: 'Digitais',
  course: 'Cursos',
};

type Tab = 'dashboard' | 'stores' | 'products' | 'categories' | 'blog' | 'users' | 'returns' | 'orders' | 'tickets' | 'coupons' | 'carts' | 'affiliates' | 'wallet' | 'audit' | 'certificates';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  original_price: number | null;
  category: string;
  image: string;
  stock: number;
  featured: boolean;
  on_sale: boolean;
  rating: number;
  review_count: number;
  created_at: string;
}

interface AdminReportProduct {
  id: string;
  name: string;
  product_type: string;
  status: string;
  price: number;
  stock: number;
  sales_count: number;
  store_name: string;
  category_name: string;
  created_at: string;
}

interface Order {
  id: string;
  user_email: string;
  user_name: string | null;
  user_phone: string | null;
  total_amount: number;
  status: string;
  payment_method: string | null;
  shipping_address: string | null;
  notes: string | null;
  created_at: string;
}

interface OrderItem {
  id: string;
  product_name: string;
  product_image: string | null;
  quantity: number;
  price: number;
}

interface OrderWithItems extends Order {
  items: OrderItem[];
}

const CATEGORIES = [
  'eletronicos', 'moda', 'casa-jardim', 'esportes-lazer',
  'livros-papelaria', 'beleza-saude', 'brinquedos-games', 'automotivo'
];

const CATEGORY_LABELS: Record<string, string> = {
  'eletronicos': 'Eletrônicos',
  'moda': 'Moda',
  'casa-jardim': 'Casa & Jardim',
  'esportes-lazer': 'Esportes & Lazer',
  'livros-papelaria': 'Livros & Papelaria',
  'beleza-saude': 'Beleza & Saúde',
  'brinquedos-games': 'Brinquedos & Games',
  'automotivo': 'Automotivo',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  confirmed: { label: 'Confirmado', color: 'bg-blue-100 text-blue-800', icon: CheckCircle },
  shipped: { label: 'Enviado', color: 'bg-purple-100 text-purple-800', icon: Truck },
  delivered: { label: 'Entregue', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-800', icon: XCircle },
};

export default function AdminDashboard({ activeTab: initialTab = 'dashboard' }: { activeTab?: Tab }) {
  const router = useRouter();
  const { user, isAuthenticated, isAdmin, loading: authLoading, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  // Products state
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productSearch, setProductSearch] = useState('');

  // Orders state
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(null);

  // Stores state
  const [stores, setStores] = useState<any[]>([]);
  const [storesLoading, setStoresLoading] = useState(false);
  const [storeSearch, setStoreSearch] = useState('');
  const [debouncedStoreSearch, setDebouncedStoreSearch] = useState('');
  const [storeStatusFilter, setStoreStatusFilter] = useState('');
  const [storeDateFrom, setStoreDateFrom] = useState('');
  const [storeDateTo, setStoreDateTo] = useState('');
  const [storesPage, setStoresPage] = useState(1);
  const [storeReportFormat, setStoreReportFormat] = useState<ReportFormat>('csv');
  const [adminProducts, setAdminProducts] = useState<AdminReportProduct[]>([]);
  const [adminProductsLoading, setAdminProductsLoading] = useState(false);
  const [productReportSearch, setProductReportSearch] = useState('');
  const [debouncedProductReportSearch, setDebouncedProductReportSearch] = useState('');
  const [productStatusFilter, setProductStatusFilter] = useState('');
  const [productTypeFilter, setProductTypeFilter] = useState('');
  const [productDateFrom, setProductDateFrom] = useState('');
  const [productDateTo, setProductDateTo] = useState('');
  const [productsPage, setProductsPage] = useState(1);
  const [productReportFormat, setProductReportFormat] = useState<ReportFormat>('csv');
  const [adminReportError, setAdminReportError] = useState('');
  const [showStoreEditForm, setShowStoreEditForm] = useState(false);
  const [editStoreForm, setEditStoreForm] = useState({ name: '', description: '', category: '', location: '', phone: '', email: '' });
  const [editingStoreId, setEditingStoreId] = useState<string | null>(null);

  // Confirmation modal
  const [confirmModal, setConfirmModal] = useState<{ open: boolean; title: string; message: string; action: string; onConfirm: () => void } | null>(null);

  // Categories state
  const [categories, setCategories] = useState<any[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '', image: '', sort_order: '0', product_type: 'physical', parent: '' });
  const [categoryImageFile, setCategoryImageFile] = useState<File | null>(null);
  const [categoryDashboard, setCategoryDashboard] = useState<'products' | 'blog'>('products');

  // Courses state
  const [courses, setCourses] = useState<any[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);

  // Users state
  const [users, setUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [includeDeletedUsers, setIncludeDeletedUsers] = useState(false);
  const [userActionError, setUserActionError] = useState('');
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [userForm, setUserForm] = useState({
    email: '', username: '', first_name: '', last_name: '', phone: '',
    password: '', password2: '',
    roles: ['buyer'] as string[], is_verified: false, is_staff: false, is_active: true,
  });
  const [userFormError, setUserFormError] = useState('');

  // Role toggle helper
  const toggleUserRole = (role: string) => {
    setUserForm(prev => ({
      ...prev,
      roles: prev.roles.includes(role)
        ? prev.roles.filter(r => r !== role)
        : [...prev.roles, role],
    }));
  };

  // Dashboard stats
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalOrders: 0,
    totalRevenue: 0,
    totalUsers: 0,
    totalStores: 0,
    pendingStores: 0,
  });
  const [statsDateFrom, setStatsDateFrom] = useState('');
  const [statsDateTo, setStatsDateTo] = useState('');
  const [statsReportFormat, setStatsReportFormat] = useState<ReportFormat>('csv');

  // Product form state
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    price: '',
    original_price: '',
    category: 'eletronicos',
    image: '',
    stock: '0',
    featured: false,
    on_sale: false,
  });
  const [productImageFile, setProductImageFile] = useState<File | null>(null);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedStoreSearch(storeSearch), 300);
    return () => window.clearTimeout(timeout);
  }, [storeSearch]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedProductReportSearch(productReportSearch), 300);
    return () => window.clearTimeout(timeout);
  }, [productReportSearch]);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.replace('/admin/login');
      return;
    }
    if (isAuthenticated && isAdmin) {
      setLoading(false);
    }
  }, [authLoading, isAuthenticated, isAdmin, router]);

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      if (Boolean(statsDateFrom) === Boolean(statsDateTo)) loadDashboardStats();
      if (activeTab === 'categories') loadCategories();
      if (activeTab === 'users') loadUsers();
    }
  }, [isAuthenticated, isAdmin, activeTab, statsDateFrom, statsDateTo]);

  useEffect(() => {
    if (isAuthenticated && isAdmin && activeTab === 'stores') loadStores();
  }, [isAuthenticated, isAdmin, activeTab, debouncedStoreSearch, storeStatusFilter, storeDateFrom, storeDateTo]);

  useEffect(() => {
    if (isAuthenticated && isAdmin && activeTab === 'products') loadAdminProducts();
  }, [isAuthenticated, isAdmin, activeTab, debouncedProductReportSearch, productStatusFilter, productTypeFilter, productDateFrom, productDateTo]);

  const loadDashboardStats = async () => {
    if (!BACKEND_READY) {
      setStats({ totalProducts: 45, totalOrders: 128, totalRevenue: 45600, totalUsers: 4, totalStores: 1, pendingStores: 0 });
      return;
    }
    try {
      const [statsRes] = await Promise.allSettled([
        adminAPI.stats({ date_from: statsDateFrom || undefined, date_to: statsDateTo || undefined }),
      ]);
      const apiStats = statsRes.status === 'fulfilled' ? statsRes.value.data : {};
      setStats({
        totalProducts: apiStats.total_products || 0,
        totalOrders: apiStats.total_orders || 0,
        totalRevenue: apiStats.total_revenue || 0,
        totalUsers: apiStats.total_users || 0,
        totalStores: apiStats.total_stores || 0,
        pendingStores: apiStats.pending_stores || 0,
      });
    } catch { setStats({ totalProducts: 45, totalOrders: 128, totalRevenue: 45600, totalUsers: 4, totalStores: 1, pendingStores: 0 }); }
  };

  const exportAdminStats = () => {
    const rows = [
      { indicador: 'Produtos', valor: stats.totalProducts },
      { indicador: 'Pedidos', valor: stats.totalOrders },
      { indicador: 'Receita de taxas (MZN)', valor: stats.totalRevenue },
      { indicador: 'Utilizadores', valor: stats.totalUsers },
      { indicador: 'Lojas', valor: stats.totalStores },
      { indicador: 'Lojas pendentes', valor: stats.pendingStores },
    ];
    const extension = statsReportFormat === 'excel' ? 'xlsx' : statsReportFormat;
    const period = statsDateFrom && statsDateTo ? `${statsDateFrom}-${statsDateTo}` : 'acumulado';
    downloadReportFromObjects(statsReportFormat, `indicadores-plataforma-${period}.${extension}`,
      `Indicadores da plataforma (${statsDateFrom && statsDateTo ? `${statsDateFrom} a ${statsDateTo}` : 'acumulado'})`,
      ['indicador', 'valor'], rows, {
        subtitle: 'Resumo administrativo de utilizadores, lojas, produtos, pedidos e taxas.',
        period: statsDateFrom && statsDateTo ? `${statsDateFrom} a ${statsDateTo}` : 'Acumulado até ao momento',
        summary: [
          { label: 'Produtos', value: stats.totalProducts },
          { label: 'Pedidos', value: stats.totalOrders },
          { label: 'Receita de taxas (MZN)', value: stats.totalRevenue.toFixed(2) },
          { label: 'Utilizadores', value: stats.totalUsers },
        ],
        columns: ['Indicador', 'Valor'],
        notes: ['O intervalo filtra datas de criação. Receita inclui apenas taxas concluídas no período.'],
      });
  };

  const loadProducts = async () => {
    if (!BACKEND_READY) {
      setProducts([{ id: '1', name: 'Smartphone XYZ', description: 'Último modelo', price: 15999, original_price: 19999, category: 'eletronicos', image: '', stock: 25, featured: true, on_sale: true, rating: 4.5, review_count: 42, created_at: '2026-06-01' }]);
      setProductsLoading(false); return;
    }
    setProductsLoading(true);
    try {
      const { data } = await productsAPI.list({ page_size: 100 });
      setProducts((data.results || []).map((p: any) => ({
        id: p.id, name: p.name, description: '', price: parseFloat(p.price),
        original_price: p.compare_price ? parseFloat(p.compare_price) : null,
        category: '', image: p.primary_image || '', stock: p.stock,
        featured: false, on_sale: p.is_on_sale, rating: parseFloat(p.rating),
        review_count: p.review_count, created_at: p.created_at,
      })));
    } catch { console.error('Error loading products'); } finally { setProductsLoading(false); }
  };

  const loadOrders = async () => {
    if (!BACKEND_READY) {
      setOrders([{ id: 'ORD-001', user_email: 'cliente1@email.com', user_name: 'João Silva', user_phone: '+258 84 123', total_amount: 12300, status: 'delivered', payment_method: 'M-Pesa', shipping_address: 'Maputo', notes: null, created_at: '2026-07-15', items: [] }]);
      setOrdersLoading(false); return;
    }
    setOrdersLoading(true);
    try {
      const { data } = await adminAPI.allOrders({ page_size: 50 });
      setOrders((data.results || []).map((o: any) => ({
        id: o.id, user_email: o.buyer?.email || '', user_name: o.buyer?.first_name || '', user_phone: '',
        total_amount: parseFloat(o.total), status: o.status, payment_method: o.payment_method || '',
        shipping_address: o.shipping_address?.street || '', notes: null, created_at: o.created_at, items: o.items || [],
      })));
    } catch { console.error('Error loading orders'); } finally { setOrdersLoading(false); }
  };

  const loadStores = async () => {
    setStoresLoading(true);
    setAdminReportError('');
    try {
      const params: Record<string, string> = { page_size: '100' };
      if (debouncedStoreSearch.trim()) params.search = debouncedStoreSearch.trim();
      if (storeStatusFilter) params.status = storeStatusFilter;
      if (storeDateFrom && storeDateTo) {
        params.date_from = storeDateFrom;
        params.date_to = storeDateTo;
      }
      const allStores: any[] = [];
      let page = 1;
      let pageCount = 1;
      do {
        const { data } = await adminAPI.allStores({ ...params, page });
        allStores.push(...(data.results || data || []));
        pageCount = data.count ? Math.ceil(data.count / 100) : 1;
        page += 1;
      } while (page <= pageCount);
      setStores(allStores);
    } catch {
      setStores([]);
      setAdminReportError('Não foi possível carregar as lojas para o relatório.');
    } finally { setStoresLoading(false); }
  };

  const loadAdminProducts = async () => {
    setAdminProductsLoading(true);
    setAdminReportError('');
    try {
      const params: Record<string, string> = { page_size: '100' };
      if (debouncedProductReportSearch.trim()) params.search = debouncedProductReportSearch.trim();
      if (productStatusFilter) params.status = productStatusFilter;
      if (productTypeFilter) params.product_type = productTypeFilter;
      if (productDateFrom && productDateTo) {
        params.date_from = productDateFrom;
        params.date_to = productDateTo;
      }
      const allProducts: AdminReportProduct[] = [];
      let page = 1;
      let pageCount = 1;
      do {
        const { data } = await adminAPI.allProducts({ ...params, page });
        allProducts.push(...(data.results || data || []));
        pageCount = data.count ? Math.ceil(data.count / 100) : 1;
        page += 1;
      } while (page <= pageCount);
      setAdminProducts(allProducts);
    } catch {
      setAdminProducts([]);
      setAdminReportError('Não foi possível carregar os produtos para o relatório.');
    } finally { setAdminProductsLoading(false); }
  };

  const handleStoreAction = (storeId: string, action: 'approve' | 'reject' | 'suspend' | 'reactivate') => {
    const labels: Record<string, string> = { approve: 'aprovar', reject: 'rejeitar', suspend: 'suspender', reactivate: 'reactivar' };
    const colors: Record<string, string> = { approve: 'green', reject: 'red', suspend: 'orange', reactivate: 'green' };
    setConfirmModal({
      open: true,
      title: `Confirmar ${labels[action]}`,
      message: `Tem certeza que deseja ${labels[action]} esta loja? Esta acção pode ser revertida.`,
      action: colors[action],
      onConfirm: async () => {
        try {
          await adminAPI.manageStore(storeId, action);
          loadStores();
          loadDashboardStats();
        } catch { alert('Erro ao executar acção.'); }
        setConfirmModal(null);
      },
    });
  };

  const handleDeleteStore = (storeId: string, storeName: string) => {
    setConfirmModal({
      open: true,
      title: 'Eliminar Loja',
      message: `Tem certeza que deseja eliminar permanentemente a loja "${storeName}"? Esta acção é irreversível e todos os produtos associados serão removidos.`,
      action: 'red',
      onConfirm: async () => {
        try {
          await adminAPI.manageStore(storeId, 'close');
          loadStores();
          loadDashboardStats();
        } catch { alert('Erro ao eliminar loja.'); }
        setConfirmModal(null);
      },
    });
  };

  const handleEditStore = (store: any) => {
    setEditingStoreId(store.id);
    setEditStoreForm({
      name: store.name || '',
      description: store.description || '',
      category: store.category || '',
      location: store.location || '',
      phone: store.phone || '',
      email: store.email || '',
    });
    setShowStoreEditForm(true);
  };

  const handleSaveStoreEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await adminAPI.updateStoreDetails(editingStoreId!, editStoreForm);
      setShowStoreEditForm(false);
      loadStores();
    } catch { alert('Erro ao actualizar loja.'); }
  };

  const loadCategories = async () => {
    setCategoriesLoading(true);
    try {
      const { data } = await adminAPI.listCategories();
      setCategories(Array.isArray(data) ? data : (data as any).results || []);
    } catch {} finally { setCategoriesLoading(false); }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append('name', categoryForm.name);
      formData.append('description', categoryForm.description);
      formData.append('sort_order', String(parseInt(categoryForm.sort_order) || 0));
      formData.append('product_type', categoryForm.product_type || 'physical');
      if (categoryForm.parent) {
        formData.append('parent', categoryForm.parent);
      }
      if (categoryImageFile) {
        formData.append('image', categoryImageFile);
      }
      if (editingCategory) {
        await adminAPI.updateCategory(editingCategory.id, formData);
      } else {
        await adminAPI.createCategory(formData);
      }
      resetCategoryForm();
      loadCategories();
    } catch { alert('Erro ao salvar categoria.'); }
  };

  const handleDeleteCategory = (id: string) => {
    setConfirmModal({
      open: true, title: 'Eliminar Categoria', message: 'Tem certeza que deseja eliminar esta categoria?',
      action: 'red', onConfirm: async () => {
        try { await adminAPI.deleteCategory(id); loadCategories(); } catch { alert('Erro ao eliminar.'); }
        setConfirmModal(null);
      },
    });
  };

  const resetCategoryForm = () => {
    setCategoryForm({ name: '', description: '', image: '', sort_order: '0', product_type: 'physical', parent: '' });
    setCategoryImageFile(null);
    setEditingCategory(null);
    setShowCategoryForm(false);
  };

  const loadCourses = async () => {
    setCoursesLoading(true);
    try {
      const { data } = await adminAPI.listCourses({ page_size: 100 });
      setCourses((data as any).results || []);
    } catch {} finally { setCoursesLoading(false); }
  };

  const loadUsers = async (includeDeleted = includeDeletedUsers) => {
    setUsersLoading(true);
    try {
      const { data } = await adminAPI.listUsers({
        page_size: 100,
        ...(includeDeleted ? { include_deleted: 'true' } : {}),
      });
      setUsers((data as any).results || []);
    } catch (err: any) {
      console.error('Erro ao carregar utilizadores:', err?.response?.status, err?.response?.data || err?.message);
    } finally { setUsersLoading(false); }
  };

  const resetUserForm = () => {
    setUserForm({ email: '', username: '', first_name: '', last_name: '', phone: '', password: '', password2: '', roles: ['buyer'], is_verified: false, is_staff: false, is_active: true });
    setEditingUser(null);
    setShowUserForm(false);
    setUserFormError('');
  };

  const handleEditUser = (u: any) => {
    setEditingUser(u);
    setUserForm({
      email: u.email || '',
      username: u.username || '',
      first_name: u.first_name || '',
      last_name: u.last_name || '',
      phone: u.phone || '',
      password: '',
      password2: '',
      roles: u.roles || ['buyer'],
      is_verified: u.is_verified || false,
      is_staff: u.is_staff || false,
      is_active: u.is_active !== false,
    });
    setUserFormError('');
    setShowUserForm(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserFormError('');
    try {
      if (editingUser) {
        const payload: any = {
          first_name: userForm.first_name,
          last_name: userForm.last_name,
          phone: userForm.phone,
          roles: userForm.roles,
          is_verified: userForm.is_verified,
          is_staff: userForm.is_staff,
          is_active: userForm.is_active,
        };
        await adminAPI.updateUser(editingUser.id, payload);
      } else {
        if (!userForm.email || !userForm.username || !userForm.password) {
          setUserFormError('Email, username e password são obrigatórios.');
          return;
        }
        if (userForm.password !== userForm.password2) {
          setUserFormError('As passwords não coincidem.');
          return;
        }
        await adminAPI.createUser(userForm);
      }
      resetUserForm();
      loadUsers();
      loadDashboardStats();
    } catch (err: any) {
      const msg = err?.response?.data
        ? Object.values(err.response.data).flat().join('. ')
        : err?.message || 'Erro ao guardar utilizador.';
      setUserFormError(msg);
    }
  };

  const handleDeleteUser = (userId: string) => {
    setUserActionError('');
    setConfirmModal({
      open: true,
      title: 'Eliminar Utilizador (soft-delete)',
      message: 'A conta, a loja e os produtos serão desativados, mas nenhum dado será removido. Esta ação pode ser revertida reativando a conta.',
      action: 'Eliminar',
      onConfirm: async () => {
        try {
          await adminAPI.deleteUser(userId);
          setUsers(currentUsers => currentUsers.filter(user => user.id !== userId));
          await loadUsers();
          loadDashboardStats();
        } catch (err: any) {
          console.error('Erro ao eliminar utilizador:', err);
          setUserActionError(
            err?.response?.data?.detail || 'Não foi possível eliminar o utilizador. Tente novamente.',
          );
        } finally {
          setConfirmModal(null);
        }
      },
    });
  };

  const resetProductForm = () => {
    setProductForm({
      name: '', description: '', price: '', original_price: '',
      category: 'eletronicos', image: '', stock: '0', featured: false, on_sale: false,
    });
    setEditingProduct(null);
    setShowProductForm(false);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      description: product.description || '',
      price: product.price.toString(),
      original_price: product.original_price?.toString() || '',
      category: product.category,
      image: product.image || '',
      stock: product.stock.toString(),
      featured: product.featured,
      on_sale: product.on_sale,
    });
    setShowProductForm(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!BACKEND_READY) {
      // Mock: adicionar/editar localmente
      const newId = editingProduct?.id || String(Date.now());
      const product: Product = {
        id: newId,
        name: productForm.name,
        description: productForm.description,
        price: parseFloat(productForm.price),
        original_price: productForm.original_price ? parseFloat(productForm.original_price) : null,
        category: productForm.category,
        image: productForm.image,
        stock: parseInt(productForm.stock),
        featured: productForm.featured,
        on_sale: productForm.on_sale,
        rating: editingProduct?.rating || 0,
        review_count: editingProduct?.review_count || 0,
        created_at: editingProduct?.created_at || new Date().toISOString(),
      };
      if (editingProduct) {
        setProducts((prev) => prev.map((p) => (p.id === newId ? product : p)));
      } else {
        setProducts((prev) => [product, ...prev]);
      }
      resetProductForm();
      setStats((prev) => ({
        ...prev,
        totalProducts: editingProduct ? prev.totalProducts : prev.totalProducts + 1,
      }));
      return;
    }
    try {
      const productData = new FormData();
      productData.append('name', productForm.name);
      productData.append('description', productForm.description);
      productData.append('price', productForm.price);
      productData.append('stock', productForm.stock);
      productData.append('category', productForm.category);
      if (productImageFile) {
        productData.append('primary_image', productImageFile);
      }
      if (editingProduct) {
        await productsAPI.update(editingProduct.id, productData);
      } else {
        await productsAPI.create(productData);
      }
      resetProductForm();
      loadProducts();
      loadDashboardStats();
    } catch (err: any) { alert('Erro ao salvar: ' + (err.message || 'Tente novamente.')); }
  };

  const handleDeleteProduct = (id: string) => {
    setConfirmModal({
      open: true, title: 'Eliminar Produto', message: 'Tem certeza que deseja excluir este produto?',
      action: 'red', onConfirm: async () => {
        if (!BACKEND_READY) {
          setProducts((prev) => prev.filter((p) => p.id !== id));
          setStats((prev) => ({ ...prev, totalProducts: prev.totalProducts - 1 }));
        } else {
          try { await productsAPI.delete(id); loadProducts(); loadDashboardStats(); } catch { alert('Erro ao excluir.'); }
        }
        setConfirmModal(null);
      },
    });
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.category.toLowerCase().includes(productSearch.toLowerCase())
  );
  const storesPageCount = Math.max(1, Math.ceil(stores.length / 20));
  const visibleStores = stores.slice((storesPage - 1) * 20, storesPage * 20);
  const adminProductsPageCount = Math.max(1, Math.ceil(adminProducts.length / 20));
  const visibleAdminProducts = adminProducts.slice((productsPage - 1) * 20, productsPage * 20);

  const exportStoresReport = async () => {
    setAdminReportError('');
    try {
      const rows = stores.map((store) => ({
        loja: store.name || '',
        proprietario: store.owner_name || '',
        email: store.owner_email || store.email || '',
        categoria: store.category || '',
        localizacao: store.location || '',
        estado: store.status || '',
        produtos: Number(store.total_products || 0),
        vendas_totais_mzn: Number(store.total_sales || 0),
        criada_em: store.created_at ? new Date(store.created_at).toLocaleString('pt-MZ') : '',
      }));
      const extension = storeReportFormat === 'excel' ? 'xlsx' : storeReportFormat;
      await downloadReportFromObjects(
        storeReportFormat,
        `relatorio-lojas-${new Date().toISOString().slice(0, 10)}.${extension}`,
        'Relatório de lojas',
        ['loja', 'proprietario', 'email', 'categoria', 'localizacao', 'estado', 'produtos', 'vendas_totais_mzn', 'criada_em'],
        rows,
        {
          subtitle: 'Lojas filtradas por pesquisa, estado e data de criação.',
          period: storeDateFrom && storeDateTo ? `${storeDateFrom} a ${storeDateTo}` : 'Todos os períodos',
          summary: [{ label: 'Lojas', value: rows.length }],
        },
      );
    } catch {
      setAdminReportError('Não foi possível gerar o relatório de lojas.');
    }
  };

  const exportProductsReport = async () => {
    setAdminReportError('');
    try {
      const rows = adminProducts.map((product) => ({
        produto: product.name,
        loja: product.store_name || '',
        categoria: product.category_name || '',
        tipo: PRODUCT_TYPE_LABELS[product.product_type] || product.product_type,
        estado: product.status,
        preco_mzn: Number(product.price || 0),
        stock: Number(product.stock || 0),
        vendas: Number(product.sales_count || 0),
        criado_em: product.created_at ? new Date(product.created_at).toLocaleString('pt-MZ') : '',
      }));
      const extension = productReportFormat === 'excel' ? 'xlsx' : productReportFormat;
      await downloadReportFromObjects(
        productReportFormat,
        `relatorio-produtos-${new Date().toISOString().slice(0, 10)}.${extension}`,
        'Relatório de produtos',
        ['produto', 'loja', 'categoria', 'tipo', 'estado', 'preco_mzn', 'stock', 'vendas', 'criado_em'],
        rows,
        {
          subtitle: 'Produtos filtrados por pesquisa, estado, tipo e data de criação.',
          period: productDateFrom && productDateTo ? `${productDateFrom} a ${productDateTo}` : 'Todos os períodos',
          summary: [
            { label: 'Produtos', value: rows.length },
            { label: 'Unidades em stock', value: rows.reduce((total, row) => total + row.stock, 0) },
            { label: 'Vendas registadas', value: rows.reduce((total, row) => total + row.vendas, 0) },
          ],
        },
      );
    } catch {
      setAdminReportError('Não foi possível gerar o relatório de produtos.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) return null;

  return (
    <div>
      {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white rounded-lg p-1 shadow-sm border border-border w-fit flex-wrap">
          {([
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'stores', label: 'Lojas', icon: Store },
            { id: 'products', label: 'Produtos', icon: Package },
            { id: 'returns', label: 'Devoluções', icon: RotateCcw },
            { id: 'orders', label: 'Encomendas', icon: ShoppingCart },
            { id: 'tickets', label: 'Suporte', icon: LifeBuoy },
            { id: 'coupons', label: 'Cupões', icon: TicketPercent },
            { id: 'carts', label: 'Carrinhos', icon: Clock },
            { id: 'affiliates', label: 'Afiliados', icon: Users },
            { id: 'wallet', label: 'Saques', icon: Wallet },
            { id: 'certificates', label: 'Certificados', icon: Award },
            { id: 'categories', label: 'Categorias', icon: Filter },
            { id: 'blog', label: 'Blog', icon: Edit },
            { id: 'users', label: 'Utilizadores', icon: Users },
            { id: 'audit', label: 'Auditoria', icon: ShieldCheck },
          ] as const).map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setActiveTab(t.id as Tab);
                const url = new URL(window.location.href);
                if (t.id === 'dashboard') {
                  url.searchParams.delete('tab');
                } else {
                  url.searchParams.set('tab', t.id);
                }
                window.history.pushState({}, '', url);
              }}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === t.id ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <t.icon size={16} /> {t.label}
              {t.id === 'stores' && stats.pendingStores > 0 && (
                <span className="bg-destructive text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {stats.pendingStores}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div>
            <section className="mb-6 flex flex-col gap-3 rounded-lg border border-border bg-white p-4 sm:flex-row sm:items-end">
              <div className="sm:mr-auto">
                <h2 className="font-semibold">Relatório de indicadores</h2>
                <p className="text-xs text-muted-foreground">Período por data de criação; receita considera taxas concluídas.</p>
              </div>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">De
                <input type="date" value={statsDateFrom} max={statsDateTo || undefined} onChange={(event) => setStatsDateFrom(event.target.value)}
                  className="rounded-md border border-border bg-white px-2 py-1.5 text-sm text-foreground" />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">Até
                <input type="date" value={statsDateTo} min={statsDateFrom || undefined} onChange={(event) => setStatsDateTo(event.target.value)}
                  className="rounded-md border border-border bg-white px-2 py-1.5 text-sm text-foreground" />
              </label>
              <select aria-label="Formato do relatório" value={statsReportFormat} onChange={(event) => setStatsReportFormat(event.target.value as ReportFormat)}
                className="rounded-md border border-border bg-white px-3 py-2 text-sm">
                <option value="csv">CSV</option><option value="excel">Excel (.xlsx)</option><option value="pdf">PDF</option>
              </select>
              <button type="button" onClick={exportAdminStats} disabled={Boolean(statsDateFrom) !== Boolean(statsDateTo)}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50">
                <Download size={15} /> Exportar
              </button>
            </section>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              <div className="bg-white rounded-lg p-6 shadow-sm border border-border">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-accent/10 rounded-lg">
                    <Package className="w-6 h-6 text-accent" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Produtos</p>
                    <p className="text-2xl font-bold">{stats.totalProducts}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg p-6 shadow-sm border border-border">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <ShoppingCart className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Pedidos</p>
                    <p className="text-2xl font-bold">{stats.totalOrders}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg p-6 shadow-sm border border-border">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-green-100 rounded-lg">
                    <DollarSign className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Receita Total</p>
                    <p className="text-2xl font-bold">{stats.totalRevenue.toFixed(2)} MZN</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg p-6 shadow-sm border border-border">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-purple-100 rounded-lg">
                    <Users className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Utilizadores</p>
                    <p className="text-2xl font-bold">{stats.totalUsers}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg p-6 shadow-sm border border-border">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-indigo-100 rounded-lg">
                    <Store className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Lojas</p>
                    <p className="text-2xl font-bold">{stats.totalStores}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg p-6 shadow-sm border border-border">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-yellow-100 rounded-lg">
                    <Clock className="w-6 h-6 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Lojas Pendentes</p>
                    <p className="text-2xl font-bold">{stats.pendingStores}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg p-6 shadow-sm border border-border">
              <h3 className="text-lg font-bold mb-4">Ações Rápidas</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={() => setActiveTab('stores')}
                  className="flex items-center gap-3 p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <Store className="w-5 h-5 text-accent" />
                  <span className="font-medium">Gerir Lojas</span>
                </button>
                <button
                  onClick={() => setActiveTab('categories')}
                  className="flex items-center gap-3 p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <Filter className="w-5 h-5 text-accent" />
                  <span className="font-medium">Gerir Categorias</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stores Tab */}
        {activeTab === 'stores' && (
          <div>
            <div className="mb-4 flex flex-col gap-3 rounded-lg border border-border bg-white p-4">
              <div>
                <h2 className="text-lg font-bold">Gestão de Lojas</h2>
                <p className="text-xs text-muted-foreground">Filtre lojas e exporte os resultados em CSV, Excel ou PDF.</p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
                <label className="flex flex-col gap-1 text-xs text-muted-foreground xl:col-span-2">Pesquisar
                  <input value={storeSearch} onChange={(event) => { setStoreSearch(event.target.value); setStoresPage(1); }}
                    placeholder="Loja, proprietário, email ou localização"
                    className="w-full rounded-md border border-border px-3 py-2 text-sm text-foreground" />
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">Estado
                  <select value={storeStatusFilter} onChange={(event) => { setStoreStatusFilter(event.target.value); setStoresPage(1); }}
                    className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground">
                    <option value="">Todos</option><option value="pending">Pendente</option><option value="active">Activa</option>
                    <option value="suspended">Suspensa</option><option value="rejected">Rejeitada</option><option value="closed">Fechada</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">Criada de
                  <input type="date" value={storeDateFrom} max={storeDateTo || undefined}
                    onChange={(event) => { setStoreDateFrom(event.target.value); setStoresPage(1); }}
                    className="w-full rounded-md border border-border px-3 py-2 text-sm text-foreground" />
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">Criada até
                  <input type="date" value={storeDateTo} min={storeDateFrom || undefined}
                    onChange={(event) => { setStoreDateTo(event.target.value); setStoresPage(1); }}
                    className="w-full rounded-md border border-border px-3 py-2 text-sm text-foreground" />
                </label>
                <div className="flex items-end gap-2">
                  <select aria-label="Formato do relatório de lojas" value={storeReportFormat}
                    onChange={(event) => setStoreReportFormat(event.target.value as ReportFormat)}
                    className="min-w-0 flex-1 rounded-md border border-border bg-white px-2 py-2 text-sm">
                    <option value="csv">CSV</option><option value="excel">Excel</option><option value="pdf">PDF</option>
                  </select>
                  <button type="button" onClick={exportStoresReport} disabled={storesLoading || Boolean(storeDateFrom) !== Boolean(storeDateTo)}
                    className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50">
                    <Download size={15} /> Exportar
                  </button>
                </div>
              </div>
              {Boolean(storeDateFrom) !== Boolean(storeDateTo) && <p className="text-xs text-amber-700">Indique as duas datas para aplicar o período.</p>}
              {adminReportError && <p role="alert" className="text-sm text-red-600">{adminReportError}</p>}
            </div>

            {storesLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b border-border">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium">Loja</th>
                        <th className="text-left px-4 py-3 font-medium">Categoria</th>
                        <th className="text-left px-4 py-3 font-medium">Localização</th>
                        <th className="text-center px-4 py-3 font-medium">Produtos</th>
                        <th className="text-center px-4 py-3 font-medium">Estado</th>
                        <th className="text-right px-4 py-3 font-medium">Acções</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {visibleStores.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-12 text-muted-foreground">
                            Nenhuma loja cadastrada.
                          </td>
                        </tr>
                      ) : (
                        visibleStores.map((store: any) => (
                          <tr key={store.id} className="hover:bg-muted/30">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                {store.logo ? (
                                  <img src={store.logo} alt={store.name} className="w-10 h-10 rounded object-cover" />
                                ) : (
                                  <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                                    <Building2 size={18} className="text-muted-foreground" />
                                  </div>
                                )}
                                <div>
                                  <p className="font-medium">{store.name}</p>
                                  <p className="text-xs text-muted-foreground">{store.email || '—'}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">{store.category || '—'}</td>
                            <td className="px-4 py-3">{store.location || '—'}</td>
                            <td className="px-4 py-3 text-center">{store.total_products || 0}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                store.status === 'active' ? 'bg-green-100 text-green-700' :
                                store.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                store.status === 'suspended' ? 'bg-orange-100 text-orange-700' :
                                store.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {store.status === 'active' ? 'Activo' :
                                 store.status === 'pending' ? 'Pendente' :
                                 store.status === 'suspended' ? 'Suspenso' :
                                 store.status === 'rejected' ? 'Rejeitado' : store.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Link href={`/admin/stores/${store.id}`}
                                  className="p-1.5 hover:bg-muted rounded-md inline-block" title="Ver / Editar"><Edit size={14} className="text-muted-foreground" /></Link>
                                {store.status === 'pending' && (
                                  <>
                                    <button onClick={() => handleStoreAction(store.id, 'approve')}
                                      className="px-2 py-1 text-xs font-medium bg-green-600 hover:bg-green-700 text-white rounded transition-colors">Aprovar</button>
                                    <button onClick={() => handleStoreAction(store.id, 'reject')}
                                      className="px-2 py-1 text-xs font-medium bg-red-100 hover:bg-red-200 text-red-700 rounded transition-colors">Rejeitar</button>
                                  </>
                                )}
                                {store.status === 'active' && (
                                  <button onClick={() => handleStoreAction(store.id, 'suspend')}
                                    className="px-2 py-1 text-xs font-medium bg-orange-100 hover:bg-orange-200 text-orange-700 rounded transition-colors">Suspender</button>
                                )}
                                {store.status === 'suspended' && (
                                  <button onClick={() => handleStoreAction(store.id, 'reactivate')}
                                    className="px-2 py-1 text-xs font-medium bg-green-100 hover:bg-green-200 text-green-700 rounded transition-colors">Reactivar</button>
                                )}
                                <button onClick={() => handleDeleteStore(store.id, store.name)}
                                  className="p-1.5 hover:bg-destructive/10 rounded-md" title="Eliminar"><Trash2 size={14} className="text-destructive" /></button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {stores.length > 0 && (
                  <div className="flex flex-col gap-2 border-t border-border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-muted-foreground">{stores.length} loja(s) encontradas</span>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setStoresPage((page) => Math.max(1, page - 1))} disabled={storesPage === 1}
                        className="rounded border border-border p-1.5 disabled:opacity-40"><ChevronLeft size={16} /></button>
                      <span>Página {storesPage} de {storesPageCount}</span>
                      <button type="button" onClick={() => setStoresPage((page) => Math.min(storesPageCount, page + 1))} disabled={storesPage === storesPageCount}
                        className="rounded border border-border p-1.5 disabled:opacity-40"><ChevronRight size={16} /></button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'products' && (
          <div>
            <div className="mb-4 flex flex-col gap-3 rounded-lg border border-border bg-white p-4">
              <div>
                <h2 className="text-lg font-bold">Gestão e relatório de produtos</h2>
                <p className="text-xs text-muted-foreground">Inclui produtos activos, inactivos, rascunhos e removidos.</p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-7">
                <label className="flex flex-col gap-1 text-xs text-muted-foreground xl:col-span-2">Pesquisar
                  <input value={productReportSearch} onChange={(event) => { setProductReportSearch(event.target.value); setProductsPage(1); }}
                    placeholder="Produto, loja ou categoria"
                    className="w-full rounded-md border border-border px-3 py-2 text-sm text-foreground" />
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">Estado
                  <select value={productStatusFilter} onChange={(event) => { setProductStatusFilter(event.target.value); setProductsPage(1); }}
                    className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground">
                    <option value="">Todos</option><option value="draft">Rascunho</option><option value="active">Activo</option>
                    <option value="inactive">Inactivo</option><option value="deleted">Removido</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">Tipo
                  <select value={productTypeFilter} onChange={(event) => { setProductTypeFilter(event.target.value); setProductsPage(1); }}
                    className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground">
                    <option value="">Todos</option><option value="physical">Físico</option><option value="digital">Digital</option><option value="course">Curso</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">Criado de
                  <input type="date" value={productDateFrom} max={productDateTo || undefined}
                    onChange={(event) => { setProductDateFrom(event.target.value); setProductsPage(1); }}
                    className="w-full rounded-md border border-border px-3 py-2 text-sm text-foreground" />
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">Criado até
                  <input type="date" value={productDateTo} min={productDateFrom || undefined}
                    onChange={(event) => { setProductDateTo(event.target.value); setProductsPage(1); }}
                    className="w-full rounded-md border border-border px-3 py-2 text-sm text-foreground" />
                </label>
                <div className="flex items-end gap-2">
                  <select aria-label="Formato do relatório de produtos" value={productReportFormat}
                    onChange={(event) => setProductReportFormat(event.target.value as ReportFormat)}
                    className="min-w-0 flex-1 rounded-md border border-border bg-white px-2 py-2 text-sm">
                    <option value="csv">CSV</option><option value="excel">Excel</option><option value="pdf">PDF</option>
                  </select>
                  <button type="button" onClick={exportProductsReport} disabled={adminProductsLoading || Boolean(productDateFrom) !== Boolean(productDateTo)}
                    className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50">
                    <Download size={15} /> Exportar
                  </button>
                </div>
              </div>
              {Boolean(productDateFrom) !== Boolean(productDateTo) && <p className="text-xs text-amber-700">Indique as duas datas para aplicar o período.</p>}
              {adminReportError && <p role="alert" className="text-sm text-red-600">{adminReportError}</p>}
            </div>
            <div className="overflow-hidden rounded-lg border border-border bg-white shadow-sm">
              {adminProductsLoading ? (
                <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" /></div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b border-border bg-muted/50">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium">Produto</th>
                          <th className="px-4 py-3 text-left font-medium">Loja</th>
                          <th className="px-4 py-3 text-left font-medium">Categoria</th>
                          <th className="px-4 py-3 text-left font-medium">Tipo</th>
                          <th className="px-4 py-3 text-center font-medium">Estado</th>
                          <th className="px-4 py-3 text-right font-medium">Preço</th>
                          <th className="px-4 py-3 text-right font-medium">Stock</th>
                          <th className="px-4 py-3 text-right font-medium">Vendas</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {visibleAdminProducts.length === 0 ? (
                          <tr><td colSpan={8} className="py-12 text-center text-muted-foreground">Nenhum produto encontrado.</td></tr>
                        ) : visibleAdminProducts.map((product) => (
                          <tr key={product.id} className="hover:bg-muted/30">
                            <td className="px-4 py-3 font-medium">{product.name}</td>
                            <td className="px-4 py-3">{product.store_name || '—'}</td>
                            <td className="px-4 py-3">{product.category_name || '—'}</td>
                            <td className="px-4 py-3">{PRODUCT_TYPE_LABELS[product.product_type] || product.product_type}</td>
                            <td className="px-4 py-3 text-center">{product.status}</td>
                            <td className="px-4 py-3 text-right">{Number(product.price).toLocaleString('pt-MZ')} MZN</td>
                            <td className="px-4 py-3 text-right">{product.stock}</td>
                            <td className="px-4 py-3 text-right">{product.sales_count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {adminProducts.length > 0 && (
                    <div className="flex flex-col gap-2 border-t border-border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-muted-foreground">{adminProducts.length} produto(s) encontrados</span>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => setProductsPage((page) => Math.max(1, page - 1))} disabled={productsPage === 1}
                          className="rounded border border-border p-1.5 disabled:opacity-40"><ChevronLeft size={16} /></button>
                        <span>Página {productsPage} de {adminProductsPageCount}</span>
                        <button type="button" onClick={() => setProductsPage((page) => Math.min(adminProductsPageCount, page + 1))} disabled={productsPage === adminProductsPageCount}
                          className="rounded border border-border p-1.5 disabled:opacity-40"><ChevronRight size={16} /></button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Categories Tab */}
        {activeTab === 'categories' && (
          <div>
            <div role="tablist" aria-label="Tipos de categorias" className="mb-5 flex w-fit gap-1 rounded-lg border bg-white p-1">
              <button type="button" role="tab" aria-selected={categoryDashboard === 'products'} onClick={() => setCategoryDashboard('products')}
                className={`rounded-md px-4 py-2 text-sm font-medium ${categoryDashboard === 'products' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted'}`}>
                Produtos
              </button>
              <button type="button" role="tab" aria-selected={categoryDashboard === 'blog'} onClick={() => setCategoryDashboard('blog')}
                className={`rounded-md px-4 py-2 text-sm font-medium ${categoryDashboard === 'blog' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted'}`}>
                Blog
              </button>
            </div>
            {categoryDashboard === 'blog' ? <AdminBlogCategories /> : (
            <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Categorias de produtos</h2>
              <button onClick={() => { setEditingCategory(null); setCategoryForm({ name: '', description: '', image: '', sort_order: '0', product_type: 'physical', parent: '' }); setShowCategoryForm(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent/90 text-accent-foreground font-medium rounded-md transition-colors">
                <Plus size={16} /> Nova Categoria
              </button>
            </div>

            {showCategoryForm && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
                  <div className="flex items-center justify-between p-4 border-b">
                    <h3 className="font-bold">{editingCategory ? 'Editar Categoria' : 'Nova Categoria'}</h3>
                    <button onClick={resetCategoryForm} className="p-1 hover:bg-muted rounded"><X size={20} /></button>
                  </div>
                  <form onSubmit={handleSaveCategory} className="p-4 space-y-4">
                    <div><label className="block text-sm font-medium mb-1">Nome *</label>
                      <input type="text" value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} required
                        className="w-full px-3 py-2 border rounded-md" /></div>
                    <div><label className="block text-sm font-medium mb-1">Descrição</label>
                      <textarea value={categoryForm.description} onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })} rows={2}
                        className="w-full px-3 py-2 border rounded-md" /></div>
                    <div><label className="block text-sm font-medium mb-1">Tipo</label>
                      <select value={categoryForm.product_type} onChange={(e) => setCategoryForm({ ...categoryForm, product_type: e.target.value })}
                        className="w-full px-3 py-2 border rounded-md">
                        <option value="physical">Produtos Físicos</option>
                        <option value="digital">Produtos Digitais</option>
                        <option value="course">Cursos</option>
                      </select></div>
                    <div><label className="block text-sm font-medium mb-1">Categoria pai (opcional)</label>
                      <select value={categoryForm.parent} onChange={(e) => setCategoryForm({ ...categoryForm, parent: e.target.value })}
                        className="w-full px-3 py-2 border rounded-md">
                        <option value="">Nenhuma (categoria raiz)</option>
                        {categories.filter((c: any) => c.id !== editingCategory?.id).map((c: any) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select></div>
                    <div><label className="block text-sm font-medium mb-1">Imagem</label>
                      <input type="file" accept="image/*"
                        onChange={(e) => setCategoryImageFile(e.target.files?.[0] || null)}
                        className="w-full px-3 py-2 border rounded-md text-sm" />
                      {editingCategory?.image && !categoryImageFile && (
                        <div className="mt-2 flex items-center gap-3">
                          <img src={editingCategory.image} alt={editingCategory.name} className="w-16 h-16 rounded-lg object-cover border" />
                          <span className="text-xs text-muted-foreground">Imagem actual</span>
                        </div>
                      )}
                    </div>
                    <div><label className="block text-sm font-medium mb-1">Ordem</label>
                      <input type="number" value={categoryForm.sort_order} onChange={(e) => setCategoryForm({ ...categoryForm, sort_order: e.target.value })}
                        className="w-full px-3 py-2 border rounded-md" /></div>
                    <div className="flex gap-3 pt-2">
                      <button type="submit" className="flex-1 py-2 bg-accent text-accent-foreground font-semibold rounded-md">Salvar</button>
                      <button type="button" onClick={resetCategoryForm} className="px-6 py-2 border rounded-md">Cancelar</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {categoriesLoading ? (
              <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div></div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b"><tr>
                    <th className="text-left px-4 py-3">Imagem</th>
                    <th className="text-left px-4 py-3">Nome</th>
                    <th className="text-left px-4 py-3">Tipo</th>
                    <th className="text-left px-4 py-3">Produtos</th>
                    <th className="text-left px-4 py-3">Ordem</th>
                    <th className="text-right px-4 py-3">Acções</th>
                  </tr></thead>
                  <tbody className="divide-y">
                    {categories.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma categoria.</td></tr>
                    ) : categories.map((cat: any) => (
                      <tr key={cat.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <div className="w-12 h-12 rounded-4xl overflow-hidden bg-muted flex items-center justify-center">
                            {cat.image ? (
                              <img
                                src={cat.image}
                                alt={cat.name}
                                className="w-full h-full object-cover cursor-pointer hover:scale-110 transition-transform"
                                onClick={() => window.open(cat.image, '_blank')}
                              />
                            ) : (
                              <span className="text-xs text-muted-foreground">{cat.name.charAt(0)}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium">
                          {cat.name}
                          {cat.parent ? <span className="block text-xs text-muted-foreground">— subcategoria</span> : null}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className="inline-block px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs">
                            {PRODUCT_TYPE_LABELS[cat.product_type] || cat.product_type || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{cat.product_count || 0}</td>
                        <td className="px-4 py-3 text-sm">{cat.sort_order}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => { setEditingCategory(cat); setCategoryForm({ name: cat.name, description: cat.description || '', image: cat.image || '', sort_order: String(cat.sort_order || 0), product_type: cat.product_type || 'physical', parent: cat.parent || '' }); setShowCategoryForm(true); }}
                            className="p-1.5 hover:bg-muted rounded-md"><Edit size={16} className="text-muted-foreground" /></button>
                          <button onClick={() => handleDeleteCategory(cat.id)} className="p-1.5 hover:bg-destructive/10 rounded-md"><Trash2 size={16} className="text-destructive" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            </>
            )}
          </div>
        )}

        {activeTab === 'blog' && <AdminBlogManagement />}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Gestão de Utilizadores</h2>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={includeDeletedUsers}
                    onChange={event => {
                      setIncludeDeletedUsers(event.target.checked);
                      setUserActionError('');
                      void loadUsers(event.target.checked);
                    }}
                    className="rounded"
                  />
                  Mostrar utilizadores eliminados
                </label>
                <button
                  onClick={() => { setEditingUser(null); resetUserForm(); setShowUserForm(true); }}
                  className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent/90 text-accent-foreground font-medium rounded-md transition-colors"
                >
                  <Plus size={16} /> Novo Utilizador
                </button>
              </div>
            </div>
            {userActionError && (
              <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {userActionError}
              </p>
            )}
            {includeDeletedUsers && (
              <p className="mb-4 text-sm text-muted-foreground">
                Utilizadores eliminados aparecem identificados como eliminados. Pode editar e reativar uma conta.
              </p>
            )}

            {/* User Form Modal */}
            {showUserForm && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between p-4 border-b">
                    <h3 className="font-bold">{editingUser ? 'Editar Utilizador' : 'Novo Utilizador'}</h3>
                    <button onClick={resetUserForm} className="p-1 hover:bg-muted rounded"><X size={20} /></button>
                  </div>
                  <form onSubmit={handleSaveUser} className="p-4 space-y-4">
                    {userFormError && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">{userFormError}</div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Email *</label>
                        <input type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                          required disabled={!!editingUser}
                          className="w-full px-3 py-2 border rounded-md disabled:bg-muted" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Username *</label>
                        <input type="text" value={userForm.username} onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                          required
                          className="w-full px-3 py-2 border rounded-md" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Nome</label>
                        <input type="text" value={userForm.first_name} onChange={(e) => setUserForm({ ...userForm, first_name: e.target.value })}
                          className="w-full px-3 py-2 border rounded-md" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Apelido</label>
                        <input type="text" value={userForm.last_name} onChange={(e) => setUserForm({ ...userForm, last_name: e.target.value })}
                          className="w-full px-3 py-2 border rounded-md" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Telefone</label>
                      <input type="text" value={userForm.phone} onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                        className="w-full px-3 py-2 border rounded-md" />
                    </div>
                    {!editingUser && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-1">Password *</label>
                          <input type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                            required className="w-full px-3 py-2 border rounded-md" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Confirmar Password *</label>
                          <input type="password" value={userForm.password2} onChange={(e) => setUserForm({ ...userForm, password2: e.target.value })}
                            required className="w-full px-3 py-2 border rounded-md" />
                        </div>
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium mb-2">Roles</label>
                      <div className="flex flex-wrap gap-2">
                        {['buyer', 'seller', 'affiliate', 'admin'].map(role => (
                          <label key={role} className={`px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer border transition-colors ${
                            userForm.roles.includes(role)
                              ? 'bg-accent text-accent-foreground border-accent'
                              : 'bg-white text-muted-foreground border-border hover:border-accent'
                          }`}>
                            <input type="checkbox" className="sr-only"
                              checked={userForm.roles.includes(role)}
                              onChange={() => toggleUserRole(role)} />
                            {role}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-6 flex-wrap">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={userForm.is_verified}
                          onChange={(e) => setUserForm({ ...userForm, is_verified: e.target.checked })}
                          className="rounded" />
                        <span className="text-sm">Verificado</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={userForm.is_staff}
                          onChange={(e) => setUserForm({ ...userForm, is_staff: e.target.checked })}
                          className="rounded" />
                        <span className="text-sm">Staff (acesso admin)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={userForm.is_active}
                          onChange={(e) => setUserForm({ ...userForm, is_active: e.target.checked })}
                          className="rounded" />
                        <span className="text-sm">Conta ativa (desbloqueada)</span>
                      </label>
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button type="submit"
                        className="flex-1 px-4 py-2 bg-accent hover:bg-accent/90 text-accent-foreground font-medium rounded-md transition-colors">
                        {editingUser ? 'Guardar Alterações' : 'Criar Utilizador'}
                      </button>
                      <button type="button" onClick={resetUserForm}
                        className="px-4 py-2 border rounded-md hover:bg-muted transition-colors">Cancelar</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {usersLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
              </div>
            ) : users.length === 0 ? (
              <div className="bg-white rounded-lg p-8 shadow-sm border border-border text-center">
                <Users size={48} className="mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhum utilizador encontrado.</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Utilizador</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Email</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Roles</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Estado</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Verificado</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Registo</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {users.map((u: any) => (
                        <tr key={u.id} className="hover:bg-muted/30">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <UserAvatar avatar={u.avatar} name={u.first_name ? `${u.first_name} ${u.last_name || ''}` : u.username || u.email} className="h-8 w-8" fallbackClassName="bg-accent/10 text-accent" />
                              <span className="font-medium text-sm">
                                {u.first_name ? `${u.first_name} ${u.last_name || ''}` : u.username || u.email}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{u.email}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {(u.roles || []).map((role: string) => (
                                <span key={role} className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent font-medium">
                                  {role}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              u.deleted_at
                                ? 'bg-red-100 text-red-700'
                                : u.is_active
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-amber-100 text-amber-700'
                            }`}>
                              {u.deleted_at ? 'Eliminado' : u.is_active ? 'Ativo' : 'Inativo'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {u.is_verified ? (
                              <CheckCircle size={16} className="text-green-500" />
                            ) : (
                              <XCircle size={16} className="text-muted-foreground" />
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {u.date_joined ? new Date(u.date_joined).toLocaleDateString('pt-MZ') : '—'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => handleEditUser(u)}
                              className="p-1.5 hover:bg-muted rounded-md"><Edit size={16} className="text-muted-foreground" /></button>
                            {!u.deleted_at && <button onClick={() => handleDeleteUser(u.id)}
                              className="p-1.5 hover:bg-destructive/10 rounded-md"><Trash2 size={16} className="text-destructive" /></button>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Returns Tab (Admin) */}
        {activeTab === 'returns' && <AdminReturns />}

        {/* Orders Tab (Admin) */}
        {activeTab === 'orders' && <AdminOrders />}

        {/* Tickets Tab (Admin) */}
        {activeTab === 'tickets' && <AdminTickets />}

        {/* Coupons Tab (Admin) */}
        {activeTab === 'coupons' && <AdminCoupons />}

        {/* Abandoned Carts Tab (Admin) */}
        {activeTab === 'carts' && <AdminAbandonedCarts />}

        {/* Affiliates Tab (Admin) */}
        {activeTab === 'affiliates' && <AdminAffiliates />}

        {/* Wallet Tab (Admin) */}
        {activeTab === 'wallet' && <AdminWallet />}

        {/* Admin audit trail */}
        {activeTab === 'audit' && <AdminAuditTrail />}

        {/* Course certificates */}
        {activeTab === 'certificates' && <AdminCertificates />}

        {/* Confirm Action Modal */}
        {confirmModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`p-2 rounded-full ${confirmModal.action === 'red' ? 'bg-red-100' : confirmModal.action === 'green' ? 'bg-green-100' : 'bg-orange-100'}`}>
                    <AlertCircle size={24} className={confirmModal.action === 'red' ? 'text-red-600' : confirmModal.action === 'green' ? 'text-green-600' : 'text-orange-600'} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{confirmModal.title}</h3>
                    <p className="text-sm text-muted-foreground">{confirmModal.message}</p>
                  </div>
                </div>
                <div className="flex gap-3 justify-end">
                  <button onClick={() => setConfirmModal(null)}
                    className="px-4 py-2 border rounded-md hover:bg-muted transition-colors text-sm">
                    Cancelar
                  </button>
                  <button onClick={confirmModal.onConfirm}
                    className={`px-4 py-2 rounded-md text-sm font-medium text-white transition-colors ${
                      confirmModal.action === 'red' ? 'bg-red-600 hover:bg-red-700' :
                      confirmModal.action === 'green' ? 'bg-green-600 hover:bg-green-700' :
                      'bg-orange-600 hover:bg-orange-700'
                    }`}>
                    Confirmar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

    </div>
  );
}
