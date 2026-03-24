const asyncTryCatch = (asyncFn) => async (req, res, next) => {
    try {
      await asyncFn(req, res, next);
    } catch (error) {
      console.error("Error caught in asyncTryCatch:", error);
      res.status(500).json({ message: error.message });
    }
  };
  
module.exports = asyncTryCatch;