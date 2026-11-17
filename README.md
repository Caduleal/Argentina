# Buenos Aires · Cadu e Vitor

Esqueleto da Fase 1, de 22 a 29 de novembro de **2026**. Ano assumido com base na data atual. Nenhum local, reserva ou preço foi inventado.

## Abrir e testar

Abra `dist/index.html` no navegador, sem instalação ou build. Para testar no celular, prefira o endereço hospedado. O computador e o celular têm armazenamentos independentes.

O HTML contém os estilos e JavaScript, com utilitários do Tailwind via CDN e fontes do Google Fonts. As regras essenciais de layout também estão no CSS local para manter a página utilizável sem esses recursos externos. Não é um PWA e ainda não tem cache offline.

## Arquitetura

- **Roteiro:** bandeira argentina e Buenos Aires no topo; título pessoal; galeria de fotos; seleção de dias; previsão para a data selecionada; mapa e roteiro em abas. Desktop: orçamento ao lado. Celular: conteúdo em coluna. Contadores e textos extras do rodapé foram removidos.
- **Orçamento:** limite em reais, cotação editável, saldo, despesas em ARS/BRL, pagamento, categoria, exclusão e histórico.
- **Minha viagem:** espaços para hospedagem, voos e reservas; exportação JSON do orçamento.
- **Navegação inferior fixa:** alvos de pelo menos 48 px e espaçamento para a área segura de celulares.
- **Interações:** seleção dos dias com hover e elevação/escala, estado anunciado, abas com `aria-current`, feedback acessível e redução de movimento respeitada.

## Design system

| Token | Valor | Uso | Equivalente Tailwind |
| --- | --- | --- | --- |
| Ink | `#233b44` | texto, botões | `bg-[#233b44] text-white` |
| Paper | `#faf7f0` | fundo com tom de papel | `bg-[#faf7f0]` |
| Sky | `#acd9df` | destaque argentino | `bg-[#acd9df]` |
| Sky light | `#edf5f2` | abas, ações secundárias | `bg-[#edf5f2]` |
| Muted | `#667371` | texto secundário | `text-[#667371]` |
| Line | `#e7e2d8` | bordas | `border-[#e7e2d8]` |
| Gold | `#e9b655` | sol decorativo | `text-[#e9b655]` |

Títulos: **Manrope**, 600–800. Texto e formulários: **DM Sans**, 400–700. Cards com raio de 24 px, botões com 12 px e escala de espaçamento baseada em 4 px.

Equivalentes estruturais: `max-w-5xl mx-auto px-5 pb-32`, `grid gap-5 md:grid-cols-2`, `flex overflow-x-auto gap-2`, `fixed bottom-0 inset-x-0`, `min-h-12 rounded-xl`, `transition-colors duration-200 motion-reduce:transition-none`. As classes reais são semânticas e estão no próprio HTML.

## Popular o roteiro

No script, `TRIP.days` guarda os oito dias. Não foram adicionados locais de visita. Você pode marcar uma posição no mapa e preencher nome, horário, preço, como chegar e observações. A ordem das paradas pode ser ajustada na aba de detalhes. Os dados ficam no `localStorage`, separados do orçamento, e entram na exportação JSON.

Estrutura de cada parada (campos ilustrativos, sem local real):

```js
{
  id: 'identificador-unico',
  lat: -34.60,
  lon: -58.38,
  time: 'HH:mm',
  name: 'Nome enviado por você',
  price: 'Valor e moeda / gratuito / a confirmar',
  transport: 'Como chegar',
  note: 'Observações enviadas por você',
}
```

Mapa com Leaflet 1.9.4 e OpenStreetMap; paradas numeradas por dia. Com duas ou mais paradas, o OSRM calcula o trajeto **de carro** pelas ruas na ordem escolhida, com distância e tempo estimados, sem trânsito ao vivo. Não usa linha reta como se fosse rota real. Um link abre o percurso no Google Maps. Se o serviço falhar, o app informa a indisponibilidade.

Previsão via [Open-Meteo](https://open-meteo.com/en/docs), com temperatura mínima/máxima, chance de chuva e vento para Buenos Aires. A seleção usa a data ISO exata, no fuso `America/Argentina/Buenos_Aires`. Datas fora da resposta de até 16 dias mostram indisponibilidade; nenhum dado meteorológico é inventado. A fonte aparece no card.

Fotos remotas do [Ente de Turismo de Buenos Aires](https://turismo.buenosaires.gob.ar/es/recorrido/imperdibles): Teatro Colón, Caminito e El Ateneo Grand Splendid. São imagens ilustrativas da cidade; não adicionam paradas ao roteiro. Galeria com gestos horizontais, setas, seleção e descrições acessíveis, sem reprodução automática.

## Orçamento

`localStorage` com chave `minha-viagem-argentina-2026-v2`. Totais em centavos de BRL. Cada novo gasto aceita ARS ou BRL; o total e o saldo são sempre em reais. Cotação manual expressa em **R$ por 1 ARS**, sem API externa ou cotação presumida. A prévia converte enquanto você digita. Cada despesa guarda valor original, moeda, taxa usada e valor em centavos de reais, preservando o histórico quando a taxa muda.

Formas de pagamento: Crédito, Débito e Dinheiro. Uma categoria por gasto: Restaurante, Transporte, Presentes, Mercado ou Outros. Outros exige descrição adicional. Categorias e pagamentos usam rádios acessíveis em botões visuais.

Registros antigos em BRL são recuperados automaticamente. Registros antigos em ARS ou USD ficam preservados e fora do total até você informar uma taxa no painel de recuperação. O limite antigo em moeda estrangeira permanece na cópia exportada; defina o novo limite em reais. A chave antiga não é apagada.

Exportação JSON para cópia manual do orçamento e roteiro; importação, sincronização entre dispositivos e instalação offline ficam para fases futuras. Os dados são locais ao navegador, não compartilhados entre vocês automaticamente. Fotos, mapa, rotas e previsão precisam de conexão.

## Verificação

Execute `node verify.cjs`. O teste exercita conversão ARS/BRL, mistura de moedas, preservação de taxas históricas, validação de Outros, persistência, recuperação de registros antigos, falha de armazenamento, coordenadas e seleção de previsão por data com um DOM simulado. Conferência adicional no navegador: três fotos carregadas, previsão alterada do dia 22 para 23, adição e remoção de duas paradas de teste, abas e rota real pelas ruas. Os registros de teste foram removidos ao finalizar.
