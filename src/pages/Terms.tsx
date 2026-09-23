import LegalShell from '../components/LegalShell'

export default function Terms() {
  return (
    <LegalShell title="Termos de Uso">
      <p>
        Ao usar o WolfSocial voce concorda com estes termos. A ferramenta e
        fornecida "como esta", para uso na publicacao de conteudo na sua propria
        conta profissional do Instagram por meio das APIs oficiais da Meta.
      </p>
      <h2 className="pt-2 text-base font-semibold text-white">Responsabilidades</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          Voce e responsavel pelo conteudo que agenda e publica, incluindo
          direitos autorais e conformidade com as politicas da Meta.
        </li>
        <li>
          Voce e responsavel por manter sua conta do Instagram em dia e com
          permissoes validas.
        </li>
        <li>
          Nao use a ferramenta para spam, conteudo ilegal ou violacao de
          direitos de terceiros.
        </li>
      </ul>
      <h2 className="pt-2 text-base font-semibold text-white">Limitacoes</h2>
      <p>
        A API do Instagram impoe limites tecnicos (formatos aceitos, cota de
        publicacao em 24 horas, ausencia de recursos como stickers em Stories).
        Nao nos responsabilizamos por indisponibilidade da plataforma da Meta ou
        por rejeicoes de conteudo.
      </p>
      <h2 className="pt-2 text-base font-semibold text-white">Encerramento</h2>
      <p>
        Voce pode parar de usar a qualquer momento e solicitar a exclusao dos
        seus dados.
      </p>
    </LegalShell>
  )
}
