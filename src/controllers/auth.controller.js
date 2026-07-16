const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../config/db');
const nodemailer = require('nodemailer');
const { createTransporter } = require('../utils/email');
const { sendNotificationToUser } = require('../services/notification.service');

const generateToken = (id, role, supplier_id, password) => {
  const passwordSig = password ? password.substring(0, 10) : '';
  return jwt.sign({ id, role, supplier_id, passwordSig }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide an email and password' });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { role: true, supplier: true },
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ success: false, message: 'Account is not active' });
    }

    const token = generateToken(user.id, user.role.name, user.supplier_id, user.password);

    await prisma.activityLog.create({
      data: {
        user_id: user.id,
        action: 'LOGIN',
        module: 'Auth',
        details: 'User logged in successfully'
      }
    });

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        role: user.role.name,
        supplier_id: user.supplier_id,
        company_name: user.supplier ? user.supplier.name : null,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getMe = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        email: true,
        phone: true,
        role: true,
        supplier_id: true,
        supplier: {
          select: {
            name: true,
          }
        }
      },
    });

    const userData = {
      ...user,
      company_name: user.supplier ? user.supplier.name : null
    };
    delete userData.supplier;

    res.status(200).json({ success: true, data: userData });
  } catch (error) {
    next(error);
  }
};

exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Please provide an email' });
    }

    const user = await prisma.user.findUnique({ 
      where: { email },
      include: { role: true }
    });
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.role.name !== 'SUPPLIER') {
      return res.status(403).json({ success: false, message: 'Only supplier accounts can reset passwords through this portal.' });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ success: false, message: 'Your account is not active. Please contact support.' });
    }

    // Generate 6 digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    await prisma.user.update({
      where: { email },
      data: {
        reset_otp: otp,
        reset_otp_expires_at: expiresAt,
      },
    });

    // Attempt to send email
    const transporter = createTransporter();
    
    if (transporter) {
      try {
        await transporter.sendMail({
          from: `"B2B Supplier Portal" <${process.env.SMTP_USER}>`,
          to: email,
          subject: 'Your Password Reset OTP',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
              <h2 style="color: #1e3a8a; text-align: center;">Password Reset Request</h2>
              <p style="color: #334155; font-size: 16px;">Hello ${user.first_name},</p>
              <p style="color: #334155; font-size: 16px;">We received a request to reset your password. Here is your One Time Password (OTP):</p>
              <div style="background-color: #f1f5f9; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #2563eb;">${otp}</span>
              </div>
              <p style="color: #334155; font-size: 14px;">This OTP is valid for 10 minutes. Do not share this code with anyone.</p>
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
              <p style="color: #64748b; font-size: 12px; text-align: center;">If you didn't request a password reset, you can safely ignore this email.</p>
            </div>
          `,
        });
        console.log(`OTP sent to ${email} via email.`);
      } catch (emailError) {
        console.error("Error sending email:", emailError);
        // Fallback to console if email fails
        console.log(`\n=========================================`);
        console.log(`OTP for ${email}: ${otp}`);
        console.log(`=========================================\n`);
      }
    } else {
      // Fallback to console if not configured
      console.log(`\n=========================================`);
      console.log(`SMTP NOT CONFIGURED - OTP for ${email}: ${otp}`);
      console.log(`=========================================\n`);
    }

    res.status(200).json({ success: true, message: 'OTP sent to your email' });
  } catch (error) {
    next(error);
  }
};

exports.verifyOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Please provide email and OTP' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.reset_otp !== otp || user.reset_otp_expires_at < new Date()) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    res.status(200).json({ success: true, message: 'OTP verified successfully' });
  } catch (error) {
    next(error);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ success: false, message: 'Please provide email, OTP, and new password' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.reset_otp !== otp || user.reset_otp_expires_at < new Date()) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { email },
      data: {
        password: hashedPassword,
        reset_otp: null,
        reset_otp_expires_at: null,
      },
    });

    res.status(200).json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    next(error);
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Please provide current and new passwords' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid current password' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashedPassword },
    });

    await prisma.activityLog.create({
      data: {
        user_id: req.user.id,
        action: 'CHANGE_PASSWORD',
        module: 'Auth',
        details: 'User changed their password'
      }
    });

    await sendNotificationToUser(
      req.user.id, 
      'Password Changed', 
      'Your password was successfully updated.', 
      'SYSTEM'
    );

    res.status(200).json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const { first_name, last_name, phone } = req.body;

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        first_name,
        last_name,
        phone,
      },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        email: true,
        phone: true,
        role: { select: { name: true } },
        supplier_id: true,
        supplier: { select: { name: true } }
      }
    });

    const userData = {
      ...user,
      role: user.role.name,
      company_name: user.supplier ? user.supplier.name : null
    };
    delete userData.supplier;

    await prisma.activityLog.create({
      data: {
        user_id: req.user.id,
        action: 'UPDATE_PROFILE',
        module: 'Auth',
        details: 'User updated their profile'
      }
    });

    await sendNotificationToUser(
      req.user.id, 
      'Profile Updated', 
      'Your profile details were successfully updated.', 
      'SYSTEM'
    );

    res.status(200).json({ success: true, message: 'Profile updated successfully', data: userData });
  } catch (error) {
    next(error);
  }
};
