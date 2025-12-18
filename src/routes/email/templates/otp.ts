export function renderOtpEmail({
  name,
  otp,
  expiryMinutes = 10,
}: {
  name?: string;
  otp: string;
  expiryMinutes?: number;
}) {
  const subject = "Pensions Ltd | Your One-Time Password (OTP)";

  const text = `
Hello${name ? ` ${name}` : ""},

You requested a one-time password (OTP) to access your Pensions Ltd account.

Your OTP is: ${otp}

This code will expire in ${expiryMinutes} minutes and can only be used once.

If you did not request this code, please ignore this email or contact Pensions Ltd support immediately.

Regards,
Pensions Ltd
Security Team
`;

  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; background-color:#f6f8fb; padding:24px;">
      <div style="max-width:600px; margin:0 auto; background:#ffffff; padding:24px; border-radius:6px; box-shadow:0 2px 8px rgba(0,0,0,0.05);">
        
        <h2 style="color:#0b5fff; margin-bottom:8px;">
          Pensions Ltd
        </h2>
        <p style="font-size:14px; color:#555; margin-top:0;">
          Secure Account Verification
        </p>

        <hr style="border:none; border-top:1px solid #e6e8eb; margin:16px 0;" />

        <p style="font-size:14px; color:#333;">
          Hello${name ? ` <strong>${name}</strong>` : ""},
        </p>

        <p style="font-size:14px; color:#333;">
          You requested a one-time password (OTP) to sign in to your Pensions Ltd account.
        </p>

        <p style="font-size:14px; color:#333; margin-bottom:8px;">
          Your OTP is:
        </p>

        <div style="font-size:24px; font-weight:700; letter-spacing:2px; color:#0b5fff; margin:12px 0;">
          ${otp}
        </div>

        <p style="font-size:14px; color:#333;">
          This code will expire in <strong>${expiryMinutes} minutes</strong> and can only be used once.
        </p>

        <hr style="border:none; border-top:1px solid #e6e8eb; margin:16px 0;" />

        <p style="font-size:12px; color:#666;">
          If you did not request this code, please ignore this email or contact 
          <strong>Pensions Ltd Support</strong> immediately to secure your account.
        </p>

        <p style="font-size:12px; color:#666; margin-top:16px;">
          © ${new Date().getFullYear()} Pensions Ltd. All rights reserved.
        </p>
      </div>
    </div>
  `;

  return { subject, text, html };
}
