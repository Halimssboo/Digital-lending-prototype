/**
 * business.js — SME funding products, business cash-flow arithmetic and the
 * business lending rules.
 *
 * PURPOSE
 *   The business side of the prototype. It reuses the shared pricing engine
 *   (app/pricing.js) for repayment maths and the shared verification module
 *   (app/kyc.js) for simulated checks, and adds what is specific to a business:
 *   cash-flow capacity rather than personal affordability, three funding
 *   products with their own conditional questions, and business-specific
 *   data sources.
 *
 * ILLUSTRATIVE PROTOTYPE ASSUMPTIONS — repayment capacity thresholds
 *   These bands are demonstration parameters chosen for this prototype. They
 *   are NOT regulatory limits, NOT industry lending thresholds and NOT any
 *   lender's policy. They exist so the rules have something to test against,
 *   and they are deliberately not shown prominently to a borrower.
 *
 *   Repayment capacity ratio
 *     = (existing monthly business repayments + proposed monthly repayment)
 *       ÷ operating cash surplus × 100
 *
 *     Up to 50%                   Comfortable capacity
 *     Above 50% and up to 75%     Capacity concern
 *     Above 75%                   Severe capacity concern
 *
 * DESIGN CONSTRAINTS ENCODED BELOW
 *   1. Repayment capacity is evaluated before any positive indicator.
 *   2. Strong mobile-money, merchant or invoice data can support inclusion but
 *      can never override negative remaining cash or a severe capacity concern.
 *   3. Missing conventional banking information is absent information, never a
 *      negative.
 *   4. Business type changes which questions apply; it never changes the rules.
 */
window.EDL = window.EDL || {};

window.EDL.business = (function () {
  var PRICING_NOTE = 'Illustrative pricing';

  var OUTCOMES = {
    suitable: 'Funding request appears suitable under the assessment rules',
    reduced: 'Lower funding amount recommended',
    review: 'Further business review required',
    declined: 'Current funding request not recommended'
  };

  var CAPACITY_FORMULA = '(existing monthly business repayments + proposed monthly repayment) ÷ operating cash surplus × 100';

  /**
   * THRESHOLDS — illustrative prototype assumptions, not regulatory or
   * industry lending thresholds. See the header note.
   */
  var THRESHOLDS = { suitableMax: 50, concernMax: 75 };

  var BAND_LABELS = {
    comfortable: 'Comfortable capacity',
    concern: 'Capacity concern',
    severe: 'Severe capacity concern'
  };

  var BUSINESS_TYPES = [
    'Registered business',
    'Sole trader',
    'Informal micro or small business',
    'Self-employed business operator'
  ];

  var SECTORS = [
    'Retail and trade', 'Agriculture and agri-processing', 'Manufacturing',
    'Transport and logistics', 'Construction', 'Hospitality and food',
    'Professional services', 'Technology', 'Health and education', 'Other'
  ];

  var TRADING_HISTORY = ['Under 6 months', '6–12 months', '1–3 years', 'Over 3 years'];

  var CASHFLOW_CONSISTENCY = ['Consistent', 'Seasonal', 'Volatile'];

  // ------------------------------------------------------------- products

  /**
   * CURRENCY_SCALE — indicative scale factors used to express the illustrative
   * funding ranges in the applicant's own currency.
   *
   * These are ROUNDED ORDER-OF-MAGNITUDE FACTORS adopted so the prototype's
   * ranges read sensibly in each market. They are not live exchange rates and
   * must not be read as such. Any currency not listed falls back to DEFAULT.
   */
  var CURRENCY_SCALE_DEFAULT = 100;
  var CURRENCY_SCALE = {
    KES: 130, NGN: 1500, ZAR: 18, GHS: 15, UGX: 3800, TZS: 2600,
    XOF: 600, XAF: 600, EGP: 50, MAD: 10, ETB: 120, RWF: 1300,
    ZMW: 27, MWK: 1700, MZN: 64, BWP: 14, NAD: 18, LSL: 18, SZL: 18,
    MUR: 46, TND: 3, DZD: 135, AOA: 900, SLE: 23, SOS: 570, CDF: 2800,
    GNF: 8600, MGA: 4500, LRD: 190, GMD: 70, BIF: 2900, DJF: 178,
    KMF: 450, CVE: 100, ERN: 15, LYD: 5, MRU: 40, SCR: 14, SDG: 600,
    SSP: 1300, STN: 22, ZWG: 26
  };

  /** currencyScale — INPUT: currency code. OUTPUT: scale factor. */
  function currencyScale(currency) {
    return CURRENCY_SCALE[currency] || CURRENCY_SCALE_DEFAULT;
  }

  /** roundNice — rounds a scaled figure to a readable round number. */
  function roundNice(value) {
    if (!isFinite(value) || value <= 0) return 0;
    var magnitude = Math.pow(10, Math.floor(Math.log(value) / Math.LN10) - 1);
    return Math.round(value / magnitude) * magnitude;
  }

  /**
   * PRODUCTS — the three funding shapes. Every figure is synthetic and exists
   * only to make the prototype concrete.
   *   baseMin/baseMax : illustrative funding range in base units, scaled into
   *                     the applicant's currency by currencyScale()
   *   termMin/termMax, rateMin/rateMax : the ranges the funding step validates
   *   fields          : conditional questions this product adds to step 3
   */
  var PRODUCTS = [
    {
      id: 'working-capital',
      name: 'Working Capital',
      summary: 'Short-term funding for stock, payroll, suppliers and operating expenses.',
      uses: ['Stock and inventory', 'Payroll', 'Supplier payments', 'Operating expenses'],
      baseMin: 100, baseMax: 5000,
      range: 'Set by the selected market configuration',
      term: '3 – 24 months',
      rate: 'Set by the selected market configuration',
      termMin: 3, termMax: 24, rateMin: 8, rateMax: 12,
      security: 'Usually unsecured',
      structure: 'Equal monthly repayments of principal and interest',
      defaultRate: '10',
      defaultTerm: '12',
      fields: [
        { key: 'wcPurpose', label: 'Main funding purpose', type: 'select',
          options: ['Stock and inventory', 'Payroll', 'Supplier payments', 'Operating expenses'],
          hint: 'What the funding is mostly for.' },
        { key: 'wcCommitments', label: 'Supplier or payroll commitments (monthly)', type: 'money',
          hint: 'Recurring commitments this funding would cover. Enter 0 if none.' }
      ]
    },
    {
      id: 'asset-finance',
      name: 'Asset Finance',
      summary: 'Funding against equipment, machinery, vehicles and technology.',
      uses: ['Equipment', 'Machinery', 'Vehicles', 'Technology'],
      baseMin: 500, baseMax: 25000,
      range: 'Set by the selected market configuration',
      term: '12 – 60 months',
      rate: 'Set by the selected market configuration',
      termMin: 12, termMax: 60, rateMin: 8, rateMax: 12,
      security: 'Secured on the financed asset',
      structure: 'Equal monthly repayments over the asset’s useful life',
      defaultRate: '10',
      defaultTerm: '36',
      fields: [
        { key: 'afAssetValue', label: 'Asset value', type: 'money',
          hint: 'Total price of the asset.' },
        { key: 'afFinanced', label: 'Amount being financed', type: 'money',
          hint: 'The part you want funded. The rest is your contribution.' },
        { key: 'afSecurity', label: 'Security status', type: 'select',
          options: ['Asset offered as security', 'Additional security available', 'No security offered'],
          hint: 'Asset finance is normally secured on the asset itself.' }
      ]
    },
    {
      id: 'invoice-finance',
      name: 'Invoice Finance',
      summary: 'Funding released against unpaid customer invoices.',
      uses: ['Unpaid customer invoices', 'Bridging long payment terms'],
      baseMin: 200, baseMax: 10000,
      range: 'Set by the selected market configuration',
      term: '1 – 6 months',
      rate: 'Set by the selected market configuration',
      termMin: 1, termMax: 6, rateMin: 8, rateMax: 12,
      security: 'Secured on the invoice',
      structure: 'Repaid when the customer settles the invoice',
      defaultRate: '10',
      defaultTerm: '3',
      fields: [
        { key: 'ifInvoiceValue', label: 'Invoice value', type: 'money',
          hint: 'Face value of the unpaid invoice.' },
        { key: 'ifPaymentPeriod', label: 'Expected payment period (days)', type: 'money',
          hint: 'How long the customer usually takes to pay.' },
        { key: 'ifCustomerHistory', label: 'Customer payment history', type: 'select',
          options: ['Pays on time', 'Occasional delays', 'Frequently late', 'No history'],
          hint: 'How reliably this customer has paid before.' }
      ]
    }
  ];

  /** productById — OUTPUT: product object or null. */
  function productById(id) {
    for (var i = 0; i < PRODUCTS.length; i++) if (PRODUCTS[i].id === id) return PRODUCTS[i];
    return null;
  }

  /** productFields — conditional step 3 fields. OUTPUT: array (empty if none). */
  function productFields(id) {
    var p = productById(id);
    return p ? p.fields : [];
  }

  /** ALL_PRODUCT_FIELD_KEYS — every conditional key across all products. */
  var ALL_PRODUCT_FIELD_KEYS = PRODUCTS.reduce(function (acc, p) {
    return acc.concat(p.fields.map(function (f) { return f.key; }));
  }, []);

  /**
   * productRange — the selected product's illustrative limits for the selected
   * market, read from the country/currency configuration in markets.js so the
   * funding step and the business information view can never disagree.
   * INPUT : product id, currency code, country name
   * OUTPUT: { amountMin, amountMax, termMin, termMax, rateMin, rateMax,
   *           currency, amountLabel, termLabel, rateLabel } or null
   */
  function productRange(id, currency, country) {
    var p = productById(id);
    if (!p) return null;
    var m = window.EDL.markets.product('business', id, country || '', currency);
    if (!m) return null;
    return {
      amountMin: m.amountMin, amountMax: m.amountMax,
      termMin: m.termMin, termMax: m.termMax,
      rateMin: m.rateMin, rateMax: m.rateMax,
      rateBasis: m.rateBasis,
      defaultRate: m.defaultRate, defaultTerm: m.defaultTerm,
      currency: currency || '',
      calibrated: m.calibrated,
      note: m.note || '',
      amountLabel: m.amountLabel,
      termLabel: m.termLabel,
      rateLabel: m.rateLabel
    };
  }

  /**
   * validateFundingRequest — checks the funding request against the selected
   * product's illustrative range. Returns concise borrower-facing messages, so
   * an out-of-range request is refused rather than priced and assessed.
   * INPUT : form object
   * OUTPUT: array of message strings (empty when the request is in range)
   */
  function validateFundingRequest(form) {
    var errors = [];
    var p = productById(form.product);
    if (!p) return ['Choose a funding product.'];
    var r = productRange(p.id, form.currency, form.country);
    var amount = parseFloat(form.fundingAmount);
    var term = parseFloat(form.termMonths);
    var rate = parseFloat(form.interestRate);

    if (!isFinite(amount) || amount <= 0) {
      errors.push('Enter a funding amount greater than zero.');
    } else if (amount < r.amountMin || amount > r.amountMax) {
      errors.push(p.name + ' is offered from ' + r.amountLabel + '. Adjust the amount to continue.');
    }

    if (!isFinite(term) || term <= 0) {
      errors.push('Enter a term in whole months.');
    } else if (term < r.termMin || term > r.termMax) {
      errors.push(p.name + ' terms run ' + r.termLabel + '. Adjust the term to continue.');
    }

    if (!isFinite(rate) || rate < 0) {
      errors.push('Enter an interest rate' + window.EDL.markets.basisSuffix(r.rateBasis) + '.');
    } else if (rate < r.rateMin || rate > r.rateMax) {
      errors.push(p.name + ' is priced at ' + r.rateLabel + '. Adjust the rate to continue.');
    }
    return errors;
  }

  /**
   * selectProduct — switching product rewrites the parts of the request that
   * belong to the old product: its conditional answers are cleared, and term
   * and rate move to the new product's illustrative defaults so the request
   * can never carry a term or rate the new product does not offer.
   * INPUT : form object, new product id
   * OUTPUT: new form object
   */
  function selectProduct(form, productId) {
    var p = productById(productId);
    var out = Object.assign({}, form);
    ALL_PRODUCT_FIELD_KEYS.forEach(function (key) { out[key] = ''; });
    out.product = productId;
    var r = productRange(productId, form.currency, form.country);
    if (r) { out.termMonths = String(r.defaultTerm); out.interestRate = String(r.defaultRate); }
    else if (p) { out.termMonths = p.defaultTerm; out.interestRate = p.defaultRate; }
    return out;
  }

  // ------------------------------------------------------- cash-flow maths

  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : 0; }

  /**
   * bandFor — repayment capacity ratio to a band.
   * INPUT : ratio (number) or null
   * OUTPUT: 'comfortable' | 'concern' | 'severe' | null
   */
  function bandFor(ratio) {
    if (ratio === null || ratio === undefined || !isFinite(ratio)) return null;
    if (ratio <= THRESHOLDS.suitableMax) return 'comfortable';
    if (ratio <= THRESHOLDS.concernMax) return 'concern';
    return 'severe';
  }

  /** bandTable — display rows for the bands. OUTPUT: [{ range, label }]. */
  function bandTable() {
    return [
      { range: 'Up to ' + THRESHOLDS.suitableMax + '%', label: BAND_LABELS.comfortable },
      { range: 'Above ' + THRESHOLDS.suitableMax + '% and up to ' + THRESHOLDS.concernMax + '%', label: BAND_LABELS.concern },
      { range: 'Above ' + THRESHOLDS.concernMax + '%', label: BAND_LABELS.severe }
    ];
  }

  /**
   * calculateCashFlow — the business equivalent of personal affordability.
   * INPUT  : form with monthlyRevenue, operatingExpenses, existingDebt,
   *          proposedRepayment (numbers or numeric strings)
   * OUTPUT : { revenue, operatingExpenses, existingDebt, proposedRepayment,
   *            operatingSurplus, availableCashFlow, debtBurden,
   *            repaymentCapacity, remainingCash, band, bandLabel, valid }
   *   operatingSurplus  revenue less operating expenses
   *   availableCashFlow surplus less existing debt repayments
   *   debtBurden        existing repayments as a share of revenue
   *   repaymentCapacity all repayments as a share of the operating surplus
   *   remainingCash     what is left after expenses, existing debt and the
   *                     new repayment
   */
  function calculateCashFlow(form) {
    var revenue = num(form.monthlyRevenue);
    var opex = num(form.operatingExpenses);
    var debt = num(form.existingBusinessDebt);
    var repay = num(form.proposedRepayment);

    var valid = revenue > 0;
    var surplus = revenue - opex;
    var available = surplus - debt;
    var burden = valid ? (debt / revenue) * 100 : null;
    // A surplus of zero or less means there is no cash flow to lend against:
    // the ratio is undefined rather than infinite, and the band is severe.
    var capacity = surplus > 0 ? ((debt + repay) / surplus) * 100 : null;
    var remaining = revenue - opex - debt - repay;
    var band = surplus > 0 ? bandFor(capacity) : (valid ? 'severe' : null);

    return {
      revenue: revenue, operatingExpenses: opex, existingDebt: debt,
      proposedRepayment: repay,
      operatingSurplus: surplus,
      availableCashFlow: available,
      debtBurden: burden,
      repaymentCapacity: capacity,
      remainingCash: remaining,
      band: band,
      bandLabel: band ? BAND_LABELS[band] : '—',
      valid: valid
    };
  }

  /**
   * withPricing — attaches an illustrative repayment to a business form, so no
   * repayment is ever typed by the applicant. Delegates to app/pricing.js.
   * OUTPUT: shallow copy with { pricing, proposedRepayment }.
   */
  function withPricing(form) {
    var r = productRange(form.product, form.currency, form.country);
    var s = window.EDL.pricing.loanSummary(
      form.fundingAmount, form.interestRate, form.termMonths, r ? r.rateBasis : 'annual');
    var out = Object.assign({}, form);
    out.pricing = s;
    out.proposedRepayment = s.valid ? s.monthlyRepayment : 0;
    return out;
  }

  /**
   * reductionFeasible — whether ANY smaller facility would fall inside the
   * comfortable band while leaving remaining cash positive. No amount is
   * quoted: naming one would imply an offer.
   * OUTPUT: { possible, headroom }
   */
  function reductionFeasible(form, c) {
    var repay = num(form.proposedRepayment);
    if (!c.valid || repay <= 0 || c.operatingSurplus <= 0) return { possible: false, headroom: 0 };
    var ratioHeadroom = (c.operatingSurplus * THRESHOLDS.suitableMax / 100) - c.existingDebt;
    var cashHeadroom = c.availableCashFlow;
    var headroom = Math.min(ratioHeadroom, cashHeadroom);
    return { possible: headroom > 0 && headroom < repay, headroom: headroom };
  }

  // ---------------------------------------------------------- data sources

  /**
   * SIGNAL_MAP — business data sources. As on the personal side, 'Limited' and
   * 'Unavailable' are never negative: they are absent information.
   */
  var SIGNAL_MAP = {
    bankConsistency: {
      label: 'Bank transaction consistency',
      values: { 'Strong': 'positive', 'Moderate': 'neutral', 'Weak': 'negative', 'Unavailable': 'unavailable' },
      kind: 'conventional',
      help: 'How steady the money moving through your business account looks.'
    },
    mobileMoney: {
      label: 'Mobile-money transaction history',
      values: { 'Strong': 'positive', 'Moderate': 'neutral', 'Limited': 'neutral', 'Unavailable': 'unavailable' },
      kind: 'alternative',
      help: 'Wallet activity used for trading.'
    },
    merchantHistory: {
      label: 'Merchant or payment-terminal history',
      values: { 'Strong': 'positive', 'Moderate': 'neutral', 'Limited': 'neutral', 'Unavailable': 'unavailable' },
      kind: 'alternative',
      help: 'Card, QR or point-of-sale takings.'
    },
    utilityPayments: {
      label: 'Utility and recurring bill payments',
      values: { 'Good': 'positive', 'Mixed': 'neutral', 'Poor': 'negative', 'Unavailable': 'unavailable' },
      kind: 'alternative',
      help: 'Premises bills, rent and recurring services.'
    },
    invoicePayments: {
      label: 'Invoice payment history',
      values: { 'Strong': 'positive', 'Moderate': 'neutral', 'Weak': 'negative', 'Unavailable': 'unavailable' },
      kind: 'alternative',
      help: 'How reliably your customers have settled invoices.'
    }
  };

  var CONSISTENCY_MAP = { 'Consistent': 'positive', 'Seasonal': 'neutral', 'Volatile': 'negative' };

  /**
   * activeSignalKeys — which sources this application offers.
   * Invoice payment history is asked only where it is meaningful: an invoice
   * finance request, or a business that says it invoices customers. Country is
   * deliberately not a factor.
   * INPUT : product id
   * OUTPUT: array of signal keys
   */
  function activeSignalKeys(productId) {
    var keys = ['bankConsistency', 'mobileMoney', 'merchantHistory', 'utilityPayments'];
    if (productId === 'invoice-finance') keys.push('invoicePayments');
    return keys;
  }

  /** evaluateSignals — mirrors the personal module. OUTPUT: summary object. */
  function evaluateSignals(form, keys) {
    var entries = [], positives = [], negatives = [], unavailable = [];
    var conventionalAvailable = false, alternativePositive = false;

    keys.forEach(function (key) {
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

    var consistency = CONSISTENCY_MAP[form.cashFlowConsistency] || 'neutral';
    if (consistency === 'positive') positives.push('Cash flow is consistent month to month');
    if (consistency === 'negative') negatives.push('Cash flow is volatile month to month');

    return {
      entries: entries, positives: positives, negatives: negatives,
      unavailable: unavailable,
      positiveCount: positives.length, negativeCount: negatives.length,
      conventionalAvailable: conventionalAvailable,
      alternativePositive: alternativePositive,
      consistencyWeight: consistency
    };
  }

  // ------------------------------------------------------------- decision

  /**
   * assessBusiness — the single business decision function.
   * INPUT  : form object, cash-flow object (from calculateCashFlow)
   * OUTPUT : { recommendation, tone, cashFlow, signals, positives, concerns,
   *            sourcesUsed, sourcesUnavailable, trace, explanation, reduction }
   *
   * Capacity is settled before any indicator is read, so no amount of positive
   * alternative data can turn a negative remaining-cash position into a
   * suitable one.
   */
  function assessBusiness(form, c) {
    var keys = activeSignalKeys(form.product);
    var s = evaluateSignals(form, keys);
    var trace = [], concerns = s.negatives.slice();
    var reduction = reductionFeasible(form, c);
    var fmt = window.EDL.fmt;

    function rule(id, text, fired, detail) {
      trace.push({ id: id, text: text, fired: !!fired, detail: detail || '' });
    }

    // --- Stage 1: repayment capacity, before anything else ------------------
    rule('B1', 'Repayment capacity is measured against operating cash surplus and placed in an illustrative band.',
      true, c.operatingSurplus > 0
        ? 'Capacity ' + fmt.pct(c.repaymentCapacity) + ' → ' + c.bandLabel + '.'
        : 'Operating expenses meet or exceed revenue, so there is no surplus to lend against.');

    var noSurplus = c.valid && c.operatingSurplus <= 0;
    var negativeRemaining = c.remainingCash < 0;
    var thinRemaining = !negativeRemaining && c.valid && c.remainingCash < c.revenue * 0.05;

    rule('B2', 'Monthly cash remaining after expenses, existing debt and the new repayment must be positive.',
      negativeRemaining,
      negativeRemaining
        ? 'Remaining cash is negative, so the repayment cannot be met from trading.'
        : 'Remaining cash is positive.');
    if (noSurplus) concerns.push('Operating expenses meet or exceed monthly revenue');
    if (negativeRemaining) concerns.push('Expenses and repayments would exceed monthly revenue');
    if (thinRemaining) {
      concerns.push('Very little cash would remain in the business each month');
      rule('B3', 'Remaining cash below 5% of revenue is flagged as a thin trading margin.', true,
        'The margin left in the business is under a twentieth of monthly revenue.');
    }
    if (c.band === 'concern' || c.band === 'severe') {
      concerns.push('Repayments would absorb ' + fmt.pct(c.repaymentCapacity) + ' of operating surplus');
    }
    if (c.debtBurden !== null && c.debtBurden > 30) {
      concerns.push('Existing business debt already takes ' + fmt.pct(c.debtBurden) + ' of revenue');
    }

    // --- Stage 2: inclusion rules -------------------------------------------
    rule('B4', 'Missing conventional banking information does not by itself produce a negative result.',
      !s.conventionalAvailable,
      !s.conventionalAvailable
        ? 'No bank record was available; the assessment continued on trading and payment data.'
        : 'Bank transaction information was available.');

    rule('B5', 'Positive alternative trading data can support inclusion where banking data is thin.',
      s.alternativePositive && !s.conventionalAvailable,
      s.alternativePositive && !s.conventionalAvailable
        ? 'Mobile-money, merchant or invoice data carried the inclusion case.'
        : s.alternativePositive
          ? 'Positive alternative data was recorded alongside available banking data.'
          : 'No positive alternative data was recorded.');

    rule('B6', 'Alternative trading data can never override a capacity concern or negative remaining cash.',
      s.alternativePositive && (c.band !== 'comfortable' || negativeRemaining),
      s.alternativePositive && (c.band !== 'comfortable' || negativeRemaining)
        ? 'Strong trading data was present, but repayment capacity still governs the outcome.'
        : 'Not engaged for this application.');

    // Business type affects which questions were asked, never the rules.
    rule('B7', 'Business type changes which verification questions apply; it does not affect this assessment.',
      true, 'Recorded as ' + (form.businessType || 'not stated') + '. No rule reads it.');

    // --- Stage 3: outcome ----------------------------------------------------
    var outcome, tone;

    if (!c.valid) {
      outcome = OUTCOMES.review; tone = 'review';
      rule('D0', 'Incomplete revenue information routes to business review.', true, 'Monthly revenue was not usable.');
    } else if (noSurplus || negativeRemaining || c.band === 'severe') {
      outcome = OUTCOMES.declined; tone = 'declined';
      rule('D1', 'No operating surplus, negative remaining cash, or capacity above ' + THRESHOLDS.concernMax + '% means the request is not recommended.',
        true, 'Repayment capacity governs this outcome regardless of any positive trading indicator.');
    } else if (c.band === 'concern') {
      if (reduction.possible && s.negativeCount === 0) {
        outcome = OUTCOMES.reduced; tone = 'reduced';
        rule('D2', 'Capacity between ' + THRESHOLDS.suitableMax + '% and ' + THRESHOLDS.concernMax + '% with no negative indicators supports a lower amount.',
          true, 'A smaller facility could bring capacity back inside the ' + THRESHOLDS.suitableMax + '% band. No figure is quoted.');
      } else {
        outcome = OUTCOMES.review; tone = 'review';
        rule('D3', 'A capacity concern combined with negative indicators, or with no smaller workable facility, requires business review.',
          true, s.negativeCount > 0 ? 'Negative indicators sit alongside the capacity concern.' : 'No smaller facility would fall inside the comfortable band.');
      }
    } else if (s.negativeCount >= 2) {
      outcome = OUTCOMES.review; tone = 'review';
      rule('D4', 'Two or more negative indicators require business review even where capacity is comfortable.',
        true, s.negativeCount + ' negative indicators were recorded.');
    } else if (s.positiveCount >= 2) {
      outcome = thinRemaining ? OUTCOMES.reduced : OUTCOMES.suitable;
      tone = thinRemaining ? 'reduced' : 'suitable';
      rule('D5', 'Comfortable capacity with two or more positive indicators supports the funding request.',
        true, thinRemaining ? 'A thin trading margin reduced the recommended amount.' : s.positiveCount + ' positive indicators were recorded.');
    } else if (s.positiveCount === 1 && s.negativeCount === 0) {
      outcome = thinRemaining ? OUTCOMES.reduced : OUTCOMES.suitable;
      tone = thinRemaining ? 'reduced' : 'suitable';
      rule('D6', 'Comfortable capacity with one positive and no negative indicators supports funding; a thin margin reduces it.',
        true, thinRemaining ? 'The thin trading margin reduced the recommended amount.' : 'No thin-margin flag was raised.');
    } else {
      outcome = OUTCOMES.review; tone = 'review';
      rule('D7', 'Where no positive trading indicator is available, the file goes to business review rather than being refused.',
        true, 'Too little information to support a recommendation either way.');
    }

    return {
      recommendation: outcome, tone: tone,
      cashFlow: c, signals: s.entries,
      positives: s.positives, concerns: concerns,
      sourcesUsed: s.entries.filter(function (e) { return e.weight !== 'unavailable'; }),
      sourcesUnavailable: s.entries.filter(function (e) { return e.weight === 'unavailable'; }),
      trace: trace, reduction: reduction,
      explanation: buildExplanation(form, c, outcome, s, reduction)
    };
  }

  /**
   * buildExplanation — plain-language reasons. Where capacity is seriously in
   * question the capacity position is stated first, followed by an explicit
   * statement that trading data cannot override it.
   * OUTPUT: array of sentences.
   */
  function buildExplanation(form, c, outcome, s, reduction) {
    var out = [], fmt = window.EDL.fmt, cur = form.currency || '';
    var serious = c.band === 'severe' || c.remainingCash < 0 || c.operatingSurplus <= 0;

    var positivesSentence = s.positiveCount > 0
      ? 'Your ' + humanList(s.positives.map(lowerFirst)) + ' provide positive indicators for this request.'
      : 'No positive trading indicator was available, which limits what the assessment can conclude.';

    var inclusionSentence = (!s.conventionalAvailable && s.alternativePositive)
      ? 'Bank transaction information was not available, so the assessment relied on your trading and payment records instead. A thin banking file did not count against the business.'
      : '';

    var cashSentence = c.remainingCash < 0
      ? 'After operating expenses, existing repayments and this repayment, the business would be short by about ' +
        fmt.money(Math.abs(c.remainingCash), cur) + ' a month.'
      : 'About ' + fmt.money(c.remainingCash, cur) + ' a month would remain in the business after operating expenses, existing repayments and this repayment.';

    if (serious) {
      out.push(c.operatingSurplus <= 0
        ? 'Repayment capacity is the deciding factor. Operating expenses currently meet or exceed revenue, so there is no operating surplus to fund a repayment from.'
        : 'Repayment capacity is the deciding factor. Repayments would absorb ' + fmt.pct(c.repaymentCapacity) +
          ' of the operating surplus, above the illustrative ' + THRESHOLDS.concernMax + '% level.');
      out.push(cashSentence);
      out.push(s.positiveCount > 0
        ? 'Strong mobile-money, merchant or invoice data cannot override a repayment-capacity concern of this kind. It can support inclusion where a facility is affordable, but it cannot make an unaffordable repayment workable.'
        : 'Positive trading data, had it been available, could not have changed this outcome. Capacity is assessed first and cannot be overridden by transaction history.');
      out.push(positivesSentence);
      if (inclusionSentence) out.push(inclusionSentence);
    } else {
      out.push(positivesSentence);
      if (inclusionSentence) out.push(inclusionSentence);
      if (c.band === 'comfortable') {
        out.push('Repayments would take ' + fmt.pct(c.repaymentCapacity) + ' of the operating surplus, inside the illustrative comfortable range of up to ' + THRESHOLDS.suitableMax + '%.');
      } else {
        out.push('However, repayments would take ' + fmt.pct(c.repaymentCapacity) + ' of the operating surplus, above the illustrative ' + THRESHOLDS.suitableMax + '% comfortable level.');
      }
      out.push(cashSentence);
    }

    if (outcome === OUTCOMES.reduced) {
      out.push('A smaller facility, or a longer term that lowers the monthly repayment, would bring capacity back inside the comfortable range. The assessment does not quote an amount, because that is a matter for business review rather than a demonstration rule.');
    }
    if (outcome === OUTCOMES.review) {
      out.push('The rules alone cannot fairly settle this request, so it goes to a business reviewer rather than being refused automatically.');
    }
    if (outcome === OUTCOMES.declined) {
      out.push('This concerns the amount and structure requested, not the business. A smaller facility, a longer term, or a reduction in existing commitments would change the result.');
    }
    return out;
  }

  function lowerFirst(str) { return str.charAt(0).toLowerCase() + str.slice(1); }
  function humanList(items) {
    if (items.length === 1) return items[0];
    return items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
  }

  /**
   * DEMO — one synthetic business applicant covering all four steps.
   * Fictional. Every figure is invented.
   */
  var DEMO = {
    id: 'biz-demo',
    name: 'Demo business',
    summary: 'Retail trader in Kenya, 1–3 years trading, working capital for stock.',
    form: {
      region: 'Africa', country: 'Kenya', currency: 'KES',
      businessType: 'Sole trader',
      sector: 'Retail and trade',
      tradingHistory: '1–3 years',
      applicantIsOwner: true,
      monthlyRevenue: '420000',
      operatingExpenses: '295000',
      existingBusinessDebt: '18000',
      cashFlowConsistency: 'Consistent',
      product: 'working-capital',
      fundingAmount: '300000',
      termMonths: '12',
      interestRate: '10',
      wcPurpose: 'Stock and inventory',
      wcCommitments: '60000',
      bankConsistency: 'Moderate',
      mobileMoney: 'Strong',
      merchantHistory: 'Moderate',
      utilityPayments: 'Good',
      invoicePayments: 'Unavailable',
      kyc: {}
    }
  };

  return {
    PRICING_NOTE: PRICING_NOTE,
    CAPACITY_FORMULA: CAPACITY_FORMULA,
    OUTCOMES: OUTCOMES,
    THRESHOLDS: THRESHOLDS,
    BAND_LABELS: BAND_LABELS,
    BUSINESS_TYPES: BUSINESS_TYPES,
    SECTORS: SECTORS,
    TRADING_HISTORY: TRADING_HISTORY,
    CASHFLOW_CONSISTENCY: CASHFLOW_CONSISTENCY,
    PRODUCTS: PRODUCTS,
    SIGNAL_MAP: SIGNAL_MAP,
    DEMO: DEMO,
    CURRENCY_SCALE: CURRENCY_SCALE,
    ALL_PRODUCT_FIELD_KEYS: ALL_PRODUCT_FIELD_KEYS,
    currencyScale: currencyScale,
    productById: productById,
    productFields: productFields,
    productRange: productRange,
    validateFundingRequest: validateFundingRequest,
    selectProduct: selectProduct,
    bandFor: bandFor,
    bandTable: bandTable,
    calculateCashFlow: calculateCashFlow,
    withPricing: withPricing,
    reductionFeasible: reductionFeasible,
    activeSignalKeys: activeSignalKeys,
    evaluateSignals: evaluateSignals,
    assessBusiness: assessBusiness
  };
})();
