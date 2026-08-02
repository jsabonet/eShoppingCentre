"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard, Package, ShoppingCart, LogOut, Plus, Edit, Trash2,
  TrendingUp, Users, DollarSign, Eye, X, ChevronLeft, ChevronRight,
  Search, Filter, AlertCircle, CheckCircle, Clock, Truck, XCircle, Store, Building2, BookOpen
} from 'lucide-react';
import { adminAPI, productsAPI, ordersAPI, storesAPI, type Product as APIProduct } from '@/src/lib/api';
import { useAuth } from '@/src/hooks/useAuth';

const BACKEND_READY = true;

type Tab = 'dashboard' | 'stores' | 'categories' | 'blog' | 'users';

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
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '', image: '', sort_order: '0' });
  const [categoryImageFile, setCategoryImageFile] = useState<File | null>(null);

  // Blog state
  const [blogPosts, setBlogPosts] = useState<any[]>([]);
  const [blogLoading, setBlogLoading] = useState(false);
  const [showBlogForm, setShowBlogForm] = useState(false);
  const [editingBlogPost, setEditingBlogPost] = useState<any>(null);
  const [blogForm, setBlogForm] = useState({ title: '', excerpt: '', content: '', image: '', category: '', author_name: '' });
  const [blogImageFile, setBlogImageFile] = useState<File | null>(null);

  // Courses state
  const [courses, setCourses] = useState<any[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);

  // Users state
  const [users, setUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [userForm, setUserForm] = useState({
    email: '', username: '', first_name: '', last_name: '', phone: '',
    password: '', password2: '',
    roles: ['buyer'] as string[], is_verified: false, is_staff: false,
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
      loadDashboardStats();
      if (activeTab === 'stores') loadStores();
      if (activeTab === 'categories') loadCategories();
      if (activeTab === 'blog') loadBlogPosts();
      if (activeTab === 'users') loadUsers();
    }
  }, [isAuthenticated, isAdmin, activeTab]);

  const loadDashboardStats = async () => {
    if (!BACKEND_READY) {
      setStats({ totalProducts: 45, totalOrders: 128, totalRevenue: 45600, totalUsers: 4, totalStores: 1, pendingStores: 0 });
      return;
    }
    try {
      const [statsRes, productsRes] = await Promise.allSettled([
        adminAPI.stats(),
        productsAPI.list({ page_size: 1 }),
      ]);
      const apiStats = statsRes.status === 'fulfilled' ? statsRes.value.data : {};
      const totalProducts = productsRes.status === 'fulfilled'
        ? (productsRes.value.data as any).count || 0
        : 0;
      setStats({
        totalProducts,
        totalOrders: apiStats.total_orders || 0,
        totalRevenue: apiStats.total_revenue || 0,
        totalUsers: apiStats.total_users || 0,
        totalStores: apiStats.total_stores || 0,
        pendingStores: apiStats.pending_stores || 0,
      });
    } catch { setStats({ totalProducts: 45, totalOrders: 128, totalRevenue: 45600, totalUsers: 4, totalStores: 1, pendingStores: 0 }); }
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
    try {
      const { data } = await adminAPI.allStores();
      setStores(Array.isArray(data) ? data : (data as any).results || []);
    } catch { console.error('Error loading stores'); } finally { setStoresLoading(false); }
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
    setCategoryForm({ name: '', description: '', image: '', sort_order: '0' });
    setCategoryImageFile(null);
    setEditingCategory(null);
    setShowCategoryForm(false);
  };

  const loadBlogPosts = async () => {
    setBlogLoading(true);
    try {
      const { data } = await adminAPI.listBlogPosts({ page_size: 100 });
      setBlogPosts((data as any).results || []);
    } catch {} finally { setBlogLoading(false); }
  };

  const handleSaveBlogPost = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append('title', blogForm.title);
      formData.append('excerpt', blogForm.excerpt);
      formData.append('content', blogForm.content);
      formData.append('category', blogForm.category);
      formData.append('author_name', blogForm.author_name);
      if (blogImageFile) {
        formData.append('image', blogImageFile);
      }
      if (editingBlogPost) {
        await adminAPI.updateBlogPost(editingBlogPost.id, formData);
      } else {
        await adminAPI.createBlogPost(formData);
      }
      resetBlogForm();
      loadBlogPosts();
    } catch { alert('Erro ao salvar artigo.'); }
  };

  const handleDeleteBlogPost = (id: string) => {
    setConfirmModal({
      open: true, title: 'Eliminar Artigo', message: 'Tem certeza que deseja eliminar este artigo do blog?',
      action: 'red', onConfirm: async () => {
        try { await adminAPI.deleteBlogPost(id); loadBlogPosts(); } catch { alert('Erro ao eliminar.'); }
        setConfirmModal(null);
      },
    });
  };

  const resetBlogForm = () => {
    setBlogForm({ title: '', excerpt: '', content: '', image: '', category: '', author_name: '' });
    setBlogImageFile(null);
    setEditingBlogPost(null);
    setShowBlogForm(false);
  };

  const loadCourses = async () => {
    setCoursesLoading(true);
    try {
      const { data } = await adminAPI.listCourses({ page_size: 100 });
      setCourses((data as any).results || []);
    } catch {} finally { setCoursesLoading(false); }
  };

  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      const { data } = await adminAPI.listUsers({ page_size: 100 });
      setUsers((data as any).results || []);
    } catch (err: any) {
      console.error('Erro ao carregar utilizadores:', err?.response?.status, err?.response?.data || err?.message);
    } finally { setUsersLoading(false); }
  };

  const resetUserForm = () => {
    setUserForm({ email: '', username: '', first_name: '', last_name: '', phone: '', password: '', password2: '', roles: ['buyer'], is_verified: false, is_staff: false });
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
    setConfirmModal({
      open: true,
      title: 'Eliminar Utilizador',
      message: 'Tens a certeza que queres eliminar este utilizador? Esta ação é irreversível.',
      action: 'Eliminar',
      onConfirm: async () => {
        try {
          await adminAPI.deleteUser(userId);
          loadUsers();
          loadDashboardStats();
        } catch (err: any) {
          console.error('Erro ao eliminar utilizador:', err);
        }
        setConfirmModal(null);
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
            { id: 'categories', label: 'Categorias', icon: Filter },
            { id: 'blog', label: 'Blog', icon: Edit },
            { id: 'users', label: 'Utilizadores', icon: Users },
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
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Gestão de Lojas</h2>
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
                      {stores.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-12 text-muted-foreground">
                            Nenhuma loja cadastrada.
                          </td>
                        </tr>
                      ) : (
                        stores.map((store: any) => (
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
                                <button onClick={() => handleEditStore(store)}
                                  className="p-1.5 hover:bg-muted rounded-md" title="Editar"><Edit size={14} className="text-muted-foreground" /></button>
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
              </div>
            )}
          </div>
        )}

        {/* Categories Tab */}
        {activeTab === 'categories' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Gestão de Categorias</h2>
              <button onClick={() => { setEditingCategory(null); setCategoryForm({ name: '', description: '', image: '', sort_order: '0' }); setShowCategoryForm(true); }}
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
                    <th className="text-left px-4 py-3">Produtos</th>
                    <th className="text-left px-4 py-3">Ordem</th>
                    <th className="text-right px-4 py-3">Acções</th>
                  </tr></thead>
                  <tbody className="divide-y">
                    {categories.length === 0 ? (
                      <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">Nenhuma categoria.</td></tr>
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
                        <td className="px-4 py-3 font-medium">{cat.name}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{cat.product_count || 0}</td>
                        <td className="px-4 py-3 text-sm">{cat.sort_order}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => { setEditingCategory(cat); setCategoryForm({ name: cat.name, description: cat.description || '', image: cat.image || '', sort_order: String(cat.sort_order || 0) }); setShowCategoryForm(true); }}
                            className="p-1.5 hover:bg-muted rounded-md"><Edit size={16} className="text-muted-foreground" /></button>
                          <button onClick={() => handleDeleteCategory(cat.id)} className="p-1.5 hover:bg-destructive/10 rounded-md"><Trash2 size={16} className="text-destructive" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Blog Tab */}
        {activeTab === 'blog' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Gestão do Blog</h2>
              <button onClick={() => { setEditingBlogPost(null); setBlogForm({ title: '', excerpt: '', content: '', image: '', category: '', author_name: '' }); setShowBlogForm(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent/90 text-accent-foreground font-medium rounded-md transition-colors">
                <Plus size={16} /> Novo Artigo
              </button>
            </div>

            {showBlogForm && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between p-4 border-b">
                    <h3 className="font-bold">{editingBlogPost ? 'Editar Artigo' : 'Novo Artigo'}</h3>
                    <button onClick={resetBlogForm} className="p-1 hover:bg-muted rounded"><X size={20} /></button>
                  </div>
                  <form onSubmit={handleSaveBlogPost} className="p-4 space-y-4">
                    <div><label className="block text-sm font-medium mb-1">Título *</label>
                      <input type="text" value={blogForm.title} onChange={(e) => setBlogForm({ ...blogForm, title: e.target.value })} required
                        className="w-full px-3 py-2 border rounded-md" /></div>
                    <div><label className="block text-sm font-medium mb-1">Resumo</label>
                      <textarea value={blogForm.excerpt} onChange={(e) => setBlogForm({ ...blogForm, excerpt: e.target.value })} rows={2}
                        className="w-full px-3 py-2 border rounded-md" /></div>
                    <div><label className="block text-sm font-medium mb-1">Conteúdo</label>
                      <textarea value={blogForm.content} onChange={(e) => setBlogForm({ ...blogForm, content: e.target.value })} rows={6}
                        className="w-full px-3 py-2 border rounded-md" /></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="block text-sm font-medium mb-1">Categoria</label>
                        <input type="text" value={blogForm.category} onChange={(e) => setBlogForm({ ...blogForm, category: e.target.value })}
                          className="w-full px-3 py-2 border rounded-md" placeholder="Ex: Tecnologia" /></div>
                      <div><label className="block text-sm font-medium mb-1">Autor</label>
                        <input type="text" value={blogForm.author_name} onChange={(e) => setBlogForm({ ...blogForm, author_name: e.target.value })}
                          className="w-full px-3 py-2 border rounded-md" /></div>
                    </div>
                    <div><label className="block text-sm font-medium mb-1">Imagem de Capa</label>
                      <input type="file" accept="image/*"
                        onChange={(e) => setBlogImageFile(e.target.files?.[0] || null)}
                        className="w-full px-3 py-2 border rounded-md text-sm" />
                      {editingBlogPost?.image && !blogImageFile && (
                        <div className="mt-2 flex items-center gap-3">
                          <img src={editingBlogPost.image} alt={editingBlogPost.title} className="w-16 h-16 rounded-lg object-cover border" />
                          <span className="text-xs text-muted-foreground">Imagem actual</span>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button type="submit" className="flex-1 py-2 bg-accent text-accent-foreground font-semibold rounded-md">Salvar</button>
                      <button type="button" onClick={resetBlogForm} className="px-6 py-2 border rounded-md">Cancelar</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {blogLoading ? (
              <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div></div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b"><tr>
                    <th className="text-left px-4 py-3">Título</th>
                    <th className="text-left px-4 py-3">Categoria</th>
                    <th className="text-left px-4 py-3">Autor</th>
                    <th className="text-left px-4 py-3">Data</th>
                    <th className="text-right px-4 py-3">Acções</th>
                  </tr></thead>
                  <tbody className="divide-y">
                    {blogPosts.length === 0 ? (
                      <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum artigo.</td></tr>
                    ) : blogPosts.map((post: any) => (
                      <tr key={post.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium">{post.title}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{post.category || '—'}</td>
                        <td className="px-4 py-3 text-sm">{post.author_name || '—'}</td>
                        <td className="px-4 py-3 text-sm">{post.published_at ? new Date(post.published_at).toLocaleDateString('pt-MZ') : '—'}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => { setEditingBlogPost(post); setBlogForm({ title: post.title, excerpt: post.excerpt || '', content: post.content || '', image: post.image || '', category: post.category || '', author_name: post.author_name || '' }); setShowBlogForm(true); }}
                            className="p-1.5 hover:bg-muted rounded-md"><Edit size={16} className="text-muted-foreground" /></button>
                          <button onClick={() => handleDeleteBlogPost(post.id)} className="p-1.5 hover:bg-destructive/10 rounded-md"><Trash2 size={16} className="text-destructive" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Gestão de Utilizadores</h2>
              <button
                onClick={() => { setEditingUser(null); resetUserForm(); setShowUserForm(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent/90 text-accent-foreground font-medium rounded-md transition-colors"
              >
                <Plus size={16} /> Novo Utilizador
              </button>
            </div>

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
                    <div className="flex gap-6">
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
                              <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-sm font-medium text-accent">
                                {u.first_name?.[0] || u.email?.[0]?.toUpperCase() || '?'}
                              </div>
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
                            <button onClick={() => handleDeleteUser(u.id)}
                              className="p-1.5 hover:bg-destructive/10 rounded-md"><Trash2 size={16} className="text-destructive" /></button>
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
