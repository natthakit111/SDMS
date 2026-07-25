/**
 * frontend/lib/api/report.api.js
 * Backend: /api/reports  (Admin only)
 *
 * GET /revenue?year=2025&format=excel|pdf
 * GET /rooms?format=excel|pdf
 * GET /payments?month=3&year=2025&format=excel|pdf
 * GET /system-export        — export ข้อมูลระบบทั้งหมด (Excel, multi-sheet)
 */
import api from './axiosInstance';

const triggerDownload = (blobData, filename) => {
  const url = URL.createObjectURL(new Blob([blobData]));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

export const reportAPI = {
  getRevenue: async (year, format = 'excel') => {
    const res = await api.get('/reports/revenue', {
      params: { year, format },
      responseType: 'blob',
    });
    triggerDownload(res.data, `revenue-${year}.${format === 'pdf' ? 'pdf' : 'xlsx'}`);
  },

  getRooms: async (format = 'excel') => {
    const res = await api.get('/reports/rooms', {
      params: { format },
      responseType: 'blob',
    });
    triggerDownload(res.data, `rooms-report.${format === 'pdf' ? 'pdf' : 'xlsx'}`);
  },

  getPayments: async (month, year, format = 'excel') => {
    const res = await api.get('/reports/payments', {
      params: { month, year, format },
      responseType: 'blob',
    });
    triggerDownload(res.data, `payments-${year}-${String(month).padStart(2, '0')}.${format === 'pdf' ? 'pdf' : 'xlsx'}`);
  },

  // ⚠️ Export ข้อมูลระบบทั้งหมด (ห้อง/ผู้เช่า/สัญญา/บิล/การชำระ) → ไฟล์ .xlsx เดียว หลายชีท
  getSystemExport: async () => {
    const res = await api.get('/reports/system-export', {
      responseType: 'blob',
    });
    const today = new Date().toISOString().slice(0, 10);
    triggerDownload(res.data, `system-export-${today}.xlsx`);
  },
};