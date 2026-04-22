/**
 * Calculates fine gold weight based on total weight and purity percentage.
 *
 * @param {number} weight - Total weight in grams
 * @param {number} purity - Purity percentage (0-100)
 * @returns {number} Fine gold weight in grams
 */
const calculateFineGold = (weight, purity) => {
  if (!weight) return 0;
  if (!purity) return parseFloat(weight);
  return (parseFloat(weight) * parseFloat(purity)) / 100;
};

/**
 * Applies a deduction percentage to fine gold weight.
 *
 * @param {number} fineGold - Fine gold weight
 * @param {number} deductionPercent - Deduction percentage (0-100)
 * @returns {number} Final fine gold weight after deduction
 */
const applyDeduction = (fineGold, deductionPercent = 0) => {
  if (!fineGold) return 0;
  return fineGold - (fineGold * parseFloat(deductionPercent)) / 100;
};

/**
 * Calculates pure silver weight based on total weight and purity percentage.
 * Same formula as gold - weight * purity / 100
 *
 * @param {number} weight - Total weight in grams
 * @param {number} purity - Purity percentage (0-100), e.g., 925 for sterling silver
 * @returns {number} Pure silver weight in grams
 */
const calculateFineSilver = (weight, purity) => {
  if (!weight) return 0;
  if (!purity) return parseFloat(weight);
  return (parseFloat(weight) * parseFloat(purity)) / 100;
};

module.exports = {
  calculateFineGold,
  applyDeduction,
  calculateFineSilver
};
