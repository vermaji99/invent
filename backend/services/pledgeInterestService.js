function daysBetween(a, b) {
  const ms = Math.max(0, b.getTime() - a.getTime());
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

function monthsBetween(a, b) {
  let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  const aDay = a.getDate();
  const bDay = b.getDate();
  if (bDay > aDay) months += (bDay - aDay) / 30;
  return Math.max(0, months);
}

function computeInterestSnapshot(loan) {
  const start = new Date(loan.startDate);
  const end = new Date(loan.endDate);
  const now = new Date();
  const effectiveEnd = now < end ? now : end;
  const overdueDays = now > end ? daysBetween(end, now) : 0;

  let basePeriods = 0;
  if (loan.interestPeriod === 'day') {
    basePeriods = daysBetween(start, effectiveEnd);
  } else {
    basePeriods = monthsBetween(start, effectiveEnd);
  }

  let baseInterest = 0;
  if (loan.interestUnit === 'amount') {
    baseInterest = basePeriods * Number(loan.interestRate || 0);
  } else {
    const principal = Number(loan.amountGiven || 0);
    const rate = Number(loan.interestRate || 0);
    if (loan.interestPeriod === 'day') {
      baseInterest = principal * (rate / 100) * basePeriods;
    } else {
      baseInterest = principal * (rate / 100) * basePeriods;
    }
  }

  const lateExtra = Number(loan.lateExtraPerDay || 0) * overdueDays;
  const totalInterest = Math.max(0, Math.round(baseInterest + lateExtra));
  const totalPayable = Math.round(Number(loan.amountGiven || 0) + totalInterest);

  return {
    totalInterest,
    totalPayable,
    overdueDays,
    remainingDays: now < end ? daysBetween(now, end) : 0
  };
}

module.exports = { computeInterestSnapshot };

