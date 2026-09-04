/**
 * markets.js — country, currency and illustrative product configuration.
 *
 * PURPOSE
 *   One place where the prototype decides, for a selected African country:
 *     • which currency applies, how it is written and how it is formatted
 *     • what illustrative amount, term and rate ranges each lending product
 *       carries in that market, and on what BASIS the rate is quoted
 *   The assessment code never reads this file to judge an applicant. It only
 *   supplies the envelope a request is validated against and the figures the
 *   interface displays, so a market can be recalibrated without touching the
 *   affordability, explainability or human-review logic.
 *
 * INTEREST RATES (single source)
 *   Every product in this prototype is priced on ONE illustrative ANNUAL range:
 *     personal  4% – 5% per annum   (default 4.5%)
 *     business  8% – 12% per annum  (default 10%)
 *   No market overrides the rate, so the information view, the assessment form,
 *   the repayment calculation and the results page can only ever show the same
 *   figure. Market calibration applies to AMOUNTS and TERMS only.
 *
 * RATE BASIS
 *   Each record still declares rateBasis ('annual' | 'monthly' | 'daily' |
 *   'flat') and the interface always writes the basis beside the number, so a
 *   rate can never be read on the wrong clock. Every configured product is
 *   currently 'annual': the engine converts it with annualRate / 12 / 100.
 *
 * CALIBRATION
 *   Ranges are ILLUSTRATIVE PROTOTYPE CONFIGURATION. Where public information
 *   about a market exists it is used as a benchmark so the figures are not
 *   invented: the Nigerian profile is calibrated against publicly reported
 *   Carbon consumer and working-capital terms, and the Kenyan emergency profile
 *   against publicly reported Tala terms. The prototype does not offer, resell
 *   or represent those lenders' products.
 *
 * INPUTS  : country name, currency code, product id
 * OUTPUTS : currency records, product configuration objects, display labels
 */
window.EDL = window.EDL || {};

window.EDL.markets = (function () {

  // ------------------------------------------------------------- currency

  /**
   * CURRENCIES — code → { code, symbol, locale, decimals }.
   * Countries not listed fall back to their ISO code as the symbol, which is
   * still unambiguous, so no market is left without a usable currency record.
   */
  var CURRENCIES = {
    KES: { symbol: 'KSh', locale: 'en-KE', decimals: 0 },
    NGN: { symbol: '₦', locale: 'en-NG', decimals: 0 },
    GHS: { symbol: 'GH₵', locale: 'en-GH', decimals: 2 },
    ZAR: { symbol: 'R', locale: 'en-ZA', decimals: 2 },
    TZS: { symbol: 'TSh', locale: 'en-TZ', decimals: 0 },
    UGX: { symbol: 'USh', locale: 'en-UG', decimals: 0 },
    RWF: { symbol: 'FRw', locale: 'en-RW', decimals: 0 },
    EGP: { symbol: 'E£', locale: 'ar-EG', decimals: 2 },
    MAD: { symbol: 'DH', locale: 'fr-MA', decimals: 2 },
    ETB: { symbol: 'Br', locale: 'en-ET', decimals: 2 },
    ZMW: { symbol: 'ZK', locale: 'en-ZM', decimals: 2 },
    MWK: { symbol: 'MK', locale: 'en-MW', decimals: 0 },
    MZN: { symbol: 'MT', locale: 'pt-MZ', decimals: 2 },
    BWP: { symbol: 'P', locale: 'en-BW', decimals: 2 },
    NAD: { symbol: 'N$', locale: 'en-NA', decimals: 2 },
    MUR: { symbol: 'Rs', locale: 'en-MU', decimals: 0 },
    TND: { symbol: 'DT', locale: 'fr-TN', decimals: 2 },
    DZD: { symbol: 'DA', locale: 'fr-DZ', decimals: 0 },
    XOF: { symbol: 'CFA', locale: 'fr-SN', decimals: 0 },
    XAF: { symbol: 'FCFA', locale: 'fr-CM', decimals: 0 },
    AOA: { symbol: 'Kz', locale: 'pt-AO', decimals: 0 },
    CDF: { symbol: 'FC', locale: 'fr-CD', decimals: 0 },
    SLE: { symbol: 'Le', locale: 'en-SL', decimals: 0 },
    SOS: { symbol: 'Sh', locale: 'so-SO', decimals: 0 },
    LRD: { symbol: 'L$', locale: 'en-LR', decimals: 0 },
    GMD: { symbol: 'D', locale: 'en-GM', decimals: 0 },
    LSL: { symbol: 'L', locale: 'en-LS', decimals: 2 },
    SZL: { symbol: 'E', locale: 'en-SZ', decimals: 2 }
  };

  var DEFAULT_CURRENCY = { symbol: '', locale: 'en-GB', decimals: 0 };

  /**
   * currency — INPUT: currency code. OUTPUT: { code, symbol, locale, decimals }.
   * Unlisted codes return the code itself as the symbol.
   */
  function currency(code) {
    var c = code || '';
    var rec = CURRENCIES[c];
    if (!rec) return { code: c, symbol: c, locale: DEFAULT_CURRENCY.locale, decimals: 0 };
    return { code: c, symbol: rec.symbol, locale: rec.locale, decimals: rec.decimals };
  }

  /**
   * currencyForCountry — the single source of truth linking a selected country
   * to its currency. INPUT: country name. OUTPUT: currency record (code '' when
   * no country is selected).
   */
  function currencyForCountry(name) {
    if (!name) return currency('');
    var profile = window.EDL.data ? window.EDL.data.countryProfile('Africa', name) : null;
    return currency(profile ? profile.currency : '');
  }

  /**
   * money — display formatting in the applicant's own currency. No USD
   * equivalent is ever shown beside a local amount.
   * INPUT : value, currency code. OUTPUT: e.g. "KSh 12,500".
   */
  function money(value, code) {
    var n = parseFloat(value);
    if (!isFinite(n)) return '—';
    var c = currency(code);
    var rounded = Math.round(n);
    var text;
    try {
      text = rounded.toLocaleString(c.locale || 'en-GB');
    } catch (e) {
      text = rounded.toLocaleString('en-GB');
    }
    return c.symbol ? c.symbol + ' ' + text : text;
  }

  // --------------------------------------------------------- rate basis

  var RATE_BASES = ['annual', 'monthly', 'daily', 'flat'];

  var BASIS_SUFFIX = {
    annual: ' a year',
    monthly: ' per month',
    daily: ' per day',
    flat: ' flat on the amount borrowed'
  };

  /** basisSuffix — INPUT: basis. OUTPUT: the words shown after a rate. */
  function basisSuffix(basis) {
    return BASIS_SUFFIX[basis] || BASIS_SUFFIX.annual;
  }

  /** rateLabel — one rate written with its basis, e.g. "4.5% per month". */
  function rateLabel(rate, basis) {
    if (rate === null || rate === undefined || rate === '') return '—';
    return rate + '%' + basisSuffix(basis);
  }

  /** rateRangeLabel — a range written with its basis, never bare. */
  function rateRangeLabel(min, max, basis) {
    return min + '% – ' + max + '%' + basisSuffix(basis);
  }

  // ------------------------------------------------- illustrative scaling

  /**
   * CURRENCY_SCALE — rounded order-of-magnitude factors used to express the
   * generic base ranges in each currency. NOT exchange rates: they exist only
   * so an illustrative range reads sensibly in a local currency.
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
  function currencyScale(code) {
    return CURRENCY_SCALE[code] || CURRENCY_SCALE_DEFAULT;
  }

  /** roundNice — rounds a scaled figure to a readable round number. */
  function roundNice(value) {
    if (!isFinite(value) || value <= 0) return 0;
    var magnitude = Math.pow(10, Math.floor(Math.log(value) / Math.LN10) - 1);
    return Math.round(value / magnitude) * magnitude;
  }

  // ------------------------------------------------------- base products

  /**
   * BASE_PERSONAL / BASE_BUSINESS — the generic illustrative envelope used for
   * any market with no researched override. baseMin/baseMax are scaled into the
   * local currency; every rate here is quoted annually.
   */
  var BASE_PERSONAL = [
    { id: 'short-term', name: 'Short-Term Personal Loan',
      summary: 'For planned short-term personal expenses such as school fees, repairs or a one-off purchase.',
      baseMin: 100, baseMax: 2000, termMin: 3, termMax: 18,
      rateMin: 4, rateMax: 5, rateBasis: 'annual', defaultRate: 4.5, defaultTerm: 12 },
    { id: 'emergency', name: 'Emergency Loan',
      summary: 'For unexpected essential expenses where a smaller amount is needed quickly.',
      baseMin: 50, baseMax: 500, termMin: 1, termMax: 6,
      rateMin: 4, rateMax: 5, rateBasis: 'annual', defaultRate: 4.5, defaultTerm: 3 },
    { id: 'salary', name: 'Salary-Based Loan',
      summary: 'For applicants with regular employment income and a longer repayment horizon.',
      baseMin: 200, baseMax: 5000, termMin: 6, termMax: 36,
      rateMin: 4, rateMax: 5, rateBasis: 'annual', defaultRate: 4.5, defaultTerm: 24 }
  ];

  var BASE_BUSINESS = [
    { id: 'working-capital', name: 'Working Capital',
      baseMin: 100, baseMax: 5000, termMin: 3, termMax: 24,
      rateMin: 8, rateMax: 12, rateBasis: 'annual', defaultRate: 10, defaultTerm: 12 },
    { id: 'asset-finance', name: 'Asset Finance',
      baseMin: 500, baseMax: 25000, termMin: 12, termMax: 60,
      rateMin: 8, rateMax: 12, rateBasis: 'annual', defaultRate: 10, defaultTerm: 36 },
    { id: 'invoice-finance', name: 'Invoice Finance',
      baseMin: 200, baseMax: 10000, termMin: 1, termMax: 6,
      rateMin: 8, rateMax: 12, rateBasis: 'annual', defaultRate: 10, defaultTerm: 3 }
  ];

  /**
   * OVERRIDES — researched market calibration. Amounts here are already in the
   * local currency (no scaling is applied) and each product states its own
   * rate basis.
   *
   * Amounts and terms only — rates always come from the base records.
   * Nigeria: benchmarked against publicly reported Carbon terms — consumer
   *   loans of roughly ₦2,500–₦1,000,000 over 61 days to 12 months, and
   *   working capital of roughly ₦100,000–₦9.5m over 1–6 months.
   * Kenya: the emergency profile is benchmarked against publicly reported Tala
   *   terms — up to roughly KSh 50,000 over up to 61 days.
   */
  var OVERRIDES = {
    Nigeria: {
      personal: [
        { id: 'short-term', amountMin: 2500, amountMax: 1000000, termMin: 2, termMax: 12,
          defaultTerm: 6,
          note: 'Amount and term benchmarked against publicly reported Nigerian digital-lender terms. Pricing is our own illustrative annual range.' },
        { id: 'emergency', amountMin: 2500, amountMax: 100000, termMin: 1, termMax: 3,
          defaultTerm: 2 },
        { id: 'salary', amountMin: 50000, amountMax: 1000000, termMin: 3, termMax: 12,
          defaultTerm: 9 }
      ],
      business: [
        { id: 'working-capital', amountMin: 100000, amountMax: 9500000, termMin: 1, termMax: 6,
          defaultTerm: 3,
          note: 'Amount and term benchmarked against publicly reported Nigerian working-capital terms. Pricing is our own illustrative annual range.' },
        { id: 'asset-finance', amountMin: 500000, amountMax: 25000000, termMin: 12, termMax: 48,
          defaultTerm: 24 },
        { id: 'invoice-finance', amountMin: 100000, amountMax: 10000000, termMin: 1, termMax: 4,
          defaultTerm: 2 }
      ]
    },
    Kenya: {
      personal: [
        { id: 'short-term', amountMin: 500, amountMax: 200000, termMin: 1, termMax: 12,
          defaultTerm: 6 },
        { id: 'emergency', amountMin: 500, amountMax: 50000, termMin: 1, termMax: 2,
          defaultTerm: 2,
          note: 'Amount and term benchmarked against publicly reported Kenyan instant-credit terms. Pricing is our own illustrative annual range.' },
        { id: 'salary', amountMin: 10000, amountMax: 500000, termMin: 3, termMax: 24,
          defaultTerm: 12 }
      ]
    }
  };

  // -------------------------------------------------------- composition

  function label(p, code) {
    return {
      amountLabel: money(p.amountMin, code) + ' – ' + money(p.amountMax, code),
      termLabel: p.termMin + ' – ' + p.termMax + ' months',
      rateLabel: rateRangeLabel(p.rateMin, p.rateMax, p.rateBasis)
    };
  }

  /** Expands a base record into a market record by scaling its amounts. */
  function scaled(base, code) {
    var s = currencyScale(code);
    return {
      id: base.id, name: base.name, summary: base.summary,
      amountMin: roundNice(base.baseMin * s), amountMax: roundNice(base.baseMax * s),
      termMin: base.termMin, termMax: base.termMax,
      rateMin: base.rateMin, rateMax: base.rateMax, rateBasis: base.rateBasis,
      defaultRate: base.defaultRate, defaultTerm: base.defaultTerm,
      note: ''
    };
  }

  function merge(base, override, code) {
    var out = scaled(base, code);
    if (override) {
      ['amountMin', 'amountMax', 'termMin', 'termMax', 'rateMin', 'rateMax',
        'rateBasis', 'defaultRate', 'defaultTerm', 'name', 'summary', 'note'
      ].forEach(function (k) {
        if (override[k] !== undefined) out[k] = override[k];
      });
    }
    return out;
  }

  function overrideFor(country, kind, id) {
    var o = OVERRIDES[country];
    if (!o || !o[kind]) return null;
    for (var i = 0; i < o[kind].length; i++) if (o[kind][i].id === id) return o[kind][i];
    return null;
  }

  function buildList(bases, country, kind, code) {
    return bases.map(function (b) {
      var rec = merge(b, overrideFor(country, kind, b.id), code);
      var l = label(rec, code);
      rec.currency = code;
      rec.amountLabel = l.amountLabel;
      rec.termLabel = l.termLabel;
      rec.rateLabel = l.rateLabel;
      rec.calibrated = !!overrideFor(country, kind, b.id);
      return rec;
    });
  }

  /**
   * personalProducts / businessProducts
   * INPUT : country name (optional currency override, used by the business
   *         module which already carries a currency code)
   * OUTPUT: array of fully resolved product configuration objects
   */
  function personalProducts(country, code) {
    var c = code || currencyForCountry(country).code;
    return buildList(BASE_PERSONAL, country, 'personal', c);
  }

  function businessProducts(country, code) {
    var c = code || currencyForCountry(country).code;
    return buildList(BASE_BUSINESS, country, 'business', c);
  }

  /** product — one configuration record. INPUT: kind, id, country, currency. */
  function product(kind, id, country, code) {
    var list = kind === 'business' ? businessProducts(country, code) : personalProducts(country, code);
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  /**
   * validateRequest — checks an amount, term and rate against one product's
   * configuration for the selected country.
   * INPUT : kind, product id, country, currency, { amount, term, rate }
   * OUTPUT: array of short borrower-facing messages (empty when in range)
   */
  function validateRequest(kind, id, country, code, req) {
    var p = product(kind, id, country, code);
    if (!p) return [kind === 'business' ? 'Choose a funding product.' : 'Choose a loan product.'];
    var errors = [];
    var amount = parseFloat(req.amount), term = parseFloat(req.term), rate = parseFloat(req.rate);

    if (!isFinite(amount) || amount <= 0) {
      errors.push('Enter an amount greater than zero.');
    } else if (amount < p.amountMin || amount > p.amountMax) {
      errors.push(p.name + ' runs from ' + p.amountLabel + ' in this market. Adjust the amount to continue.');
    }

    if (!isFinite(term) || term <= 0) {
      errors.push('Enter a term in whole months.');
    } else if (term < p.termMin || term > p.termMax) {
      errors.push(p.name + ' terms run ' + p.termLabel + '. Adjust the term to continue.');
    }

    if (!isFinite(rate) || rate < 0) {
      errors.push('Enter an interest rate' + basisSuffix(p.rateBasis) + '.');
    } else if (rate < p.rateMin || rate > p.rateMax) {
      errors.push(p.name + ' is priced at ' + p.rateLabel + ' in this market. Adjust the rate to continue.');
    }
    return errors;
  }

  return {
    CURRENCIES: CURRENCIES,
    CURRENCY_SCALE: CURRENCY_SCALE,
    RATE_BASES: RATE_BASES,
    BASE_PERSONAL: BASE_PERSONAL,
    BASE_BUSINESS: BASE_BUSINESS,
    OVERRIDES: OVERRIDES,
    currency: currency,
    currencyForCountry: currencyForCountry,
    currencyScale: currencyScale,
    money: money,
    basisSuffix: basisSuffix,
    rateLabel: rateLabel,
    rateRangeLabel: rateRangeLabel,
    personalProducts: personalProducts,
    businessProducts: businessProducts,
    product: product,
    validateRequest: validateRequest
  };
})();
