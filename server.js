const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let blastJobs = [];
let isProcessing = false;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function formatMessage(template, recipient) {
  return template
    .replace(/\{nama\}/gi, recipient.name || 'Kak')
    .replace(/\{target\}/gi, recipient.target || '');
}

async function processQueue() {
  if (isProcessing) return;
  isProcessing = true;

  while (true) {
    const nextJob = blastJobs.find((job) => job.status === 'pending');
    if (!nextJob) break;

    nextJob.status = 'processing';
    nextJob.updatedAt = new Date().toLocaleTimeString('id-ID');

    const delayMs = Math.max(1, Number(nextJob.delaySeconds) || 3) * 1000;
    await sleep(delayMs);

    try {
      const finalText = formatMessage(nextJob.template, nextJob);
      nextJob.finalMessage = finalText;

      const simulatedSuccess = Math.random() > 0.1;

      if (simulatedSuccess) {
        nextJob.status = 'sent';
        nextJob.note = 'Terkirim (simulasi)';
      } else {
        nextJob.status = 'failed';
        nextJob.note = 'Gagal kirim (simulasi timeout/target)';
      }
    } catch (err) {
      nextJob.status = 'failed';
      nextJob.note = err.message || 'Terjadi kesalahan';
    }

    nextJob.updatedAt = new Date().toLocaleTimeString('id-ID');
  }

  isProcessing = false;
}

app.post('/api/blast', (req, res) => {
  const { recipients, template, delaySeconds } = req.body;

  if (!Array.isArray(recipients) || recipients.length === 0) {
    return res.status(400).json({ message: 'Daftar penerima tidak boleh kosong.' });
  }
  if (!template || !template.trim()) {
    return res.status(400).json({ message: 'Isi pesan tidak boleh kosong.' });
  }

  const createdJobs = recipients.map((item, idx) => ({
    id: `${Date.now()}-${idx}`,
    target: String(item.target || '').trim(),
    name: String(item.name || '').trim(),
    template: template.trim(),
    finalMessage: formatMessage(template.trim(), item),
    delaySeconds: Number(delaySeconds) || 3,
    status: 'pending',
    note: 'Menunggu antrean',
    updatedAt: new Date().toLocaleTimeString('id-ID')
  }));

  blastJobs.push(...createdJobs);
  processQueue();

  res.json({
    message: `${createdJobs.length} pesan ditambahkan ke antrean.`,
    totalInQueue: blastJobs.length
  });
});

app.get('/api/logs', (req, res) => {
  res.json({
    isProcessing,
    jobs: [...blastJobs].reverse()
  });
});

app.post('/api/clear', (req, res) => {
  if (isProcessing) {
    return res.status(400).json({ message: 'Tunggu proses antrean selesai sebelum menghapus log.' });
  }
  blastJobs = [];
  res.json({ message: 'Log berhasil dibersihkan.' });
});

app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});
