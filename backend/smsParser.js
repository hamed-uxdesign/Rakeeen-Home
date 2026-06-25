function extractAmount(text) {
  const patterns = [
    /EGP\s*([\d,]+\.?\d*)/i,
    /بمبلغ\s+([\d,]+\.?\d*)/,
    /by\s+EGP\s+([\d,]+\.?\d*)/i,
    /مبلغ\s+EGP([\d,]+\.?\d*)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return parseFloat(m[1].replace(/,/g, ''));
  }
  return 0;
}

function detectBank(text, sender) {
  const s = String(sender).toUpperCase();
  if (s === 'CIB' || text.includes('19666') || text.includes('6499')) return 'CIB';
  if (s === 'AHLY' || s === 'NBE' || s.includes('AHLI') || text.includes('19623') || text.includes('0120') || text.includes('7049')) return 'AHLY';
  if (s === 'BM' || s.includes('MISR') || s.includes('BM-SMS') || text.includes('19888') || text.includes('2981') || text.includes('BM card')) return 'BM';
  return 'UNKNOWN';
}

function extractRecipient(text) {
  const m = text.match(/إلى\s+([^\n\r]+?)(?:\s+رقم|\s+بتاريخ|$)/);
  return m ? m[1].trim() : '';
}

export function parseSMS(text, sender) {
  const t = text.trim();
  const bank = detectBank(t, sender);
  const amount = extractAmount(t);

  // Self-transfer / Internal transfer detection — ignore
  if (t.includes('HAMED WALEED HAMED') || t.includes('HAMED WALED HAMED')) {
    return { type: 'internal', bank, amount, raw: text };
  }

  // Incoming transfer (Deposit)
  const isIncoming = 
    t.includes('إلى حسابك') || 
    t.includes('إلى حساب') || 
    t.includes('إضافة') || 
    t.includes('تم تحويل مبلغ') || 
    t.includes('تحويل وارد') ||
    t.includes('تم إضافة تحويل لحظي');

  if (isIncoming) {
    return {
      type: 'deposit',
      bank,
      amount,
      source: t.includes('جهة العمل') ? 'جهة العمل' : 'تحويل وارد',
      raw: text,
    };
  }

  // Outgoing transfer / Withdrawal / Debit
  const isOutgoing = 
    t.includes('من حسابك') || 
    t.includes('من حساب') || 
    t.includes('تم خصم') || 
    t.includes('خصم') || 
    t.includes('Debited') || 
    t.includes('سحب') || 
    t.includes('تفويض') ||
    t.includes('تنفيذ تحويل لحظي من');

  if (isOutgoing) {
    return {
      type: 'debit',
      bank,
      amount,
      recipient: extractRecipient(t),
      raw: text,
    };
  }

  return { type: 'unknown', bank, raw: text };
}
