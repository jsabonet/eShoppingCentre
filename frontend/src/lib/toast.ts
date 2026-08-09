import { toast as sonnerToast } from 'sonner';

/**
 * Utilitário de toast para feedback visual ao utilizador.
 * Usa o sonner (já instalado e configurado em providers.tsx).
 * 
 * Uso:
 *   import { toast } from '@/src/lib/toast';
 *   toast.success('Review enviada!');
 *   toast.error('Erro ao criar review', 'Já existe uma review deste utilizador.');
 *   toast.warning('Atenção', 'O título é obrigatório.');
 *   toast.info('A processar...');
 */

export const toast = {
  success: (title: string, description?: string) =>
    sonnerToast.success(title, { description }),

  error: (title: string, description?: string) =>
    sonnerToast.error(title, { description }),

  warning: (title: string, description?: string) =>
    sonnerToast.warning(title, { description }),

  info: (title: string, description?: string) =>
    sonnerToast.info(title, { description }),

  loading: (title: string, description?: string) =>
    sonnerToast.loading(title, { description }),
};
