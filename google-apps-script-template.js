/**
 * =======================================================================
 * AKUNTAN AI - GOOGLE APPS SCRIPT SYNC TEMPLATE
 * =======================================================================
 * Template ini dapat digunakan untuk:
 * - Cara 1: Disematkan di Google Spreadsheet (Ekstensi -> Apps Script)
 * - Cara 2: Disalin langsung ke Google Apps Script (script.google.com)
 * =======================================================================
 */

// Ganti nilai default ini jika menggunakan Cara 2 (Editor Script Langsung)
const DEFAULT_WEBHOOK_URL = 'https://your-domain.workers.dev/api/webhooks/qris/YOUR_TOKEN_HERE';

/**
 * Mengambil Webhook URL dari cell B3 Google Sheet (jika Cara 1)
 * atau dari UserProperties / DEFAULT_WEBHOOK_URL (jika Cara 2).
 */
function getActiveWebhookUrl() {
  const props = PropertiesService.getUserProperties();
  const saved = props.getProperty('AKUNTAN_WEBHOOK_URL');
  if (saved) return saved;

  if (typeof SpreadsheetApp !== 'undefined') {
    try {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
      const cellVal = sheet.getRange('B3').getValue().toString().trim();
      if (cellVal) {
        if (cellVal.indexOf('http') === 0) return cellVal;
        return `https://your-domain.workers.dev/api/webhooks/qris/${cellVal}`;
      }
    } catch (_e) {
      // Abaikan jika dipanggil di luar konteks Google Sheet
    }
  }

  return DEFAULT_WEBHOOK_URL;
}

/**
 * Fungsi Setup 1-Klik: Otomatis memasang Trigger waktu setiap 5 menit
 * Tanpa perlu pengguna membuka menu alarm/jam di Google Apps Script!
 */
function setup() {
  // 1. Dapatkan Webhook URL
  const webhookUrl = getActiveWebhookUrl();
  if (!webhookUrl || webhookUrl.indexOf('YOUR_TOKEN_HERE') !== -1) {
    const errorMsg = 'Harap masukkan Token atau URL Webhook Akuntan AI Anda terlebih dahulu!';
    if (typeof SpreadsheetApp !== 'undefined' && SpreadsheetApp.getActiveSpreadsheet()) {
      SpreadsheetApp.getUi().alert('⚠️ Perhatian', errorMsg, SpreadsheetApp.getUi().ButtonSet.OK);
    } else {
      Logger.log(`ERROR: ${errorMsg}`);
    }
    return;
  }

  // 2. Simpan URL ke User Properties
  const props = PropertiesService.getUserProperties();
  props.setProperty('AKUNTAN_WEBHOOK_URL', webhookUrl);

  // 3. Bersihkan trigger lama jika sudah ada agar tidak dobel
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'syncQrisEmailsToAkuntanAI') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  // 4. Otomatis buat Trigger baru yang berjalan setiap 5 menit
  ScriptApp.newTrigger('syncQrisEmailsToAkuntanAI').timeBased().everyMinutes(5).create();

  // 5. Jalankan sinkronisasi pertama kali
  syncQrisEmailsToAkuntanAI();

  const successMsg = '🎉 Berhasil! Sinkronisasi otomatis Akuntan AI telah aktif setiap 5 menit.';
  if (typeof SpreadsheetApp !== 'undefined' && SpreadsheetApp.getActiveSpreadsheet()) {
    SpreadsheetApp.getUi().alert('✅ Sukses', successMsg, SpreadsheetApp.getUi().ButtonSet.OK);
  } else {
    Logger.log(successMsg);
  }
}

/**
 * Fungsi Utama: Mencari email notifikasi bank dan mengirim ke Akuntan AI
 */
function syncQrisEmailsToAkuntanAI() {
  const webhookUrl = getActiveWebhookUrl();
  if (!webhookUrl || webhookUrl.indexOf('YOUR_TOKEN_HERE') !== -1) return;

  const query =
    'newer_than:1d ("QRIS" OR "Pembayaran Berhasil" OR "Transaksi Berhasil") (from:bca.co.id OR from:bankmandiri.co.id OR from:bri.co.id OR from:bni.co.id OR from:gopay.co.id)';
  const threads = GmailApp.search(query, 0, 10);
  const props = PropertiesService.getUserProperties();

  for (let i = 0; i < threads.length; i++) {
    const messages = threads[i].getMessages();
    const msg = messages[messages.length - 1];
    const msgId = msg.getId();

    // Lewati jika email ini sudah pernah dikirim
    if (props.getProperty(`SYNCED_${msgId}`)) continue;

    const payload = {
      app: 'Gmail Auto-Forwarder',
      title: msg.getSubject(),
      text: msg.getPlainBody().substring(0, 600),
      referenceId: `GMAIL-${msgId}`,
      timestamp: msg.getDate().toISOString()
    };

    try {
      const response = UrlFetchApp.fetch(webhookUrl, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });

      if (response.getResponseCode() === 200 || response.getResponseCode() === 201) {
        props.setProperty(`SYNCED_${msgId}`, '1');
      }
    } catch (err) {
      Logger.log(`Gagal mengirim email ID ${msgId}: ${err}`);
    }
  }
}

if (typeof module !== 'undefined') {
  module.exports = { setup, syncQrisEmailsToAkuntanAI, getActiveWebhookUrl };
}
