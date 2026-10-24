# Newsletter do blog

- A primeira publicação de um artigo cria automaticamente uma campanha para as subscrições ativas.
- Edições posteriores não enviam email automaticamente. Na gestão do blog, use **Notificar subscritores** para comunicar uma atualização deliberadamente.
- Cada destinatário recebe um email individual com título, resumo, ligação do artigo e ligação individual para cancelar a subscrição.
- Campanhas e entregas ficam registadas no banco; endereços removidos ou cancelados antes do envio são ignorados. O Django Admin expõe as campanhas e os resultados em modo de leitura.
- A rota manual `POST /api/v1/admin/blog/{id}/notify-subscribers/` exige `IsAdminUser` e só aceita artigos publicados.
- O envio usa a fila Celery em produção e o mecanismo central de dispatch do projeto. Configure o email de saída, `SITE_URL`, worker Celery e broker antes de ativar em produção.

Aplicar a migração `apps.blog.0009_newslettercampaign_newslettercampaigndelivery_and_more` com `python manage.py migrate`. Falhas de entrega ficam contabilizadas na campanha; o administrador pode iniciar uma nova campanha após investigar o problema.
