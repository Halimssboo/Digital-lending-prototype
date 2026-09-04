/**
 * kyc.js — simulated identity and business verification.
 *
 * PURPOSE
 *   Models the verification steps a lender would carry out before an offer,
 *   as a reusable module shared by the Personal journey (built) and the later
 *   Business journey (fields prepared here, journey not yet built).
 *
 * SIMULATION ONLY — no identity data of any kind
 *   This module records a VERIFICATION STATE per check and nothing else. It
 *   never asks for, receives, validates, transmits or stores a document, an
 *   image, a national identity number, a phone number or an account number.
 *   The only values it holds are the four synthetic states below.
 *
 * FAIRNESS
 *   Country changes which EXAMPLE verification methods are displayed and
 *   whether an optional check is relevant. It never changes a verification
 *   state, never changes the affordability arithmetic and never reaches the
 *   decision rules: kycStatus() output is presentational and is deliberately
 *   not an input to window.EDL.assess.
 *
 * INPUTS  : borrower form object, country profile (app/countries.js)
 * OUTPUTS : check descriptors with states, and a summary status object
 */
window.EDL = window.EDL || {};

window.EDL.kyc = (function () {
  var SIMULATION_LABEL = 'Simulated verification – no identity documents or numbers are collected';

  var VERIFIED = 'Verified', PENDING = 'Pending',
      NOT_PROVIDED = 'Not provided', NOT_APPLICABLE = 'Not applicable';
  var STATES = [VERIFIED, PENDING, NOT_PROVIDED, NOT_APPLICABLE];

  /** normaliseState — any unrecognised value becomes 'Not provided'. */
  function normaliseState(value) {
    return STATES.indexOf(value) === -1 ? NOT_PROVIDED : value;
  }

  // ---------------------------------------------------------------- personal

  /**
   * PERSONAL_CHECKS — the personal verification set.
   *   key       : stable identifier, also the key in form.kyc
   *   auto      : state is derived from earlier answers, not chosen here
   *   relevance : function(profile) -> 'required' | 'optional' | 'not-applicable'
   *   methods   : function(profile) -> array of illustrative example methods
   */
  var PERSONAL_CHECKS = [
    {
      key: 'country', auto: true,
      label: 'Country of residence',
      help: 'Taken from the country you selected. It sets which verification methods are shown, nothing else.',
      relevance: function () { return 'required'; },
      methods: function () { return ['Country selected in this application']; }
    },
    {
      key: 'age18', auto: true,
      label: 'Age 18 or over',
      help: 'Taken from your confirmation earlier in the application.',
      relevance: function () { return 'required'; },
      methods: function () { return ['Self-declared confirmation', 'Date of birth on a government-issued ID']; }
    },
    {
      key: 'governmentId',
      label: 'Government-issued ID',
      help: 'A simulated check that an accepted identity document exists. No document is uploaded.',
      relevance: function () { return 'required'; },
      methods: function (p) {
        if (!p) return ['National ID card', 'Passport'];
        if (p.bureau === 'Established') return ['National ID card', 'Passport', 'Residence permit'];
        return ['National ID card or equivalent', 'Passport', 'Voter registration card'];
      }
    },
    {
      key: 'nationalIdNumber',
      label: 'National identity number',
      help: 'Where the market operates a national identity number. Only a verification state is recorded — the number itself is never requested or stored.',
      // Illustrative prototype assumption: markets with established or
      // developing bureau coverage are treated as operating a national
      // identity number; elsewhere the check is optional. Not a legal fact.
      relevance: function (p) { return !p ? 'optional' : p.bureau === 'Limited' ? 'optional' : 'required'; },
      methods: function () { return ['Match against a national identity register', 'Recorded as not applicable where no scheme applies']; }
    },
    {
      key: 'phoneOwnership',
      label: 'Phone-number ownership',
      help: 'A simulated check that the stated number belongs to you.',
      relevance: function () { return 'required'; },
      methods: function (p) {
        var m = ['One-time code to the stated number', 'SIM registered in the applicant’s name'];
        if (p && (p.mobileMoney === 'Very high' || p.mobileMoney === 'High')) m.push('Match against the wallet-registered number');
        return m;
      }
    },
    {
      key: 'accountOwnership',
      label: 'Bank or mobile-money account ownership',
      help: 'A simulated name-match on an account you already hold. No account details are collected.',
      relevance: function () { return 'required'; },
      methods: function (p) {
        var mmCommon = p && (p.mobileMoney === 'Very high' || p.mobileMoney === 'High');
        return mmCommon
          ? ['Mobile-money wallet in the applicant’s name', 'Bank account name match where an account is held']
          : ['Bank account name match', 'Mobile-money wallet in the applicant’s name where held'];
      }
    },
    {
      key: 'addressProof',
      label: 'Proof of address',
      help: 'Where formal address records exist. Recorded as not applicable where they do not.',
      relevance: function (p) { return !p ? 'optional' : p.bureau === 'Established' ? 'required' : 'optional'; },
      methods: function () { return ['Utility bill', 'Bank or wallet statement', 'Letter from a landlord or local authority']; }
    }
  ];

  // ---------------------------------------------------------------- business

  /**
   * BUSINESS_CHECKS — prepared for the later Business journey. Relevance reads
   * a business context object: { businessType, applicantIsOwner }.
   * businessType: 'Registered business' | 'Sole trader' | 'Informal business'
   */
  /**
   * Business-type families. The journey offers four types; registration
   * relevance depends on which family a type belongs to, not on its exact
   * wording, so new labels can be added without touching the rules.
   */
  function isRegistered(type) { return /registered business/i.test(type || ''); }
  function isInformal(type) { return /informal|self-employed/i.test(type || ''); }

  var BUSINESS_CHECKS = [
    {
      key: 'registrationStatus',
      label: 'Business registration status',
      help: 'Whether the business is formally registered. Informality is not a barrier to applying.',
      relevance: function () { return 'required'; },
      methods: function () { return ['Registered', 'Sole trader', 'Informal or unregistered']; }
    },
    {
      key: 'registrationDocument',
      label: 'Registration document or number',
      help: 'Where the business is registered. Only a verification state is recorded.',
      relevance: function (p, ctx) {
        var t = ctx && ctx.businessType;
        if (!t) return 'optional';
        if (isRegistered(t)) return 'required';
        // An informal or self-employed trader is never asked for a corporate
        // registration document that does not exist for them.
        if (isInformal(t)) return 'not-applicable';
        return 'optional';
      },
      methods: function () { return ['Match against a business register', 'Certificate of incorporation', 'Trading licence']; }
    },
    {
      key: 'signatoryId',
      label: 'Owner, director or authorised signatory ID',
      help: 'A simulated identity check on the person applying for the business.',
      relevance: function () { return 'required'; },
      methods: function () { return ['National ID card or equivalent', 'Passport']; }
    },
    {
      key: 'businessAddress',
      label: 'Proof of business address',
      help: 'Where a fixed trading address exists.',
      relevance: function (p, ctx) {
        return isInformal(ctx && ctx.businessType) ? 'optional' : 'required';
      },
      methods: function () { return ['Utility bill for the premises', 'Lease or rates notice', 'Market or trading-place permit']; }
    },
    {
      key: 'businessAccount',
      label: 'Business bank or mobile-money account ownership',
      help: 'A simulated name-match on an account the business already uses.',
      relevance: function () { return 'required'; },
      methods: function (p) {
        var mmCommon = p && (p.mobileMoney === 'Very high' || p.mobileMoney === 'High');
        return mmCommon
          ? ['Business or personal-trading wallet name match', 'Business bank account name match']
          : ['Business bank account name match', 'Trading wallet name match where used'];
      }
    },
    {
      key: 'authorityToAct',
      label: 'Authority to act for the business',
      help: 'Whether the applicant may borrow on the business’s behalf. Not applicable where they are the sole owner.',
      relevance: function (p, ctx) {
        return ctx && ctx.applicantIsOwner ? 'not-applicable' : 'required';
      },
      methods: function () { return ['Board or partner resolution', 'Signatory mandate held by the account provider', 'Sole-owner declaration']; }
    }
  ];

  // ------------------------------------------------------------------ engine

  var RELEVANCE_LABEL = {
    'required': 'Required',
    'optional': 'Where relevant',
    'not-applicable': 'Not applicable in this case'
  };

  /** defaultStates — every editable check in a set, at 'Not provided'. */
  function defaultStates(checks) {
    var out = {};
    checks.forEach(function (c) { if (!c.auto) out[c.key] = NOT_PROVIDED; });
    return out;
  }
  function defaultPersonalStates() { return defaultStates(PERSONAL_CHECKS); }
  function defaultBusinessStates() { return defaultStates(BUSINESS_CHECKS); }

  /** Derived states for the personal auto checks. INPUT: form. */
  function autoState(key, form) {
    if (key === 'country') return form && form.country ? VERIFIED : NOT_PROVIDED;
    if (key === 'age18') return form && form.is18 ? VERIFIED : NOT_PROVIDED;
    return NOT_PROVIDED;
  }

  /**
   * buildChecks — resolves a check set against a form, a country profile and an
   * optional business context.
   * OUTPUT: [{ key, label, help, auto, relevance, relevanceLabel, required,
   *            applicable, methods, state, options }]
   *   options is the list of states the interface may offer for that check.
   */
  function buildChecks(checks, states, profile, form, ctx) {
    return checks.map(function (c) {
      var relevance = c.relevance(profile, ctx);
      var applicable = relevance !== 'not-applicable';
      var required = relevance === 'required';
      var state = c.auto
        ? autoState(c.key, form)
        : !applicable ? NOT_APPLICABLE : normaliseState(states ? states[c.key] : undefined);
      return {
        key: c.key, label: c.label, help: c.help, auto: !!c.auto,
        relevance: relevance, relevanceLabel: RELEVANCE_LABEL[relevance],
        required: required, applicable: applicable,
        methods: c.methods(profile, ctx),
        state: state,
        options: required ? [VERIFIED, PENDING, NOT_PROVIDED] : STATES.slice()
      };
    });
  }

  function personalChecks(form, profile) {
    return buildChecks(PERSONAL_CHECKS, form && form.kyc, profile, form, null);
  }
  function businessChecks(businessCtx, profile) {
    return buildChecks(BUSINESS_CHECKS, businessCtx && businessCtx.kyc, profile,
      null, businessCtx || {});
  }

  /**
   * kycStatus — summary of a resolved check list.
   * OUTPUT: { status, label, note, verified, pending, outstanding[],
   *           requiredTotal, complete }
   *   status: 'verified'  every required check verified
   *           'pending'   nothing missing, something still in progress
   *           'incomplete' a required check is missing
   * PRESENTATIONAL ONLY — never an input to the lending decision.
   */
  function kycStatus(checks) {
    var required = checks.filter(function (c) { return c.required; });
    var outstanding = required.filter(function (c) {
      return c.state !== VERIFIED && c.state !== PENDING;
    }).map(function (c) { return c.label; });
    var pending = required.filter(function (c) { return c.state === PENDING; }).length;
    var verified = checks.filter(function (c) { return c.state === VERIFIED; }).length;

    var status = outstanding.length ? 'incomplete' : pending ? 'pending' : 'verified';
    return {
      status: status,
      label: {
        verified: 'Identity verified',
        pending: 'Verification in progress',
        incomplete: 'Verification incomplete'
      }[status],
      note: {
        verified: 'Every required check is simulated as verified.',
        pending: 'Nothing is missing. Some checks are simulated as still in progress.',
        incomplete: 'Outstanding: ' + outstanding.join(', ') + '.'
      }[status],
      verified: verified, pending: pending, outstanding: outstanding,
      requiredTotal: required.length,
      complete: status === 'verified'
    };
  }

  /** setState — immutable update of one check state. OUTPUT: new states object. */
  function setState(states, key, value) {
    var next = Object.assign({}, states || {});
    next[key] = normaliseState(value);
    return next;
  }

  /** markAll — sets every editable, applicable check in a resolved list. */
  function markAll(checks, value) {
    var out = {};
    checks.forEach(function (c) {
      if (c.auto) return;
      out[c.key] = c.applicable ? normaliseState(value) : NOT_APPLICABLE;
    });
    return out;
  }

  return {
    SIMULATION_LABEL: SIMULATION_LABEL,
    STATES: STATES,
    VERIFIED: VERIFIED, PENDING: PENDING,
    NOT_PROVIDED: NOT_PROVIDED, NOT_APPLICABLE: NOT_APPLICABLE,
    PERSONAL_CHECKS: PERSONAL_CHECKS,
    BUSINESS_CHECKS: BUSINESS_CHECKS,
    normaliseState: normaliseState,
    defaultPersonalStates: defaultPersonalStates,
    defaultBusinessStates: defaultBusinessStates,
    personalChecks: personalChecks,
    businessChecks: businessChecks,
    kycStatus: kycStatus,
    setState: setState,
    markAll: markAll
  };
})();
