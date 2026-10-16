import { createClient } from '@supabase/supabase-js';

// Helper para sanitizar strings e prevenir SQL injection / XSS
function escapeString(str) {
  if (!str) return '';
  return String(str).trim();
}

// Limpa telefone deixando apenas dígitos
function cleanPhoneDigits(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  return digits;
}

// Formata telefone para exibição amigável
function formatPhoneDisplay(phone) {
  if (!phone) return '';
  const digits = cleanPhoneDigits(phone);
  if (digits.length === 13 && digits.startsWith('55')) {
    const ddd = digits.substring(2, 4);
    const p1 = digits.substring(4, 9);
    const p2 = digits.substring(9, 13);
    return `(${ddd}) ${p1}-${p2}`;
  }
  if (digits.length === 12 && digits.startsWith('55')) {
    const ddd = digits.substring(2, 4);
    const p1 = digits.substring(4, 8);
    const p2 = digits.substring(8, 12);
    return `(${ddd}) ${p1}-${p2}`;
  }
  return phone;
}

// Gera slug limpo para o link do hotel
function generateSlug(name) {
  if (!name) return 'hotel';
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// Extrai cidade e UF de strings como "Ubatuba - SP", "Porto de Galinhas / PE", etc.
function parseCityUf(input) {
  if (!input) return { cidade: 'Sinop', uf: 'MT', cityUf: 'Sinop / MT' };
  const cleaned = String(input).trim();
  const parts = cleaned.split(/[\/\-–]/).map(p => p.trim());
  if (parts.length >= 2) {
    const cidade = parts[0];
    const uf = parts[1].toUpperCase().substring(0, 2);
    return { cidade, uf, cityUf: `${cidade} / ${uf}` };
  }
  return { cidade: cleaned, uf: 'BR', cityUf: cleaned };
}

// Tabela temporária em memória do servidor como fallback para sessões pendentes
const sessoesPendentesMemory = new Map();

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Método não permitido. Utilize POST enviando action: "processar_foto" ou "confirmar_cidade".'
    });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }

  const {
    action = 'processar_foto',
    telefone_remetente,
    imagem_url,
    imagem_base64,
    cidade_uf,
    legenda = '',
    openai_key: bodyOpenaiKey
  } = body || {};

  const cleanRemetente = cleanPhoneDigits(telefone_remetente || '5500000000000');

  // Supabase Service Role
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://obkvgluunbnktzulzjfg.supabase.co';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!serviceKey) {
    return res.status(500).json({
      success: false,
      error: 'SUPABASE_SERVICE_ROLE_KEY não configurada no servidor.'
    });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // AÇÃO 1: PROCESSAR FOTO DA FACHADA COM IA & FAZER UPLOAD DA FOTO PRINCIPAL
  // ─────────────────────────────────────────────────────────────────────────────
  if (action === 'processar_foto' || action === 'analisar_fachada') {
    if (!imagem_url && !imagem_base64) {
      return res.status(400).json({
        success: false,
        error: 'É necessário enviar a foto da fachada (imagem_url ou imagem_base64).'
      });
    }

    try {
      // 1. Upload da foto para o Supabase Storage (Bucket: hotelnozap / pasta: hoteis/fachadas)
      let finalPublicImageUrl = imagem_url || '';
      let imageBuffer = null;

      if (imagem_base64) {
        const cleanBase64 = imagem_base64.replace(/^data:image\/\w+;base64,/, '');
        imageBuffer = Buffer.from(cleanBase64, 'base64');
      } else if (imagem_url && !imagem_url.includes('obkvgluunbnktzulzjfg.supabase.co')) {
        // Se a imagem veio de uma URL externa (ex: WhatsApp Evolution API), baixa o buffer para persistir no Supabase Storage
        try {
          const imgResp = await fetch(imagem_url);
          if (imgResp.ok) {
            const arrayBuf = await imgResp.arrayBuffer();
            imageBuffer = Buffer.from(arrayBuf);
          }
        } catch (e) {
          console.warn('[Agente Fachada] Falha ao baixar imagem remota para o Storage:', e);
        }
      }

      if (imageBuffer) {
        const fileName = `hoteis/fachadas/${Date.now()}_${Math.random().toString(36).substring(2, 7)}.jpg`;
        const { data: uploadData, error: uploadErr } = await supabaseAdmin.storage
          .from('hotelnozap')
          .upload(fileName, imageBuffer, {
            contentType: 'image/jpeg',
            upsert: true,
            cacheControl: '31536000'
          });

        if (!uploadErr && uploadData?.path) {
          const { data: pubData } = supabaseAdmin.storage.from('hotelnozap').getPublicUrl(uploadData.path);
          if (pubData?.publicUrl) {
            finalPublicImageUrl = pubData.publicUrl;
          }
        }
      }

      // 2. Chave OpenAI para Visão Computacional (GPT-4o-mini Vision)
      let resolvedOpenaiKey = bodyOpenaiKey || process.env.OPENAI_API_KEY || '';
      if (!resolvedOpenaiKey) {
        // Tenta obter dos parametros_sistema no Supabase
        const { data: params } = await supabaseAdmin
          .from('parametros_sistema')
          .select('chave_api_openai, gateway_token')
          .eq('id', '00000000-0000-0000-0000-000000000001')
          .maybeSingle();

        if (params?.chave_api_openai) {
          resolvedOpenaiKey = params.chave_api_openai;
        }
      }

      let hotelNomeExtraido = '';
      let hotelTelefoneExtraido = '';
      let cidadeDetectadaNaFoto = '';

      if (resolvedOpenaiKey) {
        // Prepara o conteúdo da imagem para a OpenAI Vision API
        let imageUrlForAi = finalPublicImageUrl;
        if (!imageUrlForAi && imagem_base64) {
          imageUrlForAi = imagem_base64.startsWith('data:') ? imagem_base64 : `data:image/jpeg;base64,${imagem_base64}`;
        }

        const promptInstrucoes = `Você é um perito em Visão Computacional e OCR para o setor hoteleiro.
Analise a imagem da fachada/placa deste hotel ou pousada e extraia com máxima precisão:
1. "nome": Nome oficial da pousada ou hotel que aparece na fachada/placa/totem.
2. "telefone": Telefone fixo ou celular com DDD impresso na fachada (ou null se não houver).
3. "whatsapp": Número de WhatsApp se estiver expressamente indicado (ou null).
4. "cidade_uf": Cidade e Estado se estiver escrito na fachada (ou null).

IMPORTANTE: Responda EXCLUSIVAMENTE em formato JSON puro, sem markdown nem explicações:
{"nome": "Nome do Hotel", "telefone": "Telefone ou null", "whatsapp": "WhatsApp ou null", "cidade_uf": "Cidade ou null"}`;

        const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${resolvedOpenaiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: promptInstrucoes },
                  {
                    type: 'image_url',
                    image_url: {
                      url: imageUrlForAi,
                      detail: 'high'
                    }
                  }
                ]
              }
            ],
            temperature: 0.1,
            max_tokens: 300
          })
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const rawContent = aiData?.choices?.[0]?.message?.content || '';
          try {
            const cleanJsonStr = rawContent.replace(/```json/gi, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleanJsonStr);
            hotelNomeExtraido = escapeString(parsed.nome || '');
            hotelTelefoneExtraido = escapeString(parsed.whatsapp || parsed.telefone || '');
            cidadeDetectadaNaFoto = escapeString(parsed.cidade_uf || '');
          } catch (e) {
            console.warn('[Agente Fachada] Falha ao interpretar JSON da IA:', rawContent, e);
          }
        } else {
          console.warn('[Agente Fachada] Erro na OpenAI Vision API:', await aiResponse.text());
        }
      }

      // Se a IA não identificou ou chave ausente, tenta extrair da legenda/texto enviado junto
      if (!hotelNomeExtraido && legenda) {
        hotelNomeExtraido = legenda.split(/[-,\n]/)[0]?.trim();
      }
      if (!hotelNomeExtraido) {
        hotelNomeExtraido = 'Hotel em Cadastro';
      }

      // 3. Salva a sessão pendente
      const sessaoData = {
        telefone_remetente: cleanRemetente,
        nome_hotel: hotelNomeExtraido,
        telefone_hotel: cleanPhoneDigits(hotelTelefoneExtraido),
        imagem_url: finalPublicImageUrl,
        cidade_detectada: cidadeDetectadaNaFoto,
        atualizado_em: Date.now()
      };

      sessoesPendentesMemory.set(cleanRemetente, sessaoData);

      // Também registra log auditável e persistente no Supabase
      try {
        await supabaseAdmin.from('logs_sistema').insert([{
          criado_em: new Date().toISOString(),
          nivel: 'info',
          modulo: 'sistema',
          acao: 'Foto de Fachada Recebida pelo Agente',
          detalhes: `Foto recebida de ${cleanRemetente}. Identificado: ${hotelNomeExtraido}`,
          ip: 'webhook_whatsapp',
          metadados: sessaoData
        }]);
      } catch (errLog) {
        console.warn('[Agente Fachada] Falha ao gravar log no Supabase:', errLog);
      }

      // Se a cidade já foi informada na legenda da foto ou detectada diretamente:
      const cidadeAuto = cidade_uf || cidadeDetectadaNaFoto;
      if (cidadeAuto) {
        // Prossegue direto para o cadastro
        return await cadastrarHotelNoSupabase({
          supabaseAdmin,
          nome: hotelNomeExtraido,
          telefone: hotelTelefoneExtraido,
          cidadeUfRaw: cidadeAuto,
          imageUrl: finalPublicImageUrl,
          cleanRemetente,
          res
        });
      }

      // 4. Monta a resposta para o WhatsApp perguntando a cidade
      const telFormatado = formatPhoneDisplay(hotelTelefoneExtraido) || 'Não identificado na fachada';
      const mensagemResposta = `📸 *Foto da fachada recebida com sucesso!*

Identifiquei as seguintes informações:
🏨 *Hotel:* ${hotelNomeExtraido}
📞 *Contato:* ${telFormatado}

📍 *Por favor, responda agora com a Cidade e Estado (UF) deste hotel para concluir o cadastro:*
_(Exemplo: Porto Seguro - BA ou Ubatuba - SP)_`;

      return res.status(200).json({
        success: true,
        etapa: 'aguardando_cidade',
        nome_hotel: hotelNomeExtraido,
        telefone_hotel: hotelTelefoneExtraido,
        imagem_url: finalPublicImageUrl,
        mensagem_whatsapp: mensagemResposta
      });

    } catch (err) {
      console.error('[Agente Fachada] Erro inesperado:', err);
      return res.status(500).json({
        success: false,
        error: `Erro ao processar imagem da fachada: ${err?.message || err}`
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // AÇÃO 2: CONFIRMAR CIDADE, VERIFICAR DUPLICIDADE E CADASTRAR HOTEL
  // ─────────────────────────────────────────────────────────────────────────────
  if (action === 'confirmar_cidade' || action === 'cadastrar_hotel') {
    const cidadeInformada = escapeString(cidade_uf || body.cidade || body.texto_mensagem || '');
    if (!cidadeInformada) {
      return res.status(200).json({
        success: false,
        sem_sessao: true,
        error: 'Texto de cidade vazio.'
      });
    }

    // Busca a sessão pendente pelo número de telefone do remetente na memória
    let sessao = sessoesPendentesMemory.get(cleanRemetente);

    // Se não encontrou em memória volátil, busca no histórico persistente do Supabase logs_sistema
    if (!sessao) {
      try {
        const { data: logs } = await supabaseAdmin
          .from('logs_sistema')
          .select('id, metadados')
          .eq('acao', 'Foto de Fachada Recebida pelo Agente')
          .order('criado_em', { ascending: false })
          .limit(10);

        const foundLog = logs?.find(l => {
          const metaTel = cleanPhoneDigits(l.metadados?.telefone_remetente || '');
          return metaTel === cleanRemetente || (cleanRemetente.endsWith(metaTel.substring(2)) && metaTel.length >= 10);
        });

        if (foundLog?.metadados) {
          sessao = foundLog.metadados;
          sessao.log_id = foundLog.id;
        }
      } catch (errLog) {
        console.warn('[Agente Fachada] Falha ao recuperar sessão do Supabase:', errLog);
      }
    }

    // Se não encontrou em memória nem em log, verifica se veio dados diretos no body
    if (!sessao && body.nome_hotel) {
      sessao = {
        nome_hotel: body.nome_hotel,
        telefone_hotel: body.telefone_hotel || '',
        imagem_url: body.imagem_url || ''
      };
    }

    // Se ainda assim não houver sessão pendente, significa que o usuário não está em fluxo de cadastro
    if (!sessao) {
      return res.status(200).json({
        success: false,
        sem_sessao: true,
        error: 'Nenhuma foto pendente foi localizada para este número.'
      });
    }

    // Se o usuário solicitou cancelamento
    const textoLower = cidadeInformada.toLowerCase().trim();
    if (textoLower === 'cancelar' || textoLower === 'cancela' || textoLower === 'cancel' || textoLower === 'sair') {
      sessoesPendentesMemory.delete(cleanRemetente);
      if (sessao.log_id) {
        try {
          await supabaseAdmin.from('logs_sistema').update({ acao: 'Foto de Fachada Cancelada' }).eq('id', sessao.log_id);
        } catch {}
      }
      return res.status(200).json({
        success: true,
        cancelado: true,
        mensagem_whatsapp: '❌ *Cadastro de fachada cancelado.* A foto anterior foi descartada. Envie uma nova foto de fachada quando quiser!'
      });
    }

    return await cadastrarHotelNoSupabase({
      supabaseAdmin,
      nome: sessao.nome_hotel,
      telefone: sessao.telefone_hotel,
      cidadeUfRaw: cidadeInformada,
      imageUrl: sessao.imagem_url,
      cleanRemetente,
      logId: sessao.log_id,
      res
    });
  }

  return res.status(400).json({
    success: false,
    error: `Ação '${action}' não reconhecida. Use 'processar_foto' ou 'confirmar_cidade'.`
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: VERIFICAÇÃO DE DUPLICIDADE E INSERÇÃO DO HOTEL NO SUPABASE
// ─────────────────────────────────────────────────────────────────────────────
async function cadastrarHotelNoSupabase({
  supabaseAdmin,
  nome,
  telefone,
  cidadeUfRaw,
  imageUrl,
  cleanRemetente,
  logId,
  res
}) {
  const { cidade, uf, cityUf } = parseCityUf(cidadeUfRaw);
  const cleanPhone = cleanPhoneDigits(telefone);
  const hotelSlug = generateSlug(nome);

  // 1. CHECAGEM DE DUPLICIDADE:
  // Verifica se já existe um hotel com o mesmo nome na mesma cidade OU com o mesmo telefone
  let hotelDuplicado = null;

  try {
    // Checagem por nome e cidade
    if (nome && cidade) {
      const { data: dupByName } = await supabaseAdmin
        .from('hoteis')
        .select('id, nome, cidade, uf, link, telefone_gerente, whatsapp')
        .ilike('nome', `%${nome.trim()}%`)
        .ilike('cidade', `%${cidade.trim()}%`)
        .limit(1);

      if (dupByName && dupByName.length > 0) {
        hotelDuplicado = dupByName[0];
      }
    }

    // Checagem por telefone/WhatsApp
    if (!hotelDuplicado && cleanPhone && cleanPhone.length >= 8) {
      const shortTel = cleanPhone.substring(cleanPhone.length - 8);
      const { data: dupByTel } = await supabaseAdmin
        .from('hoteis')
        .select('id, nome, cidade, uf, link, telefone_gerente, whatsapp')
        .or(`telefone_gerente.ilike.%${shortTel}%,whatsapp.ilike.%${shortTel}%`)
        .limit(1);

      if (dupByTel && dupByTel.length > 0) {
        hotelDuplicado = dupByTel[0];
      }
    }
  } catch (errDup) {
    console.warn('[Agente Fachada] Aviso ao consultar duplicidade:', errDup);
  }

  // Se for duplicado, aborta a inserção e responde com o link existente
  if (hotelDuplicado) {
    sessoesPendentesMemory.delete(cleanRemetente);
    if (logId) {
      try {
        await supabaseAdmin.from('logs_sistema').update({ acao: 'Foto de Fachada Duplicada' }).eq('id', logId);
      } catch {}
    }

    const linkExistente = hotelDuplicado.link?.startsWith('http')
      ? hotelDuplicado.link
      : `https://hotelnozap.com.br/hotel/${hotelDuplicado.link || hotelDuplicado.id}`;

    const msgDuplicado = `⚠️ *Este hotel já está cadastrado no sistema!*

🏨 *Hotel:* ${hotelDuplicado.nome}
📍 *Localização:* ${hotelDuplicado.cidade || cidade} / ${hotelDuplicado.uf || uf}
🔗 *Link Oficial:* ${linkExistente}

O cadastro foi cancelado para evitar duplicidade na base de dados.`;

    return res.status(200).json({
      success: false,
      duplicado: true,
      hotel_existente: hotelDuplicado,
      mensagem_whatsapp: msgDuplicado
    });
  }

  // 2. INSERÇÃO DO NOVO HOTEL
  const hotelPayload = {
    nome: nome,
    razao_social: nome,
    categoria: 'Hotel & Pousada',
    cnpj: '00.000.000/0001-00',
    cidade: cidade,
    uf: uf,
    bairro: 'Centro',
    plano: 'Grátis (Google Maps)',
    capacidade: 0,
    unidade_capacidade: 'quartos',
    instancias_whatsapp: 0,
    nome_gerente: 'Recepção / Gerência',
    telefone_gerente: cleanPhone || null,
    whatsapp: cleanPhone || null,
    status: 'ativo',
    url_imagem: imageUrl || null,
    link: `https://hotelnozap.com.br/hotel/${hotelSlug}`,
    observacoes: `Cadastrado automaticamente pelo Super Agente via Foto de Fachada (${new Date().toLocaleDateString('pt-BR')})`
  };

  let { data: novoHotel, error: insertErr } = await supabaseAdmin
    .from('hoteis')
    .insert([hotelPayload])
    .select('*')
    .single();

  // Fallback seguro caso alguma coluna recente não exista no banco do Supabase
  if (insertErr && (insertErr.code === '42703' || insertErr.message?.includes('link') || insertErr.message?.includes('whatsapp'))) {
    delete hotelPayload.link;
    delete hotelPayload.whatsapp;
    const retry = await supabaseAdmin.from('hoteis').insert([hotelPayload]).select('*').single();
    novoHotel = retry.data;
    insertErr = retry.error;
  }

  if (insertErr) {
    console.error('[Agente Fachada] Erro ao gravar hotel no Supabase:', insertErr);
    return res.status(500).json({
      success: false,
      error: `Erro ao gravar hotel: ${insertErr.message || insertErr}`
    });
  }

  // Limpa a sessão pendente
  sessoesPendentesMemory.delete(cleanRemetente);
  if (logId) {
    try {
      await supabaseAdmin.from('logs_sistema').update({ acao: 'Foto de Fachada Concluida' }).eq('id', logId);
    } catch {}
  }

  const linkFinal = `https://hotelnozap.com.br/hotel/${hotelSlug}`;
  const telFormatado = formatPhoneDisplay(cleanPhone) || 'Não informado';

  const msgSucesso = `🎉 *Hotel Cadastrado com Sucesso!*

🏨 *Nome:* ${nome}
📍 *Cidade:* ${cityUf}
📞 *Contato:* ${telFormatado}
⭐ *Plano:* Grátis (Google Maps)
🖼️ *Foto:* Fachada configurada como capa oficial!

🔗 *Acesse o catálogo do hotel:*
${linkFinal}

O estabelecimento já está ativo e visível na plataforma!`;

  return res.status(200).json({
    success: true,
    hotel_id: novoHotel?.id,
    hotel_nome: nome,
    cidade_uf: cityUf,
    plano: 'Grátis (Google Maps)',
    link: linkFinal,
    imagem_url: imageUrl,
    mensagem_whatsapp: msgSucesso
  });
}
