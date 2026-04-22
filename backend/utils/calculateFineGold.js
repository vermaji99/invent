/**
 * Calculates fine gold weight based on total weight and purity percentage.
 * 
 * @param {number} weight - Total weight in grams
 * @param {number} purity - Purity percentage (0-100)
 * @returns {number} Fine gold weight in grams
 */
const calculateFineGold = (weight, purity) => {
  if (!weight || !purity) return 0;
  return (parseFloat(weight) * parseFloat(purity)) / 100;
};

module.exports = { calculateFineGold };
