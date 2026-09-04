/**
 * countries.js — market and country reference data.
 *
 * PURPOSE
 *   Supplies the country list used by the borrower assessment forms and an
 *   illustrative note about each market's financial-data landscape. The
 *   prototype's borrower journeys are for African markets only.
 *
 * IMPORTANT (fairness):
 *   Region and country are used ONLY to decide which financial data types are
 *   offered and how they are emphasised in the interface. They are never an
 *   input to the affordability calculation or to the recommendation, so no
 *   applicant is scored better or worse because of where they live.
 *
 * DATA MODEL
 *   Each country is stored as a compact tuple and expanded into an object:
 *     [ name, currencyCode, bureauCoverage, mobileMoneyUsage ]
 *   bureauCoverage    : 'Established' | 'Developing' | 'Limited'
 *   mobileMoneyUsage  : 'Very high' | 'High' | 'Moderate' | 'Limited'
 *   These are broad illustrative categories for the prototype, not measured
 *   statistics, and the interface labels them as such.
 *
 * INPUTS  : region name ("Africa"), country name
 * OUTPUTS : arrays of country objects, a single country object, or a note string
 */
window.EDL = window.EDL || {};

window.EDL.data = (function () {
  /** Expands a tuple into a named object. INPUT: tuple. OUTPUT: country object. */
  function toCountry(t) {
    return { name: t[0], currency: t[1], bureau: t[2], mobileMoney: t[3] };
  }

  // All 54 African member states. Coverage categories differ markedly across
  // the continent, which is the point: the region is not treated as uniform.
  var AFRICA_TUPLES = [
    ['Algeria', 'DZD', 'Developing', 'Limited'],
    ['Angola', 'AOA', 'Developing', 'Moderate'],
    ['Benin', 'XOF', 'Limited', 'High'],
    ['Botswana', 'BWP', 'Established', 'Moderate'],
    ['Burkina Faso', 'XOF', 'Limited', 'High'],
    ['Burundi', 'BIF', 'Limited', 'Moderate'],
    ['Cabo Verde', 'CVE', 'Developing', 'Moderate'],
    ['Cameroon', 'XAF', 'Developing', 'High'],
    ['Central African Republic', 'XAF', 'Limited', 'Limited'],
    ['Chad', 'XAF', 'Limited', 'Moderate'],
    ['Comoros', 'KMF', 'Limited', 'Moderate'],
    ['Congo, Republic of the', 'XAF', 'Limited', 'Moderate'],
    ['Côte d’Ivoire', 'XOF', 'Developing', 'Very high'],
    ['Democratic Republic of the Congo', 'CDF', 'Limited', 'High'],
    ['Djibouti', 'DJF', 'Limited', 'Moderate'],
    ['Egypt', 'EGP', 'Established', 'Moderate'],
    ['Equatorial Guinea', 'XAF', 'Limited', 'Limited'],
    ['Eritrea', 'ERN', 'Limited', 'Limited'],
    ['Eswatini', 'SZL', 'Developing', 'High'],
    ['Ethiopia', 'ETB', 'Developing', 'High'],
    ['Gabon', 'XAF', 'Developing', 'High'],
    ['Gambia', 'GMD', 'Limited', 'Moderate'],
    ['Ghana', 'GHS', 'Developing', 'Very high'],
    ['Guinea', 'GNF', 'Limited', 'High'],
    ['Guinea-Bissau', 'XOF', 'Limited', 'Moderate'],
    ['Kenya', 'KES', 'Developing', 'Very high'],
    ['Lesotho', 'LSL', 'Developing', 'High'],
    ['Liberia', 'LRD', 'Limited', 'High'],
    ['Libya', 'LYD', 'Limited', 'Limited'],
    ['Madagascar', 'MGA', 'Limited', 'High'],
    ['Malawi', 'MWK', 'Developing', 'High'],
    ['Mali', 'XOF', 'Limited', 'High'],
    ['Mauritania', 'MRU', 'Limited', 'Moderate'],
    ['Mauritius', 'MUR', 'Established', 'Moderate'],
    ['Morocco', 'MAD', 'Established', 'Moderate'],
    ['Mozambique', 'MZN', 'Developing', 'High'],
    ['Namibia', 'NAD', 'Established', 'Moderate'],
    ['Niger', 'XOF', 'Limited', 'Moderate'],
    ['Nigeria', 'NGN', 'Developing', 'High'],
    ['Rwanda', 'RWF', 'Developing', 'High'],
    ['São Tomé and Príncipe', 'STN', 'Limited', 'Limited'],
    ['Senegal', 'XOF', 'Developing', 'Very high'],
    ['Seychelles', 'SCR', 'Developing', 'Moderate'],
    ['Sierra Leone', 'SLE', 'Limited', 'High'],
    ['Somalia', 'SOS', 'Limited', 'Very high'],
    ['South Africa', 'ZAR', 'Established', 'Moderate'],
    ['South Sudan', 'SSP', 'Limited', 'Moderate'],
    ['Sudan', 'SDG', 'Limited', 'Moderate'],
    ['Tanzania', 'TZS', 'Developing', 'Very high'],
    ['Togo', 'XOF', 'Limited', 'High'],
    ['Tunisia', 'TND', 'Established', 'Moderate'],
    ['Uganda', 'UGX', 'Developing', 'Very high'],
    ['Zambia', 'ZMW', 'Developing', 'High'],
    ['Zimbabwe', 'ZWG', 'Developing', 'High']
  ];

  var AFRICA_COUNTRIES = AFRICA_TUPLES.map(toCountry);

  // The borrower-facing journeys serve African markets only. GCC practice
  // informs the design rationale (see the About page) and is deliberately not
  // selectable as a borrower region or present in any demonstration profile.
  var REGIONS = ['Africa'];

  /** Returns the country list for a region. INPUT: region name. OUTPUT: array. */
  function countriesForRegion(region) {
    if (region === 'Africa') return AFRICA_COUNTRIES;
    return [];
  }

  /** Looks up one country. INPUT: region, country name. OUTPUT: object or null. */
  function countryProfile(region, name) {
    var list = countriesForRegion(region);
    for (var i = 0; i < list.length; i++) if (list[i].name === name) return list[i];
    return null;
  }

  /**
   * marketNote — composes the interface note for a country from its coverage
   * categories, so no country-specific claim is invented.
   * INPUT : country object. OUTPUT: sentence string.
   */
  function marketNote(country) {
    if (!country) return '';
    var bureau = {
      'Established': 'Conventional credit bureau coverage is comparatively established here',
      'Developing': 'Conventional credit bureau coverage is developing here and is uneven outside formal employment',
      'Limited': 'Conventional credit bureau coverage is limited here, so many creditworthy adults have no file'
    }[country.bureau];
    var mm = {
      'Very high': 'mobile-money usage is very high',
      'High': 'mobile-money usage is high',
      'Moderate': 'mobile-money usage is moderate',
      'Limited': 'mobile-money usage is limited'
    }[country.mobileMoney];
    return bureau + ', and ' + mm + '. Illustrative market context only; it changes which data sources the form offers, never the assessment thresholds or the outcome.';
  }

  /**
   * sourceContext — presentation-only guidance on which data sources are worth
   * emphasising for a selected country.
   *
   * All four sources are always offered, in every market: neither region is
   * homogeneous and common financial data may exist in either. This function
   * only decides ordering and the small context label shown beside a source.
   * It is never consulted by the affordability calculation or the decision
   * rules, so it cannot change a recommendation.
   *
   * INPUT : country object (or null before a country is chosen)
   * OUTPUT: { <signalKey>: { emphasis: boolean, label: string } }
   */
  function sourceContext(country) {
    var established = country ? country.bureau === 'Established' : false;
    var thinBureau = country ? country.bureau === 'Limited' : false;
    var mm = country ? country.mobileMoney : '';
    var mmCommon = mm === 'Very high' || mm === 'High';

    return {
      creditHistory: {
        emphasis: established,
        label: !country ? '' : established
          ? 'Commonly available in this market'
          : thinBureau
            ? 'Often unavailable in this market'
            : 'Available for some borrowers in this market'
      },
      bankConsistency: {
        emphasis: established,
        label: !country ? '' : established
          ? 'Commonly available in this market'
          : 'Available where the applicant holds a formal account'
      },
      utilityPayments: {
        emphasis: !established,
        label: !country ? '' : established
          ? 'Supporting evidence'
          : 'Useful where conventional records are thin'
      },
      mobileMoney: {
        emphasis: mmCommon,
        label: !country ? 'Optional — only where the applicant holds a wallet' : mmCommon
          ? 'Optional — mobile money is widely used in this market'
          : 'Optional — mobile money is less common in this market'
      }
    };
  }

  return {
    REGIONS: REGIONS,
    AFRICA_COUNTRIES: AFRICA_COUNTRIES,
    countriesForRegion: countriesForRegion,
    countryProfile: countryProfile,
    marketNote: marketNote,
    sourceContext: sourceContext
  };
})();
