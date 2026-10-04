# LeadFinder — Workflow do Projeto

## 1. Fluxo do usuário

Usuário → Dashboard → Escolhe categoria → Informa cidade/localização → Define raio → Pesquisa → Resultados → Filtra leads → Abre lead → Analisa oportunidade → Aborda pelo WhatsApp → Salva lead → Atualiza status → Adiciona notas.

## 2. Pesquisa

Frontend envia os parâmetros para `/api/search.js`.

Parâmetros previstos:
- categoria
- cidade/estado
- raio
- possui site / não possui site
- Instagram
- WhatsApp
- avaliação mínima
- quantidade de avaliações
- aberto agora

A API retorna os estabelecimentos encontrados para o frontend.

## 3. Lead

Cada resultado deve apresentar:
- nome
- categoria
- endereço
- avaliação
- quantidade de avaliações
- site
- Instagram
- telefone
- WhatsApp
- status
- score de oportunidade

Leads sem site recebem destaque de oportunidade.

## 4. Gestão

Status:
- Novo
- Contatado
- Respondeu
- Negociação
- Cliente
- Perdido

Ações:
- salvar
- abrir detalhes
- abordar pelo WhatsApp
- adicionar notas
- alterar status
- remover dos salvos

## 5. Dashboard

Indicadores:
- leads encontrados
- leads sem site
- leads salvos
- leads contatados
- respostas
- clientes
- oportunidades de maior score

## 6. Arquitetura

Frontend → /api/search.js → API externa de empresas → resultados → filtros/análise → interface.

Fase futura:
Frontend → API → Supabase → autenticação → leads salvos → créditos → assinaturas.

## 7. Deploy

GitHub → Vercel → Deploy → Testes → Correções → API real → Supabase → Autenticação → Créditos/assinaturas.

## 8. Regra importante

Não usar dados reais falsos como se fossem resultados reais. Enquanto a API não estiver conectada, utilizar apenas dados de demonstração claramente identificados.
