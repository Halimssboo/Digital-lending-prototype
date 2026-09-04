/**
 * pricing.js — illustrative loan pricing and repayment calculations.
 *
 * PURPOSE
 *   Turns a principal, an annual interest rate and a term into the repayment
 *   figures the prototype shows before any recommendation is made: monthly
 *   repayment, total amount repayable and total interest cost. Replaces the
 *   earlier design in which the applicant typed an estimated repayment.
 *
 * RATE BASIS
 *   A quoted rate may be annual, monthly, daily or a flat charge on the amount
 *   borrowed. toMonthlyRate() converts each basis to the monthly rate the
 *   amortisation formula needs, so a monthly or daily rate is never treated as
 *   though it were annual:
 *     annual  → rate / 12 / 100
 *     monthly → rate / 100
 *     daily   → (1 + rate/100)^(365/12) − 1   (compounded to a month)
 *     flat    → priced separately: the whole charge is added to the principal
 *               and repaid in equal instalments
 *
 * METHOD — standard amortising loan
 *   monthlyRate    r = rate converted to a monthly decimal
 *   monthlyPayment = P × r × (1+r)^n / ((1+r)^n − 1)
 *   where P = principal and n = number of monthly repayments.
 *   A zero (or effectively zero) rate is handled separately as P / n, so the
 *   formula never divides by zero.
 *
 * IMPORTANT
 *   Every rate and figure produced here is ILLUSTRATIVE PROTOTYPE PRICING for
 *   academic demonstration. It is not a live lending rate, not a quotation and
 *   not a market offer. No fees, insurance, taxes or early-settlement terms are
 *   modelled.
 */
window.EDL = window.EDL || {};

window.EDL.pricing = (function () {
  var PRICING_LABEL = 'Illustrative pricing – not a live lending rate';

  function num(v) {
    var n = parseFloat(v);
    return isFinite(n) ? n : 0;
  }

  var DAYS_PER_MONTH = 365 / 12;

  /** normBasis — INPUT: any basis string. OUTPUT: a supported basis. */
  function normBasis(basis) {
    var b = (basis || 'annual').toLowerCase();
    return (b === 'monthly' || b === 'daily' || b === 'flat') ? b : 'annual';
  }

  /**
   * toMonthlyRate — converts a quoted rate to the monthly decimal rate the
   * amortisation formula uses.
   * INPUT : rate percentage, basis ('annual' | 'monthly' | 'daily' | 'flat')
   * OUTPUT: monthly rate as a decimal. 'flat' returns 0 because a flat charge
   *         is not compounded; it is added to the principal instead.
   */
  function toMonthlyRate(ratePercent, basis) {
    var r = num(ratePercent);
    switch (normBasis(basis)) {
      case 'monthly': return r / 100;
      case 'daily': return Math.pow(1 + r / 100, DAYS_PER_MONTH) - 1;
      case 'flat': return 0;
      default: return r / 12 / 100;
    }
  }

  /**
   * monthlyRate — kept for callers that quote annually.
   * INPUT : annual nominal rate as a percentage (e.g. 18 for 18%)
   * OUTPUT: monthly rate as a decimal (e.g. 0.015)
   */
  function monthlyRate(annualRatePercent) {
    return num(annualRatePercent) / 12 / 100;
  }

  /**
   * monthlyRepayment — the amortising repayment for a level-payment loan.
   * INPUT : principal, annual rate percentage, term in whole months
   * OUTPUT: monthly repayment (number, unrounded), or 0 where the inputs are
   *         not usable (non-positive principal or term)
   */
  function monthlyRepayment(principal, ratePercent, termMonths, basis) {
    var P = num(principal);
    var n = Math.round(num(termMonths));
    if (P <= 0 || n <= 0) return 0;

    // A flat charge is not compounded: the whole charge is spread evenly.
    if (normBasis(basis) === 'flat') return (P + P * num(ratePercent) / 100) / n;

    var r = toMonthlyRate(ratePercent, basis);
    // Zero or negligible interest: straight-line repayment, no division by zero.
    if (!isFinite(r) || Math.abs(r) < 1e-9) return P / n;

    var growth = Math.pow(1 + r, n);
    return P * r * growth / (growth - 1);
  }

  /**
   * loanSummary — every figure the transparent-pricing panel needs.
   * INPUT : principal, annual rate percentage, term in whole months
   * OUTPUT: {
   *   principal, annualRate, termMonths, monthlyRate,
   *   monthlyRepayment, totalRepayment, totalInterest, valid, label
   * }
   *   valid is false when the inputs cannot produce a repayment, so callers can
   *   show a placeholder rather than a misleading zero.
   */
  function loanSummary(principal, ratePercent, termMonths, basis) {
    var P = num(principal);
    var n = Math.round(num(termMonths));
    var rate = num(ratePercent);
    var b = normBasis(basis);
    var payment = monthlyRepayment(P, rate, n, b);
    var valid = P > 0 && n > 0 && payment > 0;
    var total = valid ? payment * n : 0;
    var mRate = toMonthlyRate(rate, b);

    return {
      principal: P,
      rate: rate,
      rateBasis: b,
      rateLabel: window.EDL.markets ? window.EDL.markets.rateLabel(rate, b) : rate + '%',
      // Nominal annual equivalent of the quoted rate, for reference only.
      annualRate: b === 'annual' ? rate : Math.round(mRate * 12 * 1000) / 10,
      termMonths: n,
      monthlyRate: mRate,
      monthlyRepayment: payment,
      totalRepayment: total,
      totalInterest: valid ? total - P : 0,
      valid: valid,
      label: PRICING_LABEL
    };
  }

  /**
   * withPricing — returns a copy of a borrower form with proposedRepayment
   * derived from the requested amount, rate and term.
   *
   * This is the single bridge between pricing and affordability: the
   * affordability and assessment modules continue to read proposedRepayment
   * and are unchanged, but the applicant no longer types it.
   *
   * INPUT : form object with loanAmount, interestRate, loanTermMonths
   * OUTPUT: new form object with proposedRepayment set (rounded to the nearest
   *         currency unit for display consistency), plus a pricing summary
   */
  function withPricing(form) {
    var summary = loanSummary(form.loanAmount, form.interestRate, form.loanTermMonths, form.rateBasis);
    var priced = Object.assign({}, form, {
      proposedRepayment: summary.valid ? Math.round(summary.monthlyRepayment) : 0
    });
    priced.pricing = summary;
    return priced;
  }

  return {
    PRICING_LABEL: PRICING_LABEL,
    toMonthlyRate: toMonthlyRate,
    normBasis: normBasis,
    monthlyRate: monthlyRate,
    monthlyRepayment: monthlyRepayment,
    loanSummary: loanSummary,
    withPricing: withPricing
  };
})();
