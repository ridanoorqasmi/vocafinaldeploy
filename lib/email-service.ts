import nodemailer from 'nodemailer';
import { EMAIL_CONFIG } from './auth-types';

// ===== EMAIL SERVICE =====

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string; // Optional sender email address
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private defaultSmtpUser: string | null = null;
  private defaultSmtpPass: string | null = null;

  constructor() {
    // Initialize transporter lazily - will be created when first email is sent
    // This allows using sender email from rule as SMTP user if EMAIL_SMTP_USER is not set
    this.defaultSmtpUser = process.env.EMAIL_SMTP_USER || null;
    this.defaultSmtpPass = process.env.EMAIL_SMTP_PASS || null;
    
    // Create transporter only if credentials are available
    if (this.defaultSmtpUser && this.defaultSmtpPass) {
      this.transporter = nodemailer.createTransport({
        host: process.env.EMAIL_SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.EMAIL_SMTP_PORT || '587'),
        secure: false, // true for 465, false for other ports
        auth: {
          user: this.defaultSmtpUser,
          pass: this.defaultSmtpPass,
        },
      });
    }
  }

  /**
   * Get or create transporter with appropriate credentials
   * If sender email is provided and different from default, use it as SMTP user
   */
  private getTransporter(senderEmail?: string): nodemailer.Transporter {
    const smtpHost = process.env.EMAIL_SMTP_HOST || 'smtp.gmail.com';
    const smtpPort = parseInt(process.env.EMAIL_SMTP_PORT || '587');
    const smtpPass = this.defaultSmtpPass || process.env.EMAIL_SMTP_PASS;
    
    // Determine SMTP user: use sender email if provided and default is not set, otherwise use default
    const smtpUser = this.defaultSmtpUser || senderEmail || process.env.EMAIL_SMTP_USER;
    
    if (!smtpUser || !smtpPass) {
      throw new Error('SMTP credentials not configured');
    }
    
    // If using default credentials and transporter already exists, reuse it
    if (this.transporter && smtpUser === this.defaultSmtpUser) {
      return this.transporter;
    }
    
    // Create new transporter with specific credentials
    return nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: false,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });
  }

  /**
   * Send email
   * 
   * DEBUG ANALYSIS:
   * This function sends emails via nodemailer SMTP transporter.
   * 
   * Common failure reasons:
   * - SMTP server configuration incorrect (host, port, credentials)
   * - Authentication failed (wrong username/password)
   * - Network connectivity issues
   * - Invalid email addresses
   * - SMTP server blocking the connection
   * - Missing environment variables (EMAIL_SMTP_HOST, EMAIL_SMTP_USER, EMAIL_SMTP_PASS)
   */
  async sendEmail(options: EmailOptions): Promise<boolean> {
    console.log('\n========== [EmailService] Send Email ==========');
    console.log(`[EmailService] To: ${options.to}`);
    console.log(`[EmailService] From: ${options.from || EMAIL_CONFIG.from} (${options.from ? 'custom' : 'default'})`);
    console.log(`[EmailService] Subject: "${options.subject}"`);
    console.log(`[EmailService] HTML content length: ${options.html.length} chars`);
    
    // Check SMTP configuration
    const smtpHost = process.env.EMAIL_SMTP_HOST || 'smtp.gmail.com';
    const smtpPort = process.env.EMAIL_SMTP_PORT || '587';
    
    // SMTP User: Use EMAIL_SMTP_USER if set, otherwise fall back to sender email from options
    // This allows using sender email from rule as SMTP user if global EMAIL_SMTP_USER is not set
    let smtpUser = process.env.EMAIL_SMTP_USER;
    if (!smtpUser && options.from) {
      console.log(`[EmailService] EMAIL_SMTP_USER not set, using sender email "${options.from}" as SMTP user`);
      smtpUser = options.from;
    }
    
    const smtpPass = process.env.EMAIL_SMTP_PASS;
    const hasSmtpPass = !!smtpPass;
    
    console.log(`[EmailService] SMTP Config:`);
    console.log(`  → Host: ${smtpHost}`);
    console.log(`  → Port: ${smtpPort}`);
    console.log(`  → User: ${smtpUser || 'NOT SET (will fail!)'}`);
    console.log(`  → Password: ${hasSmtpPass ? 'SET (***)' : 'NOT SET (will fail!)'}`);
    
    // SMTP password is always required - cannot send emails without authentication
    if (!smtpUser || !hasSmtpPass) {
      console.error('[EmailService] ❌ SMTP credentials not configured!');
      console.error('  → Missing:');
      if (!smtpUser) {
        console.error('    • EMAIL_SMTP_USER (or sender email in rule)');
      }
      if (!hasSmtpPass) {
        console.error('    • EMAIL_SMTP_PASS (REQUIRED - cannot send without password)');
      }
      console.error('  → Configure in .env file:');
      console.error('    EMAIL_SMTP_USER=your-email@gmail.com');
      console.error('    EMAIL_SMTP_PASS=your-app-password');
      console.error('  → For Gmail: Generate an "App Password" in your Google Account settings');
      return false;
    }
    
    // If SMTP user is different from sender email, recreate transporter with correct credentials
    // Note: nodemailer transporter is created in constructor, but we need to ensure credentials are correct
    // Since transporter is created once in constructor, we'll log a warning if mismatch occurs
    if (options.from && smtpUser !== options.from) {
      console.log(`[EmailService] ⚠️  Warning: SMTP user (${smtpUser}) differs from sender email (${options.from})`);
      console.log(`[EmailService]    Emails will be sent via SMTP as "${smtpUser}" but appear from "${options.from}"`);
      console.log(`[EmailService]    Note: Some SMTP servers may reject if sender doesn't match authenticated user`);
    }
    
    try {
      const mailOptions = {
        from: options.from || EMAIL_CONFIG.from, // Use provided sender or fallback to default
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || this.htmlToText(options.html)
      };

      // Get transporter with appropriate credentials (may use sender email as SMTP user)
      const transporter = this.getTransporter(options.from);
      
      console.log('[EmailService] Attempting to send email via SMTP...');
      const result = await transporter.sendMail(mailOptions);
      console.log('[EmailService] ✅ Email sent successfully!');
      console.log(`[EmailService] Message ID: ${result.messageId}`);
      console.log('[EmailService] Response:', JSON.stringify(result.response, null, 2));
      console.log('===========================================\n');
      
      // Close transporter if it was newly created (not the default one)
      if (transporter !== this.transporter) {
        transporter.close();
      }
      
      return true;
    } catch (error) {
      console.error('[EmailService] ❌ Error sending email:');
      console.error(`  → Error type: ${error instanceof Error ? error.constructor.name : typeof error}`);
      console.error(`  → Error message: ${error instanceof Error ? error.message : String(error)}`);
      
      // Log detailed error information
      if (error instanceof Error) {
        console.error(`  → Error stack: ${error.stack}`);
        // Check for common nodemailer error codes
        if ('code' in error) {
          console.error(`  → Error code: ${(error as any).code}`);
        }
        if ('command' in error) {
          console.error(`  → Failed command: ${(error as any).command}`);
        }
        if ('response' in error) {
          console.error(`  → SMTP response: ${(error as any).response}`);
        }
        if ('responseCode' in error) {
          console.error(`  → SMTP response code: ${(error as any).responseCode}`);
        }
      }
      
      console.log('===========================================\n');
      return false;
    }
  }

  /**
   * Send welcome email with verification link
   */
  async sendWelcomeEmail(email: string, firstName: string, verificationToken: string): Promise<boolean> {
    const verificationUrl = `${EMAIL_CONFIG.frontendUrl}/auth/verify-email?token=${verificationToken}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Welcome to VOCA AI</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Welcome to VOCA AI!</h1>
          </div>
          <div class="content">
            <h2>Hi ${firstName}!</h2>
            <p>Thank you for signing up for VOCA AI. We're excited to help you build amazing AI-powered chatbots for your business.</p>
            
            <p>To get started, please verify your email address by clicking the button below:</p>
            
            <a href="${verificationUrl}" class="button">Verify Email Address</a>
            
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <p><a href="${verificationUrl}">${verificationUrl}</a></p>
            
            <p>This verification link will expire in 24 hours.</p>
            
            <p>If you didn't create an account with VOCA AI, you can safely ignore this email.</p>
          </div>
          <div class="footer">
            <p>© 2024 VOCA AI. All rights reserved.</p>
            <p>This email was sent to ${email}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: 'Welcome to VOCA AI - Verify Your Email',
      html
    });
  }

  /**
   * Send invitation email
   */
  async sendInvitationEmail(
    email: string, 
    firstName: string, 
    inviterName: string, 
    businessName: string, 
    role: string,
    invitationToken: string
  ): Promise<boolean> {
    const invitationUrl = `${EMAIL_CONFIG.frontendUrl}/auth/accept-invite?token=${invitationToken}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>You're Invited to Join ${businessName}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .role-badge { background: #e3f2fd; color: #1976d2; padding: 4px 12px; border-radius: 20px; font-size: 14px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎯 You're Invited!</h1>
          </div>
          <div class="content">
            <h2>Hi ${firstName}!</h2>
            <p><strong>${inviterName}</strong> has invited you to join <strong>${businessName}</strong> on VOCA AI as a <span class="role-badge">${role}</span>.</p>
            
            <p>VOCA AI is a powerful platform for building AI-powered chatbots and automating customer interactions.</p>
            
            <p>Click the button below to accept the invitation and set up your account:</p>
            
            <a href="${invitationUrl}" class="button">Accept Invitation</a>
            
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <p><a href="${invitationUrl}">${invitationUrl}</a></p>
            
            <p>This invitation will expire in 72 hours.</p>
            
            <p>If you don't want to join this team, you can safely ignore this email.</p>
          </div>
          <div class="footer">
            <p>© 2024 VOCA AI. All rights reserved.</p>
            <p>This email was sent to ${email}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: `You're invited to join ${businessName} on VOCA AI`,
      html
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email: string, firstName: string, resetToken: string): Promise<boolean> {
    const resetUrl = `${EMAIL_CONFIG.frontendUrl}/auth/reset-password?token=${resetToken}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Reset Your Password</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Password Reset</h1>
          </div>
          <div class="content">
            <h2>Hi ${firstName}!</h2>
            <p>We received a request to reset your password for your VOCA AI account.</p>
            
            <p>Click the button below to reset your password:</p>
            
            <a href="${resetUrl}" class="button">Reset Password</a>
            
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <p><a href="${resetUrl}">${resetUrl}</a></p>
            
            <div class="warning">
              <strong>Security Notice:</strong> This link will expire in 1 hour. If you didn't request a password reset, please ignore this email and your password will remain unchanged.
            </div>
          </div>
          <div class="footer">
            <p>© 2024 VOCA AI. All rights reserved.</p>
            <p>This email was sent to ${email}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: 'Reset Your VOCA AI Password',
      html
    });
  }

  /**
   * Convert HTML to plain text
   */
  private htmlToText(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();
  }
}

// Export singleton instance
export const emailService = new EmailService();

