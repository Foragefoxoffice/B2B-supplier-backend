const puppeteer = require('puppeteer');

/**
 * Generate PDF from HTML string
 * @param {string} html - The HTML string to render
 * @returns {Promise<Buffer>} - The generated PDF buffer
 */
exports.generatePdf = async (html) => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    // Set content and wait until network is idle so images load
    await page.setContent(html, { waitUntil: 'networkidle2' });

    // Generate PDF buffer
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        bottom: '20px',
        left: '20px',
        right: '20px'
      }
    });

    return pdfBuffer;
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  } finally {
    await browser.close();
  }
};
