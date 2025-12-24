const bwipjs = require('bwip-js');

const generateBarcode = async (text) => {
  return new Promise((resolve, reject) => {
    bwipjs.toBuffer({
      bcid: 'code128',
      text: text,
      scale: 3,
      height: 10,
      includetext: true,
      textxalign: 'center',
    }, function (err, png) {
      if (err) {
        reject(err);
      } else {
        resolve(png);
      }
    });
  });
};

const generateQrCode = async (text) => {
  return new Promise((resolve, reject) => {
    bwipjs.toBuffer({
      bcid: 'qrcode',
      text: text,
      scale: 6,
      version: 5,
      ecclevel: 'M'
    }, function (err, png) {
      if (err) {
        reject(err);
      } else {
        resolve(png);
      }
    });
  });
};

module.exports = generateBarcode;
module.exports.generateQrCode = generateQrCode;
