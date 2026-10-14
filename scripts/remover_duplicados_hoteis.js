import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://obkvgluunbnktzulzjfg.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ia3ZnbHV1bmJua3R6dWx6amZnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Nzg0OTMyOCwiZXhwIjoyMTAzNDI1MzI4fQ.VlbPt6MgzjMJHbUt9nuCWhBNEv_6dmkeZnaVH9zJe3E';

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function normalizar(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^\w\s]/gi, '') // remove pontuação
    .replace(/\s+/g, ' ')
    .trim();
}

async function runDeduplication() {
  console.log('=== INICIANDO VARREDURA E LIMPEZA DE HOTÉIS DUPLICADOS ===');

  // 1. Buscar todos os hotéis
  let allHoteis = [];
  let from = 0;
  const step = 1000;
  while (true) {
    const { data, error } = await sb
      .from('hoteis')
      .select('*')
      .range(from, from + step - 1)
      .order('criado_em', { ascending: true });

    if (error) {
      console.error('Erro ao buscar hotéis:', error);
      return;
    }
    if (!data || data.length === 0) break;
    allHoteis = allHoteis.concat(data);
    if (data.length < step) break;
    from += step;
  }

  console.log(`Total de hotéis carregados do banco: ${allHoteis.length}`);

  // 2. Buscar contagem de quartos por hotel para priorizar quem tem quartos configurados
  const { data: todosQuartos, error: errQuartos } = await sb.from('quartos').select('hotel_id');
  const quartosPorHotel = new Map();
  if (todosQuartos) {
    for (const q of todosQuartos) {
      if (q.hotel_id) {
        quartosPorHotel.set(q.hotel_id, (quartosPorHotel.get(q.hotel_id) || 0) + 1);
      }
    }
  }

  // 3. Agrupar por cidade + nome normalizado
  const grupos = new Map();
  for (const h of allHoteis) {
    const normNome = normalizar(h.nome);
    const normCidade = normalizar(h.cidade);
    const normUf = normalizar(h.uf || 'MT');
    const chave = `${normUf}__${normCidade}__${normNome}`;

    if (!grupos.has(chave)) {
      grupos.set(chave, []);
    }
    grupos.get(chave).push(h);
  }

  const duplicadosGrupos = [];
  for (const [chave, lista] of grupos.entries()) {
    if (lista.length > 1) {
      duplicadosGrupos.push({ chave, lista });
    }
  }

  console.log(`Grupos duplicados encontrados: ${duplicadosGrupos.length}`);
  const totalExcedentes = duplicadosGrupos.reduce((acc, g) => acc + (g.lista.length - 1), 0);
  console.log(`Total de registros duplicados a remover: ${totalExcedentes}`);

  const tabelasDependentes = [
    'quartos',
    'reservas',
    'hospedes',
    'usuarios',
    'produtos',
    'pedidos_cardapio',
    'contas_pagar',
    'contas_receber',
    'categorias_cardapio'
  ];

  let removidosCount = 0;
  let dependenciasMigradasTotal = 0;

  for (const grupo of duplicadosGrupos) {
    const lista = grupo.lista;
    // Critério de eleição do Keeper:
    // 1. Preferir quem tem plano pago (não gratuito / não grátis)
    // 2. Preferir quem tem mais quartos cadastrados
    // 3. Preferir quem tem config JSON nas observações
    // 4. Preferir quem tem imagem
    // 5. Mais antigo (criado_em menor)
    lista.sort((a, b) => {
      const isPaid = (p) => p && !p.toLowerCase().includes('gratuito') && !p.toLowerCase().includes('grátis') && !p.toLowerCase().includes('gratis');
      const planoA = isPaid(a.plano) ? 1 : 0;
      const planoB = isPaid(b.plano) ? 1 : 0;
      if (planoA !== planoB) return planoB - planoA;

      const qA = quartosPorHotel.get(a.id) || 0;
      const qB = quartosPorHotel.get(b.id) || 0;
      if (qA !== qB) return qB - qA;

      const confA = (a.observacoes && a.observacoes.includes('HOTEL_CONFIG_JSON')) ? 1 : 0;
      const confB = (b.observacoes && b.observacoes.includes('HOTEL_CONFIG_JSON')) ? 1 : 0;
      if (confA !== confB) return confB - confA;

      const imgA = a.url_imagem ? 1 : 0;
      const imgB = b.url_imagem ? 1 : 0;
      if (imgA !== imgB) return imgB - imgA;

      const dateA = new Date(a.criado_em || 0).getTime();
      const dateB = new Date(b.criado_em || 0).getTime();
      return dateA - dateB;
    });

    const keeper = lista[0];
    const duplicates = lista.slice(1);

    console.log(`\n[Grupo] Cidade: "${keeper.cidade}", Hotel: "${keeper.nome}"`);
    console.log(` -> Mantendo Keeper ID: ${keeper.id} (Criado: ${keeper.criado_em})`);

    // Verificar se keeper precisa de merge de dados complementares
    let updateKeeper = {};
    for (const dup of duplicates) {
      if (!keeper.url_imagem && dup.url_imagem) {
        updateKeeper.url_imagem = dup.url_imagem;
        keeper.url_imagem = dup.url_imagem;
      }
      if (!keeper.whatsapp && dup.whatsapp) {
        updateKeeper.whatsapp = dup.whatsapp;
        keeper.whatsapp = dup.whatsapp;
      }
      if (!keeper.logradouro && dup.logradouro) {
        updateKeeper.logradouro = dup.logradouro;
        keeper.logradouro = dup.logradouro;
      }
      if (!keeper.bairro && dup.bairro) {
        updateKeeper.bairro = dup.bairro;
        keeper.bairro = dup.bairro;
      }
      if (!keeper.link && dup.link) {
        updateKeeper.link = dup.link;
        keeper.link = dup.link;
      }
      if (dup.observacoes && dup.observacoes.includes('HOTEL_CONFIG_JSON') && (!keeper.observacoes || !keeper.observacoes.includes('HOTEL_CONFIG_JSON'))) {
        updateKeeper.observacoes = dup.observacoes;
        keeper.observacoes = dup.observacoes;
      }
    }

    if (Object.keys(updateKeeper).length > 0) {
      await sb.from('hoteis').update(updateKeeper).eq('id', keeper.id);
      console.log(`    Keeper enriquecido com dados adicionais:`, Object.keys(updateKeeper));
    }

    // Processar cada duplicado
    for (const dup of duplicates) {
      console.log(` -> Removendo Duplicado ID: ${dup.id} (Criado: ${dup.criado_em})`);

      // 1. Migrar FKs
      for (const tabela of tabelasDependentes) {
        try {
          const { data: updated, error: updErr } = await sb
            .from(tabela)
            .update({ hotel_id: keeper.id })
            .eq('hotel_id', dup.id)
            .select('id');

          if (!updErr && updated && updated.length > 0) {
            console.log(`    Migrados ${updated.length} registros da tabela '${tabela}' para o keeper.`);
            dependenciasMigradasTotal += updated.length;
          }
        } catch (e) {
          // Se tabela não existir ou outro detalhe, ignora
        }
      }

      // 2. Deletar duplicado da tabela hoteis
      const { error: delErr } = await sb.from('hoteis').delete().eq('id', dup.id);
      if (delErr) {
        console.error(`    ERRO ao deletar hotel ${dup.id}:`, delErr.message);
      } else {
        removidosCount++;
      }
    }
  }

  console.log('\n=== RESUMO DA DEDUPLICAÇÃO ===');
  console.log(`Total de duplicados excluídos: ${removidosCount} de ${totalExcedentes}`);
  console.log(`Total de dependências migradas para os hotéis principais: ${dependenciasMigradasTotal}`);

  // Validação final da contagem
  const { count: finalCount } = await sb.from('hoteis').select('*', { count: 'exact', head: true });
  console.log(`Total final de hotéis únicos no banco: ${finalCount}`);
  console.log('Varredura e limpeza concluídas com sucesso!');
}

runDeduplication().catch(console.error);
