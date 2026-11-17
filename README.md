# Minha Viagem · Cadu e Vítor

Esqueleto da Fase 1, de 22 a 29 de novembro de **2026**. Ano assumido com base na data atual. Nenhum local, reserva ou preço foi inventado.

## Abrir e testar

Abra `dist/index.html` no navegador, sem instalação ou build. Para testar no celular, prefira o endereço hospedado. O computador e o celular têm armazenamentos independentes.

O HTML contém os estilos e JavaScript, com utilitários do Tailwind via CDN e fontes do Google Fonts. As regras essenciais de layout também estão no CSS local para manter a página utilizável sem esses recursos externos. Não é um PWA e ainda não tem cache offline.

## Arquitetura

- **Roteiro:** cabeçalho, resumo, faixa horizontal com oito dias e painel de atividades do dia. Desktop: orçamento ao lado. Celular: conteúdo em coluna.
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

No script, `TRIP.days` guarda os oito dias. Cada dia tem `places: []`. Ao receber os locais, preencher o array correspondente com objetos nesta estrutura (campos ilustrativos, sem local real):

```js
{
  time: 'HH:mm',
  name: 'Nome enviado por você',
  note: 'Observações enviadas por você',
  mapUrl: 'https://…'
}
```

O renderizador já prepara cards e links HTTPS de mapa. Os contadores são calculados a partir desses dados. Os dados do roteiro pertencem ao código; o orçamento pertence ao navegador.

## Orçamento

`localStorage` com chave `minha-viagem-argentina-2026-v2`. Totais em centavos de BRL. Cada novo gasto aceita ARS ou BRL; o total e o saldo são sempre em reais. Cotação manual expressa em **R$ por 1 ARS**, sem API externa ou cotação presumida. A prévia converte enquanto você digita. Cada despesa guarda valor original, moeda, taxa usada e valor em centavos de reais, preservando o histórico quando a taxa muda.

Formas de pagamento: Crédito, Débito e Dinheiro. Uma categoria por gasto: Restaurante, Transporte, Presentes, Mercado ou Outros. Outros exige descrição adicional. Categorias e pagamentos usam rádios acessíveis em botões visuais.

Registros antigos em BRL são recuperados automaticamente. Registros antigos em ARS ou USD ficam preservados e fora do total até você informar uma taxa no painel de recuperação. O limite antigo em moeda estrangeira permanece na cópia exportada; defina o novo limite em reais. A chave antiga não é apagada.

Exportação JSON para cópia manual; importação, sincronização entre dispositivos, edição de locais na interface e instalação offline ficam para fases futuras. O formulário avisa quando o navegador impede a gravação.

## Verificação

Execute `node verify.cjs`. O teste exercita conversão ARS/BRL, mistura de moedas, preservação de taxas históricas, validação de Outros, persistência, recuperação de registros antigos e falha de armazenamento com um DOM simulado. Ele não substitui a conferência visual no celular.
