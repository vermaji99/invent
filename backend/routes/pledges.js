const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const { body } = require('express-validator');
const pledgeController = require('../controllers/pledgeController');

const createValidations = [
  body('customer.name').notEmpty(),
  body('customer.phone').notEmpty(),
  body('customer.email').isEmail(),
  body('customer.address').notEmpty(),
  body('customer.governmentId').notEmpty(),
  body('customer.idProofUrl').notEmpty(),
  body('gold.itemName').notEmpty(),
  body('gold.grossWeight').isFloat({ gt: 0 }),
  body('gold.netWeight').isFloat({ gt: 0 }),
  body('gold.purity').isIn(['22K', '24K', '18K']),
  body('gold.valuationAmount').isFloat({ gt: 0 }),
  body('loan.amountGiven').isFloat({ gt: 0 }),
  body('loan.interestPeriod').isIn(['day', 'month']),
  body('loan.interestUnit').isIn(['amount', 'percent']),
  body('loan.interestRate').isFloat({ gt: 0 }),
  body('loan.startDate').notEmpty(),
  body('loan.endDate').notEmpty()
];

router.post('/', [auth, authorize('admin') , ...createValidations], pledgeController.createPledge);
router.get('/', auth, pledgeController.listPledges);
router.get('/metrics', auth, pledgeController.getMetrics);
router.get('/:id', auth, pledgeController.getPledgeById);
router.patch('/:id/status', [auth, authorize('admin')], pledgeController.updateStatus);
router.delete('/:id', [auth, authorize('admin')], pledgeController.deletePledge);

module.exports = router;

