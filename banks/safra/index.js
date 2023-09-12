const moment = require("moment");
var formatters = require("../../lib/formatters");
var ediHelper = require("../../lib/edi-helper");
var helper = require("./helper");

exports.options = {
  logoURL:
    "https://github.com/onloc/assets/blob/ab8f1b6e9288eee8433c703fcf00b032419ef3a9/banco-safra-boleto.png?raw=true",
  codigo: "422",
};

exports.dvBarra = function (numeroStr) {
  // Inicializa variáveis para o cálculo do DV
  let soma = 0;
  let peso = 2;

  // Percorre os dígitos do número da direita para a esquerda
  for (let i = numeroStr.length - 1; i >= 0; i--) {
    let digito = parseInt(numeroStr[i], 10);

    // Multiplica o dígito pelo peso atual e adiciona à soma
    let resultadoParcial = digito * peso;

    // Se o resultado parcial for maior que 9, soma os dígitos individuais
    if (resultadoParcial > 9) {
      resultadoParcial =
        Math.floor(resultadoParcial / 10) + (resultadoParcial % 10);
    }

    soma += resultadoParcial;

    // Alterna o peso entre 2 e 1
    peso = peso === 2 ? 1 : 2;
  }

  // Calcula o dígito verificador
  const dv = (10 - (soma % 10)) % 10;

  return dv;
};

exports.barcodeData = function (boleto) {
  var codigoBanco = this.options.codigo;
  var numMoeda = "9";

  var fatorVencimento = formatters.fatorVencimento(
    moment(boleto["data_vencimento"]).utc().format()
  );

  var agencia = formatters.addTrailingZeros(boleto["agencia"], 4);

  var valor = formatters.addTrailingZeros(boleto["valor"], 10);
  var carteira = boleto["carteira"];
  var codigoCedente = formatters.addTrailingZeros(boleto["codigo_cedente"], 7);

  var nossoNumero =
    carteira + formatters.addTrailingZeros(boleto["nosso_numero"], 11);

  var barra =
    codigoBanco +
    numMoeda +
    fatorVencimento +
    valor +
    agencia +
    nossoNumero +
    codigoCedente +
    "0";

  var dvBarra = this.dvBarra(barra);
  var lineData =
    barra.substring(0, 4) + dvBarra + barra.substring(4, barra.length);

  return lineData;
};

exports.linhaDigitavel = function (barcodeData) {
  var campos = [];

  var codigoBanco = barcodeData.substr(0, 3);
  var numMoeda = barcodeData.substr(3, 1);
  var fixo = barcodeData.substr(19, 1);
  var agencia = barcodeData.substr(20, 4);
  var agenciaDig = barcodeData.substr(21, 1);
  var codigoCedente = barcodeData.substr(25, 9);
  var numeroDoc = barcodeData.substr(34, 9);
  var secFixo = barcodeData.substr(43, 1);
  var dac = barcodeData.substr(4, 1);
  var fatorVencimento = barcodeData.substr(5, 4);
  var valor = barcodeData.substr(9, 10);

  var dvRef1 = codigoBanco + numMoeda + fixo + agencia;
  var dv1 = this.dvBarra(dvRef1);

  var dvRef2 = agenciaDig + codigoCedente;
  var dv2 = this.dvBarra(dvRef2);

  var dvRef3 = numeroDoc + secFixo;
  var dv3 = this.dvBarra(dvRef3);

  campos.push(codigoBanco + numMoeda + fixo + "." + agencia.substr(0, 4) + dv1);
  campos.push(
    agencia.substr(3, 1) +
      codigoCedente.substr(0, 4) +
      "." +
      codigoCedente.substr(4, 5) +
      dv2
  );

  campos.push(
    numeroDoc.substr(0, 5) + "." + numeroDoc.substr(5, 4) + secFixo + dv3
  );
  campos.push(dac);
  campos.push(fatorVencimento + valor);
  return campos.join(" ");
};

exports.parseEDIFile = function (fileContent) {
  try {
    var lines = fileContent.split("\n");
    var parsedFile = {
      boletos: {},
    };

    var currentNossoNumero = null;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var registro = line.substring(7, 8);

      if (registro == "0") {
        parsedFile["cnpj"] = line.substring(17, 32);
        parsedFile["razao_social"] = line.substring(72, 102);
        parsedFile["agencia_cedente"] = line.substring(32, 36);
        parsedFile["conta_cedente"] = line.substring(37, 47);
        parsedFile["data_arquivo"] = helper.dateFromEdiDate(
          line.substring(143, 152)
        );
      } else if (registro == "3") {
        var segmento = line.substring(13, 14);

        if (segmento == "T") {
          var boleto = {};

          boleto["codigo_ocorrencia"] = line.substring(15, 17);
          boleto["vencimento"] = formatters.dateFromEdiDate(
            line.substring(69, 77)
          );
          boleto["valor"] = formatters.removeTrailingZeros(
            line.substring(77, 92)
          );
          boleto["tarifa"] = formatters.removeTrailingZeros(
            line.substring(193, 208)
          );
          boleto["banco_recebedor"] = formatters.removeTrailingZeros(
            line.substring(92, 95)
          );
          boleto["agencia_recebedora"] = formatters.removeTrailingZeros(
            line.substring(95, 100)
          );

          currentNossoNumero = formatters.removeTrailingZeros(
            line.substring(40, 52)
          );
          parsedFile.boletos[currentNossoNumero] = boleto;
        } else if (segmento == "U") {
          parsedFile.boletos[currentNossoNumero]["valor_pago"] =
            formatters.removeTrailingZeros(line.substring(77, 92));

          var paid =
            parsedFile.boletos[currentNossoNumero]["valor_pago"] >=
            parsedFile.boletos[currentNossoNumero]["valor"];
          paid =
            paid &&
            parsedFile.boletos[currentNossoNumero]["codigo_ocorrencia"] == "17";

          boleto = parsedFile.boletos[currentNossoNumero];

          boleto["pago"] = paid;
          boleto["edi_line_number"] = i;
          boleto["edi_line_checksum"] = ediHelper.calculateLineChecksum(line);
          boleto["edi_line_fingerprint"] =
            boleto["edi_line_number"] + ":" + boleto["edi_line_checksum"];

          currentNossoNumero = null;
        }
      }
    }

    return parsedFile;
  } catch (e) {
    return null;
  }
};
