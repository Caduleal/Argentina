const fs = require('fs');
const vm = require('vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync('dist/index.html', 'utf8');
const script = html.match(/<script id="app">([\s\S]*?)<\/script>/)[1];
new vm.Script(script);
function app(seed = {}, failSave = false) {
  const nodes = new Map();
  const storage = {...seed};
  class Element {
    set value(value){this._value=String(value);}
    get value(){return this._value;}
    constructor(){this.children=[];this.style={};this.dataset={};this.value='';this.textContent='';this.classList={toggle(){}};}
    setAttribute(k,v){this[k]=v;}
    removeAttribute(k){delete this[k];}
    append(...children){this.children.push(...children);}
    replaceChildren(){this.children=[];}
    addEventListener(){}
    focus(){}
    reset(){}
  }
  function node(key){if(!nodes.has(key))nodes.set(key,new Element());return nodes.get(key);}
  node('input[name="payment"]:checked').value='Crédito';
  node('input[name="category"]:checked').value='Restaurante';
  node('#expense-currency').value='ARS';node('#expense-day').value='22';
  const context = vm.createContext({
    document:{querySelector:node,querySelectorAll:selector=>selector==='.day'?node('#days').children:[],createElement:()=>new Element()},
    localStorage:{getItem:key=>storage[key]||null,setItem(key,value){if(failSave)throw Error('blocked');storage[key]=value;}},
    Intl,Date,Math,Number,JSON,URL,console,window:{scrollTo(){}},matchMedia:()=>({matches:false})
  });
  vm.runInContext(script,context);
  const run = code=>vm.runInContext(code,context);
  const submit = id=>node(id).onsubmit({preventDefault(){},target:{reset(){}}});
  return {run,node,submit,storage};
}
const a = app();
assert.equal(a.node('#days').children.length,8);
a.node('#expense-name').value='Teste ARS';a.node('#expense-amount').value='10000';a.node('#exchange-rate').value='0.0035';a.submit('#expense-form');
assert.equal(a.run('total()'),35);
assert.equal(a.run('state.expenses[0].currency'),'ARS');
a.node('#exchange-rate').value='0.004';a.node('#limit').value='200';a.submit('#budget-form');
assert.equal(a.run('total()'),35,'Nova cotação não altera gastos anteriores');
a.node('#expense-currency').value='BRL';a.node('#expense-name').value='Teste BRL';a.node('#expense-amount').value='20.50';a.submit('#expense-form');
assert.equal(a.run('total()'),55.5);
const restored = app(a.storage);assert.equal(restored.run('total()'),55.5);
a.node('#expense-currency').value='ARS';a.node('#exchange-rate').value='';a.submit('#expense-form');assert.equal(a.run('state.expenses.length'),2,'ARS exige taxa');
a.node('#expense-currency').value='BRL';a.node('input[name="category"]:checked').value='Outros';a.node('#expense-other').value='  ';a.submit('#expense-form');assert.equal(a.run('state.expenses.length'),2,'Outros exige detalhe');
a.node('#expense-other').value='Passeio';a.node('input[name="payment"]:checked').value='Dinheiro';a.submit('#expense-form');assert.equal(a.run('state.expenses[2].other'),'Passeio');assert.equal(a.run('state.expenses[2].payment'),'Dinheiro');
const old={currency:'ARS',limit:100000,expenses:[{id:'old-1',name:'Anterior',amount:20000,day:22}]};
const migrated=app({'mi-viaje-argentina-2026-v1':JSON.stringify(old)});
assert.equal(migrated.run('total()'),0);assert.equal(migrated.run('state.legacy.expenses.length'),1);
migrated.node('#legacy-rate').value='0.003';migrated.node('#migrate-legacy').onclick();assert.equal(migrated.run('total()'),60);assert.equal(migrated.run('state.legacy'),null);
assert.ok(migrated.storage['mi-viaje-argentina-2026-v1'],'Registro original preservado');
const blocked=app({},true);blocked.node('#limit').value='100';blocked.submit('#budget-form');assert.match(blocked.node('#budget-status').textContent,/Não foi possível salvar/);
assert.equal(a.run('convert(0.29,"BRL",1)'),29);
assert.ok(!html.includes('O próximo capítulo'));assert.ok(html.includes('Buenos Aires'));assert.ok(html.includes('Cadu e Vitor'));
assert.ok(!html.includes('id="place-count"'));assert.ok(!html.includes('id="planned-count"'));assert.ok(!html.includes('Uma viagem que vai tomando forma.'));
assert.equal(a.run('routeUrl([])'),null);
assert.match(a.run('routeUrl([{lat:-34.60,lon:-58.38},{lat:-34.61,lon:-58.39}])'),/travelmode=driving/);
assert.equal(a.run('validPlace({id:"a",name:"Teste",lat:-34.6,lon:-58.4})'),true);
assert.equal(a.run('validPlace({id:"a",name:"Teste",lat:95,lon:-58.4})'),false);
a.run('weatherLoading=false;weatherData={daily:{time:["2026-11-22"],weather_code:[0],temperature_2m_min:[18],temperature_2m_max:[27],precipitation_probability_max:[10],wind_speed_10m_max:[16]}};renderWeather()');
assert.match(a.node('#weather-content').children[1].textContent,/Máx 27°/);
a.run('selectedDay=23;weatherError=false;renderWeather()');assert.match(a.node('#weather-content').children[0].textContent,/23 de novembro/);
console.log('OK: oito dias, orçamento, persistência, migração, coordenadas, link de percurso e previsão pela data selecionada.');
