// Evan's professional email signature
export const EVAN_SIGNATURE_HTML = `
<br><br>
<div style="font-size: 13px; font-family: Arial, sans-serif; line-height: 1.2;">
<strong style="color: #333;">Evan Hettich<br>
Associate<br>
Commercial Lending X<br>
Check out our commercial lending videos on our <a href="https://www.youtube.com/@commerciallendingx" style="color: #1a73e8;">CLX YouTube Channel</a>.<br>
<a href="https://www.commerciallendingx.com" style="color: #1a73e8;">www.commerciallendingx.com</a><br>
Email: <a href="mailto:evan@commerciallendingx.com" style="color: #1a73e8;">evan@commerciallendingx.com</a><br>
Offices In:<br>
Naperville, IL 60563<br>
Saint Augustine, FL 32092</strong><br>
<br>
<strong style="color: #0066FF;">The CLX Way</strong><br>
<em>Proven process to navigate the commercial lending journey</em><br>
<br>
<span style="font-size: 11px; color: #888; line-height: 1.3;">CONFIDENTIALITY NOTICE: This message and all content and files transmitted with it, is a confidential and proprietary business communication, which is solely for the use of the intended recipient(s). Any use, distribution, duplication or disclosure by any other person or entity is strictly prohibited. If you are not the intended recipient of this email or you have received this email in error, please contact the sender directly and immediately delete all copies of this email and any attachments.</span>
</div>
`.trim();

// Helper to append signature to email body
export const appendSignature = (body: string): string => {
  // Don't add signature if it already contains one (check for unique identifier)
  if (body.includes('Evan Hettich') && body.includes('Commercial Lending X')) {
    return body;
  }
  return body + EVAN_SIGNATURE_HTML;
};

// Helper to create a new email with signature
export const createEmailWithSignature = (body: string = ''): string => {
  return appendSignature(body);
};
