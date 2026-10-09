import { createClient } from '@supabase/supabase-js';

async function verifyIsAdmin(req, supabaseAdmin) {
  try {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    const token = typeof authHeader === 'string' ? authHeader.replace(/^Bearer\s+/i, '').trim() : '';
    if (!token) return false;

    const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !user) return false;

    const { data: dbUser } = await supabaseAdmin
      .from('usuarios')
      .select('perfil, cargo')
      .or(`auth_user_id.eq.${user.id},email.eq.${user.email}`)
      .maybeSingle();

    const perfil = (dbUser?.perfil || user.user_metadata?.perfil || '').toLowerCase();
    const cargo = (dbUser?.cargo || '').toLowerCase();
    const userEmail = (user.email || '').toLowerCase();

    return userEmail === 'contato@hotelnozap.com.br' ||
      perfil.includes('admin') ||
      perfil.includes('super') ||
      perfil.includes('master') ||
      cargo.includes('admin');
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método não permitido. Use POST.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://obkvgluunbnktzulzjfg.supabase.co';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceKey) {
    console.error('[ATIVAR-PARCEIRO] ERRO CRÍTICO: SUPABASE_SERVICE_ROLE_KEY ausente em runtime Vercel');
    return res.status(500).json({
      success: false,
      error: 'SUPABASE_SERVICE_ROLE_KEY não configurada no ambiente do servidor.'
    });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const {
    nome,
    email,
    whatsapp,
    cpf,
    cep,
    logradouro,
    numero,
    complemento,
    bairro,
    cidade,
    uf,
    senha,
    cupom,
    paymentId
  } = body || {};

  if (!nome || !email || !cpf) {
    return res.status(400).json({
      success: false,
      error: 'Campos obrigatórios ausentes: nome, email, cpf.'
    });
  }

  // ── BLINDAGEM DE SEGURANÇA: EXIGIR PAGAMENTO MERCADO PAGO APROVADO OU AUTORIZAÇÃO ADMIN ──
  let pagamentoValido = false;

  if (paymentId && /^\d+$/.test(String(paymentId).trim())) {
    try {
      const { data: dbParams } = await supabaseAdmin
        .from('parametros_sistema')
        .select('gateway_token')
        .limit(1)
        .maybeSingle();

      const masterToken = (dbParams?.gateway_token || process.env.MERCADOPAGO_ACCESS_TOKEN || '').trim();
      if (masterToken && masterToken.length > 15) {
        const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
          headers: { 'Authorization': `Bearer ${masterToken}` }
        });
        if (mpRes.ok) {
          const mpData = await mpRes.json();
          if (mpData.status === 'approved' && Number(mpData.transaction_amount) >= 190) {
            // Verificação anti-replay: impede reutilizar o mesmo comprovante para múltiplas contas
            const { data: alreadyUsedPartner } = await supabaseAdmin
              .from('parceiros')
              .select('id, email, nome')
              .ilike('categoria', `%MP_${paymentId}%`)
              .maybeSingle();

            if (alreadyUsedPartner && alreadyUsedPartner.email?.toLowerCase() !== String(email).trim().toLowerCase()) {
              return res.status(400).json({
                success: false,
                error: `Este comprovante de pagamento já foi utilizado pelo parceiro ${alreadyUsedPartner.nome}. Não é permitido reutilizar pagamentos.`
              });
            }

            pagamentoValido = true;
          } else {
            return res.status(400).json({
              success: false,
              error: `Pagamento ${paymentId} não foi aprovado pelo Mercado Pago (status: ${mpData.status || 'desconhecido'}).`
            });
          }
        }
      }
    } catch (mpErr) {
      console.warn('[ATIVAR-PARCEIRO] Erro ao consultar pagamento MP:', mpErr);
    }
  }

  if (!pagamentoValido) {
    const isAdmin = await verifyIsAdmin(req, supabaseAdmin);
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado: a ativação de franquia requer comprovação de pagamento PIX aprovado ou autorização administrativa.'
      });
    }
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const cleanPhone = String(whatsapp || '').replace(/\D/g, '');
  const cleanCpf = String(cpf).replace(/\D/g, '');
  const cleanCep = String(cep || '').replace(/\D/g, '');
  const cleanNome = String(nome).trim();
  const cleanLogradouro = String(logradouro || '').trim();
  const cleanNumero = String(numero || '').trim();
  const cleanBairro = String(bairro || '').trim();
  const cleanCidade = String(cidade || '').trim();
  const cleanUf = String(uf || '').trim().toUpperCase();
  const code = String(cupom || `PARC${Math.floor(100 + Math.random() * 900)}`).trim().toUpperCase();

  const cleanDoc = cleanCpf;
  const maskedDoc = cleanDoc.length === 11
    ? `${cleanDoc.slice(0, 3)}.${cleanDoc.slice(3, 6)}.${cleanDoc.slice(6, 9)}-${cleanDoc.slice(9)}`
    : `${cleanDoc.slice(0, 2)}.${cleanDoc.slice(2, 5)}.${cleanDoc.slice(5, 8)}/${cleanDoc.slice(8, 12)}-${cleanDoc.slice(12)}`;

  // Validação estrita de unicidade: Não permitir dois cadastros com o mesmo CPF ou CNPJ
  const { data: existingDocPartner } = await supabaseAdmin
    .from('parceiros')
    .select('id, nome, email, documento')
    .or(`documento.eq.${cleanDoc},documento.eq.${maskedDoc}`)
    .limit(1);

  if (existingDocPartner && existingDocPartner.length > 0) {
    if (existingDocPartner[0].email?.toLowerCase() !== cleanEmail) {
      return res.status(400).json({
        success: false,
        error: `Este CPF/CNPJ já está cadastrado para outro parceiro (${existingDocPartner[0].nome}). Não é permitido criar dois cadastros com o mesmo documento.`
      });
    }
  }

  const { data: existingDocUser } = await supabaseAdmin
    .from('usuarios')
    .select('id, nome, email, cpf')
    .or(`cpf.eq.${cleanDoc},cpf.eq.${maskedDoc}`)
    .limit(1);

  if (existingDocUser && existingDocUser.length > 0) {
    if (existingDocUser[0].email?.toLowerCase() !== cleanEmail) {
      return res.status(400).json({
        success: false,
        error: `Este CPF/CNPJ já está cadastrado para outro usuário (${existingDocUser[0].nome}). Não é permitido duplicar o documento no sistema.`
      });
    }
  }

  try {
    let authUserId = null;

    // 1. Criar ou Obter Usuário no Supabase Auth
    try {
      const { data: listUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existingAuth = listUsers?.users?.find(u => u.email?.toLowerCase() === cleanEmail);

      if (existingAuth) {
        authUserId = existingAuth.id;
        // Atualiza metadados do auth se necessário
        await supabaseAdmin.auth.admin.updateUserById(authUserId, {
          user_metadata: {
            name: cleanNome,
            nome: cleanNome,
            perfil: 'Parceiro',
            whatsapp: cleanPhone,
            cpf: cleanCpf
          }
        });
      } else if (senha) {
        const { data: newAuth, error: createAuthErr } = await supabaseAdmin.auth.admin.createUser({
          email: cleanEmail,
          password: senha,
          email_confirm: true,
          user_metadata: {
            name: cleanNome,
            nome: cleanNome,
            perfil: 'Parceiro',
            whatsapp: cleanPhone,
            cpf: cleanCpf
          }
        });

        if (!createAuthErr && newAuth?.user) {
          authUserId = newAuth.user.id;
        } else {
          console.warn('[ATIVAR-PARCEIRO] Erro ao criar user no Auth Admin:', createAuthErr?.message);
        }
      }
    } catch (authErr) {
      console.warn('[ATIVAR-PARCEIRO] Exceção Auth:', authErr);
    }

    // 2. Criar ou Atualizar Registro na Tabela `usuarios` (Perfil: 'Parceiro')
    let usuarioId = null;
    const { data: existingUser } = await supabaseAdmin
      .from('usuarios')
      .select('id, auth_user_id')
      .eq('email', cleanEmail)
      .maybeSingle();

    const userPayload = {
      nome: cleanNome,
      email: cleanEmail,
      telefone: cleanPhone || '11999999999',
      cpf: cleanCpf,
      perfil: 'Parceiro',
      cargo: 'Parceiro Franqueado',
      status: 'ativo',
      auth_user_id: authUserId || existingUser?.auth_user_id || null,
      cep: cleanCep,
      logradouro: cleanLogradouro,
      numero: cleanNumero,
      bairro: cleanBairro,
      cidade: cleanCidade,
      uf: cleanUf
    };

    if (!existingUser?.id) {
      const { data: newUser, error: insertUserErr } = await supabaseAdmin
        .from('usuarios')
        .insert(userPayload)
        .select('id')
        .single();

      if (insertUserErr) {
        console.error('[ATIVAR-PARCEIRO] Erro ao inserir na tabela usuarios:', insertUserErr);
        throw new Error('Falha ao inserir na tabela usuarios: ' + insertUserErr.message);
      }
      usuarioId = newUser.id;
    } else {
      usuarioId = existingUser.id;
      await supabaseAdmin
        .from('usuarios')
        .update(userPayload)
        .eq('id', usuarioId);
    }

    // 3. Criar ou Atualizar Registro na Tabela `parceiros`
    let parceiroId = null;
    const { data: existingParc } = await supabaseAdmin
      .from('parceiros')
      .select('id')
      .eq('email', cleanEmail)
      .maybeSingle();

    const partnerPayload = {
      nome: cleanNome,
      nome_contato: cleanNome,
      email: cleanEmail,
      whatsapp: cleanPhone || '11999999999',
      documento: cleanCpf,
      categoria: paymentId ? `Franquia Regional [MP_${paymentId}]` : 'Franquia Regional',
      cidade_uf: `${cleanCidade || 'São Paulo'} / ${cleanUf || 'SP'}`,
      cidade: cleanCidade,
      uf: cleanUf,
      cep: cleanCep,
      logradouro: cleanLogradouro,
      numero: cleanNumero,
      bairro: cleanBairro,
      cupom: code,
      taxa_comissao: 50,
      status: 'ativo',
      pix_tipo: cleanDoc.length === 14 ? 'CNPJ' : 'CPF',
      pix_chave: cleanDoc,
      titular_pix: cleanNome,
      usuario_id: usuarioId,
      auth_user_id: authUserId
    };

    if (!existingParc?.id) {
      const { data: newParc, error: insertParcErr } = await supabaseAdmin
        .from('parceiros')
        .insert(partnerPayload)
        .select('id')
        .single();

      if (insertParcErr) {
        console.error('[ATIVAR-PARCEIRO] Erro ao inserir na tabela parceiros:', insertParcErr);
        throw new Error('Falha ao inserir na tabela parceiros: ' + insertParcErr.message);
      }
      parceiroId = newParc.id;
    } else {
      parceiroId = existingParc.id;
      await supabaseAdmin
        .from('parceiros')
        .update(partnerPayload)
        .eq('id', parceiroId);
    }

    console.log(`[ATIVAR-PARCEIRO] SUCESSO! usuarioId=${usuarioId} parceiroId=${parceiroId} authUserId=${authUserId}`);

    return res.status(200).json({
      success: true,
      message: 'Parceiro ativado com sucesso em cascata.',
      usuarioId,
      parceiroId,
      authUserId,
      cupom: code
    });
  } catch (error) {
    console.error('[ATIVAR-PARCEIRO] Exceção:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro interno ao ativar parceiro.'
    });
  }
}
