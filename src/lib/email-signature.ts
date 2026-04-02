// Dynamic email signature generator for Commercial Lending X team members

export const getSignatureHtml = (name: string, email: string, title: string): string => `
<br><br>
<div style="font-size: 13px; font-family: Arial, sans-serif; line-height: 1.2;">
<strong style="color: inherit;">${name}<br>
${title}<br>
Commercial Lending X<br>
Check out our commercial lending videos on our <a href="https://www.youtube.com/@commerciallendingx661/featured" style="color: #1a73e8;">CLX YouTube Channel</a>.<br>
<a href="https://www.commerciallendingx.com/" style="color: #1a73e8;">www.commerciallendingx.com</a><br>
Email: <a href="mailto:${email}" style="color: #1a73e8;">${email}</a><br>
Offices In:<br>
Naperville, IL 60563<br>
Saint Augustine, FL 32092</strong><br>
<br>
<strong style="color: #0066FF;">The CLX Way</strong><br>
<em>Proven process to navigate the commercial lending journey</em><br>
<br>
<img src="https://pcwiwtajzqnayfwvqsbh.supabase.co/storage/v1/object/public/email-assets/process-flow-transparent.png" alt="CLX Loan Processing Pipeline" style="max-width: 500px; width: 100%; height: auto; margin: 10px 0;" /><br>
<br>
<span style="font-size: 11px; color: #888; line-height: 1.3;">CONFIDENTIALITY NOTICE: This message and all content and files transmitted with it, is a confidential and proprietary business communication, which is solely for the use of the intended recipient(s). Any use, distribution, duplication or disclosure by any other person or entity is strictly prohibited. If you are not the intended recipient of this email or you have received this email in error, please contact the sender directly and immediately delete all copies of this email and any attachments.</span>
</div>
`.trim();

// Backwards-compatible constant for Evan's signature
export const EVAN_SIGNATURE_HTML = getSignatureHtml('Evan Hettich', 'evan@commerciallendingx.com', 'Associate');

// Check if a body already contains a CLX signature (generic check)
export const hasSignature = (body: string): boolean => {
  return body.includes('Commercial Lending X') && body.includes('commerciallendingx.com');
};

// Helper to append signature to email body.
// If signatureHtml is provided, uses that; otherwise falls back to EVAN_SIGNATURE_HTML.
export const appendSignature = (body: string, signatureHtml?: string): string => {
  if (hasSignature(body)) {
    return body;
  }
  return body + (signatureHtml ?? EVAN_SIGNATURE_HTML);
};

// Helper to create a new email with signature
export const createEmailWithSignature = (body: string = '', signatureHtml?: string): string => {
  return appendSignature(body, signatureHtml);
};
