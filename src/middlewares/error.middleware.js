const fs = require('fs');
const errorHandler = (err, req, res, next) => {
  console.error(err);
  try {
    const errorLog = new Date().toISOString() + '\\n' + 
      (err.stack || '') + '\\n' + 
      (err.message || '') + '\\n' + 
      JSON.stringify(err) + '\\n\\n';
    fs.appendFileSync('error_debug.log', errorLog);
  } catch (e) {}
  const status = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(status).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
