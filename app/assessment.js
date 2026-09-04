/**
 * assessment.js — transparent, rule-based ethical assessment.
 *
 * PURPOSE
 *   Combines affordability with income stability, payment history,
 *   conventional credit information and alternative financial information to
 *   produce ONE of four recommendations, together with the reasons and the
 *   rule trace behind it. There is no machine learning here by design: every
 *   step is a stated rule that can be reproduced by hand.
 *
 *   The output is a prototype recommendation for academic demonstration. It is
 *   not a credit decision, an approval, or a regulated affordability check.
 *
 * DESIGN CONSTRAINTS ENCODED BELOW
 *   1. Affordability is evaluated first and can never be overridden by
 *      positive alternative data.
 *   2. Missing conventional credit history never, on its own, produces a
 *      negative outcome.
 *   3. Alternative data can only support inclusion; it cannot remove an
 *      affordability concern.
 */
window.EDL = window.EDL || {};

window.EDL.assess = (function () {
  var OUTCOMES = {
    standard: 'Eligible – Standard Loan',
    reduced: 'Eligible – Reduced Loan Recommended',
    review: 'Further Human Review Required',
    declined: 'Current Loan Amount Not Recommended'
  };

  /**
   * Signal definitions. Each answer maps to one of:
   *   'positive' | 'neutral' | 'negative' | 'unavailable'
   * Note that "Limited" and "Unavailable" conventional history are NEVER
   * negative — they are simply absent information.
   */
  var SIGNAL_MAP = {
    creditHistory: {
      label: 'Traditional credit history',
      values: { 'Strong': 'positive', 'Moderate': 'neutral', 'Limited': 'neutral', 'Unavailable': 'unavailable' },
      kind: 'conventional'
    },
    bankConsistency: {
      label: 'Bank transaction consistency',
      values: { 'Strong': 'positive', 'Moderate': 'neutral', 'Weak': 'negative', 'Unavailable': 'unavailable' },
      kind: 'conventional'
    },
    utilityPayments: {
      label: 'Utility / recurring bill payment history',
      values: { 'Good': 'positive', 'Mixed': 'neutral', 'Poor': 'negative', 'Unavailable': 'unavailable' },
      kind: 'alternative', optional: false
    },
    mobileMoney: {
      label: 'Mobile-money transaction history',
      values: { 'Strong': 'positive', 'Moderate': 'neutral', 'Limited': 'neutral', 'Unavailable': 'unavailable' },
      kind: 'alternative', optional: true
    }
  };

  var REGULARITY_MAP = { 'Stable': 'positive', 'Mostly stable': 'neutral', 'Irregular': 'negative' };

  /**
   * evaluateSignals
   * INPUT  : form object, active signal keys for this market
   * OUTPUT : { entries[], positives[], negatives[], unavailable[],
   *            positiveCount, negativeCount, conventionalAvailable,
   *            alternativePositive }
   */
  function evaluateSignals(form, activeKeys) {
    var entries = [], positives = [], negatives = [], unavailable = [];
    var conventionalAvailable = false, alternativePositive = false;

    activeKeys.forEach(function (key) {
      var def = SIGNAL_MAP[key];
      var answer = form[key] || 'Unavailable';
      var weight = def.values[answer] || 'unavailable';
      entries.push({ key: key, label: def.label, answer: answer, weight: weight, kind: def.kind });

      if (weight === 'unavailable') { unavailable.push(def.label); return; }
      if (def.kind === 'conventional') conventionalAvailable = true;
      if (weight === 'positive') {
        positives.push(def.label + ': ' + answer.toLowerCase());
        if (def.kind === 'alternative') alternativePositive = true;
      }
      if (weight === 'negative') negatives.push(def.label + ': ' + answer.toLowerCase());
    });

    // Income regularity is treated as a stability signal, not a data source.
    var regWeight = REGULARITY_MAP[form.incomeRegularity] || 'neutral';
    if (regWeight === 'positive') positives.push('Income regularity: stable');
    if (regWeight === 'negative') negatives.push('Income is irregular month to month');

    return {
      entries: entries,
      positives: positives,
      negatives: negatives,
      unavailable: unavailable,
      positiveCount: positives.length,
      negativeCount: negatives.length,
      conventionalAvailable: conventionalAvailable,
      alternativePositive: alternativePositive,
      regularityWeight: regWeight
    };
  }

  /**
   * activeSignalKeys — which data sources the form offers.
   *
   * The same four sources are offered in every market. Neither region is
   * treated as homogeneous: conventional and alternative sources may exist in
   * either, so nothing is withheld on the basis of region or country. Mobile-
   * money history is flagged optional in SIGNAL_MAP and is emphasised only
   * where the selected country's context makes it likely to be available;
   * emphasis is presentation only and never reaches the decision rules.
   *
   * INPUT  : region (accepted for call-site clarity, deliberately unused)
   * OUTPUT : array of signal keys, identical for every region and country
   */
  function activeSignalKeys(region) {
    return ['creditHistory', 'bankConsistency', 'utilityPayments', 'mobileMoney'];
  }

  /**
   * assessApplicant — the single decision function.
   * INPUT  : form object, affordability object (from affordability.js)
   * OUTPUT : {
   *   recommendation, tone, affordability, signals, positives, concerns,
   *   sourcesUsed, sourcesUnavailable, trace, explanation, reducedLoan
   * }
   */
  function assessApplicant(form, a) {
    var keys = activeSignalKeys(form.region);
    var s = evaluateSignals(form, keys);
    var trace = [];
    var concerns = s.negatives.slice();
    var reduced = window.EDL.afford.reductionFeasible(form, a);
    var T = window.EDL.afford.THRESHOLDS;

    function rule(id, text, fired, detail) {
      trace.push({ id: id, text: text, fired: !!fired, detail: detail || '' });
    }

    // --- Stage 1: affordability, evaluated before anything else -------------
    rule('A1', 'Post-loan commitment ratio is placed in an illustrative band.', true,
      'Ratio ' + window.EDL.fmt.pct(a.postLoanCommitment) + ' → ' + a.bandLabel + '.');

    var negativeDisposable = a.disposableIncome < 0;
    var thinDisposable = !negativeDisposable && a.income > 0 && a.disposableIncome < a.income * 0.1;

    rule('A2', 'Disposable income after essentials and all debt commitments must be positive.',
      negativeDisposable,
      negativeDisposable
        ? 'Disposable income is negative, so the repayment cannot be met from stated income.'
        : 'Disposable income is positive.');
    if (negativeDisposable) concerns.push('Essential expenses and repayments exceed monthly income');
    if (thinDisposable) {
      concerns.push('Very little disposable income would remain after commitments');
      rule('A3', 'Disposable income below 10% of income is flagged as a thin margin.', true,
        'Remaining margin is under a tenth of monthly income.');
    }

    if (a.band === 'high' || a.band === 'concern') {
      concerns.push('Post-loan commitments would reach ' + window.EDL.fmt.pct(a.postLoanCommitment) + ' of income');
    }

    // --- Stage 2: inclusion rules on the information available --------------
    rule('I1', 'Missing conventional credit history does not by itself cause a negative outcome.',
      !s.conventionalAvailable,
      !s.conventionalAvailable
        ? 'No conventional source was available; the assessment continued on alternative information.'
        : 'Conventional information was available.');

    rule('I2', 'Positive alternative financial information can support inclusion where conventional data is thin.',
      s.alternativePositive && !s.conventionalAvailable,
      s.alternativePositive && !s.conventionalAvailable
        ? 'No conventional source was available, so positive alternative information carried the inclusion case.'
        : s.alternativePositive
          ? 'Positive alternative information was recorded, but conventional information was also available, so this inclusion rule was not needed.'
          : 'No positive alternative information was recorded.');

    rule('I3', 'Alternative financial information can never override an affordability concern.',
      s.alternativePositive && a.band !== 'affordable',
      s.alternativePositive && a.band !== 'affordable'
        ? 'Alternative data was present but the affordability band still governs the outcome.'
        : 'Not engaged for this applicant.');

    // --- Stage 3: outcome ---------------------------------------------------
    var outcome, tone;

    if (!a.valid) {
      outcome = OUTCOMES.review; tone = 'review';
      rule('D0', 'Incomplete income information routes to human review.', true, 'Monthly income was not usable.');
    } else if (a.band === 'high' || negativeDisposable) {
      outcome = OUTCOMES.declined; tone = 'declined';
      rule('D1', 'Above ' + T.concernMax + '% post-loan commitment, or with negative disposable income, the loan is not recommended.',
        true, 'Affordability governs this outcome regardless of any positive indicators.');
    } else if (a.band === 'concern') {
      if (reduced.possible && s.negativeCount === 0) {
        outcome = OUTCOMES.reduced; tone = 'reduced';
        rule('D2', 'Above ' + T.affordableMax + '% and up to ' + T.concernMax + '% commitment, with no negative indicators, a lower loan amount is recommended.',
          true, 'A smaller amount could bring commitments back inside the ' + T.affordableMax + '% band. No figure is quoted in version 1.');
      } else {
        outcome = OUTCOMES.review; tone = 'review';
        rule('D3', 'A concern-band ratio combined with negative indicators, or with no smaller affordable borrowing, requires human review.',
          true, s.negativeCount > 0 ? 'Negative indicators are present alongside the affordability concern.' : 'No smaller borrowing would fall inside the affordable band.');
      }
    } else if (s.negativeCount >= 2) {
      outcome = OUTCOMES.review; tone = 'review';
      rule('D4', 'Two or more negative indicators require human review even when the loan appears affordable.', true,
        s.negativeCount + ' negative indicators were recorded.');
    } else if (s.positiveCount >= 2) {
      outcome = OUTCOMES.standard; tone = 'standard';
      rule('D5', 'An affordable ratio with two or more positive indicators supports a standard loan.', true,
        s.positiveCount + ' positive indicators were recorded.');
    } else if (s.positiveCount === 1 && s.negativeCount === 0) {
      outcome = thinDisposable ? OUTCOMES.reduced : OUTCOMES.standard;
      tone = thinDisposable ? 'reduced' : 'standard';
      rule('D6', 'An affordable ratio with one positive and no negative indicators supports a loan; a thin cash margin reduces it.',
        true, thinDisposable ? 'The thin disposable margin reduced the recommended amount.' : 'No thin-margin flag was raised.');
    } else {
      outcome = OUTCOMES.review; tone = 'review';
      rule('D7', 'Where no positive indicator of any kind is available, the file is passed to human review rather than declined.',
        true, 'Too little information to support a recommendation either way.');
    }

    return {
      recommendation: outcome,
      tone: tone,
      affordability: a,
      signals: s.entries,
      positives: s.positives,
      concerns: concerns,
      sourcesUsed: s.entries.filter(function (e) { return e.weight !== 'unavailable'; }),
      sourcesUnavailable: s.entries.filter(function (e) { return e.weight === 'unavailable'; }),
      trace: trace,
      reducedLoan: reduced,
      explanation: buildExplanation(form, a, outcome, s, reduced)
    };
  }

  /**
   * buildExplanation — plain-language reasons for the recommendation.
   *
   * Where affordability is seriously in question (high-concern band or negative
   * disposable income) the affordability position is stated FIRST, followed by
   * an explicit statement that positive indicators cannot override it. In all
   * other cases the positive indicators lead.
   *
   * INPUT  : form, affordability, outcome string, signal summary, reduced loan
   * OUTPUT : array of sentences (rendered as the "Why did I receive this
   *          recommendation?" section)
   */
  function buildExplanation(form, a, outcome, s, reduced) {
    var out = [];
    var pct = window.EDL.fmt.pct(a.postLoanCommitment);
    var cur = form.currency || '';
    var T = window.EDL.afford.THRESHOLDS;
    var negativeDisposable = a.disposableIncome < 0;
    var serious = a.band === 'high' || negativeDisposable;

    var positivesSentence = s.positiveCount > 0
      ? 'Your ' + humanList(s.positives.map(lowerFirst)) + ' provide positive indicators in this assessment.'
      : 'No positive financial indicator was available for this application, which limits what the assessment can conclude.';

    var inclusionSentence = (!s.conventionalAvailable && s.alternativePositive)
      ? 'Conventional credit information was not available, so the assessment relied on your alternative financial records. A thin credit file did not count against you.'
      : '';

    var disposableSentence = negativeDisposable
      ? 'Disposable income is negative: after essential expenses and existing repayments, your stated income would not cover the proposed repayment, leaving a shortfall of about ' +
        window.EDL.fmt.money(Math.abs(a.disposableIncome), cur) + ' per month.'
      : 'You would be left with about ' + window.EDL.fmt.money(a.disposableIncome, cur) +
        ' per month after essential expenses and all debt repayments, so disposable income is positive.';

    if (serious) {
      // 1. Affordability first, stated explicitly.
      if (a.band === 'high') {
        out.push('Affordability is the deciding factor here. The proposed repayment would take your total monthly credit commitments to ' + pct +
          ' of income, above the illustrative ' + T.concernMax + '% high-affordability-concern level.');
      } else {
        out.push('Affordability is the deciding factor here. Your total monthly credit commitments would reach ' + pct +
          ' of income, and the repayment could not be met from your stated income once essential expenses are taken into account.');
      }
      out.push(disposableSentence);

      // 2. Why positive indicators do not change the outcome.
      out.push(s.positiveCount > 0
        ? 'Positive indicators such as stable income, good payment behaviour or strong alternative financial data cannot override an affordability concern of this kind. They can support inclusion where a loan is affordable, but they cannot make an unaffordable repayment affordable, so they do not change this outcome.'
        : 'Positive indicators, had they been available, could not have changed this outcome. Affordability is assessed first, and no payment history or alternative financial data is allowed to override a serious affordability concern.');

      // 3. The indicators themselves, recorded for transparency.
      out.push(positivesSentence);
      if (inclusionSentence) out.push(inclusionSentence);
    } else {
      out.push(positivesSentence);
      if (inclusionSentence) out.push(inclusionSentence);

      if (a.band === 'affordable') {
        out.push('The proposed repayment would take your total monthly credit commitments to ' + pct + ' of income, inside the illustrative affordable range of up to ' + T.affordableMax + '%.');
      } else if (a.band === 'concern') {
        out.push('However, the proposed repayment would increase your monthly financial commitments to ' + pct + ' of income, above the illustrative ' + T.affordableMax + '% affordable level and within the ' + T.affordableMax + '% to ' + T.concernMax + '% affordability-concern range.');
      }
      out.push(disposableSentence);
    }

    if (outcome === OUTCOMES.reduced) {
      out.push('A lower loan amount, or a longer term that reduces the monthly repayment, would bring your commitments back inside the illustrative affordable range. A reduced amount or a further affordability review is therefore recommended. The prototype does not quote an amount, because that is a decision for affordability review rather than for a demonstration rule.');
    }
    if (outcome === OUTCOMES.review) {
      out.push('The rules alone cannot fairly settle this application, so it is routed to a human reviewer rather than being refused automatically.');
    }
    if (outcome === OUTCOMES.declined) {
      out.push('This outcome concerns the amount requested, not the applicant. It is an affordability outcome rather than a refusal of credit: a smaller amount, a longer term, or a review of existing commitments would change the result.');
    }
    return out;
  }

  function lowerFirst(str) { return str.charAt(0).toLowerCase() + str.slice(1); }

  function humanList(items) {
    if (items.length === 1) return items[0];
    return items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
  }

  return {
    OUTCOMES: OUTCOMES,
    SIGNAL_MAP: SIGNAL_MAP,
    REGULARITY_MAP: REGULARITY_MAP,
    activeSignalKeys: activeSignalKeys,
    evaluateSignals: evaluateSignals,
    assessApplicant: assessApplicant
  };
})();
