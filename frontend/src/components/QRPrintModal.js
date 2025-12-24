import React, { useState, useEffect } from 'react';
import { FiX, FiPrinter, FiSettings, FiLoader } from 'react-icons/fi';
import api from '../utils/api';
import { toast } from 'react-toastify';
import './QRPrintModal.css';

const QRPrintModal = ({ isOpen, onClose, selectedIds }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({
    size: 'small', // very_small, small, medium
    showName: true,
    showSku: true,
    showPrice: false,
    copies: 1
  });

  useEffect(() => {
    if (isOpen && selectedIds.length > 0) {
      fetchQRCodes();
    }
  }, [isOpen, selectedIds]);

  const fetchQRCodes = async () => {
    setLoading(true);
    try {
      const response = await api.post('/api/products/qr-codes', { ids: selectedIds });
      setItems(response.data.items || []);
    } catch (error) {
      console.error('Failed to fetch QR codes:', error);
      toast.error('Failed to generate QR codes');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handlePrint = () => {
    const printWindow = window.open('', '', 'width=1000,height=800');
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print QR Codes</title>
          <style>
            @media print {
              @page {
                margin: 0;
                size: auto;
              }
              body {
                margin: 0.5cm;
              }
            }
            
            body {
              font-family: Arial, sans-serif;
            }

            .print-container {
              display: flex;
              flex-wrap: wrap;
              gap: 5px;
            }

            /* Very Small Label (Jewellery Tag) */
            .label-very_small {
              width: 15mm;
              height: 15mm;
              border: 1px dashed #ccc;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              padding: 1px;
              page-break-inside: avoid;
              font-size: 6px;
              overflow: hidden;
            }
            .label-very_small img {
              width: 10mm;
              height: 10mm;
            }

            /* Small Label */
            .label-small {
              width: 25mm;
              height: 25mm;
              border: 1px dashed #ccc;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              padding: 2px;
              page-break-inside: avoid;
              font-size: 8px;
            }
            .label-small img {
              width: 18mm;
              height: 18mm;
            }

            /* Medium Label */
            .label-medium {
              width: 40mm;
              height: 40mm;
              border: 1px dashed #ccc;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              padding: 4px;
              page-break-inside: avoid;
              font-size: 10px;
            }
            .label-medium img {
              width: 30mm;
              height: 30mm;
            }

            .item-text {
              text-align: center;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              max-width: 100%;
              line-height: 1.1;
            }

            .sku { font-weight: bold; }

            @media print {
              .label-very_small, .label-small, .label-medium {
                border: none;
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
            }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const generateLabelsHTML = () => {
    let html = '';
    items.forEach(item => {
      for (let i = 0; i < settings.copies; i++) {
        html += `
          <div class="label-${settings.size}">
            <img src="data:image/png;base64,${item.qrBase64}" />
            ${settings.showSku ? `<div class="item-text sku">${item.sku}</div>` : ''}
            ${settings.showName ? `<div class="item-text">${item.name}</div>` : ''}
            ${settings.showPrice && item.sellingPrice ? `<div class="item-text">₹${item.sellingPrice}</div>` : ''}
          </div>
        `;
      }
    });
    return html;
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content qr-modal">
        <div className="modal-header">
          <h2>Print QR Codes</h2>
          <button className="close-btn" onClick={onClose}><FiX /></button>
        </div>

        {loading ? (
          <div className="loading-state">
            <FiLoader className="spin" /> Generating QR Codes...
          </div>
        ) : (
          <div className="modal-body">
            <div className="settings-panel">
              <h3><FiSettings /> Settings</h3>
              
              <div className="setting-group">
                <label>Label Size</label>
                <select 
                  value={settings.size} 
                  onChange={(e) => setSettings({...settings, size: e.target.value})}
                >
                  <option value="very_small">Very Small (15mm)</option>
                  <option value="small">Small (25mm)</option>
                  <option value="medium">Medium (40mm)</option>
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
                      checked={settings.showSku}
                      onChange={(e) => setSettings({...settings, showSku: e.target.checked})}
                    /> Show SKU
                  </label>
                  <label>
                    <input 
                      type="checkbox" 
                      checked={settings.showName}
                      onChange={(e) => setSettings({...settings, showName: e.target.checked})}
                    /> Show Name
                  </label>
                  <label>
                    <input 
                      type="checkbox" 
                      checked={settings.showPrice}
                      onChange={(e) => setSettings({...settings, showPrice: e.target.checked})}
                    /> Show Price
                  </label>
                </div>
              </div>
            </div>

            <div className="preview-panel">
              <h3>Preview ({items.length} products)</h3>
              <div className={`preview-container label-${settings.size}`}>
                {items.length > 0 && (
                  <div className="preview-label">
                    <img 
                      src={`data:image/png;base64,${items[0].qrBase64}`} 
                      alt="QR Preview" 
                      className="qr-preview-img"
                    />
                    {settings.showSku && <div className="item-text sku">{items[0].sku}</div>}
                    {settings.showName && <div className="item-text">{items[0].name}</div>}
                    {settings.showPrice && <div className="item-text">₹{items[0].sellingPrice}</div>}
                  </div>
                )}
                {items.length === 0 && <p>No items to preview</p>}
              </div>
              <p className="preview-note">* Actual print quality may vary</p>
            </div>
          </div>
        )}

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handlePrint} disabled={loading || items.length === 0}>
            <FiPrinter /> Print QR Codes
          </button>
        </div>
      </div>
    </div>
  );
};

export default QRPrintModal;
