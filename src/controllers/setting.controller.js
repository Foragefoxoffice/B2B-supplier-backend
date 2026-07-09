const prisma = require('../config/db');

exports.getSettings = async (req, res, next) => {
  try {
    const settings = await prisma.setting.findMany();
    
    // Convert array of {key, value} to an object {key: value} for easier frontend consumption
    const settingsObj = {};
    settings.forEach(s => {
      settingsObj[s.key] = s.value;
    });

    res.status(200).json({ success: true, data: settingsObj });
  } catch (error) {
    next(error);
  }
};

exports.updateSettings = async (req, res, next) => {
  try {
    const data = req.body; // Expecting an object of { key: value }

    // Use a transaction to perform upserts
    const transaction = Object.keys(data).map(key => {
      return prisma.setting.upsert({
        where: { key },
        update: { value: String(data[key]) },
        create: { key, value: String(data[key]) }
      });
    });

    await prisma.$transaction(transaction);

    res.status(200).json({ success: true, message: 'Settings updated successfully' });
  } catch (error) {
    next(error);
  }
};
