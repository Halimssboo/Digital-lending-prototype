/**
 * tests.js — unit tests for the calculation and assessment modules.
 *
 * PURPOSE
 *   A dependency-free test harness so the artefact carries visible evidence
 *   that its rules behave as documented. Each test states what it checks, the
 *   expected value and the actual value, and the results are rendered on the
 *   prototype's Validation page.
 *
 * INPUTS  : none (each test builds its own synthetic form object)
 * OUTPUTS : run() returns { cases: [...], passed, failed, total }
 */
window.EDL = window.EDL || {};

window.EDL.tests = (function () {
  /** Base synthetic applicant every test starts from, then overrides. */
  function baseForm(overrides) {
    return Object.assign({
      region: 'GCC', country: 'United Arab Emirates', currency: 'AED', is18: true,
      employmentType: 'Salaried', monthlyIncome: '10000', incomeRegularity: 'Stable',
      loanAmount: '20000', loanTermMonths: '24', existingDebt: '1000',
      proposedRepayment: '1000', essentialExpenses: '3000',
      creditHistory: 'Unavailable', bankConsistency: 'Unavailable',
      utilityPayments: 'Unavailable', mobileMoney: 'Unavailable'
    }, overrides || {});
  }

  /** Business shorthand. All figures are illustrative prototype pricing. */
  function BZ() { return window.EDL.business; }
  function bizForm(overrides) {
    return Object.assign({
      region: 'Africa', country: 'Kenya', currency: 'KES',
      businessType: 'Sole trader', sector: 'Retail and trade',
      tradingHistory: '1–3 years', applicantIsOwner: true,
      monthlyRevenue: '400000', operatingExpenses: '280000',
      existingBusinessDebt: '20000', cashFlowConsistency: 'Consistent',
      product: 'working-capital', fundingAmount: '300000',
      termMonths: '12', interestRate: '10',
      bankConsistency: 'Moderate', mobileMoney: 'Strong',
      merchantHistory: 'Moderate', utilityPayments: 'Good',
      invoicePayments: 'Unavailable', kyc: {}
    }, overrides || {});
  }
  function cash(form) { return BZ().calculateCashFlow(BZ().withPricing(form)); }
  function bizAssess(form) {
    var priced = BZ().withPricing(form);
    return BZ().assessBusiness(priced, BZ().calculateCashFlow(priced));
  }

  function afford(form) { return window.EDL.afford.calculateAffordability(form); }
  function assess(form) { return window.EDL.assess.assessApplicant(form, afford(form)); }
  function round1(n) { return Math.round(n * 10) / 10; }

  /** Pricing shorthand. All figures are illustrative prototype pricing. */
  function price(amount, rate, term) { return window.EDL.pricing.loanSummary(amount, rate, term); }
  function priced(form) { return window.EDL.pricing.withPricing(form); }

  /**
   * Each test returns { id, group, name, expected, actual }.
   * A test passes when String(expected) === String(actual).
   */
  var TESTS = [
    {
      id: 'T01', group: 'Affordability arithmetic',
      name: 'Current debt-to-income ratio is existing debt over income',
      run: function () {
        var a = afford(baseForm({ monthlyIncome: '10000', existingDebt: '2500' }));
        return { expected: 25, actual: round1(a.debtToIncome) };
      }
    },
    {
      id: 'T02', group: 'Affordability arithmetic',
      name: 'Post-loan commitment ratio includes the proposed repayment',
      run: function () {
        var a = afford(baseForm({ monthlyIncome: '10000', existingDebt: '2000', proposedRepayment: '2400' }));
        return { expected: 44, actual: round1(a.postLoanCommitment) };
      }
    },
    {
      id: 'T03', group: 'Affordability arithmetic',
      name: 'Disposable income subtracts essentials and all repayments',
      run: function () {
        var a = afford(baseForm({ monthlyIncome: '10000', existingDebt: '1500', proposedRepayment: '1200', essentialExpenses: '4000' }));
        return { expected: 3300, actual: a.disposableIncome };
      }
    },
    {
      id: 'T04', group: 'Affordability arithmetic',
      name: 'Zero income produces no ratio rather than a division error',
      run: function () {
        var a = afford(baseForm({ monthlyIncome: '0' }));
        return { expected: 'null', actual: String(a.postLoanCommitment) };
      }
    },
    {
      id: 'T05', group: 'Threshold boundaries',
      name: 'Exactly at the affordable ceiling is still generally affordable',
      run: function () {
        var a = afford(baseForm({ monthlyIncome: '10000', existingDebt: '0', proposedRepayment: '3500' }));
        return { expected: 'affordable', actual: a.band };
      }
    },
    {
      id: 'T06', group: 'Threshold boundaries',
      name: 'Just above the affordable ceiling becomes an affordability concern',
      run: function () {
        var a = afford(baseForm({ monthlyIncome: '10000', existingDebt: '0', proposedRepayment: '3600' }));
        return { expected: 'concern', actual: a.band };
      }
    },
    {
      id: 'T07', group: 'Threshold boundaries',
      name: 'Just above the concern ceiling becomes a high affordability concern',
      run: function () {
        var a = afford(baseForm({ monthlyIncome: '10000', existingDebt: '0', proposedRepayment: '5100' }));
        return { expected: 'high', actual: a.band };
      }
    },
    {
      id: 'T08', group: 'Ethical constraints',
      name: 'A thin credit file with strong alternative data and an affordable loan is not a negative outcome',
      run: function () {
        var r = assess(baseForm({
          region: 'Africa', country: 'Kenya', currency: 'KES',
          monthlyIncome: '60000', existingDebt: '2000', proposedRepayment: '6000', essentialExpenses: '25000',
          creditHistory: 'Unavailable', bankConsistency: 'Unavailable',
          utilityPayments: 'Good', mobileMoney: 'Strong'
        }));
        return { expected: 'Eligible – Standard Loan', actual: r.recommendation };
      }
    },
    {
      id: 'T09', group: 'Ethical constraints',
      name: 'Strong alternative data does not rescue a high affordability concern',
      run: function () {
        var r = assess(baseForm({
          region: 'Africa', country: 'Kenya', currency: 'KES',
          monthlyIncome: '60000', existingDebt: '10000', proposedRepayment: '26000', essentialExpenses: '15000',
          creditHistory: 'Strong', bankConsistency: 'Strong',
          utilityPayments: 'Good', mobileMoney: 'Strong'
        }));
        return { expected: 'Current Loan Amount Not Recommended', actual: r.recommendation };
      }
    },
    {
      id: 'T10', group: 'Ethical constraints',
      name: 'Unavailable conventional history is weighted as absent, never as negative',
      run: function () {
        var r = assess(baseForm({ creditHistory: 'Unavailable' }));
        var entry = r.signals.filter(function (e) { return e.key === 'creditHistory'; })[0];
        return { expected: 'unavailable', actual: entry.weight };
      }
    },
    {
      id: 'T11', group: 'Ethical constraints',
      name: 'Limited conventional history is weighted as neutral, never as negative',
      run: function () {
        var r = assess(baseForm({ creditHistory: 'Limited' }));
        var entry = r.signals.filter(function (e) { return e.key === 'creditHistory'; })[0];
        return { expected: 'neutral', actual: entry.weight };
      }
    },
    {
      id: 'T12', group: 'Ethical constraints',
      name: 'Negative disposable income is never a positive recommendation',
      run: function () {
        var r = assess(baseForm({
          monthlyIncome: '10000', existingDebt: '500', proposedRepayment: '1500', essentialExpenses: '9000',
          creditHistory: 'Strong', bankConsistency: 'Strong', utilityPayments: 'Good'
        }));
        return { expected: 'Current Loan Amount Not Recommended', actual: r.recommendation };
      }
    },
    {
      id: 'T13', group: 'Fairness',
      name: 'Identical finances give the same recommendation in a GCC and an African market',
      run: function () {
        var shared = {
          monthlyIncome: '20000', existingDebt: '1000', proposedRepayment: '2000', essentialExpenses: '6000',
          creditHistory: 'Strong', bankConsistency: 'Strong', utilityPayments: 'Good', mobileMoney: 'Unavailable'
        };
        var gcc = assess(baseForm(Object.assign({ region: 'GCC', country: 'Qatar' }, shared)));
        var afr = assess(baseForm(Object.assign({ region: 'Africa', country: 'Ghana' }, shared)));
        return { expected: gcc.recommendation, actual: afr.recommendation };
      }
    },
    {
      id: 'T14', group: 'Fairness',
      name: 'The same four data sources are offered in an African market',
      run: function () {
        return {
          expected: 'creditHistory,bankConsistency,utilityPayments,mobileMoney',
          actual: window.EDL.assess.activeSignalKeys('Africa').join(',')
        };
      }
    },
    {
      id: 'T15', group: 'Fairness',
      name: 'Region does not change which data sources are offered',
      run: function () {
        return {
          expected: window.EDL.assess.activeSignalKeys('Africa').join(','),
          actual: window.EDL.assess.activeSignalKeys('GCC').join(',')
        };
      }
    },
    {
      id: 'T16', group: 'Routing',
      name: 'A concern-band ratio with clean records recommends a lower amount',
      run: function () {
        var r = assess(baseForm({
          monthlyIncome: '15000', existingDebt: '1500', proposedRepayment: '4800', essentialExpenses: '5500',
          creditHistory: 'Moderate', bankConsistency: 'Strong', utilityPayments: 'Good'
        }));
        return { expected: 'Eligible – Reduced Loan Recommended', actual: r.recommendation };
      }
    },
    {
      id: 'T17', group: 'Routing',
      name: 'Two or more negative indicators route an affordable loan to human review',
      run: function () {
        var r = assess(baseForm({
          incomeRegularity: 'Irregular', bankConsistency: 'Weak', utilityPayments: 'Poor'
        }));
        return { expected: 'Further Human Review Required', actual: r.recommendation };
      }
    },
    {
      id: 'T18', group: 'Routing',
      name: 'No positive indicator of any kind routes to human review rather than refusal',
      run: function () {
        var r = assess(baseForm({ incomeRegularity: 'Mostly stable' }));
        return { expected: 'Further Human Review Required', actual: r.recommendation };
      }
    },
    {
      id: 'T21', group: 'Illustrative pricing',
      name: 'Amortising monthly repayment matches the standard annuity formula',
      run: function () {
        // 20,000 at 12% p.a. over 24 months → 941.47 per month
        var s = price('20000', '12', '24');
        return { expected: 941, actual: Math.round(s.monthlyRepayment) };
      }
    },
    {
      id: 'T22', group: 'Illustrative pricing',
      name: 'Total repayable is the monthly repayment across the whole term',
      run: function () {
        var s = price('20000', '12', '24');
        return { expected: true, actual: Math.abs(s.totalRepayment - s.monthlyRepayment * 24) < 1e-6 };
      }
    },
    {
      id: 'T23', group: 'Illustrative pricing',
      name: 'Total interest is total repayable less the principal',
      run: function () {
        var s = price('20000', '12', '24');
        return { expected: 2595, actual: Math.round(s.totalInterest) };
      }
    },
    {
      id: 'T24', group: 'Illustrative pricing',
      name: 'A zero rate repays the principal in equal instalments, with no division by zero',
      run: function () {
        var s = price('24000', '0', '12');
        return { expected: 2000, actual: s.monthlyRepayment };
      }
    },
    {
      id: 'T25', group: 'Illustrative pricing',
      name: 'A zero rate produces no interest and a total equal to the amount borrowed',
      run: function () {
        var s = price('24000', '0', '12');
        return { expected: '0 / 24000', actual: s.totalInterest + ' / ' + s.totalRepayment };
      }
    },
    {
      id: 'T26', group: 'Illustrative pricing',
      name: 'A blank or unreadable rate is treated as interest-free rather than as an error',
      run: function () {
        var s = price('24000', '', '12');
        return { expected: 2000, actual: s.monthlyRepayment };
      }
    },
    {
      id: 'T27', group: 'Illustrative pricing',
      name: 'Unusable inputs are reported as invalid instead of a misleading zero cost',
      run: function () {
        var noAmount = price('0', '12', '24');
        var noTerm = price('20000', '12', '0');
        return { expected: 'false/false', actual: noAmount.valid + '/' + noTerm.valid };
      }
    },
    {
      id: 'T28', group: 'Illustrative pricing',
      name: 'A higher rate costs more interest over the same amount and term',
      run: function () {
        return {
          expected: true,
          actual: price('20000', '24', '24').totalInterest > price('20000', '12', '24').totalInterest
        };
      }
    },
    {
      id: 'T29', group: 'Illustrative pricing',
      name: 'A longer term lowers the monthly repayment but raises the total interest',
      run: function () {
        var short = price('20000', '12', '12'), long = price('20000', '12', '36');
        return {
          expected: true,
          actual: long.monthlyRepayment < short.monthlyRepayment && long.totalInterest > short.totalInterest
        };
      }
    },
    {
      id: 'T30', group: 'Illustrative pricing',
      name: 'Pricing feeds the affordability calculation, so no repayment is typed by the applicant',
      run: function () {
        var f = priced(baseForm({
          monthlyIncome: '10000', existingDebt: '0', essentialExpenses: '3000',
          loanAmount: '20000', interestRate: '12', loanTermMonths: '24',
          proposedRepayment: ''
        }));
        // 941 per month on 10,000 income → 9.4% post-loan commitment
        return { expected: '941 / 9.4', actual: f.proposedRepayment + ' / ' + round1(afford(f).postLoanCommitment) };
      }
    },
    {
      id: 'T31', group: 'Illustrative pricing',
      name: 'An interest-free loan is assessed on its principal-only repayment',
      run: function () {
        var f = priced(baseForm({
          monthlyIncome: '10000', existingDebt: '0', essentialExpenses: '3000',
          loanAmount: '24000', interestRate: '0', loanTermMonths: '24',
          proposedRepayment: ''
        }));
        return { expected: '1000 / 10', actual: f.proposedRepayment + ' / ' + round1(afford(f).postLoanCommitment) };
      }
    },
    {
      id: 'T32', group: 'Illustrative pricing',
      name: 'Every pricing summary carries the illustrative-pricing label',
      run: function () {
        var s = price('20000', '12', '24');
        return { expected: window.EDL.pricing.PRICING_LABEL, actual: s.label };
      }
    },
    {
      id: 'T19', group: 'Explainability',
      name: 'Every recommendation is accompanied by at least two plain-language reasons',
      run: function () {
        var r = assess(baseForm({ creditHistory: 'Strong', bankConsistency: 'Strong' }));
        return { expected: true, actual: r.explanation.length >= 2 };
      }
    },
    {
      id: 'T20', group: 'Explainability',
      name: 'Every recommendation records a rule trace',
      run: function () {
        var r = assess(baseForm());
        return { expected: true, actual: r.trace.length > 0 && r.trace.some(function (t) { return t.fired; }) };
      }
    },
    {
      id: 'T46', group: 'Illustrative pricing',
      name: 'The pre-loan summary is the affordability module with no proposed repayment',
      run: function () {
        var f = baseForm({ monthlyIncome: '10000', existingDebt: '1500', essentialExpenses: '4000' });
        var before = afford(Object.assign({}, f, { proposedRepayment: 0 }));
        return { expected: '15 / 4500', actual: round1(before.debtToIncome) + ' / ' + before.disposableIncome };
      }
    },
    {
      id: 'T47', group: 'Illustrative pricing',
      name: 'Disposable income after the loan is the pre-loan figure less the calculated repayment',
      run: function () {
        var f = priced(baseForm({
          monthlyIncome: '10000', existingDebt: '1500', essentialExpenses: '4000',
          loanAmount: '20000', interestRate: '12', loanTermMonths: '24', proposedRepayment: ''
        }));
        var before = afford(Object.assign({}, f, { proposedRepayment: 0 }));
        var after = afford(f);
        return { expected: true, actual: after.disposableIncome === before.disposableIncome - f.proposedRepayment };
      }
    },
    {
      id: 'T48', group: 'Business cash flow',
      name: 'Operating cash surplus is revenue less operating expenses',
      run: function () {
        var c = cash(bizForm());
        return { expected: 120000, actual: c.operatingSurplus };
      }
    },
    {
      id: 'T49', group: 'Business cash flow',
      name: 'Existing debt burden is measured against revenue',
      run: function () {
        var c = cash(bizForm());
        return { expected: 5, actual: round1(c.debtBurden) };
      }
    },
    {
      id: 'T50', group: 'Business cash flow',
      name: 'Repayment capacity is all repayments against the operating surplus',
      run: function () {
        // 300,000 at 18% over 12 months → 27,506 a month; plus 20,000 existing
        var c = cash(bizForm());
        var expected = round1(((20000 + c.proposedRepayment) / 120000) * 100);
        return { expected: expected, actual: round1(c.repaymentCapacity) };
      }
    },
    {
      id: 'T51', group: 'Business cash flow',
      name: 'Remaining cash subtracts expenses, existing debt and the new repayment',
      run: function () {
        var c = cash(bizForm());
        return { expected: true, actual: c.remainingCash === 400000 - 280000 - 20000 - c.proposedRepayment };
      }
    },
    {
      id: 'T52', group: 'Business cash flow',
      name: 'A business with no operating surplus is not divided by zero',
      run: function () {
        var c = cash(bizForm({ monthlyRevenue: '200000', operatingExpenses: '200000' }));
        return { expected: 'null / severe', actual: c.repaymentCapacity + ' / ' + c.band };
      }
    },
    {
      id: 'T53', group: 'Business lending rules',
      name: 'No operating surplus means the request is not recommended',
      run: function () {
        var r = bizAssess(bizForm({ monthlyRevenue: '200000', operatingExpenses: '210000' }));
        return { expected: BZ().OUTCOMES.declined, actual: r.recommendation };
      }
    },
    {
      id: 'T54', group: 'Business lending rules',
      name: 'Strong trading data cannot override negative remaining cash',
      run: function () {
        var r = bizAssess(bizForm({
          monthlyRevenue: '300000', operatingExpenses: '260000', existingBusinessDebt: '30000',
          fundingAmount: '400000', mobileMoney: 'Strong', merchantHistory: 'Strong', utilityPayments: 'Good'
        }));
        return { expected: BZ().OUTCOMES.declined, actual: r.recommendation };
      }
    },
    {
      id: 'T55', group: 'Business lending rules',
      name: 'Comfortable capacity with positive trading data supports the request',
      run: function () {
        var r = bizAssess(bizForm({ monthlyRevenue: '900000', operatingExpenses: '500000' }));
        return { expected: BZ().OUTCOMES.suitable, actual: r.recommendation };
      }
    },
    {
      id: 'T56', group: 'Business lending rules',
      name: 'Missing bank information alone does not produce a negative result',
      run: function () {
        var r = bizAssess(bizForm({
          monthlyRevenue: '900000', operatingExpenses: '500000',
          bankConsistency: 'Unavailable', mobileMoney: 'Strong', merchantHistory: 'Strong'
        }));
        return { expected: BZ().OUTCOMES.suitable, actual: r.recommendation };
      }
    },
    {
      id: 'T57', group: 'Business lending rules',
      name: 'A capacity concern with clean indicators recommends a lower amount',
      run: function () {
        var r = bizAssess(bizForm({
          monthlyRevenue: '400000', operatingExpenses: '340000', existingBusinessDebt: '5000',
          fundingAmount: '400000', termMonths: '12'
        }));
        return { expected: BZ().OUTCOMES.reduced + ' / concern', actual: r.recommendation + ' / ' + r.cashFlow.band };
      }
    },
    {
      id: 'T58', group: 'Business lending rules',
      name: 'Volatile cash flow alongside a capacity concern routes to business review',
      run: function () {
        var r = bizAssess(bizForm({
          monthlyRevenue: '400000', operatingExpenses: '340000', existingBusinessDebt: '5000',
          fundingAmount: '400000', termMonths: '12', cashFlowConsistency: 'Volatile'
        }));
        return { expected: BZ().OUTCOMES.review, actual: r.recommendation };
      }
    },
    {
      id: 'T59', group: 'Business lending rules',
      name: 'Unusable revenue routes to review rather than refusal',
      run: function () {
        var r = bizAssess(bizForm({ monthlyRevenue: '' }));
        return { expected: BZ().OUTCOMES.review, actual: r.recommendation };
      }
    },
    {
      id: 'T60', group: 'Business lending rules',
      name: 'Country does not change the business recommendation for an identical request',
      run: function () {
        // Market configuration (ranges, rate basis) legitimately differs by
        // country, so the request is priced ONCE and only the country label is
        // varied: the decision rules must reach the same conclusion.
        var priced = BZ().withPricing(bizForm({ country: 'Kenya' }));
        var asNigeria = Object.assign({}, priced, { country: 'Nigeria', currency: 'NGN' });
        var kenya = BZ().assessBusiness(priced, BZ().calculateCashFlow(priced));
        var nigeria = BZ().assessBusiness(asNigeria, BZ().calculateCashFlow(asNigeria));
        return { expected: kenya.recommendation, actual: nigeria.recommendation };
      }
    },
    {
      id: 'T61', group: 'Business lending rules',
      name: 'Business type does not change the business recommendation',
      run: function () {
        var registered = bizAssess(bizForm({ businessType: 'Registered business' }));
        var informal = bizAssess(bizForm({ businessType: 'Informal micro or small business' }));
        return { expected: registered.recommendation, actual: informal.recommendation };
      }
    },
    {
      id: 'T62', group: 'Business lending rules',
      name: 'Invoice payment history is only asked for on an invoice finance request',
      run: function () {
        return {
          expected: 'false / true',
          actual: (BZ().activeSignalKeys('working-capital').indexOf('invoicePayments') !== -1) + ' / ' +
                  (BZ().activeSignalKeys('invoice-finance').indexOf('invoicePayments') !== -1)
        };
      }
    },
    {
      id: 'T63', group: 'Business funding products',
      name: 'Three funding products are offered, each with its own conditional questions',
      run: function () {
        var ids = BZ().PRODUCTS.map(function (p) { return p.id; }).join(',');
        var counts = BZ().PRODUCTS.map(function (p) { return BZ().productFields(p.id).length; }).join(',');
        return { expected: 'working-capital,asset-finance,invoice-finance / 2,3,3', actual: ids + ' / ' + counts };
      }
    },
    {
      id: 'T64', group: 'Business funding products',
      name: 'Business repayments come from the shared pricing engine, not a typed figure',
      run: function () {
        var priced = BZ().withPricing(bizForm());
        var direct = window.EDL.pricing.loanSummary('300000', '10', '12');
        return { expected: direct.monthlyRepayment, actual: priced.proposedRepayment };
      }
    },
    {
      id: 'T65', group: 'Business funding products',
      name: 'An interest-free business facility repays principal only',
      run: function () {
        var priced = BZ().withPricing(bizForm({ fundingAmount: '240000', interestRate: '0', termMonths: '12' }));
        return { expected: '20000 / 0', actual: priced.proposedRepayment + ' / ' + priced.pricing.totalInterest };
      }
    },
    {
      id: 'T66', group: 'Business funding products',
      name: 'An informal business is not asked for a corporate registration document',
      run: function () {
        var K = window.EDL.kyc;
        function rel(type) {
          return K.businessChecks({ businessType: type, applicantIsOwner: true, kyc: {} }, null)
            .filter(function (c) { return c.key === 'registrationDocument'; })[0].relevance;
        }
        return {
          expected: 'not-applicable / not-applicable / required',
          actual: rel('Informal micro or small business') + ' / ' +
                  rel('Self-employed business operator') + ' / ' + rel('Registered business')
        };
      }
    },
    {
      id: 'T67', group: 'Business funding products',
      name: 'Business verification state never changes the business recommendation',
      run: function () {
        var K = window.EDL.kyc;
        var base = bizForm({ monthlyRevenue: '900000', operatingExpenses: '500000' });
        var ctx = { businessType: base.businessType, applicantIsOwner: true, kyc: {} };
        var unverified = bizAssess(base);
        var verified = bizAssess(Object.assign({}, base, {
          kyc: K.markAll(K.businessChecks(ctx, null), 'Verified')
        }));
        return { expected: unverified.recommendation, actual: verified.recommendation };
      }
    },
    {
      id: 'T68', group: 'Business funding products',
      name: 'The demo business completes all four steps and reaches a recommendation',
      run: function () {
        var r = bizAssess(BZ().DEMO.form);
        var known = [BZ().OUTCOMES.suitable, BZ().OUTCOMES.reduced, BZ().OUTCOMES.review, BZ().OUTCOMES.declined];
        return { expected: true, actual: known.indexOf(r.recommendation) !== -1 };
      }
    },
    {
      id: 'T69', group: 'Business lending rules',
      name: 'Capacity is settled before any indicator is read in the rule trace',
      run: function () {
        var r = bizAssess(bizForm());
        var first = r.trace[0].id, capacityBefore = r.trace.findIndex(function (t) { return t.id === 'B4'; });
        return { expected: 'B1 / true', actual: first + ' / ' + (capacityBefore > 1) };
      }
    },
    {
      id: 'T70', group: 'Business funding products',
      name: 'Only African markets are selectable, and no demo applicant sits outside them',
      run: function () {
        var regions = window.EDL.data.REGIONS.join(',');
        var offRegion = window.EDL.demos.filter(function (d) { return d.form.region !== 'Africa'; }).length;
        return { expected: 'Africa / 0', actual: regions + ' / ' + offRegion };
      }
    },
    {
      id: 'T71', group: 'Business funding products',
      name: 'The demo business request sits inside its product’s illustrative range',
      run: function () {
        return { expected: 0, actual: BZ().validateFundingRequest(BZ().DEMO.form).length };
      }
    },
    {
      id: 'T72', group: 'Business funding products',
      name: 'Funding ranges are expressed in the applicant’s own currency',
      run: function () {
        var kes = BZ().productRange('working-capital', 'KES');
        var ngn = BZ().productRange('working-capital', 'NGN');
        return {
          expected: 'true / true',
          actual: (kes.amountMax !== ngn.amountMax) + ' / ' + (kes.amountMin < 300000 && kes.amountMax > 300000)
        };
      }
    },
    {
      id: 'T73', group: 'Business funding products',
      name: 'An amount outside the product range is refused rather than priced',
      run: function () {
        var over = BZ().validateFundingRequest(bizForm({ fundingAmount: '9000000' }));
        var under = BZ().validateFundingRequest(bizForm({ fundingAmount: '500' }));
        return { expected: '1 / 1', actual: over.length + ' / ' + under.length };
      }
    },
    {
      id: 'T74', group: 'Business funding products',
      name: 'A term outside the product range is refused',
      run: function () {
        var e = BZ().validateFundingRequest(bizForm({ product: 'invoice-finance', fundingAmount: '300000', termMonths: '24', interestRate: '10' }));
        return { expected: true, actual: e.length === 1 && e[0].indexOf('terms run') !== -1 };
      }
    },
    {
      id: 'T75', group: 'Business funding products',
      name: 'A rate outside the product range is refused',
      run: function () {
        var e = BZ().validateFundingRequest(bizForm({ interestRate: '20' }));
        return { expected: true, actual: e.length === 1 && e[0].indexOf('priced at') !== -1 };
      }
    },
    {
      id: 'T76', group: 'Business funding products',
      name: 'Each product carries its own amount, term and rate limits',
      run: function () {
        var rows = BZ().PRODUCTS.map(function (p) {
          return p.termMin + '-' + p.termMax + '/' + p.rateMin + '-' + p.rateMax;
        }).join(' ');
        return { expected: '3-24/8-12 12-60/8-12 1-6/8-12', actual: rows };
      }
    },
    {
      id: 'T77', group: 'Business funding products',
      name: 'Switching product clears the old product’s fields and applies its own term and rate',
      run: function () {
        var start = bizForm({ wcPurpose: 'Payroll', wcCommitments: '60000' });
        var next = BZ().selectProduct(start, 'invoice-finance');
        return {
          expected: 'invoice-finance / 3 / 10 /  / ',
          actual: [next.product, next.termMonths, next.interestRate, next.wcPurpose, next.wcCommitments].join(' / ')
        };
      }
    },
    {
      id: 'T78', group: 'Business funding products',
      name: 'A switched product leaves a request that passes its own validation',
      run: function () {
        var next = BZ().selectProduct(bizForm(), 'asset-finance');
        next.fundingAmount = String(BZ().productRange('asset-finance', 'KES').amountMin);
        return { expected: 0, actual: BZ().validateFundingRequest(next).length };
      }
    },
    {
      id: 'T79', group: 'Simulated verification',
      name: 'Incomplete verification blocks the assessment without being recorded as a concern',
      run: function () {
        var K = window.EDL.kyc;
        var base = bizForm({ monthlyRevenue: '900000', operatingExpenses: '500000' });
        var ctx = { businessType: base.businessType, applicantIsOwner: true, kyc: K.defaultBusinessStates() };
        var st = K.kycStatus(K.businessChecks(ctx, null));
        var r = bizAssess(base);
        var mentionsKyc = r.concerns.concat(r.explanation).join(' ').toLowerCase().indexOf('verif') !== -1;
        return { expected: 'incomplete / false', actual: st.status + ' / ' + mentionsKyc };
      }
    },
    {
      id: 'T80', group: 'Simulated verification',
      name: 'Not applicable still satisfies the verification gateway',
      run: function () {
        var K = window.EDL.kyc;
        var ctx = { businessType: 'Informal micro or small business', applicantIsOwner: true, kyc: {} };
        ctx.kyc = K.markAll(K.businessChecks(ctx, null), 'Verified');
        var checks = K.businessChecks(ctx, null);
        var notApplicable = checks.filter(function (c) { return c.state === 'Not applicable'; }).length;
        return { expected: 'verified / true', actual: K.kycStatus(checks).status + ' / ' + (notApplicable > 0) };
      }
    },
    {
      id: 'T81', group: 'Business lending rules',
      name: 'The suitable outcome states that it is an assessment-rules recommendation',
      run: function () {
        return {
          expected: 'Funding request appears suitable under the assessment rules',
          actual: BZ().OUTCOMES.suitable
        };
      }
    },
    {
      id: 'T82', group: 'Business cash flow',
      name: 'The published capacity formula matches the calculation',
      run: function () {
        var c = cash(bizForm());
        var byFormula = ((c.existingDebt + c.proposedRepayment) / c.operatingSurplus) * 100;
        return {
          expected: 'true / true',
          actual: (Math.abs(c.repaymentCapacity - byFormula) < 1e-9) + ' / ' +
                  (BZ().CAPACITY_FORMULA.indexOf('operating cash surplus') !== -1)
        };
      }
    },
    {
      id: 'T33', group: 'Simulated verification',
      name: 'Only the four synthetic verification states are accepted',
      run: function () {
        var K = window.EDL.kyc;
        return {
          expected: 'Verified,Pending,Not provided,Not applicable / Not provided',
          actual: K.STATES.join(',') + ' / ' + K.normaliseState('AB1234567')
        };
      }
    },
    {
      id: 'T34', group: 'Simulated verification',
      name: 'Editable checks start as not provided, and no identity value is held',
      run: function () {
        var d = window.EDL.kyc.defaultPersonalStates();
        var allNotProvided = Object.keys(d).every(function (k) { return d[k] === 'Not provided'; });
        return { expected: 'true / 5', actual: allNotProvided + ' / ' + Object.keys(d).length };
      }
    },
    {
      id: 'T35', group: 'Simulated verification',
      name: 'Country and age states are derived from the application, not entered twice',
      run: function () {
        var K = window.EDL.kyc;
        var p = window.EDL.data.countryProfile('Africa', 'Kenya');
        var no = K.personalChecks({ country: '', is18: false, kyc: {} }, null);
        var yes = K.personalChecks({ country: 'Kenya', is18: true, kyc: {} }, p);
        function st(list, key) { return list.filter(function (c) { return c.key === key; })[0].state; }
        return {
          expected: 'Not provided/Not provided → Verified/Verified',
          actual: st(no, 'country') + '/' + st(no, 'age18') + ' → ' + st(yes, 'country') + '/' + st(yes, 'age18')
        };
      }
    },
    {
      id: 'T36', group: 'Simulated verification',
      name: 'A missing required check leaves verification incomplete',
      run: function () {
        var K = window.EDL.kyc;
        var p = window.EDL.data.countryProfile('Africa', 'Kenya');
        var checks = K.personalChecks({ country: 'Kenya', is18: true, kyc: K.defaultPersonalStates() }, p);
        return { expected: 'incomplete', actual: K.kycStatus(checks).status };
      }
    },
    {
      id: 'T37', group: 'Simulated verification',
      name: 'All required checks verified gives a verified status',
      run: function () {
        var K = window.EDL.kyc;
        var p = window.EDL.data.countryProfile('Africa', 'Kenya');
        var form = { country: 'Kenya', is18: true, kyc: {} };
        form.kyc = K.markAll(K.personalChecks(form, p), 'Verified');
        return { expected: 'verified', actual: K.kycStatus(K.personalChecks(form, p)).status };
      }
    },
    {
      id: 'T38', group: 'Simulated verification',
      name: 'A check still in progress reports as pending rather than missing',
      run: function () {
        var K = window.EDL.kyc;
        var p = window.EDL.data.countryProfile('Africa', 'Kenya');
        var form = { country: 'Kenya', is18: true, kyc: {} };
        form.kyc = K.markAll(K.personalChecks(form, p), 'Verified');
        form.kyc = K.setState(form.kyc, 'phoneOwnership', 'Pending');
        var st = K.kycStatus(K.personalChecks(form, p));
        return { expected: 'pending / 1', actual: st.status + ' / ' + st.pending };
      }
    },
    {
      id: 'T39', group: 'Simulated verification',
      name: 'Not applicable is available for a check that is only relevant sometimes',
      run: function () {
        var K = window.EDL.kyc;
        var limited = window.EDL.data.countryProfile('Africa', 'Somalia');   // limited bureau coverage
        var established = window.EDL.data.countryProfile('Africa', 'South Africa');
        function rel(profile, key) {
          return K.personalChecks({ country: 'x', is18: true, kyc: {} }, profile)
            .filter(function (c) { return c.key === key; })[0].relevance;
        }
        return {
          expected: 'optional / required',
          actual: rel(limited, 'nationalIdNumber') + ' / ' + rel(established, 'nationalIdNumber')
        };
      }
    },
    {
      id: 'T40', group: 'Simulated verification',
      name: 'An optional check marked not applicable does not block a verified status',
      run: function () {
        var K = window.EDL.kyc;
        var p = window.EDL.data.countryProfile('Africa', 'Somalia');
        var form = { country: 'Somalia', is18: true, kyc: {} };
        form.kyc = K.markAll(K.personalChecks(form, p), 'Verified');
        form.kyc = K.setState(form.kyc, 'nationalIdNumber', 'Not applicable');
        form.kyc = K.setState(form.kyc, 'addressProof', 'Not applicable');
        return { expected: 'verified', actual: K.kycStatus(K.personalChecks(form, p)).status };
      }
    },
    {
      id: 'T41', group: 'Simulated verification',
      name: 'Country changes the example methods shown but not the verification outcome',
      run: function () {
        var K = window.EDL.kyc, D = window.EDL.data;
        var a = D.countryProfile('Africa', 'Kenya'), b = D.countryProfile('Africa', 'Morocco');
        function methods(p) {
          return K.personalChecks({ country: 'x', is18: true, kyc: {} }, p)
            .filter(function (c) { return c.key === 'accountOwnership'; })[0].methods.join('|');
        }
        var states = K.markAll(K.personalChecks({ country: 'x', is18: true, kyc: {} }, a), 'Verified');
        var sa = K.kycStatus(K.personalChecks({ country: 'x', is18: true, kyc: states }, a)).status;
        var sb = K.kycStatus(K.personalChecks({ country: 'x', is18: true, kyc: states }, b)).status;
        return { expected: 'true / true', actual: (methods(a) !== methods(b)) + ' / ' + (sa === sb) };
      }
    },
    {
      id: 'T42', group: 'Simulated verification',
      name: 'Verification state never changes the lending recommendation',
      run: function () {
        var K = window.EDL.kyc;
        var base = baseForm({ creditHistory: 'Strong', bankConsistency: 'Strong' });
        var unverified = assess(Object.assign({}, base, { kyc: K.defaultPersonalStates() }));
        var verified = assess(Object.assign({}, base, { kyc: K.markAll(K.personalChecks(base, null), 'Verified') }));
        return { expected: unverified.recommendation, actual: verified.recommendation };
      }
    },
    {
      id: 'T43', group: 'Simulated verification',
      name: 'Business verification fields are prepared for the later business journey',
      run: function () {
        var keys = window.EDL.kyc.BUSINESS_CHECKS.map(function (c) { return c.key; }).join(',');
        return {
          expected: 'registrationStatus,registrationDocument,signatoryId,businessAddress,businessAccount,authorityToAct',
          actual: keys
        };
      }
    },
    {
      id: 'T44', group: 'Simulated verification',
      name: 'An informal business is not asked for a registration document',
      run: function () {
        var K = window.EDL.kyc;
        function rel(type, key) {
          return K.businessChecks({ businessType: type, kyc: {} }, null)
            .filter(function (c) { return c.key === key; })[0].relevance;
        }
        return {
          expected: 'not-applicable / optional / required',
          actual: rel('Informal business', 'registrationDocument') + ' / ' +
                  rel('Sole trader', 'registrationDocument') + ' / ' +
                  rel('Registered business', 'registrationDocument')
        };
      }
    },
    {
      id: 'T45', group: 'Simulated verification',
      name: 'A sole owner is not asked for separate authority to act',
      run: function () {
        var K = window.EDL.kyc;
        function check(ctx) {
          return K.businessChecks(ctx, null).filter(function (c) { return c.key === 'authorityToAct'; })[0];
        }
        var owner = check({ businessType: 'Sole trader', applicantIsOwner: true, kyc: {} });
        var agent = check({ businessType: 'Registered business', applicantIsOwner: false, kyc: {} });
        return {
          expected: 'Not applicable / required',
          actual: owner.state + ' / ' + agent.relevance
        };
      }
    }
,
    {
      id: 'T67', group: 'Currency and market configuration',
      name: 'A country maps to its own currency code and symbol',
      run: function () {
        var M = window.EDL.markets;
        var ke = M.currencyForCountry('Kenya'), ng = M.currencyForCountry('Nigeria');
        return { expected: 'KES KSh / NGN ₦', actual: ke.code + ' ' + ke.symbol + ' / ' + ng.code + ' ' + ng.symbol };
      }
    },
    {
      id: 'T68', group: 'Currency and market configuration',
      name: 'Changing country changes the currency an amount is displayed in',
      run: function () {
        var M = window.EDL.markets;
        return {
          expected: 'KSh 12,500 / ₦ 12,500',
          actual: M.money(12500, M.currencyForCountry('Kenya').code) + ' / ' +
                  M.money(12500, M.currencyForCountry('Nigeria').code)
        };
      }
    },
    {
      id: 'T69', group: 'Currency and market configuration',
      name: 'Money formatting is identical wherever it is called from',
      run: function () {
        var v = 987654, code = 'TZS';
        return {
          expected: window.EDL.markets.money(v, code),
          actual: window.EDL.fmt.money(v, code)
        };
      }
    },
    {
      id: 'T70', group: 'Currency and market configuration',
      name: 'No borrower-facing range is expressed in US dollars',
      run: function () {
        var M = window.EDL.markets;
        var all = M.personalProducts('Kenya').concat(M.businessProducts('Kenya'),
          M.personalProducts('Nigeria'), M.businessProducts('Nigeria'));
        var offenders = all.filter(function (p) { return /US\$/.test(p.amountLabel); });
        return { expected: 0, actual: offenders.length };
      }
    },
    {
      id: 'T71', group: 'Rate basis',
      name: 'A monthly rate is not treated as an annual rate',
      run: function () {
        var P = window.EDL.pricing;
        var monthly = P.toMonthlyRate(12, 'monthly');
        var annual = P.toMonthlyRate(12, 'annual');
        return { expected: '0.12 / 0.01', actual: round1(monthly * 100) / 100 + ' / ' + Math.round(annual * 10000) / 10000 };
      }
    },
    {
      id: 'T72', group: 'Rate basis',
      name: 'A daily rate compounds to its monthly equivalent',
      run: function () {
        var r = window.EDL.pricing.toMonthlyRate(0.3, 'daily');
        return { expected: 9.5, actual: Math.round(r * 1000) / 10 };
      }
    },
    {
      id: 'T73', group: 'Rate basis',
      name: 'A flat charge is spread evenly and never compounded',
      run: function () {
        var s = window.EDL.pricing.loanSummary(10000, 10, 10, 'flat');
        return { expected: '1100 / 1000', actual: Math.round(s.monthlyRepayment) + ' / ' + Math.round(s.totalInterest) };
      }
    },
    {
      id: 'T74', group: 'Rate basis',
      name: 'The repayment engine prices a monthly rate above the same annual number',
      run: function () {
        var P = window.EDL.pricing;
        var m = P.loanSummary(100000, 5, 12, 'monthly').monthlyRepayment;
        var a = P.loanSummary(100000, 5, 12, 'annual').monthlyRepayment;
        return { expected: true, actual: m > a };
      }
    },
    {
      id: 'T75', group: 'Rate basis',
      name: 'Every displayed rate carries its basis in words',
      run: function () {
        var M = window.EDL.markets;
        return {
          expected: '4.5% per month / 18% a year / 0.3% per day',
          actual: [M.rateLabel(4.5, 'monthly'), M.rateLabel(18, 'annual'), M.rateLabel(0.3, 'daily')].join(' / ')
        };
      }
    },
    {
      id: 'T76', group: 'Rate basis',
      name: 'An omitted basis defaults to annual rather than being guessed',
      run: function () {
        var s = window.EDL.pricing.loanSummary(50000, 18, 12);
        return { expected: 'annual', actual: s.rateBasis };
      }
    },
    {
      id: 'T77', group: 'Market product ranges',
      name: 'The Nigerian amount and term follow the researched calibration, priced annually',
      run: function () {
        var p = window.EDL.markets.product('personal', 'short-term', 'Nigeria');
        return {
          expected: '2500 / 1000000 / annual / 4 / 5',
          actual: [p.amountMin, p.amountMax, p.rateBasis, p.rateMin, p.rateMax].join(' / ')
        };
      }
    },
    {
      id: 'T78', group: 'Market product ranges',
      name: 'The Kenyan emergency product keeps its short term and the annual rate range',
      run: function () {
        var p = window.EDL.markets.product('personal', 'emergency', 'Kenya');
        return {
          expected: 'annual / 2 / 50000',
          actual: p.rateBasis + ' / ' + p.termMax + ' / ' + p.amountMax
        };
      }
    },
    {
      id: 'T79', group: 'Market product ranges',
      name: 'A market without an override still receives a scaled local range',
      run: function () {
        var p = window.EDL.markets.product('personal', 'salary', 'Ghana');
        return { expected: 'GHS / true', actual: p.currency + ' / ' + (p.amountMax > p.amountMin && p.amountMin > 0) };
      }
    },
    {
      id: 'T80', group: 'Market product ranges',
      name: 'Amounts differ by country while the rate range stays the same everywhere',
      run: function () {
        var M = window.EDL.markets;
        var ke = M.product('business', 'working-capital', 'Kenya');
        var ng = M.product('business', 'working-capital', 'Nigeria');
        return { expected: true, actual: ke.amountMax !== ng.amountMax && ke.rateLabel === ng.rateLabel };
      }
    },
    {
      id: 'T81', group: 'Market product ranges',
      name: 'The business module reads the same configuration as the information view',
      run: function () {
        var B = window.EDL.business, M = window.EDL.markets;
        var r = B.productRange('working-capital', 'NGN', 'Nigeria');
        var m = M.product('business', 'working-capital', 'Nigeria', 'NGN');
        return {
          expected: m.amountLabel + ' | ' + m.rateLabel,
          actual: r.amountLabel + ' | ' + r.rateLabel
        };
      }
    },
    {
      id: 'T82', group: 'Market product ranges',
      name: 'An amount outside the market range is refused instead of assessed',
      run: function () {
        var errs = window.EDL.markets.validateRequest('personal', 'emergency', 'Kenya', 'KES',
          { amount: 400000, term: 2, rate: 4.5 });
        return { expected: 1, actual: errs.length };
      }
    },
    {
      id: 'T83', group: 'Market product ranges',
      name: 'A term outside the market range is refused instead of assessed',
      run: function () {
        var errs = window.EDL.markets.validateRequest('personal', 'emergency', 'Kenya', 'KES',
          { amount: 20000, term: 12, rate: 4.5 });
        return { expected: 1, actual: errs.length };
      }
    },
    {
      id: 'T84', group: 'Market product ranges',
      name: 'A rate outside the market range is refused instead of assessed',
      run: function () {
        var errs = window.EDL.markets.validateRequest('business', 'working-capital', 'Nigeria', 'NGN',
          { amount: 500000, term: 3, rate: 20 });
        return { expected: 1, actual: errs.length };
      }
    },
    {
      id: 'T85', group: 'Market product ranges',
      name: 'An in-range request passes validation with no messages',
      run: function () {
        var errs = window.EDL.markets.validateRequest('business', 'working-capital', 'Kenya', 'KES',
          { amount: 300000, term: 12, rate: 10 });
        return { expected: 0, actual: errs.length };
      }
    },
    {
      id: 'T86', group: 'Market product ranges',
      name: 'Business pricing reads the rate basis from the configuration',
      run: function () {
        var B = window.EDL.business;
        var ng = B.withPricing(bizForm({ country: 'Nigeria', currency: 'NGN', fundingAmount: '500000', termMonths: '3', interestRate: '10' }));
        return { expected: 'annual', actual: ng.pricing.rateBasis };
      }
    },
    {
      id: 'T87', group: 'Market product ranges',
      name: 'Every demonstration profile sits inside its own market configuration',
      run: function () {
        var M = window.EDL.markets;
        var bad = window.EDL.demos.filter(function (d) {
          var f = d.form;
          return M.validateRequest('personal', f.loanProduct, f.country, f.currency,
            { amount: f.loanAmount, term: f.loanTermMonths, rate: f.interestRate }).length > 0;
        });
        return { expected: 0, actual: bad.length };
      }
    }
,
    {
      id: 'T88', group: 'Interest-rate configuration',
      name: 'Every personal product is priced at the one illustrative annual range',
      run: function () {
        var M = window.EDL.markets;
        var bad = [];
        ['Kenya', 'Nigeria', 'Ghana', 'Tanzania'].forEach(function (c) {
          M.personalProducts(c).forEach(function (p) {
            if (p.rateMin !== 4 || p.rateMax !== 5 || p.rateBasis !== 'annual') bad.push(c + ':' + p.id);
          });
        });
        return { expected: 0, actual: bad.length };
      }
    },
    {
      id: 'T89', group: 'Interest-rate configuration',
      name: 'Every business product is priced at the one illustrative annual range',
      run: function () {
        var M = window.EDL.markets;
        var bad = [];
        ['Kenya', 'Nigeria', 'Ghana', 'Tanzania'].forEach(function (c) {
          M.businessProducts(c).forEach(function (p) {
            if (p.rateMin !== 8 || p.rateMax !== 12 || p.rateBasis !== 'annual') bad.push(c + ':' + p.id);
          });
        });
        return { expected: 0, actual: bad.length };
      }
    },
    {
      id: 'T90', group: 'Interest-rate configuration',
      name: 'An annual rate is converted with annualRate / 12 / 100',
      run: function () {
        var P = window.EDL.pricing;
        return { expected: 0.004167, actual: Math.round(P.toMonthlyRate(5, 'annual') * 1e6) / 1e6 };
      }
    },
    {
      id: 'T91', group: 'Interest-rate configuration',
      name: 'A 4% annual loan costs a twelfth of 4% in its first month, not 4%',
      run: function () {
        var s = window.EDL.pricing.loanSummary(120000, 4, 12, 'annual');
        // First month's interest = balance × monthly rate = 120000 × 0.003333
        return { expected: 400, actual: Math.round(120000 * s.monthlyRate) };
      }
    },
    {
      id: 'T92', group: 'Interest-rate configuration',
      name: 'The rate shown on the form, the calculation and the results is one figure',
      run: function () {
        var M = window.EDL.markets, B = window.EDL.business;
        var cfg = M.product('business', 'working-capital', 'Kenya', 'KES');
        var form = bizForm({ interestRate: String(cfg.defaultRate) });
        var pr = B.productRange('working-capital', 'KES', 'Kenya');
        var priced = B.withPricing(form);
        return {
          expected: '10 / 8% – 12% a year / 10% a year',
          actual: cfg.defaultRate + ' / ' + pr.rateLabel + ' / ' + priced.pricing.rateLabel
        };
      }
    },
    {
      id: 'T93', group: 'Interest-rate configuration',
      name: 'The illustrative-pricing wording is still attached to every quote',
      run: function () {
        return {
          expected: true,
          actual: /Illustrative pricing/.test(window.EDL.pricing.PRICING_LABEL) &&
                  /not a live lending rate/.test(window.EDL.pricing.PRICING_LABEL)
        };
      }
    }
  ];

  /**
   * run — executes every test against the DOCUMENTED default thresholds.
   *
   * The examiner sensitivity controls on the Methodology page may have moved
   * the live thresholds, so the suite snapshots them, resets to the documented
   * pair, runs, and restores the snapshot. Tests therefore always validate the
   * rules as written, never a temporarily adjusted variant.
   *
   * OUTPUT: { cases: [{id, group, name, expected, actual, pass, error}],
   *           passed, failed, total, thresholds }
   */
  function run() {
    var snapshot = window.EDL.afford.getThresholds();
    var documented = window.EDL.afford.resetThresholds();
    var usedThresholds = { affordableMax: documented.affordableMax, concernMax: documented.concernMax };

    var cases = TESTS.map(function (t) {
      try {
        var out = t.run();
        return {
          id: t.id, group: t.group, name: t.name,
          expected: String(out.expected), actual: String(out.actual),
          pass: String(out.expected) === String(out.actual), error: ''
        };
      } catch (err) {
        return {
          id: t.id, group: t.group, name: t.name,
          expected: '—', actual: 'threw', pass: false, error: String(err && err.message || err)
        };
      }
    });
    var passed = cases.filter(function (c) { return c.pass; }).length;
    window.EDL.afford.setThresholds(snapshot.affordableMax, snapshot.concernMax);
    return {
      cases: cases, passed: passed, failed: cases.length - passed,
      total: cases.length, thresholds: usedThresholds
    };
  }

  return { run: run, TESTS: TESTS };
})();
