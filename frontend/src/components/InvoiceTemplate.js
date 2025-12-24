import React from 'react';
import './InvoiceTemplate.css';

const InvoiceTemplate = React.forwardRef(({ invoice, shopDetails }, ref) => {
  if (!invoice) return null;

  return (
    <div className="invoice-print-container" ref={ref}>
      {/* Header */}
      <div className="invoice-header">
        <div className="shop-info">
          <h1 className="shop-name">{shopDetails?.name || 'Jewellery Shop'}</h1>
          <p>{shopDetails?.address || 'Shop Address Here'}</p>
          <p>Phone: {shopDetails?.phone || 'Phone Number'} | Email: {shopDetails?.email || 'Email Address'}</p>
          <p>GSTIN: {shopDetails?.gstNumber || shopDetails?.gstin || 'GSTIN Number'}</p>
        </div>
        <div className="invoice-meta">
          <h2>TAX INVOICE</h2>
          <div className="meta-row">
            <span>Invoice No:</span>
            <strong>{invoice.invoiceNumber}</strong>
          </div>
          <div className="meta-row">
            <span>Date:</span>
            <strong>{new Date(invoice.createdAt).toLocaleDateString('en-IN')}</strong>
          </div>
        </div>
      </div>

      {/* Customer & Bill To */}
      <div className="invoice-customer-section">
        <div className="customer-details">
          <h3>Bill To:</h3>
          <p><strong>{invoice.customer?.name}</strong></p>
          <p>{invoice.customer?.address?.street}, {invoice.customer?.address?.city}</p>
          <p>Phone: {invoice.customer?.phone}</p>
        </div>
      </div>

      {/* Items Table */}
      <table className="invoice-table">
        <thead>
          <tr>
            <th>SN</th>
            <th>Description</th>
            <th>HUID</th>
            <th>HSN/SAC</th>
            <th>Weight (g)</th>
            <th>Purity</th>
            <th>Rate</th>
            <th>Making</th>
            <th>Wastage</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item, index) => (
            <tr key={index}>
              <td>{index + 1}</td>
              <td>
                {item.product?.name || item.name}
                <br />
                <small>{item.product?.category}</small>
              </td>
              <td>{item.product?.huid || '-'}</td>
              <td>{item.product?.hsnCode || '7113'}</td>
              <td>{item.weight}</td>
              <td>{item.purity || '22K'}</td>
              <td>{item.rate}</td>
              <td>{item.makingCharge}</td>
              <td>{item.wastage}</td>
              <td>{item.subtotal}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Exchange Items Table */}
      {invoice.exchange && invoice.exchange.items && invoice.exchange.items.length > 0 && (
        <div className="exchange-details-section">
            <h4>Old Gold / Exchange Details</h4>
            <table className="invoice-table exchange-table">
                <thead>
                    <tr>
                        <th>Description</th>
                        <th>Weight (g)</th>
                        <th>Purity (%)</th>
                        <th>Rate</th>
                        <th>Amount</th>
                    </tr>
                </thead>
                <tbody>
                    {invoice.exchange.items.map((item, index) => (
                        <tr key={index}>
                            <td>{item.description}</td>
                            <td>{item.weight}</td>
                            <td>{item.purity}</td>
                            <td>{item.rate}</td>
                            <td>{item.amount.toFixed(2)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      )}

      {/* Totals Section */}
      <div className="invoice-footer-section">
        <div className="terms-section">
          <h4>Terms & Conditions:</h4>
          <ul>
            <li>Goods once sold will not be taken back.</li>
            <li>Subject to local jurisdiction.</li>
            <li>E. & O.E.</li>
          </ul>
          <div className="signature-area">
            <p>Authorized Signatory</p>
          </div>
        </div>
        <div className="totals-section">
          <div className="total-row">
            <span>Subtotal:</span>
            <span>{invoice.subtotal.toFixed(2)}</span>
          </div>
          <div className="total-row">
            <span>Discount:</span>
            <span>- {invoice.discount.toFixed(2)}</span>
          </div>
          <div className="total-row">
            <span>CGST (1.5%):</span>
            <span>{(invoice.gst / 2).toFixed(2)}</span>
          </div>
          <div className="total-row">
            <span>SGST (1.5%):</span>
            <span>{(invoice.gst / 2).toFixed(2)}</span>
          </div>
          {invoice.exchange && invoice.exchange.totalAmount > 0 && (
            <div className="total-row">
              <span>Old Gold Adj:</span>
              <span>- {invoice.exchange.totalAmount.toFixed(2)}</span>
            </div>
          )}
          {invoice.oldGoldAdjustment > 0 && !invoice.exchange && (
             <div className="total-row">
               <span>Old Gold Adj:</span>
               <span>- {invoice.oldGoldAdjustment.toFixed(2)}</span>
             </div>
          )}
          <div className="grand-total-row">
            <span>Grand Total:</span>
            <span>₹ {Math.round(invoice.total).toFixed(2)}</span>
          </div>
          <div className="amount-words">
            Amount in words: {convertNumberToWords(Math.round(invoice.total))} Only
          </div>
        </div>
      </div>
      
      <div className="invoice-footer-message">
        <p>Thank you for your business!</p>
      </div>
    </div>
  );
});

// Helper function to convert number to words (Simplified version)
function convertNumberToWords(amount) {
    // Basic implementation or placeholder
    return amount + ""; // In a real app, use a library or proper function
}

export default InvoiceTemplate;
