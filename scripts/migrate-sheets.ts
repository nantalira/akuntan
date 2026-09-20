import { Database } from 'bun:sqlite';
import fs from 'node:fs';
import path from 'node:path';

interface SheetTab {
  name: string;
  gid: number;
}

const TABS: SheetTab[] = [
  { name: 'Juli 2024', gid: 0 },
  { name: 'Agustus 2024', gid: 277053947 },
  { name: 'September 2024', gid: 384008593 },
  { name: 'Oktober 2024', gid: 295986219 },
  { name: 'November 2024', gid: 1702050341 },
  { name: 'Desember 2024', gid: 1490565900 },
  { name: 'Januari 2025', gid: 133284843 },
  { name: 'Februari 2025', gid: 401405057 },
  { name: 'Maret 2025', gid: 702130356 },
  { name: 'April 2025', gid: 1032320997 },
  { name: 'Mei 2025', gid: 492324515 },
  { name: 'Juni 2025', gid: 2069912861 },
  { name: 'Juli 2025', gid: 1957103594 },
  { name: 'Desember 2025', gid: 414235539 },
  { name: 'Januari 2026', gid: 38908016 },
  { name: 'Februari 2026', gid: 254506189 },
  { name: 'Maret 2026', gid: 888989134 },
  { name: 'April 2026', gid: 1888805618 },
  { name: 'Mei 2026', gid: 1417554338 },
  { name: 'Juni 2026', gid: 689486709 },
  { name: 'Juli 2026', gid: 573618868 },
  { name: 'Agustus 2026', gid: 960050339 },
  { name: 'September 2026', gid: 1593303042 }
];

const SPREADSHEET_ID = '1LSyiXgmqp3JLbRjV9qmHKKjZztsiqduSwIM7w3Wk8xU';

function normalizeDate(raw: string): string {
  if (!raw) return '';
  // Expected DD/MM/YYYY or YYYY-MM-DD
  const parts = raw.split('/');
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    let year = parts[2];
    if (year.length === 2) year = `20${year}`;
    return `${year}-${month}-${day}`;
  }
  return raw;
}

function normalizeTime(raw: string): string {
  if (!raw) return '12:00:00';
  // e.g. "6:00:00 AM", "12:00:00 PM", "19:00:00"
  const isPM = raw.includes('PM');
  const isAM = raw.includes('AM');
  const clean = raw.replace(/\s*(AM|PM)/gi, '').trim();
  const parts = clean.split(':');
  if (parts.length >= 2) {
    let hour = parseInt(parts[0], 10);
    const min = parts[1].padStart(2, '0');
    const sec = (parts[2] || '00').padStart(2, '0');
    if (isPM && hour < 12) hour += 12;
    if (isAM && hour === 12) hour = 0;
    return `${String(hour).padStart(2, '0')}:${min}:${sec}`;
  }
  return '12:00:00';
}

function normalizeAmount(raw: string): number {
  if (!raw) return 0;
  // e.g. "Rp30.000,00" -> 30000
  const clean = raw.replace(/[^\d]/g, '');
  // If ends with '00' from cents (,00)
  if (raw.includes(',00') && clean.endsWith('00')) {
    return parseInt(clean.slice(0, -2), 10) || 0;
  }
  return parseInt(clean, 10) || 0;
}

function normalizeCategory(raw: string): string {
  const lower = (raw || '').toLowerCase().trim();
  if (lower.includes('makan')) return 'Makan';
  if (lower.includes('jajan')) return 'Jajan';
  if (lower.includes('primer')) return 'Primer';
  if (lower.includes('motor')) return 'Motor';
  if (lower.includes('olga') || lower.includes('olahraga')) return 'Olga';
  if (lower.includes('belanja')) return 'Belanja';
  return 'Jajan';
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim().replace(/^"|"$/g, ''));
  return result;
}

async function run() {
  console.log('🚀 Memulai migrasi data dari Google Sheets ke Cloudflare D1 (SQLite)...');

  // Find local D1 SQLite file
  const d1Dir = path.resolve('.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
  if (!fs.existsSync(d1Dir)) {
    console.error(
      '❌ Direktori D1 lokal tidak ditemukan. Pastikan sudah menjalankan migrasi lokal.'
    );
    process.exit(1);
  }

  const files = fs.readdirSync(d1Dir);
  const sqliteFile = files.find((f) => f.endsWith('.sqlite'));
  if (!sqliteFile) {
    console.error('❌ File database SQLite D1 tidak ditemukan di', d1Dir);
    process.exit(1);
  }

  const dbPath = path.join(d1Dir, sqliteFile);
  console.log('📂 Menghubungkan ke SQLite lokal:', dbPath);
  const db = new Database(dbPath);

  // Clear existing transactions to avoid duplicate re-run
  db.run('DELETE FROM transactions');
  db.run('DELETE FROM debts');

  const insertTx = db.prepare(`
    INSERT INTO transactions (name, amount, date, time, category, debtor, creditor, debt_amount, notes, created_at)
    VALUES ($name, $amount, $date, $time, $category, $debtor, $creditor, $debt_amount, $notes, CURRENT_TIMESTAMP)
  `);

  let totalImported = 0;
  let grandTotalAmount = 0;
  const debtsMap = new Map<string, { owedToUs: number; weOwe: number }>();

  for (const tab of TABS) {
    const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=${tab.gid}`;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`⚠️ Gagal mendownload tab "${tab.name}" (Status: ${res.status})`);
        continue;
      }
      const csvText = await res.text();
      const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);

      // Find header index
      let headerIdx = -1;
      for (let i = 0; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        if (cols[0]?.toLowerCase().includes('nama')) {
          headerIdx = i;
          break;
        }
      }

      if (headerIdx === -1) {
        console.warn(`⚠️ Tab "${tab.name}" tidak memiliki baris header "Nama"`);
        continue;
      }

      let countInTab = 0;
      for (let i = headerIdx + 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        const name = cols[0]?.trim();
        const rawAmount = cols[1];
        const rawDate = cols[2];
        const rawTime = cols[3];
        const rawCategory = cols[4];
        const rawTerhutangi = cols[5]?.trim();
        const rawMenghutangi = cols[6]?.trim();
        const rawDebtAmount = cols[7]?.trim();
        const notes = cols[8]?.trim() || null;

        const amount = normalizeAmount(rawAmount);
        const date = normalizeDate(rawDate);
        const time = normalizeTime(rawTime);
        const category = normalizeCategory(rawCategory);

        if (!name || amount <= 0 || !date) {
          continue;
        }

        const debtor = rawTerhutangi ? rawTerhutangi.toUpperCase() : null;
        const creditor = rawMenghutangi ? rawMenghutangi.toUpperCase() : null;
        const debtAmount = rawDebtAmount
          ? normalizeAmount(rawDebtAmount)
          : debtor || creditor
            ? amount
            : 0;

        insertTx.run({
          $name: name,
          $amount: amount,
          $date: date,
          $time: time,
          $category: category,
          $debtor: debtor,
          $creditor: creditor,
          $debt_amount: debtAmount,
          $notes: notes
        });

        // Track debts
        if (debtor && debtAmount > 0) {
          const cur = debtsMap.get(debtor) || { owedToUs: 0, weOwe: 0 };
          cur.owedToUs += debtAmount;
          debtsMap.set(debtor, cur);
        }
        if (creditor && debtAmount > 0) {
          const cur = debtsMap.get(creditor) || { owedToUs: 0, weOwe: 0 };
          cur.weOwe += debtAmount;
          debtsMap.set(creditor, cur);
        }

        countInTab++;
        totalImported++;
        grandTotalAmount += amount;
      }

      console.log(`✅ [${tab.name}]: Berhasil mengimpor ${countInTab} transaksi`);
    } catch (err) {
      console.error(`❌ Error pada tab ${tab.name}:`, err);
    }
  }

  // Insert aggregated debts
  const insertDebt = db.prepare(`
    INSERT INTO debts (contact_name, total_owed_to_us, total_we_owe, updated_at)
    VALUES ($contact_name, $total_owed_to_us, $total_we_owe, CURRENT_TIMESTAMP)
  `);

  for (const [contact, bal] of debtsMap.entries()) {
    insertDebt.run({
      $contact_name: contact,
      $total_owed_to_us: bal.owedToUs,
      $total_we_owe: bal.weOwe
    });
  }

  console.log('\n=============================================');
  console.log(`🎉 MIGRASI SELESAI DENGAN SUKSES!`);
  console.log(`📊 Total Transaksi Diimpor: ${totalImported.toLocaleString('id-ID')} transaksi`);
  console.log(`💰 Total Akumulasi Pengeluaran: Rp ${grandTotalAmount.toLocaleString('id-ID')}`);
  console.log(`👥 Kontak Hutang Terdaftar: ${debtsMap.size} kontak`);
  console.log('=============================================\n');

  db.close();
}

run();
