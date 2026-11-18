import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeSearch, extractPriceValue, rankProperties, EMPTY_CATALOG_FILTERS } from '../lib/catalog-search.ts'

const property = (id, overrides = {}) => ({ id, title: 'Apartamento', type: 'Apartamento', purpose: 'Venda', city: 'Vacaria', neighborhood: 'Centro', location: 'Centro, Vacaria', description: 'Apartamento com sacada', price: 'R$ 350.000', priceValue: 35000000, bedrooms: 2, parking: 1, views: 0, ...overrides })
const properties = [property('affordable'), property('expensive',{priceValue:95000000}), property('other-city',{city:'Caxias do Sul',location:'Centro, Caxias do Sul'}), property('land',{type:'Terreno', title:'Terreno', bedrooms:0}), property('rental',{purpose:'Locação',priceValue:180000}), property('unknown-price',{priceValue:0})]
const results = (query, filters = {}) => rankProperties(properties, analyzeSearch(query), {...EMPTY_CATALOG_FILTERS,...filters}).map(({property}) => property.id)

for (const input of ['500 mil','até 500 mil','R$ 500.000','até R$ 500.000,00','500000']) test(`orçamento: ${input}`,()=>assert.equal(extractPriceValue(input),50000000))
for (const input of ['até 1,5 milhão','R$ 1.500.000','1.5 mi']) test(`orçamento decimal: ${input}`,()=>assert.equal(extractPriceValue(input),150000000))
for (const input of ['Apartamento 2 quartos','3 vagas','imóvel 123','até 2 quartos']) test(`não confunde quantidade com dinheiro: ${input}`,()=>assert.equal(extractPriceValue(input),null))
test('extrai preço depois do número de quartos',()=>assert.equal(extractPriceValue('Apartamento 2 quartos até 500 mil'),50000000))
test('dois quartos não elimina apartamentos existentes',()=>assert.ok(results('Apartamento 2 quartos').includes('affordable')))
test('orçamento exclui imóveis caros e valores não informados',()=>{assert.ok(results('até 500 mil').includes('affordable'));assert.ok(!results('até 500 mil').includes('expensive'));assert.ok(!results('até 500 mil').includes('unknown-price'))})
test('combina tipo, cidade e orçamento em vez de aceitar só um termo',()=>assert.deepEqual(results('apartamento em Vacaria até 500 mil'),['affordable','rental']))
test('filtro numérico e busca textual têm a mesma interpretação',()=>assert.deepEqual(results('',{maxPrice:'500.000'}),results('até 500 mil')))
test('terreno e finalidade são filtros independentes',()=>{assert.deepEqual(results('',{type:'Terreno',purpose:'Venda'}),['land']);assert.deepEqual(results('',{purpose:'Locação'}),['rental'])})
test('cidade exata não inclui outra cidade',()=>assert.ok(!results('',{city:'Vacaria'}).includes('other-city')))
test('comercial engloba sala e loja, mas filtros de tipo continuam exatos',()=>{const list=[property('office',{type:'Sala Comercial',title:'Sala comercial'}),property('store',{type:'Loja',title:'Loja comercial'}),property('commercial',{type:'Comercial',title:'Comercial'})];assert.equal(rankProperties(list,analyzeSearch('comercial'),EMPTY_CATALOG_FILTERS).length,3);assert.equal(rankProperties(list,analyzeSearch(''),{...EMPTY_CATALOG_FILTERS,type:'Loja'}).length,1)})
