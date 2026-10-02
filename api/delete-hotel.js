import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,DELETE,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Método não permitido. Use POST ou DELETE.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }

  const hotelId = body?.hotelId || req.query?.hotelId;

  if (!hotelId) {
    return res.status(400).json({ error: 'ID do hotel (hotelId) é obrigatório.' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://obkvgluunbnktzulzjfg.supabase.co';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceKey) {
    return res.status(500).json({
      error: 'SUPABASE_SERVICE_ROLE_KEY não configurada no ambiente do servidor.'
    });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  try {
    // 1. Obter informações do hotel antes de deletar (emails de login e gerente)
    const { data: hotel, error: hotelErr } = await supabaseAdmin
      .from('hoteis')
      .select('id, nome, email_login, email_gerente')
      .eq('id', hotelId)
      .maybeSingle();

    if (hotelErr) {
      console.warn('Aviso ao consultar hotel antes da exclusão:', hotelErr);
    }

    // 2. Localizar usuários vinculados ao hotel na tabela usuarios
    const { data: dbUsers, error: usersErr } = await supabaseAdmin
      .from('usuarios')
      .select('id, auth_user_id, email, perfil')
      .eq('hotel_id', hotelId);

    if (usersErr) {
      console.warn('Aviso ao buscar usuarios do hotel:', usersErr);
    }

    const authIdsToDelete = new Set();
    const emailsToCheck = new Set();

    if (hotel?.email_login) {
      emailsToCheck.add(hotel.email_login.trim().toLowerCase());
    }
    if (hotel?.email_gerente) {
      emailsToCheck.add(hotel.email_gerente.trim().toLowerCase());
    }

    if (Array.isArray(dbUsers)) {
      for (const u of dbUsers) {
        if (u.auth_user_id) {
          authIdsToDelete.add(u.auth_user_id);
        }
        if (u.email) {
          emailsToCheck.add(u.email.trim().toLowerCase());
        }
      }
    }

    // 3. Se houver emails a verificar, consultar auth.users via admin.listUsers
    if (emailsToCheck.size > 0) {
      try {
        const { data: authList, error: authListErr } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
        if (!authListErr && authList?.users) {
          for (const au of authList.users) {
            if (au.email && emailsToCheck.has(au.email.trim().toLowerCase())) {
              authIdsToDelete.add(au.id);
            }
          }
        }
      } catch (e) {
        console.warn('Aviso ao listar auth users por email:', e);
      }
    }

    // 4. Excluir usuários do Supabase Auth (auth.users)
    const deletedAuthUsers = [];
    for (const authId of authIdsToDelete) {
      try {
        const { error: delAuthErr } = await supabaseAdmin.auth.admin.deleteUser(authId);
        if (!delAuthErr) {
          deletedAuthUsers.push(authId);
        } else {
          console.warn(`Erro ao deletar auth user ${authId}:`, delAuthErr);
        }
      } catch (err) {
        console.warn(`Exceção ao deletar auth user ${authId}:`, err);
      }
    }

    // 5. Exclusão em CASCATA de todas as tabelas dependentes
    const deleteQueries = [
      supabaseAdmin.from('destaques_quarto').delete().eq('hotel_id', hotelId),
      supabaseAdmin.from('reservas').delete().eq('hotel_id', hotelId),
      supabaseAdmin.from('quartos').delete().eq('hotel_id', hotelId),
      supabaseAdmin.from('hospedes').delete().eq('hotel_id', hotelId),
      supabaseAdmin.from('produtos').delete().eq('hotel_id', hotelId),
      supabaseAdmin.from('contas_pagar').delete().eq('hotel_id', hotelId),
      supabaseAdmin.from('contas_receber').delete().eq('hotel_id', hotelId),
      supabaseAdmin.from('categorias_quartos').delete().eq('hotel_id', hotelId),
      supabaseAdmin.from('itens_quartos').delete().eq('hotel_id', hotelId),
      supabaseAdmin.from('cupons_desconto').delete().eq('hotel_id', hotelId),
      supabaseAdmin.from('hotel_configuracoes').delete().eq('hotel_id', hotelId),
      supabaseAdmin.from('logs_sistema').delete().eq('hotel_id', hotelId),
      supabaseAdmin.from('usuarios').delete().eq('hotel_id', hotelId)
    ];

    await Promise.allSettled(deleteQueries);

    // Se o hotel tinha email_login registrado, garantir remoção de qualquer usuário com esse email
    if (hotel?.email_login) {
      try {
        await supabaseAdmin.from('usuarios').delete().ilike('email', hotel.email_login.trim());
      } catch {}
    }

    // 6. Excluir o próprio hotel
    const { error: delHotelErr } = await supabaseAdmin
      .from('hoteis')
      .delete()
      .eq('id', hotelId);

    if (delHotelErr) {
      console.error('Erro ao deletar registro do hotel:', delHotelErr);
      return res.status(500).json({
        success: false,
        error: `Erro ao deletar hotel: ${delHotelErr.message}`
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Hotel e dependências excluídos com sucesso em cascata (banco e auth.users).',
      hotelId,
      hotelNome: hotel?.nome || null,
      deletedAuthUsersCount: deletedAuthUsers.length,
      deletedDbUsersCount: dbUsers?.length || 0
    });
  } catch (error) {
    console.error('Exceção ao deletar hotel em cascata:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro interno no servidor ao deletar hotel.'
    });
  }
}
