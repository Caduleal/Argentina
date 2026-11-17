# Buenos Aires · Cadu e Vítor

Guia mobile para 22 a 29 de novembro de 2026. Front-end leve em HTML, CSS/Tailwind e JavaScript, com funções Node.js na Vercel e **um JSON persistente no Vercel Blob**. O site não tem login, conforme solicitado.

Repositório: [Caduleal/Argentina](https://github.com/Caduleal/Argentina). A raiz Git é a pasta `argentina-guide`: os arquivos `package.json`, `vercel.json`, `api/` e `dist/` ficam diretamente na raiz do repositório remoto.

## Git e primeiro envio

O remote `origin` aponta para `https://github.com/Caduleal/Argentina.git`. Dentro da pasta `argentina-guide`, revise as alterações preparadas e faça o commit e o envio:

```bash
git status
git diff --cached --stat
git commit -m "Prepara guia da Argentina para Vercel"
git push -u origin main
```

Os PDFs de passagens e seguros estão incluídos para que os downloads funcionem. Eles e os JSONs contêm dados pessoais da viagem; em um repositório público, esses arquivos também ficam públicos pelo GitHub. Tokens, arquivos `.env`, dependências, capturas de tela, ZIPs e metadados locais de hospedagem são ignorados. O HTML em `dist/index.html` é código-fonte e faz parte do commit.

## Comportamento dos dados

- O navegador **não usa localStorage, sessionStorage ou IndexedDB** para os dados da viagem.
- Ao abrir o site, a API lê `argentina-2026/trip.json` no Blob. As alterações confirmadas são gravadas nesse mesmo objeto.
- Reiniciar uma função, abrir em outro celular ou publicar uma nova versão do código **não sobrescreve o JSON existente**.
- `data/initial.json` serve apenas para a primeira criação do arquivo, quando ele ainda não existe. Nunca é reaplicado sobre os dados salvos.
- Leituras usam `useCache: false`; respostas da API usam `Cache-Control: no-store`.
- Gravações usam ETag/`ifMatch` e repetição em caso de concorrência. Cada ação tem um identificador para impedir duplicação quando uma resposta se perde e o usuário tenta novamente.
- O app mostra confirmação somente depois da resposta do servidor. Em uma falha, mantém a tentativa em memória enquanto a página estiver aberta e oferece “Tentar novamente”. Não promete salvamento offline.
- Mudanças feitas no outro celular aparecem ao reabrir a página, ao voltar para ela ou na consulta periódica a cada 30 segundos.

O armazenamento Blob é privado para que o token permaneça no servidor e as leituras sejam consistentes. **Isso não torna o site privado:** as APIs e os downloads são acessíveis sem login. Quem obtiver o link poderá ler e alterar os dados.

## Publicar na Vercel

O projeto Vercel e o Blob ainda precisam ser criados na sua conta. O código não precisa de um servidor dedicado.

1. Envie o commit para o GitHub. Na Vercel, use **Add New → Project** e importe `Caduleal/Argentina`.
2. Deixe **Root Directory** como `.` (raiz do repositório). Não selecione somente `dist`, pois as funções da pasta `api` também são necessárias. Para publicar pela CLI, execute `npx vercel` dentro da pasta local `argentina-guide`.
3. O `vercel.json` define **Other** (`framework: null`), saída **dist**, instalação com `pnpm install --frozen-lockfile` e build com `node --test tests/app.test.mjs`. Não há compilação do HTML; o build executa os testes antes da publicação. `package.json` fixa Node.js **22.x**. As funções incluem `data/**`, com os JSONs e os quatro PDFs. Não adicione um rewrite global para `index.html`, pois ele poderia interceptar as rotas `/api`.
4. No painel da Vercel, crie um **Blob store com acesso Private** e conecte-o ao projeto. Disponibilize `BLOB_READ_WRITE_TOKEN` nas variáveis de ambiente do servidor. Não coloque esse token no HTML nem use prefixos de variável pública.
5. Mantenha `TRIP_DATA_PATH=argentina-2026/trip.json` em Production. Se usar Preview para testes, configure um caminho diferente, como `preview/argentina-2026/trip.json`, para não alterar os dados reais.
6. Publique novamente após conectar o armazenamento. Abra o site: a primeira leitura cria o JSON uma única vez, com voos, hospedagem e a programação dos dias 22 a 27. Os dias 28 e 29 permanecem em aberto.
7. Para validar na sua conta, salve um gasto ou local, reabra o site em outro dispositivo e confira se ele permanece. Depois publique novamente o código e confirme que a alteração continua lá.

**Para preservar os dados:** não apague o Blob store, não exclua `trip.json` e não altere o caminho de Production entre deploys. Se o armazenamento estiver indisponível ou o JSON estiver incompatível, a API retorna um erro; não recria uma viagem vazia por cima dos dados.

Referências oficiais: [Vercel Blob](https://vercel.com/docs/vercel-blob), [leituras consistentes](https://vercel.com/changelog/vercel-blob-now-supports-consistent-reads-on-private-storage) e [SDK / gravações condicionais](https://vercel.com/docs/vercel-blob/using-blob-sdk).

## Executar no computador

Requer Node.js 22.x e pnpm (o lockfile versionado usa formato 9, compatível com pnpm 10).

```bash
pnpm install --frozen-lockfile
```

Copie `.env.example` para `.env.local` e preencha o token do Blob que você criou. Use um caminho de teste diferente do de Production para trabalhar no computador.

```bash
pnpm dev
```

Abra [http://127.0.0.1:4174](http://127.0.0.1:4174). O servidor local executa as mesmas APIs e usa o Blob configurado. Abrir o HTML com duplo clique não executa o backend.

Sem token ou store configurado, `npm run dev` abre uma **prévia local somente de visualização**, com os dados iniciais reais, voos e seguros. Ela informa que o salvamento ainda está desativado. Na publicação da Vercel, a API continua exigindo o Blob e retorna um erro se ele não estiver conectado. Não há fallback para armazenamento no navegador nem para arquivo temporário da Vercel.

## Funcionalidades

- **Roteiro:** abas inferiores, seleção dos dias 22–29, hover, elevação do dia ativo e transições com respeito a movimento reduzido.
- **Dia automático:** usa a data no fuso `America/Argentina/Buenos_Aires`. Durante a viagem, abre no dia correspondente. Antes da viagem abre no dia 22 e depois no dia 29. Permite consultar outros dias manualmente; na mudança de data ou retorno à tela, atualiza para o novo dia.
- **Galeria por dia:** exibe as imagens vinculadas ao dia nos dados da viagem. O controle de cadastro “Fotos deste dia” foi removido da interface. Sem fotos cadastradas, aparece um estado vazio; não há associação inventada entre fotos e passeios.
- **Mapa e detalhes:** o Airbnb em Paraguay 867 é um ponto fixo, com ícone de casa em vermelho, presente em todos os dias e separado das paradas do roteiro. O botão “Airbnb” centraliza a hospedagem e mostra o endereço e os horários. As coordenadas do endereço em CABA vieram do serviço oficial USIG de Buenos Aires. Marque uma posição no mapa e preencha nome, horário, preço, como chegar e observações. As paradas são numeradas e podem ser antecipadas ou removidas. Com duas ou mais paradas, o botão “Traçar percurso” calcula um trajeto de carro pelas ruas, sem trânsito ao vivo. Oferece também um link para o Google Maps.
- **Previsão:** consulta Open-Meteo para Buenos Aires e exibe o dia selecionado, sem fabricar dados para datas fora da resposta. As consultas têm limite de espera e mensagem de falha.
- **Conversor:** ARS → BRL e BRL → ARS, com cotação manual em R$ por 1 ARS. A taxa pode ser salva para os dois usuários.
- **Gastos:** descrição, valor original, ARS/BRL, dia, Crédito/Débito/Dinheiro e Restaurante/Transporte/Presentes/Mercado/Outros. “Outros” exige texto livre. O servidor valida e calcula o equivalente em centavos de real. Mudar a cotação não recalcula gastos anteriores. Inclui total, limite, saldo e exclusão.
- **Minha viagem:** três cards: “Hospedagem · Airbnb”, “Voos e vouchers” e “Seguros de viagem”. Passagens e seguros têm seus próprios downloads. Os seguros mostram plano, número Assist Card, vigência e contatos de assistência informados nos documentos. Os cards “Informações da viagem” e “Dados compartilhados” foram removidos. O salvamento de gastos, locais e fotos continua no servidor.

Os locais e atividades dos dias 22 a 26 foram indicados por vocês. Dia 22: Obelisco, mercado para a semana (estabelecimento a definir) e restante livre. Dia 23: Teatro Colón, Galerías Pacífico, Plaza San Martín e El Ateneo Grand Splendid. Dia 24: centro histórico, Palácio Barolo, Casa Rosada, San Telmo e Puerto Madero. Dia 25: La Boca, La Bombonera e Caminito. Dia 26: bate-volta a Colonia del Sacramento, com retorno a Buenos Aires no mesmo dia. Horários, preços, ingressos e transporte não foram inventados.

`data/planned-days.json` guarda essa programação inicial. O dia 26 usa a previsão de Colonia del Sacramento, no fuso `America/Montevideo`; os demais usam Buenos Aires. Marcadores de bairros e cidades são identificados como referências da região. As coordenadas têm os links de fonte nos dados. Fotos de Obelisco, Teatro Colón, El Ateneo e Caminito são do site oficial de turismo de Buenos Aires e aparecem apenas nos respectivos dias.

O dia 23 tem quatro fotos e quatro marcadores, na mesma ordem: Teatro Colón, Galerías Pacífico, Plaza San Martín e El Ateneo Grand Splendid. As imagens têm nome e posição visíveis na galeria. A Floralis Genérica foi transferida, com foto e marcador, para o dia 27.

O dia 24 tem cinco fotos e cinco marcadores: centro histórico (referência na Plaza de Mayo), Palácio Barolo, Casa Rosada, San Telmo e Puerto Madero. O dia 25 tem três fotos e três marcadores: La Boca (referência do bairro), La Bombonera e Caminito. As fotos são do site oficial de turismo de Buenos Aires e seguem a numeração das paradas. O símbolo de La Boca é deslocado visualmente para evitar sobreposição com La Bombonera; as coordenadas geográficas são preservadas.

## Estrutura

```text
dist/index.html          Interface completa: HTML, estilos e JavaScript
api/state.js             GET/POST dos dados compartilhados
api/voucher.js           Download das passagens e dos seguros por ID
lib/model.js             Validação, cálculos e operações sobre os dados
lib/store.js             Persistência JSON, ETags e repetição de conflitos
data/initial.json        Dados iniciais usados somente na primeira criação
data/planned-days.json   Programação dos dias 22–27 e fotos de cada parada
data/insurance.json      Dados dos dois seguros, incluídos na resposta da API
data/fixed-places.json   Hospedagem fixa e coordenadas verificadas em CABA
data/vouchers/           Os quatro PDFs originais: passagens e seguros
server.mjs               Servidor de desenvolvimento local
tests/app.test.mjs       Testes automatizados
tests/preview.mjs        Prévia isolada para teste de interface
.env.example             Variáveis de ambiente, sem credenciais
vercel.json              Configuração de deploy
package.json             Dependências e comandos
pnpm-lock.yaml           Versões resolvidas das dependências
.gitignore               Exclui segredos, dependências e artefatos locais
.gitattributes           Padroniza texto em LF e preserva PDFs como binários
.vercelignore            Exclui artefatos locais do upload para a Vercel
```

## Tecnologias e validação

HTML5, CSS responsivo, utilitários Tailwind via CDN com preflight desativado, Vanilla JavaScript, Google Fonts (Manrope e DM Sans), Leaflet 1.9.4, OpenStreetMap, OSRM, Open-Meteo, Node.js e `@vercel/blob`. Prettier é usado apenas para formatar o código.

```bash
pnpm test
```

Os testes cobrem conversão monetária, taxa histórica, validações, reabertura por outra instância, duas despesas simultâneas, repetição sem duplicação, indisponibilidade sem reinicialização, fotos por dia, seleção de data no fuso de Buenos Aires e os quatro downloads PDF. O catálogo dos seguros é incluído pela API sem reinicializar ou modificar o JSON de uma viagem já existente.

A auditoria de interface foi feita em 390 × 844 px em uma prévia isolada: navegação, voos, Airbnb, conversor, categoria Outros, reabertura mantendo o gasto no armazenamento de teste e separação das fotos entre dias. A prévia de teste substitui o Blob por um adaptador isolado e **não comprova uma conexão com um Blob real**. Essa verificação depende da criação do projeto e do armazenamento na sua conta.

O link da versão antiga no Sites não é a publicação deste backend Vercel. Publique esta pasta na Vercel para usar a nova persistência. A página exige internet para salvar e consultar mapa, clima e fotos. Não há login nem sincronização offline.

O dia 27 foi planejado a pedido do casal para Palermo: Jardín Botánico às 9h30, Jardín Japonés às 11h, Planetário (visita externa) às 14h Rosedal às 15h e Floralis Genérica às 17h. A Floralis fica em Recoleta e encerra o dia antes da volta ao Airbnb, com deslocamento por aplicativo desde o Rosedal. Os horários e durações são sugestões, com pausa para almoço. Cada parada tem foto e marcador. Preços e regras foram consultados em fontes oficiais em 17/11/2026; a tarifa de não residentes do Jardim Japonês é ARS 24.000 por pessoa e pode mudar. Sessões internas do Planetário dependem da agenda e de ingressos. Caminhadas são estimativas, e marcadores de parques indicam o local, sem garantir um portão de acesso.
