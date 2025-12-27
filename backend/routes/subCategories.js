const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');

const MAP = {
  Gold: ['Ring', 'Necklace', 'Bangle', 'Chain', 'Pendant', 'Earring'],
  Silver: ['Ring', 'Anklet', 'Bracelet', 'Pendant', 'Chain', 'Earring'],
  Diamond: ['Ring', 'Necklace', 'Pendant', 'Earring', 'Bracelet'],
  Platinum: ['Ring', 'Bracelet', 'Pendant', 'Earring'],
  Other: ['Accessory', 'Gift', 'Custom']
};

router.get('/', auth, async (req, res) => {
  try {
    const category = req.query.category;
    if (category) {
      const list = MAP[category] || [];
      return res.json({ category, subCategories: list });
    }
    const all = Object.entries(MAP).map(([cat, subs]) => ({ category: cat, subCategories: subs }));
    res.json(all);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: 'Invalid request' });
  }
});

module.exports = router;

