var express = require('express')
var path = require('path')

var app = express()

var Boleto = require('../index').Boleto

var boleto = new Boleto({
  'banco': 'safra',
  'data_emissao': new Date(),
  'data_vencimento': new Date(2020,6,4),
  'valor': '62998',
  'nosso_numero': '6',
  'numero_documento': '123456789',
  'cedente': 'Onloc - Locação de Computadores Ltda - 16.700.797/0001-70',
  'cedente_cnpj': '16.700.797/0001-70',
  'agencia': '99990',
  'codigo_cedente': '0008554440',
  'carteira': '1',
  'pagador': '4 IDEA COMERCIO, IMPORTACAO E EXPORTACAO DE PRODUTOS MEDICOS E HOSPITALARES LTDA\nCPF: 31.277.655/0001-35\nR JOAO DE SOUZA COELHO, 286, PRQ VIA N13065703 CAMPINAS SP',
  'local_de_pagamento': 'Pagável em qualquer Banco do sistema de compensação.',
  'instrucoes': 'Sr. Caixa, aceitar o pagamento e não cobrar juros após o vencimento.',
  //'barcode': '42295946200000250227124000085544404180276562'
  barcode: '42297124030008554440104850000227994790000026644'
})

// console.log(boleto['linha_digitavel']);

app.use(express.static(path.join(__dirname, '/../')))

app.get('/', function (req, res) { 

  boleto.renderHTML(function (html) {
    return res.send(html)
  })
})

app.listen(3003)
