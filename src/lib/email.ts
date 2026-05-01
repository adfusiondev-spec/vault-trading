import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM = 'NOKHBA Platform <onboarding@resend.dev>'
const TO = process.env.SUPER_ADMIN_EMAIL!

function baseLayout(title: string, bodyRows: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:12px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#f59e0b,#d97706);padding:28px 32px;">
              <h1 style="margin:0;color:#0f172a;font-size:22px;font-weight:700;letter-spacing:1px;">NOKHBA</h1>
              <p style="margin:4px 0 0;color:#1e293b;font-size:13px;opacity:0.8;">Platform Administration</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 24px;color:#f1f5f9;font-size:18px;">${title}</h2>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${bodyRows}
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#0f172a;padding:16px 32px;border-top:1px solid #334155;">
              <p style="margin:0;color:#64748b;font-size:12px;">This is an automated notification from the NOKHBA platform. Do not reply to this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function row(label: string, value: string): string {
  return `
  <tr>
    <td style="padding:8px 0;border-bottom:1px solid #334155;color:#94a3b8;font-size:13px;width:160px;">${label}</td>
    <td style="padding:8px 0;border-bottom:1px solid #334155;color:#f1f5f9;font-size:13px;font-weight:500;">${value}</td>
  </tr>`
}

export async function sendNewTenantAlert(
  tenantName: string,
  tenantEmail: string,
  companySlug: string
): Promise<void> {
  if (!process.env.RESEND_API_KEY || !process.env.SUPER_ADMIN_EMAIL) return

  const timestamp = new Date().toLocaleString('en-US', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' }) + ' UTC'

  await resend.emails.send({
    from: FROM,
    to: TO,
    subject: `New Tenant Sign-Up — ${companySlug}`,
    html: baseLayout(
      'New Tenant Sign-Up',
      row('Name', tenantName) +
      row('Email', tenantEmail) +
      row('Company Slug', companySlug) +
      row('Plan', 'Trial (1 Day)') +
      row('Signed Up At', timestamp)
    ),
  })
}

export async function sendSubscriptionPaymentAlert(
  subAdminEmail: string,
  packageName: string,
  amount: number,
  method: string
): Promise<void> {
  if (!process.env.RESEND_API_KEY || !process.env.SUPER_ADMIN_EMAIL) return

  const timestamp = new Date().toLocaleString('en-US', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' }) + ' UTC'

  await resend.emails.send({
    from: FROM,
    to: TO,
    subject: `New Subscription Payment — ${packageName}`,
    html: baseLayout(
      'New Subscription Payment Request',
      row('Sub-Admin', subAdminEmail) +
      row('Package', packageName) +
      row('Amount', `$${amount.toFixed(2)}`) +
      row('Payment Method', method) +
      row('Status', 'Pending Review') +
      row('Submitted At', timestamp)
    ),
  })
}
