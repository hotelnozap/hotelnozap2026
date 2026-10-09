import React, { useEffect } from 'react';
import { ZapHotelLogo } from './ZapHotelLogo';
import { getAppLoginUrl } from '../utils/partnerUrl';

export type TipoPaginaInstitucional = 'privacidade' | 'termos' | 'empresa' | 'quem-somos' | 'fale-conosco';

interface PaginaInstitucionalProps {
  tipo: TipoPaginaInstitucional;
}

export const PaginaInstitucional: React.FC<PaginaInstitucionalProps> = ({ tipo }) => {
  const isLoggedIn = typeof window !== 'undefined' && Boolean(localStorage.getItem('hotelnozap_user_email'));

  useEffect(() => {
    switch (tipo) {
      case 'quem-somos':
        document.title = 'Quem Somos';
        break;
      case 'fale-conosco':
        document.title = 'Fale Conosco';
        break;
      case 'privacidade':
        document.title = 'Política de Privacidade';
        break;
      case 'termos':
        document.title = 'Termos de Uso';
        break;
      case 'empresa':
        document.title = 'Informações da Empresa';
        break;
    }
  }, [tipo]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col selection:bg-emerald-500 selection:text-white">
      {/* HEADER INSTITUCIONAL */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-3.5 sm:px-6 h-16 sm:h-18 flex items-center justify-between gap-2">
          <a href="/" className="flex items-center gap-2.5 sm:gap-3 group shrink-0">
            <ZapHotelLogo size={36} className="group-hover:scale-105 transition-transform shrink-0" />
            <div className="flex flex-col">
              <span className="font-extrabold text-base sm:text-lg text-slate-900 tracking-tight leading-tight whitespace-nowrap">
                Hotel no Zap
              </span>
              <span className="text-[10px] sm:text-[11px] text-[#006c49] font-bold uppercase tracking-wider whitespace-nowrap leading-tight">
                Hospitalidade Digital
              </span>
            </div>
          </a>

          <nav className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <a
              href="/quem-somos"
              className={`px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                tipo === 'quem-somos'
                  ? 'bg-[#006c49] text-white shadow-xs'
                  : 'hover:bg-slate-100 text-slate-700'
              }`}
            >
              Quem Somos
            </a>
            <a
              href="/fale-conosco"
              className={`px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                tipo === 'fale-conosco'
                  ? 'bg-[#006c49] text-white shadow-xs'
                  : 'hover:bg-slate-100 text-slate-700'
              }`}
            >
              Fale Conosco
            </a>
          </nav>
        </div>
      </header>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-14 pb-24 lg:pb-14">
        
        {/* PÁGINA: FALE CONOSCO (CONTATO DIRETO, WHATSAPP, EMAIL E GOOGLE MAPS) */}
        {tipo === 'fale-conosco' && (
          <article className="bg-white rounded-3xl p-6 sm:p-12 shadow-sm border border-slate-200 space-y-8 animate-in fade-in duration-200">
            <div className="border-b border-slate-100 pb-6 text-center sm:text-left">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 mb-3">
                <span className="material-symbols-outlined text-sm">support_agent</span>
                Canais Oficiais de Atendimento
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                Fale Conosco
              </h1>
              <p className="text-sm text-slate-500 mt-2">
                Entre em contato diretamente com a equipe do Hotel no Zap através dos nossos canais oficiais:
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
              
              {/* Card 1: Telefone & WhatsApp */}
              <div className="p-6 rounded-2xl bg-gradient-to-b from-emerald-50/60 to-white border border-emerald-200/80 shadow-xs flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                    <span className="material-symbols-outlined text-2xl">chat</span>
                  </div>
                  <div>
                    <h3 className="text-xs uppercase font-extrabold tracking-wider text-emerald-800">WhatsApp & Telefone</h3>
                    <p className="text-base sm:text-lg font-black text-slate-900 mt-1">
                      (66) 981585014
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Atendimento rápido e suporte direto via WhatsApp.
                    </p>
                  </div>
                </div>

                <a
                  href="https://wa.me/5566981585014?text=Ol%C3%A1!%20Gostaria%20de%20falar%20com%20a%20equipe%20do%20Hotel%20no%20Zap."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 px-4 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer active:scale-95"
                >
                  <span className="material-symbols-outlined text-base">send</span>
                  <span>Chamar no WhatsApp</span>
                </a>
              </div>

              {/* Card 2: E-mail Corporativo */}
              <div className="p-6 rounded-2xl bg-gradient-to-b from-slate-50 to-white border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#006c49] text-white flex items-center justify-center shadow-xs">
                    <span className="material-symbols-outlined text-2xl">mail</span>
                  </div>
                  <div>
                    <h3 className="text-xs uppercase font-extrabold tracking-wider text-slate-600">E-mail Oficial</h3>
                    <p className="text-sm sm:text-base font-bold text-slate-900 mt-1 break-all">
                      hotelnozap@gmail.com
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Para parcerias, suporte corporativo e solicitações gerais.
                    </p>
                  </div>
                </div>

                <a
                  href="mailto:hotelnozap@gmail.com"
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer active:scale-95"
                >
                  <span className="material-symbols-outlined text-base">forward_to_inbox</span>
                  <span>Enviar E-mail</span>
                </a>
              </div>

              {/* Card 3: Endereço & Google Maps */}
              <div className="p-6 rounded-2xl bg-gradient-to-b from-amber-50/50 to-white border border-amber-200/80 shadow-xs flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-600 text-white flex items-center justify-center shadow-xs">
                    <span className="material-symbols-outlined text-2xl">location_on</span>
                  </div>
                  <div>
                    <h3 className="text-xs uppercase font-extrabold tracking-wider text-amber-800">Endereço</h3>
                    <p className="text-xs sm:text-sm font-bold text-slate-900 mt-1 leading-snug">
                      Rua João Paulo II, 891<br />
                      Jardim Sumaré • CEP 78720-750<br />
                      Rondonópolis - MT
                    </p>
                  </div>
                </div>

                <a
                  href="https://www.google.com/maps/search/?api=1&query=Rua+Jo%C3%A3o+Paulo+II%2C+891+-+Jardim+Sumar%C3%A9%2C+Rondon%C3%B3polis+-+MT%2C+78720-750"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer active:scale-95"
                >
                  <span className="material-symbols-outlined text-base">map</span>
                  <span>Abrir no Google Maps</span>
                </a>
              </div>

            </div>
          </article>
        )}

        {/* PÁGINA: QUEM SOMOS */}
        {tipo === 'quem-somos' && (
          <article className="bg-white rounded-3xl p-6 sm:p-12 shadow-sm border border-slate-200 space-y-8 animate-in fade-in duration-200">
            <div className="border-b border-slate-100 pb-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 mb-3">
                <span className="material-symbols-outlined text-sm">groups</span>
                Nossa Proposta de Valor
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                Quem Somos
              </h1>
              <p className="text-sm text-slate-500 mt-2">
                A ponte direta entre você e a melhor experiência de hospedagem no Brasil.
              </p>
            </div>

            <div className="prose prose-slate max-w-none text-sm sm:text-base leading-relaxed space-y-6 text-slate-600">
              <p className="text-base sm:text-lg text-slate-800 font-medium">
                O <strong>Hotel no Zap</strong> nasceu com o objetivo claro de simplificar a forma como pessoas encontram, conversam e reservam acomodações em hotéis e pousadas por todo o país.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 my-6 not-prose">
                <div className="p-5 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-[#006c49] text-white flex items-center justify-center">
                    <span className="material-symbols-outlined text-xl">bolt</span>
                  </div>
                  <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">Sem Burocracia, Direto no Zap</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Eliminamos intermediários e taxas abusivas de reserva. O hóspede visualiza as fotos, valores e comodidades das suítes e fecha diretamente com a recepção oficial.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 text-white flex items-center justify-center">
                    <span className="material-symbols-outlined text-xl">verified</span>
                  </div>
                  <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">Hotéis Verificados</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Cataloga estabelecimentos reais com informações de contato atualizadas, avaliações do Google e canais oficiais auditados.
                  </p>
                </div>
              </div>

              <div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-2">Nossa Missão</h2>
                <p>
                  Capacitar pousadas e hotéis independentes com tecnologia de ponta, permitindo que tenham presença digital forte e canais de atendimento ágeis 24 horas por dia, proporcionando aos viajantes uma experiência humanizada, rápida e segura.
                </p>
              </div>

              <div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-2">Nossa Visão</h2>
                <p>
                  Ser a principal rede inteligente de conexão hoteleira no Brasil, reconhecida pela excelência em atendimento digital e transparência nas relações entre hóspedes e hoteleiros.
                </p>
              </div>
            </div>
          </article>
        )}

        {/* PÁGINA: POLÍTICA DE PRIVACIDADE */}
        {tipo === 'privacidade' && (
          <article className="bg-white rounded-3xl p-6 sm:p-12 shadow-sm border border-slate-200 space-y-8 animate-in fade-in duration-200">
            <div className="border-b border-slate-100 pb-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 mb-3">
                <span className="material-symbols-outlined text-sm">verified_user</span>
                Em conformidade com a LGPD (Lei nº 13.709/2018)
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                Política de Privacidade
              </h1>
              <p className="text-sm text-slate-500 mt-2">
                Esta política é efetiva a partir de 1 de janeiro de 2026 • Hotel no Zap
              </p>
            </div>

            <div className="prose prose-slate max-w-none text-sm sm:text-base leading-relaxed space-y-6 text-slate-600">
              <p>
                A sua privacidade é importante para nós. É política do <strong>Hotel no Zap</strong> respeitar a sua privacidade em relação a qualquer informação sua que possamos coletar no site <strong>Hotel no Zap</strong>, e outros sites que possuímos e operamos.
              </p>

              <p>
                Solicitamos informações pessoais apenas quando realmente precisamos delas para lhe fornecer um serviço. Fazemo-lo por meios justos e legais, com o seu conhecimento e consentimento. Também informamos por que estamos coletando e como será usado.
              </p>

              <p>
                Apenas retemos as informações coletadas pelo tempo necessário para fornecer o serviço solicitado. Quando armazenamos dados, protegemos dentro de meios comercialmente aceitáveis para evitar perdas e roubos, bem como acesso, divulgação, cópia, uso ou modificação não autorizados.
              </p>

              <p>
                Não compartilhamos informações de identificação pessoal publicamente ou com terceiros, exceto quando exigido por lei.
              </p>

              <p>
                O nosso site pode ter links para sites externos que não são operados por nós. Esteja ciente de que não temos controle sobre o conteúdo e práticas desses sites e não podemos aceitar responsabilidade por suas respectivas políticas de privacidade.
              </p>

              <p>
                Você é livre para recusar a nossa solicitação de informações pessoais, entendendo que talvez não possamos fornecer alguns dos serviços desejados.
              </p>

              <p>
                O uso continuado de nosso site será considerado como aceitação de nossas práticas em torno de privacidade e informações pessoais. Se você tiver alguma dúvida sobre como lidamos com dados do usuário e informações pessoais, entre em contacto connosco.
              </p>

              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4 not-prose text-xs sm:text-sm text-slate-700">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-700">ads_click</span>
                  Publicidade, Cookies e Google AdSense
                </h3>
                <p className="leading-relaxed">
                  O serviço Google AdSense que usamos para veicular publicidade usa um cookie DoubleClick para veicular anúncios mais relevantes em toda a Web e limitar o número de vezes que um determinado anúncio é exibido para você. Para mais informações sobre o Google AdSense, consulte as FAQs oficiais sobre privacidade do Google AdSense.
                </p>
                <p className="leading-relaxed">
                  Utilizamos anúncios para compensar os custos de funcionamento deste site e fornecer financiamento para futuros desenvolvimentos. Os cookies de publicidade comportamental usados por este site foram projetados para garantir que você forneça os anúncios mais relevantes sempre que possível, rastreando anonimamente seus interesses e apresentando coisas semelhantes que possam ser do seu interesse.
                </p>
                <p className="leading-relaxed">
                  Vários parceiros anunciam em nosso nome e os cookies de rastreamento de afiliados simplesmente nos permitem ver se nossos clientes acessaram o site através de um dos sites de nossos parceiros, para que possamos creditá-los adequadamente e, quando aplicável, permitir que nossos parceiros afiliados ofereçam qualquer promoção que pode fornecê-lo para fazer uma compra.
                </p>
              </div>

              <div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-2">Compromisso do Usuário</h2>
                <p className="mb-3">
                  O usuário se compromete a fazer uso adequado dos conteúdos e da informação que o <strong>Hotel no Zap</strong> oferece no site e com caráter enunciativo, mas não limitativo:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>
                    <strong>A)</strong> Não se envolver em atividades que sejam ilegais ou contrárias à boa fé e à ordem pública;
                  </li>
                  <li>
                    <strong>B)</strong> Não difundir propaganda ou conteúdo de natureza racista, xenofóbica, jogos de sorte ou azar, qualquer tipo de pornografia ilegal, de apologia ao terrorismo ou contra os direitos humanos;
                  </li>
                  <li>
                    <strong>C)</strong> Não causar danos aos sistemas físicos (hardwares) e lógicos (softwares) do <strong>Hotel no Zap</strong>, de seus fornecedores ou terceiros, para introduzir ou disseminar vírus informáticos ou quaisquer outros sistemas de hardware ou software que sejam capazes de causar danos anteriormente mencionados.
                  </li>
                </ul>
              </div>

              <div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-2">Mais informações</h2>
                <p>
                  Esperemos que esteja esclarecido e, como mencionado anteriormente, se houver algo que você não tem certeza se precisa ou não, geralmente é mais seguro deixar os cookies ativados, caso interaja com um dos recursos que você usa em nosso site.
                </p>
              </div>

              <div className="bg-emerald-50/70 p-5 rounded-2xl border border-emerald-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs sm:text-sm">
                <div>
                  <span className="font-bold text-emerald-950 block">Vigência desta Política:</span>
                  <span className="text-emerald-800">Esta política é efetiva a partir de <strong>1 de janeiro de 2026</strong>.</span>
                </div>
                <a
                  href="mailto:hotelnozap@gmail.com"
                  className="px-4 py-2 rounded-xl bg-[#006c49] hover:bg-[#005438] text-white font-bold text-xs transition-colors shrink-0 flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">mail</span>
                  <span>Falar com Encarregado</span>
                </a>
              </div>
            </div>
          </article>
        )}

        {/* PÁGINA: TERMOS DE USO */}
        {tipo === 'termos' && (
          <article className="bg-white rounded-3xl p-6 sm:p-12 shadow-sm border border-slate-200 space-y-8 animate-in fade-in duration-200">
            <div className="border-b border-slate-100 pb-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 mb-3">
                <span className="material-symbols-outlined text-sm">gavel</span>
                Termos e Condições Gerais
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                Termos de Uso
              </h1>
              <p className="text-sm text-slate-500 mt-2">
                Vigência: 2026 • Plataforma Hotel no Zap
              </p>
            </div>

            <div className="prose prose-slate max-w-none text-sm sm:text-base leading-relaxed space-y-6 text-slate-600">
              <p>
                Bem-vindo ao <strong>Hotel no Zap</strong>. Ao utilizar nosso catálogo público, páginas de acomodações ou sistema de gestão, você concorda expressamente com estes Termos de Uso.
              </p>

              <div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-2">1. Natureza do Serviço</h2>
                <p>
                  O <strong>Hotel no Zap</strong> é uma plataforma tecnológica de hospitalidade digital que conecta hóspedes a hotéis, pousadas e resorts parceiros, além de disponibilizar automações inteligentes de atendimento e reservas via WhatsApp.
                </p>
              </div>

              <div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-2">2. Reservas e Tarifas dos Estabelecimentos</h2>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>Os preços, fotos, comodidades, disponibilidade e políticas de cancelamento exibidos nas páginas dos hotéis são de responsabilidade de cada estabelecimento cadastrado ou parceiro fornecedor.</li>
                  <li>A confirmação final de reserva, check-in, check-out e fornecimento da estadia são prestados diretamente pelo hotel selecionado.</li>
                </ul>
              </div>

              <div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-2">3. Uso Aceitável da Plataforma</h2>
                <p>O usuário se compromete a:</p>
                <ul className="list-disc pl-5 space-y-1.5 mt-2">
                  <li>Fornecer informações verídicas e atualizadas ao solicitar cotações ou reservas;</li>
                  <li>Não praticar atos ilícitos ou envio de mensagens em massa não autorizadas;</li>
                  <li>Respeitar a propriedade intelectual, marcas e logotipos pertencentes ao Hotel no Zap.</li>
                </ul>
              </div>

              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                <h3 className="text-sm font-bold text-slate-900 mb-1">Dúvidas sobre os Termos?</h3>
                <p className="text-xs text-slate-600">
                  Entre em contato através do e-mail{' '}
                  <a href="mailto:hotelnozap@gmail.com" className="text-emerald-700 font-bold hover:underline">
                    hotelnozap@gmail.com
                  </a>.
                </p>
              </div>
            </div>
          </article>
        )}

        {/* PÁGINA: INFORMAÇÕES DA EMPRESA */}
        {tipo === 'empresa' && (
          <article className="bg-white rounded-3xl p-6 sm:p-12 shadow-sm border border-slate-200 space-y-8 animate-in fade-in duration-200">
            <div className="border-b border-slate-100 pb-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 mb-3">
                <span className="material-symbols-outlined text-sm">apartment</span>
                Institucional & Governança
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                Informações da Empresa
              </h1>
              <p className="text-sm text-slate-500 mt-2">
                Conheça a infraestrutura, missão e canais oficiais do Hotel no Zap
              </p>
            </div>

            <div className="prose prose-slate max-w-none text-sm sm:text-base leading-relaxed space-y-6 text-slate-600">
              <p>
                O <strong>Hotel no Zap</strong> é uma plataforma pioneira em hospitalidade digital, desenvolvida para modernizar a gestão de hospedagem no Brasil. Unimos catálogo público de acomodações, automação de reservas via WhatsApp e software de controle para pousadas, hotéis boutique e redes hoteleiras.
              </p>

              <div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-2">Dados Corporativos</h2>
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-2 text-xs sm:text-sm">
                  <div className="flex flex-col sm:flex-row sm:justify-between py-1 border-b border-slate-200/60">
                    <span className="font-bold text-slate-700">Nome Fantasia:</span>
                    <span className="text-slate-900 font-semibold">Hotel no Zap</span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:justify-between py-1 border-b border-slate-200/60">
                    <span className="font-bold text-slate-700">CNPJ:</span>
                    <span className="text-slate-900 font-semibold">53.422.578/0001-00</span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:justify-between py-1 border-b border-slate-200/60">
                    <span className="font-bold text-slate-700">Segmento:</span>
                    <span className="text-slate-900 font-semibold">Tecnologia, SaaS e Hospitalidade Digital</span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:justify-between py-1 border-b border-slate-200/60">
                    <span className="font-bold text-slate-700">Endereço:</span>
                    <span className="text-slate-900 font-semibold">Rua João Paulo II, 891 - Jardim Sumaré, CEP 78720-750, Rondonópolis - MT</span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:justify-between py-1 border-b border-slate-200/60">
                    <span className="font-bold text-slate-700">Telefone / WhatsApp:</span>
                    <span className="text-slate-900 font-semibold">(66) 981585014</span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:justify-between py-1">
                    <span className="font-bold text-slate-700">E-mail Corporativo:</span>
                    <span className="text-slate-900 font-semibold">hotelnozap@gmail.com</span>
                  </div>
                </div>
              </div>
            </div>
          </article>
        )}
      </main>

      {/* FOOTER DA PÁGINA INSTITUCIONAL */}
      <footer className="w-full bg-slate-900 text-slate-400 py-10 pb-24 lg:pb-10 border-t border-slate-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-center sm:text-left">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <span className="font-bold text-white">© 2026 Hotel no Zap CNPJ: 53.422.578/0001-00</span>
            <span className="hidden sm:inline">•</span>
            <span className="text-slate-400">Rede Inteligente de Pousadas e Hotéis</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 text-slate-400 font-semibold">
            <a href="/privacidade" className="hover:text-white transition-colors">Privacidade</a>
            <span>•</span>
            <a href="/termos" className="hover:text-white transition-colors">Termos</a>
            <span>•</span>
            <a href="/empresa" className="hover:text-white transition-colors">Informações da empresa</a>
          </div>
        </div>
      </footer>

      {/* ========================================================================= */}
      {/* BARRA INFERIOR MOBILE FIXA (CONFORME PÁGINA INICIAL)                      */}
      {/* ========================================================================= */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-200 px-6 py-2 flex items-center justify-around shadow-lg">
        <a
          href="/"
          className="flex flex-col items-center gap-0.5 text-slate-500 hover:text-emerald-800 font-bold text-[10px] transition-colors"
        >
          <span className="material-symbols-outlined text-2xl">search</span>
          <span>Explorar</span>
        </a>

        <a
          href="/#destinos"
          className="flex flex-col items-center gap-0.5 text-slate-500 hover:text-emerald-800 font-bold text-[10px] transition-colors"
        >
          <span className="material-symbols-outlined text-2xl">location_on</span>
          <span>Destinos</span>
        </a>

        <a
          href={isLoggedIn ? '/minhaconta' : getAppLoginUrl()}
          className="flex flex-col items-center gap-0.5 text-slate-500 hover:text-emerald-800 font-bold text-[10px] transition-colors"
        >
          <span className="material-symbols-outlined text-2xl">account_circle</span>
          <span>{isLoggedIn ? 'Perfil' : 'Entrar'}</span>
        </a>
      </nav>
    </div>
  );
};

export default PaginaInstitucional;
