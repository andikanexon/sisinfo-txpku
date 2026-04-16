// --- 1. KONFIGURASI API & GLOBAL ---
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw5TdGNPS58uNfg5vC4ysxN-4_t6ojjcnF80LZU28YEZ776LmevU5170bJ94qRO7Pf1/exec"; 

let dataGlobal = []; 
let statusGlobal = []; 
let downtimeGlobal = []; 
let grafikInstance = null;
let chartDowntimeInstance = null; 
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
    
    if (document.getElementById("tabelBody")) {
        prosesFilterDropdown(); 
        inisialisasiFilterTahun(); 
        tampilkanLogTabel();
        cekStatusTombolPreview();
    }
    
    if (document.getElementById("grafikPegawai")) renderGrafik();

    if (document.getElementById("chartDowntime")) {
        inisialisasiFilterDowntime();
        renderGrafikDowntime();
        tampilkanTabelDowntime();
        updateHalamanDowntime();
    }
}

// --- 3. LOGIKA DASHBOARD (index.html) ---
function updateBeranda() {
    // Statistik Atas
    if (document.getElementById("statTotalLaporan")) document.getElementById("statTotalLaporan").innerText = dataGlobal.length;
    if (document.getElementById("statHariIni")) {
        const hariIni = new Date().toLocaleDateString('en-CA');
        const count = dataGlobal.filter(i => new Date(i.timestampTanggal).toLocaleDateString('en-CA') === hariIni).length;
        document.getElementById("statHariIni").innerText = count;
    }
    if (document.getElementById("statTotalPersonel")) {
        const listPetugas = [...new Set(dataGlobal.map(i => i.nama))].filter(n => n);
        document.getElementById("statTotalPersonel").innerText = listPetugas.length;
    }
    if (document.getElementById("statEviden")) {
        const txNormal = statusGlobal.filter(i => {
            const s = i.status ? String(i.status).toLowerCase().trim() : "";
            return s === "normal" || s === "on" || s === "online" || s === "on air";
        }).length;
        document.getElementById("statEviden").innerText = txNormal;
    }

    // Render Grid Status TX
    let statusHtml = "";
    statusGlobal.forEach(item => {
        let cls = "status-badge-warn"; 
        let s = item.status ? String(item.status).toLowerCase().trim() : "";
        if (s === "normal" || s === "on" || s === "online" || s === "on air") cls = "status-badge-on";
        if (s === "off" || s === "down" || s === "off-air") cls = "status-badge-off";
        statusHtml += `
            <div class="col-6 col-md-3">
                <div class="site-card p-2 text-center shadow-sm border">
                    <div class="small fw-bold text-dark">${item.site || 'Tanpa Nama'}</div>
                    <span class="badge ${cls} w-100 mt-1" style="font-size:10px">${item.status || 'Unknown'}</span>
                </div>
            </div>`;
    });
    const grid = document.getElementById("gridStatusTx");
    if (grid) grid.innerHTML = statusHtml || '<p class="text-center w-100">Menunggu data site...</p>';

    // Render 5 Kegiatan Terbaru (URAIAIN DIKEMBALIKAN)
    const dataUrut = [...dataGlobal].sort((a, b) => new Date(b.timestampTanggal) - new Date(a.timestampTanggal));
    const listRecent = document.getElementById("listRecentActivity");
    if (listRecent) {
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
            </li>`).join('') || '<li class="list-group-item text-center">Belum ada aktivitas</li>';
    }
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
    if (!canvas) return;

    if (daftarTxGlobal.length === 0) return;

    // 1. Inisialisasi data awal (0) untuk semua site
    const dataMap = {};
    daftarTxGlobal.forEach(site => { dataMap[site.trim()] = 0; });

    const bulan = document.getElementById("filterDTBulan").value;
    const tahun = document.getElementById("filterDTTahun").value;

    const filtered = downtimeGlobal.filter(i => {
        const d = new Date(i.tanggal);
        return (bulan === "Semua" || d.getMonth().toString() === bulan) &&
               (tahun === "Semua" || d.getFullYear().toString() === tahun);
    });

    // 2. Hitung jumlah kejadian
    filtered.forEach(i => {
        const namaSite = i.site ? i.site.trim() : "";
        if (dataMap.hasOwnProperty(namaSite)) {
            dataMap[namaSite] += 1;
        }
    });

    // --- 3. LOGIKA SORTIR (TERTINGGI KE TERENDAH) ---
    // Ubah object dataMap menjadi array agar bisa disortir
    let arrayData = Object.keys(dataMap).map(key => {
        return { site: key, jumlah: dataMap[key] };
    });

    // Sortir array berdasarkan jumlah (descending)
    arrayData.sort((a, b) => b.jumlah - a.jumlah);

    // Ambil kembali label dan nilainya setelah disortir
    const labelsSorted = arrayData.map(item => item.site);
    const valuesSorted = arrayData.map(item => item.jumlah);
    // ------------------------------------------------

    if (chartDowntimeInstance) chartDowntimeInstance.destroy();
    
    chartDowntimeInstance = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: labelsSorted, // Menggunakan label yang sudah urut
            datasets: [{
                label: 'Frekuensi Downtime (Kali)',
                data: valuesSorted, // Menggunakan nilai yang sudah urut
                backgroundColor: '#dc3545',
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { 
                    beginAtZero: true,
                    suggestedMax: 12, // Skala minimal 12, bertambah jika data > 12
                    ticks: { stepSize: 1 },
                    title: { 
                        display: true, 
                        text: 'Jumlah Downtime', 
                        font: { weight: 'bold', size: 14 } 
                    }
                },
                x: { 
                    title: { 
                        display: true, 
                        text: 'Satuan Transmisi', 
                        font: { weight: 'bold', size: 14 } 
                    },
                    ticks: { maxRotation: 45, minRotation: 45, autoSkip: false }
                }
            },
            plugins: { legend: { display: false } }
        }
    });
}

function tampilkanTabelDowntime() {
    const tBody = document.getElementById("tabelDowntimeBody");
    if (!tBody) return;

    // 1. Ambil nilai filter
    const b = document.getElementById("filterDTBulan").value;
    const t = document.getElementById("filterDTTahun").value;

    // 2. Filter data dari downtimeGlobal
    const filtered = downtimeGlobal.filter(i => {
        // Kita gunakan tanggalRaw (timestamp) agar filter akurat
        const d = new Date(i.tanggalRaw);
        const matchBulan = (b === "Semua" || d.getMonth().toString() === b);
        const matchTahun = (t === "Semua" || d.getFullYear().toString() === t);
        return matchBulan && matchTahun;
    });

    // 3. Sortir: Tanggal terbaru di atas
    const sorted = filtered.sort((x, y) => y.tanggalRaw - x.tanggalRaw);

    // 4. Render ke Tabel
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
            <td class="text-center text-danger fw-bold">${i.durasi} Menit</td>
            <td>${i.keterangan}</td>
            <td class="text-center">${i.petugas}</td>
            <td class="text-center">${ev || '-'}</td>
        </tr>`;
    }).join('') || '<tr><td colspan="7" class="text-center py-4 text-muted">⚠️ Tidak ada data downtime pada periode ini.</td></tr>';
}

function updateHalamanDowntime() {
    renderGrafikDowntime();   // Update Grafiknya
    tampilkanTabelDowntime(); // Update Tabelnya
}

// --- 6. SIDEBAR & UTILITY ---
function renderSidebar() {
    const container = document.getElementById('sidebar-container');
    if (!container) return;
    const page = window.location.pathname.split("/").pop() || "index.html";

    let sidebarHTML = `
    <div class="offcanvas offcanvas-start text-white" tabindex="-1" id="menuSidebar">
      <div class="offcanvas-header"><h5 class="offcanvas-title">Menu</h5><button type="button" class="btn-close btn-close-white" data-bs-dismiss="offcanvas"></button></div>
      <div class="offcanvas-body p-0 mt-3">
        <div class="list-group list-group-flush">
          <a href="index.html" class="menu-modern ${page === 'index.html' ? 'active' : ''}">🏠 Dashboard</a>
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

function prosesLogin() {
    const user = document.getElementById('inputUser').value;
    const pass = document.getElementById('inputPass').value;
    if (user === "Admin" && pass === "txpku1") {
        isLoggedIn = true;
        localStorage.setItem("isLoggedIn", "true");
        const modalElement = document.getElementById('loginModal');
        const modal = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
        modal.hide();
        renderSidebar();
        if (document.getElementById("btnPreview")) cekStatusTombolPreview();
        alert("Otorisasi Berhasil!");
    } else {
        alert("Username/Password Salah!");
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
    const sEl = document.getElementById('itemStatus');
    const rEl = document.getElementById('itemRecent');
    if (!sEl || !rEl) return;
    setInterval(() => {
        if (currentSlide === 'status') {
            sEl.classList.remove('active'); rEl.classList.add('active'); currentSlide = 'recent';
        } else {
            rEl.classList.remove('active'); sEl.classList.add('active'); currentSlide = 'status';
        }
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

// --- 8. RUN ON START ---
document.addEventListener("DOMContentLoaded", () => {
    muatDataOtomatis();
    startAutoToggle(); 
});
setInterval(muatDataOtomatis, 600000);