// services/PaymentOptionsService.js
// Returns hardcoded GCash / Bank details from environment variables.

class PaymentOptionsService {
  getPaymentOptions() {
    return {
      success: true,
      data: {
        gcash: {
          method: 'gcash',
          label: 'GCash',
          accountName: process.env.GCASH_ACCOUNT_NAME || '',
          accountNumber: process.env.GCASH_ACCOUNT_NUMBER || '',
        },
        bank_transfer: {
          method: 'bank_transfer',
          label: 'Bank Transfer',
          bankName: process.env.BANK_NAME || '',
          accountName: process.env.BANK_ACCOUNT_NAME || '',
          accountNumber: process.env.BANK_ACCOUNT_NUMBER || '',
        },
      },
    };
  }

  /**
   * Resolve the account fields for a given method.
   * @param {'gcash'|'bank_transfer'} method
   */
  resolveAccountFor(method) {
    if (method === 'gcash') {
      return {
        accountName: process.env.GCASH_ACCOUNT_NAME || '',
        accountNumber: process.env.GCASH_ACCOUNT_NUMBER || '',
        bankName: '',
      };
    }
    if (method === 'bank_transfer') {
      return {
        accountName: process.env.BANK_ACCOUNT_NAME || '',
        accountNumber: process.env.BANK_ACCOUNT_NUMBER || '',
        bankName: process.env.BANK_NAME || '',
      };
    }
    return null;
  }
}

module.exports = new PaymentOptionsService();