// frontend/src/lib/api.ts
// Cliente HTTP centralizado para comunicar com o backend Django DRF

import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // envia o cookie httpOnly (refresh token)
});

// ─── Interceptor: Adicionar token JWT ───
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Interceptor: Auto-refresh JWT ───
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        // O refresh token viaja num cookie httpOnly — não precisa de corpo
        const { data } = await axios.post(`${API_URL}/auth/refresh/`, {}, { withCredentials: true });
        localStorage.setItem('access_token', data.access);
        originalRequest.headers.Authorization = `Bearer ${data.access}`;
        return api(originalRequest);
      } catch {
        localStorage.removeItem('access_token');
        if (typeof window !== 'undefined') window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ─── Tipos TypeScript ───

export interface User {
  id: string;
  email: string;
  username: string;
  phone: string;
  first_name: string;
  last_name: string;
  avatar: string | null;
  roles: string[];
  is_verified: boolean;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: string | null;
  product_count: number;
}

export interface Product {
  id: string;
  store_name: string;
  store_slug: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  compare_price: number | null;
  discount_percentage: number | null;
  primary_image: string | null;
  product_type: 'physical' | 'digital' | 'course';
  rating: number;
  review_count: number;
  sales_count: number;
  is_on_sale: boolean;
  stock: number;
  affiliate_commission: number;
  affiliate_enabled: boolean;
  affiliate_cookie_days: number | null;
  affiliate_terms: string;
  status: string;
  created_at: string;
  course?: {
    course_id: string;
    level?: string;
    duration?: string;
    total_lessons?: number;
    certificate_enabled?: boolean;
    preview_video_url?: string;
    modules_count?: number;
  };
}

export interface ProductDetail extends Product {
  images: ProductImage[];
  store: StoreSummary;
  variants: ProductVariant[];
  variations: ProductVariation[];
  specifications: Record<string, string>;
  tags: string[];
}

export interface ProductImage {
  id: string;
  image: string;
  alt_text: string;
  is_primary: boolean;
}

export interface ProductVariant {
  id: string;
  name: string;
  sku: string;
  price: number | null;
  effective_price: number;
  stock: number;
  image: string | null;
  image_url: string | null;
  attributes: Record<string, string>;
  is_active: boolean;
  sort_order: number;
}

export interface ProductVariation {
  id: string;
  name: string;
  price_modifier: number;
  stock: number;
}

export interface Store {
  id: string;
  name: string;
  slug: string;
  description: string;
  tagline: string;
  logo: string | null;
  banner: string | null;
  theme_color: string;
  category: string;
  product_type: 'physical' | 'digital' | 'course';
  rating: number;
  total_sales: number;
  total_products: number;
  location: string;
  status: string;
}

export interface StoreDetail extends Store {
  about: string;
  phone: string;
  email: string;
  shipping_policy: string;
  return_policy: string;
  default_affiliate_commission: number;
  low_stock_threshold: number;
  website: string;
  created_at: string;
}

export interface StoreSummary {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  rating: number;
  total_sales: number;
}

export interface Order {
  id: string;
  order_number: string;
  status: string;
  total: number;
  subtotal: number;
  shipping_cost: number;
  buyer: User;
  store: StoreSummary;
  items: OrderItem[];
  payment_method: string;
  payment_status: string;
  shipping_address: Record<string, string>;
  tracking_code: string | null;
  affiliate_commission: number;
  created_at: string;
}

export interface OrderItem {
  id: string;
  product_name: string;
  product_image: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface AffiliateProfile {
  id: string;
  user_email: string;
  user_name?: string;
  referral_code: string;
  total_clicks: number;
  total_sales: number;
  total_commission: number;
  total_withdrawn: number;
  available_commission: number;
  is_active: boolean;
  status: string;
  commission_tier: string;
}

export interface AffiliateLink {
  id: string;
  product: string;
  product_name: string;
  code: string;
  clicks: number;
  conversions: number;
  short_url: string;
}

export interface AffiliateSettings {
  id: string;
  cookie_window_days: number;
  default_commission_rate: number;
  min_payout_amount: number;
  approve_after_days: number;
  clawback_days: number;
  payout_fee_percent: number;
  affiliate_program_active: boolean;
  min_commission_rate: number;
  max_commission_rate: number;
  terms_of_service: string;
}

export interface Course {
  id: string;
  slug: string;
  title: string;
  instructor_name: string;
  level: string;
  duration: string;
  total_lessons: number;
  image: string | null;
  price: number;
  compare_price: number | null;
  rating: number;
  students_count: number;
}

export interface CourseDetail extends Course {
  description: string;
  modules: CourseModule[];
  enrollment: Enrollment | null;
}

export interface CourseModule {
  id: string;
  title: string;
  description: string;
  lessons: CourseLesson[];
}

export interface CourseLesson {
  id: string;
  title: string;
  duration: string;
  is_free_preview: boolean;
  completed: boolean;
  video_url?: string;
}

// ─── Quizzes ───

export interface AnswerOption {
  id: string;
  text: string;
  is_correct?: boolean; // hidden from students
  sort_order: number;
}

export interface QuizQuestion {
  id: string;
  text: string;
  question_type: 'multiple_choice' | 'true_false' | 'open_text' | 'multiple_select';
  sort_order: number;
  points: number;
  options: AnswerOption[];
}

export interface Quiz {
  id: string;
  title: string;
  description: string;
  pass_percentage: number;
  max_attempts: number | null;
  is_required: boolean;
  sort_order: number;
  module_id: string;
  lesson_id: string | null;
  module_title?: string;
  total_questions: number;
  total_points: number;
  questions?: QuizQuestion[];
  created_at: string;
  updated_at?: string;
}

export interface QuizAttempt {
  id: string;
  quiz_id: string;
  quiz_title: string;
  user_email?: string;
  score: number | null;
  total_points: number;
  earned_points: number;
  passed: boolean | null;
  pass_percentage: number;
  max_attempts: number | null;
  attempt_number: number;
  started_at: string;
  completed_at: string | null;
  answers?: QuizAnswer[];
}

export interface QuizAnswer {
  id: string;
  question_id: string;
  question_text: string;
  question_type: string;
  selected_option_id: string | null;
  selected_option_text: string | null;
  selected_options_texts?: string[];
  open_text_answer: string;
  is_correct: boolean | null;
}

export interface QuizSubmitPayload {
  answers: {
    question_id: string;
    selected_option_id?: string | null;
    selected_option_ids?: string[];
    open_text_answer?: string;
  }[];
}

export interface Enrollment {
  id: string;
  progress: number;
  completed: boolean;
  completed_at: string | null;
}

export interface Review {
  id: string;
  user_name: string;
  rating: number;
  title: string;
  comment: string;
  is_verified_purchase: boolean;
  created_at: string;
}

export interface WalletInfo {
  balance: number;
  payout_balance: number;
  reserved_balance: number;
  available_payout: number;
  total_spent: number;
  total_earned: number;
  total_withdrawn: number;
}

export interface WalletTransaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  status: string;
  created_at: string;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  image: string | null;
  author_name: string;
  category: string;
  read_time: string;
  published_at: string;
}

export interface BlogPostDetail extends BlogPost {
  content: string;
}

// ─── Funções da API ───

export const authAPI = {
  register: (data: { email: string; username?: string; password: string; password2: string; first_name?: string; last_name?: string; phone?: string }) =>
    api.post<{ access: string; refresh: string; user: User }>('/auth/register/', data),

  login: (data: { email: string; password: string }) =>
    api.post<{ access: string; refresh: string; user: User }>('/auth/login/', data),

  /** Exchange Firebase ID token for backend JWT tokens. */
  firebaseLogin: (idToken: string) =>
    api.post<{ access: string; refresh: string; user: User; is_new_user: boolean }>(
      '/auth/firebase/',
      { id_token: idToken },
    ),

  refreshToken: (refresh: string) =>
    api.post<{ access: string; refresh?: string }>('/auth/token/refresh/', { refresh }),

  verifyEmail: (data: { email: string; code: string }) =>
    api.post<{ detail: string; user: User }>('/auth/verify-email/', data),

  resendVerification: (email: string) =>
    api.post<{ detail: string }>('/auth/resend-verification/', { email }),

  requestPasswordReset: (email: string) =>
    api.post<{ detail: string; google_only?: boolean }>('/auth/password/reset/', { email }),

  confirmPasswordReset: (data: { email: string; code: string; new_password: string }) =>
    api.post<{ detail: string }>('/auth/password/reset/confirm/', data),

  changePassword: (data: { old_password: string; new_password: string }) =>
    api.post('/users/password/change/', data),

  logout: () => {
    // Revoga o refresh token (cookie httpOnly) no servidor — fire-and-forget
    axios.post(`${API_URL}/auth/logout/`, {}, { withCredentials: true }).catch(() => {});
    localStorage.removeItem('access_token');
    localStorage.removeItem('admin_logged_in');
    window.location.href = '/';
  },
};

export const productsAPI = {
  list: (params?: Record<string, any>) =>
    api.get<PaginatedResponse<Product>>('/products/', { params }),

  getBySlug: (slug: string) =>
    api.get<ProductDetail>(`/products/${slug}/`),

  search: (query: string, params?: Record<string, any>) =>
    api.get<PaginatedResponse<Product>>('/products/search/', { params: { ...params, q: query } }),

  create: (data: FormData) =>
    api.post<Product>('/products/', data, { headers: { 'Content-Type': 'multipart/form-data' } }),

  update: (id: string, data: FormData) =>
    api.patch<Product>(`/products/${id}/update/`, data, { headers: { 'Content-Type': 'multipart/form-data' } }),

  delete: (id: string) =>
    api.delete(`/products/${id}/delete/`),

  myProducts: (params?: Record<string, any>) =>
    api.get<PaginatedResponse<Product>>('/products/my/', { params }),

  updateAffiliate: (id: string, data: { affiliate_enabled?: boolean; affiliate_commission?: number }) =>
    api.patch<Product>(`/products/${id}/update/`, data),

  bulkAffiliate: (data: { affiliate_enabled?: boolean; affiliate_commission?: number; product_ids?: string[] }) =>
    api.post<{ updated: number }>('/products/bulk-affiliate/', data),

  addImage: (productId: string, data: FormData) =>
    api.post(`/products/${productId}/images/`, data),

  // Variants
  listVariants: (productId: string) =>
    api.get<ProductVariant[]>(`/products/${productId}/variants/`),

  createVariant: (productId: string, data: Partial<ProductVariant>) =>
    api.post<ProductVariant>(`/products/${productId}/variants/`, data),

  updateVariant: (productId: string, variantId: string, data: Partial<ProductVariant>) =>
    api.patch<ProductVariant>(`/products/${productId}/variants/${variantId}/`, data),

  deleteVariant: (productId: string, variantId: string) =>
    api.delete(`/products/${productId}/variants/${variantId}/`),
};

export const categoriesAPI = {
  list: () => api.get<Category[]>('/categories/'),
  getBySlug: (slug: string) => api.get<Category>(`/categories/${slug}/`),
};

export const storesAPI = {
  list: (params?: Record<string, any>) =>
    api.get<PaginatedResponse<Store>>('/stores/', { params }),

  getBySlug: (slug: string) =>
    api.get<StoreDetail>(`/stores/${slug}/`),

  register: (data: FormData) =>
    api.post<Store>('/stores/register/', data, { headers: { 'Content-Type': 'multipart/form-data' } }),

  myStore: () => api.get<StoreDetail>('/stores/me/'),

  updateMyStore: (data: any) => api.patch<StoreDetail>('/stores/me/', data),

  dashboard: () =>
    api.get<SellerDashboard>('/stores/me/stats/'),

  myEarnings: (params?: Record<string, any>) =>
    api.get<{ transactions: WalletTransaction[] }>('/stores/me/earnings/', { params }),
};

export interface DashboardOrder {
  id: string;
  order_number: string;
  customer: string;
  items_count: number;
  total: number;
  status: string;
  status_display: string;
  payment_method: string;
  created_at: string;
}

export interface DashboardProduct {
  id: string;
  name: string;
  slug: string;
  sales: number;
  revenue: number;
  image: string | null;
}

export interface SellerDashboard {
  store_name: string;
  tagline: string;
  product_type: 'physical' | 'digital' | 'course';
  today_sales: number;
  today_revenue: number;
  total_revenue: number;
  total_products: number;
  total_orders: number;
  pending_orders: number;
  store_rating: number;
  downloaded_today: number;
  active_students: number;
  recent_orders: DashboardOrder[];
  top_products: DashboardProduct[];
}

export const ordersAPI = {
  create: (data: {
    items: { product_id: string; quantity: number; variation_id?: string }[];
    shipping_address: Record<string, string>;
    payment_method: string;
    affiliate_code?: string;
    coupon_code?: string;
    buyer_notes?: string;
  }) => api.post<Order[]>('/orders/', data),

  getById: (id: string) => api.get<Order>(`/orders/${id}/`),

  myOrders: (params?: Record<string, any>) =>
    api.get<PaginatedResponse<Order>>('/users/me/orders/', { params }),

  storeOrders: (params?: Record<string, any>) =>
    api.get<PaginatedResponse<Order>>('/orders/store/', { params }),

  updateStoreOrderStatus: (id: string, data: { status: string; tracking_code?: string }) =>
    api.patch<Order>(`/orders/${id}/update-status/`, data),

  cancel: (id: string) => api.post(`/orders/${id}/cancel/`),
};

export const affiliatesAPI = {
  register: (data?: any) =>
    api.post<AffiliateProfile>('/affiliates/register/', data || {}),

  myProfile: () => api.get<AffiliateProfile>('/affiliates/me/'),

  myStats: () => api.get('/affiliates/me/stats/'),

  createLink: (productId: string) =>
    api.post<AffiliateLink>('/affiliates/links/', { product_id: productId }),

  myLinks: () => api.get<AffiliateLink[]>('/affiliates/me/links/'),

  myCommissions: (params?: Record<string, any>) =>
    api.get<PaginatedResponse<any>>('/affiliates/me/commissions/', { params }),

  requestPayout: (data: { amount: number; method: string; account_details: Record<string, string> }) =>
    api.post('/affiliates/me/payouts/', data),

  myPayouts: () => api.get('/affiliates/me/payouts/'),

  myKYC: () => api.get('/affiliates/me/kyc/'),
  submitKYC: (data: any) => api.post('/affiliates/me/kyc/', data),

  storeAffiliates: () =>
    api.get<StoreAffiliatesData>('/affiliates/store/'),

  // Admin
  adminList: (params?: Record<string, any>) =>
    api.get<PaginatedResponse<AffiliateProfile>>('/affiliates/admin/affiliates/', { params }),
  adminUpdateStatus: (id: string, status: string) =>
    api.patch<AffiliateProfile>(`/affiliates/admin/affiliates/${id}/status/`, { status }),
  adminSettings: () => api.get('/affiliates/admin/affiliates/settings/'),
  adminUpdateSettings: (data: any) =>
    api.patch('/affiliates/admin/affiliates/settings/', data),
  adminKYC: (params?: Record<string, any>) =>
    api.get<PaginatedResponse<any>>('/affiliates/admin/affiliates/kyc/', { params }),
  adminKYCAction: (id: string, data: { action: string; notes?: string }) =>
    api.patch(`/affiliates/admin/affiliates/kyc/${id}/`, data),
  adminCommissions: (params?: Record<string, any>) =>
    api.get<PaginatedResponse<any>>('/affiliates/admin/affiliates/commissions/', { params }),
  adminCommissionAction: (id: string, data: { action: string; reason?: string }) =>
    api.patch(`/affiliates/admin/affiliates/commissions/${id}/`, data),
  adminPayouts: (params?: Record<string, any>) =>
    api.get<PaginatedResponse<any>>('/affiliates/admin/affiliates/payouts/', { params }),
  adminPayoutAction: (id: string, data: { action: string; notes?: string }) =>
    api.patch(`/affiliates/admin/affiliates/payouts/${id}/`, data),
};

export interface StoreAffiliatesData {
  affiliates: StoreAffiliate[];
  total_affiliates: number;
  total_clicks: number;
  total_sales: number;
  total_commission: number;
}

export interface StoreAffiliate {
  id: string;
  name: string;
  email: string;
  total_clicks: number;
  total_sales: number;
  total_commission: number;
  is_active: boolean;
}

export const usersAPI = {
  me: () => api.get<User>('/users/me/'),
  updateMe: (data: any) => api.patch<User>('/users/me/', data),
  myAddresses: () => api.get('/users/me/addresses/'),
  addAddress: (data: any) => api.post('/users/me/addresses/', data),
  myDownloads: () => api.get('/users/me/downloads/'),
  myWishlist: () => api.get('/users/me/wishlist/'),
  addToWishlist: (productId: string) => api.post('/users/me/wishlist/', { product_id: productId }),
  removeFromWishlist: (productId: string) => api.delete(`/users/me/wishlist/${productId}/`),
};

export const walletAPI = {
  myWallet: () => api.get<WalletInfo>('/wallet/me/'),
  myTransactions: (params?: Record<string, any>) =>
    api.get<PaginatedResponse<WalletTransaction>>('/wallet/me/transactions/', { params }),
  requestPayout: (data: { amount: number; method: string; account_details: Record<string, string>; role?: string }) =>
    api.post('/wallet/me/payouts/', data),
  myPayouts: () => api.get<any[]>('/wallet/me/payouts/'),
  adminPayouts: (params?: Record<string, any>) =>
    api.get<PaginatedResponse<any>>('/wallet/admin/payouts/', { params }),
  adminPayoutApprove: (id: string) => api.post(`/wallet/admin/payouts/${id}/approve/`),
  adminPayoutPay: (id: string, reference: string) => api.post(`/wallet/admin/payouts/${id}/pay/`, { reference }),
  adminPayoutReject: (id: string, reason: string) => api.post(`/wallet/admin/payouts/${id}/reject/`, { reason }),
  adminReconciliation: () => api.get<any>('/wallet/admin/reconciliation/'),
};

export const reviewsAPI = {
  create: (data: { product_id: string; rating: number; title?: string; comment: string }) =>
    api.post<Review>('/reviews/', data),
  getByProduct: (productId: string, params?: Record<string, any>) =>
    api.get<PaginatedResponse<Review>>('/reviews/', { params: { product: productId, ...params } }),
};

export const coursesAPI = {
  list: (params?: Record<string, any>) =>
    api.get<PaginatedResponse<Course>>('/courses/', { params }),
  getBySlug: (slug: string) => api.get<CourseDetail>(`/courses/${slug}/`),
  myEnrollments: () => api.get<Enrollment[]>('/courses/me/enrollments/'),
  getEnrollment: (id: string) => api.get<Enrollment>(`/courses/me/enrollments/${id}/`),
  completeLesson: (lessonId: string) =>
    api.patch(`/courses/me/lessons/${lessonId}/`, { completed: true }),
};

export const quizzesAPI = {
  // List quizzes for a course
  listByCourse: (courseId: string) =>
    api.get<Quiz[]>(`/courses/${courseId}/quizzes/`),

  // Get quiz detail (with questions & options)
  getById: (quizId: string) =>
    api.get<Quiz>(`/courses/quizzes/${quizId}/`),

  // Create quiz in a module
  create: (moduleId: string, data: Partial<Quiz>) =>
    api.post<Quiz>(`/courses/modules/${moduleId}/quizzes/`, data),

  // Update quiz
  update: (quizId: string, data: Partial<Quiz>) =>
    api.put<Quiz>(`/courses/quizzes/${quizId}/update/`, data),

  // Delete quiz
  delete: (quizId: string) =>
    api.delete(`/courses/quizzes/${quizId}/delete/`),

  // ─── Questions ───

  // Add question to quiz
  createQuestion: (quizId: string, data: any) =>
    api.post<QuizQuestion>(`/courses/quizzes/${quizId}/questions/`, data),

  // Update question (includes options)
  updateQuestion: (questionId: string, data: any) =>
    api.put<QuizQuestion>(`/courses/quizzes/questions/${questionId}/`, data),

  // Delete question
  deleteQuestion: (questionId: string) =>
    api.delete(`/courses/quizzes/questions/${questionId}/delete/`),

  // ─── Attempts (Student) ───

  // Start a quiz attempt
  startAttempt: (quizId: string) =>
    api.post<{ attempt_id: string; attempt_number: number; quiz: Quiz; started_at: string }>(
      `/courses/quizzes/${quizId}/attempt/`
    ),

  // Submit quiz answers
  submit: (quizId: string, data: QuizSubmitPayload) =>
    api.post<{
      attempt_id: string; attempt_number: number; score: number;
      earned_points: number; total_points: number; passed: boolean;
      pass_percentage: number; completed_at: string;
    }>(`/courses/quizzes/${quizId}/submit/`, data),

  // Get quiz result
  getResult: (quizId: string) =>
    api.get<QuizAttempt>(`/courses/quizzes/${quizId}/results/`),

  // List attempts for a quiz
  listAttempts: (quizId: string) =>
    api.get<QuizAttempt[]>(`/courses/quizzes/${quizId}/attempts/`),
};

export const blogAPI = {
  list: (params?: Record<string, any>) =>
    api.get<PaginatedResponse<BlogPost>>('/blog/', { params }),
  getBySlug: (slug: string) => api.get<BlogPostDetail>(`/blog/${slug}/`),
};

export const adminAPI = {
  stats: () => api.get('/admin/stats/'),
  pendingStores: () => api.get('/admin/stores/pending/'),
  approveStore: (id: string) => api.patch(`/admin/stores/${id}/approve/`),
  // Full store management
  allStores: () => api.get('/admin/stores/all/'),
  getStore: (id: string) => api.get(`/admin/stores/${id}/manage/`),
  manageStore: (id: string, action: 'approve' | 'reject' | 'suspend' | 'reactivate' | 'close' | 'request_docs' | 'clear_documents', reason?: string, documents?: string[]) =>
    api.patch(`/admin/stores/${id}/manage/`, { action, reason, documents }),
  updateStoreDetails: (id: string, data: any, isFormData?: boolean) =>
    api.patch(`/admin/stores/${id}/manage/`, data, isFormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {}),
  // All orders
  allOrders: (params?: Record<string, any>) => api.get('/admin/orders/all/', { params }),
  pendingPayouts: () => api.get('/admin/payouts/pending/'),
  approvePayout: (id: string) => api.patch(`/admin/payouts/${id}/approve/`),
  // Users
  listUsers: (params?: Record<string, any>) => api.get('/admin/users/', { params }),
  createUser: (data: any) => api.post('/admin/users/', data),
  getUser: (id: string) => api.get(`/admin/users/${id}/`),
  updateUser: (id: string, data: any) => api.patch(`/admin/users/${id}/`, data),
  deleteUser: (id: string) => api.delete(`/admin/users/${id}/`),
  // Categories
  listCategories: () => api.get('/admin/categories/'),
  createCategory: (data: FormData | any) => api.post('/admin/categories/', data, data instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {}),
  updateCategory: (id: string, data: FormData | any) => api.patch(`/admin/categories/${id}/`, data, data instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {}),
  deleteCategory: (id: string) => api.delete(`/admin/categories/${id}/`),
  // Blog
  listBlogPosts: (params?: Record<string, any>) => api.get('/admin/blog/', { params }),
  createBlogPost: (data: FormData | any) => api.post('/admin/blog/', data, data instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {}),
  updateBlogPost: (id: string, data: FormData | any) => api.patch(`/admin/blog/${id}/`, data, data instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {}),
  deleteBlogPost: (id: string) => api.delete(`/admin/blog/${id}/`),
  // Courses
  listCourses: (params?: Record<string, any>) => api.get('/admin/courses/', { params }),
  createCourse: (data: any) => api.post('/admin/courses/', data),
  updateCourse: (id: string, data: any) => api.patch(`/admin/courses/${id}/`, data),
  deleteCourse: (id: string) => api.delete(`/admin/courses/${id}/`),
};

export default api;
