// --- 1. KONFIGURASI API & GLOBAL ---
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw5TdGNPS58uNfg5vC4ysxN-4_t6ojjcnF80LZU28YEZ776LmevU5170bJ94qRO7Pf1/exec"; 

let dataGlobal = []; 
let statusGlobal = []; 
let grafikInstance = null;
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
        if (document.getElementById("lastUpdated")) {
            document.getElementById("lastUpdated").innerText = "Gagal Sinkron";
        }
    }
}

function inisialisasiHalaman() {
    if (document.getElementById("gridStatusTx")) updateBeranda();
    
    if (document.getElementById("tabelBody")) {
        // Panggil pengisi filter
        prosesFilterDropdown(); 
        // Panggil pengisi tahun (agar tidak "Data tidak ditemukan")
        inisialisasiFilterTahun(); 
        // Tampilkan tabel
        tampilkanLogTabel();
        // Cek tombol PDF
        cekStatusTombolPreview();
    }
    
    if (document.getElementById("grafikPegawai")) renderGrafik();
}

// --- 3. LOGIKA DASHBOARD (index.html) ---
function updateBeranda() {
    // DEBUG: Cek apakah data masuk atau tidak (Bisa dihapus jika sudah ok)
    console.log("Data Logs:", dataGlobal);
    console.log("Data Status TX:", statusGlobal);

    // --- 1. KARTU STATISTIK ---
    if (document.getElementById("statTotalLaporan")) {
        document.getElementById("statTotalLaporan").innerText = dataGlobal.length;
    }

    if (document.getElementById("statHariIni")) {
        const hariIni = new Date().toLocaleDateString('en-CA');
        const countHariIni = dataGlobal.filter(i => {
            // Kita pastikan ambil data mentah timestamp
            const tgl = new Date(i.timestampTanggal).toLocaleDateString('en-CA');
            return tgl === hariIni;
        }).length;
        document.getElementById("statHariIni").innerText = countHariIni;
    }

    if (document.getElementById("statTotalPersonel")) {
        const listPetugas = [...new Set(dataGlobal.map(i => i.nama))].filter(n => n);
        document.getElementById("statTotalPersonel").innerText = listPetugas.length;
    }

    // --- 2. PERBAIKAN TX NORMAL (Menghitung Site 'Normal' atau 'On') ---
    if (document.getElementById("statEviden")) {
        const txNormal = statusGlobal.filter(i => {
            // Ambil field status (pastikan namanya sesuai dengan di Dashboard.gs)
            const s = i.status ? String(i.status).toLowerCase().trim() : "";
            return s === "normal" || s === "on" || s === "online" || s === "on air";
        }).length;
        document.getElementById("statEviden").innerText = txNormal;
    }

    // --- 3. RENDER GRID SITE (MENGEMBALIKAN TAMPILAN SITE) ---
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

    // --- 4. RENDER 5 KEGIATAN TERBARU (FIX JAM 00:00) ---
    // Urutkan berdasarkan waktu asli milidetik
    const dataUrut = [...dataGlobal].sort((a, b) => new Date(b.timestampTanggal) - new Date(a.timestampTanggal));
    const recent = dataUrut.slice(0, 5);

    const listRecent = document.getElementById("listRecentActivity");
    if (listRecent) {
        listRecent.innerHTML = recent.map(i => {
            // Karena di Apps Script kamu sudah menambahkan " WIB", 
            // kita langsung panggil saja i.mulai dan i.selesai
            const rentangWaktu = `${i.mulai} - ${i.selesai}`;

            return `
                <li class="list-group-item d-flex justify-content-between align-items-center py-3">
                    <div style="max-width: 85%;">
                        <div class="fw-bold" style="font-size:14px; color:#003366">${i.nama}</div>
                        <small class="text-muted">
                            📅 ${formatTanggalIndo(i.timestampTanggal)} • 🕒 ${rentangWaktu}
                        </small>
                        <div class="mt-1 text-dark" style="font-size:13px; line-height:1.4;">
                            ${i.uraian ? i.uraian.substring(0, 65) : '-'}...
                        </div>
                    </div>
                    <span class="badge bg-primary rounded-pill" style="font-size:10px">${i.shift || '-'}</span>
                </li>`;
        }).join('') || '<li class="list-group-item text-center">Belum ada aktivitas</li>';
    }
}


// --- 4. LOGIKA TABEL (log-petugas.html) ---
function prosesFilterDropdown() {
    const filterNama = document.getElementById("filterNama");
    // Ubah syarat: Jika masih berisi "Memuat" atau "Semua", maka isi dengan data baru
    if (filterNama && (filterNama.options.length <= 1 || filterNama.value === "Semua")) {
        const names = [...new Set(dataGlobal.map(i => i.nama))].filter(n => n).sort();
        let html = '<option value="Semua">-- Tampilkan Semua --</option>';
        names.forEach(n => html += `<option value="${n}">${n}</option>`);
        filterNama.innerHTML = html;
    }
    
    // Inisialisasi Tahun jika elemen ada
    const filterTahun = document.getElementById("filterTahun");
    if (filterTahun && filterTahun.options.length <= 1) {
        const years = [...new Set(dataGlobal.map(i => new Date(i.timestampTanggal).getFullYear()))].sort((a,b) => b-a);
        let htmlTahun = '<option value="Semua">Semua Tahun</option>';
        // Jika data kosong/gagal, minimal ada tahun sekarang
        if (years.length === 0) years.push(new Date().getFullYear());
        years.forEach(y => {
            if(!isNaN(y)) htmlTahun += `<option value="${y}">${y}</option>`;
        });
        filterTahun.innerHTML = htmlTahun;
    }
}

function tampilkanLogTabel() {
    const n = document.getElementById("filterNama").value;
    const b = document.getElementById("filterBulan").value;
    const t = document.getElementById("filterTahun") ? document.getElementById("filterTahun").value : "Semua";
    const tBody = document.getElementById("tabelBody");
    
    if (!tBody) return;

    // 1. Filter data tetap menggunakan timestampTanggal untuk urusan Bulan/Tahun sistem
    const filtered = dataGlobal.filter(i => {
        const d = new Date(i.timestampTanggal);
        const matchNama = (n === "Semua" || i.nama === n);
        const matchBulan = (b === "Semua" || d.getMonth().toString() === b);
        const matchTahun = (t === "Semua" || d.getFullYear().toString() === t);
        return matchNama && matchBulan && matchTahun;
    });

    // 2. Sorting tetap berdasarkan Timestamp (Terbaru di atas)
    filtered.sort((a, b) => new Date(b.timestampTanggal) - new Date(a.timestampTanggal));

    tBody.innerHTML = filtered.map(i => {
        let docs = "";
        if (i.link1 && i.link1.trim().startsWith("http")) {
            docs += `<a href="${i.link1}" target="_blank" class="btn btn-primary btn-eviden me-1">E1</a>`;
        }
        if (i.link2 && i.link2.trim().startsWith("http")) {
            docs += `<a href="${i.link2}" target="_blank" class="btn btn-info btn-eviden text-white me-1">E2</a>`;
        }
        if (i.link3 && i.link3.trim().startsWith("http")) {
            docs += `<a href="${i.link3}" target="_blank" class="btn btn-secondary btn-eviden">E3</a>`;
        }
        
        return `
            <tr>
                <td class="text-center">${formatTanggalIndo(i.tanggal)}</td>
                <td class="text-center">${i.nama}</td>
                <td class="text-center">${i.shift || '-'}</td>
                <td class="text-center small">${i.mulai} - ${i.selesai}</td> 
                <td>${i.sasaran || ''}</td>
                <td>${i.uraian || ''}</td>
                <td class="text-center">${docs || '-'}</td>
                <td>${i.keterangan || '-'}</td>
            </tr>`;
    }).join('') || '<tr><td colspan="8" class="text-center py-4">Data tidak ditemukan</td></tr>';
}

// --- 5. LOGIKA SIDEBAR & MODAL (Auto-Inject) ---
function renderSidebar() {
    const container = document.getElementById('sidebar-container');
    if (!container) return;

    const path = window.location.pathname;
    const page = path.split("/").pop() || "index.html";

    let sidebarHTML = `
    <div class="offcanvas offcanvas-start text-white" tabindex="-1" id="menuSidebar">
      <div class="offcanvas-header">
        <h5 class="offcanvas-title">Menu E-Kinerja</h5>
        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="offcanvas"></button>
      </div>
      <div class="offcanvas-body p-0 mt-3">
        <div class="list-group list-group-flush">
          <a href="index.html" class="menu-modern ${page === 'index.html' ? 'active' : ''}"><span class="menu-icon">🏠</span> Dashboard</a>
          <a href="log-petugas.html" class="menu-modern ${page === 'log-petugas.html' ? 'active' : ''}"><span class="menu-icon">📋</span> Log Kinerja</a>
          <a href="statistik.html" class="menu-modern ${page === 'statistik.html' ? 'active' : ''}"><span class="menu-icon">📈</span> Statistik</a>
          <hr class="mx-3 my-2 opacity-10">
          
          <a href="#" data-bs-toggle="modal" data-bs-target="#profilModal" onclick="isiDataProfil()" class="menu-modern">
            <span class="menu-icon">👤</span> Profil User
          </a>`;

    if (isLoggedIn) {
        sidebarHTML += `
          <a href="#" onclick="tambahUserBaru()" class="menu-modern" style="background: rgba(40, 167, 69, 0.1);">
            <span class="menu-icon">➕</span> Tambah User (Admin)
          </a>`;
    }

    sidebarHTML += `
          <hr class="mx-3 my-2 opacity-10">
          <a href="https://s.id/formindividu" target="_blank" class="menu-modern"><span class="menu-icon">📝</span> Input Form</a>
          <a href="#" ${isLoggedIn ? 'onclick="logoutAdmin()"' : 'data-bs-toggle="modal" data-bs-target="#loginModal"'} class="menu-modern">
            <span class="menu-icon">${isLoggedIn ? '🔓' : '🔐'}</span> <span>${isLoggedIn ? 'Logout Admin' : 'Login Admin'}</span>
          </a>
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
              <div class="mb-2"><small class="fw-bold text-muted">STATUS LOGIN:</small><br><span class="badge bg-success">${isLoggedIn ? 'Administrator' : 'Petugas Umum'}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>`;

    container.innerHTML = sidebarHTML;
}

// --- 6. LOGIKA LOGIN & UTILITY ---
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
        
        // PENTING: Update tombol preview setelah login berhasil
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
    alert("Berhasil Logout.");
}

function isiDataProfil() {
    // 1. Tentukan nama berdasarkan status login
    let namaTampilan = isLoggedIn ? "Admin" : "Anonymous";

    // 2. Ambil elemen HTML
    const elNama = document.getElementById('profNama');
    const elPic = document.getElementById('profPic');

    // 3. Masukkan data ke tampilan
    if (elNama) {
        elNama.innerText = namaTampilan;
    }
    
    if (elPic) {
        // Menggunakan UI Avatars agar foto profil berubah sesuai nama
        elPic.src = `https://ui-avatars.com/api/?name=${namaTampilan}&background=003366&color=fff&size=128`;
    }
    
    // Opsional: Update status label di bawah nama
    const elStatus = document.querySelector('#profilModal .badge');
    if (elStatus) {
        elStatus.innerText = isLoggedIn ? "Administrator" : "-";
        elStatus.className = isLoggedIn ? "badge bg-success" : "badge bg-secondary";
    }
}

function tambahUserBaru() {
    alert("Fitur Tambah User Admin sedang disiapkan di Google Sheets TVRI.");
}

function formatTanggalIndo(ts) {
    if (!ts) return "-";
    const d = new Date(ts);
    
    // Mengambil tanggal (tanpa angka 0 di depan untuk tanggal 1-9)
    const tanggal = d.getDate(); 
    
    // Daftar bulan dalam Bahasa Indonesia
    const daftarBulan = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    const bulan = daftarBulan[d.getMonth()];
    const tahun = d.getFullYear();

    return `${tanggal} ${bulan} ${tahun}`;
}

// --- 7. ANIMASI FADE & RUN ---
function startAutoToggle() {
    const sEl = document.getElementById('itemStatus');
    const rEl = document.getElementById('itemRecent');
    if (!sEl || !rEl) return;

    setInterval(() => {
        const slideStatus = document.getElementById('itemStatus');
        const slideRecent = document.getElementById('itemRecent');
        if (currentSlide === 'status') {
            slideStatus.classList.remove('active');
            slideRecent.classList.add('active');
            currentSlide = 'recent';
        } else {
            slideRecent.classList.remove('active');
            slideStatus.classList.add('active');
            currentSlide = 'status';
        }
    }, 8000);
}

// --- 8. LOGIKA GRAFIK (statistik.html) ---
function renderGrafik() {
    const canvas = document.getElementById('grafikPegawai');
    // Jika elemen canvas tidak ada (berarti bukan di halaman statistik), batalkan proses
    if (!canvas) return; 

    const ctx = canvas.getContext('2d');
    
    // Hitung data berdasarkan nama petugas
    const counts = {};
    dataGlobal.forEach(i => { 
        if(i.nama && i.nama.trim() !== "") {
            counts[i.nama] = (counts[i.nama] || 0) + 1; 
        }
    });

    const labels = Object.keys(counts);
    const values = Object.values(counts);

    // Jika dataGlobal masih kosong, tampilkan pesan di Console agar kita tahu
    if (labels.length === 0) {
        console.warn("Data untuk grafik belum siap.");
        return;
    }

    // Hapus grafik lama sebelum menggambar yang baru (agar tidak tumpang tindih)
    if (grafikInstance) {
        grafikInstance.destroy();
    }
    
    // Pastikan library Chart.js sudah ter-load di statistik.html
    if (typeof Chart === 'undefined') {
        console.error("Library Chart.js tidak ditemukan! Pastikan CDN Chart.js sudah dipasang di statistik.html");
        return;
    }

    grafikInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Total Kegiatan Petugas',
                data: values,
                backgroundColor: '#003366',
                borderColor: '#002244',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1 } }
            }
        }
    });
}

async function buatPreview() {
    // Syarat terakhir sebelum kirim ke Google
    if (!isLoggedIn) return alert("Silakan login Admin!");
    
    const n = document.getElementById("filterNama").value;
    const b = document.getElementById("filterBulan").value;
    const t = document.getElementById("filterTahun").value;
    
    const btn = document.getElementById("btnPreview");
    btn.innerHTML = "⏳ Sedang Memproses...";
    btn.disabled = true;

    // URL ini harus sesuai dengan SCRIPT_URL milikmu
    const url = `${SCRIPT_URL}?action=previewPDF&nama=${encodeURIComponent(n)}&bulan=${b}&tahun=${t}`;
    
    try {
        const res = await fetch(url);
        const data = await res.json();
        
        btn.innerHTML = "📄 PDF PREVIEW";
        btn.disabled = false;

        if (data.success) {
            document.getElementById("tempatLink").innerHTML = `
                <a href="${data.url}" target="_blank" class="btn btn-primary w-100 mt-2 animate__animated animate__bounceIn">
                    🚀 BUKA PDF (${n})
                </a>`;
        } else {
            alert("Gagal: " + data.message);
        }
    } catch (e) {
        alert("Koneksi ke server gagal!");
        btn.innerHTML = "📄 PDF PREVIEW";
        btn.disabled = false;
    }
}

// Fungsi untuk mengaktifkan/mematikan tombol Preview
function cekStatusTombolPreview() {
    const filterNama = document.getElementById("filterNama");
    const btnPreview = document.getElementById("btnPreview");
    
    if (!filterNama || !btnPreview) return;

    // Tombol hanya aktif jika: 1. Sudah Login, 2. Nama bukan "Semua"
    if (isLoggedIn && filterNama.value !== "Semua") {
        btnPreview.disabled = false;
        btnPreview.classList.remove("btn-secondary"); // Hapus warna abu-abu
        btnPreview.classList.add("btn-success");      // Ganti jadi hijau
    } else {
        btnPreview.disabled = true;
        btnPreview.classList.add("btn-secondary");
        btnPreview.classList.remove("btn-success");
    }
}

// 1. Fungsi untuk mengisi Filter Tahun secara otomatis
function inisialisasiFilterTahun() {
    const s = document.getElementById("filterTahun");
    if (!s) return;
    
    const tahunSekarang = new Date().getFullYear();
    let html = `<option value="Semua">Semua Tahun</option>`;
    for (let t = 2024; t <= tahunSekarang; t++) {
        html += `<option value="${t}">${t}</option>`;
    }
    s.innerHTML = html;
}

// 2. Fungsi untuk mengisi Filter Nama berdasarkan data yang ada
function inisialisasiFilterNama() {
    const s = document.getElementById("filterNama");
    if (!s || dataGlobal.length === 0) return;

    // Mengambil nama unik dari dataGlobal
    const daftarNama = [...new Set(dataGlobal.map(i => i.nama))].sort();
    
    let html = `<option value="Semua">-- Tampilkan Semua --</option>`;
    daftarNama.forEach(nama => {
        html += `<option value="${nama}">${nama}</option>`;
    });
    s.innerHTML = html;
}

async function muatData() {
    try {
        const response = await fetch(SCRIPT_URL);
        const json = await response.json();
        
        dataGlobal = json.logs || [];
        statusGlobal = json.statusTx || [];

        // --- Jalankan fungsi sesuai halaman yang sedang dibuka ---
        
        // 1. Isi Sidebar (Wajib untuk semua halaman)
        if (typeof renderSidebar === "function") renderSidebar();

        // 2. Jika di halaman Beranda
        if (document.getElementById("listRecentActivity")) {
            updateBeranda();
        }

        // 3. Jika di halaman Log Petugas (log-petugas.html)
        if (document.getElementById("tabelBody")) {
            inisialisasiFilterTahun(); // Isi tahun dulu
            inisialisasiFilterNama();  // Isi nama dulu
            tampilkanLogTabel();       // Baru tampilkan tabel
        }

    } catch (error) {
        console.error("Gagal memuat data:", error);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    renderSidebar(); 
    muatDataOtomatis();
    startAutoToggle(); 
});
setInterval(muatDataOtomatis, 600000);