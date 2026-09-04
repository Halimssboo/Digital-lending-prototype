/**
 * demo-applicants.js — synthetic demonstration profiles.
 *
 * PURPOSE
 *   Five fictional applicants covering all four possible recommendation paths.
 *   Every figure is invented for demonstration. These are not real people and
 *   no real borrower data is held in this prototype.
 *
 *   All five are African-market applicants: the borrower-facing journeys serve
 *   African markets only.
 *
 *   Each profile names the market product it is applying for and the basis of
 *   its quoted rate, so every demonstration request sits inside the selected
 *   country's illustrative configuration.
 *
 * OUTPUT : array of { id, name, summary, form }
 */
window.EDL = window.EDL || {};

window.EDL.demos = [
  {
    id: 'ghana-salaried',
    name: 'Applicant A — demo',
    summary: 'Salaried borrower in Ghana with a full credit file and stable income.',
    form: {
      region: 'Africa', country: 'Ghana', currency: 'GHS', is18: true,
      employmentType: 'Salaried', monthlyIncome: '6500', incomeRegularity: 'Stable',
      loanProduct: 'salary', loanAmount: '15000', loanTermMonths: '24', existingDebt: '400',
      interestRate: '4.5', rateBasis: 'annual', essentialExpenses: '2500',
      creditHistory: 'Strong', bankConsistency: 'Strong', utilityPayments: 'Good',
      mobileMoney: 'Moderate'
    }
  },
  {
    id: 'south-africa-overcommitted',
    name: 'Applicant B — demo',
    summary: 'Salaried borrower in South Africa carrying high existing commitments.',
    form: {
      region: 'Africa', country: 'South Africa', currency: 'ZAR', is18: true,
      employmentType: 'Salaried', monthlyIncome: '22000', incomeRegularity: 'Stable',
      loanProduct: 'salary', loanAmount: '90000', loanTermMonths: '24', existingDebt: '8500',
      interestRate: '4.5', rateBasis: 'annual', essentialExpenses: '9000',
      creditHistory: 'Moderate', bankConsistency: 'Strong', utilityPayments: 'Good',
      mobileMoney: 'Unavailable'
    }
  },
  {
    id: 'kenya-thin-file',
    name: 'Applicant C — demo',
    summary: 'Self-employed borrower in Kenya with no credit file but strong mobile-money and bill history.',
    form: {
      region: 'Africa', country: 'Kenya', currency: 'KES', is18: true,
      employmentType: 'Self-employed', monthlyIncome: '65000', incomeRegularity: 'Mostly stable',
      loanProduct: 'salary', loanAmount: '120000', loanTermMonths: '18', existingDebt: '3000',
      interestRate: '5', rateBasis: 'annual', essentialExpenses: '30000',
      creditHistory: 'Unavailable', bankConsistency: 'Unavailable', utilityPayments: 'Good',
      mobileMoney: 'Strong'
    }
  },
  {
    id: 'nigeria-irregular',
    name: 'Applicant D — demo',
    summary: 'Informal-income borrower in Nigeria with irregular earnings and affordability concerns.',
    form: {
      region: 'Africa', country: 'Nigeria', currency: 'NGN', is18: true,
      employmentType: 'Informal income', monthlyIncome: '180000', incomeRegularity: 'Irregular',
      loanProduct: 'salary', loanAmount: '400000', loanTermMonths: '12', existingDebt: '45000',
      interestRate: '5', rateBasis: 'annual', essentialExpenses: '90000',
      creditHistory: 'Unavailable', bankConsistency: 'Weak', utilityPayments: 'Mixed',
      mobileMoney: 'Moderate'
    }
  },
  {
    id: 'tanzania-overreach',
    name: 'Applicant E — demo',
    summary: 'Salaried borrower in Tanzania with good records asking for slightly more than the band allows.',
    form: {
      region: 'Africa', country: 'Tanzania', currency: 'TZS', is18: true,
      employmentType: 'Salaried', monthlyIncome: '1600000', incomeRegularity: 'Stable',
      loanProduct: 'salary', loanAmount: '11000000', loanTermMonths: '24', existingDebt: '90000',
      interestRate: '4.5', rateBasis: 'annual', essentialExpenses: '600000',
      creditHistory: 'Moderate', bankConsistency: 'Strong', utilityPayments: 'Good',
      mobileMoney: 'Moderate'
    }
  }
];
