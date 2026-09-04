/**
 * affordability.js — affordability arithmetic.
 *
 * PURPOSE
 *   Turns raw borrower inputs into the affordability measures the prototype
 *   reasons about. Pure functions only: no state, no side effects, so the
 *   calculations can be quoted and checked in the written dissertation.
 *
 * ILLUSTRATIVE THRESHOLDS — post-loan commitment ratio
 *   Up to 35%                     Generally affordable
 *   Above 35% and up to 50%       Affordability concern
 *   Above 50%                     High affordability concern
 *
 *   These are prototype assumptions adopted for demonstration. They are not
 *   regulatory requirements, not lender policy and not legal lending limits.
 *   DEFAULT_THRESHOLDS is the documented pair; THRESHOLDS is the live pair,
 *   which the examiner sensitivity controls on the Methodology page may vary.
 *   The unit tests always run against DEFAULT_THRESHOLDS.
 *
 * VERSION 1 SCOPE NOTE
 *   This module deliberately does NOT calculate a suggested reduced loan
 *   amount. Naming an amount would require interest-rate, fee and repayment-
 *   schedule assumptions that are outside the scope of version 1, and a figure
 *   on screen could be mistaken for a credit offer. reductionFeasible() only
 *   answers whether a smaller borrowing could fall inside the affordable band.
 */
window.EDL = window.EDL || {};

window.EDL.afford = (function () {
  var DEFAULT_THRESHOLDS = { affordableMax: 35, concernMax: 50 };
  var THRESHOLDS = { affordableMax: 35, concernMax: 50 };

  var BAND_LABELS = {
    affordable: 'Generally affordable',
    concern: 'Affordability concern',
    high: 'High affordability concern'
  };

  function num(v) {
    var n = parseFloat(v);
    return isFinite(n) ? n : 0;
  }

  /** Sets the live thresholds. INPUT: affordableMax, concernMax. OUTPUT: THRESHOLDS. */
  function setThresholds(affordableMax, concernMax) {
    THRESHOLDS.affordableMax = Number(affordableMax);
    THRESHOLDS.concernMax = Math.max(Number(concernMax), Number(affordableMax) + 1);
    return THRESHOLDS;
  }

  /** Restores the documented thresholds. OUTPUT: THRESHOLDS. */
  function resetThresholds() {
    return setThresholds(DEFAULT_THRESHOLDS.affordableMax, DEFAULT_THRESHOLDS.concernMax);
  }

  /** Snapshot of the live thresholds, for save/restore. OUTPUT: plain object. */
  function getThresholds() {
    return { affordableMax: THRESHOLDS.affordableMax, concernMax: THRESHOLDS.concernMax };
  }

  /**
   * bandFor — the single place a ratio is turned into a band.
   * INPUT : post-loan commitment ratio (number) or null
   * OUTPUT: 'affordable' | 'concern' | 'high' | null
   */
  function bandFor(ratio) {
    if (ratio === null || ratio === undefined || !isFinite(ratio)) return null;
    if (ratio <= THRESHOLDS.affordableMax) return 'affordable';
    if (ratio <= THRESHOLDS.concernMax) return 'concern';
    return 'high';
  }

  /**
   * bandTable — the band definitions as display rows, so the interface and the
   * Methodology page can never drift from the numbers the logic uses.
   * OUTPUT: [{ range, label }]
   */
  function bandTable() {
    return [
      { range: 'Up to ' + THRESHOLDS.affordableMax + '%', label: BAND_LABELS.affordable },
      { range: 'Above ' + THRESHOLDS.affordableMax + '% and up to ' + THRESHOLDS.concernMax + '%', label: BAND_LABELS.concern },
      { range: 'Above ' + THRESHOLDS.concernMax + '%', label: BAND_LABELS.high }
    ];
  }

  /**
   * calculateAffordability
   * INPUT  : form object with monthlyIncome, existingDebt, proposedRepayment,
   *          essentialExpenses (numbers or numeric strings)
   * OUTPUT : { income, existingDebt, proposedRepayment, essentialExpenses,
   *            debtToIncome, postLoanCommitment, disposableIncome,
   *            band, bandLabel, valid }
   */
  function calculateAffordability(form) {
    var income = num(form.monthlyIncome);
    var debt = num(form.existingDebt);
    var repay = num(form.proposedRepayment);
    var essentials = num(form.essentialExpenses);

    var valid = income > 0;
    var dti = valid ? (debt / income) * 100 : null;
    var post = valid ? ((debt + repay) / income) * 100 : null;
    var disposable = income - debt - repay - essentials;
    var band = bandFor(post);

    return {
      income: income,
      existingDebt: debt,
      proposedRepayment: repay,
      essentialExpenses: essentials,
      debtToIncome: dti,
      postLoanCommitment: post,
      disposableIncome: disposable,
      band: band,
      bandLabel: band ? BAND_LABELS[band] : '—',
      valid: valid
    };
  }

  /**
   * reductionFeasible
   * PURPOSE: tests whether ANY smaller borrowing could bring the post-loan
   *          commitment ratio back inside the affordable band while leaving
   *          disposable income non-negative. No amount is calculated or
   *          returned as an offer — see the version 1 scope note above.
   * INPUT  : form object, affordability object
   * OUTPUT : { possible, headroom }
   *          headroom = monthly repayment capacity remaining inside the
   *          affordable band. Used only by the rules; never shown as an offer.
   */
  function reductionFeasible(form, a) {
    var repay = num(form.proposedRepayment);
    if (!a.valid || repay <= 0) return { possible: false, headroom: 0 };

    var ratioHeadroom = (a.income * THRESHOLDS.affordableMax / 100) - a.existingDebt;
    var cashHeadroom = a.income - a.existingDebt - a.essentialExpenses;
    var headroom = Math.min(ratioHeadroom, cashHeadroom);

    // A reduction only helps if there is room for a repayment smaller than the
    // one proposed. Where headroom is zero or below, no smaller loan helps.
    return { possible: headroom > 0 && headroom < repay, headroom: headroom };
  }

  return {
    DEFAULT_THRESHOLDS: DEFAULT_THRESHOLDS,
    THRESHOLDS: THRESHOLDS,
    BAND_LABELS: BAND_LABELS,
    setThresholds: setThresholds,
    resetThresholds: resetThresholds,
    getThresholds: getThresholds,
    bandFor: bandFor,
    bandTable: bandTable,
    calculateAffordability: calculateAffordability,
    reductionFeasible: reductionFeasible
  };
})();

/** Display helpers, kept beside the maths they format. */
window.EDL.fmt = {
  /**
   * Money for display only, in the applicant's own currency.
   * Formatting (symbol, grouping, locale) comes from markets.js so every screen
   * writes an amount the same way. No USD equivalent is ever appended.
   * INPUT: value, currency code. OUTPUT: string such as "KSh 12,500".
   */
  money: function (v, currency) {
    if (window.EDL.markets) return window.EDL.markets.money(v, currency);
    var n = parseFloat(v);
    if (!isFinite(n)) return '—';
    return (currency ? currency + ' ' : '') + Math.round(n).toLocaleString('en-GB');
  },
  /** Percentage to one decimal place. OUTPUT: string such as "44.2%". */
  pct: function (v) {
    if (v === null || v === undefined || !isFinite(v)) return '—';
    return (Math.round(v * 10) / 10).toFixed(1) + '%';
  }
};
