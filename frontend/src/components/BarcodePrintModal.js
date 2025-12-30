import React, { useState } from 'react';
import Barcode from 'react-barcode';
import { FiX, FiPrinter, FiSettings } from 'react-icons/fi';
import './BarcodePrintModal.css';

const BarcodePrintModal = ({ isOpen, onClose, products }) => {
  const [settings, setSettings] = useState({
    size: 'medium', // small, medium, large
    showName: true,
    showPrice: true,
    showWeight: true,
    showPurity: true,
    copies: 1
  });

  if (!isOpen) return null;

  const handlePrint = () => {
    const printWindow = window.open('', '', 'width=1000,height=800');
    
    // Generate HTML for the print window
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Barcodes</title>
          <style>
            @media print {
              @page {
                margin: 0;
                size: auto;
              }
              body {
                margin: 1cm;
              }
            }
            
            body {
              font-family: Arial, sans-serif;
            }

            .print-container {
              display: flex;
              flex-wrap: wrap;
              gap: 10px;
            }

            /* Small Label (Jewellery Tag / Rat Tail style) */
            .label-small {
              width: 80px;
              height: 40px;
              border: 1px dashed #ccc;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              padding: 2px;
              page-break-inside: avoid;
              font-size: 8px;
            }
            .label-small svg {
              max-width: 100%;
              max-height: 25px;
            }

            /* Medium Label (Standard Sticker) */
            .label-medium {
              width: 50mm;
              height: 30mm;
              border: 1px dashed #ccc;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              padding: 5px;
              page-break-inside: avoid;
              font-size: 10px;
            }
            .label-medium svg {
              max-width: 100%;
              max-height: 40px;
            }

            /* Large Label (Flat / Detailed) */
            .label-large {
              width: 70mm;
              height: 50mm;
              border: 1px solid #000;
              display: flex;
              flex-direction: column;
              align-items: center;
              padding: 10px;
              page-break-inside: avoid;
              font-size: 12px;
            }
            .label-large svg {
              max-width: 100%;
              height: auto;
            }

            .product-name {
              font-weight: bold;
              margin-bottom: 2px;
              text-align: center;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              max-width: 100%;
            }
            
            .product-details {
              display: flex;
              gap: 5px;
              flex-wrap: wrap;
              justify-content: center;
              margin-bottom: 2px;
            }

            .price {
              font-weight: bold;
            }

            @media print {
              .label-small, .label-medium, .label-large {
                border: none; /* Hide borders when printing actual labels */
              }
            }
          </style>
        </head>
        <body>
          <div class="print-container">
            ${generateLabelsHTML()}
          </div>
          <script>
            window.onload = function() {
              window.print();
              // window.close(); // Optional: close after print
            }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const generateLabelsHTML = () => {
    // We need to render the React components to static HTML strings for the popup.
    // Since we can't easily use ReactDOMServer in the browser without ejecting or extra config,
    // we will construct the HTML string manually for the popup content, 
    // BUT for the barcode SVG, we can't easily generate it as a string without the library.
    // 
    // ALTERNATIVE: Render the barcodes in the main window (hidden) and copy their SVGs/DataURIs?
    // OR: Use JsBarcode library in the popup window via CDN?
    // OR: Use the existing barcodeBase64 from the product if available?
    
    // The user wants "Product Bar Code". The backend provides `barcodeBase64`.
    // Let's check if we can rely on that.
    // If `barcodeBase64` is available, we use it.
    
    let html = '';
    products.forEach(product => {
      for (let i = 0; i < settings.copies; i++) {
        const details = [];
        if (settings.showWeight) details.push(`${product.grossWeight}g`);
        if (settings.showPurity) details.push(product.purity);
        if (settings.showPrice) details.push(`₹${product.sellingPrice}`);

        // Use the backend provided base64 barcode if available, 
        // otherwise we might need a fallback. 
        // Assuming backend provides it as per previous code analysis.
        const barcodeSrc = product.barcodeBase64 
          ? `data:image/png;base64,${product.barcodeBase64}`
          : ''; // If no barcode, we might need to handle it.

        html += `
          <div class="label-${settings.size}">
            ${settings.showName ? `<div class="product-name">${product.name}</div>` : ''}
            ${details.length > 0 ? `<div class="product-details">${details.join(' | ')}</div>` : ''}
            ${barcodeSrc ? `<img src="${barcodeSrc}" style="max-width:90%; max-height: 50px;" />` : `<div style="color:red">No Barcode</div><div style="font-size: 0.8em; letter-spacing: 1px;">${product.sku}</div>`}
          </div>
        `;
      }
    });
    return html;
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content barcode-modal">
        <div className="modal-header">
          <h2>Print Barcodes</h2>
          <button className="close-btn" onClick={onClose}><FiX /></button>
        </div>

        <div className="modal-body">
          <div className="settings-panel">
            <h3><FiSettings /> Settings</h3>
            
            <div className="setting-group">
              <label>Label Size</label>
              <select 
                value={settings.size} 
                onChange={(e) => setSettings({...settings, size: e.target.value})}
              >
                <option value="small">Small (Jewellery Tag)</option>
                <option value="medium">Medium (Standard)</option>
                <option value="large">Large (Detailed)</option>
              </select>
            </div>

            <div className="setting-group">
              <label>Copies per Product</label>
              <input 
                type="number" 
                min="1" 
                value={settings.copies}
                onChange={(e) => setSettings({...settings, copies: parseInt(e.target.value) || 1})}
              />
            </div>

            <div className="setting-group">
              <label>Include Details</label>
              <div className="checkbox-group">
                <label>
                  <input 
                    type="checkbox" 
                    checked={settings.showName}
                    onChange={(e) => setSettings({...settings, showName: e.target.checked})}
                  /> Product Name
                </label>
                <label>
                  <input 
                    type="checkbox" 
                    checked={settings.showPrice}
                    onChange={(e) => setSettings({...settings, showPrice: e.target.checked})}
                  /> Price
                </label>
                <label>
                  <input 
                    type="checkbox" 
                    checked={settings.showWeight}
                    onChange={(e) => setSettings({...settings, showWeight: e.target.checked})}
                  /> Weight
                </label>
                <label>
                  <input 
                    type="checkbox" 
                    checked={settings.showPurity}
                    onChange={(e) => setSettings({...settings, showPurity: e.target.checked})}
                  /> Purity
                </label>
              </div>
            </div>
          </div>

          <div className="preview-panel">
            <h3>Preview ({products.length} products selected)</h3>
            <div className={`preview-container label-${settings.size}`}>
              {products.length > 0 && (
                <div className="preview-label">
                  {settings.showName && <div className="product-name">{products[0].name}</div>}
                  <div className="product-details">
                    {[
                      settings.showWeight ? `${products[0].grossWeight}g` : null,
                      settings.showPurity ? products[0].purity : null,
                      settings.showPrice ? `₹${products[0].sellingPrice}` : null
                    ].filter(Boolean).join(' | ')}
                  </div>
                  {/* Preview using react-barcode for live feedback if needed, 
                      or just a placeholder since we use image in print */}
                  <div className="barcode-placeholder">
                     <Barcode value={products[0].sku || '123456'} width={1} height={40} fontSize={12} />
                  </div>
                </div>
              )}
              {products.length === 0 && <p>No products selected</p>}
            </div>
            <p className="preview-note">* Layout may vary slightly in actual print</p>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handlePrint}>
            <FiPrinter /> Print Labels
          </button>
        </div>
      </div>
    </div>
  );
};

export default BarcodePrintModal;
