// --- 1. KONFIGURASI API & GLOBAL ---
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw5TdGNPS58uNfg5vC4ysxN-4_t6ojjcnF80LZU28YEZ776LmevU5170bJ94qRO7Pf1/exec"; 

let dataGlobal = []; 
let statusGlobal = []; 
let downtimeGlobal = []; 
let grafikInstance = null;
let chartDowntimeInstance = null;
let chartPetugasDTInstance = null;
let chartTotalDowntimeInstance = null; 
let currentSlide = 'status';
let isLoggedIn = localStorage.getItem("isLoggedIn") === "true";

// --- 2. FUNGSI UTAMA PENGAMBIL DATA ---
async function muatDataOtomatis() {
    const icon = document.getElementById("updateIcon");
    if (icon) icon.innerText = "⏳";

    try {
        const response = await fetch(`${SCRIPT_URL}?action=ambilData`);
        const data = await response.json();
        
        dataGlobal = data.logs || [];
        statusGlobal = data.statusTx || [];
        downtimeGlobal = data.downtime || [];
        daftarTxGlobal = data.daftarTx || [];

        renderSidebar();
        inisialisasiHalaman();

        const skrg = new Date();
        const lastUpdatedText = `Update: ${skrg.getHours().toString().padStart(2, '0')}:${skrg.getMinutes().toString().padStart(2, '0')} WIB`;
        if (document.getElementById("lastUpdated")) {
            document.getElementById("lastUpdated").innerText = lastUpdatedText;
        }
        if (icon) icon.innerText = "✅";
        setTimeout(() => { if (icon) icon.innerText = "🔄"; }, 3000);
    } catch (error) {
        console.error("Gagal Sinkron:", error);
    }
}

function inisialisasiHalaman() {
    if (document.getElementById("gridStatusTx")) updateBeranda();

        renderDowntimeTerbaru();

   if (document.getElementById("tabelBody")) {
    const sectionKonten = document.getElementById("sectionLogTabel");
    const sectionDitolak = document.getElementById("aksesDitolak");

    // CEK STATUS LOGIN
    if (!isLoggedIn) {
        // Jika belum login: Sembunyikan tabel, tampilkan pesan kunci
        if (sectionKonten) sectionKonten.classList.add("d-none");
        if (sectionDitolak) sectionDitolak.classList.remove("d-none");
    } else {
        // Jika sudah login: Tampilkan tabel, jalankan fungsi data
        if (sectionKonten) sectionKonten.classList.remove("d-none");
        if (sectionDitolak) sectionDitolak.classList.add("d-none");
        
        prosesFilterDropdown(); 
        inisialisasiFilterTahun(); 
        tampilkanLogTabel();
        cekStatusTombolPreview();
    }
}
    
    if (document.getElementById("grafikPegawai")) {
    const sectionKonten = document.getElementById("kontenStatistik");
    const sectionDitolak = document.getElementById("aksesDitolak");

    if (!isLoggedIn) {
        // Jika belum login: Sembunyikan grafik, tampilkan pesan kunci
        if (sectionKonten) sectionKonten.classList.add("d-none");
        if (sectionDitolak) sectionDitolak.classList.remove("d-none");
    } else {
        // Jika sudah login: Tampilkan grafik dan jalankan render
        if (sectionKonten) sectionKonten.classList.remove("d-none");
        if (sectionDitolak) sectionDitolak.classList.add("d-none");
        renderGrafik();
    }
}

    if (document.getElementById("chartDowntime")) {
        inisialisasiFilterDowntime();
        renderGrafikDowntime();
        tampilkanTabelDowntime();
        updateHalamanDowntime();
    }
}

// --- 3. LOGIKA DASHBOARD (index.html) ---
function updateBeranda() {
    const skrg = new Date();
    const bulanIni = skrg.getMonth();
    const tahunIni = skrg.getFullYear();

    const bulanLalu = bulanIni === 0 ? 11 : bulanIni - 1;
    const tahunLalu = bulanIni === 0 ? tahunIni - 1 : tahunIni;

    // 1. TOTAL KEGIATAN (Menggunakan ID: statTotalLaporan)
    if (document.getElementById("statTotalLaporan")) {
        document.getElementById("statTotalLaporan").innerText = dataGlobal.length;
    }

    // 2. DOWNTIME BULAN INI
    if (document.getElementById("statTotalHariIni")) {
        const countBlnIni = downtimeGlobal.filter(i => {
            const d = new Date(i.tanggalRaw);
            return i.tanggalRaw > 0 && d.getMonth() === bulanIni && d.getFullYear() === tahunIni;
        }).length;
        document.getElementById("statTotalHariIni").innerText = countBlnIni;
    }

    // 3. DOWNTIME BULAN LALU
    if (document.getElementById("statTotalPersonel")) {
        const countBlnLalu = downtimeGlobal.filter(i => {
            const d = new Date(i.tanggalRaw);
            return i.tanggalRaw > 0 && d.getMonth() === bulanLalu && d.getFullYear() === tahunLalu;
        }).length;
        document.getElementById("statTotalPersonel").innerText = countBlnLalu;
    }

    // 4. TX NORMAL
    if (document.getElementById("statEviden")) {
        const countNormal = statusGlobal.filter(i => {
            const s = i.status ? String(i.status).toLowerCase().trim() : "";
            return s === "normal" || s === "on" || s === "online" || s === "on air";
        }).length;
        document.getElementById("statEviden").innerText = countNormal;
    }

    // Panggil fungsi render untuk menampilkan data ke elemen HTML
    renderStatusTx();
    renderKegiatanTerbaru();
    renderDowntimeTerbaru();
    startAutoToggle();
}

function renderStatusTx() {
    const grid = document.getElementById("gridStatusTx");
    if (!grid) return;
    let html = "";
    statusGlobal.forEach(item => {
        let cls = "status-badge-warn"; 
        let s = item.status ? String(item.status).toLowerCase().trim() : "";
        if (s === "normal" || s === "on" || s === "online" || s === "on air") cls = "status-badge-on";
        if (s === "off" || s === "down" || s === "off-air") cls = "status-badge-off";
        html += `
            <div class="col-6 col-md-3">
                <div class="site-card p-2 text-center shadow-sm border">
                    <div class="small fw-bold text-dark">${item.site || 'N/A'}</div>
                    <span class="badge ${cls} w-100 mt-1" style="font-size:10px">${item.status || 'Unknown'}</span>
                </div>
            </div>`;
    });
    grid.innerHTML = html || '<p class="text-center w-100">Menunggu data site...</p>';
}

function renderKegiatanTerbaru() {
    const listRecent = document.getElementById("listRecentActivity");
    if (!listRecent) return;
    const dataUrut = [...dataGlobal].sort((a, b) => b.timestampTanggal - a.timestampTanggal);
    listRecent.innerHTML = dataUrut.slice(0, 5).map(i => `
        <li class="list-group-item d-flex justify-content-between align-items-center py-3">
            <div style="max-width: 85%;">
                <div class="fw-bold" style="font-size:14px; color:#003366">${i.nama}</div>
                <small class="text-muted">📅 ${i.tanggal}</small>
                <div class="mt-1 text-dark" style="font-size:13px; line-height:1.4;">
                    ${i.uraian ? i.uraian.substring(0, 65) : '-'}...
                </div>
            </div>
            <span class="badge bg-primary rounded-pill" style="font-size:10px">${i.shift || '-'}</span>
        </li>`).join('') || '<li class="list-group-item text-center">Belum ada aktivitas.</li>';
}

function renderDowntimeTerbaru() {
    const listContainer = document.getElementById("listDowntimeRecent");
    if (!listContainer || !downtimeGlobal.length) return;
    const latestDT = [...downtimeGlobal].sort((a, b) => b.tanggalRaw - a.tanggalRaw).slice(0, 5);
    listContainer.innerHTML = latestDT.map(i => `
        <li class="list-group-item border-0 py-3 border-bottom">
          <div class="fw-bold text-dark" style="font-size: 14px;">${i.site}</div>
          <small class="text-muted">${i.tanggal} • <span class="text-danger fw-bold">${formatDurasi(i.durasi)}</span></small>
          <div class="mt-1 small text-secondary text-truncate" style="font-style: italic;">"${i.keterangan}"</div>
        </li>
    `).join('');
}

// --- 4. LOGIKA TABEL & FILTER ---
function prosesFilterDropdown() {
    const filterNama = document.getElementById("filterNama");
    if (filterNama && (filterNama.options.length <= 1)) {
        const names = [...new Set(dataGlobal.map(i => i.nama))].filter(n => n).sort();
        let html = '<option value="Semua">-- Tampilkan Semua --</option>';
        names.forEach(n => html += `<option value="${n}">${n}</option>`);
        filterNama.innerHTML = html;
    }
}

function inisialisasiFilterTahun() {
    const s = document.getElementById("filterTahun");
    if (!s || s.options.length > 1) return;
    const tahunSekarang = new Date().getFullYear();
    let html = `<option value="Semua">Semua Tahun</option>`;
    for (let t = 2024; t <= tahunSekarang; t++) {
        html += `<option value="${t}">${t}</option>`;
    }
    s.innerHTML = html;
}

function tampilkanLogTabel() {
    const fNama = document.getElementById("filterNama").value;
    const fBulan = document.getElementById("filterBulan").value;
    const fTahun = document.getElementById("filterTahun") ? document.getElementById("filterTahun").value : "Semua";
    
    const tBody = document.getElementById("tabelBody");
    if (!tBody) return;

    const filtered = dataGlobal.filter(i => {
        const d = new Date(i.timestampTanggal); 
        const matchNama = (fNama === "Semua" || i.nama === fNama);
        const matchBulan = (fBulan === "Semua" || d.getMonth().toString() === fBulan);
        const matchTahun = (fTahun === "Semua" || d.getFullYear().toString() === fTahun);
        return matchNama && matchBulan && matchTahun;
    });

    // Sortir: Terakhir diisi form (Row 0) berada di paling atas
    const sorted = filtered.sort((a, b) => b.timestampAsli - a.timestampAsli);

    tBody.innerHTML = sorted.map(i => {
        let docs = "";
        if (i.link1 && i.link1.trim().startsWith("http")) docs += `<a href="${i.link1}" target="_blank" class="btn btn-primary btn-eviden me-1" style="font-size:10px">E1</a>`;
        if (i.link2 && i.link2.trim().startsWith("http")) docs += `<a href="${i.link2}" target="_blank" class="btn btn-info btn-eviden text-white me-1" style="font-size:10px">E2</a>`;
        if (i.link3 && i.link3.trim().startsWith("http")) docs += `<a href="${i.link3}" target="_blank" class="btn btn-secondary btn-eviden" style="font-size:10px">E3</a>`;
        
        return `<tr>
            <td class="text-center" style="white-space:nowrap;">${i.tanggal}</td>
            <td><strong>${i.nama}</strong></td>
            <td class="text-center">${i.shift || '-'}</td>
            <td class="text-center" style="white-space:nowrap;">${i.waktu}</td>
            <td>${i.sasaran || ''}</td>
            <td>${i.uraian || ''}</td>
            <td class="text-center">${docs || '-'}</td>
            <td>${i.keterangan || '-'}</td>
        </tr>`;
    }).join('') || '<tr><td colspan="8" class="text-center py-4">Tidak ada data untuk periode ini.</td></tr>';
}

// --- 5. DOWNTIME LOGIC ---
function inisialisasiFilterDowntime() {
    const sTahun = document.getElementById("filterDTTahun");
    if (!sTahun || sTahun.options.length > 1) return;
    const years = [...new Set(downtimeGlobal.map(i => new Date(i.tanggal).getFullYear()))].sort((a,b) => b-a);
    let html = '<option value="Semua">Semua Tahun</option>';
    years.forEach(y => { if(!isNaN(y)) html += `<option value="${y}">${y}</option>`; });
    sTahun.innerHTML = html;
}

function renderGrafikDowntime() {
    const canvas = document.getElementById('chartDowntime');
    const filterBulan = document.getElementById("filterDTBulan");
    const filterTahun = document.getElementById("filterDTTahun");

    // PELINDUNG: Jika elemen tidak ada di halaman ini, jangan teruskan
    if (!canvas || !filterBulan || !filterTahun || !downtimeGlobal.length) return;

    const b = filterBulan.value;
    const t = filterTahun.value;
    
    const dataMap = {};
    // Pastikan daftarTxGlobal adalah array
    (daftarTxGlobal || []).forEach(s => dataMap[s] = 0);

    const filtered = downtimeGlobal.filter(i => {
        if (!i.tanggalRaw) return false;
        const d = new Date(i.tanggalRaw);
        const matchBulan = (b === "Semua" || d.getMonth().toString() === b);
        const matchTahun = (t === "Semua" || d.getFullYear().toString() === t);
        return matchBulan && matchTahun;
    });

    filtered.forEach(i => {
        if (i.site && dataMap.hasOwnProperty(i.site)) dataMap[i.site] += 1;
    });

    const sortedArray = Object.keys(dataMap).map(k => ({s: k, v: dataMap[k]})).sort((x, y) => y.v - x.v);

    if (chartDowntimeInstance) chartDowntimeInstance.destroy();
    chartDowntimeInstance = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: sortedArray.map(i => (i.s || "").replace(/Satuan Transmisi /gi, "").trim()),
            datasets: [{ 
                label: 'Frekuensi Gangguan', 
                data: sortedArray.map(i => i.v), 
                backgroundColor: '#d9534f' 
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { ticks: { minRotation: 0, maxRotation: 0, autoSkip: false, font: { size: 10 } } },
                y: { beginAtZero: true, ticks: { stepSize: 1 } }
            }
        }
    });
}

function renderGrafikPetugasDowntime() {
    const canvas = document.getElementById('chartPetugasDowntime');
    const filterBulan = document.getElementById("filterDTBulan");
    const filterTahun = document.getElementById("filterDTTahun");

    if (!canvas || !filterBulan || !filterTahun || !downtimeGlobal.length) return;

    const b = filterBulan.value;
    const t = filterTahun.value;
    
    const filtered = downtimeGlobal.filter(i => {
        if (!i.tanggalRaw) return false;
        const d = new Date(i.tanggalRaw);
        const matchBulan = (b === "Semua" || d.getMonth().toString() === b);
        const matchTahun = (t === "Semua" || d.getFullYear().toString() === t);
        return matchBulan && matchTahun;
    });

    const counts = {};
    filtered.forEach(i => {
        if (i.petugas) {
            const listNama = i.petugas.split(/[,&]| dan /); 
            listNama.forEach(nama => {
                const namaBersih = nama.trim();
                if (namaBersih) counts[namaBersih] = (counts[namaBersih] || 0) + 1;
            });
        }
    });

    const sortedLabels = Object.keys(counts).sort(); 
    const sortedValues = sortedLabels.map(label => counts[label]);

    if (chartPetugasDTInstance) chartPetugasDTInstance.destroy();
    chartPetugasDTInstance = new Chart(canvas.getContext('2d'), {
        type: 'line', 
        data: {
            labels: sortedLabels,
            datasets: [{
                label: 'Kontribusi Laporan',
                data: sortedValues,
                borderColor: '#003366',
                backgroundColor: 'rgba(0, 51, 102, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.1, 
                pointRadius: 5,
                pointBackgroundColor: '#d9534f'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1 } },
                x: { ticks: { autoSkip: false } }
            }
        }
    });
}

function renderGrafikTotalDowntime() {
    const canvas = document.getElementById('chartTotalDowntime');
    const filterBulan = document.getElementById("filterDTBulan");
    const filterTahun = document.getElementById("filterDTTahun");

    if (!canvas || !filterBulan || !filterTahun || !downtimeGlobal.length) return;

    const b = filterBulan.value;
    const t = filterTahun.value;
    
    const durasiMap = {};
    (daftarTxGlobal || []).forEach(s => durasiMap[s] = 0);

    const filtered = downtimeGlobal.filter(i => {
        if (!i.tanggalRaw) return false;
        const d = new Date(i.tanggalRaw);
        const matchBulan = (b === "Semua" || d.getMonth().toString() === b);
        const matchTahun = (t === "Semua" || d.getFullYear().toString() === t);
        return matchBulan && matchTahun;
    });

    filtered.forEach(i => {
        if (i.site && durasiMap.hasOwnProperty(i.site)) {
            durasiMap[i.site] += (parseInt(i.durasi) || 0);
        }
    });

    const sortedArray = Object.keys(durasiMap).map(k => ({ s: k, v: durasiMap[k] })).sort((x, y) => y.v - x.v);

    if (chartTotalDowntimeInstance) chartTotalDowntimeInstance.destroy();
    chartTotalDowntimeInstance = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: sortedArray.map(i => (i.s || "").replace(/Satuan Transmisi /gi, "").trim()),
            datasets: [{ 
                label: 'Total Durasi', 
                data: sortedArray.map(i => i.v), 
                backgroundColor: '#d9534f' 
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) { return 'Total: ' + formatDurasi(context.raw); }
                    }
                }
            },
            scales: { 
                x: { 
                    ticks: { minRotation: 0, maxRotation: 0, autoSkip: false, font: { size: 10 } } 
                },
                y: { 
                    beginAtZero: true,
                    // PERUBAHAN DI SINI: suggestedMax dihapus agar skala reset tiap filter
                    ticks: {
                        stepSize: 300, // Tetap per 5 jam agar rapi
                        callback: function(value) { return formatDurasi(value); }
                    },
                    title: { display: true, text: 'Durasi (Jam-Menit)' }
                } 
            }
        }
    });
}

function tampilkanTabelDowntime() {
    const tBody = document.getElementById("tabelDowntimeBody");
    if (!tBody) return;

    // 1. Ambil nilai filter dari dropdown yang ada di downtime.html
    const b = document.getElementById("filterDTBulan").value;
    const t = document.getElementById("filterDTTahun").value;

    // 2. Filter data berdasarkan tanggal kejadian (tanggalRaw), bukan waktu kirim form
    const filtered = downtimeGlobal.filter(i => {
        const d = new Date(i.tanggalRaw); // Pastikan ini merujuk ke Kolom C Spreadsheet
        const matchBulan = (b === "Semua" || d.getMonth().toString() === b);
        const matchTahun = (t === "Semua" || d.getFullYear().toString() === t);
        return matchBulan && matchTahun;
    });

    // 3. Urutkan agar data paling baru (Mei) muncul di paling atas
    const sorted = filtered.sort((x, y) => y.tanggalRaw - x.tanggalRaw);

    // 4. Render ke tabel
    tBody.innerHTML = sorted.map(i => {
        let ev = "";
        if (i.bukti1 && i.bukti1.includes("http")) {
            ev += `<a href="${i.bukti1}" target="_blank" class="btn btn-sm btn-primary me-1" style="font-size:10px">E1</a>`;
        }
        if (i.bukti2 && i.bukti2.includes("http")) {
            ev += `<a href="${i.bukti2}" target="_blank" class="btn btn-sm btn-info text-white" style="font-size:10px">E2</a>`;
        }

       return `
        <tr>
            <td class="text-center">${i.tanggal}</td>
            <td class="fw-bold">${i.site}</td>
            <td class="text-center">${i.waktu}</td>
            <td class="text-center text-danger fw-bold">${formatDurasi(i.durasi)}</td>
            <td>${i.keterangan}</td>
            <td class="text-center">${i.petugas}</td>
            <td class="text-center">${ev || '-'}</td>
        </tr>`;
    }).join('') || '<tr><td colspan="7" class="text-center py-4 text-muted">⚠️ Tidak ada data.</td></tr>';
}

function updateHalamanDowntime() {
    renderGrafikDowntime();   // Update Grafiknya
    renderGrafikTotalDowntime();
    renderGrafikPetugasDowntime();
    tampilkanTabelDowntime(); // Update Tabelnya
}

// --- 6. SIDEBAR & UTILITY ---
function renderSidebar() {
    const container = document.getElementById('sidebar-container');
    if (!container) return;
    const page = window.location.pathname.split("/").pop() || "index.html";

    let sidebarHTML = `
    <div class="offcanvas offcanvas-start text-white" tabindex="-1" id="menuSidebar" style="background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%);">
      <div class="offcanvas-header border-bottom border-secondary">
        <h5 class="offcanvas-title fw-bold">MENU NAVIGASI</h5>
        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="offcanvas"></button>
      </div>
      <div class="offcanvas-body p-0 mt-3">
        <div class="list-group list-group-flush">
          <a href="index.html" class="menu-modern ${page === 'index.html' ? 'active' : ''}">🏠 Statistik Utama</a>
          
          <!-- DROPDOWN INPUT FORM -->
          <div class="nav-item mx-3 my-1">
            <a class="menu-modern w-100 justify-content-between d-flex" data-bs-toggle="collapse" href="#menuForms" role="button">
              <span><i class="bi bi-pencil-square me-2 text-danger"></i> Input Form</span>
              <i class="bi bi-chevron-down small"></i>
            </a>
            <div class="collapse ps-4" id="menuForms">
              <a href="URL_FORM_1" target="_blank" class="text-decoration-none text-muted d-block py-2 small border-bottom border-secondary"><i class="bi bi-file-text me-2"></i> Log Harian</a>
              <a href="URL_FORM_2" target="_blank" class="text-decoration-none text-muted d-block py-2 small border-bottom border-secondary"><i class="bi bi-broadcast me-2"></i> Laporan Downtime</a>
              <a href="URL_FORM_3" target="_blank" class="text-decoration-none text-muted d-block py-2 small border-bottom border-secondary"><i class="bi bi-fuel-pump me-2"></i> Laporan BBM</a>
              <a href="URL_FORM_4" target="_blank" class="text-decoration-none text-muted d-block py-2 small border-bottom border-secondary"><i class="bi bi-check-circle me-2"></i> Redundansi</a>
              <a href="URL_FORM_5" target="_blank" class="text-decoration-none text-muted d-block py-2 small border-bottom border-secondary"><i class="bi bi-box-seam me-2"></i> Stok Sparepart</a>
              <a href="URL_FORM_6" target="_blank" class="text-decoration-none text-muted d-block py-2 small"><i class="bi bi-person-badge me-2"></i> Tamu/Vendor</a>
            </div>
          </div>

          <a href="log-petugas.html" class="menu-modern ${page === 'log-petugas.html' ? 'active' : ''}">📋 Log Kinerja</a>
          <a href="downtime.html" class="menu-modern ${page === 'downtime.html' ? 'active' : ''}">📉 Downtime Transmisi</a>
          <a href="statistik.html" class="menu-modern ${page === 'statistik.html' ? 'active' : ''}">📈 Statistik</a>
          
          <hr class="mx-3 my-2 opacity-10">
          <a href="#" data-bs-toggle="modal" data-bs-target="#profilModal" onclick="isiDataProfil()" class="menu-modern">👤 Profil User</a>
          <a href="#" ${isLoggedIn ? 'onclick="logoutAdmin()"' : 'data-bs-toggle="modal" data-bs-target="#loginModal"'} class="menu-modern">
            <span>${isLoggedIn ? '🔓 Logout Admin' : '🔐 Login Admin'}</span>
          </a>
        </div>
      </div>
    </div>

    <div class="modal fade" id="loginModal" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered">
    <div class="modal-content border-0 shadow">
      <div class="modal-header text-white" style="background-color: #003366;">
        <h5 class="modal-title">🔐 Login Admin</h5>
        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
      </div>
      <div class="modal-body p-4">
        <input type="text" id="inputUser" class="form-control mb-2" placeholder="Username">
        <input type="password" id="inputPass" class="form-control mb-3" placeholder="Password">
        <button onclick="prosesLogin()" class="btn btn-primary w-100">MASUK</button>
      </div>
    </div>
  </div>
</div>

<div class="modal fade" id="profilModal" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered">
    <div class="modal-content border-0 shadow text-dark">
      <div class="modal-header text-white" style="background-color: #003366;">
        <h5 class="modal-title">👤 Profil Petugas</h5>
        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
      </div>
      <div class="modal-body text-center p-4">
        <img src="" class="rounded-circle mb-3 shadow-sm" id="profPic" style="width:100px; height:100px;">
        <h4 class="fw-bold mb-0" id="profNama">Nama Petugas</h4>
        <p class="text-muted small mb-3">Asisten Teknisi Siaran - TVRI Riau</p>
        <div class="text-start border-top pt-3">
          <div class="mb-2">
            <small class="fw-bold text-muted">STATUS LOGIN:</small><br>
            <span class="badge bg-success">Petugas Umum</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
    </div>`;
    container.innerHTML = sidebarHTML;
}

async function prosesLogin() {
    const user = document.getElementById('inputUser').value;
    const pass = document.getElementById('inputPass').value;
    const btn = document.querySelector("#loginModal button");
    
    if (!user || !pass) return alert("Isi username dan password!");

    // Tampilkan status loading pada tombol
    const teksAsli = btn.innerText;
    btn.innerText = "⏳ Memverifikasi...";
    btn.disabled = true;

    try {
        // Kirim permintaan verifikasi ke server
        const response = await fetch(`${SCRIPT_URL}?action=login&user=${encodeURIComponent(user)}&pass=${encodeURIComponent(pass)}`);
        const result = await response.json();

        if (result.success) {
            isLoggedIn = true;
            localStorage.setItem("isLoggedIn", "true");
            alert("Otorisasi Berhasil!");
            
            // Tutup modal secara otomatis
            const modalElement = document.getElementById('loginModal');
            const modal = bootstrap.Modal.getInstance(modalElement);
            if (modal) modal.hide();
            
            location.reload(); 
        } else {
            alert("Username atau Password Salah!");
        }
    } catch (error) {
        console.error("Login Error:", error);
        alert("Gagal terhubung ke server. Periksa koneksi internet.");
    } finally {
        btn.innerText = teksAsli;
        btn.disabled = false;
    }
}

function logoutAdmin() {
    isLoggedIn = false;
    localStorage.setItem("isLoggedIn", "false");
    renderSidebar();
    if (document.getElementById("btnPreview")) cekStatusTombolPreview();
    alert("Berhasil Logout.");
}

async function buatPreview() {
    if (!isLoggedIn) return alert("Silakan login Admin!");
    const n = document.getElementById("filterNama").value;
    const b = document.getElementById("filterBulan").value;
    const t = document.getElementById("filterTahun").value;
    const btn = document.getElementById("btnPreview");
    btn.innerHTML = "⏳ Sedang Memproses...";
    btn.disabled = true;
    try {
        const res = await fetch(`${SCRIPT_URL}?action=previewPDF&nama=${encodeURIComponent(n)}&bulan=${b}&tahun=${t}`);
        const data = await res.json();
        btn.innerHTML = "📄 PDF PREVIEW"; btn.disabled = false;
        if (data.success) {
            document.getElementById("tempatLink").innerHTML = `<a href="${data.url}" target="_blank" class="btn btn-primary w-100 mt-2">🚀 BUKA PDF (${n})</a>`;
        } else { alert("Gagal: " + data.message); }
    } catch (e) { alert("Koneksi gagal!"); btn.innerHTML = "📄 PDF PREVIEW"; btn.disabled = false; }
}

function cekStatusTombolPreview() {
    const filterNama = document.getElementById("filterNama");
    const btnPreview = document.getElementById("btnPreview");
    if (!filterNama || !btnPreview) return;
    if (isLoggedIn && filterNama.value !== "Semua") {
        btnPreview.disabled = false; btnPreview.classList.remove("btn-secondary"); btnPreview.classList.add("btn-success");
    } else {
        btnPreview.disabled = true; btnPreview.classList.add("btn-secondary"); btnPreview.classList.remove("btn-success");
    }
}

function isiDataProfil() {
    let namaTampilan = isLoggedIn ? "Admin" : "Anonymous";
    const elNama = document.getElementById('profNama');
    const elPic = document.getElementById('profPic');
    if (elNama) elNama.innerText = namaTampilan;
    if (elPic) elPic.src = `https://ui-avatars.com/api/?name=${namaTampilan}&background=003366&color=fff&size=128`;
}

function formatTanggalIndo(ts) {
    if (!ts) return "-";
    const d = new Date(ts);
    const bln = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    return `${d.getDate()} ${bln[d.getMonth()]} ${d.getFullYear()}`;
}

function startAutoToggle() {
    const slides = [
        document.getElementById('itemStatus'),
        document.getElementById('itemRecent'),
        document.getElementById('itemDowntimeRecent')
    ];
    
    if (!slides[0] || !slides[1] || !slides[2]) return;

    let currentIdx = 0;
    if (window.autoToggleInterval) clearInterval(window.autoToggleInterval);

    window.autoToggleInterval = setInterval(() => {
        slides[currentIdx].classList.remove('active');
        currentIdx = (currentIdx + 1) % slides.length;
        slides[currentIdx].classList.add('active');
    }, 8000);
}

function renderGrafik() {
    const canvas = document.getElementById('grafikPegawai');
    if (!canvas) return; 
    const ctx = canvas.getContext('2d');
    const counts = {};
    dataGlobal.forEach(i => { if(i.nama) counts[i.nama] = (counts[i.nama] || 0) + 1; });
    if (grafikInstance) grafikInstance.destroy();
    grafikInstance = new Chart(ctx, {
        type: 'bar',
        data: { labels: Object.keys(counts), datasets: [{ label: 'Total Kegiatan', data: Object.values(counts), backgroundColor: '#003366' }] },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function formatDurasi(totalMenit) {
    if (!totalMenit || totalMenit === 0) return "0 Menit";
    
    const jam = Math.floor(totalMenit / 60);
    const menit = totalMenit % 60;

    if (jam > 0) {
        return menit > 0 ? `${jam} Jam ${menit} Menit` : `${jam} Jam`;
    } else {
        return `${menit} Menit`;
    }
}

// --- 8. RUN ON START ---
document.addEventListener("DOMContentLoaded", () => {
    muatDataOtomatis();
    startAutoToggle(); 
});
setInterval(muatDataOtomatis, 600000);