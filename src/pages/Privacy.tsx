import LegalShell from '../components/LegalShell'

export default function Privacy() {
  return (
    <LegalShell title="Politica de Privacidade">
      <p>
        O WolfSocial e uma ferramenta de agendamento e publicacao de conteudo no
        Instagram, operada pela Wolfsistemas. Esta politica descreve como
        tratamos os dados ao usar a aplicacao.
      </p>
      <h2 className="pt-2 text-base font-semibold text-white">Dados que coletamos</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Email e senha (armazenada apenas como hash pelo Supabase Auth).</li>
        <li>
          Tokens de acesso do Instagram/Facebook, criptografados em repouso
          (AES-256-GCM).
        </li>
        <li>
          Conteudo que voce envia: imagens, videos, legendas, agendamentos e
          registros de publicacao.
        </li>
        <li>Metricas dos posts publicados (alcance, curtidas, comentarios, etc.).</li>
      </ul>
      <h2 className="pt-2 text-base font-semibold text-white">Como usamos</h2>
      <p>
        Usamos os dados exclusivamente para operar a ferramenta: autenticar voce,
        publicar conteudo na sua conta do Instagram e exibir relatorios. Nao
        vendemos nem compartilhamos seus dados com terceiros, exceto com a Meta
        quando necessario para publicar via API oficial.
      </p>
      <h2 className="pt-2 text-base font-semibold text-white">Armazenamento</h2>
      <p>
        Os dados ficam hospedados no Supabase. Midias ficam em bucket publico
        para que a API do Instagram possa busca-las no momento da publicacao.
      </p>
      <h2 className="pt-2 text-base font-semibold text-white">Seus direitos</h2>
      <p>
        Voce pode solicitar a exclusao dos seus dados na pagina de exclusao. Para
        duvidas, entre em contato pelo email de suporte da Wolfsistemas.
      </p>
    </LegalShell>
  )
}
