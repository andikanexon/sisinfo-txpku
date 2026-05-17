// --- 1. KONFIGURASI API & GLOBAL ---
const scriptURL = "https://script.google.com/macros/s/AKfycbyiWlWAggIvdXxR7jEilCO7Ov2QyhUXgy_QjXAKSQQUpCOEc0NeZuJzklXIOVJeqK_1/exec"; 
const urlFormMaster = {
    dvbt2: "https://s.id/formetering",
    downtime: "https://s.id/downtimetx",
    bbm: "",
    redundansi: "",
    sparepart: "",
    tamu: ""
};

let dataGlobal = []; 
let statusGlobal = []; 
let downtimeGlobal = [];
let daftarTxGlobal = [];
let daftarPetugasGlobal = [];
let parameterGlobal = []; 
let chartPetugasParamInstance = null;
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
        const response = await fetch(`${scriptURL}?action=ambilData`);
        const data = await response.json();
        
        // --- ISI VARIABEL GLOBAL ---
        dataGlobal = data.logs || [];
        statusGlobal = data.statusTx || []; // Data untuk kotak lampu
        downtimeGlobal = data.downtime || [];
        parameterGlobal = data.parameters || [];
        
        // PERBAIKAN: Gunakan data.settings
        if (data.settings) {
            daftarTxGlobal = data.settings.daftarTx || [];
            daftarPetugasGlobal = data.settings.daftarPetugas || [];
            localStorage.setItem("masterUser", data.settings.adminUser);
            localStorage.setItem("masterPassword", data.settings.accessKey);
        }

        renderSidebar();
        
        // JALANKAN LOGIKA HALAMAN (Jangan panggil inisialisasiHalaman yang lama)
        distribusiHalaman(); 

        const skrg = new Date();
        if (document.getElementById("lastUpdated")) {
            document.getElementById("lastUpdated").innerText = `Update: ${skrg.getHours().toString().padStart(2, '0')}:${skrg.getMinutes().toString().padStart(2, '0')} WIB`;
        }
        if (icon) icon.innerText = "✅";
        setTimeout(() => { if (icon) icon.innerText = "🔄"; }, 3000);
    } catch (error) {
        console.error("Gagal Sinkron Master:", error);
    }
}

function distribusiHalaman() {
    const loading = document.getElementById("loadingScreen");
    if (loading) loading.style.display = "none";
    if (document.getElementById("mainContent")) document.getElementById("mainContent").classList.remove("d-none");

    // Jika di Beranda (index.html)
    if (document.getElementById("gridStatusTx")) {
        updateBeranda(); 
        jalankanSlider(); 
    }

    // Jika di Log Petugas (log-petugas.html)
    if (document.getElementById("tabelBody")) {
        if (isLoggedIn) {
            prosesFilterDropdown(); 
            inisialisasiFilterTahun(); 
            tampilkanLogTabel();
        } else {
            document.getElementById("sectionLogTabel")?.classList.add("d-none");
            document.getElementById("aksesDitolak")?.classList.remove("d-none");
        }
    }

    // --- PERBAIKAN HALAMAN PARAMETER (parameter.html) ---
    if (document.getElementById("tabelParameterBody")) {
        renderSidebar(); // Tambahkan ini agar sidebar muncul
        inisialisasiSemuaFilterParameter(); 
        tampilkanTabelParameter(); 
    }

    // Jika di Downtime (downtime.html)
    if (document.getElementById("chartDowntime")) {
        renderSidebar();
        inisialisasiFilterDowntime();
        updateHalamanDowntime();
    }

    if (document.getElementById("tabelParameterBody")) {
    renderSidebar();
    inisialisasiSemuaFilterParameter();
    tampilkanTabelParameter();
    renderGrafikPetugasParameter(); // Tambahkan ini
    }
}

function inisialisasiSemuaFilterParameter() {
    const sUnit = document.getElementById("filterUnit");
    const sTahun = document.getElementById("filterTahunParam");

    // Jika dropdown Unit tidak ada, jangan lanjutkan (agar tidak error)
    if (!sUnit) return; 
    
    // Jika dropdown sudah terisi, jangan isi ulang
    if (sUnit.options.length > 1) return;

    // 1. Filter Unit Kerja (Pembersihan Spasi dengan .trim())
    const units = [...new Set(parameterGlobal.map(i => i.unit ? i.unit.trim() : ""))].filter(u => u).sort();
    units.forEach(u => sUnit.add(new Option(u, u)));

    // 2. Filter Tahun (Hanya jika elemennya ada di HTML)
    if (sTahun) {
        const years = [...new Set(parameterGlobal.map(i => {
            const d = new Date(i.tanggalRaw);
            return isNaN(d.getFullYear()) ? null : d.getFullYear();
        }))].filter(y => y).sort((a,b) => b - a);
        years.forEach(y => sTahun.add(new Option(y, y)));
    }
}

// --- 3. LOGIKA DASHBOARD (index.html) ---
function updateBeranda() {
    const skrg = new Date();
    const bulanIni = skrg.getMonth();
    const tahunIni = skrg.getFullYear();

    const bulanLalu = bulanIni === 0 ? 11 : bulanIni - 1;
    const tahunLalu = bulanIni === 0 ? tahunIni - 1 : tahunIni;

    // --- BAGIAN 1: STATISTIK (Milik Anda) ---
    if (document.getElementById("statTotalLaporan")) {
        document.getElementById("statTotalLaporan").innerText = dataGlobal.length;
    }

    if (document.getElementById("statTotalHariIni")) {
        const countBlnIni = downtimeGlobal.filter(i => {
            const d = new Date(i.tanggalRaw);
            return i.tanggalRaw > 0 && d.getMonth() === bulanIni && d.getFullYear() === tahunIni;
        }).length;
        document.getElementById("statTotalHariIni").innerText = countBlnIni;
    }

    if (document.getElementById("statTotalPersonel")) {
        const countBlnLalu = downtimeGlobal.filter(i => {
            const d = new Date(i.tanggalRaw);
            return i.tanggalRaw > 0 && d.getMonth() === bulanLalu && d.getFullYear() === tahunLalu;
        }).length;
        document.getElementById("statTotalPersonel").innerText = countBlnLalu;
    }

    if (document.getElementById("statEviden")) {
        const countNormal = statusGlobal.filter(i => {
            const s = i.status ? String(i.status).toLowerCase().trim() : "";
            return s === "normal" || s === "on" || s === "online" || s === "on air";
        }).length;
        document.getElementById("statEviden").innerText = countNormal;
    }

    const slideStatus = document.getElementById("slideStatus");
    const slideKegiatan = document.getElementById("slideKegiatan");
    const slideDowntime = document.getElementById("slideDowntime");

    if (!slideStatus) return;

    // 1. Sembunyikan semua dan hilangkan efek aktif
    [slideStatus, slideKegiatan, slideDowntime].forEach(el => {
        if (el) {
            el.classList.remove("active", "show-flex");
            el.classList.add("d-none");
        }
    });

    // 2. Tentukan slide mana yang akan ditampilkan
    let targetSlide;
    if (currentSlide === 'status') targetSlide = slideStatus;
    else if (currentSlide === 'kegiatan') targetSlide = slideKegiatan;
    else if (currentSlide === 'downtime') targetSlide = slideDowntime;

    if (targetSlide) {
        // A. Munculkan elemen (tapi masih transparan)
        targetSlide.classList.remove("d-none");
        targetSlide.classList.add("show-flex");

        // B. FORCE REFLOW: Trik agar browser sadar ada perubahan status display
        void targetSlide.offsetWidth; 

        // C. Jalankan animasi fade-in
        targetSlide.classList.add("active");

        // D. Panggil fungsi render datanya
        if (currentSlide === 'status') renderStatusTx();
        else if (currentSlide === 'kegiatan') renderKegiatanTerbaru();
        else if (currentSlide === 'downtime') renderDowntimeTerbaru();
    }
}

function renderStatusTx() {
    const grid = document.getElementById("gridStatusTx");
    if (!grid) return;
    
    if (!statusGlobal || statusGlobal.length === 0) {
        grid.innerHTML = '<p class="text-center w-100">Data Transmisi Tidak Tersedia.</p>';
        return;
    }

    let html = "";
    statusGlobal.forEach(item => {
        let cls = "status-badge-warn"; 
        let s = item.status ? String(item.status).toLowerCase().trim() : "";
        
        // Logika Warna
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
    grid.innerHTML = html;
}

function renderKegiatanTerbaru() {
    const listRecent = document.getElementById("listRecentActivity");
    if (!listRecent || !dataGlobal.length) return;

    // Proses pengurutan:
    // 1. Berdasarkan Tanggal Kegiatan (Kolom F)
    // 2. Berdasarkan Waktu Input (Timestamp) jika tanggal sama
    const dataUrut = [...dataGlobal].sort((a, b) => {
        if (b.tanggalRaw !== a.tanggalRaw) {
            return b.tanggalRaw - a.tanggalRaw;
        }
        return b.timestampRaw - a.timestampRaw;
    });

    // Tampilkan 5 data teratas
    listRecent.innerHTML = dataUrut.slice(0, 5).map(i => `
        <li class="list-group-item d-flex justify-content-between align-items-center py-3">
            <div style="max-width: 85%;">
                <div class="fw-bold" style="font-size:14px; color:#003366">${i.nama}</div>
                <small class="text-muted">📅 ${formatTanggalIndo(i.tanggalRaw)}</small>
                <div class="mt-1 text-dark" style="font-size:13px; line-height:1.4;">
                    ${i.uraian ? i.uraian.substring(0, 65) : '-'}...
                </div>
            </div>
            <span class="badge bg-primary rounded-pill" style="font-size:10px">${i.shift || '-'}</span>
        </li>`).join('') || '<li class="list-group-item text-center">Belum ada aktivitas.</li>';
}

function renderDowntimeTerbaru() {
    const container = document.getElementById("listRecentDowntime");
    if (!container) return; // Keluar jika elemen tidak ditemukan di halaman ini

    if (!downtimeGlobal || downtimeGlobal.length === 0) {
        container.innerHTML = '<div class="text-center text-muted py-3">Tidak ada data downtime terbaru.</div>';
        return;
    }

    // 1. Urutkan berdasarkan tanggal kejadian terbaru
    const sortedDT = [...downtimeGlobal].sort((a, b) => {
        if (b.tanggalRaw !== a.tanggalRaw) {
            return b.tanggalRaw - a.tanggalRaw;
        }
        return b.timestampRaw - a.timestampRaw;
    });

    // 2. Ambil 5 data teratas dan masukkan ke HTML
    container.innerHTML = sortedDT.slice(0, 5).map(i => `
        <div class="list-group-item list-group-item-action d-flex justify-content-between align-items-center py-3">
            <div style="max-width: 75%;">
                <div class="fw-bold text-danger" style="font-size:14px;">${i.site}</div>
                <div class="text-muted" style="font-size:12px;">
                    📅 ${formatTanggalIndo(i.tanggalRaw)} | 🕒 ${i.waktu || '-'}
                </div>
                <div class="mt-1 text-dark" style="font-size:13px; line-height:1.4;">
                    ${i.keterangan ? i.keterangan.substring(0, 50) : '-'}...
                </div>
            </div>
            <div class="text-end">
                <span class="badge bg-warning text-dark rounded-pill" style="font-size:11px">
                    ${formatDurasi(i.durasi)}
                </span>
            </div>
        </div>
    `).join('') || '<div class="text-center py-3">Tidak ada downtime transmisi.</div>';
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

    // Filter data
    const filtered = dataGlobal.filter(i => {
        const d = new Date(i.tanggalRaw); 
        const matchNama = (fNama === "Semua" || i.nama === fNama);
        const matchBulan = (fBulan === "Semua" || d.getMonth().toString() === fBulan);
        const matchTahun = (fTahun === "Semua" || d.getFullYear().toString() === fTahun);
        return matchNama && matchBulan && matchTahun;
    });

    // Sortir: Data input terbaru di atas
    const sorted = filtered.sort((a, b) => b.timestampRaw - a.timestampRaw);

    tBody.innerHTML = sorted.map(i => {
        // Logika Eviden menggunakan variabel yang sesuai (eviden1, eviden2, eviden3)
        let docs = "";
        if (i.eviden1 && String(i.eviden1).startsWith("http")) docs += `<a href="${i.eviden1}" target="_blank" class="btn btn-primary btn-eviden me-1" style="font-size:10px">E1</a>`;
        if (i.eviden2 && String(i.eviden2).startsWith("http")) docs += `<a href="${i.eviden2}" target="_blank" class="btn btn-info btn-eviden text-white me-1" style="font-size:10px">E2</a>`;
        if (i.eviden3 && String(i.eviden3).startsWith("http")) docs += `<a href="${i.eviden3}" target="_blank" class="btn btn-secondary btn-eviden" style="font-size:10px">E3</a>`;
        
        // Gabungkan waktu mulai dan selesai untuk kolom Waktu
        const rentangWaktu = (i.waktuMulai && i.waktuSelesai) ? `${i.waktuMulai} - ${i.waktuSelesai}` : "-";

        return `<tr>
            <td class="text-center" style="white-space:nowrap;">${formatTanggalIndo(i.tanggalRaw)}</td>
            <td><strong>${i.nama}</strong></td>
            <td class="text-center">${i.shift || '-'}</td>
            <td class="text-center" style="white-space:nowrap;">${rentangWaktu}</td>
            <td>${i.sasaran || ''}</td>
            <td>${i.uraian || ''}</td>
            <td class="text-center">${docs || '-'}</td>
            <td>${i.keterangan || '-'}</td>
        </tr>`;
    }).join('') || '<tr><td colspan="8" class="text-center py-4">Tidak ada data untuk periode ini.</td></tr>';
}

function tampilkanTabelParameter() {
    const tBody = document.getElementById("tabelParameterBody");
    if (!tBody) return;

    const fUnit = document.getElementById("filterUnit").value;
    const fTahun = document.getElementById("filterTahunParam") ? document.getElementById("filterTahunParam").value : "Semua";
    const fBulan = document.getElementById("filterBulanParam") ? document.getElementById("filterBulanParam").value : "Semua";

    const filtered = parameterGlobal.filter(i => {
        const d = new Date(i.tanggalRaw);
        const matchUnit = (fUnit === "Semua" || i.unit === fUnit);
        const matchTahun = (fTahun === "Semua" || d.getFullYear().toString() === fTahun);
        const matchBulan = (fBulan === "Semua" || d.getMonth().toString() === fBulan);
        return matchUnit && matchTahun && matchBulan;
    });

    const sorted = filtered.sort((a, b) => b.tanggalRaw - a.tanggalRaw);

    tBody.innerHTML = sorted.map(i => `
        <tr class="text-center">
            <td class="text-nowrap">${formatTanggalIndo(i.tanggalRaw)}</td>
            <td>${i.unit}</td>
            <td class="text-start" style="min-width:150px">${i.petugas}</td>
            <td>${i.shift}</td>
            <td>${i.txStatus}</td>
            <td>${i.power}</td>
            <td>${i.reflected}</td>
            <td>${i.freq}</td>
            <td>${i.exciter}</td>
            <td>${i.hpaOnh}</td>
            <td>${i.paOff}</td>
            <td>${i.hpaAlarm}</td>
            <td>${i.linkMargin}</td>
            <td>${i.cnIrd}</td>
            <td>${i.avStatus}</td>
            <td>${i.exchanger}</td>
            <td>${i.suhu}</td>
            <td class="small text-start">${i.konten}</td>
            <td class="text-danger fw-bold">${i.lineR}</td>
            <td class="text-warning fw-bold">${i.lineS}</td>
            <td class="text-primary fw-bold">${i.lineT}</td>
        </tr>
    `).join('') || '<tr><td colspan="21" class="text-center py-5">Data tidak ditemukan.</td></tr>';
    renderGrafikPetugasParameter();
}

function renderGrafikPetugasParameter() {
    const canvas = document.getElementById('chartPetugasParameter');
    if (!canvas || !parameterGlobal.length) return;

    // Ambil nilai filter saat ini
    const fUnit = document.getElementById("filterUnit").value;
    const fTahun = document.getElementById("filterTahunParam").value;
    const fBulan = document.getElementById("filterBulanParam").value;

    // 1. Filter data sesuai pilihan dropdown
    const filtered = parameterGlobal.filter(i => {
        const d = new Date(i.tanggalRaw);
        const matchUnit = (fUnit === "Semua" || i.unit === fUnit);
        const matchTahun = (fTahun === "Semua" || d.getFullYear().toString() === fTahun);
        const matchBulan = (fBulan === "Semua" || d.getMonth().toString() === fBulan);
        return matchUnit && matchTahun && matchBulan;
    });

    // 2. Hitung frekuensi per nama (Pecah jika ada lebih dari 1 nama)
    const counts = {};
    filtered.forEach(i => {
        if (i.petugas) {
            // Memecah nama berdasarkan koma, ampersand (&), atau kata "dan"
            const listNama = i.petugas.split(/[,&]| dan /);
            listNama.forEach(nama => {
                const namaBersih = nama.trim();
                if (namaBersih) {
                    counts[namaBersih] = (counts[namaBersih] || 0) + 1;
                }
            });
        }
    });

    // 3. Urutkan label secara alfabetis agar rapi
    const sortedLabels = Object.keys(counts).sort();
    const sortedValues = sortedLabels.map(label => counts[label]);

    // 4. Render Grafik Garis Mulus
    if (chartPetugasParamInstance) chartPetugasParamInstance.destroy();
    chartPetugasParamInstance = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            labels: sortedLabels,
            datasets: [{
                label: 'Jumlah Laporan',
                data: sortedValues,
                borderColor: '#003366', // Biru gelap TVRI
                backgroundColor: 'rgba(0, 51, 102, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4, // Membuat garis menjadi mulus (curvy)
                pointRadius: 5,
                pointBackgroundColor: '#d9534f', // Titik warna merah agar kontras
                pointBorderColor: '#fff'
            }]
        },
        options: {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
        padding: {
            left: 20,  // Tambahkan ruang di kiri grafik
            right: 20, // Tambahkan ruang di kanan grafik
            top: 10,
            bottom: 10
        }
    },
    scales: {
                y: { 
                    beginAtZero: true, 
                    ticks: { stepSize: 1, font: { size: 10 } },
                    title: { display: true, text: 'Frekuensi', font: { size: 11, weight: 'bold' } }
                },
                x: { 
                    ticks: { autoSkip: false, font: { size: 10 } } 
                }
            },
            plugins: {
                legend: { display: false } // Sembunyikan legend agar lebih bersih
            }
        }
    });
}

function inisialisasiFilterUnitParameter() {
    const s = document.getElementById("filterUnit");
    // Jika dropdown tidak ada atau sudah terisi, jangan isi lagi
    if (!s || s.options.length > 1) return;

    // Ambil daftar unit unik dari data yang masuk
    const units = [...new Set(parameterGlobal.map(i => i.unit))].filter(u => u).sort();
    
    let html = '<option value="Semua">Semua Unit Kerja</option>';
    units.forEach(u => {
        html += `<option value="${u}">${u}</option>`;
    });
    s.innerHTML = html;
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

    const sorted = filtered.sort((a, b) => {
        // Level 1: Urutkan berdasarkan Tanggal Kejadian (Terbaru di atas)
        if (b.tanggalRaw !== a.tanggalRaw) {
            return b.tanggalRaw - a.tanggalRaw;
        }
        // Level 2: Jika tanggal sama, urutkan berdasarkan Waktu Input/Timestamp (Terbaru di atas)
        return b.timestampRaw - a.timestampRaw;
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
                label: 'Frekuensi Downtime', 
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
                    title: { display: true, text: 'Durasi Downtime' }
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

    const sorted = filtered.sort((a, b) => {
        // Level 1: Urutkan berdasarkan Tanggal Kejadian (Terbaru di atas)
        if (b.tanggalRaw !== a.tanggalRaw) {
            return b.tanggalRaw - a.tanggalRaw;
        }
        // Level 2: Jika tanggal sama, urutkan berdasarkan Waktu Input/Timestamp (Terbaru di atas)
        return b.timestampRaw - a.timestampRaw;
    });

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
            <td class="text-center" style="white-space:nowrap;">${formatTanggalIndo(i.tanggalRaw)}</td>
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
          <a href="index.html" class="menu-modern ${page === 'index.html' ? 'active' : ''}">🏠 Beranda</a>
          
          <a class="menu-modern w-100 justify-content-between d-flex align-items-center" 
             data-bs-toggle="collapse" 
             href="#menuForms" 
             role="button" 
             aria-expanded="false">
            <span>📝 Input Form</span>
            <i class="bi bi-chevron-down small"></i>
          </a>
          
          <div class="collapse" id="menuForms">
            <div class="ps-4" style="background-color: rgba(0,0,0,0.1);"> 
              <a href="${urlFormMaster.downtime}" target="_blank" class="text-decoration-none text-white-50 d-block py-2 small border-bottom border-secondary border-opacity-25">
                <i class="bi bi-broadcast me-2"></i> Form Downtime
              </a>
              <a href="${urlFormMaster.dvbt2}" target="_blank" class="text-decoration-none text-white-50 d-block py-2 small border-bottom border-secondary border-opacity-25">
                <i class="bi bi-file-text me-2"></i> Form Metering DVB-T2
              </a>
              <a href="${urlFormMaster.bbm}" target="_blank" class="text-decoration-none text-white-50 d-block py-2 small border-bottom border-secondary border-opacity-25">
                <i class="bi bi-fuel-pump me-2"></i> Akan Hadir!
              </a>
              <a href="${urlFormMaster.redundansi}" target="_blank" class="text-decoration-none text-white-50 d-block py-2 small border-bottom border-secondary border-opacity-25">
                <i class="bi bi-check-circle me-2"></i> Akan Hadir!
              </a>
              <a href="${urlFormMaster.sparepart}" target="_blank" class="text-decoration-none text-white-50 d-block py-2 small border-bottom border-secondary border-opacity-25">
                <i class="bi bi-box-seam me-2"></i> Akan Hadir!
              </a>
              <a href="${urlFormMaster.tamu}" target="_blank" class="text-decoration-none text-white-50 d-block py-2 small">
                <i class="bi bi-person-badge me-2"></i> Akan Hadir!
              </a>
            </div>
          </div>

          <a href="log-petugas.html" class="menu-modern ${page === 'log-petugas.html' ? 'active' : ''}">📋 Log Kinerja</a>
          <a href="parameter.html" class="menu-modern ${page === 'parameter.html' ? 'active' : ''}">📊 Monitoring DVB-T2</a>
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
    `;
    container.innerHTML = sidebarHTML;
}
async function prosesLogin() {
    const user = document.getElementById('inputUser').value; // Sesuai ID di modal sidebar
    const pass = document.getElementById('inputPass').value; // Sesuai ID di modal sidebar
    const btn = document.querySelector("#loginModal button");
    
    if (!user || !pass) return alert("Mohon isi username dan password!");

    const teksAsli = btn.innerText;
    btn.innerText = "⏳ Memverifikasi...";
    btn.disabled = true;

    try {
        // Memanggil URL dengan action=login
        const response = await fetch(`${scriptURL}?action=login&user=${encodeURIComponent(user)}&pass=${encodeURIComponent(pass)}`);
        const result = await response.json();

        if (result.success) {
            isLoggedIn = true;
            localStorage.setItem("isLoggedIn", "true");
            alert("Login Berhasil, Pak Gilang!");
            
            const modalElement = document.getElementById('loginModal');
            const modal = bootstrap.Modal.getInstance(modalElement);
            if (modal) modal.hide();
            
            location.reload(); 
        } else {
            alert("Username atau Password Salah! Periksa kembali.");
        }
    } catch (error) {
        console.error("Login Error:", error);
        alert("Gagal terhubung ke server. Pastikan Web App sudah di-Deploy sebagai 'New Version'.");
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
        const res = await fetch(`${scriptURL}?action=previewPDF&nama=${encodeURIComponent(n)}&bulan=${b}&tahun=${t}`);
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
    if (!ts || ts === 0) return "-";
    const d = new Date(ts);
    const bln = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    return `${d.getDate()} ${bln[d.getMonth()]} ${d.getFullYear()}`;
}

let toggleTimer; // Untuk menyimpan interval

function startAutoToggle() {
    // Bersihkan timer lama agar tidak tumpang tindih
    if (toggleTimer) clearInterval(toggleTimer);

    toggleTimer = setInterval(() => {
        const urutan = ['status', 'kegiatan', 'downtime'];
        let currentIndex = urutan.indexOf(currentSlide);
        
        // Pindah ke slide berikutnya
        currentSlide = urutan[(currentIndex + 1) % urutan.length];
        
        // Update tampilan
        updateBeranda();
    }, 8000); // Ganti setiap 8 detik
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

function login() {
    const userInp = document.getElementById("usernameInput").value;
    const passInp = document.getElementById("passwordInput").value;
    
    const validUser = localStorage.getItem("masterUser");
    const validPass = localStorage.getItem("masterPassword");

    if (userInp === validUser && passInp === validPass) {
        localStorage.setItem("isLoggedIn", "true");
        alert("Login Berhasil!");
        location.reload(); 
    } else {
        alert("Username atau Password Salah!");
    }
}

// --- FUNGSI JAM REAL-TIME ---
function updateClock() {
    const clockElement = document.getElementById('realtimeClock');
    if (!clockElement) return;

    const now = new Date();
    const jam = String(now.getHours()).padStart(2, '0');
    const menit = String(now.getMinutes()).padStart(2, '0');
    const detik = String(now.getSeconds()).padStart(2, '0');

    clockElement.innerText = `${jam}:${menit}:${detik}`;
}

// Jalankan jam setiap 1 detik
setInterval(updateClock, 1000);

// Panggil sekali di awal agar tidak menunggu 1 detik pertama
updateClock();

let sliderTimer; 

function jalankanSlider() {
    if (sliderTimer) clearInterval(sliderTimer);

    sliderTimer = setInterval(() => {
        const urutan = ['status', 'kegiatan', 'downtime'];
        let indexSekarang = urutan.indexOf(currentSlide);
        let indexBerikutnya = (indexSekarang + 1) % urutan.length;
        currentSlide = urutan[indexBerikutnya];

        console.log("Slider berpindah ke:", currentSlide);
        updateBeranda(); 
    }, 8000); 
}

// --- 8. RUN ON START ---
document.addEventListener("DOMContentLoaded", () => {
    muatDataOtomatis();
    updateClock();
});
setInterval(muatDataOtomatis, 600000);