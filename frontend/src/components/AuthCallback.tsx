import { useEffect } from 'react';

// TODO: substituir por chamada à API Django JWT
// POST /api/v1/auth/callback/ com o token recebido por query param
export default function AuthCallback() {
  useEffect(() => {
    // Placeholder: redireciona directamente após implementar o handshake JWT
    window.location.href = '/admin';
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
        <p className="text-muted-foreground">Autenticando...</p>
      </div>
    </div>
  );
}
