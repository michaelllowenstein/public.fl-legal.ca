import nodemailer, { Transporter, SendMailOptions } from 'nodemailer';
import { config } from '../config';

let _transport: Transporter | null = null;

function transport(): Transporter {
  if (!_transport) {
    _transport = nodemailer.createTransport({
      host:   config.email.host,
      port:   config.email.port,
      secure: config.email.secure,
      auth: {
        user: config.email.user,
        pass: config.email.pass,
      },
    });
  }
  return _transport;
}

const FROM = `"${config.email.fromName}" <${config.email.user}>`;

//                                                                              
//  Public interfaces
//                                                                              

export interface GeneralInquiryPayload {
  name:    string;
  email:   string;
  phone?:  string;
  message: string;
}

export interface PriorityInquiryPayload extends GeneralInquiryPayload {
  /** e.g. 'Real Estate', 'Family Law'   drives the priority subject line */
  practiceArea?: string;
}

//                                                                              
//  Email templates
//                                                                              

function baseHtml(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    body  { margin:0; padding:0; background:#f5f0e8; font-family:'Georgia',serif; color:#0f2235; }
    .wrap { max-width:600px; margin:32px auto; background:#fff; border-radius:12px;
            overflow:hidden; box-shadow:0 4px 24px rgba(15,34,53,.12); }
    .hdr  { background:#1a3a5c; padding:28px 32px; }
    .hdr h1 { margin:0; color:#b8932a; font-size:20px; font-weight:600; letter-spacing:.03em; }
    .hdr p  { margin:4px 0 0; color:rgba(255,255,255,.5); font-size:11px;
              text-transform:uppercase; letter-spacing:.1em; font-family:sans-serif; }
    .body { padding:32px; }
    .body h2 { margin:0 0 16px; font-size:18px; color:#1a3a5c; }
    table.fields { width:100%; border-collapse:collapse; margin:16px 0; }
    table.fields td { padding:8px 12px; font-size:14px; vertical-align:top; }
    table.fields tr:nth-child(odd) td { background:#f5f0e8; border-radius:4px; }
    table.fields td.label { width:130px; font-family:sans-serif; font-size:11px;
                            text-transform:uppercase; letter-spacing:.08em; color:#888;
                            font-weight:600; padding-top:10px; }
    .msg  { background:#f5f0e8; border-left:4px solid #b8932a; padding:16px;
            border-radius:0 8px 8px 0; font-size:14px; line-height:1.7; margin:16px 0; }
    .ftr  { background:#0f2235; padding:18px 32px; text-align:center;
            font-family:sans-serif; font-size:11px; color:rgba(255,255,255,.35); }
    .badge { display:inline-block; background:#b8932a; color:#0f2235; font-family:sans-serif;
             font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.1em;
             padding:3px 10px; border-radius:999px; margin-bottom:12px; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hdr">
      <h1>Fric, Lowenstein &amp; Co. LLP</h1>
      <p>Barristers &amp; Solicitors   Calgary, Alberta</p>
    </div>
    <div class="body">${body}</div>
    <div class="ftr">&copy; ${new Date().getFullYear()} Fric, Lowenstein &amp; Co. LLP. All rights reserved.</div>
  </div>
</body>
</html>`;
}

//                                                                              
//  1. General appointment request
//     Sent to: firm inbox
//     Subject: normal, no special flag
//                                                                              

export async function sendGeneralInquiry(data: GeneralInquiryPayload): Promise<void> {
  const subject = `Appointment Request   ${data.name}`;

  const html = baseHtml(`
    <h2>New Appointment Request</h2>
    <table class="fields">
      <tr><td class="label">Name</td><td>${esc(data.name)}</td></tr>
      <tr><td class="label">Email</td><td><a href="mailto:${esc(data.email)}">${esc(data.email)}</a></td></tr>
      ${data.phone ? `<tr><td class="label">Phone</td><td>${esc(data.phone)}</td></tr>` : ''}
    </table>
    <p style="font-family:sans-serif;font-size:12px;color:#888;margin:0 0 6px">Message:</p>
    <div class="msg">${esc(data.message).replace(/\n/g, '<br>')}</div>
  `);

  const text =
    `New Appointment Request\n\n` +
    `Name:    ${data.name}\n` +
    `Email:   ${data.email}\n` +
    (data.phone ? `Phone:   ${data.phone}\n` : '') +
    `\nMessage:\n${data.message}`;

  await send({ subject, html, text, replyTo: data.email });

  // Auto-confirm to the client
  await sendClientConfirmation(data.name, data.email);
}

//                                                                              
//  2. Priority inquiry
//     Sent to: firm inbox
//     Subject: prefixed with   PRIORITY so secretarial staff spot it immediately
//     in any email client (no filters or rules required)
//                                                                              

export async function sendPriorityInquiry(data: PriorityInquiryPayload): Promise<void> {
  const areaLabel = data.practiceArea ? ` [${data.practiceArea}]` : '';
  const subject   = `  PRIORITY INQUIRY${areaLabel}   ${data.name}`;

  const html = baseHtml(`
    <div class="badge">  Priority Inquiry${data.practiceArea ? '   ' + esc(data.practiceArea) : ''}</div>
    <h2>Urgent Client Inquiry</h2>
    <p style="font-family:sans-serif;font-size:13px;color:#555;margin:0 0 16px">
      This inquiry has been marked <strong>priority</strong> and requires prompt attention.
    </p>
    <table class="fields">
      <tr><td class="label">Name</td><td>${esc(data.name)}</td></tr>
      <tr><td class="label">Email</td><td><a href="mailto:${esc(data.email)}">${esc(data.email)}</a></td></tr>
      ${data.phone ? `<tr><td class="label">Phone</td><td>${esc(data.phone)}</td></tr>` : ''}
      ${data.practiceArea ? `<tr><td class="label">Matter</td><td>${esc(data.practiceArea)}</td></tr>` : ''}
    </table>
    <p style="font-family:sans-serif;font-size:12px;color:#888;margin:0 0 6px">Message:</p>
    <div class="msg">${esc(data.message).replace(/\n/g, '<br>')}</div>
  `);

  const text =
    `  PRIORITY INQUIRY${areaLabel}\n\n` +
    `Name:    ${data.name}\n` +
    `Email:   ${data.email}\n` +
    (data.phone ? `Phone:   ${data.phone}\n` : '') +
    (data.practiceArea ? `Matter:  ${data.practiceArea}\n` : '') +
    `\nMessage:\n${data.message}`;

  await send({ subject, html, text, replyTo: data.email });
  await sendClientConfirmation(data.name, data.email);
}

//                                                                              
//  3. Auto-confirmation to the client
//                                                                              

async function sendClientConfirmation(name: string, toEmail: string): Promise<void> {
  const firstName = name.split(' ')[0];
  const subject   = `We've received your inquiry   Fric, Lowenstein & Co.`;

  const html = baseHtml(`
    <h2>Thank you, ${esc(firstName)}.</h2>
    <p style="font-size:15px;line-height:1.7">
      We have received your inquiry and a member of our team will be in touch
      with you within one business day.
    </p>
    <p style="font-size:15px;line-height:1.7">
      If your matter is urgent, please call us directly at
      <a href="tel:+14032589455" style="color:#1a3a5c">(403) 258-9455</a>.
    </p>
    <p style="font-size:13px;color:#888;margin-top:24px">
      Office hours: Monday   Friday, 8:30 AM   5:00 PM (Mountain Time)
    </p>
  `);

  const text =
    `Thank you, ${firstName}.\n\n` +
    `We have received your inquiry and will be in touch within one business day.\n\n` +
    `For urgent matters, call: (403) 258-9455\n` +
    `Office hours: Mon Fri, 8:30 AM   5:00 PM MT`;

  await send({
    to:      toEmail,
    subject,
    html,
    text,
  });
}

//                                                                              
//  Internal helpers
//                                                                              

interface SendOptions {
  to?:     string;   // defaults to firm inbox
  subject: string;
  html:    string;
  text:    string;
  replyTo?: string;
}

async function send(opts: SendOptions): Promise<void> {
  const mail: SendMailOptions = {
    from:    FROM,
    to:      opts.to ?? config.email.firmEmail,
    subject: opts.subject,
    html:    opts.html,
    text:    opts.text,
  };

  if (opts.replyTo)                 mail.replyTo = opts.replyTo;
  else if (config.email.replyTo)    mail.replyTo = config.email.replyTo;

  await transport().sendMail(mail);
}

/** Minimal HTML-escape   prevents XSS in email templates. */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}