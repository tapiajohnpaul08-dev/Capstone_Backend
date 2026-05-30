const generateUniversalId = async (prefix) => {
    try {
      const chars = '0123456789';
      let id = '';
      for (let i = 0; i < 4; i++) {
        id += chars[Math.floor(Math.random() * chars.length)];
      }
      return `${prefix}-${id}`;
    } catch (error) {
      return error;
    }
  };
  
  module.exports = generateUniversalId;
  